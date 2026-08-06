import { Store } from './store.js';
import { WILAYAS } from './data/wilayas.js';
import { PRODUCT_COLOR_OPTIONS, inferProductColorKeys } from './data/productColors.js';

let isAdminLoggedIn = false;
let selectedProductImages = [];
let selectedProductColorKeys = [];
const SHOE_SIZES = Object.freeze([36, 37, 38, 39, 40, 41]);
let selectedProductSizes = [...SHOE_SIZES];
let selectedProductBadge = null;

const PRODUCT_BADGE_OPTIONS = [
  { ar: 'جديد', fr: 'Nouveau' },
  { ar: 'الأكثر طلبًا', fr: 'Meilleure vente' },
  { ar: 'وصل حديثًا', fr: 'Nouvel arrivage' },
  { ar: 'اختيار مميز', fr: 'Coup de cœur' },
  { ar: 'عرض خاص', fr: 'Offre spéciale' },
  { ar: 'كمية محدودة', fr: 'Stock limité' },
  { ar: 'حصري', fr: 'Exclusivité' },
  { ar: 'تخفيض', fr: 'Promotion' },
  { ar: 'بدون شارة', fr: 'Sans badge' }
];

const ADMIN_TAB_PERMISSIONS = {
  overview: 'adminOverview',
  products: 'adminProducts',
  categories: 'adminProducts',
  cms: 'adminContent',
  orders: 'adminOrders',
  shipping: 'adminShipping',
  users: 'adminUsers',
  settings: 'adminSettings'
};

function getCurrentAdminUser() {
  try {
    return JSON.parse(sessionStorage.getItem('joulane_current_user') || 'null');
  } catch (_) {
    return null;
  }
}

function hasAdminPermission(permission) {
  const user = getCurrentAdminUser();
  if (!user || !user.allowAdmin) return false;
  if (user.id === 'usr_super_admin') return true;
  return user.permissions?.[permission] === true;
}

function requireAdminPermission(permission, message) {
  if (hasAdminPermission(permission)) return true;
  window.dispatchEvent(new CustomEvent('joulane:showToast', {
    detail: message || 'حسابك لا يملك صلاحية تنفيذ هذه العملية.'
  }));
  return false;
}

const ORDER_STATUS_META = {
  New: { label: 'جديد', icon: 'fa-sparkles' },
  Confirmed: { label: 'مؤكد', icon: 'fa-circle-check' },
  Shipped: { label: 'تم الشحن', icon: 'fa-truck-fast' },
  Delivered: { label: 'مكتمل', icon: 'fa-box-circle-check' },
  Cancelled: { label: 'ملغى', icon: 'fa-ban' }
};

function escapeAdminHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function adminNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAdminDzd(value) {
  return `${Math.max(0, adminNumber(value)).toLocaleString('ar-DZ')} دج`;
}

function normalizeOrderStatus(status) {
  const aliases = {
    new: 'New', 'جديد': 'New', 'جديدة': 'New',
    confirmed: 'Confirmed', 'مؤكد': 'Confirmed', 'مؤكدة': 'Confirmed',
    shipped: 'Shipped', 'تم الشحن': 'Shipped',
    delivered: 'Delivered', 'مكتمل': 'Delivered', 'مكتملة': 'Delivered',
    cancelled: 'Cancelled', canceled: 'Cancelled', 'ملغى': 'Cancelled', 'ملغاة': 'Cancelled'
  };
  return aliases[String(status || 'New').trim().toLowerCase()] || 'New';
}

function orderStatusMeta(status) {
  const normalized = normalizeOrderStatus(status);
  return { key: normalized, ...ORDER_STATUS_META[normalized] };
}

function orderItemsSnapshot(order) {
  if (Array.isArray(order?.items) && order.items.length) {
    return order.items.map((item, index) => ({
      ...item,
      productId: item.productId || `legacy-${index}`,
      nameAr: item.nameAr || item.nameFr || item.name || 'منتج',
      nameFr: item.nameFr || item.nameAr || item.name || 'Produit',
      color: item.color || (Array.isArray(item.colors) ? item.colors.join(' + ') : 'افتراضي'),
      seriesQty: Math.max(1, parseInt(item.seriesQty, 10) || 1),
      pairsCount: Math.max(0, parseInt(item.pairsCount, 10) || 0),
      price: Math.max(0, adminNumber(item.price))
    }));
  }

  return [{
    productId: 'legacy-product',
    nameAr: order?.productName || 'منتج',
    nameFr: order?.productName || 'Produit',
    color: order?.color || 'افتراضي',
    seriesQty: Math.max(1, parseInt(order?.seriesQty, 10) || 1),
    pairsCount: 0,
    price: Math.max(0, adminNumber(order?.productPrice || order?.totalAmount) - adminNumber(order?.shippingFee))
  }];
}

function orderCartonCount(order) {
  return orderItemsSnapshot(order).reduce((sum, item) => sum + item.seriesQty, 0);
}

function orderDateValue(order) {
  const direct = Date.parse(order?.createdAt || order?.updatedAt || '');
  if (Number.isFinite(direct)) return direct;
  const normalized = String(order?.timestamp || '')
    .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    .replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))
    .replace(/[\u200e\u200f]/g, '')
    .trim();
  const legacy = Date.parse(normalized);
  return Number.isFinite(legacy) ? legacy : 0;
}

function calculateOrderMetrics(orders) {
  const normalized = orders.map(order => ({ ...order, status: normalizeOrderStatus(order.status) }));
  const delivered = normalized.filter(order => order.status === 'Delivered');
  const cancelled = normalized.filter(order => order.status === 'Cancelled');
  const active = normalized.filter(order => !['Delivered', 'Cancelled'].includes(order.status));
  const newOrders = normalized.filter(order => order.status === 'New');
  const inProgress = normalized.filter(order => ['Confirmed', 'Shipped'].includes(order.status));
  const completedRevenue = delivered.reduce((sum, order) => sum + adminNumber(order.totalAmount), 0);
  const activeValue = active.reduce((sum, order) => sum + adminNumber(order.totalAmount), 0);
  const averageOrder = delivered.length ? completedRevenue / delivered.length : (normalized.length
    ? normalized.reduce((sum, order) => sum + adminNumber(order.totalAmount), 0) / normalized.length
    : 0);
  const resolvedCount = delivered.length + cancelled.length;
  const completionRate = resolvedCount ? Math.round((delivered.length / resolvedCount) * 100) : 0;

  const wilayaTotals = new Map();
  const productTotals = new Map();
  (delivered.length ? delivered : normalized.filter(order => order.status !== 'Cancelled')).forEach(order => {
    const wilaya = String(order.wilaya || 'غير محدد').trim();
    wilayaTotals.set(wilaya, (wilayaTotals.get(wilaya) || 0) + 1);
    orderItemsSnapshot(order).forEach(item => {
      const key = String(item.nameAr || item.nameFr || 'منتج').trim();
      productTotals.set(key, (productTotals.get(key) || 0) + item.seriesQty);
    });
  });

  const topEntry = map => Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0] || ['لا توجد بيانات', 0];
  const [topWilaya, topWilayaCount] = topEntry(wilayaTotals);
  const [topProduct, topProductCartons] = topEntry(productTotals);

  return {
    total: normalized.length,
    delivered: delivered.length,
    cancelled: cancelled.length,
    active: active.length,
    newCount: newOrders.length,
    inProgress: inProgress.length,
    completedRevenue,
    activeValue,
    averageOrder,
    completionRate,
    topWilaya,
    topWilayaCount,
    topProduct,
    topProductCartons
  };
}

function notifyAdmin(message) {
  window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: message }));
}

function enhanceAdminTables(root) {
  if (!root) return;

  root.querySelectorAll('table').forEach(table => {
    const headers = Array.from(table.querySelectorAll('thead th'))
      .map(header => header.textContent.trim());

    if (!headers.length) return;

    table.classList.add('admin-mobile-card-table');
    table.querySelectorAll('tbody tr').forEach(row => {
      const cells = Array.from(row.children).filter(cell => cell.tagName === 'TD');
      cells.forEach((cell, index) => {
        if (cell.colSpan > 1) {
          cell.classList.add('admin-table-empty-cell');
          return;
        }
        cell.dataset.label = headers[index] || '';
      });
    });
  });
}

export async function uploadToCloudinary(file) {
  try {
    const signatureResponse = await fetch('/api/cloudinary-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (!signatureResponse.ok) throw new Error('Cloudinary signature is unavailable');

    const { cloudName, apiKey, timestamp, folder, signature } = await signatureResponse.json();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('folder', folder);
    formData.append('signature', signature);
    
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      if (data.secure_url) {
        return data.secure_url;
      }
    }
  } catch (err) {
    console.warn('Direct Cloudinary REST upload failed, using DataURL fallback', err);
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

export function initAdmin(refreshMainStoreFn) {
  const adminModal = document.getElementById('admin-modal');
  const loginSec = document.getElementById('admin-login-sec');
  const contentSec = document.getElementById('admin-content-sec');
  const passInput = document.getElementById('admin-pass-input');
  const loginForm = document.getElementById('admin-login-form');
  const adminPanelBtn = document.getElementById('admin-panel-btn');
  const closeAdminBtn = document.getElementById('close-admin-modal');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const installApkBtn = document.getElementById('admin-install-apk-btn');
  const mobileTabSelect = document.getElementById('admin-mobile-tab-select');
  document.getElementById('tab-inventory')?.remove();

  const tableObserver = new MutationObserver(() => {
    window.requestAnimationFrame(() => enhanceAdminTables(adminModal));
  });
  tableObserver.observe(adminModal, { childList: true, subtree: true });
  enhanceAdminTables(adminModal);

  // URL Hash Check (#admin)
  if (window.location.hash === '#admin') {
    openAdminModal();
  }
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#admin') {
      openAdminModal();
    }
  });

  if (adminPanelBtn) {
    adminPanelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openAdminModal();
    });
  }

  if (closeAdminBtn) {
    closeAdminBtn.addEventListener('click', () => {
      adminModal.classList.remove('active');
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const orderEditor = document.getElementById('order-editor-modal');
    if (orderEditor?.classList.contains('active')) {
      event.preventDefault();
      closeOrderEditor();
      return;
    }
    const nestedModalOpen = adminModal?.querySelector('.modal-overlay.active');
    if (adminModal?.classList.contains('active') && !nestedModalOpen) {
      adminModal.classList.remove('active');
      adminPanelBtn?.focus();
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      isAdminLoggedIn = false;
      sessionStorage.removeItem('joulane_admin_auth');
      sessionStorage.removeItem('joulane_current_user');
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
        // Redirect to dedicated admin.html page for PWA install
        window.location.href = '/admin.html';
      }
    });
  }

  function openAdminModal() {
    adminModal.classList.add('active');
    if ((sessionStorage.getItem('joulane_admin_auth') === 'true' || isAdminLoggedIn) && Store.hasSecureSession('admin')) {
      showDashboard();
    } else {
      showLoginScreen();
    }
  }

  function populateAdminUsersSelect() {
    const select = document.getElementById('admin-user-select');
    if (!select) return;
    const users = Store.getUsers();
    let html = '<option value="all">-- اختر حسابك أو أدخل كودك مباشرة --</option>';
    users.forEach(u => {
      if (u.allowAdmin || u.id === 'usr_super_admin') {
        html += `<option value="${u.id}">${u.name} (${u.role || 'مسؤول'})</option>`;
      }
    });
    select.innerHTML = html;
  }

  function showLoginScreen() {
    loginSec.classList.remove('hidden');
    contentSec.classList.add('hidden');
    populateAdminUsersSelect();
    if (passInput) {
      passInput.value = '';
      setTimeout(() => passInput.focus(), 100);
    }
  }

  function enforceAdminUserPermissions() {
    Object.entries(ADMIN_TAB_PERMISSIONS).forEach(([tab, permission]) => {
      const allowed = hasAdminPermission(permission);
      const tabButton = document.querySelector(`.admin-tab-btn[data-tab="${tab}"]`);
      const tabOption = mobileTabSelect?.querySelector(`option[value="${tab}"]`);
      if (tabButton) tabButton.hidden = !allowed;
      if (tabOption) tabOption.hidden = !allowed;
    });

    const firstAllowedTab = Array.from(document.querySelectorAll('.admin-tab-btn'))
      .find(button => !button.hidden);
    const activeTab = document.querySelector('.admin-tab-btn.active');
    if (activeTab?.hidden && firstAllowedTab) firstAllowedTab.click();
  }

  function showDashboard() {
    isAdminLoggedIn = true;
    sessionStorage.setItem('joulane_admin_auth', 'true');
    loginSec.classList.add('hidden');
    contentSec.classList.remove('hidden');
    enforceAdminUserPermissions();
    populateCategoryDropdowns();
    if (hasAdminPermission('adminOverview')) renderOverviewTab();
    if (hasAdminPermission('adminProducts')) {
      renderProductsTab();
      renderCategoriesTab();
    }
    if (hasAdminPermission('adminContent')) populateCmsForm();
    if (hasAdminPermission('adminOrders')) renderOrdersTab();
    if (hasAdminPermission('adminShipping')) renderShippingTab();
    setupPriceToggleButtons(refreshMainStoreFn);
    setupSupabaseConfigForm(refreshMainStoreFn);
    setupStockReceiptRecipientsForm();
    setupUsersTab();
  }

  // Handle Login Submit
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedUserId = document.getElementById('admin-user-select')?.value || 'all';
      const enteredPass = passInput.value.trim();
      const user = await Store.authenticateUser(selectedUserId, enteredPass, 'admin');

      if (user) {
        if (user.allowAdmin || user.id === 'usr_super_admin') {
          sessionStorage.setItem('joulane_current_user', JSON.stringify(user));
          Store.restrictProtectedData(user, 'admin');
          await Store.initSupabase(refreshMainStoreFn, { force: true });
          showDashboard();
          window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: `مرحباً بك يا ${user.name}!` }));
        } else {
          alert(`عذراً يا ${user.name}! هذا الحساب مخصص لـ (لوحة المخزن #stock) فقط ولا يملك صلاحية الدخول للوحة التحكم الرئيسية.`);
          if (passInput) passInput.select();
        }
      } else {
        alert('اسم المستخدم أو كلمة المرور غير صحيحة! يرجى اختيار حسابك وإدخال الرمز الصحيح.');
        if (passInput) passInput.select();
      }
    });
  }

  window.addEventListener('joulane:usersUpdated', () => populateAdminUsersSelect());
  window.addEventListener('joulane:ordersUpdated', () => {
    if (!isAdminLoggedIn || !hasAdminPermission('adminOrders')) return;
    renderOverviewTab();
    if (document.getElementById('tab-orders')?.classList.contains('active')) renderOrdersTab();
  });
  window.addEventListener('joulane:orderSyncResult', event => {
    if (!isAdminLoggedIn || !hasAdminPermission('adminOrders')) return;
    notifyOrderMutationResult(event.detail);
  });

  // Tabs Navigation
  const tabBtns = document.querySelectorAll('.admin-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.dataset.tab;
      const requiredPermission = ADMIN_TAB_PERMISSIONS[tabTarget];
      if (requiredPermission && !requireAdminPermission(requiredPermission)) return;

      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      if (mobileTabSelect) mobileTabSelect.value = tabTarget;
      const targetPane = document.getElementById(`tab-${tabTarget}`);
      if (targetPane) targetPane.classList.add('active');

      if (tabTarget === 'overview') renderOverviewTab();
      if (tabTarget === 'products') renderProductsTab();
      if (tabTarget === 'categories') renderCategoriesTab();
      if (tabTarget === 'cms') populateCmsForm();
      if (tabTarget === 'orders') renderOrdersTab();
      if (tabTarget === 'shipping') renderShippingTab();
      if (tabTarget === 'settings') populateStockReceiptRecipientsForm();
      if (tabTarget === 'users') renderUsersTab();
    });
  });

  mobileTabSelect?.addEventListener('change', () => {
    const targetButton = document.querySelector(`.admin-tab-btn[data-tab="${mobileTabSelect.value}"]`);
    if (targetButton && targetButton.style.display !== 'none') targetButton.click();
  });

  // Quick Action Buttons
  bindProductCreateButton('quick-add-product-btn');
  document.getElementById('quick-edit-cms-btn')?.addEventListener('click', () => {
    if (requireAdminPermission('adminContent')) switchTab('cms');
  });
  document.getElementById('quick-export-csv-btn')?.addEventListener('click', () => {
    if (requireAdminPermission('adminOrders')) exportOrdersCsv();
  });

  // Setup Price Toggle Buttons
  setupPriceToggleButtons(refreshMainStoreFn);

  // Setup Uploader Helper for CMS File inputs
  setupCmsFileUploaders();

  // Setup Product Editor Modal logic
  setupProductEditor(refreshMainStoreFn);
  bindProductCreateButton('add-product-btn');
  bindProductFilterControls();

  // Setup Categories Tab
  setupCategoriesTab(refreshMainStoreFn);

  // Setup CMS Form submit
  setupCmsForm(refreshMainStoreFn);

  // Setup Orders Search & Filters
  setupOrdersTab();

  // Setup Shipping Rates tab
  setupShippingTab();

  // Setup Settings tab (Passcode, Backup, Restore, Reset)
  setupSettingsTab(refreshMainStoreFn);
}

