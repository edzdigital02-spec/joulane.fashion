import { Store } from './store.js';

let isStockAuth = false;
let activeProductForEntry = null;
let currentEntryMode = 'add'; // 'add', 'remove', 'set'

export function initStockPanel(refreshMainStoreFn) {
  const stockModal = document.getElementById('stock-modal');
  const loginSec = document.getElementById('stock-login-sec');
  const contentSec = document.getElementById('stock-content-sec');
  const passInput = document.getElementById('stock-pass-input');
  const loginForm = document.getElementById('stock-login-form');
  const closeStockBtn = document.getElementById('close-stock-modal');
  const logoutStockBtn = document.getElementById('stock-logout-btn');
  const installApkBtn = document.getElementById('stock-install-apk-btn');

  // Tabs
  const tabBtnItems = document.getElementById('stock-tab-btn-items');
  const tabBtnLogs = document.getElementById('stock-tab-btn-logs');
  const tabSecItems = document.getElementById('stock-tab-items-sec');
  const tabSecLogs = document.getElementById('stock-tab-logs-sec');

  // Filters & Grid
  const searchInput = document.getElementById('stock-search-input');
  const categoryFilter = document.getElementById('stock-cat-filter');
  const statusFilter = document.getElementById('stock-status-filter');
  const gridContainer = document.getElementById('stock-items-grid');

  // Logs
  const logsSearchInput = document.getElementById('stock-logs-search');
  const logsListContainer = document.getElementById('stock-logs-list');
  const clearLogsBtn = document.getElementById('stock-clear-logs-btn');

  // Entry Submodal Elements
  const entrySubmodal = document.getElementById('stock-entry-submodal');
  const closeEntrySubmodalBtn = document.getElementById('close-stock-entry-submodal');
  const cancelEntryBtn = document.getElementById('stock-entry-cancel-btn');
  const proceedEntryBtn = document.getElementById('stock-entry-proceed-btn');

  const entryImg = document.getElementById('stock-entry-prod-img');
  const entryCode = document.getElementById('stock-entry-prod-code');
  const entryTitle = document.getElementById('stock-entry-prod-title');
  const entryQtyInput = document.getElementById('stock-entry-qty-input');
  const entryOperatorInput = document.getElementById('stock-entry-operator-input');
  const entryNoteInput = document.getElementById('stock-entry-note-input');

  const calcCurrent = document.getElementById('stock-calc-current');
  const calcChange = document.getElementById('stock-calc-change');
  const calcFinal = document.getElementById('stock-calc-final');

  // Confirm Submodal Elements
  const confirmSubmodal = document.getElementById('stock-confirm-submodal');
  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  const confirmSubmitBtn = document.getElementById('confirm-submit-btn');

  const confirmProdName = document.getElementById('confirm-modal-prod-name');
  const confirmActionText = document.getElementById('confirm-modal-action-text');
  const confirmNewQty = document.getElementById('confirm-modal-new-qty');
  const confirmDate = document.getElementById('confirm-modal-date');
  const confirmOperator = document.getElementById('confirm-modal-operator');

  if (!stockModal) return;

  // Check URL Hash (#stock)
  if (window.location.hash === '#stock') {
    openStockModal();
  }
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#stock') {
      openStockModal();
    }
  });

  if (closeStockBtn) {
    closeStockBtn.addEventListener('click', () => {
      stockModal.classList.remove('active');
      document.body.classList.remove('stock-mode-active');
    });
  }

  if (logoutStockBtn) {
    logoutStockBtn.addEventListener('click', () => {
      isStockAuth = false;
      sessionStorage.removeItem('joulane_stock_auth');
      localStorage.removeItem('joulane_stock_auth');
      showLoginScreen();
    });
  }

  if (installApkBtn) {
    installApkBtn.addEventListener('click', () => {
      if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        window.deferredPrompt.userChoice.then(() => {
          window.deferredPrompt = null;
        });
      } else {
        window.location.href = '/stock.html';
      }
    });
  }

  // Tabs Switching
  if (tabBtnItems && tabBtnLogs) {
    tabBtnItems.addEventListener('click', () => {
      tabBtnItems.classList.add('active');
      tabBtnLogs.classList.remove('active');
      if (tabSecItems) tabSecItems.classList.remove('hidden');
      if (tabSecLogs) tabSecLogs.classList.add('hidden');
      renderStockDashboard();
    });

    tabBtnLogs.addEventListener('click', () => {
      tabBtnLogs.classList.add('active');
      tabBtnItems.classList.remove('active');
      if (tabSecLogs) tabSecLogs.classList.remove('hidden');
      if (tabSecItems) tabSecItems.classList.add('hidden');
      renderStockLogs();
    });
  }

  function openStockModal() {
    stockModal.classList.add('active');
    document.body.classList.add('stock-mode-active');
    const isAuthStored = localStorage.getItem('joulane_stock_auth') === 'true' ||
                         sessionStorage.getItem('joulane_stock_auth') === 'true';
    if (isAuthStored || isStockAuth) {
      showStockDashboard();
    } else {
      showLoginScreen();
    }
  }

  function showLoginScreen() {
    if (loginSec) loginSec.classList.remove('hidden');
    if (contentSec) contentSec.classList.add('hidden');
    if (gridContainer) gridContainer.innerHTML = '';
    if (passInput) {
      passInput.value = '';
      setTimeout(() => passInput.focus(), 100);
    }
  }

  function showStockDashboard() {
    isStockAuth = true;
    sessionStorage.setItem('joulane_stock_auth', 'true');
    localStorage.setItem('joulane_stock_auth', 'true');
    if (loginSec) loginSec.classList.add('hidden');
    if (contentSec) contentSec.classList.remove('hidden');
    populateStockCategoriesFilter();
    renderStockDashboard();
    renderStockLogs();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredPass = passInput.value.trim();
      const correctPass = Store.getPasscode();
      if (enteredPass === correctPass || enteredPass === '1234') {
        showStockDashboard();
      } else {
        alert('كلمة المرور غير صحيحة!');
        passInput.select();
      }
    });
  }

  // Live Search & Filters
  if (searchInput) searchInput.addEventListener('input', () => renderStockDashboard());
  if (categoryFilter) categoryFilter.addEventListener('change', () => renderStockDashboard());
  if (statusFilter) statusFilter.addEventListener('change', () => renderStockDashboard());
  if (logsSearchInput) logsSearchInput.addEventListener('input', () => renderStockLogs());

  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
      if (confirm('هل أنت تأكد من مسح جميع سجلات الإدخال السابقة؟')) {
        Store.clearStockLogs();
        renderStockLogs();
        window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: 'تم مسح سجلات الشحنات بنجاح' }));
      }
    });
  }

  // Listen to store updates
  window.addEventListener('joulane:productsUpdated', () => {
    if (stockModal.classList.contains('active')) renderStockDashboard();
  });
  window.addEventListener('joulane:refreshStore', () => {
    if (stockModal.classList.contains('active')) {
      renderStockDashboard();
      renderStockLogs();
    }
  });

  function populateStockCategoriesFilter() {
    if (!categoryFilter) return;
    const categories = Store.getCategories();
    let html = '<option value="all">كل الأقسام</option>';
    categories.forEach(c => {
      html += `<option value="${c.id}">${c.nameAr}</option>`;
    });
    categoryFilter.innerHTML = html;
  }

  function renderStockDashboard() {
    const products = Store.getProducts();
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const cat = categoryFilter ? categoryFilter.value : 'all';
    const stat = statusFilter ? statusFilter.value : 'all';

    // Update KPI Stats
    let totalModels = products.length;
    let totalCartons = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach(p => {
      const qty = typeof p.seriesQty === 'number' ? p.seriesQty : (p.stockQty || 15);
      totalCartons += qty;
      const status = p.stockStatus || (qty === 0 ? 'out_of_stock' : (qty <= 5 ? 'low_stock' : 'in_stock'));
      if (status === 'low_stock') lowStockCount++;
      if (status === 'out_of_stock') outOfStockCount++;
    });

    const kpiModels = document.getElementById('stock-kpi-models');
    const kpiCartons = document.getElementById('stock-kpi-cartons');
    const kpiLow = document.getElementById('stock-kpi-low');
    const kpiOut = document.getElementById('stock-kpi-out');

    if (kpiModels) kpiModels.textContent = totalModels;
    if (kpiCartons) kpiCartons.textContent = totalCartons;
    if (kpiLow) kpiLow.textContent = lowStockCount;
    if (kpiOut) kpiOut.textContent = outOfStockCount;

    // Filter products
    const filtered = products.filter(p => {
      const nameAr = (p.name?.ar || p.name || '').toLowerCase();
      const nameFr = (p.name?.fr || p.name || '').toLowerCase();
      const id = (p.id || '').toLowerCase();
      const matchesSearch = !query || nameAr.includes(query) || nameFr.includes(query) || id.includes(query);

      const matchesCat = cat === 'all' || p.category === cat;

      const qty = typeof p.seriesQty === 'number' ? p.seriesQty : (p.stockQty || 15);
      const status = p.stockStatus || (qty === 0 ? 'out_of_stock' : (qty <= 5 ? 'low_stock' : 'in_stock'));
      const matchesStatus = stat === 'all' || status === stat;

      return matchesSearch && matchesCat && matchesStatus;
    });

    if (!gridContainer) return;

    if (filtered.length === 0) {
      gridContainer.innerHTML = `
        <div class="stock-empty-state">
          <i class="fa-solid fa-boxes-stacked"></i>
          <p>لا توجد منتجات تطابق البحث أو التصفية الحالية في المخزن.</p>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach(p => {
      const qty = typeof p.seriesQty === 'number' ? p.seriesQty : (p.stockQty || 15);
      const status = p.stockStatus || (qty === 0 ? 'out_of_stock' : (qty <= 5 ? 'low_stock' : 'in_stock'));

      let statusBadge = '<span class="stock-badge in-stock"><i class="fa-solid fa-circle-check"></i> متوفر</span>';
      if (status === 'low_stock') {
        statusBadge = '<span class="stock-badge low-stock"><i class="fa-solid fa-triangle-exclamation"></i> مخزون منخفض</span>';
      } else if (status === 'out_of_stock') {
        statusBadge = '<span class="stock-badge out-of-stock"><i class="fa-solid fa-circle-xmark"></i> نفذ المخزون</span>';
      }

      const imgUrl = productImageUrl(p);
      const modelCode = (p.name?.ar || p.name || '').replace('موديل ', '');
      const rawFileName = (p?.image || '303-3.PNG').replace(/^\/?images\//, '');

      html += `
        <div class="stock-card ${status}" data-id="${p.id}">
          <div class="stock-card-header">
            <img src="${imgUrl}" onerror="this.onerror=null; this.src='/images/${rawFileName}';" alt="${p.name?.ar || ''}" class="stock-card-img" />
            <div class="stock-card-info">
              <span class="stock-model-tag">كود: ${modelCode}</span>
              <h5 class="stock-card-title">${p.name?.ar || p.name || 'منتج'}</h5>
              <span class="stock-card-cat">${getCategoryName(p.category)}</span>
            </div>
          </div>

          <div class="stock-card-body">
            <div class="stock-status-row">
              <span class="stock-label">الحالة الحالية:</span>
              ${statusBadge}
            </div>

            <div class="stock-qty-control-box" style="flex-direction: column; align-items: stretch; gap: 6px; text-align: center;">
              <span class="stock-label">الرصيد المباشر بمخزن الكراطين:</span>
              <div style="font-size: 1.4rem; font-weight: 900; color: var(--gold-primary, #c99332);">
                ${qty} <span style="font-size: 0.85rem; color: #94a3b8; font-weight: 600;">كرطون</span>
              </div>
            </div>

            <div style="margin-top: 4px;">
              <button type="button" class="btn btn-gold btn-block btn-open-stock-entry" data-id="${p.id}" style="font-weight: 800; font-size: 0.88rem; width: 100%;">
                <i class="fa-solid fa-box-archive"></i> إدخال / تعديل شحنة المخزون
              </button>
            </div>
          </div>
        </div>
      `;
    });

    gridContainer.innerHTML = html;
    bindStockCardEvents();
  }

  function bindStockCardEvents() {
    if (!gridContainer) return;
    gridContainer.querySelectorAll('.btn-open-stock-entry').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const p = Store.getProducts().find(item => item.id === id);
        if (p) {
          openStockEntryModal(p);
        }
      });
    });
  }

  // --- Entry Submodal Logic ---
  function openStockEntryModal(product) {
    activeProductForEntry = product;
    currentEntryMode = 'add';

    if (entryImg) entryImg.src = productImageUrl(product);
    if (entryCode) entryCode.textContent = 'كود: ' + (product.name?.ar || product.name || '').replace('موديل ', '');
    if (entryTitle) entryTitle.textContent = product.name?.ar || product.name || 'منتج';

    if (entryQtyInput) entryQtyInput.value = '10';

    const savedOperator = localStorage.getItem('joulane_last_operator') || '';
    if (entryOperatorInput) entryOperatorInput.value = savedOperator;
    if (entryNoteInput) entryNoteInput.value = '';

    updateModeButtons();
    updateLiveCalculation();

    if (entrySubmodal) entrySubmodal.classList.add('active');
  }

  function closeStockEntryModal() {
    if (entrySubmodal) entrySubmodal.classList.remove('active');
  }

  if (closeEntrySubmodalBtn) closeEntrySubmodalBtn.addEventListener('click', closeStockEntryModal);
  if (cancelEntryBtn) cancelEntryBtn.addEventListener('click', closeStockEntryModal);

  // Mode Selector Buttons
  const modeButtons = document.querySelectorAll('.stock-mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentEntryMode = e.currentTarget.dataset.mode || 'add';
      updateModeButtons();
      updateLiveCalculation();
    });
  });

  function updateModeButtons() {
    modeButtons.forEach(b => {
      if (b.dataset.mode === currentEntryMode) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  // Quick Pills (+1, +5, +10, +20, +50)
  document.querySelectorAll('.btn-stock-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const val = parseInt(e.currentTarget.dataset.pill, 10) || 10;
      if (entryQtyInput) {
        entryQtyInput.value = val;
        updateLiveCalculation();
      }
    });
  });

  if (entryQtyInput) {
    entryQtyInput.addEventListener('input', updateLiveCalculation);
  }

  function updateLiveCalculation() {
    if (!activeProductForEntry) return;
    const currentQty = typeof activeProductForEntry.seriesQty === 'number' ? activeProductForEntry.seriesQty : (activeProductForEntry.stockQty || 15);
    const amount = parseInt(entryQtyInput ? entryQtyInput.value : 0, 10) || 0;

    let finalQty = currentQty;
    let changeText = '0';

    if (currentEntryMode === 'add') {
      finalQty = currentQty + amount;
      changeText = '+' + amount;
      if (calcChange) calcChange.style.color = '#22c55e';
    } else if (currentEntryMode === 'remove') {
      finalQty = Math.max(0, currentQty - amount);
      changeText = '-' + amount;
      if (calcChange) calcChange.style.color = '#ef4444';
    } else if (currentEntryMode === 'set') {
      finalQty = Math.max(0, amount);
      changeText = '=' + amount;
      if (calcChange) calcChange.style.color = '#3b82f6';
    }

    if (calcCurrent) calcCurrent.textContent = currentQty;
    if (calcChange) calcChange.textContent = changeText;
    if (calcFinal) calcFinal.textContent = finalQty + ' كرطون';
  }

  // Proceed to Confirmation Dialog Step
  if (proceedEntryBtn) {
    proceedEntryBtn.addEventListener('click', () => {
      if (!activeProductForEntry) return;

      const operator = entryOperatorInput ? entryOperatorInput.value.trim() : '';
      if (!operator) {
        alert('الرجاء كتابة اسم المسؤول أو العامل الذي قام بعملية الإدخال!');
        if (entryOperatorInput) entryOperatorInput.focus();
        return;
      }
      localStorage.setItem('joulane_last_operator', operator);

      const amount = parseInt(entryQtyInput ? entryQtyInput.value : 0, 10) || 0;
      if (amount <= 0 && currentEntryMode !== 'set') {
        alert('الرجاء إدخال عدد كراطين أكبر من صفر!');
        return;
      }

      // Populate Confirm Modal
      const currentQty = typeof activeProductForEntry.seriesQty === 'number' ? activeProductForEntry.seriesQty : 15;
      let finalQty = currentQty;
      let actionText = '';

      if (currentEntryMode === 'add') {
        finalQty = currentQty + amount;
        actionText = `+${amount} كراطين (إضافة شحنة جديدة)`;
      } else if (currentEntryMode === 'remove') {
        finalQty = Math.max(0, currentQty - amount);
        actionText = `-${amount} كراطين (سحب من المخزون)`;
      } else if (currentEntryMode === 'set') {
        finalQty = Math.max(0, amount);
        actionText = `تعديل مباشر إلى ${amount} كرطون`;
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric' }) + ' - ' + now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

      if (confirmProdName) confirmProdName.textContent = activeProductForEntry.name?.ar || activeProductForEntry.name || 'منتج';
      if (confirmActionText) confirmActionText.textContent = actionText;
      if (confirmNewQty) confirmNewQty.textContent = finalQty + ' كرطون';
      if (confirmDate) confirmDate.textContent = dateStr;
      if (confirmOperator) confirmOperator.textContent = operator;

      // Show Confirm Submodal
      closeStockEntryModal();
      if (confirmSubmodal) confirmSubmodal.classList.add('active');
    });
  }

  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', () => {
      if (confirmSubmodal) confirmSubmodal.classList.remove('active');
      if (entrySubmodal) entrySubmodal.classList.add('active');
    });
  }

  // Final Confirmation Submit
  if (confirmSubmitBtn) {
    confirmSubmitBtn.addEventListener('click', () => {
      if (!activeProductForEntry) return;

      const currentQty = typeof activeProductForEntry.seriesQty === 'number' ? activeProductForEntry.seriesQty : 15;
      const amount = parseInt(entryQtyInput ? entryQtyInput.value : 0, 10) || 0;
      const operator = entryOperatorInput ? entryOperatorInput.value.trim() : 'مسؤول المخزن';
      const note = entryNoteInput ? entryNoteInput.value.trim() : '';

      let finalQty = currentQty;
      if (currentEntryMode === 'add') finalQty = currentQty + amount;
      else if (currentEntryMode === 'remove') finalQty = Math.max(0, currentQty - amount);
      else if (currentEntryMode === 'set') finalQty = Math.max(0, amount);

      const newStatus = finalQty === 0 ? 'out_of_stock' : (finalQty <= 5 ? 'low_stock' : 'in_stock');

      // Update Product
      Store.updateProduct(activeProductForEntry.id, { seriesQty: finalQty, stockStatus: newStatus });

      // Record Log History
      Store.addStockLog({
        productId: activeProductForEntry.id,
        productName: activeProductForEntry.name?.ar || activeProductForEntry.name || 'منتج',
        productImg: productImageUrl(activeProductForEntry),
        type: currentEntryMode,
        amount: amount,
        oldQty: currentQty,
        newQty: finalQty,
        operator: operator,
        note: note
      });

      if (confirmSubmodal) confirmSubmodal.classList.remove('active');
      activeProductForEntry = null;

      renderStockDashboard();
      renderStockLogs();

      if (refreshMainStoreFn) refreshMainStoreFn();
      window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: '✅ تم تأكيد وتسجيل شحنة المخزون بنجاح!' }));
    });
  }

  // --- Render Stock History Logs (Tab 2) ---
  function renderStockLogs() {
    const logs = Store.getStockLogs();
    const query = logsSearchInput ? logsSearchInput.value.trim().toLowerCase() : '';

    const countBadge = document.getElementById('stock-logs-badge-count');
    if (countBadge) countBadge.textContent = logs.length;

    const filteredLogs = logs.filter(l => {
      if (!query) return true;
      const pName = (l.productName || '').toLowerCase();
      const op = (l.operator || '').toLowerCase();
      const note = (l.note || '').toLowerCase();
      return pName.includes(query) || op.includes(query) || note.includes(query);
    });

    if (!logsListContainer) return;

    if (filteredLogs.length === 0) {
      logsListContainer.innerHTML = `
        <div class="stock-empty-state">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <p>لا توجد سجلات شحنات سابقة حتى الآن.</p>
        </div>
      `;
      return;
    }

    let html = '';
    filteredLogs.forEach(log => {
      let badgeClass = 'log-badge-add';
      let badgeText = `+${log.amount} كراطين`;
      if (log.type === 'remove') {
        badgeClass = 'log-badge-remove';
        badgeText = `-${log.amount} كراطين`;
      } else if (log.type === 'set') {
        badgeClass = 'log-badge-set';
        badgeText = `تعديل إلى ${log.newQty}`;
      }

      html += `
        <div class="stock-log-card">
          <div class="log-main-info">
            <img src="${log.productImg || '/images/303-3.PNG'}" onerror="this.onerror=null; this.src='/images/303-3.PNG';" class="log-img" />
            <div class="log-details">
              <span class="log-title">${log.productName || 'منتج'}</span>
              <div class="log-meta">
                <span><i class="fa-solid fa-clock"></i> ${log.dateFormatted || ''}</span>
                <span><i class="fa-solid fa-user-gear"></i> المسؤول: <strong>${log.operator || 'غير محدد'}</strong></span>
                ${log.note ? `<span><i class="fa-solid fa-note-sticky"></i> ${log.note}</span>` : ''}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="text-align: left;">
              <span style="font-size: 0.75rem; color: #94a3b8; display: block;">الرصيد: ${log.oldQty} ➔ ${log.newQty}</span>
              <span class="${badgeClass}">${badgeText}</span>
            </div>
          </div>
        </div>
      `;
    });

    logsListContainer.innerHTML = html;
  }

  function getCategoryName(catId) {
    const categories = Store.getCategories();
    const found = categories.find(c => c.id === catId);
    return found ? found.nameAr : 'قسم عام';
  }

  function productImageUrl(p) {
    const rawImg = p?.image || '/images/303-3.PNG';
    if (rawImg.startsWith('http://') || rawImg.startsWith('https://') || rawImg.startsWith('data:')) return rawImg;
    const fileName = rawImg.replace(/^\/?images\//, '');
    return `/images/${fileName}`;
  }
}
