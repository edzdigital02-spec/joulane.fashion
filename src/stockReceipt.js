const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const receiptPdfCache = new WeakMap();
const targetedReceiptDownloads = new WeakSet();

function isCapacitorNative() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (_) {
    return false;
  }
}

export function getStockReceiptReference(movement) {
  const date = getMovementDate(movement);
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('');
  const suffix = String(movement?.id || Date.now()).replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
  return `STK-${day}-${suffix || '000001'}`;
}

export function canShareStockReceiptFiles() {
  if (isCapacitorNative()) return true;
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
  for (let index = 0; index < items.length; index += 5) pages.push(items.slice(index, index + 5));

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
        productImg: movement.productImg || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg',
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
  context.fillStyle = '#f4f4f1';
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = '#111111';
  context.fillRect(0, 0, PAGE_WIDTH, 260);
  context.fillStyle = '#c9a53a';
  context.fillRect(0, 250, PAGE_WIDTH, 10);

  const logo = await loadImage('https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/skilwjfxosy60qtgwkxw.jpg');
  if (logo) {
    context.save();
    roundedPath(context, 1020, 48, 144, 144, 18);
    context.clip();
    drawImageCover(context, logo, 1020, 48, 144, 144);
    context.restore();
  }

  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#e8ca63';
  context.font = '700 42px Arial, sans-serif';
  context.fillText('JOULANE FASHION', 984, 83);
  context.fillStyle = '#ffffff';
  context.font = '700 37px Arial, sans-serif';
  context.fillText('محضر حركة مخزون', 984, 139);
  context.fillStyle = '#b9b9b9';
  context.font = '500 23px Arial, sans-serif';
  context.fillText('وصل موحد لشحنة متعددة الموديلات', 984, 182);

  context.fillStyle = '#1b1b1b';
  roundedPath(context, 76, 48, 390, 144, 16);
  context.fill();
  context.strokeStyle = '#5f5126';
  context.lineWidth = 2;
  context.stroke();
  context.textAlign = 'center';
  context.fillStyle = '#999999';
  context.font = '600 20px Arial, sans-serif';
  context.fillText('الرقم المرجعي', 271, 83);
  context.fillStyle = '#c9a53a';
  context.font = '700 27px Arial, sans-serif';
  context.fillText(getStockReceiptReference(batch), 271, 126, 350);
  context.fillStyle = '#d8d8d8';
  context.font = '600 20px Arial, sans-serif';
  context.fillText(`الصفحة ${pageNumber} من ${totalPages}`, 271, 163);

  drawBatchMetaStrip(context, batch);

  const stats = getBatchReceiptStats(batch.movements);
  const summaryCards = [
    ['عدد الموديلات', stats.modelCount],
    ['الكميات المتحركة', `${stats.moved} كرطون`],
    ['إجمالي الوارد', `${stats.inbound} كرطون`],
    ['إجمالي الصادر', `${stats.outbound} كرطون`]
  ];
  summaryCards.forEach(([label, value], index) => {
    const x = 76 + index * 275;
    context.fillStyle = index === 0 ? '#171717' : '#ffffff';
    roundedPath(context, x, 396, 248, 112, 10);
    context.fill();
    context.strokeStyle = index === 0 ? '#171717' : '#d7d6d0';
    context.lineWidth = 1.5;
    context.stroke();
    context.direction = 'rtl';
    context.textAlign = 'center';
    context.fillStyle = index === 0 ? '#b9b9b9' : '#77736b';
    context.font = '600 20px Arial, sans-serif';
    context.fillText(label, x + 124, 432);
    context.fillStyle = index === 0 ? '#e8ca63' : '#171717';
    context.font = '700 30px Arial, sans-serif';
    context.fillText(String(value), x + 124, 478, 220);
  });

  drawBatchTableHeader(context);
  const loadedImages = await Promise.all(items.map(item => loadImage(item.productImg)));
  items.forEach((item, index) => drawBatchProductRow(context, item, loadedImages[index], 600 + index * 190, index));
  drawBatchReceiptFooter(context, batch, pageNumber, totalPages);
}

function drawBatchMetaStrip(context, batch) {
  context.fillStyle = '#ffffff';
  roundedPath(context, 76, 290, 1088, 76, 10);
  context.fill();
  context.strokeStyle = '#dcdbd5';
  context.lineWidth = 1.5;
  context.stroke();

  const date = formatMovementDate(getMovementDate(batch));
  const metadata = [
    ['المسؤول', batch.operator || 'مسؤول المخزن'],
    ['التاريخ والوقت', date],
    ['عدد الحركات', `${batch.movements?.length || 0} حركة`]
  ];
  metadata.forEach(([label, value], index) => {
    const centerX = 982 - index * 360;
    if (index > 0) {
      context.fillStyle = '#deddd7';
      context.fillRect(centerX + 180, 306, 2, 44);
    }
    context.direction = 'rtl';
    context.textAlign = 'center';
    context.fillStyle = '#8a867e';
    context.font = '600 17px Arial, sans-serif';
    context.fillText(label, centerX, 316);
    context.fillStyle = '#242424';
    context.font = '700 21px Arial, sans-serif';
    context.fillText(String(value), centerX, 346, 320);
  });
}

