const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const receiptPdfCache = new WeakMap();

export function getStockReceiptReference(movement) {
  const date = getMovementDate(movement);
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('');
  const suffix = String(movement?.id || Date.now()).replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
  return `STK-${day}-${suffix || '000001'}`;
}

export function canShareStockReceiptFiles() {
  if (!navigator.share || !navigator.canShare || typeof File === 'undefined') return false;
  try {
    return navigator.canShare({ files: [new File(['test'], 'test.pdf', { type: 'application/pdf' })] });
  } catch (error) {
    return false;
  }
}

export async function createStockReceiptPdf(movement) {
  if (movement && typeof movement === 'object' && receiptPdfCache.has(movement)) {
    return receiptPdfCache.get(movement);
  }
  const task = movement?.isBatchReceipt && Array.isArray(movement.movements)
    ? createBatchStockReceiptPdf(movement)
    : createSingleStockReceiptPdf(movement);
  if (movement && typeof movement === 'object') receiptPdfCache.set(movement, task);
  try {
    return await task;
  } catch (error) {
    if (movement && typeof movement === 'object') receiptPdfCache.delete(movement);
    throw error;
  }
}

async function createSingleStockReceiptPdf(movement) {
  const { jsPDF } = await import('jspdf');
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');

  drawReceiptBackground(context);
  await drawReceiptHeader(context, movement);
  drawReceiptBody(context, movement);
  drawReceiptFooter(context);

  const imageData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  pdf.addImage(imageData, 'JPEG', 0, 0, 595.28, 841.89, undefined, 'FAST');

  const reference = getStockReceiptReference(movement);
  return {
    blob: pdf.output('blob'),
    fileName: `${reference}.pdf`,
    reference,
    summary: buildStockReceiptSummary(movement, reference)
  };
}

async function createBatchStockReceiptPdf(batch) {
  const { jsPDF } = await import('jspdf');
  const items = aggregateBatchMovements(batch.movements);
  if (!items.length) throw new Error('The stock batch is empty');

  const reference = getStockReceiptReference(batch);
  const pages = [];
  for (let index = 0; index < items.length; index += 4) pages.push(items.slice(index, index + 4));

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');

    await drawBatchReceiptPage(context, batch, pages[pageIndex], pageIndex + 1, pages.length);
    if (pageIndex > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.9),
      'JPEG',
      0,
      0,
      595.28,
      841.89,
      `stock-batch-page-${pageIndex + 1}`,
      'FAST'
    );
  }

  return {
    blob: pdf.output('blob'),
    fileName: `${reference}.pdf`,
    reference,
    summary: buildBatchStockReceiptSummary(batch, reference)
  };
}

function aggregateBatchMovements(movements) {
  const grouped = new Map();
  (movements || []).forEach(movement => {
    const key = String(movement.productId || movement.productName || `product_${grouped.size}`);
    const delta = getMovementDelta(movement);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        productId: movement.productId || '',
        productName: movement.productName || 'منتج',
        productImg: movement.productImg || '/images/303-3.PNG',
        oldQty: Number(movement.oldQty) || 0,
        newQty: Number(movement.newQty) || 0,
        delta,
        movementCount: 1,
        reasons: new Set([movement.reasonLabel || movement.reason || 'حركة مخزون'])
      });
      return;
    }
    existing.newQty = Number(movement.newQty) || 0;
    existing.delta += delta;
    existing.movementCount += 1;
    existing.reasons.add(movement.reasonLabel || movement.reason || 'حركة مخزون');
    if (movement.productImg) existing.productImg = movement.productImg;
  });
  return [...grouped.values()].map(item => ({ ...item, reasons: [...item.reasons] }));
}

