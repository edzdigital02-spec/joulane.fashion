import crypto from 'node:crypto';
import { PRODUCTS } from '../src/data/products.js';
import { WILAYAS } from '../src/data/wilayas.js';
import { localizedProductTitle, productImageUrl } from '../src/productSeo.js';
import { handleAppCors } from './_app-cors.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jsnsmqwznljllqmnzfrx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_kkXNEOz2KfLvbcpCXYR0uw_9eHV4G5h';
const DEFAULT_UNIT_PRICE = 3200;
const DEFAULT_PAIRS = 18;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PHONE_ATTEMPTS = 4;
const MAX_IP_ATTEMPTS = 12;
const rateBuckets = globalThis.__joulaneQuickOrderRateBuckets || new Map();
globalThis.__joulaneQuickOrderRateBuckets = rateBuckets;
const TRACKING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createTrackingCode(seed) {
  const bytes = crypto.createHash('sha256').update(String(seed)).digest().subarray(0, 10);
  return `JLN-${Array.from(bytes, byte => TRACKING_ALPHABET[byte % TRACKING_ALPHABET.length]).join('')}`;
}

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function positiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function configFlag(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes', 'visible'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no', 'hidden'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeProduct(product) {
  const rawPairs = Math.floor(positiveNumber(product?.pairsPerSeries, DEFAULT_PAIRS));
  const legacyPairs = product?.pairsPerSeriesConfigured !== true && rawPairs === 15;
  const pairsPerSeries = legacyPairs ? DEFAULT_PAIRS : rawPairs;
  const unitPrice = positiveNumber(product?.price, DEFAULT_UNIT_PRICE);
  const rawCartonPrice = positiveNumber(product?.seriesPrice, 0);
  const legacyCartonPrice = legacyPairs && Math.abs(rawCartonPrice - (unitPrice * rawPairs)) < 0.01;
  const seriesPrice = !rawCartonPrice || legacyCartonPrice
    ? unitPrice * pairsPerSeries
    : rawCartonPrice;
  return { ...product, pairsPerSeries, price: unitPrice, seriesPrice };
}

function shippingAmount(rate, field) {
  const amount = Number(rate?.[field]);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function safeAttribution(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const allowed = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'capturedAt']);
  const cleanTouch = touch => {
    if (!touch || typeof touch !== 'object' || Array.isArray(touch)) return null;
    const result = {};
    Object.entries(touch).forEach(([key, item]) => {
      if (allowed.has(key) && typeof item === 'string') result[key] = cleanText(item, 500);
    });
    return Object.keys(result).length ? result : null;
  };
  const firstTouch = cleanTouch(value.firstTouch);
  const lastTouch = cleanTouch(value.lastTouch);
  return firstTouch || lastTouch ? { ...(firstTouch ? { firstTouch } : {}), ...(lastTouch ? { lastTouch } : {}) } : null;
}

function requestIp(request) {
  const forwarded = String(request.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(request.headers?.['x-real-ip'] || request.socket?.remoteAddress || 'unknown').slice(0, 120);
}

function consumeRateLimit(key, limit, now) {
  const bucket = rateBuckets.get(key);
  const active = bucket && now - bucket.startedAt < RATE_WINDOW_MS
    ? bucket
    : { startedAt: now, count: 0 };
  active.count += 1;
  rateBuckets.set(key, active);
  return active.count <= limit;
}

function quickOrderAllowed(request, phone, replayToken) {
  const now = Date.now();
  if (rateBuckets.size > 2000) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(key);
    }
  }
  const replayKey = `request:${replayToken}`;
  if (rateBuckets.has(replayKey)) return true;
  const ip = requestIp(request);
  const phoneAllowed = consumeRateLimit(`phone:${phone}`, MAX_PHONE_ATTEMPTS, now);
  const ipAllowed = consumeRateLimit(`ip:${ip}`, MAX_IP_ATTEMPTS, now);
  if (phoneAllowed && ipAllowed) rateBuckets.set(replayKey, { startedAt: now, count: 1 });
  return phoneAllowed && ipAllowed;
}