function drawBatchTableHeader(context) {
  context.fillStyle = '#242424';
  roundedPath(context, 76, 540, 1088, 46, 7);
  context.fill();
  context.direction = 'rtl';
  context.textAlign = 'center';
  context.fillStyle = '#e5e2d8';
  context.font = '700 18px Arial, sans-serif';
  context.fillText('الموديل والتفاصيل', 890, 570);
  context.fillText('العملية', 574, 570);
  context.fillText('قبل', 430, 570);
  context.fillText('التغيير', 292, 570);
  context.fillText('بعد', 154, 570);
}

function drawBatchProductRow(context, item, image, y, rowIndex) {
  context.fillStyle = rowIndex % 2 === 0 ? '#ffffff' : '#f9f9f7';
  roundedPath(context, 76, y, 1088, 176, 9);
  context.fill();
  context.strokeStyle = '#d9d8d2';
  context.lineWidth = 1.5;
  context.stroke();

  if (image) {
    context.save();
    roundedPath(context, 1020, y + 17, 126, 142, 8);
    context.clip();
    drawImageCover(context, image, 1020, y + 17, 126, 142);
    context.restore();
  } else {
    context.fillStyle = '#ecece8';
    roundedPath(context, 1020, y + 17, 126, 142, 8);
    context.fill();
    context.direction = 'rtl';
    context.textAlign = 'center';
    context.fillStyle = '#85817a';
    context.font = '600 17px Arial, sans-serif';
    context.fillText('لا توجد صورة', 1083, y + 94, 110);
  }

  context.fillStyle = '#e6e4de';
  context.fillRect(1000, y + 18, 2, 140);
  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#171717';
  context.font = '700 27px Arial, sans-serif';
  drawWrappedRtlText(context, item.productName, 980, y + 49, 320, 34, 2);

  const reason = item.reasons.filter(Boolean).join('، ');
  context.fillStyle = '#77736c';
  context.font = '500 18px Arial, sans-serif';
  drawWrappedRtlText(context, reason, 980, y + 112, 320, 25, 2);
  if (item.movementCount > 1) {
    context.fillStyle = '#a08228';
    context.font = '700 16px Arial, sans-serif';
    context.fillText(`${item.movementCount} حركات مجمعة`, 980, y + 150, 320);
  }

  drawBatchOperationBadge(context, item, 574, y + 88);
  drawBatchQuantityCell(context, item.oldQty, 430, y + 88, '#333333');
  drawBatchQuantityCell(
    context,
    `${item.delta > 0 ? '+' : ''}${item.delta}`,
    292,
    y + 88,
    item.delta > 0 ? '#168252' : item.delta < 0 ? '#c33d49' : '#326dcc'
  );
  drawBatchQuantityCell(context, item.newQty, 154, y + 88, '#171717');
}

function drawBatchOperationBadge(context, item, x, y) {
  const operation = item.delta > 0 ? 'إضافة' : item.delta < 0 ? 'سحب' : 'تسوية';
  const background = item.delta > 0 ? '#e8f6ef' : item.delta < 0 ? '#fbecef' : '#eaf1fb';
  const foreground = item.delta > 0 ? '#168252' : item.delta < 0 ? '#b63340' : '#326dcc';
  context.fillStyle = background;
  roundedPath(context, x - 58, y - 29, 116, 58, 29);
  context.fill();
  context.direction = 'rtl';
  context.textAlign = 'center';
  context.fillStyle = foreground;
  context.font = '700 21px Arial, sans-serif';
  context.fillText(operation, x, y + 7);
}

function drawBatchQuantityCell(context, value, x, y, color) {
  context.direction = String(value).match(/^[+-]/) ? 'ltr' : 'rtl';
  context.textAlign = 'center';
  context.fillStyle = color;
  context.font = '700 29px Arial, sans-serif';
  context.fillText(String(value), x, y + 2, 112);
  context.direction = 'rtl';
  context.fillStyle = '#8b877f';
  context.font = '500 15px Arial, sans-serif';
  context.fillText('كرطون', x, y + 29);
}

