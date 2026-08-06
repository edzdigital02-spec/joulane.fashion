import { createHash } from 'node:crypto';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Cloudinary is not configured' });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'joulane/products';
  const signature = createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ cloudName, apiKey, timestamp, folder, signature });
}