function switchTab(tabName) {
  const btn = document.querySelector(`.admin-tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.click();
}

/* ==========================================================================
   TAB 1: OVERVIEW
   ========================================================================== */
function renderOverviewTab() {
  if (!hasAdminPermission('adminOverview')) return;
  const canManageOrders = hasAdminPermission('adminOrders');
  const orders = canManageOrders ? Store.getOrders() : [];
  const products = Store.getProducts();
  const metrics = calculateOrderMetrics(orders);
  const completedOrders = orders.filter(order => normalizeOrderStatus(order.status) === 'Delivered');
  const homeCount = completedOrders.filter(order => order.deliveryType === 'home').length;
  const deskCount = completedOrders.filter(order => order.deliveryType === 'desk').length;

  const revenueStat = document.getElementById('stat-total-revenue');
  const ordersStat = document.getElementById('stat-total-orders');
  const homeStat = document.getElementById('stat-home-count');
  if (revenueStat) revenueStat.closest('.stat-card').hidden = !canManageOrders;
  if (ordersStat) ordersStat.closest('.stat-card').hidden = !canManageOrders;
  if (homeStat) homeStat.closest('.stat-card').hidden = !canManageOrders;
  if (revenueStat) revenueStat.textContent = formatAdminDzd(metrics.completedRevenue);
  if (ordersStat) ordersStat.textContent = orders.length;
  document.getElementById('stat-total-products').textContent = products.length;
  if (homeStat) homeStat.textContent = `${homeCount} منزل / ${deskCount} مكتب`;

  const statsStrip = document.querySelector('#tab-overview .admin-stats-strip');
  let insights = document.getElementById('admin-overview-insights');
  if (canManageOrders && statsStrip && !insights) {
    insights = document.createElement('section');
    insights.id = 'admin-overview-insights';
    insights.className = 'admin-insights-grid';
    insights.innerHTML = `
      <button type="button" class="admin-insight-card" id="overview-open-orders">
        <h4><i class="fa-solid fa-hourglass-half"></i> الطلبات النشطة</h4>
        <strong class="admin-insight-value" id="insight-active-orders">0</strong>
        <p>طلبات جديدة أو قيد المعالجة والشحن — اضغط لعرضها.</p>
      </button>
      <div class="admin-insight-card">
        <h4><i class="fa-solid fa-chart-line"></i> نسبة الإتمام</h4>
        <strong class="admin-insight-value" id="insight-completion-rate">0%</strong>
        <p>نسبة الطلبات المكتملة من إجمالي الطلبات المحسومة.</p>
      </div>
      <div class="admin-insight-card">
        <h4><i class="fa-solid fa-location-dot"></i> أكثر ولاية طلبًا</h4>
        <strong class="admin-insight-value" id="insight-top-wilaya">—</strong>
        <p>حسب الطلبات المكتملة المتوفرة في النظام.</p>
      </div>
      <div class="admin-insight-card">
        <h4><i class="fa-solid fa-ranking-star"></i> الموديل الأكثر مبيعًا</h4>
        <strong class="admin-insight-value" id="insight-top-product">—</strong>
        <p>مقاسًا بعدد الكراطين المسجلة في الطلبات.</p>
      </div>`;
    statsStrip.insertAdjacentElement('afterend', insights);
    document.getElementById('overview-open-orders')?.addEventListener('click', () => switchTab('orders'));
  }
  if (insights) insights.hidden = !canManageOrders;
  const activeInsight = document.getElementById('insight-active-orders');
  const completionInsight = document.getElementById('insight-completion-rate');
  const wilayaInsight = document.getElementById('insight-top-wilaya');
  const productInsight = document.getElementById('insight-top-product');
  if (activeInsight) activeInsight.textContent = metrics.active;
  if (completionInsight) completionInsight.textContent = `${metrics.completionRate}%`;
  if (wilayaInsight) wilayaInsight.textContent = metrics.topWilayaCount ? `${metrics.topWilaya} (${metrics.topWilayaCount})` : 'لا توجد بيانات';
  if (productInsight) productInsight.textContent = metrics.topProductCartons ? `${metrics.topProduct} (${metrics.topProductCartons})` : 'لا توجد بيانات';

  const recentOrdersSection = document.querySelector('.recent-orders-sec');
  if (recentOrdersSection) recentOrdersSection.hidden = !canManageOrders;
  const quickAddButton = document.getElementById('quick-add-product-btn');
  const quickCmsButton = document.getElementById('quick-edit-cms-btn');
  const quickExportButton = document.getElementById('quick-export-csv-btn');
  if (quickAddButton) quickAddButton.hidden = !(hasAdminPermission('adminProducts') && hasAdminPermission('adminPrices'));
  if (quickCmsButton) quickCmsButton.hidden = !hasAdminPermission('adminContent');
  if (quickExportButton) quickExportButton.hidden = !canManageOrders;

  // Recent 5 orders table
  const tbody = document.getElementById('overview-recent-orders-tbody');
  if (!tbody) return;
  
  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--muted);">لا توجد طلبات مسجلة بعد</td></tr>`;
    return;
  }

  const recentOrders = [...orders].sort((a, b) => orderDateValue(b) - orderDateValue(a)).slice(0, 5);
  tbody.innerHTML = recentOrders.map(order => {
    const status = orderStatusMeta(order.status);
    const safePhone = String(order.phone || '').replace(/[^\d+]/g, '');
    return `
    <tr>
      <td><strong>#${escapeAdminHtml(order.id)}</strong></td>
      <td><small>${escapeAdminHtml(order.timestamp || '')}</small></td>
      <td>${escapeAdminHtml(order.customerName)}</td>
      <td><a href="tel:${safePhone}" dir="ltr">${escapeAdminHtml(order.phone)}</a></td>
      <td>${escapeAdminHtml(order.wilaya)} - ${escapeAdminHtml(order.commune)}</td>
      <td><strong>${formatAdminDzd(order.totalAmount)}</strong></td>
      <td><span class="order-status-pill ${status.key.toLowerCase()}">${status.label}</span></td>
    </tr>
  `;
  }).join('');
}

/* ==========================================================================
   TAB 2: PRODUCTS CMS
   ========================================================================== */
function renderProductsTab() {
  if (!hasAdminPermission('adminProducts')) return;
  const container = document.getElementById('admin-products-container');
  if (!container) return;

  const searchVal = (document.getElementById('admin-product-search')?.value || '').toLowerCase();
  const catVal = document.getElementById('admin-product-cat-filter')?.value || 'all';

  let products = Store.getProducts();
  if (catVal !== 'all') {
    products = products.filter(p => p.category === catVal);
  }
  if (searchVal) {
    products = products.filter(p => 
      p.id.toLowerCase().includes(searchVal) ||
      (p.name?.ar && p.name.ar.toLowerCase().includes(searchVal)) ||
      (p.name?.fr && p.name.fr.toLowerCase().includes(searchVal))
    );
  }

  if (products.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted);">لا توجد منتجات مطابقة للبحث</div>`;
    return;
  }

  container.innerHTML = products.map(p => {
    const nameAr = p.name?.ar || p.name || 'منتج بدون اسم';
    const productImages = Array.isArray(p.images) && p.images.length ? p.images : [p.image || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg'];

    return `
      <div class="admin-product-card" data-product-id="${p.id}">
        <span class="admin-product-drag-hint"><i class="fa-solid fa-grip-vertical"></i><small>اضغط مطولًا للترتيب</small></span>
        <div class="admin-prod-top">
          <img src="${productImages[0]}" alt="${nameAr}" class="admin-prod-img" loading="lazy" decoding="async" onerror="this.src='https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg';" />
          ${productImages.length > 1 ? `<span class="admin-product-image-count"><i class="fa-solid fa-images"></i> ${productImages.length}</span>` : ''}
          <div class="admin-prod-info">
            <h5>${nameAr}</h5>
            <div class="admin-prod-price">${(p.price || 0).toLocaleString()} دج <small style="font-size:0.8rem; font-weight:normal;">/ للزوج</small></div>
            <div class="admin-prod-series">الكرطون: ${(p.seriesPrice || 0).toLocaleString()} دج</div>
          </div>
        </div>
        <div class="admin-prod-actions">
          <button class="btn btn-outline-gold edit-prod-btn" data-id="${p.id}"><i class="fa-solid fa-pen"></i> تعديل</button>
          <button class="btn btn-danger-outline delete-prod-btn" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  }).join('');
  container.dataset.reorderEnabled = catVal === 'all' && !searchVal ? 'true' : 'false';
  setupProductCardLongPressOrdering(container);

  // Event Listeners for action buttons
  container.querySelectorAll('.edit-prod-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!requireAdminPermission('adminProducts')) return;
      const id = e.currentTarget.dataset.id;
      const p = Store.getProducts().find(item => item.id === id);
      if (p) openProductEditor(p);
    });
  });

  container.querySelectorAll('.delete-prod-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!requireAdminPermission('adminProducts')) return;
      const id = e.currentTarget.dataset.id;
      const product = Store.getProducts().find(item => item.id === id);
      const quantity = Number(product?.seriesQty ?? product?.stockQty ?? 0);
      if (quantity > 0) {
        alert('لا يمكن حذف منتج لديه رصيد في المخزن. يجب تصفير الرصيد من لوحة المخزن أولاً.');
        return;
      }
      if (confirm('هل أنت تأكد من رغبتك في حذف هذا المنتج نهائياً من المتجر؟')) {
        Store.deleteProduct(id);
        renderProductsTab();
        window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
      }
    });
  });
}

function setupProductCardLongPressOrdering(container) {
  if (!container || container.dataset.productOrderBound) return;
  container.dataset.productOrderBound = 'true';
  let timer = null;
  let draggedCard = null;
  let startX = 0;
  let startY = 0;
  let pendingCard = null;
  let activePointerId = null;
  let suppressClickUntil = 0;

  const cancelPending = () => {
    clearTimeout(timer);
    timer = null;
    pendingCard = null;
  };

  container.addEventListener('pointerdown', event => {
    if (container.dataset.reorderEnabled !== 'true' || event.target.closest('button, input, select, a')) return;
    const card = event.target.closest('.admin-product-card');
    if (!card) return;
    startX = event.clientX;
    startY = event.clientY;
    pendingCard = card;
    activePointerId = event.pointerId;
    timer = window.setTimeout(() => {
      if (pendingCard !== card) return;
      draggedCard = card;
      pendingCard = null;
      card.classList.add('is-reordering');
      container.classList.add('is-reordering-products');
      card.setPointerCapture?.(activePointerId);
      navigator.vibrate?.(40);
    }, 560);
  });

  container.addEventListener('pointermove', event => {
    if (!draggedCard) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 8) cancelPending();
      return;
    }
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.admin-product-card');
    if (!target || target === draggedCard || target.parentElement !== container) return;
    const cards = Array.from(container.querySelectorAll('.admin-product-card'));
    const fromIndex = cards.indexOf(draggedCard);
    const toIndex = cards.indexOf(target);
    if (fromIndex < toIndex) target.after(draggedCard);
    else target.before(draggedCard);
  });

  const finish = () => {
    cancelPending();
    if (draggedCard) {
      try {
        if (activePointerId !== null && draggedCard.hasPointerCapture?.(activePointerId)) {
          draggedCard.releasePointerCapture(activePointerId);
        }
      } catch (error) {
        console.debug('Pointer capture was already released.', error);
      }
      draggedCard.classList.remove('is-reordering');
      container.classList.remove('is-reordering-products');
      const orderedIds = Array.from(container.querySelectorAll('.admin-product-card')).map(card => card.dataset.productId);
      const currentProducts = Store.getProducts();
      const productMap = new Map(currentProducts.map(product => [product.id, product]));
      const reordered = orderedIds.map(id => productMap.get(id)).filter(Boolean);
      const untouched = currentProducts.filter(product => !orderedIds.includes(product.id));
      Store.saveProducts([...reordered, ...untouched]);
      suppressClickUntil = Date.now() + 450;
      window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: 'تم حفظ ترتيب ظهور المنتجات.' }));
    }
    draggedCard = null;
    activePointerId = null;
  };
  container.addEventListener('pointerup', finish);
  container.addEventListener('pointercancel', finish);
  container.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  container.closest('.admin-tabs-content')?.addEventListener('scroll', cancelPending, { passive: true });
}

function bindProductCreateButton(buttonId) {
  const button = document.getElementById(buttonId);
  if (!button || button.dataset.productCreateBound === 'true') return;
  button.dataset.productCreateBound = 'true';
  button.addEventListener('click', () => {
    if (!requireAdminPermission('adminProducts')) return;
    if (!requireAdminPermission('adminPrices', 'إضافة منتج جديد تتطلب صلاحية إدارة الأسعار أيضًا.')) return;
    openProductEditor();
  });
}

function bindProductFilterControls() {
  const search = document.getElementById('admin-product-search');
  const category = document.getElementById('admin-product-cat-filter');
  if (search && search.dataset.productFilterBound !== 'true') {
    search.dataset.productFilterBound = 'true';
    search.addEventListener('input', renderProductsTab);
  }
  if (category && category.dataset.productFilterBound !== 'true') {
    category.dataset.productFilterBound = 'true';
    category.addEventListener('change', renderProductsTab);
  }
}

/* ==========================================================================
   TAB: CATEGORIES MANAGER
   ========================================================================== */
function setupCategoriesTab(refreshMainStoreFn) {
  const form = document.getElementById('add-category-form');
  if (form && !form.dataset.bound) {
    form.dataset.bound = 'true';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!requireAdminPermission('adminProducts')) return;
      const id = document.getElementById('cat-id-input').value.trim().toLowerCase().replace(/\s+/g, '-');
      const nameAr = document.getElementById('cat-name-ar-input').value.trim();
      const nameFr = document.getElementById('cat-name-fr-input').value.trim();
      
      if (!id || !nameAr || !nameFr) return;
      
      Store.addCategory({ id, nameAr, nameFr });
      form.reset();
      renderCategoriesTab();
      populateCategoryDropdowns();
      if (refreshMainStoreFn) refreshMainStoreFn();
      window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
      window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: 'تم إضافة القسم الجديد بنجاح وسوف يظهر بالكتالوج والواجهة الرئيسية!' }));
    });
  }

  const tbody = document.getElementById('admin-categories-tbody');
  if (tbody && !tbody.dataset.bound) {
    tbody.dataset.bound = 'true';
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.edit-cat-btn, .save-cat-btn, .cancel-cat-btn, .delete-cat-btn');
      if (!btn) return;
      if (!requireAdminPermission('adminProducts')) return;
      const id = btn.dataset.id;

      if (btn.classList.contains('edit-cat-btn')) {
        const category = Store.getCategories().find(item => item.id === id);
        const row = btn.closest('tr');
        if (!category || !row) return;
        row.innerHTML = `
          <td><strong>${escapeAdminHtml(category.id)}</strong><small class="text-muted" style="display:block;">الكود ثابت لحماية ارتباط المنتجات</small></td>
          <td><input class="form-control edit-cat-name-ar" value="${escapeAdminHtml(category.nameAr)}" aria-label="اسم القسم بالعربية" /></td>
          <td><input class="form-control edit-cat-name-fr" value="${escapeAdminHtml(category.nameFr)}" aria-label="اسم القسم بالفرنسية" /></td>
          <td>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn btn-gold btn-sm save-cat-btn" data-id="${escapeAdminHtml(category.id)}">
                <i class="fa-solid fa-floppy-disk"></i> حفظ
              </button>
              <button class="btn btn-outline-gold btn-sm cancel-cat-btn" data-id="${escapeAdminHtml(category.id)}">
                إلغاء
              </button>
            </div>
          </td>
        `;
        row.querySelector('.edit-cat-name-ar')?.focus();
        return;
      }

      if (btn.classList.contains('cancel-cat-btn')) {
        renderCategoriesTab();
        return;
      }

      if (btn.classList.contains('save-cat-btn')) {
        const row = btn.closest('tr');
        const nameAr = row?.querySelector('.edit-cat-name-ar')?.value.trim() || '';
        const nameFr = row?.querySelector('.edit-cat-name-fr')?.value.trim() || '';
        if (!nameAr || !nameFr) {
          window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: 'أدخل اسم القسم بالعربية والفرنسية قبل الحفظ.' }));
          return;
        }
        const updated = Store.updateCategory(id, { nameAr, nameFr });
        if (!updated) return;
        renderCategoriesTab();
        populateCategoryDropdowns();
        if (refreshMainStoreFn) refreshMainStoreFn();
        window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
        window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: `تم تعديل القسم «${nameAr}» بنجاح.` }));
        return;
      }

      if (btn.classList.contains('delete-cat-btn') && confirm(`هل أنت متأكد من رغبتك في حذف القسم "${id}" نهائياً من المتجر؟`)) {
        Store.deleteCategory(id);
        renderCategoriesTab();
        populateCategoryDropdowns();
        if (refreshMainStoreFn) refreshMainStoreFn();
        window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
        window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: `تم حذف القسم (${id}) بنجاح!` }));
      }
    });
  }
}

function renderCategoriesTab() {
  if (!hasAdminPermission('adminProducts')) return;
  const tbody = document.getElementById('admin-categories-tbody');
  if (!tbody) return;

  const categories = Store.getCategories();
  if (categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--muted); padding: 30px;">لا توجد أقسام معرفة حالياً. أضف قسماً جديداً أعلاه.</td></tr>`;
    return;
  }

  tbody.innerHTML = categories.map(c => `
    <tr>
      <td><strong>${escapeAdminHtml(c.id)}</strong></td>
      <td>${escapeAdminHtml(c.nameAr)}</td>
      <td>${escapeAdminHtml(c.nameFr)}</td>
      <td>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-outline-gold btn-sm edit-cat-btn" data-id="${escapeAdminHtml(c.id)}" title="تعديل القسم">
            <i class="fa-solid fa-pen-to-square"></i> تعديل
          </button>
          <button class="btn btn-danger-outline btn-sm delete-cat-btn" data-id="${escapeAdminHtml(c.id)}" title="حذف القسم">
            <i class="fa-solid fa-trash"></i> حذف
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function populateCategoryDropdowns() {
  const categories = Store.getCategories();
  
  // Product Filter Select in Tab 2
  const filterSelect = document.getElementById('admin-product-cat-filter');
  if (filterSelect) {
    const selected = filterSelect.value || 'all';
    filterSelect.innerHTML = `<option value="all">كل الأقسام</option>` + 
      categories.map(c => `<option value="${c.id}">${c.nameAr} (${c.nameFr})</option>`).join('');
    filterSelect.value = selected;
  }

  // Product Editor Category Select
  const peSelect = document.getElementById('pe-category');
  if (peSelect) {
    const selected = peSelect.value || (categories[0] ? categories[0].id : 'wedding');
    peSelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.nameAr} (${c.nameFr})</option>`).join('');
    peSelect.value = selected;
  }
}