async function drawBatchReceiptPage(context, batch, items, pageNumber, totalPages) {
  drawReceiptBackground(context);
  const logo = await loadImage('/images/logo.png');
  if (logo) {
    context.save();
    roundedPath(context, 76, 58, 164, 164, 18);
    context.clip();
    context.drawImage(logo, 76, 58, 164, 164);
    context.restore();
  }

  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#e8ca63';
  context.font = '700 54px Arial, sans-serif';
  context.fillText('JOULANE FASHION', 1164, 100);
  context.fillStyle = '#ffffff';
  context.font = '700 40px Arial, sans-serif';
  context.fillText('وصل شحنة مخزون مجمعة', 1164, 160);
  context.fillStyle = '#b9b9b9';
  context.font = '500 25px Arial, sans-serif';
  context.fillText(`${getStockReceiptReference(batch)} - الصفحة ${pageNumber} من ${totalPages}`, 1164, 212);
  context.fillStyle = '#c9a53a';
  context.font = '700 26px Arial, sans-serif';
  context.fillText(formatMovementDate(getMovementDate(batch)), 1164, 258);

  const stats = getBatchReceiptStats(batch.movements);
  const summaryCards = [
    ['عدد الموديلات', stats.modelCount],
    ['إجمالي الوارد', `${stats.inbound} كرطون`],
    ['إجمالي الصادر', `${stats.outbound} كرطون`]
  ];
  summaryCards.forEach(([label, value], index) => {
    const x = 76 + index * 363;
    context.fillStyle = '#ffffff';
    roundedPath(context, x, 330, 338, 142, 14);
    context.fill();
    context.strokeStyle = '#ddd8cc';
    context.lineWidth = 2;
    context.stroke();
    context.direction = 'rtl';
    context.textAlign = 'center';
    context.fillStyle = '#777064';
    context.font = '600 24px Arial, sans-serif';
    context.fillText(label, x + 169, 376);
    context.fillStyle = '#171717';
    context.font = '700 38px Arial, sans-serif';
    context.fillText(String(value), x + 169, 430, 300);
  });

  drawSectionTitle(context, 'الموديلات والتغييرات المسجلة', 535);
  const loadedImages = await Promise.all(items.map(item => loadImage(item.productImg)));
  items.forEach((item, index) => drawBatchProductRow(context, item, loadedImages[index], 590 + index * 238));
  drawBatchReceiptFooter(context, batch, pageNumber, totalPages);
}

function drawBatchProductRow(context, item, image, y) {
  context.fillStyle = '#ffffff';
  roundedPath(context, 76, y, 1088, 214, 16);
  context.fill();
  context.strokeStyle = '#d9d4c7';
  context.lineWidth = 2;
  context.stroke();

  if (image) {
    context.save();
    roundedPath(context, 974, y + 24, 160, 166, 12);
    context.clip();
    drawImageCover(context, image, 974, y + 24, 160, 166);
    context.restore();
  } else {
    context.fillStyle = '#ece8de';
    roundedPath(context, 974, y + 24, 160, 166, 12);
    context.fill();
    context.direction = 'rtl';
    context.textAlign = 'center';
    context.fillStyle = '#8b8579';
    context.font = '600 21px Arial, sans-serif';
    context.fillText('الصورة غير متاحة', 1054, y + 112, 130);
  }

  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#171717';
  context.font = '700 34px Arial, sans-serif';
  drawWrappedRtlText(context, item.productName, 938, y + 57, 820, 40, 1);

  const deltaText = `${item.delta > 0 ? '+' : ''}${item.delta} كرطون`;
  context.fillStyle = item.delta > 0 ? '#198754' : item.delta < 0 ? '#c83b45' : '#326dcc';
  context.font = '700 30px Arial, sans-serif';
  context.fillText(deltaText, 938, y + 105);

  context.fillStyle = '#655f56';
  context.font = '600 24px Arial, sans-serif';
  context.fillText(`الرصيد: ${item.oldQty} ← ${item.newQty}`, 938, y + 148);
  const reason = item.reasons.filter(Boolean).join('، ');
  context.fillStyle = '#7a746b';
  context.font = '500 22px Arial, sans-serif';
  drawWrappedRtlText(context, `${reason}${item.movementCount > 1 ? ` - ${item.movementCount} حركات` : ''}`, 938, y + 184, 820, 30, 1);
}

function drawBatchReceiptFooter(context, batch, pageNumber, totalPages) {
  context.fillStyle = '#171717';
  context.fillRect(0, 1594, PAGE_WIDTH, 160);
  context.direction = 'rtl';
  context.textAlign = 'center';
  context.fillStyle = '#e8ca63';
  context.font = '700 28px Arial, sans-serif';
  context.fillText(`المسؤول: ${batch.operator || 'مسؤول المخزن'}`, PAGE_WIDTH / 2, 1648);
  context.fillStyle = '#b8b8b8';
  context.font = '500 22px Arial, sans-serif';
  context.fillText(`وصل إلكتروني مجمع - الصفحة ${pageNumber} من ${totalPages}`, PAGE_WIDTH / 2, 1696);
}

function getMovementDelta(movement) {
  const oldQuantity = Number(movement?.oldQty);
  const newQuantity = Number(movement?.newQty);
  if (Number.isFinite(oldQuantity) && Number.isFinite(newQuantity)) return newQuantity - oldQuantity;
  const amount = Number(movement?.amount) || 0;
  return movement?.type === 'remove' ? -amount : movement?.type === 'add' ? amount : 0;
}

