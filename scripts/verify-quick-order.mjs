import assert from 'node:assert/strict';
import handler from '../api/quick-order.js';
import { PRODUCTS } from '../src/data/products.js';

const persistedOrders = [];
const storedOrders = new Map();
const product = {
  ...PRODUCTS[0],
  isAvailable: true,
  price: 3200,
  pairsPerSeries: 15,
  pairsPerSeriesConfigured: false,
  seriesPrice: 48000
};

globalThis.fetch = async (url, options = {}) => {
  if (String(url).includes('/rest/v1/joulane_store?')) {
    return new Response(JSON.stringify([
      { id: 'products', data: [product] },
      { id: 'shipping', data: { _showPrices: true, 1: { homePrice: 500, deskPrice: 300 } } },
      { id: 'config', data: { hideAllPrices: false } }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (String(url).includes('/rest/v1/rpc/joulane_submit_order')) {
    const order = JSON.parse(options.body).p_order;
    persistedOrders.push(order);
    if (!storedOrders.has(order.id)) storedOrders.set(order.id, order);
    return new Response('true', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error(`Unexpected fetch in quick-order verification: ${url}`);
};

function responseMock() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
    end() { return this; }
  };
}

async function submit(body, ip = '198.51.100.10') {
  const response = responseMock();
  await handler({ method: 'POST', body, headers: { 'x-forwarded-for': ip } }, response);
  return response;
}

const baseOrder = {
  requestId: '11111111-2222-4333-8444-555555555555',
  productId: product.id,
  customerName: 'متجر الاختبار',
  phone: '0550000001',
  wilayaCode: 1,
  commune: 'Adrar',
  address: 'وسط المدينة',
  deliveryType: 'home',
  cartons: 2,
  language: 'ar',
  pageUrl: 'https://example.test/ar/produits/test/'
};

const allowedPreflight = responseMock();
await handler({ method: 'OPTIONS', headers: { origin: 'https://localhost' } }, allowedPreflight);
assert.equal(allowedPreflight.statusCode, 204);
assert.equal(allowedPreflight.headers['Access-Control-Allow-Origin'], 'https://localhost');

const rejectedPreflight = responseMock();
await handler({ method: 'OPTIONS', headers: { origin: 'https://untrusted.example' } }, rejectedPreflight);
assert.equal(rejectedPreflight.statusCode, 403);

const first = await submit(baseOrder);
assert.equal(first.statusCode, 201);
assert.equal(first.payload.pairsCount, 36, 'Legacy 15-pair cartons must normalize to 18 pairs');
assert.equal(first.payload.productTotal, 115200);
assert.equal(first.payload.shippingFee, 500);
assert.equal(first.payload.totalAmount, 115700);
assert.match(first.payload.trackingCode, /^JLN-[A-Z2-9]{10}$/);
assert.equal(first.payload.trackingUrl, `https://www.joulanefashion.com/?track=${first.payload.trackingCode}#track-order`);

const exactRetry = await submit(baseOrder);
assert.equal(exactRetry.statusCode, 201);
assert.equal(exactRetry.payload.orderId, first.payload.orderId, 'An exact retry must keep a stable order ID');
assert.equal(exactRetry.payload.trackingCode, first.payload.trackingCode, 'An exact retry must keep a stable tracking code');
assert.equal(storedOrders.size, 1, 'An exact retry must not create a second stored order');

const changedRetry = await submit({ ...baseOrder, cartons: 3 });
assert.equal(changedRetry.statusCode, 201);
assert.notEqual(changedRetry.payload.orderId, first.payload.orderId, 'Changed order data must not reuse a stale order ID');
assert.equal(changedRetry.payload.totalAmount, 173300);
assert.equal(storedOrders.size, 2);

const invalidPhone = await submit({
  ...baseOrder,
  requestId: '22222222-2222-4333-8444-555555555555',
  phone: '123'
});
assert.equal(invalidPhone.statusCode, 400);

const rateStatuses = [];
for (let index = 0; index < 5; index += 1) {
  const result = await submit({
    ...baseOrder,
    requestId: `33333333-2222-4333-8444-55555555555${index}`,
    phone: '0550000002'
  }, '198.51.100.20');
  rateStatuses.push(result.statusCode);
}
assert.deepEqual(rateStatuses, [201, 201, 201, 201, 429]);

console.log(JSON.stringify({
  status: 'ok',
  pairsPerCarton: first.payload.pairsCount / baseOrder.cartons,
  exactRetryOrderId: exactRetry.payload.orderId,
  changedRetryOrderId: changedRetry.payload.orderId,
  rateStatuses
}, null, 2));