/* ==========================================================================
   PRODUCT EDITOR MODAL
   ========================================================================== */
function setupProductEditor(refreshMainStoreFn) {
  const modal = document.getElementById('product-editor-modal');
  const closeBtn = document.getElementById('close-product-editor-modal');
  const cancelBtn = document.getElementById('cancel-product-editor');
  const form = document.getElementById('product-editor-form');
  const fileInput = document.getElementById('pe-image-file');
  const urlInput = document.getElementById('pe-image-url');
  const addUrlBtn = document.getElementById('pe-add-image-url');
  const gallery = document.getElementById('pe-images-gallery');

  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
  if (cancelBtn) cancelBtn.onclick = () => modal.classList.remove('active');

  addUrlBtn?.addEventListener('click', () => {
    const url = urlInput?.value.trim();
    if (!url) return;
    if (selectedProductImages.length >= 8) {
      alert('يمكن إضافة 8 صور كحد أقصى لكل منتج.');
      return;
    }
    selectedProductImages.push(url);
    urlInput.value = '';
    renderProductImageGallery();
  });

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const remaining = Math.max(0, 8 - selectedProductImages.length);
      const chosenFiles = Array.from(e.target.files || []);
      const files = chosenFiles.slice(0, remaining);
      if (chosenFiles.length > remaining) {
        alert(`يمكن إضافة 8 صور كحد أقصى. سيتم رفع ${remaining} صورة فقط.`);
      }
      if (!files.length) return;
      const uploadLabel = fileInput.closest('label');
      uploadLabel?.classList.add('is-uploading');
      const uploadedUrls = await Promise.all(files.map(file => uploadToCloudinary(file)));
      selectedProductImages.push(...uploadedUrls.filter(Boolean));
      uploadLabel?.classList.remove('is-uploading');
      e.target.value = '';
      renderProductImageGallery();
    });
  }

  gallery?.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-image-remove]');
    if (removeButton) {
      selectedProductImages.splice(Number(removeButton.dataset.imageRemove), 1);
      renderProductImageGallery();
      return;
    }
    const coverButton = event.target.closest('[data-image-cover]');
    if (coverButton) {
      const index = Number(coverButton.dataset.imageCover);
      const [image] = selectedProductImages.splice(index, 1);
      selectedProductImages.unshift(image);
      renderProductImageGallery();
    }
  });
  setupImageLongPressOrdering(gallery);

  document.getElementById('pe-color-palette')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-color-key]');
    if (!button) return;
    const key = button.dataset.colorKey;
    selectedProductColorKeys = selectedProductColorKeys.includes(key)
      ? selectedProductColorKeys.filter(item => item !== key)
      : [...selectedProductColorKeys, key];
    renderProductColorPalette();
  });

  document.getElementById('pe-badge-options')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-badge-ar]');
    if (!button) return;
    selectedProductBadge = {
      ar: button.dataset.badgeAr,
      fr: button.dataset.badgeFr
    };
    syncProductBadgeInputs();
    renderProductBadgeOptions();
  });

  window.addEventListener('joulane:languageChanged', () => {
    if (modal?.classList.contains('active')) {
      renderProductBadgeOptions();
      renderProductColorPalette();
    }
  });

  if (form && !form.dataset.productEditorBound) {
    form.dataset.productEditorBound = 'true';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!requireAdminPermission('adminProducts')) return;
      const id = document.getElementById('pe-id').value || document.getElementById('pe-id-display').value.trim();
      const existingProduct = Store.getProducts().find(product => product.id === id) || null;
      const canEditPrices = hasAdminPermission('adminPrices');
      if (!existingProduct && !canEditPrices) {
        requireAdminPermission('adminPrices', 'إضافة منتج جديد تتطلب صلاحية إدارة الأسعار أيضًا.');
        return;
      }
      const newProduct = {
        id,
        category: document.getElementById('pe-category').value,
        name: {
          ar: document.getElementById('pe-name-ar').value.trim(),
          fr: document.getElementById('pe-name-fr').value.trim()
        },
        price: canEditPrices ? (parseFloat(document.getElementById('pe-price').value) || 0) : (existingProduct?.price || 0),
        seriesPrice: canEditPrices ? (parseFloat(document.getElementById('pe-series-price').value) || 0) : (existingProduct?.seriesPrice || 0),
        oldPrice: canEditPrices ? (parseFloat(document.getElementById('pe-old-price').value) || 0) : (existingProduct?.oldPrice || 0),
        pairsPerSeries: Math.max(1, parseInt(document.getElementById('pe-pairs').value, 10) || 18),
        pairsPerSeriesConfigured: true,
        discountBadge: {
          ar: document.getElementById('pe-badge-ar').value.trim(),
          fr: document.getElementById('pe-badge-fr').value.trim()
        },
        image: selectedProductImages[0] || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg',
        images: selectedProductImages.length ? selectedProductImages.slice(0, 8) : ['https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg'],
        colors: {
          ar: selectedProductColorKeys.map(key => PRODUCT_COLOR_OPTIONS.find(color => color.key === key)?.ar).filter(Boolean),
          fr: selectedProductColorKeys.map(key => PRODUCT_COLOR_OPTIONS.find(color => color.key === key)?.fr).filter(Boolean)
        },
        colorKeys: selectedProductColorKeys,
        sizes: [...SHOE_SIZES],
        description: {
          ar: document.getElementById('pe-desc-ar').value.trim(),
          fr: document.getElementById('pe-desc-fr').value.trim()
        },
        features: {
          ar: cleanProductFeatures(document.getElementById('pe-features-ar').value, 'ar'),
          fr: cleanProductFeatures(document.getElementById('pe-features-fr').value, 'fr')
        }
      };

      if (existingProduct) {
        Store.updateProduct(id, newProduct);
      } else {
        Store.addProduct({ ...newProduct, seriesQty: 0, stockStatus: 'out_of_stock', isAvailable: true });
      }

      modal.classList.remove('active');
      renderProductsTab();
      if (refreshMainStoreFn) refreshMainStoreFn();
      alert('تم حفظ وتحديث المنتج بالمتجر بنجاح!');
    });
  }
}