async function liveStorefrontData() {
  const endpoint = `${SUPABASE_URL}/rest/v1/joulane_store?select=id,data&id=in.(products,shipping,config)`;
  const response = await fetch(endpoint, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`storefront_read_${response.status}`);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).reduce((result, row) => {
    result[row.id] = row.data;
    return result;
  }, {});
}

async function persistOrder(order) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/joulane_submit_order`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_order: order }),
    signal: AbortSignal.timeout(10000)
  });
  const result = await response.json().catch(() => false);
  if (!response.ok || result !== true) throw new Error(`order_write_${response.status}`);
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (handleAppCors(request, response)) return;
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS');
    return response.status(405).json({ status: 'method_not_allowed' });
  }

  const body = request.body && typeof request.body === 'object' ? request.body : {};
  if (JSON.stringify(body).length > 20000) return response.status(413).json({ status: 'invalid', error: 'payload_too_large' });
  if (cleanText(body.website, 120)) {
    return response.status(200).json({ status: 'created', orderId: `JOU-${Date.now().toString(36).toUpperCase()}` });
  }

  const productId = cleanText(body.productId, 120);
  const requestId = cleanText(body.requestId, 100);
  const customerName = cleanText(body.customerName, 80);
  const phone = cleanText(body.phone, 20).replace(/\D/g, '').slice(0, 10);
  const wilayaCode = Math.floor(Number(body.wilayaCode));
  const commune = cleanText(body.commune, 100);
  const deliveryType = body.deliveryType === 'desk' ? 'desk' : 'home';
  const addressInput = cleanText(body.address, 180);
  const cartons = Math.floor(Number(body.cartons));
  const language = body.language === 'fr' ? 'fr' : 'ar';

  if (!productId || !/^[a-z0-9-]{16,100}$/i.test(requestId) || customerName.length < 3 || !/^0[567]\d{8}$/.test(phone)) {
    return response.status(400).json({ status: 'invalid', error: 'invalid_customer' });
  }
  if (!Number.isInteger(cartons) || cartons < 1 || cartons > 50) {
    return response.status(400).json({ status: 'invalid', error: 'invalid_quantity' });
  }
  const wilaya = WILAYAS.find(item => Number(item.code) === wilayaCode);
  const validCommunes = new Set([...(wilaya?.communesAr || []), ...(wilaya?.communesFr || [])].map(String));
  if (!wilaya || !commune || !validCommunes.has(commune)) {
    return response.status(400).json({ status: 'invalid', error: 'invalid_location' });
  }
  if (deliveryType === 'home' && addressInput.length < 4) {
    return response.status(400).json({ status: 'invalid', error: 'invalid_address' });
  }
  const requestFingerprint = crypto.createHash('sha256').update(JSON.stringify([
    requestId,
    productId,
    customerName,
    phone,
    wilayaCode,
    commune,
    deliveryType,
    addressInput,
    cartons,
    language
  ])).digest('hex').slice(0, 16);
  if (!quickOrderAllowed(request, phone, `${requestId}:${requestFingerprint}`)) {
    response.setHeader('Retry-After', String(Math.ceil(RATE_WINDOW_MS / 1000)));
    return response.status(429).json({ status: 'rate_limited', error: 'too_many_requests' });
  }

  let storefront = {};
  try {
    storefront = await liveStorefrontData();
  } catch (_) {
    // Static products keep the order path available during a brief public-read outage.
  }
  const products = Array.isArray(storefront.products) ? storefront.products : PRODUCTS;
  const liveProduct = products.find(item => item.id === productId);
  if (!liveProduct) return response.status(404).json({ status: 'invalid', error: 'product_not_found' });
  const product = normalizeProduct(liveProduct);
  if (product.isAvailable === false) return response.status(409).json({ status: 'invalid', error: 'product_unavailable' });

  const shippingRates = storefront.shipping && typeof storefront.shipping === 'object' ? storefront.shipping : {};
  const config = storefront.config && typeof storefront.config === 'object' ? storefront.config : {};
  const shippingVisible = configFlag(shippingRates._showPrices, false);
  const pricesHidden = configFlag(config.hideAllPrices, false);
  const rate = shippingRates[String(wilayaCode)] || shippingRates[wilayaCode] || wilaya;
  const shippingFee = shippingVisible
    ? shippingAmount(rate, deliveryType === 'desk' ? 'deskPrice' : 'homePrice')
    : 0;
  const productTotal = product.seriesPrice * cartons;
  const totalAmount = productTotal + shippingFee;
  const createdAt = new Date();
  const orderFingerprint = crypto.createHash('sha256').update(JSON.stringify([
    requestFingerprint,
    product.pairsPerSeries,
    product.seriesPrice,
    shippingFee,
    totalAmount
  ])).digest('hex').slice(0, 12).toUpperCase();
  const orderId = `JOU-Q-${requestId.toUpperCase()}-${orderFingerprint}`;
  const trackingCode = createTrackingCode(orderId);
  const nameAr = localizedProductTitle(product, 'ar');
  const nameFr = localizedProductTitle(product, 'fr');
  const colorsAr = Array.isArray(product.colors?.ar) ? product.colors.ar.filter(Boolean) : [];
  const colorsFr = Array.isArray(product.colors?.fr) ? product.colors.fr.filter(Boolean) : [];
  const color = language === 'fr'
    ? (colorsFr.join(' + ') || 'Couleurs assorties selon le modèle')
    : (colorsAr.join(' + ') || 'ألوان الكرتون حسب الموديل');
  const address = deliveryType === 'home'
    ? addressInput
    : (addressInput || (language === 'fr' ? 'Retrait au bureau de livraison' : 'الاستلام من مكتب التوصيل'));
  const deliveryLabel = deliveryType === 'home'
    ? (language === 'fr' ? 'Livraison à l’adresse' : 'التوصيل إلى العنوان')
    : (language === 'fr' ? 'Bureau Kazitour' : 'مكتب كازيتور');
  const order = {
    id: orderId,
    trackingCode,
    clientRequestId: requestId,
    orderFingerprint,
    timestamp: createdAt.toLocaleString(language === 'fr' ? 'fr-DZ' : 'ar-DZ'),
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    customerName,
    phone,
    wilaya: language === 'fr' ? wilaya.nameFr : wilaya.nameAr,
    wilayaCode,
    commune,
    address,
    deliveryType,
    deliveryLabel,
    productName: language === 'fr' ? nameFr : nameAr,
    items: [{
      productId: product.id,
      nameAr,
      nameFr,
      image: productImageUrl(product),
      color,
      seriesQty: cartons,
      seriesPrice: product.seriesPrice,
      pairsPerSeries: product.pairsPerSeries,
      pairsCount: cartons * product.pairsPerSeries,
      price: productTotal
    }],
    color,
    seriesQty: `${cartons} كرطون`,
    productPrice: productTotal,
    shippingFee,
    totalAmount,
    pricesHidden,
    deliveryPriceHidden: !shippingVisible,
    attribution: safeAttribution(body.attribution),
    source: 'quick_order_product_page',
    sourcePage: cleanText(body.pageUrl, 1000),
    status: 'New',
    history: [{ action: 'status_changed', status: 'New', at: createdAt.toISOString(), by: 'quick_order' }]
  };

  try {
    await persistOrder(order);
  } catch (error) {
    console.error('Quick order persistence failed', String(error?.message || error));
    return response.status(502).json({ status: 'failed', error: 'order_not_saved' });
  }

  return response.status(201).json({
    status: 'created',
    orderId,
    trackingCode,
    trackingUrl: `https://www.joulanefashion.com/?track=${encodeURIComponent(trackingCode)}#track-order`,
    productTotal,
    shippingFee,
    totalAmount,
    pairsCount: cartons * product.pairsPerSeries
  });
}
