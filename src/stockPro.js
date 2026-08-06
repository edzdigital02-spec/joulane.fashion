let context = null;
let initialized = false;
let cameraStream = null;
let cameraTimer = null;

const AUDIT_DRAFT_KEY = 'joulane_stock_audit_draft';

export function initStockPro(options) {
  context = options;
  if (initialized) return;
  initialized = true;

  const root = document.getElementById('stock-pro-root');
  root?.addEventListener('click', handleRootClick);
  root?.addEventListener('submit', handleRootSubmit);
  document.getElementById('stock-barcode-scan-btn')?.addEventListener('click', scanAndOpenProduct);

  window.addEventListener('online', async () => {
    updateConnectionIndicator();
    await context?.Store.flushOfflineStockMovements();
    await context?.Store.refreshStockProData();
    refreshStockPro();
  });
  window.addEventListener('offline', () => {
    updateConnectionIndicator();
    refreshStockPro();
  });
  [
    'joulane:productsUpdated',
    'joulane:stockLogsUpdated',
    'joulane:stockLocationsUpdated',
    'joulane:stockProSettingsUpdated',
    'joulane:stockSnapshotsUpdated',
    'joulane:stockAuditsUpdated',
    'joulane:stockApprovalsUpdated',
    'joulane:stockOfflineQueueUpdated',
    'joulane:stockProRefresh'
  ].forEach(eventName => window.addEventListener(eventName, refreshStockPro));

  updateConnectionIndicator();
  refreshStockPro();
}