function openProductEditor(product = null) {
  if (!requireAdminPermission('adminProducts')) return;
  const modal = document.getElementById('product-editor-modal');
  const titleEl = document.getElementById('product-editor-title');
  populateCategoryDropdowns();
  const canEditPrices = hasAdminPermission('adminPrices');
  ['pe-price', 'pe-series-price', 'pe-old-price'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.disabled = !canEditPrices;
  });

  selectedProductImages = product
    ? (Array.isArray(product.images) && product.images.length ? product.images : [product.image || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg']).slice(0, 8)
    : [];
  selectedProductColorKeys = product ? inferProductColorKeys(product) : ['black', 'gold', 'silver'];
  selectedProductSizes = [...SHOE_SIZES];
  selectedProductBadge = product
    ? (PRODUCT_BADGE_OPTIONS.find(option => option.ar === product.discountBadge?.ar || option.fr === product.discountBadge?.fr)
      || { ar: product.discountBadge?.ar || 'جديد', fr: product.discountBadge?.fr || 'Nouveau' })
    : PRODUCT_BADGE_OPTIONS[0];
  
  if (!product) {
    titleEl.innerHTML = `<i class="fa-solid fa-circle-plus"></i> إضافة منتج جديد`;
    document.getElementById('pe-id').value = '';
    document.getElementById('pe-id-display').value = `joulane-0${Store.getProducts().length + 1}`;
    document.getElementById('pe-id-display').removeAttribute('readonly');
    const categories = Store.getCategories();
    document.getElementById('pe-category').value = categories[0] ? categories[0].id : 'wedding';
    document.getElementById('pe-name-ar').value = '';
    document.getElementById('pe-name-fr').value = '';
    document.getElementById('pe-price').value = 3200;
    document.getElementById('pe-series-price').value = 57600;
    document.getElementById('pe-old-price').value = 0;
    document.getElementById('pe-pairs').value = 18;
    document.getElementById('pe-image-url').value = '';
    document.getElementById('pe-desc-ar').value = 'موديل سهرة فاخر مناسب للمحلات وبوتيكات الأعراس.';
    document.getElementById('pe-desc-fr').value = 'Modele de soiree elegant pour boutiques.';
    document.getElementById('pe-features-ar').value = 'بيع بالجملة فقط, توصيل للمنزل أو المكتب';
    document.getElementById('pe-features-fr').value = 'Vente en gros uniquement, Livraison disponible';
  } else {
    titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> تعديل المنتج: ${product.name?.ar || product.id}`;
    document.getElementById('pe-id').value = product.id;
    document.getElementById('pe-id-display').value = product.id;
    document.getElementById('pe-id-display').setAttribute('readonly', 'true');
    document.getElementById('pe-category').value = product.category || 'wedding';
    document.getElementById('pe-name-ar').value = product.name?.ar || '';
    document.getElementById('pe-name-fr').value = product.name?.fr || '';
    document.getElementById('pe-price').value = product.price || 0;
    document.getElementById('pe-series-price').value = product.seriesPrice || 0;
    document.getElementById('pe-old-price').value = product.oldPrice || 0;
    document.getElementById('pe-pairs').value = product.pairsPerSeries || 18;
    document.getElementById('pe-image-url').value = '';
    document.getElementById('pe-desc-ar').value = product.description?.ar || '';
    document.getElementById('pe-desc-fr').value = product.description?.fr || '';
    document.getElementById('pe-features-ar').value = (product.features?.ar || []).join(', ');
    document.getElementById('pe-features-fr').value = (product.features?.fr || []).join(', ');
  }

  syncProductBadgeInputs();
  renderProductBadgeOptions();
  renderProductColorPalette();
  renderProductSizePicker();
  renderProductImageGallery();
  const modalBox = modal?.querySelector('.modal-box');
  if (modalBox) modalBox.scrollTop = 0;
  modal.classList.add('active');
  window.requestAnimationFrame(() => {
    if (modalBox) modalBox.scrollTop = 0;
  });
}

function adminEditorLanguage() {
  return localStorage.getItem('joulane_lang') === 'fr' ? 'fr' : 'ar';
}

function cleanProductFeatures(value, language) {
  const sizePattern = language === 'fr'
    ? /\b(?:s[eé]rie|pointures?)\b.*\b(?:3[5-9]|4[0-4])\b/i
    : /(?:كرطون|سلسلة|مقاسات?).*(?:٣[٥-٩]|٤[٠-٤]|3[5-9]|4[0-4])/i;
  return String(value || '')
    .split(',')
    .map(feature => feature.trim())
    .filter(Boolean)
    .filter(feature => !sizePattern.test(feature));
}

function syncProductBadgeInputs() {
  const emptyBadge = selectedProductBadge?.ar === 'بدون شارة';
  document.getElementById('pe-badge-ar').value = emptyBadge ? '' : (selectedProductBadge?.ar || '');
  document.getElementById('pe-badge-fr').value = emptyBadge ? '' : (selectedProductBadge?.fr || '');
}

function renderProductBadgeOptions() {
  const root = document.getElementById('pe-badge-options');
  if (!root) return;
  const language = adminEditorLanguage();
  const options = [...PRODUCT_BADGE_OPTIONS];
  if (selectedProductBadge && !options.some(option => option.ar === selectedProductBadge.ar && option.fr === selectedProductBadge.fr)) {
    options.unshift(selectedProductBadge);
  }
  root.innerHTML = options.map(option => {
    const selected = option.ar === selectedProductBadge?.ar && option.fr === selectedProductBadge?.fr;
    return `<button type="button" class="pe-choice-chip ${selected ? 'is-selected' : ''}" data-badge-ar="${option.ar}" data-badge-fr="${option.fr}" role="radio" aria-checked="${selected}">
      <strong>${language === 'fr' ? option.fr : option.ar}</strong>
      <small>${language === 'fr' ? option.ar : option.fr}</small>
    </button>`;
  }).join('');
}

function renderProductColorPalette() {
  const root = document.getElementById('pe-color-palette');
  if (!root) return;
  const language = adminEditorLanguage();
  root.innerHTML = PRODUCT_COLOR_OPTIONS.map(color => {
    const selected = selectedProductColorKeys.includes(color.key);
    return `<button type="button" class="pe-color-choice ${selected ? 'is-selected' : ''}" data-color-key="${color.key}" aria-pressed="${selected}" title="${language === 'fr' ? color.fr : color.ar}">
      <span class="pe-color-dot ${color.light ? 'is-light' : ''}" style="--swatch:${color.hex}">${selected ? '<i class="fa-solid fa-check"></i>' : ''}</span>
      <small>${language === 'fr' ? color.fr : color.ar}</small>
    </button>`;
  }).join('');
  document.getElementById('pe-colors-ar').value = selectedProductColorKeys.join(',');
  document.getElementById('pe-colors-fr').value = selectedProductColorKeys.join(',');
}

function renderProductSizePicker() {
  const root = document.getElementById('pe-size-picker');
  if (!root) return;
  root.innerHTML = SHOE_SIZES.map(size => `
    <button type="button" class="pe-size-choice is-selected" data-shoe-size="${size}" aria-pressed="true" disabled>${size}</button>
  `).join('');
  document.getElementById('pe-sizes').value = selectedProductSizes.join(',');
}

function renderProductImageGallery() {
  const gallery = document.getElementById('pe-images-gallery');
  if (!gallery) return;
  if (!selectedProductImages.length) {
    gallery.innerHTML = `<div class="pe-images-empty"><i class="fa-regular fa-images"></i><span>أضف صورة من الهاتف أو بواسطة رابط</span></div>`;
    return;
  }
  gallery.innerHTML = selectedProductImages.map((image, index) => `
    <article class="pe-image-item ${index === 0 ? 'is-cover' : ''}" data-image-index="${index}">
      <img src="${image}" alt="صورة المنتج ${index + 1}" draggable="false" onerror="this.src='https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg';" />
      <span class="pe-image-order">${index + 1}</span>
      ${index === 0 ? '<span class="pe-cover-label">الغلاف</span>' : `<button type="button" class="pe-make-cover" data-image-cover="${index}" aria-label="جعلها صورة الغلاف"><i class="fa-solid fa-star"></i></button>`}
      <button type="button" class="pe-remove-image" data-image-remove="${index}" aria-label="حذف الصورة"><i class="fa-solid fa-xmark"></i></button>
      <i class="fa-solid fa-grip pe-image-grip"></i>
    </article>
  `).join('');
}

function setupImageLongPressOrdering(gallery) {
  if (!gallery || gallery.dataset.orderBound) return;
  gallery.dataset.orderBound = 'true';
  let timer = null;
  let activeIndex = -1;
  let startX = 0;
  let startY = 0;

  gallery.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    const item = event.target.closest('.pe-image-item');
    if (!item) return;
    startX = event.clientX;
    startY = event.clientY;
    const index = Number(item.dataset.imageIndex);
    timer = window.setTimeout(() => {
      activeIndex = index;
      item.classList.add('is-dragging');
      navigator.vibrate?.(35);
    }, 360);
  });
  gallery.addEventListener('pointermove', event => {
    if (activeIndex < 0) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) clearTimeout(timer);
      return;
    }
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.pe-image-item');
    const targetIndex = Number(target?.dataset.imageIndex);
    if (!Number.isInteger(targetIndex) || targetIndex === activeIndex) return;
    const [moved] = selectedProductImages.splice(activeIndex, 1);
    selectedProductImages.splice(targetIndex, 0, moved);
    activeIndex = targetIndex;
    renderProductImageGallery();
  });
  const finish = () => {
    clearTimeout(timer);
    timer = null;
    activeIndex = -1;
    gallery.querySelectorAll('.is-dragging').forEach(item => item.classList.remove('is-dragging'));
  };
  gallery.addEventListener('pointerup', finish);
  gallery.addEventListener('pointercancel', finish);
  gallery.addEventListener('pointerleave', () => {
    if (activeIndex < 0) clearTimeout(timer);
  });
  gallery.closest('.modal-box')?.addEventListener('scroll', () => {
    if (activeIndex < 0) clearTimeout(timer);
  }, { passive: true });
}

/* ==========================================================================
   TAB 3: HOMEPAGE CMS
   ========================================================================== */
function populateCmsForm() {
  if (!hasAdminPermission('adminContent')) return;
  const config = Store.getConfig();
  const form = document.getElementById('cms-editor-form');
  if (!form) return;

  Object.keys(config).forEach(key => {
    const field = form.querySelector(`[name="${key}"]`);
    if (field) {
      field.value = typeof config[key] === 'boolean'
        ? String(config[key])
        : config[key];
    }
  });
}

function setupCmsFileUploaders() {
  document.querySelectorAll('.cms-file-uploader').forEach(uploader => {
    uploader.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const targetInputId = e.target.dataset.target;
      const targetInput = document.getElementById(targetInputId);
      if (file && targetInput) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          targetInput.value = evt.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  });
}

function setupCmsForm(refreshMainStoreFn) {
  const form = document.getElementById('cms-editor-form');
  const topSaveBtn = document.getElementById('save-cms-btn-top');

  if (topSaveBtn && form) {
    topSaveBtn.onclick = () => form.requestSubmit();
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!requireAdminPermission('adminContent')) return;
      const formData = new FormData(form);
      const updatedConfig = Store.getConfig();
      
      for (const [key, val] of formData.entries()) {
        updatedConfig[key] = val.trim();
      }

      const synced = await Store.saveConfig(updatedConfig);
      if (refreshMainStoreFn) refreshMainStoreFn();
      alert(synced
        ? 'تم حفظ التعديلات ومزامنتها مع السحابة بنجاح.'
        : 'تم حفظ التعديلات على هذا الجهاز، وستتم مزامنتها تلقائياً عند عودة الاتصال.');
    });
  }
}

/* ==========================================================================
   TAB 4: ORDERS MANAGEMENT
   ========================================================================== */
let activeOrderStatusFilter = 'all';
let editingOrderId = null;
let editingOrderItems = [];
let orderEditorOpener = null;
let orderEditorSaving = false;

function notifyOrderMutationResult(result, messages = {}) {
  if (result?.status === 'synced') {
    notifyAdmin(messages.synced || 'تم حفظ العملية ومزامنتها مع السحابة.');
    return;
  }
  if (result?.status === 'queued') {
    notifyAdmin(messages.queued || 'تم الحفظ على هذا الجهاز، وستتم المزامنة تلقائياً عند عودة الاتصال.');
    return;
  }
  if (result?.status === 'conflict') {
    notifyAdmin(result.refreshed
      ? 'لم يُطبّق التعديل لأن الطلب تغيّر من جهاز آخر. تم تحميل آخر نسخة آمنة.'
      : 'يوجد تعارض مع تعديل أحدث في السحابة. حدّث الطلب ثم أعد المحاولة.');
    return;
  }
  notifyAdmin('تم الحفظ محلياً، لكن تعذرت المزامنة لأن الجلسة لا تملك الصلاحية المطلوبة.');
}

function orderStatusOptions(selectedStatus) {
  const selected = normalizeOrderStatus(selectedStatus);
  return Object.entries(ORDER_STATUS_META).map(([key, meta]) =>
    `<option value="${key}" ${selected === key ? 'selected' : ''}>${meta.label}</option>`
  ).join('');
}

function orderWhatsappLink(order) {
  const rawPhone = String(order?.phone || '').replace(/\D/g, '');
  const waPhone = rawPhone.startsWith('0') ? `213${rawPhone.slice(1)}` : rawPhone;
  const message = `مرحبًا ${order?.customerName || ''}، نتابع معكم طلب JOULANE Fashion رقم #${order?.id || ''}.`;
  return waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}` : '#';
}

function ensureProfessionalOrdersUi() {
  const tab = document.getElementById('tab-orders');
  if (!tab || tab.dataset.professionalOrdersReady === 'true') return;
  tab.dataset.professionalOrdersReady = 'true';

  const header = tab.querySelector('.admin-pane-header');
  const originalControls = tab.querySelector('.admin-pane-controls');
  const tableWrap = tab.querySelector('.table-responsive');
  const headerActions = header?.querySelector('.admin-top-actions');

  const dashboard = document.createElement('section');
  dashboard.className = 'orders-pro-dashboard';
  dashboard.innerHTML = `
    <button type="button" class="order-kpi-card is-new" data-order-filter-status="New">
      <i class="fa-solid fa-sparkles"></i><span class="order-kpi-copy"><strong id="orders-kpi-new">0</strong><small>طلبات جديدة</small></span>
    </button>
    <button type="button" class="order-kpi-card is-progress" data-order-filter-status="progress">
      <i class="fa-solid fa-spinner"></i><span class="order-kpi-copy"><strong id="orders-kpi-progress">0</strong><small>قيد المعالجة والشحن</small></span>
    </button>
    <button type="button" class="order-kpi-card is-delivered" data-order-filter-status="Delivered">
      <i class="fa-solid fa-circle-check"></i><span class="order-kpi-copy"><strong id="orders-kpi-delivered">0</strong><small>طلبات مكتملة</small></span>
    </button>
    <div class="order-kpi-card is-revenue">
      <i class="fa-solid fa-sack-dollar"></i><span class="order-kpi-copy"><strong id="orders-kpi-revenue">0 دج</strong><small>مبيعات مكتملة</small></span>
    </div>
    <div class="order-kpi-card is-average">
      <i class="fa-solid fa-chart-simple"></i><span class="order-kpi-copy"><strong id="orders-kpi-average">0 دج</strong><small>متوسط قيمة الطلب</small></span>
    </div>`;
  header?.insertAdjacentElement('afterend', dashboard);

  const toolbar = document.createElement('section');
  toolbar.className = 'orders-pro-toolbar';
  toolbar.innerHTML = `
    <div class="orders-filter-grid" id="orders-filter-grid"></div>
    <button type="button" id="orders-advanced-filters-toggle" class="orders-advanced-filters-toggle" aria-expanded="false">
      <i class="fa-solid fa-sliders"></i><span>الفترة والتوصيل والترتيب</span><i class="fa-solid fa-chevron-down"></i>
    </button>
    <div class="orders-results-meta" aria-live="polite"><span id="orders-results-count">0 طلب</span><span id="orders-results-value">القيمة: 0 دج</span></div>`;

  if (originalControls) {
    const filterGrid = toolbar.querySelector('#orders-filter-grid');
    const searchBox = originalControls.querySelector('.search-box');
    const statusFilters = originalControls.querySelector('.orders-status-filters');
    if (searchBox) filterGrid.appendChild(searchBox);
    filterGrid.insertAdjacentHTML('beforeend', `
      <select id="admin-orders-date-filter" class="form-control select-dark" aria-label="فترة الطلبات">
        <option value="all">كل الفترات</option><option value="today">اليوم</option><option value="7">آخر 7 أيام</option><option value="30">آخر 30 يومًا</option>
      </select>
      <select id="admin-orders-delivery-filter" class="form-control select-dark" aria-label="نوع التوصيل">
        <option value="all">كل أنواع التوصيل</option><option value="home">المنزل / المحل</option><option value="desk">المكتب</option>
      </select>
      <select id="admin-orders-sort" class="form-control select-dark" aria-label="ترتيب الطلبات">
        <option value="newest">الأحدث أولًا</option><option value="oldest">الأقدم أولًا</option><option value="highest">الأعلى قيمة</option><option value="lowest">الأقل قيمة</option>
      </select>`);
    if (statusFilters) toolbar.appendChild(statusFilters);
    originalControls.replaceWith(toolbar);
  } else {
    dashboard.insertAdjacentElement('afterend', toolbar);
  }

  if (tableWrap) {
    tableWrap.id = 'admin-orders-table-wrap';
    const mobileList = document.createElement('div');
    mobileList.id = 'admin-orders-mobile-list';
    mobileList.className = 'orders-mobile-list';
    tableWrap.insertAdjacentElement('afterend', mobileList);
  }

  if (headerActions && !document.getElementById('refresh-orders-btn')) {
    const refreshButton = document.createElement('button');
    refreshButton.type = 'button';
    refreshButton.id = 'refresh-orders-btn';
    refreshButton.className = 'btn btn-outline-gold';
    refreshButton.innerHTML = '<i class="fa-solid fa-rotate"></i> تحديث';
    headerActions.prepend(refreshButton);
  }

  const clearButton = document.getElementById('clear-orders-btn');
  if (clearButton) {
    clearButton.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> منطقة خطرة';
    clearButton.hidden = getCurrentAdminUser()?.id !== 'usr_super_admin';
  }

  if (!document.getElementById('order-editor-modal')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="order-editor-modal" class="modal-overlay order-editor-modal" aria-hidden="true">
        <div class="modal-box order-editor-box" role="dialog" aria-modal="true" aria-labelledby="order-editor-title">
          <button type="button" class="modal-close" id="close-order-editor" aria-label="إغلاق">&times;</button>
          <div class="order-editor-header">
            <h3 id="order-editor-title"><i class="fa-solid fa-pen-to-square text-gold"></i> تعديل الطلب</h3>
            <small id="order-editor-reference">—</small>
          </div>
          <form id="order-editor-form">
            <div class="order-editor-body">
              <div class="order-editor-layout">
                <div class="form-group"><label for="order-edit-customer">الزبون / المحل</label><input id="order-edit-customer" class="form-control" required /></div>
                <div class="form-group"><label for="order-edit-phone">رقم الهاتف</label><input id="order-edit-phone" class="form-control" inputmode="tel" dir="ltr" required /></div>
                <div class="form-group"><label for="order-edit-wilaya">الولاية</label><select id="order-edit-wilaya" class="form-control select-dark" required></select></div>
                <div class="form-group"><label for="order-edit-commune">البلدية</label><select id="order-edit-commune" class="form-control select-dark"></select></div>
                <div class="form-group is-full"><label for="order-edit-address">العنوان</label><input id="order-edit-address" class="form-control" /></div>
                <div class="form-group"><label for="order-edit-delivery">نوع التوصيل</label><select id="order-edit-delivery" class="form-control select-dark"><option value="home">منزل / محل</option><option value="desk">مكتب</option></select></div>
                <div class="form-group"><label for="order-edit-status">حالة الطلب</label><select id="order-edit-status" class="form-control select-dark">${orderStatusOptions('New')}</select></div>
                <div class="order-edit-items is-full">
                  <div class="order-edit-items-head"><strong><i class="fa-solid fa-boxes-stacked"></i> منتجات الطلب</strong><button type="button" id="add-order-item-btn" class="btn btn-outline-gold btn-sm"><i class="fa-solid fa-plus"></i> منتج</button></div>
                  <div id="order-edit-items-list"></div>
                </div>
                <div class="form-group"><label for="order-edit-shipping">تكلفة التوصيل</label><input id="order-edit-shipping" type="number" min="0" step="50" class="form-control" /></div>
                <div class="form-group"><label for="order-edit-notes">ملاحظة داخلية</label><input id="order-edit-notes" class="form-control" placeholder="لا تظهر للزبون" /></div>
                <div class="order-editor-summary is-full">
                  <div><small>الكراطين</small><strong id="order-edit-cartons">0</strong></div>
                  <div><small>المنتجات</small><strong id="order-edit-products-total">0 دج</strong></div>
                  <div><small>المجموع النهائي</small><strong id="order-edit-grand-total">0 دج</strong></div>
                </div>
              </div>
            </div>
            <div class="order-editor-footer">
              <button type="button" class="btn btn-outline-gold" id="cancel-order-editor">إلغاء</button>
              <button type="submit" class="btn btn-gold" id="save-order-editor"><i class="fa-solid fa-floppy-disk"></i> حفظ التعديلات</button>
            </div>
          </form>
        </div>
      </div>`);
  }
}

