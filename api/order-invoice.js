import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createOrderInvoiceBuffer } from '../server/orderInvoicePdf.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const orderId = String(request.query?.orderId || '').trim();
  const expires = Number(request.query?.expires || 0);
  const signature = String(request.query?.signature || '');
  if (!orderId || !expires || expires < Math.floor(Date.now() / 1000) || !validSignature(orderId, expires, signature)) {
    return response.status(403).json({ error: 'invalid_or_expired_link' });
  }

  const client = getSupabaseClient();
  if (!client) return response.status(503).json({ error: 'server_not_configured' });
  const { data, error } = await client.rpc('joulane_notification_order', {
    p_secret: process.env.ORDER_NOTIFICATION_SECRET,
    p_order_id: orderId
  });
  if (error || !data?.order) return response.status(404).json({ error: 'order_not_found' });

  try {
    const origin = request.headers['x-forwarded-host']
      ? `https://${request.headers['x-forwarded-host']}`
      : `${request.headers['x-forwarded-proto'] || 'https'}://${request.headers.host}`;
    const pdf = await createOrderInvoiceBuffer(data.order, origin);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `inline; filename="JOULANE-${safeFileName(orderId)}.pdf"`);
    response.setHeader('Cache-Control', 'private, max-age=300');
    return response.status(200).send(pdf);
  } catch (error_) {
    console.error('Invoice generation failed', error_);
    return response.status(500).json({ error: 'invoice_generation_failed' });
  }
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !process.env.ORDER_NOTIFICATION_SECRET) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function validSignature(orderId, expires, provided) {
  if (!provided || !process.env.ORDER_NOTIFICATION_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', process.env.ORDER_NOTIFICATION_SECRET)
    .update(`${orderId}.${expires}`)
    .digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function safeFileName(value) {
  return String(value || 'order').replace(/[^a-z0-9_-]/gi, '-');
}