export function refreshStockPro() {
  if (!context?.Store) return;
  updateConnectionIndicator();
  const root = document.getElementById('stock-pro-root');
  if (!root) return;

  const Store = context.Store;
  const products = Store.getProducts();
  const logs = Store.getStockLogs();
  const locations = Store.getStockLocations();
  const settings = Store.getStockProSettings();
  const snapshots = Store.getStockSnapshots();
  const audits = Store.getStockAudits();
  const approvals = Store.getStockApprovals();
  const offlineQueue = Store.getOfflineStockQueue();
  const permissions = context.getPermissions?.() || {};
  const user = context.getCurrentUser?.();
  const isSuperAdmin = user?.id === 'usr_super_admin';
  const canManage = isSuperAdmin || permissions.stockSet === true;

  const summary = calculateProfessionalSummary(products, logs, settings, locations, Store.getOrders());
  const pendingApprovals = approvals.filter(item => item.status === 'pending').length;
  const actionableCount = summary.alerts.length + pendingApprovals + offlineQueue.length;
  const badge = document.getElementById('stock-pro-badge-count');
  if (badge) badge.textContent = String(actionableCount);

  root.innerHTML = `
    <section class="stock-pro-hero">
      <div>
        <span class="stock-pro-eyebrow"><i class="fa-solid fa-shield-halved"></i> JOULANE STOCK PRO</span>
        <h3>مركز العمليات الاحترافي</h3>
        <p>جرد فعلي، مواقع متعددة، نسخ احتياطية، موافقات، باركود ومراقبة التعارضات من شاشة واحدة.</p>
      </div>
      <div class="stock-pro-health ${summary.healthClass}">
        <strong>${summary.healthScore}%</strong>
        <span>صحة المخزون</span>
      </div>
    </section>

    <div class="stock-pro-kpis">
      ${proKpi('fa-sack-dollar', formatDzd(summary.inventoryValue), 'القيمة البيعية للمخزون', 'gold')}
      ${proKpi('fa-calendar-days', summary.coverageDays === null ? '—' : `${summary.coverageDays} يوم`, 'مدة كفاية المخزون', 'blue')}
      ${proKpi('fa-bell', summary.alerts.length, 'تنبيه يحتاج الانتباه', summary.alerts.length ? 'danger' : 'success')}
      ${proKpi('fa-cloud-arrow-up', offlineQueue.length, 'حركة بانتظار المزامنة', offlineQueue.length ? 'warning' : 'success')}
    </div>

    <div class="stock-pro-grid">
      <section class="stock-pro-panel stock-pro-alerts-panel">
        ${panelHeading('fa-bell', 'التنبيهات الذكية', 'نفاد، ركود، طلبات غير مصروفة واختلافات المزامنة')}
        <div class="stock-pro-alert-list">
          ${renderAlerts(summary.alerts, offlineQueue)}
        </div>
      </section>

      <section class="stock-pro-panel">
        ${panelHeading('fa-clipboard-check', 'الجرد الفعلي', 'قارن المسجل بالموجود واعتمد الفروقات مع نسخة احتياطية')}
        <div class="stock-pro-panel-body">
          <div class="stock-pro-stat-line"><span>آخر جرد معتمد</span><strong>${audits[0] ? formatDate(audits[0].approvedAt) : 'لا يوجد بعد'}</strong></div>
          <div class="stock-pro-actions">
            <button type="button" class="btn btn-gold" data-pro-action="start-audit" ${canManage ? '' : 'disabled'}>
              <i class="fa-solid fa-list-check"></i> ${readAuditDraft() ? 'متابعة الجرد' : 'بدء جلسة جرد'}
            </button>
          </div>
        </div>
      </section>

      <section class="stock-pro-panel">
        ${panelHeading('fa-barcode', 'الباركود والوصول السريع', 'امسح بالكاميرا أو اربط كودًا بأي موديل')}
        <form class="stock-pro-form" data-pro-form="barcode">
          <select id="pro-barcode-product" class="form-control select-dark" required>
            <option value="">اختر الموديل</option>
            ${products.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(productName(product))}</option>`).join('')}
          </select>
          <input id="pro-barcode-value" class="form-control" placeholder="الباركود أو QR" required />
          <div class="stock-pro-actions">
            <button type="button" class="btn btn-outline-gold" data-pro-action="scan-barcode"><i class="fa-solid fa-camera"></i> مسح</button>
            <button type="submit" class="btn btn-gold" ${canManage ? '' : 'disabled'}><i class="fa-solid fa-link"></i> ربط الكود</button>
          </div>
        </form>
      </section>

      <section class="stock-pro-panel stock-pro-locations-panel">
        ${panelHeading('fa-warehouse', 'المخازن والمواقع', 'رصيد مستقل وتحويل موثق بين المواقع')}
        <div class="stock-location-chips">
          ${locations.map(location => {
            const total = summary.locationTotals[location.id] || 0;
            return `<span class="${location.active === false ? 'is-inactive' : ''}">
              <i class="fa-solid fa-location-dot"></i>${escapeHtml(location.name)} <b>${total}</b>
              ${location.id !== 'main' && canManage ? `<button type="button" data-pro-action="toggle-location" data-location-id="${escapeHtml(location.id)}" aria-label="تغيير حالة الموقع"><i class="fa-solid fa-power-off"></i></button>` : ''}
            </span>`;
          }).join('')}
        </div>
        <form class="stock-pro-form stock-transfer-form" data-pro-form="transfer">
          <select id="pro-transfer-product" class="form-control select-dark" required>
            <option value="">اختر الموديل</option>
            ${products.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(productName(product))} — ${productQty(product)}</option>`).join('')}
          </select>
          <div class="stock-pro-form-row">
            <select id="pro-transfer-from" class="form-control select-dark" required>${locationOptions(locations)}</select>
            <i class="fa-solid fa-arrow-left"></i>
            <select id="pro-transfer-to" class="form-control select-dark" required>${locationOptions(locations, true)}</select>
          </div>
          <input id="pro-transfer-qty" type="number" min="1" class="form-control" placeholder="عدد الكراطين" required />
          <div class="stock-pro-actions">
            <button type="button" class="btn btn-outline-gold" data-pro-action="add-location" ${canManage ? '' : 'disabled'}><i class="fa-solid fa-plus"></i> موقع جديد</button>
            <button type="submit" class="btn btn-gold" ${permissions.stockAdd && permissions.stockRemove || isSuperAdmin ? '' : 'disabled'}><i class="fa-solid fa-right-left"></i> تنفيذ التحويل</button>
          </div>
        </form>
      </section>

      <section class="stock-pro-panel">
        ${panelHeading('fa-clock-rotate-left', 'النسخ الاحتياطي والاسترجاع', 'آخر 15 لقطة مع نسخة أمان تلقائية قبل الاسترجاع')}
        <div class="stock-pro-actions">
          <button type="button" class="btn btn-gold" data-pro-action="create-snapshot" ${canManage ? '' : 'disabled'}><i class="fa-solid fa-camera-retro"></i> إنشاء نسخة الآن</button>
        </div>
        <div class="stock-pro-compact-list">
          ${snapshots.length ? snapshots.slice(0, 5).map(snapshot => `
            <div>
              <span><strong>${escapeHtml(snapshot.reason || 'نسخة مخزون')}</strong><small>${formatDate(snapshot.createdAt)} · ${Number(snapshot.totalCartons) || 0} كرطون</small></span>
              ${isSuperAdmin ? `<button type="button" class="btn btn-outline-danger btn-sm" data-pro-action="restore-snapshot" data-snapshot-id="${escapeHtml(snapshot.id)}">استرجاع</button>` : ''}
            </div>
          `).join('') : emptyLine('لم تُنشأ أي نسخة بعد.')}
        </div>
      </section>

      <section class="stock-pro-panel">
        ${panelHeading('fa-user-check', 'الموافقات على العمليات الكبيرة', `الحد الحالي ${settings.approvalThreshold} كرطون`)}
        <div class="stock-pro-compact-list">
          ${renderApprovals(approvals, user, isSuperAdmin)}
        </div>
      </section>

      <section class="stock-pro-panel">
        ${panelHeading('fa-rotate-left', 'التراجع عن آخر حركة', `متاح خلال ${settings.undoWindowMinutes} دقائق ولآخر حركة فقط`)}
        <div class="stock-pro-compact-list">
          ${renderUndoCandidates(logs, settings, canManage)}
        </div>
      </section>

      <section class="stock-pro-panel">
        ${panelHeading('fa-sliders', 'إعدادات التحكم', 'حدود التنبيه والموافقة والركود')}
        <form class="stock-pro-form" data-pro-form="settings">
          <label>حد المخزون المنخفض<input id="pro-setting-low" type="number" min="0" max="999" value="${Number(settings.lowStockThreshold)}" class="form-control" /></label>
          <label>الموافقة عند حركة تساوي أو تتجاوز<input id="pro-setting-approval" type="number" min="1" max="9999" value="${Number(settings.approvalThreshold)}" class="form-control" /></label>
          <label>مهلة التراجع بالدقائق<input id="pro-setting-undo" type="number" min="1" max="60" value="${Number(settings.undoWindowMinutes)}" class="form-control" /></label>
          <label>اعتبار الموديل راكدًا بعد<input id="pro-setting-stale" type="number" min="7" max="730" value="${Number(settings.staleDays)}" class="form-control" /></label>
          <button type="submit" class="btn btn-gold" ${canManage ? '' : 'disabled'}><i class="fa-solid fa-floppy-disk"></i> حفظ الإعدادات</button>
        </form>
      </section>
    </div>
  `;
}