function getBatchReceiptStats(movements) {
  const deltas = (movements || []).map(getMovementDelta);
  return {
    modelCount: new Set((movements || []).map(movement => movement.productId || movement.productName)).size,
    movementCount: (movements || []).length,
    inbound: deltas.filter(delta => delta > 0).reduce((total, delta) => total + delta, 0),
    outbound: deltas.filter(delta => delta < 0).reduce((total, delta) => total + Math.abs(delta), 0),
    moved: deltas.reduce((total, delta) => total + Math.abs(delta), 0)
  };
}

function buildBatchStockReceiptSummary(batch, reference) {
  const items = aggregateBatchMovements(batch.movements);
  const stats = getBatchReceiptStats(batch.movements);
  const lines = [
    `وصل شحنة مخزون مجمعة: ${reference}`,
    `${stats.modelCount} موديلات - ${stats.movementCount} حركات - ${stats.moved} كرطون متحرك`,
    `الوارد: ${stats.inbound} كرطون - الصادر: ${stats.outbound} كرطون`,
    `المسؤول: ${batch.operator || 'مسؤول المخزن'}`,
    '',
    ...items.map(item => `${item.delta > 0 ? '+' : ''}${item.delta} | ${item.productName} | ${item.oldQty} ← ${item.newQty}`)
  ];
  return lines.join('\n');
}