function drawBatchReceiptFooter(context, batch, pageNumber, totalPages) {
  context.fillStyle = '#c9a53a';
  context.fillRect(76, 1580, 1088, 3);
  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#353535';
  context.font = '700 19px Arial, sans-serif';
  context.fillText(`اعتمد بواسطة: ${batch.operator || 'مسؤول المخزن'}`, 1164, 1625, 420);
  context.fillStyle = '#86827b';
  context.font = '500 17px Arial, sans-serif';
  context.fillText('وثيقة داخلية منشأة إلكترونياً من نظام إدارة مخزون Joulane Fashion', 1164, 1654, 700);

  context.fillStyle = '#111111';
  context.fillRect(0, 1684, PAGE_WIDTH, 70);
  context.textAlign = 'left';
  context.fillStyle = '#e8ca63';
  context.font = '700 19px Arial, sans-serif';
  context.fillText(`JOULANE FASHION  |  ${getStockReceiptReference(batch)}`, 76, 1727);
  context.direction = 'ltr';
  context.textAlign = 'right';
  context.fillStyle = '#d0d0d0';
  context.fillText(`${pageNumber} / ${totalPages}`, 1164, 1727);
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
    moved: deltas.reduce((total, delta) => total + Math.abs(delta), 0),
    net: deltas.reduce((total, delta) => total + delta, 0)
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
  const recipientLabel = recipient?.name && recipient?.phone
    ? `المستلم المعتمد: ${recipient.name} (${recipient.phone})`
    : '';
  const targetedSummary = recipientLabel ? `${recipientLabel}\n${receipt.summary}` : receipt.summary;
  const shareTitle = movement?.isBatchReceipt
    ? `وصل شحنة المخزون المجمعة ${receipt.reference}`
    : `وصل حركة المخزون ${receipt.reference}`;

  // ── Capacitor native path ──
  if (isCapacitorNative()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');

      const base64Data = await blobToBase64(receipt.blob);
      const written = await Filesystem.writeFile({
        path: receipt.fileName,
        data: base64Data,
        directory: Directory.Cache
      });

      const shareResult = await Share.share({
        title: shareTitle,
        text: targetedSummary,
        files: [written.uri],
        dialogTitle: `مشاركة الوصل إلى ${recipient?.name || 'المستلم'}`
      });

      // Clean up temp file silently
      Filesystem.deleteFile({ path: receipt.fileName, directory: Directory.Cache }).catch(() => {});
      return {
        ...receipt,
        method: 'share',
        recipient,
        activityType: shareResult?.activityType || ''
      };
    } catch (error) {
      if (error?.message?.includes('cancel') || error?.message?.includes('Cancel') || error?.errorMessage?.includes('cancel')) {
        const abortError = new Error('Share cancelled');
        abortError.name = 'AbortError';
        throw abortError;
      }
      throw error;
    }
  }

  // ── Web Share API path ──
  const file = new File([receipt.blob], receipt.fileName, { type: 'application/pdf' });
  const phonePath = String(recipient?.phone || '').replace(/\D/g, '');

  // A targeted WhatsApp link is the only browser flow that guarantees the
  // worker lands in the administrator-approved recipient's conversation.
  if (phonePath) {
    const shouldDownload = !movement || typeof movement !== 'object' || !targetedReceiptDownloads.has(movement);
    if (shouldDownload) {
      const downloadUrl = URL.createObjectURL(receipt.blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = receipt.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
      if (movement && typeof movement === 'object') targetedReceiptDownloads.add(movement);
    }

    const attachmentHint = shouldDownload
      ? `تم تنزيل ملف الوصل ${receipt.fileName}. أرفقه بهذه المحادثة.`
      : `أرفق ملف الوصل ${receipt.fileName} الذي تم تنزيله عند بدء الإرسال.`;
    const whatsappUrl = `https://wa.me/${phonePath}?text=${encodeURIComponent(`${targetedSummary}\n\n${attachmentHint}`)}`;
    if (fallbackWindow && !fallbackWindow.closed) {
      fallbackWindow.location.href = whatsappUrl;
    } else {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
    return {
      ...receipt,
      method: 'whatsapp_link',
      recipient,
      fileDownloaded: shouldDownload
    };
  }

  if (canShareStockReceiptFiles()) {
    await navigator.share({
      title: shareTitle,
      text: targetedSummary,
      files: [file]
    });
    return { ...receipt, method: 'share', recipient };
  }

  // ── Fallback: download + wa.me ──
  const url = URL.createObjectURL(receipt.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = receipt.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);

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
  const logo = await loadImage('https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/skilwjfxosy60qtgwkxw.jpg');
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
    const source = String(url || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg');
    if (/^https?:\/\//i.test(source)) image.crossOrigin = 'anonymous';
    image.src = source;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