function getFilteredOrders() {
  let orders = [...Store.getOrders()];
  const searchKeyword = (document.getElementById('admin-orders-search')?.value || '').trim().toLocaleLowerCase();
  const deliveryFilter = document.getElementById('admin-orders-delivery-filter')?.value || 'all';
  const dateFilter = document.getElementById('admin-orders-date-filter')?.value || 'all';
  const sort = document.getElementById('admin-orders-sort')?.value || 'newest';

  if (activeOrderStatusFilter === 'progress') {
    orders = orders.filter(order => ['Confirmed', 'Shipped'].includes(normalizeOrderStatus(order.status)));
  } else if (activeOrderStatusFilter !== 'all') {
    orders = orders.filter(order => normalizeOrderStatus(order.status) === activeOrderStatusFilter);
  }
  if (deliveryFilter !== 'all') orders = orders.filter(order => order.deliveryType === deliveryFilter);

  if (dateFilter !== 'all') {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const threshold = dateFilter === 'today' ? startOfToday.getTime() : now - Number(dateFilter) * 86400000;
    orders = orders.filter(order => orderDateValue(order) >= threshold);
  }

  if (searchKeyword) {
    orders = orders.filter(order => {
      const searchable = [order.id, order.customerName, order.phone, order.wilaya, order.commune, order.address, order.adminNotes,
        ...orderItemsSnapshot(order).flatMap(item => [item.nameAr, item.nameFr, item.color])]
        .filter(Boolean).join(' ').toLocaleLowerCase();
      return searchable.includes(searchKeyword);
    });
  }

  orders.sort((a, b) => {
    if (sort === 'oldest') return orderDateValue(a) - orderDateValue(b);
    if (sort === 'highest') return adminNumber(b.totalAmount) - adminNumber(a.totalAmount);
    if (sort === 'lowest') return adminNumber(a.totalAmount) - adminNumber(b.totalAmount);
    return orderDateValue(b) - orderDateValue(a);
  });
  return orders;
}

function updateOrderKpis(allOrders, filteredOrders) {
  const metrics = calculateOrderMetrics(allOrders);
  const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
  setText('orders-kpi-new', metrics.newCount);
  setText('orders-kpi-progress', metrics.inProgress);
  setText('orders-kpi-delivered', metrics.delivered);
  setText('orders-kpi-revenue', formatAdminDzd(metrics.completedRevenue));
  setText('orders-kpi-average', formatAdminDzd(metrics.averageOrder));
  setText('orders-results-count', `عرض ${filteredOrders.length} من ${allOrders.length} طلب`);
  setText('orders-results-value', `القيمة: ${formatAdminDzd(filteredOrders.reduce((sum, order) => sum + adminNumber(order.totalAmount), 0))}`);

  const counts = { all: allOrders.length, New: 0, Confirmed: 0, Shipped: 0, Delivered: 0, Cancelled: 0 };
  allOrders.forEach(order => { counts[normalizeOrderStatus(order.status)] += 1; });
  document.querySelectorAll('#tab-orders .status-filter-btn').forEach(button => {
    const key = button.dataset.status;
    const label = key === 'all' ? 'الكل' : orderStatusMeta(key).label;
    button.innerHTML = `<span>${label}</span><b>${counts[key] || 0}</b>`;
    button.classList.toggle('active', activeOrderStatusFilter === key);
    button.setAttribute('aria-pressed', String(activeOrderStatusFilter === key));
  });
  document.querySelectorAll('#tab-orders [data-order-filter-status]').forEach(button => {
    const key = button.dataset.orderFilterStatus;
    const isActive = key === 'progress'
      ? activeOrderStatusFilter === 'progress'
      : activeOrderStatusFilter === key;
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function renderOrderItemsCompact(order, limit = 3) {
  const items = orderItemsSnapshot(order);
  const visible = items.slice(0, limit).map(item =>
    `<div><span><strong>${escapeAdminHtml(item.nameAr)}</strong> · ${escapeAdminHtml(item.color)}</span><b>${item.seriesQty} كرطون</b></div>`
  ).join('');
  return `${visible}${items.length > limit ? `<small>+ ${items.length - limit} منتجات أخرى</small>` : ''}`;
}

function renderOrderActionButtons(order) {
  const id = escapeAdminHtml(order.id);
  return `
    <div class="order-action-grid">
      <button type="button" class="btn btn-outline-gold btn-sm edit-order-btn" data-id="${id}" aria-label="عرض وتعديل الطلب ${id}"><i class="fa-solid fa-pen"></i></button>
      <button type="button" class="btn btn-outline-white btn-sm copy-order-btn" data-id="${id}" aria-label="نسخ ملخص الطلب ${id}"><i class="fa-regular fa-copy"></i></button>
      <a href="${orderWhatsappLink(order)}" target="_blank" rel="noopener" class="btn btn-whatsapp btn-sm" aria-label="مراسلة الزبون على واتساب"><i class="fa-brands fa-whatsapp"></i></a>
      <button type="button" class="btn btn-danger-outline btn-sm delete-order-btn" data-id="${id}" aria-label="حذف الطلب ${id}"><i class="fa-solid fa-trash"></i></button>
    </div>`;
}

function setupOrdersTab() {
  ensureProfessionalOrdersUi();
  const tab = document.getElementById('tab-orders');
  const searchInput = document.getElementById('admin-orders-search');
  if (searchInput) searchInput.addEventListener('input', renderOrdersTab);
  ['admin-orders-date-filter', 'admin-orders-delivery-filter', 'admin-orders-sort'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderOrdersTab);
  });

  tab?.addEventListener('click', async event => {
    const statusFilter = event.target.closest('.status-filter-btn');
    const kpiFilter = event.target.closest('[data-order-filter-status]');
    const editButton = event.target.closest('.edit-order-btn');
    const copyButton = event.target.closest('.copy-order-btn');
    const deleteButton = event.target.closest('.delete-order-btn');
    const advancedFiltersButton = event.target.closest('#orders-advanced-filters-toggle');
    if (advancedFiltersButton) {
      const toolbar = advancedFiltersButton.closest('.orders-pro-toolbar');
      const isOpen = toolbar?.classList.toggle('show-advanced') || false;
      advancedFiltersButton.setAttribute('aria-expanded', String(isOpen));
      return;
    }
    if (statusFilter || kpiFilter) {
      activeOrderStatusFilter = (statusFilter || kpiFilter).dataset.status || (statusFilter || kpiFilter).dataset.orderFilterStatus || 'all';
      renderOrdersTab();
      return;
    }
    if (editButton) openOrderEditor(editButton.dataset.id);
    if (copyButton) await copyOrderSummary(copyButton.dataset.id);
    if (deleteButton) await deleteOrderWithConfirmation(deleteButton.dataset.id);
  });

  tab?.addEventListener('change', async event => {
    const select = event.target.closest('.order-status-select');
    if (!select || !requireAdminPermission('adminOrders')) return;
    const status = normalizeOrderStatus(select.value);
    const order = Store.getOrders().find(item => item.id === select.dataset.id);
    const user = getCurrentAdminUser();
    const history = [...(Array.isArray(order?.history) ? order.history : []), {
      action: 'status_changed', status, at: new Date().toISOString(), by: user?.name || user?.id || 'admin'
    }].slice(-30);
    select.disabled = true;
    try {
      const result = await Store.updateOrder(select.dataset.id, { status, history, updatedBy: user?.name || user?.id || 'admin' });
      notifyOrderMutationResult(result, {
        synced: `تم تحديث حالة الطلب إلى: ${orderStatusMeta(status).label} ومزامنتها.`,
        queued: `تم تحديث الحالة إلى: ${orderStatusMeta(status).label} محلياً، وستتزامن تلقائياً عند عودة الاتصال.`
      });
    } finally {
      if (select.isConnected) select.disabled = false;
    }
  });

  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    if (requireAdminPermission('adminOrders')) exportOrdersCsv(true);
  });
  document.getElementById('refresh-orders-btn')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.classList.add('is-loading');
    try {
      const refreshed = await Store.initSupabase(null, { force: true });
      renderOrdersTab();
      notifyAdmin(refreshed
        ? 'تم تحديث الطلبات من السحابة.'
        : 'تعذر الاتصال بالسحابة؛ ما زالت النسخة المحلية ظاهرة ويمكنك المحاولة لاحقًا.');
    } catch (error) {
      console.error('Orders refresh failed:', error);
      notifyAdmin('تعذر تحديث الطلبات الآن. تحقق من الاتصال وحاول مرة أخرى.');
    } finally {
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  });
  document.getElementById('clear-orders-btn')?.addEventListener('click', async () => {
    if (!requireAdminPermission('adminOrders') || getCurrentAdminUser()?.id !== 'usr_super_admin') return;
    const phrase = prompt('هذه العملية تحذف جميع الطلبات نهائيًا. اكتب: حذف الكل');
    if (phrase?.trim() === 'حذف الكل') {
      const result = await Store.clearOrders();
      notifyOrderMutationResult(result, {
        synced: 'تم حذف سجل الطلبات بالكامل ومزامنة الحذف.',
        queued: 'تم حذف سجل الطلبات من هذا الجهاز، وستتم مزامنة الحذف تلقائياً عند عودة الاتصال.'
      });
    }
  });

  setupOrderEditor();
}

function renderOrdersTab() {
  if (!hasAdminPermission('adminOrders')) return;
  ensureProfessionalOrdersUi();
  const tbody = document.getElementById('admin-orders-tbody');
  const mobileList = document.getElementById('admin-orders-mobile-list');
  const countBadge = document.getElementById('admin-orders-tab-count');
  const clearButton = document.getElementById('clear-orders-btn');
  if (clearButton) clearButton.hidden = getCurrentAdminUser()?.id !== 'usr_super_admin';
  if (!tbody || !mobileList) return;

  const allOrders = Store.getOrders();
  const orders = getFilteredOrders();
  if (countBadge) countBadge.textContent = allOrders.length;
  updateOrderKpis(allOrders, orders);

  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="admin-table-empty-cell" style="text-align:center;padding:30px;color:var(--muted);">لا توجد طلبات مطابقة للفلاتر</td></tr>';
    mobileList.innerHTML = '<div class="admin-empty-state"><i class="fa-solid fa-magnifying-glass"></i><strong>لا توجد نتائج</strong><small>غيّر البحث أو الفلاتر لعرض طلبات أخرى.</small></div>';
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const status = orderStatusMeta(order.status);
    const items = orderItemsSnapshot(order);
    const phoneHref = String(order.phone || '').replace(/[^\d+]/g, '');
    return `
      <tr data-order-id="${escapeAdminHtml(order.id)}">
        <td><strong>#${escapeAdminHtml(order.id)}</strong></td>
        <td><small>${escapeAdminHtml(order.timestamp || '')}</small></td>
        <td><strong>${escapeAdminHtml(order.customerName)}</strong>${order.adminNotes ? '<br/><small class="text-muted"><i class="fa-solid fa-note-sticky"></i> ملاحظة</small>' : ''}</td>
        <td><a href="tel:${phoneHref}" dir="ltr">${escapeAdminHtml(order.phone)}</a></td>
        <td>${escapeAdminHtml(order.wilaya)}<br/><small class="text-muted">${escapeAdminHtml(order.commune || '')}</small></td>
        <td>${escapeAdminHtml(order.deliveryLabel || (order.deliveryType === 'home' ? 'منزل / محل' : 'مكتب'))}</td>
        <td><div class="order-items-compact">${renderOrderItemsCompact(order, 2)}</div></td>
        <td>${items.reduce((sum, item) => sum + item.seriesQty, 0)} كرطون</td>
        <td><strong>${formatAdminDzd(order.totalAmount)}</strong></td>
        <td><select class="order-status-select is-${status.key.toLowerCase()}" data-status="${status.key}" data-id="${escapeAdminHtml(order.id)}" aria-label="حالة الطلب ${escapeAdminHtml(order.id)}">${orderStatusOptions(status.key)}</select></td>
        <td>${renderOrderActionButtons(order)}</td>
      </tr>`;
  }).join('');

  mobileList.innerHTML = orders.map(order => {
    const status = orderStatusMeta(order.status);
    const phoneHref = String(order.phone || '').replace(/[^\d+]/g, '');
    return `
      <article class="order-mobile-card is-${status.key.toLowerCase()}" data-order-id="${escapeAdminHtml(order.id)}">
        <div class="order-mobile-head">
          <div><h4>#${escapeAdminHtml(order.id)}</h4><small>${escapeAdminHtml(order.timestamp || '')}</small></div>
          <select class="order-status-select is-${status.key.toLowerCase()}" data-status="${status.key}" data-id="${escapeAdminHtml(order.id)}" aria-label="حالة الطلب ${escapeAdminHtml(order.id)}">${orderStatusOptions(status.key)}</select>
        </div>
        <div class="order-mobile-customer">
          <i class="fa-solid fa-user"></i>
          <div><strong>${escapeAdminHtml(order.customerName)}</strong><a href="tel:${phoneHref}" dir="ltr">${escapeAdminHtml(order.phone)}</a></div>
          <strong class="text-gold">${formatAdminDzd(order.totalAmount)}</strong>
        </div>
        <div class="order-mobile-meta">
          <div><small>المكان</small><strong>${escapeAdminHtml(order.wilaya)} · ${escapeAdminHtml(order.commune || '')}</strong></div>
          <div><small>التوصيل</small><strong>${escapeAdminHtml(order.deliveryLabel || (order.deliveryType === 'home' ? 'منزل / محل' : 'مكتب'))}</strong></div>
          <div><small>الكمية</small><strong>${orderCartonCount(order)} كرطون</strong></div>
          <div><small>الحالة</small><strong>${status.label}</strong></div>
        </div>
        <div class="order-mobile-items">${renderOrderItemsCompact(order)}</div>
        <div class="order-mobile-actions">
          <button type="button" class="btn btn-gold edit-order-btn" data-id="${escapeAdminHtml(order.id)}"><i class="fa-solid fa-pen"></i> تعديل</button>
          <button type="button" class="btn btn-outline-gold copy-order-btn" data-id="${escapeAdminHtml(order.id)}"><i class="fa-regular fa-copy"></i> نسخ</button>
          <a href="${orderWhatsappLink(order)}" target="_blank" rel="noopener" class="btn btn-whatsapp"><i class="fa-brands fa-whatsapp"></i> واتساب</a>
          <button type="button" class="btn btn-danger-outline delete-order-btn" data-id="${escapeAdminHtml(order.id)}" aria-label="حذف الطلب ${escapeAdminHtml(order.id)}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </article>`;
  }).join('');
}