async function handleRootClick(event) {
  const button = event.target.closest('[data-pro-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.proAction;
  const Store = context.Store;

  if (action === 'start-audit') return openAuditModal();
  if (action === 'scan-barcode') return scanBarcodeIntoField();
  if (action === 'add-location') return addLocation();
  if (action === 'toggle-location') return toggleLocation(button.dataset.locationId);
  if (action === 'create-snapshot') {
    const reason = prompt('اكتب سبب النسخة الاحتياطية:', 'نسخة يدوية قبل تعديل المخزون');
    if (reason === null) return;
    setButtonBusy(button, true, 'جارٍ الحفظ...');
    const result = await Store.createStockSnapshot(reason);
    setButtonBusy(button, false);
    notify(result ? 'تم إنشاء نسخة احتياطية للمخزون.' : 'تعذر إنشاء النسخة الاحتياطية.');
    refreshStockPro();
    return;
  }
  if (action === 'restore-snapshot') {
    const snapshotId = button.dataset.snapshotId;
    if (!confirm('تحذير: سيتم استبدال المخزون الحالي بهذه النسخة. ستُنشأ نسخة أمان للحالة الحالية أولاً. هل تريد المتابعة؟')) return;
    if (!confirm('تأكيد أخير لاسترجاع النسخة الاحتياطية الآن.')) return;
    setButtonBusy(button, true, 'جارٍ الاسترجاع...');
    const result = await Store.restoreStockSnapshot(snapshotId);
    setButtonBusy(button, false);
    notify(result ? 'تم استرجاع النسخة وإنشاء نسخة أمان للحالة السابقة.' : 'تعذر استرجاع النسخة. يتطلب ذلك حساب المدير العام.');
    context.onRefresh?.();
    refreshStockPro();
    return;
  }
  if (action === 'review-approval') {
    setButtonBusy(button, true, '...');
    const result = await Store.reviewStockApproval(button.dataset.approvalId, button.dataset.decision);
    setButtonBusy(button, false);
    notify(result ? 'تم تحديث قرار الموافقة.' : 'تعذر تحديث الطلب.');
    refreshStockPro();
    return;
  }
  if (action === 'execute-approval') {
    const approval = Store.getStockApprovals().find(item => item.id === button.dataset.approvalId);
    setButtonBusy(button, true, 'جارٍ التنفيذ...');
    const result = await Store.executeApprovedStockApproval(approval);
    setButtonBusy(button, false);
    notify(result ? 'تم تنفيذ العملية المعتمدة وتحديث المخزون.' : 'تعذر التنفيذ؛ ربما تغير الرصيد منذ طلب الموافقة.');
    context.onRefresh?.();
    refreshStockPro();
    return;
  }
  if (action === 'undo-log') {
    if (!confirm('هل تريد التراجع عن هذه الحركة وإعادة الرصيد السابق؟')) return;
    setButtonBusy(button, true, 'جارٍ التراجع...');
    const result = await Store.undoStockMovement(button.dataset.logId);
    setButtonBusy(button, false);
    notify(result ? 'تم التراجع عن الحركة بنجاح.' : 'تعذر التراجع: انتهت المهلة أو توجد حركة أحدث على الموديل.');
    context.onRefresh?.();
    refreshStockPro();
  }
}

async function handleRootSubmit(event) {
  const form = event.target.closest('[data-pro-form]');
  if (!form) return;
  event.preventDefault();
  const Store = context.Store;
  const type = form.dataset.proForm;
  const submit = form.querySelector('[type="submit"]');

  if (type === 'barcode') {
    const productId = document.getElementById('pro-barcode-product')?.value;
    const barcode = normalizeCode(document.getElementById('pro-barcode-value')?.value);
    if (!productId || !barcode) return;
    const settings = Store.getStockProSettings();
    const barcodes = { ...(settings.barcodes || {}) };
    const duplicate = Object.entries(barcodes).find(([id, code]) => id !== productId && normalizeCode(code) === barcode);
    if (duplicate) {
      alert('هذا الباركود مرتبط بموديل آخر بالفعل.');
      return;
    }
    barcodes[productId] = barcode;
    setButtonBusy(submit, true, 'جارٍ الربط...');
    const saved = await Store.saveStockProSettings({ ...settings, barcodes });
    setButtonBusy(submit, false);
    notify(saved ? 'تم ربط الباركود بالموديل.' : 'تعذر حفظ الباركود.');
    if (saved) form.reset();
    return;
  }

  if (type === 'transfer') {
    const productId = document.getElementById('pro-transfer-product')?.value;
    const from = document.getElementById('pro-transfer-from')?.value;
    const to = document.getElementById('pro-transfer-to')?.value;
    const quantity = Number(document.getElementById('pro-transfer-qty')?.value);
    if (!productId || !from || !to || from === to || !Number.isInteger(quantity) || quantity < 1) {
      alert('اختر موديلًا وموقعين مختلفين وكمية صحيحة.');
      return;
    }
    if (!confirm(`تأكيد تحويل ${quantity} كرطون بين الموقعين؟`)) return;
    setButtonBusy(submit, true, 'جارٍ التحويل...');
    const result = await Store.transferStockLocation(productId, from, to, quantity);
    setButtonBusy(submit, false);
    notify(result ? 'تم تحويل المخزون وتسجيل الحركة.' : 'تعذر التحويل. تحقق من رصيد الموقع والصلاحيات.');
    context.onRefresh?.();
    refreshStockPro();
    return;
  }

  if (type === 'settings') {
    const previous = Store.getStockProSettings();
    const settings = {
      ...previous,
      lowStockThreshold: Number(document.getElementById('pro-setting-low')?.value),
      approvalThreshold: Number(document.getElementById('pro-setting-approval')?.value),
      undoWindowMinutes: Number(document.getElementById('pro-setting-undo')?.value),
      staleDays: Number(document.getElementById('pro-setting-stale')?.value)
    };
    setButtonBusy(submit, true, 'جارٍ الحفظ...');
    const saved = await Store.saveStockProSettings(settings);
    setButtonBusy(submit, false);
    notify(saved ? 'تم حفظ إعدادات Stock Pro.' : 'تعذر حفظ الإعدادات.');
    refreshStockPro();
  }
}

function calculateProfessionalSummary(products, logs, settings, locations, orders) {
  const now = Date.now();
  const lowThreshold = Number(settings.lowStockThreshold) || 5;
  const staleCutoff = now - (Number(settings.staleDays) || 60) * 86400000;
  const recentProductActivity = new Map();
  logs.forEach(log => {
    if (!log.productId) return;
    const timestamp = new Date(log.timestamp || 0).getTime();
    if (!recentProductActivity.has(log.productId) || timestamp > recentProductActivity.get(log.productId)) {
      recentProductActivity.set(log.productId, timestamp);
    }
  });

  const alerts = [];
  let totalCartons = 0;
  let inventoryValue = 0;
  const locationTotals = Object.fromEntries(locations.map(location => [location.id, 0]));
  products.forEach(product => {
    const quantity = productQty(product);
    totalCartons += quantity;
    inventoryValue += quantity * (Number(product.seriesPrice || product.price) || 0) * (Number(product.pairsPerSeries) || 1);
    if (quantity === 0) alerts.push({ type: 'out', title: productName(product), detail: 'نفد المخزون بالكامل', productId: product.id });
    else if (quantity <= lowThreshold) alerts.push({ type: 'low', title: productName(product), detail: `متبقي ${quantity} كرطون فقط`, productId: product.id });
    if (quantity > 0 && (recentProductActivity.get(product.id) || 0) < staleCutoff) {
      alerts.push({ type: 'stale', title: productName(product), detail: `لم يتحرك منذ ${settings.staleDays} يومًا`, productId: product.id });
    }
    const distribution = product.locationStock && typeof product.locationStock === 'object'
      ? product.locationStock
      : { main: quantity };
    Object.entries(distribution).forEach(([locationId, value]) => {
      locationTotals[locationId] = (locationTotals[locationId] || 0) + (Number(value) || 0);
    });
  });

  const issuedOrders = new Set(logs.filter(log => log.reason === 'customer_order').map(log => normalizeCode(log.orderReference)));
  (orders || []).filter(order => String(order.status || '').toLowerCase() === 'confirmed').forEach(order => {
    if (!issuedOrders.has(normalizeCode(order.id))) {
      alerts.push({ type: 'order', title: `طلب #${order.id}`, detail: 'مؤكد ولم يُخصم من المخزون' });
    }
  });

  const last30Cutoff = now - 30 * 86400000;
  const outbound30 = logs.reduce((total, log) => {
    const timestamp = new Date(log.timestamp || 0).getTime();
    if (timestamp < last30Cutoff) return total;
    const delta = Number(log.newQty) - Number(log.oldQty);
    return delta < 0 ? total + Math.abs(delta) : total;
  }, 0);
  const dailyOutbound = outbound30 / 30;
  const coverageDays = dailyOutbound > 0 ? Math.round(totalCartons / dailyOutbound) : null;
  const critical = alerts.filter(alert => ['out', 'order'].includes(alert.type)).length;
  const healthScore = Math.max(0, Math.round(100 - Math.min(75, critical * 3 + alerts.length)));
  return {
    alerts,
    totalCartons,
    inventoryValue,
    coverageDays,
    locationTotals,
    healthScore,
    healthClass: healthScore >= 80 ? 'is-good' : healthScore >= 55 ? 'is-warning' : 'is-danger'
  };
}

function renderAlerts(alerts, offlineQueue) {
  const combined = [
    ...offlineQueue.map(item => ({
      type: item.status === 'conflict' ? 'conflict' : 'offline',
      title: item.entry?.productName || 'حركة غير متزامنة',
      detail: item.status === 'conflict' ? 'تعارض مع الرصيد السحابي ويحتاج مراجعة' : 'بانتظار عودة الاتصال'
    })),
    ...alerts
  ].slice(0, 12);
  if (!combined.length) return emptyLine('لا توجد تنبيهات حالياً. المخزون منظم.');
  const icons = {
    out: 'fa-ban',
    low: 'fa-arrow-trend-down',
    stale: 'fa-box-archive',
    order: 'fa-cart-flatbed',
    offline: 'fa-cloud-arrow-up',
    conflict: 'fa-code-compare'
  };
  return combined.map(alert => `
    <div class="stock-pro-alert is-${alert.type}">
      <i class="fa-solid ${icons[alert.type] || 'fa-bell'}"></i>
      <span><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.detail)}</small></span>
    </div>
  `).join('');
}

function renderApprovals(approvals, user, isSuperAdmin) {
  const visible = approvals.filter(item => ['pending', 'approved'].includes(item.status)).slice(0, 8);
  if (!visible.length) return emptyLine('لا توجد طلبات موافقة معلقة.');
  return visible.map(approval => {
    const action = approval.action || {};
    const title = `${action.type === 'add' ? 'إضافة' : action.type === 'remove' ? 'سحب' : 'تعديل'} ${Number(action.amount) || 0} كرطون`;
    let actions = '';
    if (approval.status === 'pending' && isSuperAdmin) {
      actions = `
        <button type="button" class="btn btn-gold btn-sm" data-pro-action="review-approval" data-approval-id="${escapeHtml(approval.id)}" data-decision="approved">موافقة</button>
        <button type="button" class="btn btn-outline-danger btn-sm" data-pro-action="review-approval" data-approval-id="${escapeHtml(approval.id)}" data-decision="rejected">رفض</button>`;
    } else if (approval.status === 'approved' && approval.requestedBy === user?.id) {
      actions = `<button type="button" class="btn btn-gold btn-sm" data-pro-action="execute-approval" data-approval-id="${escapeHtml(approval.id)}">تنفيذ الآن</button>`;
    } else {
      actions = `<span class="stock-pro-status is-${approval.status}">${approval.status === 'approved' ? 'تمت الموافقة' : 'قيد الانتظار'}</span>`;
    }
    return `<div>
      <span><strong>${escapeHtml(title)} — ${escapeHtml(action.productName || '')}</strong><small>${escapeHtml(approval.requestedByName || '')} · ${formatDate(approval.requestedAt)}</small></span>
      <aside>${actions}</aside>
    </div>`;
  }).join('');
}

function renderUndoCandidates(logs, settings, canManage) {
  const cutoff = Date.now() - Number(settings.undoWindowMinutes || 10) * 60000;
  const seenProducts = new Set();
  const candidates = [];
  for (const log of logs) {
    if (!log.productId || seenProducts.has(log.productId)) continue;
    if (!['add', 'remove', 'set'].includes(log.type)) continue;
    seenProducts.add(log.productId);
    if (new Date(log.timestamp || 0).getTime() >= cutoff) candidates.push(log);
    if (candidates.length >= 5) break;
  }
  if (!candidates.length) return emptyLine('لا توجد حركة حديثة قابلة للتراجع.');
  return candidates.map(log => `
    <div>
      <span><strong>${escapeHtml(log.productName || 'منتج')}</strong><small>${Number(log.oldQty) || 0} ← ${Number(log.newQty) || 0} · ${formatDate(log.timestamp)}</small></span>
      <button type="button" class="btn btn-outline-danger btn-sm" data-pro-action="undo-log" data-log-id="${escapeHtml(log.id)}" ${canManage ? '' : 'disabled'}>تراجع</button>
    </div>
  `).join('');
}

function openAuditModal() {
  const Store = context.Store;
  let draft = readAuditDraft();
  if (!draft) {
    const products = Store.getProducts();
    draft = {
      id: `audit_${Date.now()}`,
      startedAt: new Date().toISOString(),
      startedBy: context.getCurrentUser?.()?.id || '',
      startedByName: context.getCurrentUser?.()?.name || '',
      counts: products.map(product => ({
        productId: product.id,
        productName: productName(product),
        expectedQty: productQty(product),
        actualQty: productQty(product)
      }))
    };
    saveAuditDraft(draft);
  }

  closeProModal();
  const overlay = document.createElement('div');
  overlay.id = 'stock-pro-modal';
  overlay.className = 'stock-submodal-overlay active stock-pro-modal-overlay';
  overlay.innerHTML = `
    <div class="stock-submodal-box stock-pro-audit-modal">
      <div class="stock-submodal-header">
        <div><h4><i class="fa-solid fa-clipboard-check text-gold"></i> جلسة الجرد الفعلي</h4><small>أدخل العدد الموجود فعليًا لكل موديل ثم راجع الفروقات.</small></div>
        <button type="button" class="btn-close-modal" data-audit-close><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="stock-pro-audit-tools">
        <input id="stock-audit-search" class="form-control" placeholder="ابحث عن موديل..." />
        <button type="button" class="btn btn-outline-gold" data-audit-scan><i class="fa-solid fa-barcode"></i> مسح موديل</button>
        <span id="stock-audit-summary"></span>
      </div>
      <div id="stock-audit-rows" class="stock-pro-audit-rows">
        ${draft.counts.map(item => auditRow(item)).join('')}
      </div>
      <div class="stock-entry-actions">
        <button type="button" class="btn btn-outline-danger" data-audit-discard>إلغاء الجلسة</button>
        <button type="button" class="btn btn-outline-gold" data-audit-save>حفظ ومتابعة لاحقًا</button>
        <button type="button" class="btn btn-gold" data-audit-commit><i class="fa-solid fa-check-double"></i> اعتماد الجرد</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  updateAuditSummary(overlay, draft);

  overlay.addEventListener('input', event => {
    if (event.target.id === 'stock-audit-search') {
      const query = normalizeCode(event.target.value);
      overlay.querySelectorAll('[data-audit-product-id]').forEach(row => {
        row.hidden = query && !normalizeCode(row.dataset.search).includes(query);
      });
      return;
    }
    if (event.target.matches('[data-audit-actual]')) {
      const item = draft.counts.find(entry => entry.productId === event.target.dataset.auditActual);
      if (item) item.actualQty = Math.max(0, Number(event.target.value) || 0);
      saveAuditDraft(draft);
      updateAuditSummary(overlay, draft);
      const row = event.target.closest('[data-audit-product-id]');
      row?.classList.toggle('has-variance', item && item.actualQty !== item.expectedQty);
    }
  });
  overlay.addEventListener('click', async event => {
    if (event.target.closest('[data-audit-close]') || event.target.closest('[data-audit-save]')) {
      saveAuditDraft(draft);
      closeProModal();
      notify('تم حفظ مسودة الجرد على هذا الجهاز.');
    } else if (event.target.closest('[data-audit-discard]')) {
      if (confirm('هل تريد حذف مسودة الجرد الحالية؟')) {
        localStorage.removeItem(AUDIT_DRAFT_KEY);
        closeProModal();
        refreshStockPro();
      }
    } else if (event.target.closest('[data-audit-scan]')) {
      const product = await scanBarcode();
      if (product) {
        const row = overlay.querySelector(`[data-audit-product-id="${cssEscape(product.id)}"]`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row?.querySelector('[data-audit-actual]')?.focus();
      }
    } else if (event.target.closest('[data-audit-commit]')) {
      const variance = draft.counts.reduce((total, item) => total + Math.abs(item.actualQty - item.expectedQty), 0);
      if (!confirm(`سيتم اعتماد الجرد وتحديث المخزون بفارق إجمالي ${variance} كرطون، مع إنشاء نسخة احتياطية أولاً. هل تتابع؟`)) return;
      const button = event.target.closest('[data-audit-commit]');
      setButtonBusy(button, true, 'جارٍ الاعتماد...');
      const result = await Store.commitStockAudit(draft);
      setButtonBusy(button, false);
      if (result) {
        localStorage.removeItem(AUDIT_DRAFT_KEY);
        closeProModal();
        notify(`تم اعتماد الجرد: ${result.affectedModels} موديل بفارق ${result.totalVariance} كرطون.`);
        context.onRefresh?.();
        refreshStockPro();
      } else {
        alert('تعذر اعتماد الجرد. تحقق من الاتصال والصلاحيات ثم أعد المحاولة.');
      }
    }
  });
}

function auditRow(item) {
  const variance = Number(item.actualQty) - Number(item.expectedQty);
  return `
    <div class="${variance ? 'has-variance' : ''}" data-audit-product-id="${escapeHtml(item.productId)}" data-search="${escapeHtml(`${item.productName} ${item.productId}`)}">
      <span><strong>${escapeHtml(item.productName)}</strong><small>المسجل: ${Number(item.expectedQty) || 0}</small></span>
      <input type="number" min="0" value="${Number(item.actualQty) || 0}" data-audit-actual="${escapeHtml(item.productId)}" inputmode="numeric" />
    </div>`;
}

function updateAuditSummary(overlay, draft) {
  const changed = draft.counts.filter(item => Number(item.actualQty) !== Number(item.expectedQty));
  const variance = changed.reduce((total, item) => total + Math.abs(Number(item.actualQty) - Number(item.expectedQty)), 0);
  const summary = overlay.querySelector('#stock-audit-summary');
  if (summary) summary.textContent = `${changed.length} موديل مختلف · فرق ${variance} كرطون`;
}

async function addLocation() {
  const name = prompt('اسم المخزن أو المحل الجديد:');
  if (!name?.trim()) return;
  const Store = context.Store;
  const locations = Store.getStockLocations();
  const id = `loc_${Date.now().toString(36)}`;
  const saved = await Store.saveStockLocations([...locations, { id, name: name.trim(), active: true }]);
  notify(saved ? 'تمت إضافة الموقع الجديد.' : 'تعذر إضافة الموقع.');
  refreshStockPro();
}

async function toggleLocation(locationId) {
  const Store = context.Store;
  const locations = Store.getStockLocations().map(location => (
    location.id === locationId ? { ...location, active: location.active === false } : location
  ));
  const saved = await Store.saveStockLocations(locations);
  notify(saved ? 'تم تحديث حالة الموقع.' : 'تعذر تحديث الموقع.');
  refreshStockPro();
}

async function scanAndOpenProduct() {
  const product = await scanBarcode();
  if (!product) return;
  const search = document.getElementById('stock-search-input');
  if (search) {
    search.value = productName(product).replace(/^موديل\s*/i, '');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  }
  document.getElementById('stock-tab-btn-items')?.click();
  notify(`تم العثور على ${productName(product)}.`);
}

async function scanBarcodeIntoField() {
  const product = await scanBarcode();
  if (product) {
    const select = document.getElementById('pro-barcode-product');
    if (select) select.value = product.id;
    const settings = context.Store.getStockProSettings();
    const input = document.getElementById('pro-barcode-value');
    if (input) input.value = settings.barcodes?.[product.id] || modelCode(product);
    return;
  }
  const code = prompt('أدخل الباركود يدويًا:');
  if (code) {
    const input = document.getElementById('pro-barcode-value');
    if (input) input.value = code;
  }
}

async function scanBarcode() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    const manual = prompt('الكاميرا لا تدعم قراءة الباركود تلقائيًا. أدخل الكود أو رقم الموديل:');
    return manual ? findProductByCode(manual) : null;
  }

  closeProModal();
  const overlay = document.createElement('div');
  overlay.id = 'stock-pro-modal';
  overlay.className = 'stock-submodal-overlay active stock-pro-modal-overlay';
  overlay.innerHTML = `
    <div class="stock-submodal-box stock-barcode-modal">
      <div class="stock-submodal-header">
        <div><h4><i class="fa-solid fa-barcode text-gold"></i> مسح الباركود</h4><small>وجّه الكاميرا نحو QR أو Code 128 أو EAN.</small></div>
        <button type="button" class="btn-close-modal" data-camera-close><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="stock-camera-frame"><video autoplay playsinline muted></video><span></span></div>
      <p id="stock-camera-status">جارٍ تشغيل الكاميرا...</p>
      <button type="button" class="btn btn-outline-gold" data-camera-manual>إدخال الكود يدويًا</button>
    </div>`;
  document.body.appendChild(overlay);

  return new Promise(async resolve => {
    const finish = product => {
      stopCamera();
      closeProModal();
      resolve(product || null);
    };
    overlay.addEventListener('click', event => {
      if (event.target.closest('[data-camera-close]')) finish(null);
      if (event.target.closest('[data-camera-manual]')) {
        const code = prompt('أدخل الكود أو رقم الموديل:');
        finish(code ? findProductByCode(code) : null);
      }
    });

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      const video = overlay.querySelector('video');
      video.srcObject = cameraStream;
      await video.play();
      const formats = await window.BarcodeDetector.getSupportedFormats?.();
      const detector = new window.BarcodeDetector({
        formats: (formats || []).filter(format => ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a'].includes(format))
      });
      const startedAt = Date.now();
      cameraTimer = setInterval(async () => {
        if (!video.videoWidth) return;
        if (Date.now() - startedAt > 30000) {
          clearInterval(cameraTimer);
          cameraTimer = null;
          const status = overlay.querySelector('#stock-camera-status');
          if (status) status.textContent = 'لم يتم العثور على كود. قرّب الكاميرا أو أدخله يدويًا.';
          return;
        }
        try {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue) {
            const product = findProductByCode(codes[0].rawValue);
            if (product) finish(product);
            else {
              const status = overlay.querySelector('#stock-camera-status');
              if (status) status.textContent = `تمت قراءة ${codes[0].rawValue} لكنه غير مرتبط بأي موديل.`;
            }
          }
        } catch (_) {
          // The next frame may be readable.
        }
      }, 350);
      const status = overlay.querySelector('#stock-camera-status');
      if (status) status.textContent = 'الكاميرا جاهزة — ثبّت الكود داخل الإطار.';
    } catch (error) {
      const status = overlay.querySelector('#stock-camera-status');
      if (status) status.textContent = 'تعذر فتح الكاميرا. اسمح للتطبيق باستخدامها أو أدخل الكود يدويًا.';
    }
  });
}

function findProductByCode(value) {
  const code = normalizeCode(value);
  const products = context.Store.getProducts();
  const barcodes = context.Store.getStockProSettings().barcodes || {};
  return products.find(product => {
    const candidates = [product.id, product.barcode, barcodes[product.id], modelCode(product), productName(product)];
    return candidates.some(candidate => normalizeCode(candidate) === code);
  }) || null;
}

function stopCamera() {
  if (cameraTimer) clearInterval(cameraTimer);
  cameraTimer = null;
  cameraStream?.getTracks?.().forEach(track => track.stop());
  cameraStream = null;
}

function closeProModal() {
  stopCamera();
  document.getElementById('stock-pro-modal')?.remove();
}

function readAuditDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(AUDIT_DRAFT_KEY) || 'null');
    return draft && Array.isArray(draft.counts) ? draft : null;
  } catch (_) {
    return null;
  }
}

function saveAuditDraft(draft) {
  localStorage.setItem(AUDIT_DRAFT_KEY, JSON.stringify(draft));
}

function updateConnectionIndicator() {
  const indicator = document.getElementById('stock-offline-indicator');
  if (!indicator) return;
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  const queued = context?.Store?.getOfflineStockQueue?.().length || 0;
  indicator.className = `stock-sync-pill ${online ? 'is-online' : 'is-offline'}`;
  indicator.innerHTML = online
    ? `<i class="fa-solid ${queued ? 'fa-cloud-arrow-up' : 'fa-cloud-check'}"></i> ${queued ? `${queued} للمزامنة` : 'متصل'}`
    : `<i class="fa-solid fa-cloud-slash"></i> دون إنترنت`;
}

function panelHeading(icon, title, subtitle) {
  return `<header class="stock-pro-panel-heading"><i class="fa-solid ${icon}"></i><span><h4>${title}</h4><p>${subtitle}</p></span></header>`;
}

function proKpi(icon, value, label, tone) {
  return `<div class="stock-pro-kpi is-${tone}"><i class="fa-solid ${icon}"></i><span><strong>${value}</strong><small>${label}</small></span></div>`;
}

function locationOptions(locations, reverse = false) {
  const active = locations.filter(location => location.active !== false);
  const list = reverse ? [...active].reverse() : active;
  return list.map(location => `<option value="${escapeHtml(location.id)}">${escapeHtml(location.name)}</option>`).join('');
}

function productQty(product) {
  if (Number.isFinite(Number(product?.seriesQty))) return Math.max(0, Number(product.seriesQty));
  if (Number.isFinite(Number(product?.stockQty))) return Math.max(0, Number(product.stockQty));
  return 0;
}

function productName(product) {
  return product?.name?.ar || product?.name || product?.id || 'منتج';
}

function modelCode(product) {
  const name = productName(product);
  return name.replace(/^موديل\s*/i, '').trim();
}

function normalizeCode(value) {
  return String(value || '').trim().replace(/^#/, '').replace(/\s+/g, '').toUpperCase();
}

function formatDzd(value) {
  return `${new Intl.NumberFormat('ar-DZ').format(Math.round(Number(value) || 0))} دج`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' });
}

function emptyLine(message) {
  return `<div class="stock-pro-empty"><i class="fa-solid fa-circle-check"></i><span>${escapeHtml(message)}</span></div>`;
}

function notify(message) {
  window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: message }));
}

function setButtonBusy(button, busy, label = '') {
  if (!button) return;
  if (busy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${escapeHtml(label)}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/["\\]/g, '\\$&');
}
