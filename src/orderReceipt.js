const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const ITEMS_PER_PAGE = 4;
const receiptCache = new WeakMap();

function isNativeApp() {
  try {
    return !!window.Capacitor?.isNativePlatform?.();
  } catch (_) {
    return false;
  }
}

export function canShareOrderReceipt() {
  if (isNativeApp()) return true;
  if (!navigator.share || !navigator.canShare || typeof File === 'undefined') return false;
  try {
    return navigator.canShare({
      files: [new File(['invoice'], 'invoice.pdf', { type: 'application/pdf' })]
    });
  } catch (_) {
    return false;
  }
}

export async function createOrderReceiptPdf(order) {
  if (!order || typeof order !== 'object') throw new Error('Order is required');
  if (receiptCache.has(order)) return receiptCache.get(order);

  const task = buildOrderReceipt(order);
  receiptCache.set(order, task);
  try {
    return await task;
  } catch (error) {
    receiptCache.delete(order);
    throw error;
  }
}

export async function downloadOrderReceipt(order) {
  const receipt = await createOrderReceiptPdf(order);
  const url = URL.createObjectURL(receipt.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = receipt.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return receipt;
}

export async function shareOrderReceipt(order) {
  const receipt = await createOrderReceiptPdf(order);
  const title = `JOULANE Fashion - ${receipt.reference}`;

  if (isNativeApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share')
    ]);
    const data = await blobToBase64(receipt.blob);
    const written = await Filesystem.writeFile({
      path: receipt.fileName,
      data,
      directory: Directory.Cache
    });
    try {
      await Share.share({
        title,
        text: receipt.summary,
        files: [written.uri],
        dialogTitle: 'مشاركة فاتورة الطلب'
      });
    } finally {
      Filesystem.deleteFile({ path: receipt.fileName, directory: Directory.Cache }).catch(() => {});
    }
    return receipt;
  }

  const file = new File([receipt.blob], receipt.fileName, { type: 'application/pdf' });
  if (canShareOrderReceipt()) {
    await navigator.share({ title, text: receipt.summary, files: [file] });
    return receipt;
  }

  return downloadOrderReceipt(order);
}

