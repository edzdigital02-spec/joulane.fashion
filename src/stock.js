import { Store } from './store.js';
import {
  downloadStockReceipt,
  getStockReceiptReference,
  shareStockReceipt
} from './stockReceipt.js';
import { initStockPro, refreshStockPro } from './stockPro.js';

let isStockAuth = false;
let activeProductForEntry = null;
let currentEntryMode = 'add'; // 'add', 'remove', 'set'
let activeMovementForReceipt = null;
let pendingReceiptShareConfirmation = null;
let activeStockBatch = null;
let selectedReceiptRecipientPhones = new Set();

const STOCK_BATCH_SESSION_KEY = 'joulane_active_stock_batch';

function readActiveStockBatch() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STOCK_BATCH_SESSION_KEY) || 'null');
    return parsed && Array.isArray(parsed.movements) && parsed.movements.length ? parsed : null;
  } catch (_) {
    return null;
  }
}

function persistActiveStockBatch() {
  if (!activeStockBatch) {
    sessionStorage.removeItem(STOCK_BATCH_SESSION_KEY);
    return;
  }
  sessionStorage.setItem(STOCK_BATCH_SESSION_KEY, JSON.stringify(activeStockBatch));
}

function receiptPhoneKey(value) {
  return String(value || '').replace(/\D/g, '');
}

function getBatchMovementDelta(movement) {
  const oldQuantity = Number(movement?.oldQty);
  const newQuantity = Number(movement?.newQty);
  if (Number.isFinite(oldQuantity) && Number.isFinite(newQuantity)) return newQuantity - oldQuantity;
  const amount = Number(movement?.amount) || 0;
  return movement?.type === 'remove' ? -amount : movement?.type === 'add' ? amount : 0;
}

function getStockBatchStats(batch) {
  const movements = Array.isArray(batch?.movements) ? batch.movements : [];
  return {
    modelCount: new Set(movements.map(movement => movement.productId || movement.productName)).size,
    movementCount: movements.length,
    cartonCount: movements.reduce((total, movement) => total + Math.abs(getBatchMovementDelta(movement)), 0)
  };
}

function createStockBatchReceipt(batch) {
  return {
    ...batch,
    isBatchReceipt: true,
    timestamp: batch.completedAt || batch.updatedAt || batch.createdAt,
    movements: Array.isArray(batch.movements) ? batch.movements : []
  };
}

const STOCK_REASONS = {
  add: [
    ['factory_shipment', 'شحنة من المصنع'],
    ['supplier_purchase', 'شراء من مورد'],
    ['customer_return', 'مرتجع من زبون'],
    ['inbound_correction', 'تصحيح حركة واردة']
  ],
  remove: [
    ['customer_order', 'طلب زبون أو محل'],
    ['store_transfer', 'تحويل إلى محل أو نقطة بيع'],
    ['damaged_goods', 'تالف أو غير صالح للبيع'],
    ['sample', 'عينة أو عرض'],
    ['outbound_correction', 'تصحيح حركة صادرة']
  ],
  set: [
    ['physical_count', 'جرد فعلي للمخزن'],
    ['opening_balance', 'تثبيت رصيد افتتاحي'],
    ['inventory_reconciliation', 'مطابقة وتصحيح الرصيد']
  ]
};