function findOrderWilaya(value) {
  const normalized = String(value || '').trim().toLocaleLowerCase();
  return WILAYAS.find(wilaya => [wilaya.nameAr, wilaya.nameFr, String(wilaya.code)]
    .some(candidate => String(candidate || '').trim().toLocaleLowerCase() === normalized));
}

function populateOrderWilayaOptions(selectedValue = '') {
  const select = document.getElementById('order-edit-wilaya');
  if (!select) return null;
  const match = findOrderWilaya(selectedValue);
  const selectedName = match?.nameAr || String(selectedValue || '').trim();
  const unknownOption = selectedName && !match
    ? `<option value="${escapeAdminHtml(selectedName)}">${escapeAdminHtml(selectedName)}</option>`
    : '';
  select.innerHTML = `<option value="">اختر الولاية</option>${unknownOption}${WILAYAS.map(wilaya =>
    `<option value="${escapeAdminHtml(wilaya.nameAr)}">${wilaya.code} — ${escapeAdminHtml(wilaya.nameAr)} / ${escapeAdminHtml(wilaya.nameFr)}</option>`
  ).join('')}`;
  select.value = selectedName;
  return match;
}

function populateOrderCommuneOptions(wilayaValue = '', selectedValue = '') {
  const select = document.getElementById('order-edit-commune');
  if (!select) return;
  const wilaya = findOrderWilaya(wilayaValue);
  const communes = Array.from(new Set([...(wilaya?.communesAr || []), ...(wilaya?.communesFr || [])]
    .map(value => String(value || '').trim()).filter(Boolean)));
  const selected = String(selectedValue || '').trim();
  if (selected && !communes.includes(selected)) communes.unshift(selected);
  select.innerHTML = `<option value="">اختر البلدية</option>${communes.map(commune =>
    `<option value="${escapeAdminHtml(commune)}">${escapeAdminHtml(commune)}</option>`
  ).join('')}`;
  select.value = selected;
}

function renderOrderEditorItems() {
  const root = document.getElementById('order-edit-items-list');
  if (!root) return;
  root.innerHTML = editingOrderItems.map((item, index) => `
    <div class="order-edit-item" data-index="${index}">
      <div class="form-group"><label for="order-item-name-${index}">المنتج</label><input id="order-item-name-${index}" class="form-control order-item-field" data-field="nameAr" value="${escapeAdminHtml(item.nameAr)}" required /></div>
      <div class="form-group"><label for="order-item-color-${index}">الألوان</label><input id="order-item-color-${index}" class="form-control order-item-field" data-field="color" value="${escapeAdminHtml(item.color)}" /></div>
      <div class="form-group"><label for="order-item-qty-${index}">الكراطين</label><input id="order-item-qty-${index}" type="number" min="1" class="form-control order-item-field" data-field="seriesQty" value="${item.seriesQty}" /></div>
      <div class="form-group"><label for="order-item-price-${index}">السعر الإجمالي</label><input id="order-item-price-${index}" type="number" min="0" class="form-control order-item-field" data-field="price" value="${adminNumber(item.price)}" /></div>
      <button type="button" class="btn btn-danger-outline remove-order-item-btn" data-index="${index}" aria-label="حذف المنتج"><i class="fa-solid fa-trash"></i></button>
    </div>`).join('');
  recalculateOrderEditor();
}

function recalculateOrderEditor() {
  const productTotal = editingOrderItems.reduce((sum, item) => sum + adminNumber(item.price), 0);
  const cartons = editingOrderItems.reduce((sum, item) => sum + Math.max(1, parseInt(item.seriesQty, 10) || 1), 0);
  const shipping = adminNumber(document.getElementById('order-edit-shipping')?.value);
  const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
  setText('order-edit-cartons', `${cartons} كرطون`);
  setText('order-edit-products-total', formatAdminDzd(productTotal));
  setText('order-edit-grand-total', formatAdminDzd(productTotal + shipping));
}

function openOrderEditor(orderId) {
  if (!requireAdminPermission('adminOrders')) return;
  const order = Store.getOrders().find(item => item.id === orderId);
  const modal = document.getElementById('order-editor-modal');
  if (!order || !modal) return;
  editingOrderId = order.id;
  orderEditorOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  editingOrderItems = orderItemsSnapshot(order).map(item => ({ ...item }));
  const setValue = (id, value) => { const element = document.getElementById(id); if (element) element.value = value ?? ''; };
  setValue('order-edit-customer', order.customerName);
  setValue('order-edit-phone', order.phone);
  const selectedWilaya = populateOrderWilayaOptions(order.wilaya);
  populateOrderCommuneOptions(selectedWilaya?.nameAr || order.wilaya, order.commune);
  setValue('order-edit-address', order.address);
  setValue('order-edit-delivery', order.deliveryType || 'home');
  setValue('order-edit-status', normalizeOrderStatus(order.status));
  setValue('order-edit-shipping', adminNumber(order.shippingFee));
  setValue('order-edit-notes', order.adminNotes || '');
  document.getElementById('order-editor-reference').textContent = `#${order.id} · ${order.timestamp || ''}`;
  renderOrderEditorItems();
  modal.scrollTop = 0;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('order-edit-customer')?.focus(), 80);
}

function closeOrderEditor(force = false) {
  if (orderEditorSaving && !force) return;
  const modal = document.getElementById('order-editor-modal');
  modal?.classList.remove('active');
  modal?.setAttribute('aria-hidden', 'true');
  editingOrderId = null;
  editingOrderItems = [];
  const opener = orderEditorOpener;
  orderEditorOpener = null;
  if (opener?.isConnected) setTimeout(() => opener.focus(), 0);
}

function setupOrderEditor() {
  const modal = document.getElementById('order-editor-modal');
  const form = document.getElementById('order-editor-form');
  if (!modal || !form || modal.dataset.bound === 'true') return;
  modal.dataset.bound = 'true';
  document.getElementById('close-order-editor')?.addEventListener('click', () => closeOrderEditor());
  document.getElementById('cancel-order-editor')?.addEventListener('click', () => closeOrderEditor());
  modal.addEventListener('click', event => { if (event.target === modal) closeOrderEditor(); });
  document.getElementById('order-edit-shipping')?.addEventListener('input', recalculateOrderEditor);
  document.getElementById('order-edit-wilaya')?.addEventListener('change', event => {
    populateOrderCommuneOptions(event.currentTarget.value, '');
  });
  document.getElementById('add-order-item-btn')?.addEventListener('click', () => {
    editingOrderItems.push({ productId: `manual-${Date.now()}`, nameAr: 'منتج جديد', nameFr: 'Produit', color: 'افتراضي', seriesQty: 1, pairsCount: 0, pairsPerSeries: 18, seriesPrice: 0, price: 0 });
    renderOrderEditorItems();
  });
  document.getElementById('order-edit-items-list')?.addEventListener('input', event => {
    const input = event.target.closest('.order-item-field');
    const row = event.target.closest('.order-edit-item');
    if (!input || !row) return;
    const index = Number(row.dataset.index);
    const item = editingOrderItems[index];
    if (!item) return;
    const field = input.dataset.field;
    if (field === 'seriesQty') {
      const oldQty = Math.max(1, parseInt(item.seriesQty, 10) || 1);
      const unitPrice = adminNumber(item.seriesPrice) || adminNumber(item.price) / oldQty;
      item.seriesQty = Math.max(1, parseInt(input.value, 10) || 1);
      item.price = Math.round(unitPrice * item.seriesQty);
      item.pairsCount = item.seriesQty * (adminNumber(item.pairsPerSeries) || 18);
      const priceInput = row.querySelector('[data-field="price"]');
      if (priceInput) priceInput.value = item.price;
    } else if (field === 'price') {
      item.price = Math.max(0, adminNumber(input.value));
      item.seriesPrice = item.price / Math.max(1, item.seriesQty);
    } else {
      item[field] = input.value;
    }
    recalculateOrderEditor();
  });
  document.getElementById('order-edit-items-list')?.addEventListener('click', event => {
    const button = event.target.closest('.remove-order-item-btn');
    if (!button || editingOrderItems.length <= 1) return;
    editingOrderItems.splice(Number(button.dataset.index), 1);
    renderOrderEditorItems();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (orderEditorSaving || !editingOrderId || !requireAdminPermission('adminOrders')) return;
    const existing = Store.getOrders().find(order => order.id === editingOrderId);
    if (!existing || !editingOrderItems.length) return;
    const customerName = document.getElementById('order-edit-customer').value.trim();
    const phone = document.getElementById('order-edit-phone').value.trim();
    if (!customerName || !phone) {
      notifyAdmin('أدخل اسم الزبون ورقم الهاتف قبل الحفظ.');
      return;
    }
    const items = editingOrderItems.map(item => ({
      ...item,
      nameAr: String(item.nameAr || 'منتج').trim(),
      nameFr: String(item.nameFr || item.nameAr || 'Produit').trim(),
      color: String(item.color || 'افتراضي').trim(),
      seriesQty: Math.max(1, parseInt(item.seriesQty, 10) || 1),
      pairsPerSeries: Math.max(1, parseInt(item.pairsPerSeries, 10) || 18),
      pairsCount: Math.max(1, parseInt(item.seriesQty, 10) || 1) * Math.max(1, parseInt(item.pairsPerSeries, 10) || 18),
      seriesPrice: adminNumber(item.seriesPrice) || adminNumber(item.price) / Math.max(1, parseInt(item.seriesQty, 10) || 1),
      price: Math.max(0, adminNumber(item.price))
    }));
    const productPrice = items.reduce((sum, item) => sum + item.price, 0);
    const shippingFee = Math.max(0, adminNumber(document.getElementById('order-edit-shipping').value));
    const totalCartons = items.reduce((sum, item) => sum + item.seriesQty, 0);
    const deliveryType = document.getElementById('order-edit-delivery').value === 'desk' ? 'desk' : 'home';
    const user = getCurrentAdminUser();
    const actor = user?.name || user?.id || 'admin';
    const editedAt = new Date().toISOString();
    const nextStatus = normalizeOrderStatus(document.getElementById('order-edit-status').value);
    const statusHistory = nextStatus !== normalizeOrderStatus(existing.status)
      ? [{ action: 'status_changed', status: nextStatus, at: editedAt, by: actor }]
      : [];
    const history = [
      ...(Array.isArray(existing.history) ? existing.history : []),
      ...statusHistory,
      { action: 'edited', at: editedAt, by: actor }
    ].slice(-30);
    const orderId = editingOrderId;
    const saveButton = document.getElementById('save-order-editor');
    const saveButtonHtml = saveButton?.innerHTML || '';
    orderEditorSaving = true;
    form.setAttribute('aria-busy', 'true');
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جارٍ الحفظ...';
    }
    try {
      const result = await Store.updateOrder(orderId, {
        customerName,
        phone,
        wilaya: document.getElementById('order-edit-wilaya').value.trim(),
        commune: document.getElementById('order-edit-commune').value.trim(),
        address: document.getElementById('order-edit-address').value.trim(),
        deliveryType,
        deliveryLabel: deliveryType === 'home' ? 'توصيل للمنزل / المحل' : 'توصيل للمكتب',
        status: nextStatus,
        adminNotes: document.getElementById('order-edit-notes').value.trim(),
        items,
        productName: items.length === 1 ? items[0].nameAr : `طلب موحد (${items.length} موديلات)`,
        color: items[0]?.color || 'افتراضي',
        seriesQty: `${totalCartons} كرطون`,
        productPrice,
        shippingFee,
        totalAmount: productPrice + shippingFee,
        updatedBy: actor,
        history
      });
      closeOrderEditor(true);
      notifyOrderMutationResult(result, {
        synced: `تم حفظ تعديلات الطلب #${orderId} ومزامنتها.`,
        queued: `تم حفظ تعديلات الطلب #${orderId} محلياً، وستتزامن تلقائياً عند عودة الاتصال.`
      });
    } catch (error) {
      console.error('Order editor save failed:', error);
      notifyAdmin('تعذر إكمال حفظ الطلب الآن. راجع البيانات وحاول مرة أخرى.');
    } finally {
      orderEditorSaving = false;
      form.removeAttribute('aria-busy');
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.innerHTML = saveButtonHtml;
      }
    }
  });
}

async function copyOrderSummary(orderId) {
  const order = Store.getOrders().find(item => item.id === orderId);
  if (!order) return;
  const lines = [
    `طلب #${order.id}`,
    `الزبون: ${order.customerName || ''}`,
    `الهاتف: ${order.phone || ''}`,
    `المكان: ${order.wilaya || ''} - ${order.commune || ''}`,
    ...orderItemsSnapshot(order).map(item => `• ${item.nameAr} (${item.color}) × ${item.seriesQty} كرطون`),
    `المجموع: ${formatAdminDzd(order.totalAmount)}`,
    `الحالة: ${orderStatusMeta(order.status).label}`
  ];
  const text = lines.join('\n');
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  notifyAdmin('تم نسخ ملخص الطلب.');
}

async function deleteOrderWithConfirmation(orderId) {
  if (!requireAdminPermission('adminOrders')) return;
  const order = Store.getOrders().find(item => item.id === orderId);
  if (!order) return;
  if (confirm(`حذف الطلب #${orderId} الخاص بـ ${order.customerName || 'الزبون'} نهائيًا؟`)) {
    const result = await Store.deleteOrder(orderId);
    notifyOrderMutationResult(result, {
      synced: `تم حذف الطلب #${orderId} ومزامنة الحذف.`,
      queued: `تم حذف الطلب #${orderId} من هذا الجهاز، وستتم مزامنة الحذف تلقائياً عند عودة الاتصال.`
    });
  }
}

