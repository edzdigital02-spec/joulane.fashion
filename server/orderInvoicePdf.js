import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { jsPDF } from 'jspdf';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const regularFont = fs.readFileSync(path.join(moduleDir, 'assets', 'NotoSansArabic-Regular.ttf')).toString('base64');
const boldFont = fs.readFileSync(path.join(moduleDir, 'assets', 'NotoSansArabic-Bold.ttf')).toString('base64');
const WIDTH = 1240;
const HEIGHT = 1754;
const ITEMS_PER_PAGE = 5;

export async function createOrderInvoiceBuffer(order, origin) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const pageCount = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageItems = items.slice(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE);
    const images = await Promise.all(pageItems.map(item => fetchImageData(item?.image, origin)));
    const svg = buildPageSvg(order, pageItems, images, pageIndex + 1, pageCount);
    const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 91, chromaSubsampling: '4:4:4' }).toBuffer();
    if (pageIndex > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(
      `data:image/jpeg;base64,${jpeg.toString('base64')}`,
      'JPEG',
      0,
      0,
      595.28,
      841.89,
      `invoice-page-${pageIndex + 1}`,
      'FAST'
    );
  }

  return Buffer.from(pdf.output('arraybuffer'));
}

function buildPageSvg(order, items, images, page, pages) {
  const productRows = items.map((item, index) => productRowSvg(order, item, images[index], 610 + index * 178)).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
       width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <style>
        @font-face { font-family: "JoulaneArabic"; src: url("data:font/ttf;base64,${regularFont}"); font-weight: 400; }
        @font-face { font-family: "JoulaneArabic"; src: url("data:font/ttf;base64,${boldFont}"); font-weight: 700; }
        text { font-family: "JoulaneArabic", Arial, sans-serif; }
        .rtl { direction: rtl; unicode-bidi: plaintext; text-anchor: end; }
        .center { text-anchor: middle; }
      </style>
    </defs>
    <rect width="1240" height="1754" fill="#f6f4ef"/>
    <rect width="1240" height="260" fill="#111111"/>
    <rect y="250" width="1240" height="10" fill="#d4af37"/>

    ${text('JOULANE FASHION', 1165, 78, 43, '#e9cb65', 700, 'end', 'ltr')}
    ${text('فاتورة تأكيد الطلب', 760, 137, 39, '#ffffff', 700)}
    ${text('طلب بيع بالجملة — وثيقة إلكترونية', 760, 187, 23, '#bdbdbd', 400)}

    <rect x="70" y="45" width="430" height="156" rx="18" fill="#1d1d1d" stroke="#6a5823" stroke-width="2"/>
    ${text('مرجع الطلب', 285, 83, 20, '#9f9f9f', 400, 'middle')}
    ${text(clean(order.id), 285, 128, 28, '#e9cb65', 700, 'middle', 'ltr')}
    ${text(`الصفحة ${page} من ${pages}`, 285, 169, 19, '#dddddd', 400, 'middle')}

    <rect x="70" y="300" width="1100" height="218" rx="16" fill="#ffffff" stroke="#d8d4ca" stroke-width="2"/>
    ${infoCell('الزبون / المحل', order.customerName, 800, 348)}
    ${infoCell('رقم الهاتف', order.phone, 440, 348)}
    ${infoCell('الولاية والبلدية', `${order.wilaya || '-'} - ${order.commune || '-'}`, 90, 348)}
    ${infoCell('شركة ونوع التوصيل', `كازيتور — ${order.deliveryLabel || order.deliveryType || '-'}`, 800, 436)}
    ${infoCell('العنوان', order.address, 440, 436)}
    ${infoCell('تاريخ الطلب', formatDate(order.createdAt || order.timestamp), 90, 436)}

    ${text('المنتجات المطلوبة', 880, 570, 31, '#191919', 700)}
    <rect x="70" y="586" width="1100" height="4" fill="#d4af37"/>
    ${productRows}

    <rect x="70" y="1516" width="1100" height="126" rx="16" fill="#171717"/>
    ${totalsSvg(order)}

    <rect x="70" y="1680" width="1100" height="3" fill="#d4af37"/>
    ${text('شكراً لاختياركم JOULANE Fashion — سنتواصل معكم لتأكيد الطلب.', 400, 1720, 18, '#5f5b54', 400)}
    ${text(clean(order.id), 70, 1720, 17, '#171717', 700, 'start', 'ltr')}
  </svg>`;
}

function infoCell(label, value, x, y) {
  return `
    ${text(label, x, y, 18, '#8a857c', 400)}
    ${text(truncate(value, 36), x, y + 36, 23, '#1b1b1b', 700)}
  `;
}

function productRowSvg(order, item, imageData, y) {
  const cartons = Number(item?.seriesQty) || parseInt(item?.seriesQty, 10) || 0;
  const pairs = Number(item?.pairsCount) || cartons * (Number(item?.pairsPerSeries) || 0);
  const image = imageData
    ? `<image x="1015" y="${y + 14}" width="135" height="142" preserveAspectRatio="xMidYMid slice" href="${imageData}"/>`
    : `<rect x="1015" y="${y + 14}" width="135" height="142" rx="9" fill="#ece9e1"/>
       ${text('JOULANE', 1082, y + 90, 15, '#8a857c', 700, 'middle', 'ltr')}`;
  const amount = order.pricesHidden ? '' : metricSvg('المبلغ', formatMoney(item?.price), 175, y + 78, 250);
  return `
    <rect x="70" y="${y}" width="1100" height="164" rx="13" fill="#ffffff" stroke="#ddd9d0" stroke-width="2"/>
    ${image}
    ${text(truncate(item?.nameAr || item?.nameFr || item?.productName || 'منتج', 34), 650, y + 48, 27, '#171717', 700)}
    ${text(`اللون: ${truncate(normalizeColor(item?.color), 30)}`, 650, y + 88, 20, '#777168', 400)}
    ${text(`المرجع: ${item?.productId || '-'}`, 650, y + 125, 19, '#777168', 400)}
    ${metricSvg('الكرطون', cartons, 500, y + 78, 130)}
    ${metricSvg('الأزواج', pairs, 340, y + 78, 130)}
    ${amount}
  `;
}

function metricSvg(label, value, x, y, width) {
  return `
    <rect x="${x - width / 2}" y="${y - 40}" width="${width}" height="90" rx="11" fill="#f2eee2"/>
    ${text(label, x, y - 10, 16, '#8b7850', 400, 'middle')}
    ${text(String(value), x, y + 26, 22, '#191919', 700, 'middle')}
  `;
}

function totalsSvg(order) {
  if (order.pricesHidden) {
    return text('يتم تحديد السعر عند التواصل', 620, 1592, 29, '#e9cb65', 700, 'middle');
  }
  if (order.deliveryPriceHidden) {
    return `
      ${summaryValue('مجموع المنتجات', formatMoney(order.productPrice), 990)}
      ${summaryValue('التوصيل', 'يتم تحديد السعر عند التواصل', 620)}
      ${summaryValue('الإجمالي', 'يتم تحديد السعر عند التواصل', 250, '#e9cb65')}
    `;
  }
  return `
    ${summaryValue('مجموع المنتجات', formatMoney(order.productPrice), 990)}
    ${summaryValue('التوصيل', formatMoney(order.shippingFee), 620)}
    ${summaryValue('الإجمالي عند الاستلام', formatMoney(order.totalAmount), 250, '#e9cb65')}
  `;
}

function summaryValue(label, value, x, color = '#ffffff') {
  return `
    ${text(label, x, 1558, 17, '#aaa69d', 400, 'middle')}
    ${text(value, x, 1605, 27, color, 700, 'middle')}
  `;
}

function text(value, x, y, size, fill, weight = 400, anchor = 'start', direction = 'rtl') {
  const klass = anchor === 'middle' ? 'center' : direction === 'rtl' ? 'rtl' : '';
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}"
    text-anchor="${anchor}" direction="${direction}" unicode-bidi="plaintext" class="${klass}">${escapeXml(value || '-')}</text>`;
}

async function fetchImageData(source, origin) {
  if (!source) return '';
  try {
    const url = new URL(source, origin).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return '';
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return '';
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (_) {
    return '';
  }
}

function normalizeColor(value) {
  if (Array.isArray(value)) return value.join('، ');
  if (value && typeof value === 'object') return value.nameAr || value.nameFr || value.label || '-';
  return String(value || '-');
}

function truncate(value, maximum) {
  const normalized = String(value || '-').trim();
  return normalized.length > maximum ? `${normalized.slice(0, maximum - 1)}…` : normalized;
}

function formatMoney(value) {
  return `${new Intl.NumberFormat('fr-DZ').format(Number(value) || 0)} دج`;
}

function formatDate(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return String(value || '-');
  return date.toLocaleString('ar-DZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function clean(value) {
  return String(value || '-').replace(/^#/, '');
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
