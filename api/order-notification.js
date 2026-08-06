import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { handleAppCors } from './_app-cors.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (handleAppCors(request, response)) return;
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS');
    return response.status(405).json({ status: 'method_not_allowed' });
  }

  const orderId = String(request.body?.orderId || '').trim();
  if (!orderId || orderId.length > 120) return response.status(400).json({ status: 'invalid_order' });

  const client = getSupabaseClient();
  if (!client) return response.status(503).json({ status: 'pending_setup' });

  const { data: claim, error: claimError } = await client.rpc('joulane_notification_claim', {
    p_secret: process.env.ORDER_NOTIFICATION_SECRET,
    p_order_id: orderId
  });
  if (claimError) {
    console.error('Notification claim failed', claimError);
    return response.status(500).json({ status: 'failed' });
  }
  if (!claim?.order) {
    const status = claim?.status || 'not_found';
    return response.status(status === 'already_sent' || status === 'processing' ? 200 : 404).json({ status });
  }

  if (!whatsappConfigured()) {
    await complete(client, orderId, 'pending_setup', '', 'WhatsApp Business environment is incomplete');
    return response.status(503).json({ status: 'pending_setup' });
  }

  const origin = request.headers['x-forwarded-host']
    ? `https://${request.headers['x-forwarded-host']}`
    : `${request.headers['x-forwarded-proto'] || 'https'}://${request.headers.host}`;
  const expires = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const signature = sign(orderId, expires);
  const invoiceUrl = `${origin}/api/order-invoice?orderId=${encodeURIComponent(orderId)}&expires=${expires}&signature=${signature}`;

  try {
    const metaResponse = await sendWhatsApp(claim.order, invoiceUrl);
    const messageId = metaResponse?.messages?.[0]?.id || '';
    await complete(client, orderId, 'sent', messageId, '');
    return response.status(200).json({ status: 'sent', messageId });
  } catch (error) {
    const message = String(error?.message || error).slice(0, 1000);
    console.error('WhatsApp notification failed', message);
    await complete(client, orderId, 'failed', '', message);
    return response.status(502).json({ status: 'failed' });
  }
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !process.env.ORDER_NOTIFICATION_SECRET) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function whatsappConfigured() {
  return !!(
    process.env.WHATSAPP_ACCESS_TOKEN
    && process.env.WHATSAPP_PHONE_NUMBER_ID
    && process.env.WHATSAPP_ADMIN_TO
  );
}

async function sendWhatsApp(order, invoiceUrl) {
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';
  const endpoint = `https://graph.facebook.com/${graphVersion}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const templateName = String(process.env.WHATSAPP_TEMPLATE_NAME || '').trim();
  const payload = templateName
    ? buildTemplatePayload(order, invoiceUrl, templateName)
    : buildDocumentPayload(order, invoiceUrl);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const metaMessage = body?.error?.message || `Meta API returned ${response.status}`;
    throw new Error(metaMessage);
  }
  return body;
}

function buildTemplatePayload(order, invoiceUrl, templateName) {
  const filename = `JOULANE-${safeFileName(order.id)}.pdf`;
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: digits(process.env.WHATSAPP_ADMIN_TO),
    type: 'template',
    template: {
      name: templateName,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'ar' },
      components: [
        {
          type: 'header',
          parameters: [{ type: 'document', document: { link: invoiceUrl, filename } }]
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(order.id || '-') },
            { type: 'text', text: String(order.customerName || '-') },
            { type: 'text', text: String(order.phone || '-') },
            { type: 'text', text: String(order.totalAmount || 0) }
          ]
        }
      ]
    }
  };
}

function buildDocumentPayload(order, invoiceUrl) {
  const itemCount = Array.isArray(order.items) ? order.items.length : 0;
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: digits(process.env.WHATSAPP_ADMIN_TO),
    type: 'document',
    document: {
      link: invoiceUrl,
      filename: `JOULANE-${safeFileName(order.id)}.pdf`,
      caption: [
        `طلب جديد: ${order.id}`,
        `الزبون: ${order.customerName || '-'}`,
        `الهاتف: ${order.phone || '-'}`,
        `المكان: ${order.wilaya || '-'} - ${order.commune || '-'}`,
        `التوصيل: كازيتور — ${order.deliveryLabel || order.deliveryType || '-'}`,
        `عدد الموديلات: ${itemCount}`,
        order.pricesHidden || order.deliveryPriceHidden
          ? 'السعر: يتم تحديد السعر عند التواصل'
          : `الإجمالي: ${order.totalAmount || 0} دج`
      ].join('\n')
    }
  };
}

async function complete(client, orderId, status, messageId, errorMessage) {
  await client.rpc('joulane_notification_complete', {
    p_secret: process.env.ORDER_NOTIFICATION_SECRET,
    p_order_id: orderId,
    p_status: status,
    p_message_id: messageId || null,
    p_error: errorMessage || null
  });
}

function sign(orderId, expires) {
  return crypto
    .createHmac('sha256', process.env.ORDER_NOTIFICATION_SECRET)
    .update(`${orderId}.${expires}`)
    .digest('hex');
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function safeFileName(value) {
  return String(value || 'order').replace(/[^a-z0-9_-]/gi, '-');
}