function csvCell(value) {
  let text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportOrdersCsv(useCurrentFilters = false) {
  if (!requireAdminPermission('adminOrders')) return;
  const orders = useCurrentFilters ? getFilteredOrders() : Store.getOrders();
  if (!orders.length) {
    notifyAdmin('لا توجد طلبات مطابقة للتصدير.');
    return;
  }
  const rows = [[
    'Order', 'Date ISO', 'Display Date', 'Customer', 'Phone', 'Wilaya', 'Commune', 'Address', 'Delivery',
    'Product', 'Color', 'Cartons', 'Item Price', 'Shipping', 'Order Total', 'Status', 'Admin Notes'
  ]];
  orders.forEach(order => {
    orderItemsSnapshot(order).forEach((item, itemIndex) => rows.push([
      order.id, order.createdAt || '', order.timestamp || '', order.customerName, order.phone, order.wilaya, order.commune,
      order.address, order.deliveryLabel || order.deliveryType, item.nameAr, item.color, item.seriesQty, item.price,
      itemIndex === 0 ? order.shippingFee : '', itemIndex === 0 ? order.totalAmount : '', orderStatusMeta(order.status).label, order.adminNotes || ''
    ]));
  });
  const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `joulane_orders_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ==========================================================================
   TAB 5: SHIPPING RATES
   ========================================================================== */
function setupShippingTab() {
  const saveBtn = document.getElementById('save-shipping-btn');
  if (saveBtn) {
    saveBtn.onclick = () => {
      if (!requireAdminPermission('adminShipping')) return;
      const tbody = document.getElementById('shipping-rates-tbody');
      if (!tbody) return;
      const rates = {
        _showPrices: document.getElementById('show-delivery-prices-toggle')?.checked === true
      };
      tbody.querySelectorAll('tr').forEach(tr => {
        const code = tr.dataset.code;
        const homeInput = tr.querySelector('.ship-home-input');
        const deskInput = tr.querySelector('.ship-desk-input');
        if (code && homeInput && deskInput) {
          rates[code] = {
            homePrice: parseFloat(homeInput.value) || 0,
            deskPrice: parseFloat(deskInput.value) || 0
          };
        }
      });
      Store.saveShippingRates(rates);
      alert('تم حفظ تعديلات أسعار التوصيل بنجاح!');
    };
  }
}

function renderShippingTab() {
  if (!hasAdminPermission('adminShipping')) return;
  const tbody = document.getElementById('shipping-rates-tbody');
  if (!tbody) return;

  const currentRates = Store.getShippingRates();
  const showPricesToggle = document.getElementById('show-delivery-prices-toggle');
  if (showPricesToggle) showPricesToggle.checked = currentRates._showPrices === true;

  tbody.innerHTML = WILAYAS.map(w => {
    const rate = currentRates[w.code] || { homePrice: w.homePrice, deskPrice: w.deskPrice };
    return `
      <tr data-code="${w.code}">
        <td><strong>${w.code}</strong></td>
        <td>${w.nameAr}</td>
        <td>${w.nameFr}</td>
        <td><input type="number" class="form-control ship-home-input" value="${rate.homePrice}" style="width: 120px;" /></td>
        <td><input type="number" class="form-control ship-desk-input" value="${rate.deskPrice}" style="width: 120px;" /></td>
      </tr>
    `;
  }).join('');
}

function normalizeWhatsAppPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `213${digits.slice(1)}`;
  return digits;
}

function createStockRecipientField(recipient = {}, index = 0) {
  const row = document.createElement('div');
  row.className = 'stock-recipient-field';
  row.dataset.recipientId = recipient.id || `recipient_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  row.innerHTML = `
    <span class="stock-recipient-number"></span>
    <div class="form-group">
      <label>اسم المستلم</label>
      <input type="text" class="form-control stock-recipient-name" autocomplete="off" placeholder="مثال: مسؤول الإدارة" />
    </div>
    <div class="form-group">
      <label>رقم واتساب</label>
      <input type="tel" inputmode="tel" dir="ltr" class="form-control stock-recipient-phone" autocomplete="tel" placeholder="+213 555 000 000" />
    </div>
    <button type="button" class="stock-recipient-remove" aria-label="حذف هذا المستلم" title="حذف المستلم">
      <i class="fa-solid fa-trash-can"></i>
    </button>
  `;
  row.querySelector('.stock-recipient-name').value = recipient.name || '';
  row.querySelector('.stock-recipient-phone').value = recipient.phone || '';
  updateStockRecipientFieldIndex(row, index);
  return row;
}

function updateStockRecipientFieldIndex(row, index) {
  row.dataset.recipientIndex = String(index);
  const fieldNumber = index + 1;
  const nameInput = row.querySelector('.stock-recipient-name');
  const phoneInput = row.querySelector('.stock-recipient-phone');
  const labels = row.querySelectorAll('label');
  row.querySelector('.stock-recipient-number').textContent = String(fieldNumber);
  nameInput.id = `stock-recipient-name-${fieldNumber}`;
  phoneInput.id = `stock-recipient-phone-${fieldNumber}`;
  if (labels[0]) labels[0].htmlFor = nameInput.id;
  if (labels[1]) labels[1].htmlFor = phoneInput.id;
}

function renumberStockRecipientFields(fields) {
  fields.querySelectorAll('.stock-recipient-field').forEach(updateStockRecipientFieldIndex);
}

function populateStockReceiptRecipientsForm() {
  const card = document.getElementById('stock-receipt-settings-card');
  if (!card) return;

  const isSuperAdmin = getCurrentAdminUser()?.id === 'usr_super_admin';
  card.hidden = !isSuperAdmin;
  if (!isSuperAdmin) return;

  const recipients = Store.getStockNotificationSettings().recipients || [];
  const fields = document.getElementById('stock-recipients-fields');
  if (!fields) return;
  fields.replaceChildren(...recipients.map(createStockRecipientField));
}

function setupStockReceiptRecipientsForm() {
  const form = document.getElementById('stock-receipt-recipients-form');
  const card = document.getElementById('stock-receipt-settings-card');
  const status = document.getElementById('stock-recipients-status');
  const saveButton = document.getElementById('save-stock-recipients-btn');
  const addButton = document.getElementById('add-stock-recipient-btn');
  const fields = document.getElementById('stock-recipients-fields');
  if (!form || !card || !fields) return;

  populateStockReceiptRecipientsForm();
  if (form.dataset.bound) return;
  form.dataset.bound = 'true';

  addButton?.addEventListener('click', () => {
    const index = fields.querySelectorAll('.stock-recipient-field').length;
    const row = createStockRecipientField({}, index);
    fields.appendChild(row);
    row.querySelector('.stock-recipient-name')?.focus();
    if (status) status.textContent = '';
  });

  fields?.addEventListener('click', (event) => {
    const removeButton = event.target.closest('.stock-recipient-remove');
    if (!removeButton) return;
    removeButton.closest('.stock-recipient-field')?.remove();
    renumberStockRecipientFields(fields);
    if (status) status.textContent = 'اضغط حفظ لتأكيد حذف المستلم.';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (getCurrentAdminUser()?.id !== 'usr_super_admin') {
      if (status) status.textContent = 'هذه الإعدادات متاحة للمدير العام فقط.';
      return;
    }

    const recipients = [];
    let hasIncompleteRow = false;
    form.querySelectorAll('.stock-recipient-field').forEach((row, index) => {
      const name = row.querySelector('.stock-recipient-name')?.value.trim() || '';
      const phoneValue = row.querySelector('.stock-recipient-phone')?.value.trim() || '';
      if (!name && !phoneValue) return;
      if (!name || !phoneValue) {
        hasIncompleteRow = true;
        return;
      }
      recipients.push({
        id: row.dataset.recipientId || `recipient_${index + 1}`,
        name,
        phone: normalizeWhatsAppPhone(phoneValue)
      });
    });

    const uniquePhones = new Set(recipients.map(recipient => recipient.phone));
    if (hasIncompleteRow) {
      if (status) status.textContent = 'أكمل الاسم والرقم في كل سطر مستخدم.';
      return;
    }
    if (recipients.some(recipient => recipient.phone.length < 8 || recipient.phone.length > 15)) {
      if (status) status.textContent = 'تحقق من أرقام واتساب واكتبها مع رمز الدولة.';
      return;
    }
    if (uniquePhones.size !== recipients.length) {
      if (status) status.textContent = 'لا يمكن تكرار رقم واتساب نفسه.';
      return;
    }

    if (saveButton) saveButton.disabled = true;
    if (status) status.textContent = 'جاري حفظ القائمة في التخزين السحابي...';
    try {
      const saved = await Store.saveStockNotificationSettings({ recipients });
      if (!saved) throw new Error('Cloud save failed');
      if (status) status.textContent = 'تم حفظ قائمة المستلمين وتفعيلها في المخزن.';
      populateStockReceiptRecipientsForm();
    } catch (error) {
      if (status) status.textContent = 'تعذر حفظ القائمة. تحقق من الاتصال ثم حاول مجدداً.';
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  });

  window.addEventListener('joulane:stockNotificationSettingsUpdated', populateStockReceiptRecipientsForm);
}

/* ==========================================================================
   TAB 6: SETTINGS & SECURITY
   ========================================================================== */
function setupSettingsTab(refreshMainStoreFn) {
  // Passcode form
  const passForm = document.getElementById('change-pass-form');
  if (passForm) {
    passForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!requireAdminPermission('adminSettings')) return;
      const newPass = document.getElementById('new-admin-pass').value.trim();
      if (newPass.length < 3) {
        alert('يرجى كتابة كلمة مرور تتكون من 3 أحرف على الأقل.');
        return;
      }
      Store.setPasscode(newPass);
      document.getElementById('new-admin-pass').value = '';
      alert('تم تغيير كلمة مرور الإدارة بنجاح!');
    });
  }

  // Export JSON Backup
  document.getElementById('export-backup-btn')?.addEventListener('click', () => {
    if (!requireAdminPermission('adminSettings')) return;
    const data = Store.exportAllData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `joulane_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  });

  // Import JSON Backup
  document.getElementById('import-backup-file')?.addEventListener('change', (e) => {
    if (!requireAdminPermission('adminSettings')) return;
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (Store.importAllData(parsed)) {
            alert('تم استرجاع نسخة البيانات واستيراد المتجر بنجاح!');
            renderOverviewTab();
            renderProductsTab();
            renderCategoriesTab();
            populateCmsForm();
            renderOrdersTab();
            renderShippingTab();
            if (refreshMainStoreFn) refreshMainStoreFn();
          }
        } catch (err) {
          alert('خطأ: الملف المرفق ليس ملف نسخة احتياطية صالح (JSON).');
        }
      };
      reader.readAsText(file);
    }
  });

  // Reset Factory
  document.getElementById('reset-store-btn')?.addEventListener('click', () => {
    if (!requireAdminPermission('adminSettings')) return;
    if (confirm('تنبيه هام: هل أنت تأكد من رغبتك في إعادة ضبط المتجر للقيم الافتراضية؟ سيتم مسح المنتجات والنصوص المخصصة.')) {
      Store.resetToDefaults();
      alert('تم إعادة ضبط المتجر بنجاح!');
      renderOverviewTab();
      renderProductsTab();
      renderCategoriesTab();
      populateCmsForm();
      renderOrdersTab();
      renderShippingTab();
      if (refreshMainStoreFn) refreshMainStoreFn();
    }
  });
}

/* ==========================================================================
   TAB: INVENTORY MANAGEMENT (Gestion de Stock)
   ========================================================================== */
function renderInventoryTab() {
  const tbody = document.getElementById('admin-inventory-tbody');
  if (!tbody) return;

  const products = Store.getProducts();

  // Compute Inventory Stats
  let totalSeries = 0;
  let inStockCount = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  products.forEach(p => {
    const qty = typeof p.seriesQty === 'number' ? p.seriesQty : (p.stockStatus === 'out_of_stock' ? 0 : (p.stockStatus === 'low_stock' ? 3 : 15));
    totalSeries += qty;
    if (p.stockStatus === 'out_of_stock' || qty === 0) outOfStockCount++;
    else if (p.stockStatus === 'low_stock' || qty <= 5) lowStockCount++;
    else inStockCount++;
  });

  const invTotalEl = document.getElementById('inv-stat-total-series');
  if (invTotalEl) invTotalEl.textContent = totalSeries.toLocaleString();

  const invInStockEl = document.getElementById('inv-stat-instock');
  if (invInStockEl) invInStockEl.textContent = inStockCount.toLocaleString();

  const invLowStockEl = document.getElementById('inv-stat-lowstock');
  if (invLowStockEl) invLowStockEl.textContent = lowStockCount.toLocaleString();

  const invOutOfStockEl = document.getElementById('inv-stat-outofstock');
  if (invOutOfStockEl) invOutOfStockEl.textContent = outOfStockCount.toLocaleString();

  // Search and Filter
  const searchVal = (document.getElementById('admin-inventory-search')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('admin-inventory-status-filter')?.value || 'all';

  let filtered = products;

  if (statusFilter !== 'all') {
    filtered = filtered.filter(p => (p.stockStatus || 'in_stock') === statusFilter);
  }

  if (searchVal) {
    filtered = filtered.filter(p =>
      (p.id && p.id.toLowerCase().includes(searchVal)) ||
      (p.name?.ar && p.name.ar.toLowerCase().includes(searchVal)) ||
      (p.name?.fr && p.name.fr.toLowerCase().includes(searchVal))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 30px; color: var(--muted);">لا توجد موديلات مطابقة في المخزون</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const stockStatus = p.stockStatus || 'in_stock';
    const seriesQty = typeof p.seriesQty === 'number' ? p.seriesQty : (stockStatus === 'out_of_stock' ? 0 : (stockStatus === 'low_stock' ? 3 : 15));
    const isAvailable = p.isAvailable !== false;
    const nameAr = p.name?.ar || p.name || 'منتج بدون اسم';

    return `
      <tr data-id="${p.id}">
        <td>
          <img src="${p.image}" alt="${nameAr}" loading="lazy" decoding="async" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;" onerror="this.src='https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg';" />
        </td>
        <td>
          <strong>${nameAr}</strong>
          <div style="font-size: 0.8rem; color: var(--muted);">${p.id}</div>
        </td>
        <td>
          <div class="inv-qty-stepper">
            <button class="btn btn-sm btn-outline-gold inv-qty-minus" data-id="${p.id}">-</button>
            <span class="inv-qty-num" style="display:inline-block; min-width:80px; text-align:center; font-weight:bold;">${seriesQty} كرطون</span>
            <button class="btn btn-sm btn-outline-gold inv-qty-plus" data-id="${p.id}">+</button>
          </div>
        </td>
        <td>
          <div style="display:grid; gap:6px; min-width:170px;">
            <select class="form-control form-control-sm inv-availability-select" data-id="${p.id}">
              <option value="available" ${isAvailable ? 'selected' : ''}>ظاهر ومتاح للطلب</option>
              <option value="unavailable" ${!isAvailable ? 'selected' : ''}>موقوف وغير متاح</option>
            </select>
            <select class="form-control form-control-sm inv-status-select" data-id="${p.id}">
              <option value="in_stock" ${stockStatus === 'in_stock' ? 'selected' : ''}>رصيد جيد (In Stock)</option>
              <option value="low_stock" ${stockStatus === 'low_stock' ? 'selected' : ''}>رصيد منخفض (Low)</option>
              <option value="out_of_stock" ${stockStatus === 'out_of_stock' ? 'selected' : ''}>الرصيد صفر/سالب (Out)</option>
            </select>
          </div>
        </td>
        <td>
          <button class="btn btn-gold btn-sm quick-save-inv-btn" data-id="${p.id}">
            <i class="fa-solid fa-floppy-disk"></i> حفظ
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Event Listeners for Inventory table
  tbody.querySelectorAll('.inv-qty-minus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const p = Store.getProducts().find(item => item.id === id);
      if (p) {
        const currentQty = typeof p.seriesQty === 'number' ? p.seriesQty : 15;
        const newQty = Math.max(0, currentQty - 1);
        const newStatus = newQty === 0 ? 'out_of_stock' : (newQty <= 5 ? 'low_stock' : 'in_stock');
        Store.updateProduct(id, { seriesQty: newQty, stockStatus: newStatus });
        renderInventoryTab();
        window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
      }
    });
  });

  tbody.querySelectorAll('.inv-qty-plus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const p = Store.getProducts().find(item => item.id === id);
      if (p) {
        const currentQty = typeof p.seriesQty === 'number' ? p.seriesQty : 15;
        const newQty = currentQty + 1;
        const newStatus = newQty <= 5 ? 'low_stock' : 'in_stock';
        Store.updateProduct(id, { seriesQty: newQty, stockStatus: newStatus });
        renderInventoryTab();
        window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
      }
    });
  });

  tbody.querySelectorAll('.inv-status-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const id = e.currentTarget.dataset.id;
      const newStatus = e.currentTarget.value;
      const newQty = newStatus === 'out_of_stock' ? 0 : (newStatus === 'low_stock' ? 3 : 15);
      Store.updateProduct(id, { stockStatus: newStatus, seriesQty: newQty });
      renderInventoryTab();
      window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
    });
  });

  tbody.querySelectorAll('.inv-availability-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const id = e.currentTarget.dataset.id;
      Store.updateProduct(id, { isAvailable: e.currentTarget.value === 'available' });
      renderInventoryTab();
      window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
    });
  });

  tbody.querySelectorAll('.quick-save-inv-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      alert('تم تحديث حالة المخزون بنجاح!');
    });
  });
}