export async function downloadStockReceipt(movement) {
  const receipt = await createStockReceiptPdf(movement);
  const url = URL.createObjectURL(receipt.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = receipt.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return receipt;
}

export async function shareStockReceipt(movement, fallbackWindow = null, recipient = null) {
  const receipt = await createStockReceiptPdf(movement);
  const file = new File([receipt.blob], receipt.fileName, { type: 'application/pdf' });
  const recipientLabel = recipient?.name && recipient?.phone
    ? `المستلم المعتمد: ${recipient.name} (${recipient.phone})`
    : '';
  const targetedSummary = recipientLabel ? `${recipientLabel}\n${receipt.summary}` : receipt.summary;

  if (canShareStockReceiptFiles()) {
    await navigator.share({
      title: movement?.isBatchReceipt
        ? `وصل شحنة المخزون المجمعة ${receipt.reference}`
        : `وصل حركة المخزون ${receipt.reference}`,
      text: targetedSummary,
      files: [file]
    });
    return { ...receipt, method: 'share', recipient };
  }

  const url = URL.createObjectURL(receipt.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = receipt.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  const phonePath = String(recipient?.phone || '').replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${phonePath}?text=${encodeURIComponent(`${targetedSummary}\n\nتم تنزيل ملف الوصل ${receipt.fileName}. أرفقه بهذه المحادثة.`)}`;
  if (fallbackWindow && !fallbackWindow.closed) {
    fallbackWindow.location.href = whatsappUrl;
  } else {
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }
  return { ...receipt, method: 'download', recipient };
}

function drawReceiptBackground(context) {
  context.fillStyle = '#f6f4ef';
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = '#111111';
  context.fillRect(0, 0, PAGE_WIDTH, 280);
  context.fillStyle = '#c9a53a';
  context.fillRect(0, 280, PAGE_WIDTH, 12);
}

async function drawReceiptHeader(context, movement) {
  const logo = await loadImage('/images/logo.png');
  if (logo) {
    context.save();
    roundedPath(context, 76, 58, 164, 164, 18);
    context.clip();
    context.drawImage(logo, 76, 58, 164, 164);
    context.restore();
  }

  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#e8ca63';
  context.font = '700 56px Arial, sans-serif';
  context.fillText('JOULANE FASHION', 1164, 105);
  context.fillStyle = '#ffffff';
  context.font = '700 42px Arial, sans-serif';
  context.fillText('وصل حركة المخزون', 1164, 168);
  context.fillStyle = '#b9b9b9';
  context.font = '500 27px Arial, sans-serif';
  context.fillText('وثيقة داخلية صادرة عن نظام إدارة المخزن', 1164, 216);

  context.fillStyle = '#c9a53a';
  context.font = '700 29px Arial, sans-serif';
  context.fillText(getStockReceiptReference(movement), 1164, 258);
}

function drawReceiptBody(context, movement) {
  const date = getMovementDate(movement);
  const typeLabel = movement.type === 'add' ? 'استلام بضاعة' : movement.type === 'remove' ? 'صرف بضاعة' : 'تسوية جرد';
  const movementValue = movement.type === 'add'
    ? `${Number(movement.amount) || 0} كرطون وارد`
    : movement.type === 'remove'
      ? `${Number(movement.amount) || 0} كرطون صادر`
      : `الرصيد الفعلي ${Number(movement.newQty) || 0} كرطون`;

  drawSectionTitle(context, 'بيانات الحركة', 370);
  drawDetailGrid(context, [
    ['نوع الحركة', typeLabel],
    ['سبب الحركة', movement.reasonLabel || movement.reason || '-'],
    ['اسم الموديل', movement.productName || 'منتج'],
    ['كمية الحركة', movementValue],
    ['الرصيد قبل', `${Number(movement.oldQty) || 0} كرطون`],
    ['الرصيد بعد', `${Number(movement.newQty) || 0} كرطون`]
  ], 420);

  drawSectionTitle(context, 'التتبع والمسؤولية', 865);
  drawDetailGrid(context, [
    ['المسؤول', movement.operator || 'غير محدد'],
    ['التاريخ والوقت', formatMovementDate(date)],
    ['الزبون أو المحل', movement.customerName || '-'],
    ['مرجع الطلب', movement.orderReference ? String(movement.orderReference).replace(/^#/, '') : '-']
  ], 915);

  drawSectionTitle(context, 'ملاحظة الحركة', 1255);
  context.fillStyle = '#ffffff';
  roundedPath(context, 76, 1304, 1088, 164, 16);
  context.fill();
  context.strokeStyle = '#d9d4c7';
  context.lineWidth = 2;
  context.stroke();
  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#262626';
  context.font = '500 30px Arial, sans-serif';
  drawWrappedRtlText(context, movement.note || 'لا توجد ملاحظة إضافية.', 1124, 1364, 980, 47, 2);
}

function drawSectionTitle(context, title, y) {
  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#171717';
  context.font = '700 35px Arial, sans-serif';
  context.fillText(title, 1164, y);
  context.fillStyle = '#c9a53a';
  context.fillRect(76, y + 20, 1088, 5);
}

function drawDetailGrid(context, rows, startY) {
  const columnWidth = 520;
  const rowHeight = 128;
  rows.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = column === 0 ? 644 : 76;
    const y = startY + row * (rowHeight + 16);
    context.fillStyle = '#ffffff';
    roundedPath(context, x, y, columnWidth, rowHeight, 14);
    context.fill();
    context.strokeStyle = '#ddd8cc';
    context.lineWidth = 2;
    context.stroke();

    context.direction = 'rtl';
    context.textAlign = 'right';
    context.fillStyle = '#777064';
    context.font = '600 24px Arial, sans-serif';
    context.fillText(label, x + columnWidth - 30, y + 40);
    context.fillStyle = '#171717';
    context.font = '700 31px Arial, sans-serif';
    drawWrappedRtlText(context, value, x + columnWidth - 30, y + 86, columnWidth - 60, 36, 1);
  });
}

function drawReceiptFooter(context) {
  context.fillStyle = '#171717';
  context.fillRect(0, 1574, PAGE_WIDTH, 180);
  context.direction = 'rtl';
  context.textAlign = 'center';
  context.fillStyle = '#e8ca63';
  context.font = '700 30px Arial, sans-serif';
  context.fillText('JOULANE FASHION - إدارة المخزون', PAGE_WIDTH / 2, 1640);
  context.fillStyle = '#b8b8b8';
  context.font = '500 23px Arial, sans-serif';
  context.fillText('تم إنشاء هذا الوصل إلكترونياً من سجل الحركة المحفوظ في النظام.', PAGE_WIDTH / 2, 1690);
}

function buildStockReceiptSummary(movement, reference) {
  const verb = movement.type === 'add' ? 'استلام' : movement.type === 'remove' ? 'صرف' : 'تسوية';
  const lines = [
    `وصل حركة مخزون: ${reference}`,
    `${verb} ${Number(movement.amount) || 0} كرطون من ${movement.productName || 'المنتج'}`,
    `المسؤول: ${movement.operator || 'غير محدد'}`,
    `الرصيد: ${Number(movement.oldQty) || 0} ← ${Number(movement.newQty) || 0}`
  ];
  if (movement.customerName) lines.push(`الزبون أو المحل: ${movement.customerName}`);
  if (movement.orderReference) lines.push(`مرجع الطلب: #${String(movement.orderReference).replace(/^#/, '')}`);
  return lines.join('\n');
}

function getMovementDate(movement) {
  const date = new Date(movement?.timestamp || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatMovementDate(date) {
  return date.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' })
    + ' - '
    + date.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function drawWrappedRtlText(context, value, x, y, maxWidth, lineHeight, maximumLines) {
  const words = String(value || '-').split(/\s+/);
  const lines = [];
  let currentLine = '';
  words.forEach(word => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !currentLine) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);
  lines.slice(0, maximumLines).forEach((line, index) => context.fillText(line, x, y + index * lineHeight, maxWidth));
}

function roundedPath(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawImageCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function loadImage(url) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    const source = String(url || '/images/303-3.PNG');
    if (/^https?:\/\//i.test(source)) image.crossOrigin = 'anonymous';
    image.src = source;
  });
}
