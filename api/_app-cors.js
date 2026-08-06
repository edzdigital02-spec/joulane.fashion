const APP_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'ionic://localhost'
]);

export function handleAppCors(request, response) {
  const origin = String(request.headers?.origin || '').trim().toLowerCase();
  const allowed = APP_ORIGINS.has(origin);

  if (allowed) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Max-Age', '86400');
    response.setHeader('Vary', 'Origin');
  }

  if (request.method !== 'OPTIONS') return false;
  response.setHeader('Allow', 'POST, OPTIONS');
  if (!allowed) {
    response.status(403).json({ status: 'origin_not_allowed' });
    return true;
  }
  response.status(204).end();
  return true;
}