const STOCK_REASON_LABELS = Object.fromEntries(
  Object.values(STOCK_REASONS).flat().map(([value, label]) => [value, label])
);

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
  const tabBtnInsights = document.getElementById('stock-tab-btn-insights');
  const tabBtnPro = document.getElementById('stock-tab-btn-pro');
  const tabSecItems = document.getElementById('stock-tab-items-sec');
  const tabSecLogs = document.getElementById('stock-tab-logs-sec');
  const tabSecInsights = document.getElementById('stock-tab-insights-sec');
  const tabSecPro = document.getElementById('stock-tab-pro-sec');

  // Filters & Grid
  const searchInput = document.getElementById('stock-search-input');
  const categoryFilter = document.getElementById('stock-cat-filter');
  const statusFilter = document.getElementById('stock-status-filter');
  const resetAllStockBtn = document.getElementById('stock-reset-all-btn');
  const resetInsightsBtn = document.getElementById('stock-reset-insights-btn');
  const gridContainer = document.getElementById('stock-items-grid');
  const activeBatchBar = document.getElementById('stock-active-batch-bar');
  const activeBatchSummary = document.getElementById('stock-active-batch-summary');
  const finishActiveBatchBtn = document.getElementById('stock-finish-active-batch-btn');

  // Logs
  const logsSearchInput = document.getElementById('stock-logs-search');
  const logsTypeFilter = document.getElementById('stock-logs-type-filter');
  const logsPeriodFilter = document.getElementById('stock-logs-period-filter');
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
  const entryQtyDecBtn = document.getElementById('stock-entry-qty-dec');
  const entryQtyIncBtn = document.getElementById('stock-entry-qty-inc');
  const entryQtyLabel = document.getElementById('stock-entry-qty-label');
  const entryQtyHelp = document.getElementById('stock-entry-qty-help');
  const entryReasonSelect = document.getElementById('stock-entry-reason');
  const entryOrderPickerGroup = document.getElementById('stock-entry-order-picker-group');
  const entryOrderPicker = document.getElementById('stock-entry-order-picker');
  const entryCustomerGroup = document.getElementById('stock-entry-customer-group');
  const entryCustomerInput = document.getElementById('stock-entry-customer');
  const entryOrderRefGroup = document.getElementById('stock-entry-order-ref-group');
  const entryOrderRefInput = document.getElementById('stock-entry-order-ref');
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
  const confirmContextRow = document.getElementById('confirm-modal-context-row');
  const confirmContext = document.getElementById('confirm-modal-context');

  // Active shipment session
  const batchSubmodal = document.getElementById('stock-batch-submodal');
  const batchContinueBtn = document.getElementById('stock-batch-continue-btn');
  const batchFinishBtn = document.getElementById('stock-batch-finish-btn');
  const batchLastImg = document.getElementById('stock-batch-last-img');
  const batchLastName = document.getElementById('stock-batch-last-name');
  const batchLastChange = document.getElementById('stock-batch-last-change');
  const batchModelCount = document.getElementById('stock-batch-model-count');
  const batchMovementCount = document.getElementById('stock-batch-movement-count');
  const batchCartonCount = document.getElementById('stock-batch-carton-count');

  // Receipt Actions
  const receiptSubmodal = document.getElementById('stock-receipt-submodal');
  const receiptReference = document.getElementById('stock-receipt-reference-value');
  const receiptStatus = document.getElementById('stock-receipt-status');
  const receiptDistribution = document.getElementById('stock-receipt-distribution');
  const receiptProgress = document.getElementById('stock-receipt-progress');
  const selectAllReceiptRecipients = document.getElementById('stock-receipt-select-all');
  const receiptRecipientsList = document.getElementById('stock-receipt-recipients-list');
  const shareReceiptBtn = document.getElementById('share-stock-receipt-btn');
  const confirmReceiptSentBtn = document.getElementById('confirm-stock-receipt-sent-btn');
  const downloadReceiptBtn = document.getElementById('download-stock-receipt-btn');
  const closeReceiptBtn = document.getElementById('close-stock-receipt-btn');
  const receiptTitle = document.getElementById('stock-receipt-title');
  const receiptDescription = document.getElementById('stock-receipt-description');
  const receiptBatchSummary = document.getElementById('stock-receipt-batch-summary');
  const receiptModelCount = document.getElementById('stock-receipt-model-count');
  const receiptMovementCount = document.getElementById('stock-receipt-movement-count');
  const receiptCartonCount = document.getElementById('stock-receipt-carton-count');

  if (!stockModal) return;
  activeStockBatch = readActiveStockBatch();
  initStockPro({
    Store,
    getCurrentUser: getCurrentStockUser,
    getPermissions: getCurrentUserPermissions,
    onRefresh: () => {
      renderStockDashboard();
      renderStockLogs();
      renderStockInsights();
      if (refreshMainStoreFn) refreshMainStoreFn();
    }
  });

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
      sessionStorage.removeItem('joulane_current_stock_user');
      localStorage.removeItem('joulane_stock_auth');
      Store.logoutUser();
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
    const activateTab = (activeButton, activeSection) => {
      [tabBtnItems, tabBtnLogs, tabBtnInsights, tabBtnPro].forEach(button => button?.classList.toggle('active', button === activeButton));
      [tabSecItems, tabSecLogs, tabSecInsights, tabSecPro].forEach(section => section?.classList.toggle('hidden', section !== activeSection));
    };

    tabBtnItems.addEventListener('click', () => {
      activateTab(tabBtnItems, tabSecItems);
      renderStockDashboard();
    });

    tabBtnLogs.addEventListener('click', () => {
      if (!getCurrentUserPermissions().stockViewLogs) {
        alert('عذراً! حسابك لا يملك صلاحية مشاهدة سجل حركة المخزن.');
        return;
      }
      activateTab(tabBtnLogs, tabSecLogs);
      renderStockLogs();
    });

    tabBtnInsights?.addEventListener('click', () => {
      if (!getCurrentUserPermissions().stockViewLogs) {
        alert('عذراً! حسابك لا يملك صلاحية مشاهدة إحصائيات حركة المخزن.');
        return;
      }
      activateTab(tabBtnInsights, tabSecInsights);
      renderStockInsights();
    });

    tabBtnPro?.addEventListener('click', async () => {
      activateTab(tabBtnPro, tabSecPro);
      await Store.refreshStockProData();
      refreshStockPro();
    });
  }

  function openStockModal() {
    stockModal.classList.add('active');
    document.body.classList.add('stock-mode-active');
    const isAuthStored = sessionStorage.getItem('joulane_stock_auth') === 'true' &&
                         Store.hasSecureSession('stock');
    if (isAuthStored || isStockAuth) {
      showStockDashboard();
    } else {
      showLoginScreen();
    }
  }

  function populateStockUsersSelect() {
    const select = document.getElementById('stock-user-select');
    if (!select) return;
    const users = Store.getUsers();
    let html = '<option value="all">-- اختر اسم العامل / المسؤول --</option>';
    users.forEach(u => {
      if (u.allowStock || u.id === 'usr_super_admin') {
        html += `<option value="${u.id}">${u.name} (${u.role || 'عامل مخزن'})</option>`;
      }
    });
    select.innerHTML = html;
  }

  function showLoginScreen() {
    if (loginSec) loginSec.classList.remove('hidden');
    if (contentSec) contentSec.classList.add('hidden');
    if (gridContainer) gridContainer.innerHTML = '';
    populateStockUsersSelect();
    if (passInput) {
      passInput.value = '';
      setTimeout(() => passInput.focus(), 100);
    }
  }

  function syncActiveBatchForCurrentUser() {
    const currentUser = getCurrentStockUser();
    if (!activeStockBatch) return;
    if (activeStockBatch.operatorId && currentUser?.id && activeStockBatch.operatorId !== currentUser.id) {
      activeStockBatch = null;
      persistActiveStockBatch();
    }
  }

  function renderActiveStockBatchBar() {
    if (!activeBatchBar) return;
    const hasBatch = !!activeStockBatch?.movements?.length;
    activeBatchBar.classList.toggle('hidden', !hasBatch);
    if (!hasBatch) return;

    const stats = getStockBatchStats(activeStockBatch);
    if (activeBatchSummary) {
      activeBatchSummary.textContent = activeStockBatch.status === 'finalized'
        ? `الوصل جاهز - ${stats.modelCount} موديلات - ${stats.cartonCount} كرطون`
        : `${stats.modelCount} موديلات - ${stats.movementCount} حركات - ${stats.cartonCount} كرطون`;
    }
    if (finishActiveBatchBtn) {
      finishActiveBatchBtn.innerHTML = activeStockBatch.status === 'finalized'
        ? '<i class="fa-solid fa-file-pdf"></i> فتح الوصل المجمع'
        : '<i class="fa-solid fa-file-circle-check"></i> انتهيت وأنشئ الوصل';
    }
  }

  function addMovementToActiveBatch(movement) {
    const currentUser = getCurrentStockUser();
    if (!activeStockBatch || activeStockBatch.status === 'finalized') {
      const now = new Date().toISOString();
      activeStockBatch = {
        id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        status: 'collecting',
        createdAt: now,
        updatedAt: now,
        operatorId: currentUser?.id || movement.operatorId || '',
        operator: currentUser?.name || movement.operator || 'مسؤول المخزن',
        movements: []
      };
    }
    activeStockBatch.movements.push(movement);
    activeStockBatch.updatedAt = new Date().toISOString();
    persistActiveStockBatch();
    renderActiveStockBatchBar();
  }

  function showBatchDecision(movement) {
    if (!activeStockBatch || !batchSubmodal) return;
    const stats = getStockBatchStats(activeStockBatch);
    const delta = getBatchMovementDelta(movement);
    if (batchLastImg) batchLastImg.src = movement.productImg || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg';
    if (batchLastName) batchLastName.textContent = movement.productName || 'منتج';
    if (batchLastChange) {
      batchLastChange.textContent = `${delta > 0 ? '+' : ''}${delta} كرطون - الرصيد ${movement.oldQty} ← ${movement.newQty}`;
      batchLastChange.className = delta > 0 ? 'is-inbound' : delta < 0 ? 'is-outbound' : 'is-neutral';
    }
    if (batchModelCount) batchModelCount.textContent = stats.modelCount;
    if (batchMovementCount) batchMovementCount.textContent = stats.movementCount;
    if (batchCartonCount) batchCartonCount.textContent = stats.cartonCount;
    batchSubmodal.classList.add('active');
  }

  function finalizeActiveStockBatch() {
    if (!activeStockBatch?.movements?.length) return;
    if (activeStockBatch.status !== 'finalized') {
      activeStockBatch.status = 'finalized';
      activeStockBatch.completedAt = new Date().toISOString();
      activeStockBatch.updatedAt = activeStockBatch.completedAt;
      persistActiveStockBatch();
    }
    batchSubmodal?.classList.remove('active');
    renderActiveStockBatchBar();
    window.dispatchEvent(new CustomEvent('joulane:showToast', {
      detail: 'تم تحديث المخزون وتجميع جميع الموديلات في وصل واحد.'
    }));
    openReceiptActions(createStockBatchReceipt(activeStockBatch));
  }

  function showStockDashboard() {
    syncActiveBatchForCurrentUser();
    isStockAuth = true;
    sessionStorage.setItem('joulane_stock_auth', 'true');
    if (loginSec) loginSec.classList.add('hidden');
    if (contentSec) contentSec.classList.remove('hidden');
    const permissions = getCurrentUserPermissions();
    if (tabBtnLogs) tabBtnLogs.hidden = !permissions.stockViewLogs;
    if (tabBtnInsights) tabBtnInsights.hidden = !permissions.stockViewLogs;
    if (resetAllStockBtn) resetAllStockBtn.hidden = getCurrentStockUser()?.id !== 'usr_super_admin';
    if (!permissions.stockViewLogs && tabBtnLogs?.classList.contains('active')) {
      tabBtnItems?.click();
    }
    populateStockCategoriesFilter();
    renderStockDashboard();
    renderStockLogs();
    renderStockInsights();
    refreshStockPro();
    renderActiveStockBatchBar();
    if (activeStockBatch?.status === 'finalized') {
      setTimeout(() => openReceiptActions(createStockBatchReceipt(activeStockBatch)), 80);
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedUserId = document.getElementById('stock-user-select')?.value || 'all';
      const enteredPass = passInput.value.trim();
      const user = await Store.authenticateUser(selectedUserId, enteredPass, 'stock');

      if (user) {
        if (user.allowStock || user.id === 'usr_super_admin') {
          sessionStorage.setItem('joulane_current_stock_user', JSON.stringify(user));
          Store.restrictProtectedData(user, 'stock');
          await Store.initSupabase(refreshMainStoreFn, { force: true });
          showStockDashboard();
          window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: `مرحباً بك يا ${user.name} في لوحة المخزن!` }));
        } else {
          alert(`عذراً يا ${user.name}! هذا الحساب مخصص لـ (لوحة التحكم #admin) فقط ولا يملك صلاحية الدخول للوحة المخزن.`);
          if (passInput) passInput.select();
        }
      } else {
        alert('اسم المستخدم أو كلمة المرور غير صحيحة! يرجى اختيار حسابك وإدخال الرمز الصحيح.');
        if (passInput) passInput.select();
      }
    });
  }

  window.addEventListener('joulane:usersUpdated', () => populateStockUsersSelect());

  // Live Search & Filters
  if (searchInput) searchInput.addEventListener('input', () => {
    localStorage.setItem('joulane_stock_filter_search', searchInput.value);
    renderStockDashboard();
  });
  if (categoryFilter) categoryFilter.addEventListener('change', () => {
    localStorage.setItem('joulane_stock_filter_category', categoryFilter.value);
    renderStockDashboard();
  });
  if (statusFilter) statusFilter.addEventListener('change', () => {
    localStorage.setItem('joulane_stock_filter_status', statusFilter.value);
    renderStockDashboard();
  });
  if (logsSearchInput) logsSearchInput.addEventListener('input', () => renderStockLogs());
  if (logsTypeFilter) logsTypeFilter.addEventListener('change', () => renderStockLogs());
  if (logsPeriodFilter) logsPeriodFilter.addEventListener('change', () => renderStockLogs());
  batchContinueBtn?.addEventListener('click', () => {
    batchSubmodal?.classList.remove('active');
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    renderStockDashboard();
  });
  batchFinishBtn?.addEventListener('click', finalizeActiveStockBatch);
  finishActiveBatchBtn?.addEventListener('click', finalizeActiveStockBatch);

  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
      const perms = getCurrentUserPermissions();
      if (!perms.stockViewLogs || !perms.stockClearLogs) {
        alert('عذراً! حسابك لا يملك صلاحية مسح وتفريغ سجل الشحنات. السجل مخصص للاحتفاظ بالدليل والدقة.');
        return;
      }
      if (confirm('هل أنت تأكد من مسح جميع سجلات الإدخال السابقة؟')) {
        Store.clearStockLogs();
        renderStockLogs();
        window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: 'تم مسح سجلات الشحنات بنجاح' }));
      }
    });
  }

  if (resetInsightsBtn) {
    resetInsightsBtn.addEventListener('click', () => {
      const perms = getCurrentUserPermissions();
      if (!perms.stockViewLogs) return;
      if (confirm('هل أنت متأكد من تصفير الإحصائيات وبدء الحساب من جديد؟')) {
        localStorage.setItem('joulane_stock_insights_reset_date', new Date().toISOString());
        renderStockInsights();
        window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: 'تم تصفير الإحصائيات بنجاح' }));
      }
    });
  }

  if (resetAllStockBtn) {
    resetAllStockBtn.addEventListener('click', async () => {
      const perms = getCurrentUserPermissions();
      if (!perms.stockSet) {
        alert('عذراً! حسابك لا يملك صلاحية التعديل المباشر للمخزون.');
        return;
      }

      const productsWithStock = Store.getProducts().filter(product => getProductStock(product) > 0);
      const totalCartons = productsWithStock.reduce((total, product) => total + getProductStock(product), 0);
      if (totalCartons === 0) {
        alert('المخزون كامل يساوي صفراً بالفعل، ولا توجد كميات لتصفيرها.');
        return;
      }

      const warning = [
        '⚠️ تحذير شديد',
        '',
        `سيتم جعل مخزون جميع الموديلات صفراً (${totalCartons} كرطون في ${productsWithStock.length} موديل).`,
        'سيُنشئ النظام نسخة احتياطية تلقائياً قبل التنفيذ، والاسترجاع متاح للمدير العام.',
        '',
        'هل أنت متأكد من إكمال العملية؟'
      ].join('\n');
      if (!confirm(warning)) return;
      if (!confirm('تأكيد أخير: اضغط «موافق» لتصفير المخزون بالكامل الآن.')) return;

      const originalHtml = resetAllStockBtn.innerHTML;
      resetAllStockBtn.disabled = true;
      resetAllStockBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ تصفير المخزون...';
      try {
        const result = await Store.resetAllStock();
        if (!result) {
          alert('تعذر تصفير المخزون. تحقق من الاتصال وصلاحية الحساب ثم حاول مجدداً.');
          return;
        }
        activeStockBatch = null;
        persistActiveStockBatch();
        renderStockDashboard();
        renderStockLogs();
        renderStockInsights();
        renderActiveStockBatchBar();
        if (refreshMainStoreFn) refreshMainStoreFn();
        window.dispatchEvent(new CustomEvent('joulane:showToast', {
          detail: `تم تصفير المخزون بالكامل: ${result.previousCartons || totalCartons} كرطون.`
        }));
      } finally {
        resetAllStockBtn.disabled = false;
        resetAllStockBtn.innerHTML = originalHtml;
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
      renderStockInsights();
      refreshStockPro();
    }
  });

  function populateStockCategoriesFilter() {
    if (!categoryFilter) return;
    const savedCategory = localStorage.getItem('joulane_stock_filter_category') || 'all';
    const categories = Store.getCategories();
    let html = '<option value="all">كل الأقسام</option>';
    categories.forEach(c => {
      html += `<option value="${c.id}">${c.nameAr}</option>`;
    });
    categoryFilter.innerHTML = html;
    categoryFilter.value = Array.from(categoryFilter.options).some(option => option.value === savedCategory) ? savedCategory : 'all';
    if (statusFilter) statusFilter.value = localStorage.getItem('joulane_stock_filter_status') || 'all';
    if (searchInput) searchInput.value = localStorage.getItem('joulane_stock_filter_search') || '';
  }

  function renderStockDashboard() {
    const products = Store.getProducts();
    const permissions = getCurrentUserPermissions();
    const canAdjustStock = permissions.stockAdd || permissions.stockRemove || permissions.stockSet;
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
      const isAvailable = p.isAvailable !== false;

      let statusBadge = '<span class="stock-badge in-stock"><i class="fa-solid fa-circle-check"></i> متوفر</span>';
      if (status === 'low_stock') {
        statusBadge = '<span class="stock-badge low-stock"><i class="fa-solid fa-triangle-exclamation"></i> مخزون منخفض</span>';
      } else if (status === 'out_of_stock') {
        statusBadge = '<span class="stock-badge out-of-stock"><i class="fa-solid fa-circle-xmark"></i> نفذ المخزون</span>';
      }

      const imgUrl = productImageUrl(p);
      const modelCode = (p.name?.ar || p.name || '').replace('موديل ', '');

      html += `
        <div class="stock-card ${status}" data-id="${p.id}">
          <div class="stock-card-header">
            <img src="${imgUrl}" onerror="this.onerror=null; this.src='https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg';" alt="${p.name?.ar || ''}" class="stock-card-img" loading="lazy" decoding="async" />
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

            <div class="stock-status-row">
              <span class="stock-label">الظهور في المتجر:</span>
              <span class="stock-badge ${isAvailable ? 'in-stock' : 'out-of-stock'}">
                <i class="fa-solid ${isAvailable ? 'fa-store' : 'fa-eye-slash'}"></i>
                ${isAvailable ? 'متاح للطلب' : 'موقوف'}
              </span>
            </div>

            <div class="stock-qty-control-box" style="flex-direction: column; align-items: stretch; gap: 6px; text-align: center;">
              <span class="stock-label">الرصيد المباشر بمخزن الكراطين:</span>
              <div style="font-size: 1.4rem; font-weight: 900; color: var(--gold-primary, #c99332);">
                ${qty} <span style="font-size: 0.85rem; color: #94a3b8; font-weight: 600;">كرطون</span>
              </div>
            </div>

            ${canAdjustStock ? `<div style="margin-top: 4px;">
              <button type="button" class="btn btn-outline-gold btn-block btn-toggle-product-availability" data-id="${p.id}" data-next-availability="${isAvailable ? 'false' : 'true'}" style="font-weight: 800; font-size: 0.82rem; width: 100%; margin-bottom: 7px;">
                <i class="fa-solid ${isAvailable ? 'fa-eye-slash' : 'fa-store'}"></i>
                ${isAvailable ? 'إيقاف الموديل عن الطلب' : 'إتاحة الموديل للطلب'}
              </button>
              <button type="button" class="btn btn-gold btn-block btn-open-stock-entry" data-id="${p.id}" style="font-weight: 800; font-size: 0.88rem; width: 100%;">
                <i class="fa-solid fa-box-archive"></i> إدخال / تعديل شحنة المخزون
              </button>
            </div>` : ''}
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
    gridContainer.querySelectorAll('.btn-toggle-product-availability').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const button = e.currentTarget;
        const id = button.dataset.id;
        const nextAvailability = button.dataset.nextAvailability === 'true';
        const originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ الحفظ...';
        const saved = await Store.setProductAvailability(id, nextAvailability);
        if (!saved) {
          button.disabled = false;
          button.innerHTML = originalHtml;
          alert('تعذر حفظ حالة توفر الموديل في السحابة. تحقق من الاتصال ثم حاول مجددًا.');
          return;
        }
        renderStockDashboard();
      });
    });
  }

  // --- Entry Submodal Logic ---
  function getCurrentUserPermissions() {
    try {
      const uJson = sessionStorage.getItem('joulane_current_stock_user') || sessionStorage.getItem('joulane_current_user');
      if (uJson) {
        const u = JSON.parse(uJson);
        if (u) {
          if (u.id === 'usr_super_admin') {
            return { stockAdd: true, stockRemove: true, stockSet: true, stockViewLogs: true, stockClearLogs: true };
          }
          const p = u.permissions || {};
          return {
            stockAdd: p.stockAdd !== false,
            stockRemove: p.stockRemove === true,
            stockSet: p.stockSet === true,
            stockViewLogs: p.stockViewLogs !== false,
            stockClearLogs: p.stockClearLogs === true
          };
        }
      }
    } catch(e){}
    return { stockAdd: false, stockRemove: false, stockSet: false, stockViewLogs: false, stockClearLogs: false };
  }

  function openStockEntryModal(product) {
    if (activeStockBatch?.status === 'finalized') {
      openReceiptActions(createStockBatchReceipt(activeStockBatch));
      return;
    }
    activeProductForEntry = product;
    const perms = getCurrentUserPermissions();

    if (perms.stockAdd) {
      currentEntryMode = 'add';
    } else if (perms.stockRemove) {
      currentEntryMode = 'remove';
    } else if (perms.stockSet) {
      currentEntryMode = 'set';
    } else {
      alert('عذراً! حسابك لا يملك أي صلاحيات لإجراء تعديلات على المخزن.');
      return;
    }

    if (entryImg) entryImg.src = productImageUrl(product);
    if (entryCode) entryCode.textContent = 'كود: ' + (product.name?.ar || product.name || '').replace('موديل ', '');
    if (entryTitle) entryTitle.textContent = product.name?.ar || product.name || 'منتج';

    if (entryQtyInput) entryQtyInput.value = '1';

    let savedOperator = '';
    try {
      const uJson = sessionStorage.getItem('joulane_current_stock_user');
      if (uJson) {
        const u = JSON.parse(uJson);
        if (u && u.name) savedOperator = u.name;
      }
    } catch(e){}

    if (!savedOperator) savedOperator = 'مسؤول المخزن';
    if (entryOperatorInput) entryOperatorInput.value = savedOperator;
    if (entryNoteInput) entryNoteInput.value = '';
    if (entryCustomerInput) entryCustomerInput.value = '';
    if (entryOrderRefInput) entryOrderRefInput.value = '';
    if (entryOrderPicker) entryOrderPicker.value = '';

    updateModeButtons();
    updateEntryContext();
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
      updateEntryContext();
      updateLiveCalculation();
    });
  });

  function updateModeButtons() {
    const perms = getCurrentUserPermissions();
    modeButtons.forEach(b => {
      const mode = b.dataset.mode;
      let isAllowed = true;
      if (mode === 'add' && !perms.stockAdd) isAllowed = false;
      if (mode === 'remove' && !perms.stockRemove) isAllowed = false;
      if (mode === 'set' && !perms.stockSet) isAllowed = false;

      if (!isAllowed) {
        b.style.display = 'none';
        b.disabled = true;
      } else {
        b.style.display = 'flex';
        b.disabled = false;
      }

      if (mode === currentEntryMode && isAllowed) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  if (entryQtyInput) {
    entryQtyInput.addEventListener('input', updateLiveCalculation);
  }
  entryQtyDecBtn?.addEventListener('click', () => stepEntryQuantity(-1));
  entryQtyIncBtn?.addEventListener('click', () => stepEntryQuantity(1));
  entryReasonSelect?.addEventListener('change', updateEntryContextFields);
  entryOrderPicker?.addEventListener('change', applySelectedOrder);

  function stepEntryQuantity(direction) {
    if (!entryQtyInput) return;
    const minimum = currentEntryMode === 'set' ? 0 : 1;
    const current = parseInt(entryQtyInput.value, 10);
    entryQtyInput.value = String(Math.min(9999, Math.max(minimum, (Number.isFinite(current) ? current : minimum) + direction)));
    updateLiveCalculation();
  }

  function updateEntryContext() {
    if (!entryReasonSelect) return;
    const reasons = STOCK_REASONS[currentEntryMode] || STOCK_REASONS.add;
    entryReasonSelect.innerHTML = reasons.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

    if (entryQtyInput) {
      entryQtyInput.min = currentEntryMode === 'set' ? '0' : '1';
      if (currentEntryMode !== 'set' && parseInt(entryQtyInput.value, 10) < 1) entryQtyInput.value = '1';
    }
    if (entryQtyLabel) {
      entryQtyLabel.textContent = currentEntryMode === 'add'
        ? 'عدد الكراطين المستلمة'
        : currentEntryMode === 'remove'
          ? 'عدد الكراطين المصروفة'
          : 'الرصيد الفعلي بعد الجرد';
    }
    if (entryQtyHelp) {
      entryQtyHelp.textContent = currentEntryMode === 'set'
        ? 'اكتب العدد الموجود فعلياً في المخزن بعد انتهاء الجرد.'
        : 'يمكنك الكتابة مباشرة أو استخدام زري الإنقاص والإضافة.';
    }
    updateEntryContextFields();
  }

  function updateEntryContextFields() {
    const isCustomerOrder = currentEntryMode === 'remove' && entryReasonSelect?.value === 'customer_order';
    entryOrderPickerGroup?.classList.toggle('hidden', !isCustomerOrder);
    entryCustomerGroup?.classList.toggle('hidden', !isCustomerOrder);
    entryOrderRefGroup?.classList.toggle('hidden', !isCustomerOrder);
    if (entryCustomerInput) entryCustomerInput.required = isCustomerOrder;
    if (entryOrderRefInput) entryOrderRefInput.required = isCustomerOrder;
    if (isCustomerOrder) populateConfirmedOrderPicker();
  }

  function populateConfirmedOrderPicker() {
    if (!entryOrderPicker || !activeProductForEntry) return;
    const currentSelection = entryOrderPicker.value;
    entryOrderPicker.replaceChildren();
    const manualOption = document.createElement('option');
    manualOption.value = '';
    manualOption.textContent = 'إدخال بيانات الطلب يدوياً';
    entryOrderPicker.appendChild(manualOption);

    const eligibleOrders = Store.getOrders().filter(order => {
      const status = String(order.status || '').toLowerCase();
      return status === 'confirmed'
        && getOrderItemForProduct(order, activeProductForEntry)
        && !isDuplicateOrderMovement(order.id, activeProductForEntry.id);
    });

    eligibleOrders.forEach(order => {
      const item = getOrderItemForProduct(order, activeProductForEntry);
      const option = document.createElement('option');
      option.value = order.id;
      option.textContent = `#${order.id} - ${order.customerName || 'زبون'} - ${Number(item?.seriesQty) || 1} كرطون`;
      entryOrderPicker.appendChild(option);
    });

    if (eligibleOrders.some(order => order.id === currentSelection)) entryOrderPicker.value = currentSelection;
  }

  function applySelectedOrder() {
    if (!entryOrderPicker?.value) {
      if (entryCustomerInput) entryCustomerInput.value = '';
      if (entryOrderRefInput) entryOrderRefInput.value = '';
      return;
    }
    if (!activeProductForEntry) return;
    const order = Store.getOrders().find(item => item.id === entryOrderPicker.value);
    if (!order) return;
    const orderItem = getOrderItemForProduct(order, activeProductForEntry);
    if (entryCustomerInput) entryCustomerInput.value = order.customerName || '';
    if (entryOrderRefInput) entryOrderRefInput.value = order.id || '';
    if (entryQtyInput && orderItem) entryQtyInput.value = String(Math.max(1, Number(orderItem.seriesQty) || 1));
    updateLiveCalculation();
  }

  function getOrderItemForProduct(order, product) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const productName = String(product?.name?.ar || product?.name || '').trim().toLowerCase();
    const exactItem = items.find(item => String(item.productId || '') === String(product?.id || ''));
    if (exactItem) return exactItem;
    const legacyItem = items.find(item => String(item.nameAr || '').trim().toLowerCase() === productName);
    if (legacyItem) return legacyItem;
    if (!items.length && String(order?.productName || '').trim().toLowerCase() === productName) {
      return { seriesQty: parseInt(order.seriesQty, 10) || 1 };
    }
    return null;
  }

  function updateLiveCalculation() {
    if (!activeProductForEntry) return;
    const currentQty = getProductStock(activeProductForEntry);
    const amount = parseInt(entryQtyInput ? entryQtyInput.value : 0, 10) || 0;

    let finalQty = currentQty;
    let changeText = '0';

    if (currentEntryMode === 'add') {
      finalQty = currentQty + amount;
      changeText = '+' + amount;
      if (calcChange) calcChange.style.color = '#22c55e';
    } else if (currentEntryMode === 'remove') {
      finalQty = currentQty - amount;
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

      const perms = getCurrentUserPermissions();
      if (currentEntryMode === 'add' && !perms.stockAdd) {
        alert('عذراً! حسابك لا يملك صلاحية إضافة شحنات للمخزن.');
        return;
      }
      if (currentEntryMode === 'remove' && !perms.stockRemove) {
        alert('عذراً! حسابك لا يملك صلاحية سحب كراطين من المخزن.');
        return;
      }
      if (currentEntryMode === 'set' && !perms.stockSet) {
        alert('عذراً! حسابك لا يملك صلاحية التعديل المباشر لرصيد المخزن.');
        return;
      }

      const operator = entryOperatorInput ? entryOperatorInput.value.trim() : '';
      if (!operator) {
        alert('تعذر تحديد حساب العامل الحالي. أعد تسجيل الدخول إلى لوحة المخزن.');
        return;
      }

      const amount = parseInt(entryQtyInput ? entryQtyInput.value : 0, 10) || 0;
      if (amount <= 0 && currentEntryMode !== 'set') {
        alert('الرجاء إدخال عدد كراطين أكبر من صفر!');
        return;
      }

      const currentQty = getProductStock(activeProductForEntry);
      if (currentEntryMode === 'remove' && amount > currentQty) {
        alert(`لا يمكن صرف ${amount} كرطون. الرصيد المتوفر لهذا الموديل هو ${currentQty} فقط.`);
        entryQtyInput?.focus();
        return;
      }

      const reason = entryReasonSelect?.value || '';
      const customerName = entryCustomerInput?.value.trim() || '';
      const orderReference = normalizeOrderReference(entryOrderRefInput?.value || '');
      if (reason === 'customer_order' && (!customerName || !orderReference)) {
        alert('أدخل اسم الزبون أو المحل ومرجع الطلب حتى يكون الصرف قابلاً للتتبع.');
        (!customerName ? entryCustomerInput : entryOrderRefInput)?.focus();
        return;
      }
      if (reason === 'customer_order' && isDuplicateOrderMovement(orderReference, activeProductForEntry.id)) {
        alert(`تم تسجيل صرف سابق للطلب ${orderReference} على هذا الموديل. راجع سجل الحركات قبل إعادة الصرف.`);
        return;
      }

      // Populate Confirm Modal
      let finalQty = currentQty;
      let actionText = '';

      if (currentEntryMode === 'add') {
        finalQty = currentQty + amount;
        actionText = `+${amount} كرطون (${STOCK_REASON_LABELS[reason] || 'استلام بضاعة'})`;
      } else if (currentEntryMode === 'remove') {
        finalQty = currentQty - amount;
        actionText = `-${amount} كرطون (${STOCK_REASON_LABELS[reason] || 'صرف بضاعة'})`;
      } else if (currentEntryMode === 'set') {
        finalQty = Math.max(0, amount);
        actionText = `تثبيت الرصيد عند ${amount} كرطون (${STOCK_REASON_LABELS[reason] || 'تسوية جرد'})`;
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric' }) + ' - ' + now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

      if (confirmProdName) confirmProdName.textContent = activeProductForEntry.name?.ar || activeProductForEntry.name || 'منتج';
      if (confirmActionText) confirmActionText.textContent = actionText;
      if (confirmNewQty) confirmNewQty.textContent = finalQty + ' كرطون';
      if (confirmDate) confirmDate.textContent = dateStr;
      if (confirmOperator) confirmOperator.textContent = operator;
      const contextParts = [];
      if (customerName) contextParts.push(customerName);
      if (orderReference) contextParts.push(`#${orderReference}`);
      if (entryNoteInput?.value.trim()) contextParts.push(entryNoteInput.value.trim());
      if (confirmContext) confirmContext.textContent = contextParts.join(' - ');
      confirmContextRow?.classList.toggle('hidden', contextParts.length === 0);

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
    confirmSubmitBtn.addEventListener('click', async () => {
      if (!activeProductForEntry) return;

      const perms = getCurrentUserPermissions();
      if (currentEntryMode === 'add' && !perms.stockAdd) {
        alert('عذراً! حسابك لا يملك صلاحية إضافة شحنات للمخزن.');
        return;
      }
      if (currentEntryMode === 'remove' && !perms.stockRemove) {
        alert('عذراً! حسابك لا يملك صلاحية سحب كراطين من المخزن.');
        return;
      }
      if (currentEntryMode === 'set' && !perms.stockSet) {
        alert('عذراً! حسابك لا يملك صلاحية التعديل المباشر لرصيد المخزن.');
        return;
      }

      const currentQty = getProductStock(activeProductForEntry);
      const amount = parseInt(entryQtyInput ? entryQtyInput.value : 0, 10) || 0;
      const operator = entryOperatorInput ? entryOperatorInput.value.trim() : 'مسؤول المخزن';
      const note = entryNoteInput ? entryNoteInput.value.trim() : '';
      const reason = entryReasonSelect?.value || '';
      const customerName = entryCustomerInput?.value.trim() || '';
      const orderReference = normalizeOrderReference(entryOrderRefInput?.value || '');

      if (currentEntryMode === 'remove' && amount > currentQty) {
        alert('تغير الرصيد ولم تعد الكمية المطلوبة متوفرة. راجع الحركة من جديد.');
        confirmSubmodal?.classList.remove('active');
        entrySubmodal?.classList.add('active');
        updateLiveCalculation();
        return;
      }
      if (reason === 'customer_order' && isDuplicateOrderMovement(orderReference, activeProductForEntry.id)) {
        alert(`تم تسجيل صرف الطلب ${orderReference} مسبقاً لهذا الموديل.`);
        confirmSubmodal?.classList.remove('active');
        return;
      }

      let finalQty = currentQty;
      if (currentEntryMode === 'add') finalQty = currentQty + amount;
      else if (currentEntryMode === 'remove') finalQty = currentQty - amount;
      else if (currentEntryMode === 'set') finalQty = Math.max(0, amount);

      const newStatus = finalQty === 0 ? 'out_of_stock' : (finalQty <= 5 ? 'low_stock' : 'in_stock');

      const movement = {
        productId: activeProductForEntry.id,
        productName: activeProductForEntry.name?.ar || activeProductForEntry.name || 'منتج',
        productImg: productImageUrl(activeProductForEntry),
        type: currentEntryMode,
        amount: amount,
        oldQty: currentQty,
        newQty: finalQty,
        operator: operator,
        operatorId: getCurrentStockUser()?.id || '',
        reason,
        reasonLabel: STOCK_REASON_LABELS[reason] || '',
        customerName,
        orderReference,
        note,
        source: reason === 'customer_order' ? 'customer_order' : 'manual_stock'
      };

      confirmSubmitBtn.disabled = true;
      const originalButtonHtml = confirmSubmitBtn.innerHTML;
      confirmSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ الحفظ...';
      let savedMovement = null;
      try {
        savedMovement = await Store.recordStockMovement(activeProductForEntry.id, { seriesQty: finalQty, stockStatus: newStatus }, movement);
      } finally {
        confirmSubmitBtn.disabled = false;
        confirmSubmitBtn.innerHTML = originalButtonHtml;
      }

      if (!savedMovement) {
        alert('تعذر حفظ الحركة في التخزين السحابي. لم يتم اعتماد الحركة، تحقق من الاتصال ثم حاول مجدداً.');
        return;
      }

      if (savedMovement.approvalRequired) {
        confirmSubmodal?.classList.remove('active');
        activeProductForEntry = null;
        window.dispatchEvent(new CustomEvent('joulane:showToast', {
          detail: 'تم إرسال الحركة الكبيرة إلى المدير العام للموافقة عليها قبل التنفيذ.'
        }));
        window.dispatchEvent(new CustomEvent('joulane:stockProRefresh'));
        return;
      }

      if (confirmSubmodal) confirmSubmodal.classList.remove('active');
      activeProductForEntry = null;

      renderStockDashboard();
      renderStockLogs();
      renderStockInsights();

      if (refreshMainStoreFn) refreshMainStoreFn();
      if (savedMovement.queuedOffline) {
        window.dispatchEvent(new CustomEvent('joulane:showToast', {
          detail: 'تم حفظ الحركة على الجهاز وستتم مزامنتها تلقائياً عند عودة الإنترنت.'
        }));
      } else {
        addMovementToActiveBatch(savedMovement);
        window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: 'تم حفظ الموديل ضمن الشحنة الجارية.' }));
        showBatchDecision(savedMovement);
      }
    });
  }

  function getReceiptDistributionState(movement) {
    const recipients = (Store.getStockNotificationSettings().recipients || [])
      .filter(recipient => recipient?.name && receiptPhoneKey(recipient?.phone))
      .filter((recipient, index, list) => (
        list.findIndex(item => receiptPhoneKey(item.phone) === receiptPhoneKey(recipient.phone)) === index
      ));
    const reference = getStockReceiptReference(movement);
    const deliveries = Store.getStockReceiptDeliveries().filter(delivery => (
      delivery.receiptReference === reference
      && delivery.status === 'share_opened'
      && delivery.confirmedByUser === true
    ));
    const completedPhones = new Set(deliveries.map(delivery => receiptPhoneKey(delivery.recipientPhone)));
    const availablePhones = new Set(recipients.map(recipient => receiptPhoneKey(recipient.phone)));
    selectedReceiptRecipientPhones = new Set(
      [...selectedReceiptRecipientPhones].filter(phone => availablePhones.has(phone))
    );
    const selectedRecipients = recipients.filter(recipient => (
      selectedReceiptRecipientPhones.has(receiptPhoneKey(recipient.phone))
    ));
    return {
      recipients,
      selectedRecipients,
      deliveries,
      completedPhones,
      nextRecipient: selectedRecipients.find(recipient => (
        !completedPhones.has(receiptPhoneKey(recipient.phone))
      )) || null
    };
  }

  function persistReceiptRecipientSelection() {
    if (!activeMovementForReceipt) return;
    const selectedPhones = [...selectedReceiptRecipientPhones];
    activeMovementForReceipt.receiptRecipientPhones = selectedPhones;
    if (activeMovementForReceipt.isBatchReceipt && activeStockBatch?.id === activeMovementForReceipt.id) {
      activeStockBatch.receiptRecipientPhones = selectedPhones;
      activeStockBatch.updatedAt = new Date().toISOString();
      persistActiveStockBatch();
    }
  }

  function initializeReceiptRecipientSelection(movement) {
    const recipients = Store.getStockNotificationSettings().recipients || [];
    const availablePhones = recipients.map(recipient => receiptPhoneKey(recipient.phone)).filter(Boolean);
    const savedSelection = Array.isArray(movement?.receiptRecipientPhones)
      ? movement.receiptRecipientPhones.map(receiptPhoneKey)
      : null;
    selectedReceiptRecipientPhones = new Set(
      savedSelection
        ? savedSelection.filter(phone => availablePhones.includes(phone))
        : availablePhones
    );
    persistReceiptRecipientSelection();
  }

  function renderReceiptDistribution() {
    if (!activeMovementForReceipt || !receiptDistribution || !receiptRecipientsList) return;
    const state = getReceiptDistributionState(activeMovementForReceipt);
    const completedCount = state.selectedRecipients.filter(recipient => (
      state.completedPhones.has(receiptPhoneKey(recipient.phone))
    )).length;
    const selectedCount = state.selectedRecipients.length;

    receiptDistribution.classList.remove('hidden');
    if (receiptProgress) receiptProgress.textContent = `${completedCount} / ${selectedCount} تم`;
    if (selectAllReceiptRecipients) {
      selectAllReceiptRecipients.checked = state.recipients.length > 0 && selectedCount === state.recipients.length;
      selectAllReceiptRecipients.indeterminate = selectedCount > 0 && selectedCount < state.recipients.length;
      selectAllReceiptRecipients.disabled = state.recipients.length === 0 || !!pendingReceiptShareConfirmation;
    }

    if (state.recipients.length === 0) {
      receiptRecipientsList.innerHTML = `
        <div class="stock-receipt-empty-recipients">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>لم يحدد المدير العام قائمة مستلمي الوصل بعد.</span>
        </div>
      `;
      if (shareReceiptBtn) {
        shareReceiptBtn.disabled = true;
        shareReceiptBtn.innerHTML = '<i class="fa-brands fa-whatsapp"></i> المستلمون غير مضبوطين';
      }
      confirmReceiptSentBtn?.classList.add('hidden');
      if (closeReceiptBtn) closeReceiptBtn.disabled = false;
      return;
    }

    receiptRecipientsList.innerHTML = state.recipients.map(recipient => {
      const phoneKey = receiptPhoneKey(recipient.phone);
      const isSelected = selectedReceiptRecipientPhones.has(phoneKey);
      const delivery = state.deliveries.find(item => receiptPhoneKey(item.recipientPhone) === phoneKey);
      const isComplete = !!delivery;
      const isAwaitingConfirmation = !isComplete
        && receiptPhoneKey(pendingReceiptShareConfirmation?.recipient?.phone) === phoneKey;
      const isNext = isSelected && receiptPhoneKey(state.nextRecipient?.phone) === phoneKey;
      const statusText = isComplete
        ? `تم تأكيد الإرسال ${formatLogDate(delivery)}`
        : isAwaitingConfirmation
          ? 'بانتظار تأكيد الإرسال'
          : !isSelected
            ? 'غير محدد لهذه الدفعة'
            : isNext
              ? 'المستلم التالي'
              : 'ضمن قائمة الإرسال';
      return `
        <label class="stock-receipt-recipient ${isSelected ? 'is-selected' : ''} ${isComplete ? 'is-complete' : ''} ${isNext ? 'is-next' : ''}">
          <input
            type="checkbox"
            class="stock-receipt-recipient-checkbox"
            data-phone="${escapeHtml(phoneKey)}"
            ${isSelected ? 'checked' : ''}
            ${pendingReceiptShareConfirmation ? 'disabled' : ''}
          />
          <span class="stock-receipt-recipient-state"><i class="fa-solid ${isComplete ? 'fa-check' : isSelected ? 'fa-user-check' : 'fa-user'}"></i></span>
          <div class="stock-receipt-recipient-info">
            <strong>${escapeHtml(recipient.name || 'مستلم')}</strong>
            <span dir="ltr">+${escapeHtml(phoneKey)}</span>
          </div>
          <small>${escapeHtml(statusText)}</small>
        </label>
      `;
    }).join('');

    receiptRecipientsList.querySelectorAll('.stock-receipt-recipient-checkbox').forEach(input => {
      input.addEventListener('change', () => {
        const phone = receiptPhoneKey(input.dataset.phone);
        if (!phone || pendingReceiptShareConfirmation) return;
        if (input.checked) selectedReceiptRecipientPhones.add(phone);
        else selectedReceiptRecipientPhones.delete(phone);
        persistReceiptRecipientSelection();
        renderReceiptDistribution();
      });
    });

    const allComplete = selectedCount > 0 && completedCount === selectedCount;
    const awaitingConfirmation = !!pendingReceiptShareConfirmation;
    if (shareReceiptBtn) {
      shareReceiptBtn.disabled = allComplete || selectedCount === 0;
      shareReceiptBtn.innerHTML = selectedCount === 0
        ? '<i class="fa-solid fa-user-check"></i> اختر مستلماً واحداً على الأقل'
        : allComplete
        ? '<i class="fa-solid fa-circle-check"></i> اكتملت قائمة المشاركة'
        : awaitingConfirmation
          ? `<i class="fa-brands fa-whatsapp"></i> إعادة فتح المشاركة إلى ${escapeHtml(state.nextRecipient?.name || 'المستلم التالي')}`
          : `<i class="fa-brands fa-whatsapp"></i> إرسال إلى ${escapeHtml(state.nextRecipient?.name || 'المستلم التالي')} (${completedCount + 1} من ${selectedCount})`;
    }
    confirmReceiptSentBtn?.classList.toggle('hidden', !awaitingConfirmation || allComplete);
    if (closeReceiptBtn) closeReceiptBtn.disabled = state.recipients.length > 0 && !allComplete;
  }

  async function openReceiptActions(movement) {
    if (!movement || !receiptSubmodal) return;
    await Store.initSupabase(null, { force: true });
    activeMovementForReceipt = movement;
    pendingReceiptShareConfirmation = null;
    initializeReceiptRecipientSelection(movement);
    const isBatchReceipt = movement.isBatchReceipt && Array.isArray(movement.movements);
    if (receiptTitle) receiptTitle.textContent = isBatchReceipt ? 'تم تحديث المخزون وإنشاء الوصل المجمع' : 'وصل حركة المخزون';
    if (receiptDescription) {
      receiptDescription.textContent = isBatchReceipt
        ? 'تم جمع كل الموديلات التي أدخلتها في ملف PDF واحد منظم بالصور والتفاصيل.'
        : 'يمكنك تنزيل وصل هذه الحركة أو مشاركته مع المستلمين المعتمدين.';
    }
    receiptBatchSummary?.classList.toggle('hidden', !isBatchReceipt);
    if (isBatchReceipt) {
      const stats = getStockBatchStats(movement);
      if (receiptModelCount) receiptModelCount.textContent = stats.modelCount;
      if (receiptMovementCount) receiptMovementCount.textContent = stats.movementCount;
      if (receiptCartonCount) receiptCartonCount.textContent = stats.cartonCount;
    }
    if (receiptReference) receiptReference.textContent = getStockReceiptReference(movement);
    if (receiptStatus) receiptStatus.textContent = '';
    renderReceiptDistribution();
    receiptSubmodal.classList.add('active');
  }

  function closeReceiptActions() {
    const completedReceipt = activeMovementForReceipt;
    if (completedReceipt?.isBatchReceipt) {
      const state = getReceiptDistributionState(completedReceipt);
      if (state.recipients.length && (!state.selectedRecipients.length || state.nextRecipient)) return;
      activeStockBatch = null;
      persistActiveStockBatch();
      renderActiveStockBatchBar();
    }
    receiptSubmodal?.classList.remove('active');
    activeMovementForReceipt = null;
    pendingReceiptShareConfirmation = null;
    if (receiptStatus) receiptStatus.textContent = '';
  }

  closeReceiptBtn?.addEventListener('click', closeReceiptActions);
  selectAllReceiptRecipients?.addEventListener('change', () => {
    if (!activeMovementForReceipt || pendingReceiptShareConfirmation) return;
    const recipients = Store.getStockNotificationSettings().recipients || [];
    selectedReceiptRecipientPhones = selectAllReceiptRecipients.checked
      ? new Set(recipients.map(recipient => receiptPhoneKey(recipient.phone)).filter(Boolean))
      : new Set();
    persistReceiptRecipientSelection();
    renderReceiptDistribution();
  });

  async function shareToNextRecipient() {
    if (!activeMovementForReceipt) return;
    pendingReceiptShareConfirmation = null;
    const state = getReceiptDistributionState(activeMovementForReceipt);
    const recipient = state.nextRecipient;
    if (!recipient) return;
    const isNativeApp = !!(
      window.Capacitor
      && window.Capacitor.isNativePlatform
      && window.Capacitor.isNativePlatform()
    );
    const fallbackWindow = isNativeApp ? null : window.open('', '_blank');
    setReceiptBusy(true, `جارٍ تجهيز الوصل إلى ${recipient.name}...`);
    let shareOpened = false;
    try {
      const result = await shareStockReceipt(activeMovementForReceipt, fallbackWindow, recipient);
      shareOpened = true;
      const selectedApp = String(result.activityType || '').toLowerCase();
      if (selectedApp && !['com.whatsapp', 'com.whatsapp.w4b'].includes(selectedApp)) {
        if (receiptStatus) receiptStatus.textContent = 'لم يتم اختيار واتساب. أعد فتح المشاركة واختر واتساب ثم أرسل الوصل.';
        setReceiptBusy(false);
        return;
      }

      pendingReceiptShareConfirmation = { result, recipient };
      if (receiptStatus) {
        receiptStatus.textContent = result.method === 'whatsapp_link'
          ? `فُتحت محادثة ${recipient.name}. أرفق ملف PDF الذي تم تنزيله، ثم ارجع واضغط تأكيد الإرسال.`
          : `بعد إرسال ملف PDF إلى ${recipient.name} داخل واتساب، اضغط زر تأكيد الإرسال.`;
      }
      setReceiptBusy(false);
      return;
    } catch (error) {
      if (!shareOpened && fallbackWindow && !fallbackWindow.closed) fallbackWindow.close();
      if (receiptStatus) {
        if (error?.name === 'AbortError') {
          receiptStatus.textContent = 'تم إلغاء المشاركة. لم تُحسب لهذا المستلم. اضغط الزر لإعادة المحاولة.';
        } else if (shareOpened) {
          receiptStatus.textContent = 'فُتحت المشاركة، لكن تعذر تسجيلها سحابياً. تحقق من الاتصال ثم أعد المحاولة.';
        } else {
          receiptStatus.textContent = 'تعذرت المشاركة. جرّب مرة أخرى من الهاتف.';
        }
      }
      setReceiptBusy(false);
      return;
    }
  }

  shareReceiptBtn?.addEventListener('click', () => shareToNextRecipient());

  confirmReceiptSentBtn?.addEventListener('click', async () => {
    if (!activeMovementForReceipt || !pendingReceiptShareConfirmation) return;
    const { result, recipient } = pendingReceiptShareConfirmation;
    const state = getReceiptDistributionState(activeMovementForReceipt);
    if (receiptPhoneKey(state.nextRecipient?.phone) !== receiptPhoneKey(recipient.phone)) {
      pendingReceiptShareConfirmation = null;
      renderReceiptDistribution();
      if (receiptStatus) receiptStatus.textContent = 'تغيّرت قائمة المستلمين. افتح المشاركة للمستلم التالي من جديد.';
      return;
    }

    const movementIds = activeMovementForReceipt.isBatchReceipt
      ? activeMovementForReceipt.movements.map(movement => movement.id).filter(Boolean)
      : [activeMovementForReceipt.id].filter(Boolean);
    setReceiptBusy(true, `جارٍ تسجيل تأكيد الإرسال إلى ${recipient.name}...`);
    let marked = false;
    try {
      marked = await Store.markStockReceiptDelivery({
        movementId: movementIds[0] || '',
        movementIds,
        batchId: activeMovementForReceipt.isBatchReceipt ? activeMovementForReceipt.id : '',
        receiptReference: result.reference,
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientPhone: recipient.phone,
        shareMethod: result.method,
        shareActivityType: result.activityType || '',
        confirmedByUser: true,
        confirmedAt: new Date().toISOString()
      });
    } catch (error) {
      marked = false;
    }
    if (!marked) {
      if (receiptStatus) receiptStatus.textContent = 'تعذر حفظ التأكيد سحابياً. تحقق من الاتصال ثم اضغط تأكيد مرة أخرى.';
      setReceiptBusy(false);
      return;
    }

    pendingReceiptShareConfirmation = null;
    setReceiptBusy(false);
    const updatedState = getReceiptDistributionState(activeMovementForReceipt);
    if (receiptStatus) {
      receiptStatus.textContent = updatedState.nextRecipient
        ? `تم تأكيد الإرسال إلى ${recipient.name}. اضغط مشاركة لإرسال الوصل إلى ${updatedState.nextRecipient.name}.`
        : 'اكتملت مشاركة الوصل لجميع المستلمين بعد تأكيد الإرسال.';
    }
  });

  downloadReceiptBtn?.addEventListener('click', async () => {
    if (!activeMovementForReceipt) return;
    setReceiptBusy(true, 'جارٍ تجهيز ملف PDF...');
    try {
      await downloadStockReceipt(activeMovementForReceipt);
      if (receiptStatus) receiptStatus.textContent = 'تم تنزيل الوصل بنجاح.';
    } catch (error) {
      if (receiptStatus) receiptStatus.textContent = 'تعذر إنشاء الوصل. حاول مرة أخرى.';
    } finally {
      setReceiptBusy(false);
    }
  });

  function setReceiptBusy(isBusy, message = '') {
    [shareReceiptBtn, confirmReceiptSentBtn, downloadReceiptBtn, closeReceiptBtn].forEach(button => {
      if (button) button.disabled = isBusy;
    });
    if (receiptStatus && message) receiptStatus.textContent = message;
    if (!isBusy) renderReceiptDistribution();
  }

  window.addEventListener('joulane:stockNotificationSettingsUpdated', renderReceiptDistribution);
  window.addEventListener('joulane:stockReceiptDeliveriesUpdated', renderReceiptDistribution);

  function getCurrentStockUser() {
    try {
      return JSON.parse(sessionStorage.getItem('joulane_current_stock_user') || 'null');
    } catch (error) {
      return null;
    }
  }

  function getProductStock(product) {
    if (typeof product?.seriesQty === 'number') return product.seriesQty;
    if (typeof product?.stockQty === 'number') return product.stockQty;
    return 0;
  }

  function normalizeOrderReference(value) {
    return value.trim().replace(/^#/, '').toUpperCase();
  }

  function isDuplicateOrderMovement(orderReference, productId) {
    if (!orderReference) return false;
    return Store.getStockLogs().some(log =>
      log.type === 'remove' &&
      normalizeOrderReference(log.orderReference || '') === orderReference &&
      String(log.productId || '') === String(productId || '')
    );
  }

  // --- Render Stock History Logs (Tab 2) ---
  function renderStockLogs() {
    const perms = getCurrentUserPermissions();
    if (!perms.stockViewLogs) {
      if (logsListContainer) logsListContainer.innerHTML = '';
      return;
    }
    if (clearLogsBtn) {
      clearLogsBtn.style.display = 'none';
    }
    const logs = Store.getStockLogs();
    const activeBatchMovementIds = new Set((activeStockBatch?.movements || []).map(movement => String(movement.id || '')));
    const query = logsSearchInput ? logsSearchInput.value.trim().toLowerCase() : '';
    const typeFilter = logsTypeFilter?.value || 'all';
    const periodFilter = logsPeriodFilter?.value || 'all';

    const countBadge = document.getElementById('stock-logs-badge-count');
    if (countBadge) countBadge.textContent = logs.length;

    const filteredLogs = logs.filter(log => {
      const matchesType = typeFilter === 'all'
        || log.type === typeFilter
        || (typeFilter === 'customer_order' && log.reason === 'customer_order');
      if (!matchesType || !isLogWithinPeriod(log, periodFilter)) return false;
      if (!query) return true;
      const searchable = [
        log.productName,
        log.operator,
        log.note,
        log.customerName,
        log.orderReference,
        log.reasonLabel,
        STOCK_REASON_LABELS[log.reason]
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(query);
    });

    if (!logsListContainer) return;

    if (filteredLogs.length === 0) {
      logsListContainer.innerHTML = `
        <div class="stock-empty-state">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <p>لا توجد حركات تطابق البحث أو الفلاتر الحالية.</p>
        </div>
      `;
      return;
    }

    let html = '';
    filteredLogs.forEach(log => {
      const belongsToActiveBatch = activeBatchMovementIds.has(String(log.id || ''));
      let badgeClass = 'log-badge-add';
      let badgeText = `+${log.amount} كرطون`;
      if (log.type === 'remove') {
        badgeClass = 'log-badge-remove';
        badgeText = `-${log.amount} كرطون`;
      } else if (log.type === 'set') {
        badgeClass = 'log-badge-set';
        badgeText = `جرد: ${log.newQty}`;
      }

      const reasonLabel = log.reasonLabel || STOCK_REASON_LABELS[log.reason] || legacyReasonLabel(log.type);
      const customerLine = log.reason === 'customer_order' || log.customerName
        ? `<div class="stock-log-order"><i class="fa-solid fa-receipt"></i><span>صرف للزبون <strong>${escapeHtml(log.customerName || 'غير محدد')}</strong>${log.orderReference ? ` ضمن الطلب <strong>#${escapeHtml(normalizeOrderReference(log.orderReference))}</strong>` : ''}</span></div>`
        : '';

      html += `
        <div class="stock-log-card">
          <div class="log-main-info">
            <img src="${safeImageUrl(log.productImg)}" onerror="this.onerror=null; this.src='https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg';" alt="${escapeHtml(log.productName || 'منتج')}" class="log-img" loading="lazy" decoding="async" />
            <div class="log-details">
              <div class="stock-log-title-row">
                <span class="log-title">${escapeHtml(log.productName || 'منتج')}</span>
                <span class="stock-log-reason">${escapeHtml(reasonLabel)}</span>
              </div>
              ${customerLine}
              <div class="log-meta">
                <span><i class="fa-solid fa-clock"></i> ${escapeHtml(formatLogDate(log))}</span>
                <span><i class="fa-solid fa-user-gear"></i> سجّلها <strong>${escapeHtml(log.operator || 'غير محدد')}</strong></span>
                ${log.note ? `<span><i class="fa-solid fa-note-sticky"></i> ${escapeHtml(log.note)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="stock-log-balance">
            <div>
              <span>الرصيد: ${Number(log.oldQty) || 0} ← ${Number(log.newQty) || 0}</span>
              <div class="stock-log-receipt-actions">
                <span class="${badgeClass}">${badgeText}</span>
                <button type="button" class="btn-stock-log-receipt ${belongsToActiveBatch ? 'is-batch-movement' : ''}" data-log-id="${escapeHtml(log.id || '')}" title="${belongsToActiveBatch ? 'هذه الحركة ضمن الوصل المجمع' : 'إنشاء ومشاركة الوصل'}" aria-label="${belongsToActiveBatch ? 'فتح الوصل المجمع لهذه الشحنة' : 'إنشاء ومشاركة وصل هذه الحركة'}">
                  <i class="fa-solid ${belongsToActiveBatch ? 'fa-layer-group' : 'fa-file-arrow-down'}"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    logsListContainer.innerHTML = html;
    logsListContainer.querySelectorAll('.btn-stock-log-receipt').forEach(button => {
      button.addEventListener('click', () => {
        const movement = logs.find(log => String(log.id || '') === button.dataset.logId);
        if (!movement) return;
        if (activeBatchMovementIds.has(String(movement.id || ''))) {
          if (activeStockBatch?.status === 'finalized') openReceiptActions(createStockBatchReceipt(activeStockBatch));
          else showBatchDecision(activeStockBatch?.movements?.at(-1) || movement);
          return;
        }
        openReceiptActions(movement);
      });
    });
  }

  function renderStockInsights() {
    if (!getCurrentUserPermissions().stockViewLogs) return;
    let logs = Store.getStockLogs();

    // Filter by reset date
    const resetDateStr = localStorage.getItem('joulane_stock_insights_reset_date');
    if (resetDateStr) {
      const resetDate = new Date(resetDateStr);
      logs = logs.filter(log => {
        const ts = getLogTimestamp(log);
        return ts && ts >= resetDate;
      });
    }

    const products = Store.getProducts();
    const last30 = logs.filter(log => isLogWithinPeriod(log, '30'));
    const todayLogs = logs.filter(log => isLogWithinPeriod(log, 'today'));
    const totals = last30.reduce((result, log) => {
      const delta = getLogDelta(log);
      if (delta > 0) result.inbound += delta;
      if (delta < 0) result.outbound += Math.abs(delta);
      return result;
    }, { inbound: 0, outbound: 0 });

    setText('stock-stat-inbound-30', totals.inbound);
    setText('stock-stat-outbound-30', totals.outbound);
    setText('stock-stat-today-moves', todayLogs.length);
    setText('stock-stat-net-30', `${totals.inbound - totals.outbound > 0 ? '+' : ''}${totals.inbound - totals.outbound}`);

    renderWeeklyChart(logs);
    renderStockAlerts(products);
    renderTopMovingModels(last30);
  }

  function renderWeeklyChart(logs) {
    const chart = document.getElementById('stock-weekly-chart');
    if (!chart) return;
    const days = [];
    const today = startOfDay(new Date());
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      const dayLogs = logs.filter(log => {
        const timestamp = getLogTimestamp(log);
        return timestamp && timestamp >= date && timestamp < nextDate;
      });
      const movement = dayLogs.reduce((result, log) => {
        const delta = getLogDelta(log);
        if (delta > 0) result.inbound += delta;
        if (delta < 0) result.outbound += Math.abs(delta);
        return result;
      }, { inbound: 0, outbound: 0 });
      days.push({ date, ...movement });
    }
    const maximum = Math.max(1, ...days.flatMap(day => [day.inbound, day.outbound]));
    chart.innerHTML = days.map(day => `
      <div class="stock-chart-day">
        <div class="stock-chart-values">
          <span>${day.inbound}</span>
          <span>${day.outbound}</span>
        </div>
        <div class="stock-chart-bars">
          <i class="inbound" style="height:${Math.max(day.inbound ? 8 : 2, (day.inbound / maximum) * 100)}%"></i>
          <i class="outbound" style="height:${Math.max(day.outbound ? 8 : 2, (day.outbound / maximum) * 100)}%"></i>
        </div>
        <span class="stock-chart-label">${day.date.toLocaleDateString('ar-DZ', { weekday: 'short' })}</span>
      </div>
    `).join('');
  }

  function renderStockAlerts(products) {
    const container = document.getElementById('stock-alerts-list');
    if (!container) return;
    const alerts = products
      .map(product => ({ product, quantity: getProductStock(product) }))
      .filter(item => item.quantity <= 5)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 6);
    if (!alerts.length) {
      container.innerHTML = '<div class="stock-insight-empty"><i class="fa-solid fa-circle-check"></i><span>لا توجد موديلات منخفضة المخزون حالياً.</span></div>';
      return;
    }
    container.innerHTML = alerts.map(({ product, quantity }) => `
      <div class="stock-alert-row">
        <img src="${safeImageUrl(productImageUrl(product))}" alt="${escapeHtml(product.name?.ar || product.name || 'منتج')}" />
        <div><strong>${escapeHtml(product.name?.ar || product.name || 'منتج')}</strong><span>${quantity === 0 ? 'نفد المخزون' : 'قريب من النفاد'}</span></div>
        <b class="${quantity === 0 ? 'out' : 'low'}">${quantity} كرطون</b>
      </div>
    `).join('');
  }

  function renderTopMovingModels(logs) {
    const container = document.getElementById('stock-top-models');
    if (!container) return;
    const totals = new Map();
    logs.forEach(log => {
      const key = log.productId || log.productName || 'unknown';
      const existing = totals.get(key) || { name: log.productName || 'منتج', amount: 0 };
      existing.amount += Math.abs(getLogDelta(log));
      totals.set(key, existing);
    });
    const top = [...totals.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
    if (!top.length) {
      container.innerHTML = '<div class="stock-insight-empty"><i class="fa-solid fa-chart-simple"></i><span>ستظهر النتائج بعد تسجيل حركات المخزون.</span></div>';
      return;
    }
    const maximum = Math.max(...top.map(item => item.amount), 1);
    container.innerHTML = top.map((item, index) => `
      <div class="stock-top-model-row">
        <span class="stock-top-rank">${index + 1}</span>
        <div class="stock-top-model-data">
          <div><strong>${escapeHtml(item.name)}</strong><span>${item.amount} كرطون</span></div>
          <i><b style="width:${(item.amount / maximum) * 100}%"></b></i>
        </div>
      </div>
    `).join('');
  }

  function getLogDelta(log) {
    const oldQty = Number(log.oldQty);
    const newQty = Number(log.newQty);
    if (Number.isFinite(oldQty) && Number.isFinite(newQty)) return newQty - oldQty;
    const amount = Number(log.amount) || 0;
    return log.type === 'remove' ? -amount : log.type === 'add' ? amount : 0;
  }

  function getLogTimestamp(log) {
    if (!log?.timestamp) return null;
    const date = new Date(log.timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isLogWithinPeriod(log, period) {
    if (period === 'all') return true;
    const timestamp = getLogTimestamp(log);
    if (!timestamp) return false;
    const now = new Date();
    const boundary = period === 'today' ? startOfDay(now) : new Date(now.getTime() - Number(period) * 86400000);
    return timestamp >= boundary;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function formatLogDate(log) {
    const timestamp = getLogTimestamp(log);
    if (!timestamp) return log.dateFormatted || '';
    return timestamp.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short', year: 'numeric' }) + ' - ' + timestamp.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
  }

  function legacyReasonLabel(type) {
    if (type === 'add') return 'استلام بضاعة';
    if (type === 'remove') return 'صرف بضاعة';
    return 'تسوية جرد';
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function safeImageUrl(value) {
    const url = String(value || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg');
    if (/^https:\/\//i.test(url) || /^data:image\//i.test(url)) return escapeHtml(url);
    return 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg';
  }

  function getCategoryName(catId) {
    const categories = Store.getCategories();
    const found = categories.find(c => c.id === catId);
    return found ? found.nameAr : 'قسم عام';
  }

  function productImageUrl(p) {
    const rawImg = p?.image || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg';
    if (rawImg.startsWith('http://') || rawImg.startsWith('https://') || rawImg.startsWith('data:')) return rawImg;
    return 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg';
  }
}