/* ==========================================================================
   MASTER PRICE TOGGLE BUTTONS
   ========================================================================== */
function setupPriceToggleButtons(refreshMainStoreFn) {
  const toggleBtn1 = document.getElementById('toggle-all-prices-btn');
  const toggleBtn2 = document.getElementById('quick-toggle-prices-btn');

  function updatePriceButtonsUI() {
    const isHidden = !!Store.getConfig().hideAllPrices;
    [toggleBtn1, toggleBtn2].forEach(btn => {
      if (!btn) return;
      btn.hidden = !hasAdminPermission('adminPrices');
      if (isHidden) {
        btn.classList.remove('btn-outline-gold');
        btn.classList.add('btn-warning');
        btn.innerHTML = `<i class="fa-solid fa-eye"></i> إظهار الأسعار بالمتجر`;
      } else {
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-outline-gold');
        btn.innerHTML = `<i class="fa-solid fa-eye-slash"></i> إخفاء كل الأسعار`;
      }
    });
  }

  updatePriceButtonsUI();

  // Guard: only bind click listeners ONCE per button
  [toggleBtn1, toggleBtn2].forEach(btn => {
    if (!btn || btn.dataset.priceToggleBound) return;
    btn.dataset.priceToggleBound = 'true';
    btn.addEventListener('click', () => {
      if (!requireAdminPermission('adminPrices')) return;
      const config = Store.getConfig();
      config.hideAllPrices = !config.hideAllPrices;
      Store.saveConfig(config);
      updatePriceButtonsUI();
      if (refreshMainStoreFn) refreshMainStoreFn();
      const statusText = config.hideAllPrices
        ? 'تم إخفاء جميع الأسعار من المتجر!'
        : 'تم إظهار الأسعار في المتجر!';
      window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: statusText }));
    });
  });
}

/* ==========================================================================
   SUPABASE LIVE CLOUD SYNC CONFIGURATION
   ========================================================================== */
function setupSupabaseConfigForm(refreshMainStoreFn) {
  const form = document.getElementById('supabase-config-form');
  const urlInput = document.getElementById('supabase-url-input');
  const keyInput = document.getElementById('supabase-key-input');
  const statusSpan = document.getElementById('supabase-sync-status');

  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';

  const config = Store.getConfig();
  if (urlInput) urlInput.value = config.supabaseUrl || '';
  if (keyInput) keyInput.value = config.supabaseAnonKey || '';
  
  if (statusSpan) {
    if (config.supabaseUrl && config.supabaseAnonKey) {
      statusSpan.textContent = '🟢 سينك متصل بنجاح مع Supabase';
      statusSpan.style.color = '#22c55e';
    } else {
      statusSpan.textContent = '⚪ غير مفعل حالياً (أدخل البيانات أعلاه)';
      statusSpan.style.color = '#94a3b8';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireAdminPermission('adminSettings')) return;
    const url = urlInput ? urlInput.value.trim() : '';
    const key = keyInput ? keyInput.value.trim() : '';

    const currentConfig = Store.getConfig();
    currentConfig.supabaseUrl = url;
    currentConfig.supabaseAnonKey = key;
    currentConfig.supabaseEnabled = !!(url && key);

    if (url && key) {
      if (statusSpan) {
        statusSpan.textContent = '⏳ جاري الاتصال والمزامنة مع Supabase...';
        statusSpan.style.color = '#f59e0b';
      }
      const saved = await Store.saveConfig(currentConfig);
      const ok = await Store.initSupabase(refreshMainStoreFn, { force: true });
      if (ok) {
        if (statusSpan) {
          statusSpan.textContent = saved
            ? '🟢 تم الاتصال وحفظ الإعدادات في السحابة.'
            : '🟡 تم الاتصال، والحفظ منتظر المزامنة.';
          statusSpan.style.color = '#22c55e';
        }
        window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: 'تم تفعيل الربط التلقائي والسينك مع Supabase!' }));
      } else {
        if (statusSpan) {
          statusSpan.textContent = '🔴 فشل الاتصال! يرجى التأكد من الرابط والمفتاح أو إنشاء الجدول.';
          statusSpan.style.color = '#ef4444';
        }
      }
    } else {
      await Store.saveConfig(currentConfig);
      if (statusSpan) {
        statusSpan.textContent = '⚪ تم تعطيل سينك Supabase.';
        statusSpan.style.color = '#94a3b8';
      }
      window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: 'تم تعطيل ربط Supabase.' }));
    }
  });
}

// --- Users & Permissions Management ---
function setupUsersTab() {
  const showBtn = document.getElementById('btn-show-add-user-form');
  const cancelBtn = document.getElementById('btn-cancel-user-form');
  const formCard = document.getElementById('admin-user-form-card');
  const form = document.getElementById('admin-user-form');

  if (showBtn && formCard) {
    showBtn.onclick = () => {
      if (!requireAdminPermission('adminUsers')) return;
      resetUserForm();
      formCard.classList.remove('hidden');
    };
  }

  if (cancelBtn && formCard) {
    cancelBtn.onclick = () => {
      formCard.classList.add('hidden');
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!requireAdminPermission('adminUsers')) return;
      const id = document.getElementById('user-form-id').value;
      const name = document.getElementById('user-name-input').value.trim();
      const role = document.getElementById('user-role-input').value.trim();
      const passcode = document.getElementById('user-passcode-input').value.trim();

      if (!id && passcode.length < 4) {
        alert('رمز الدخول للحساب الجديد يجب أن يتكون من 4 أحرف أو أرقام على الأقل.');
        return;
      }

      const allowStock = document.getElementById('user-perm-allow-stock').checked;
      const allowAdmin = document.getElementById('user-perm-allow-admin').checked;

      const permissions = {
        stockAdd: allowStock && document.getElementById('user-perm-stock-add').checked,
        stockRemove: allowStock && document.getElementById('user-perm-stock-remove').checked,
        stockSet: allowStock && document.getElementById('user-perm-stock-set').checked,
        stockViewLogs: allowStock && !!document.getElementById('user-perm-stock-view-logs')?.checked,
        stockClearLogs: allowStock && !!document.getElementById('user-perm-stock-clear-logs')?.checked,
        adminOverview: allowAdmin && !!document.getElementById('user-perm-admin-overview')?.checked,
        adminProducts: allowAdmin && !!document.getElementById('user-perm-admin-products')?.checked,
        adminPrices: allowAdmin && !!document.getElementById('user-perm-admin-prices')?.checked,
        adminContent: allowAdmin && !!document.getElementById('user-perm-admin-content')?.checked,
        adminOrders: allowAdmin && document.getElementById('user-perm-admin-orders').checked,
        adminShipping: allowAdmin && !!document.getElementById('user-perm-admin-shipping')?.checked,
        adminUsers: allowAdmin && !!document.getElementById('user-perm-admin-users')?.checked,
        adminSettings: allowAdmin && !!document.getElementById('user-perm-admin-settings')?.checked
      };

      if (id) {
        Store.updateUser(id, { name, role, passcode, allowStock, allowAdmin, permissions });
      } else {
        Store.addUser({ name, role, passcode, allowStock, allowAdmin, permissions });
      }

      const synced = await Store.waitForUserSync();
      const action = id ? 'تعديل' : 'إنشاء';
      const message = synced
        ? `تم ${action} حساب ${name} وحفظه في السحابة.`
        : `تم ${action} حساب ${name} على الجهاز، وسيعاد رفعه عند عودة الاتصال.`;
      window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: message }));

      formCard.classList.add('hidden');
      renderUsersTab();
    };
  }

  window.addEventListener('joulane:usersUpdated', () => renderUsersTab());
}

function resetUserForm() {
  document.getElementById('user-form-id').value = '';
  document.getElementById('user-name-input').value = '';
  document.getElementById('user-role-input').value = '';
  const passcodeInput = document.getElementById('user-passcode-input');
  passcodeInput.value = '';
  passcodeInput.required = true;
  passcodeInput.placeholder = '4 أحرف أو أرقام على الأقل';
  document.getElementById('user-perm-allow-stock').checked = true;
  document.getElementById('user-perm-allow-admin').checked = false;
  document.getElementById('user-perm-stock-add').checked = true;
  document.getElementById('user-perm-stock-remove').checked = true;
  document.getElementById('user-perm-stock-set').checked = false;
  if (document.getElementById('user-perm-stock-view-logs')) document.getElementById('user-perm-stock-view-logs').checked = true;
  if (document.getElementById('user-perm-stock-clear-logs')) document.getElementById('user-perm-stock-clear-logs').checked = false;
  ['overview', 'products', 'prices', 'content', 'orders', 'shipping', 'users', 'settings'].forEach(permission => {
    const checkbox = document.getElementById(`user-perm-admin-${permission}`);
    if (checkbox) checkbox.checked = false;
  });
  const title = document.getElementById('user-form-title');
  if (title) title.innerHTML = '<i class="fa-solid fa-user-plus"></i> إضافة حساب مسؤول جديد';
}

function renderUsersTab() {
  if (!hasAdminPermission('adminUsers')) return;
  const container = document.getElementById('admin-users-list');
  if (!container) return;

  const users = Store.getUsers();

  if (users.length === 0) {
    container.innerHTML = '<p class="text-muted text-center py-4">لا يوجد حسابات مسجلة.</p>';
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="table table-dark table-striped table-hover align-middle">
        <thead>
          <tr>
            <th>الاسم والصفة</th>
            <th>رمز الدخول (PIN)</th>
            <th>صلاحيات اللوحات</th>
            <th>صلاحيات العمليات</th>
            <th class="text-end">إجراءات</th>
          </tr>
        </thead>
        <tbody>
  `;

  users.forEach(u => {
    const isSuper = u.id === 'usr_super_admin';
    const allowStockBadge = u.allowStock ? '<span class="badge bg-success me-1">🟢 المخزن (#stock)</span>' : '<span class="badge bg-secondary me-1">⚪ مغلق</span>';
    const allowAdminBadge = u.allowAdmin ? '<span class="badge bg-warning text-dark me-1">👑 الإدارة (#admin)</span>' : '<span class="badge bg-secondary me-1">⚪ مغلق</span>';

    const p = u.permissions || {};
    let opsBadges = '';
    if (p.stockAdd) opsBadges += '<span class="badge bg-outline-success border border-success text-success me-1">+ إضافة</span>';
    if (p.stockRemove) opsBadges += '<span class="badge bg-outline-danger border border-danger text-danger me-1">- سحب</span>';
    if (p.stockSet) opsBadges += '<span class="badge bg-outline-info border border-info text-info me-1">= تعديل</span>';
    if (p.stockViewLogs) opsBadges += '<span class="badge bg-outline-info border border-info text-info me-1">سجل المخزن</span>';
    if (p.stockClearLogs) opsBadges += '<span class="badge bg-outline-danger border border-danger text-danger me-1">🗑️ تفريغ السجل</span>';
    if (p.adminOverview) opsBadges += '<span class="badge bg-outline-warning border border-warning text-warning me-1">الإحصائيات</span>';
    if (p.adminProducts) opsBadges += '<span class="badge bg-outline-warning border border-warning text-warning me-1">المنتجات</span>';
    if (p.adminPrices) opsBadges += '<span class="badge bg-outline-warning border border-warning text-warning me-1">الأسعار</span>';
    if (p.adminContent) opsBadges += '<span class="badge bg-outline-warning border border-warning text-warning me-1">الواجهة</span>';
    if (p.adminOrders) opsBadges += '<span class="badge bg-outline-warning border border-warning text-warning me-1">📦 الطلبات</span>';
    if (p.adminShipping) opsBadges += '<span class="badge bg-outline-warning border border-warning text-warning me-1">التوصيل</span>';
    if (p.adminUsers) opsBadges += '<span class="badge bg-outline-warning border border-warning text-warning me-1">الطاقم</span>';
    if (p.adminSettings) opsBadges += '<span class="badge bg-outline-warning border border-warning text-warning me-1">الإعدادات</span>';

    html += `
      <tr>
        <td>
          <div class="fw-bold text-gold">${u.name}</div>
          <small class="text-muted">${u.role || 'مسؤول'}</small>
        </td>
        <td>
          <span class="badge bg-success"><i class="fa-solid fa-shield-halved"></i> محفوظ بشكل مشفر</span>
        </td>
        <td>${allowStockBadge} ${allowAdminBadge}</td>
        <td>${opsBadges || '<span class="text-muted">قياسية</span>'}</td>
        <td class="text-end">
          ${isSuper ? '<span class="badge bg-secondary">حساب عام رئيسي</span>' : `
            <button type="button" class="btn btn-sm btn-outline-warning btn-edit-user me-1" data-id="${u.id}"><i class="fa-solid fa-pen-to-square"></i> تعديل</button>
            <button type="button" class="btn btn-sm btn-outline-danger btn-delete-user" data-id="${u.id}"><i class="fa-solid fa-trash-can"></i> حذف</button>
          `}
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;

  // Bind edit & delete buttons
  container.querySelectorAll('.btn-edit-user').forEach(btn => {
    btn.onclick = (e) => {
      if (!requireAdminPermission('adminUsers')) return;
      const id = e.currentTarget.dataset.id;
      const u = Store.getUsers().find(item => item.id === id);
      if (u) {
        document.getElementById('user-form-id').value = u.id;
        document.getElementById('user-name-input').value = u.name;
        document.getElementById('user-role-input').value = u.role;
        const passcodeInput = document.getElementById('user-passcode-input');
        passcodeInput.value = '';
        passcodeInput.required = false;
        passcodeInput.placeholder = 'اتركه فارغاً للإبقاء على الرمز الحالي';
        document.getElementById('user-perm-allow-stock').checked = !!u.allowStock;
        document.getElementById('user-perm-allow-admin').checked = !!u.allowAdmin;

        const p = u.permissions || {};
        document.getElementById('user-perm-stock-add').checked = !!p.stockAdd;
        document.getElementById('user-perm-stock-remove').checked = !!p.stockRemove;
        document.getElementById('user-perm-stock-set').checked = !!p.stockSet;
        if (document.getElementById('user-perm-stock-view-logs')) document.getElementById('user-perm-stock-view-logs').checked = !!p.stockViewLogs;
        if (document.getElementById('user-perm-stock-clear-logs')) document.getElementById('user-perm-stock-clear-logs').checked = !!p.stockClearLogs;
        document.getElementById('user-perm-admin-orders').checked = !!p.adminOrders;
        ['overview', 'products', 'prices', 'content', 'shipping', 'users', 'settings'].forEach(permission => {
          const checkbox = document.getElementById(`user-perm-admin-${permission}`);
          if (checkbox) checkbox.checked = !!p[`admin${permission.charAt(0).toUpperCase()}${permission.slice(1)}`];
        });

        const title = document.getElementById('user-form-title');
        if (title) title.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> تعديل حساب والصفة: ' + u.name;

        const formCard = document.getElementById('admin-user-form-card');
        if (formCard) formCard.classList.remove('hidden');
      }
    };
  });

  container.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.onclick = async (e) => {
      if (!requireAdminPermission('adminUsers')) return;
      const id = e.currentTarget.dataset.id;
      const u = Store.getUsers().find(item => item.id === id);
      if (u && confirm(`هل أنت تأكد من حذف حساب: ${u.name}؟`)) {
        Store.deleteUser(id);
        renderUsersTab();
        const synced = await Store.waitForUserSync();
        const message = synced
          ? 'تم حذف الحساب من السحابة بنجاح.'
          : 'تم حذف الحساب على الجهاز، وسيعاد رفع التغيير عند عودة الاتصال.';
        window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: message }));
      }
    };
  });
}