async function buildOrderReceipt(order) {
  const { jsPDF } = await import('jspdf');
  const items = Array.isArray(order.items) && order.items.length
    ? order.items
    : [{
        nameAr: order.productName || 'منتج',
        color: order.color || '-',
        seriesQty: parseInt(order.seriesQty, 10) || 1,
        pairsCount: 0,
        price: Number(order.productPrice) || 0,
        image: order.image || ''
      }];
  const pageItems = [];
  for (let index = 0; index < items.length; index += ITEMS_PER_PAGE) {
    pageItems.push(items.slice(index, index + ITEMS_PER_PAGE));
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  for (let pageIndex = 0; pageIndex < pageItems.length; pageIndex += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    await drawPage(context, order, pageItems[pageIndex], pageIndex + 1, pageItems.length);
    if (pageIndex > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.91),
      'JPEG',
      0,
      0,
      595.28,
      841.89,
      `order-${order.id}-${pageIndex}`,
      'FAST'
    );
  }

  const reference = String(order.id || `JOU-${Date.now()}`).replace(/^#/, '');
  return {
    blob: pdf.output('blob'),
    fileName: `JOULANE-${reference}.pdf`,
    reference,
    summary: `طلب JOULANE Fashion رقم ${reference}\nالزبون: ${order.customerName || '-'}\nالمجموع: ${
      order.pricesHidden || order.deliveryPriceHidden
        ? 'يتم تحديد السعر عند التواصل'
        : formatMoney(order.totalAmount)
    }`
  };
}

async function drawPage(context, order, items, pageNumber, totalPages) {
  context.fillStyle = '#f5f3ee';
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = '#111111';
  context.fillRect(0, 0, PAGE_WIDTH, 262);
  context.fillStyle = '#d4af37';
  context.fillRect(0, 252, PAGE_WIDTH, 10);

  const logo = await loadImage('https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/skilwjfxosy60qtgwkxw.jpg');
  if (logo) {
    context.save();
    rounded(context, 1040, 50, 130, 130, 18);
    context.clip();
    drawCover(context, logo, 1040, 50, 130, 130);
    context.restore();
  }

  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#e9cb65';
  context.font = '800 42px Arial, sans-serif';
  context.fillText('JOULANE FASHION', 1005, 84);
  context.fillStyle = '#ffffff';
  context.font = '800 38px Arial, sans-serif';
  context.fillText('وصل تأكيد الطلب', 1005, 140);
  context.fillStyle = '#bdbdbd';
  context.font = '500 22px Arial, sans-serif';
  context.fillText('وثيقة إلكترونية تحتوي على تفاصيل طلبك', 1005, 182);

  context.fillStyle = '#1d1d1d';
  rounded(context, 70, 48, 400, 150, 16);
  context.fill();
  context.strokeStyle = '#6a5823';
  context.lineWidth = 2;
  context.stroke();
  context.textAlign = 'center';
  context.fillStyle = '#999999';
  context.font = '600 19px Arial, sans-serif';
  context.fillText('مرجع الطلب', 270, 82);
  context.fillStyle = '#e9cb65';
  context.font = '800 25px Arial, sans-serif';
  context.fillText(String(order.id || '-').replace(/^#/, ''), 270, 124, 350);
  context.fillStyle = '#dddddd';
  context.font = '600 18px Arial, sans-serif';
  context.fillText(`الصفحة ${pageNumber} من ${totalPages}`, 270, 164);

  drawInfoCard(context, order);
  await drawItems(context, order, items);
  drawTotals(context, order);
  drawFooter(context, order);
}

function drawInfoCard(context, order) {
  context.fillStyle = '#ffffff';
  rounded(context, 70, 300, 1100, 222, 14);
  context.fill();
  context.strokeStyle = '#d8d4ca';
  context.lineWidth = 1.5;
  context.stroke();

  const fields = [
    ['الزبون / المحل', order.customerName || '-'],
    ['رقم الهاتف', order.phone || '-'],
    ['الولاية والبلدية', `${order.wilaya || '-'} - ${order.commune || '-'}`],
    ['شركة ونوع التوصيل', `كازيتور — ${order.deliveryLabel || order.deliveryType || '-'}`],
    ['العنوان', order.address || '-'],
    ['تاريخ الطلب', formatDate(order.createdAt || order.timestamp)]
  ];
  fields.forEach(([label, value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = 1120 - column * 360;
    const y = 342 + row * 91;
    context.direction = 'rtl';
    context.textAlign = 'right';
    context.fillStyle = '#8a857c';
    context.font = '600 17px Arial, sans-serif';
    context.fillText(label, x, y);
    context.fillStyle = '#1b1b1b';
    context.font = '700 21px Arial, sans-serif';
    fitText(context, value, x, y + 31, 310);
  });
}

async function drawItems(context, order, items) {
  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#191919';
  context.font = '800 29px Arial, sans-serif';
  context.fillText('المنتجات المطلوبة', 1170, 574);
  context.fillStyle = '#d4af37';
  context.fillRect(70, 590, 1100, 4);

  const images = await Promise.all(items.map(item => loadImage(item.image)));
  items.forEach((item, index) => {
    const y = 622 + index * 205;
    context.fillStyle = index % 2 ? '#fbfaf7' : '#ffffff';
    rounded(context, 70, y, 1100, 178, 12);
    context.fill();
    context.strokeStyle = '#ddd9d0';
    context.lineWidth = 1.5;
    context.stroke();

    if (images[index]) {
      context.save();
      rounded(context, 1008, y + 14, 142, 150, 9);
      context.clip();
      drawCover(context, images[index], 1008, y + 14, 142, 150);
      context.restore();
    } else {
      context.fillStyle = '#ece9e1';
      rounded(context, 1008, y + 14, 142, 150, 9);
      context.fill();
    }

    context.direction = 'rtl';
    context.textAlign = 'right';
    context.fillStyle = '#171717';
    context.font = '800 25px Arial, sans-serif';
    fitText(context, item.nameAr || item.nameFr || item.productName || 'منتج', 980, y + 48, 420);
    context.fillStyle = '#777168';
    context.font = '600 18px Arial, sans-serif';
    context.fillText(`اللون: ${normalizeColor(item.color)}`, 980, y + 83, 410);
    context.fillText(`المرجع: ${item.productId || '-'}`, 980, y + 116, 410);

    const cartons = Number(item.seriesQty) || parseInt(item.seriesQty, 10) || 0;
    const pairs = Number(item.pairsCount) || cartons * (Number(item.pairsPerSeries) || 0);
    drawMetric(context, 'الكرطون', cartons, 485, y + 72);
    drawMetric(context, 'الأزواج', pairs, 340, y + 72);
    if (!order.pricesHidden) drawMetric(context, 'المبلغ', formatMoney(item.price), 175, y + 72, 250);
  });
}

function drawMetric(context, label, value, x, y, width = 125) {
  context.direction = 'rtl';
  context.textAlign = 'center';
  context.fillStyle = '#f2eee2';
  rounded(context, x - width / 2, y - 40, width, 88, 10);
  context.fill();
  context.fillStyle = '#8b7850';
  context.font = '600 15px Arial, sans-serif';
  context.fillText(label, x, y - 12);
  context.fillStyle = '#191919';
  context.font = '800 21px Arial, sans-serif';
  context.fillText(String(value), x, y + 21, width - 12);
}

function drawTotals(context, order) {
  const y = 1460;
  context.fillStyle = '#171717';
  rounded(context, 70, y, 1100, 126, 14);
  context.fill();
  const fields = order.pricesHidden
    ? [['حالة السعر', 'يتم تحديد السعر عند التواصل']]
    : order.deliveryPriceHidden
      ? [
          ['مجموع المنتجات', formatMoney(order.productPrice)],
          ['التوصيل', 'يتم تحديد السعر عند التواصل'],
          ['الإجمالي', 'يتم تحديد السعر عند التواصل']
        ]
    : [
        ['مجموع المنتجات', formatMoney(order.productPrice)],
        ['التوصيل', formatMoney(order.shippingFee)],
        ['الإجمالي عند الاستلام', formatMoney(order.totalAmount)]
      ];
  fields.forEach(([label, value], index) => {
    const x = 1030 - index * 350;
    context.direction = 'rtl';
    context.textAlign = 'center';
    context.fillStyle = '#aaa69d';
    context.font = '600 17px Arial, sans-serif';
    context.fillText(label, x, y + 40);
    context.fillStyle = index === fields.length - 1 ? '#e9cb65' : '#ffffff';
    context.font = '800 24px Arial, sans-serif';
    context.fillText(value, x, y + 82, 310);
  });
}

function drawFooter(context, order) {
  context.fillStyle = '#d4af37';
  context.fillRect(70, 1630, 1100, 3);
  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#635f58';
  context.font = '600 17px Arial, sans-serif';
  context.fillText('شكراً لاختياركم JOULANE Fashion — سنراجع طلبكم ونتواصل معكم للتأكيد.', 1170, 1672);
  context.direction = 'ltr';
  context.textAlign = 'left';
  context.fillStyle = '#171717';
  context.font = '700 16px Arial, sans-serif';
  context.fillText(String(order.id || '').replace(/^#/, ''), 70, 1715);
}

function fitText(context, value, x, y, maxWidth) {
  const text = String(value || '-');
  context.fillText(text, x, y, maxWidth);
}

function normalizeColor(value) {
  if (Array.isArray(value)) return value.join('، ');
  if (value && typeof value === 'object') return value.nameAr || value.nameFr || value.label || '-';
  return String(value || '-');
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

function rounded(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawCover(context, image, x, y, width, height) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  context.drawImage(
    image,
    (sourceWidth - cropWidth) / 2,
    (sourceHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
    x,
    y,
    width,
    height
  );
}

function loadImage(url) {
  return new Promise(resolve => {
    if (!url) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    if (/^https?:\/\//i.test(url)) image.crossOrigin = 'anonymous';
    image.src = url;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
