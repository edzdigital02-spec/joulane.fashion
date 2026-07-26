import { Store } from './store.js';
import { WILAYAS } from './data/wilayas.js';

let isAdminLoggedIn = false;

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
  const CLOUD_NAME = 'envkmzcu';
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ml_default');
    
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
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
      if (tabTarget === 'users') renderUsersTab();
    });
  });

  mobileTabSelect?.addEventListener('change', () => {
    const targetButton = document.querySelector(`.admin-tab-btn[data-tab="${mobileTabSelect.value}"]`);
    if (targetButton && targetButton.style.display !== 'none') targetButton.click();
  });

  // Quick Action Buttons
  document.getElementById('quick-add-product-btn')?.addEventListener('click', () => {
    if (!requireAdminPermission('adminProducts')) return;
    if (!requireAdminPermission('adminPrices', 'إضافة منتج جديد تتطلب صلاحية إدارة الأسعار أيضًا.')) return;
    openProductEditor();
  });
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
  
  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const homeCount = orders.filter(o => o.deliveryType === 'home').length;
  const deskCount = orders.filter(o => o.deliveryType === 'desk').length;

  const revenueStat = document.getElementById('stat-total-revenue');
  const ordersStat = document.getElementById('stat-total-orders');
  const homeStat = document.getElementById('stat-home-count');
  if (revenueStat) revenueStat.closest('.stat-card').hidden = !canManageOrders;
  if (ordersStat) ordersStat.closest('.stat-card').hidden = !canManageOrders;
  if (homeStat) homeStat.closest('.stat-card').hidden = !canManageOrders;
  if (revenueStat) revenueStat.textContent = `${totalRevenue.toLocaleString('ar-DZ')} دج`;
  if (ordersStat) ordersStat.textContent = orders.length;
  document.getElementById('stat-total-products').textContent = products.length;
  if (homeStat) homeStat.textContent = `${homeCount} منزل / ${deskCount} مكتب`;

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

  tbody.innerHTML = orders.slice(0, 5).map(o => `
    <tr>
      <td><strong>#${o.id}</strong></td>
      <td><small>${o.timestamp || ''}</small></td>
      <td>${o.customerName}</td>
      <td><a href="tel:${o.phone}" dir="ltr">${o.phone}</a></td>
      <td>${o.wilaya} - ${o.commune}</td>
      <td><strong>${(o.totalAmount || 0).toLocaleString()} دج</strong></td>
      <td><span class="stock-badge in_stock">${o.status || 'جديد'}</span></td>
    </tr>
  `).join('');
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

    return `
      <div class="admin-product-card">
        <div class="admin-prod-top">
          <img src="${p.image}" alt="${nameAr}" class="admin-prod-img" loading="lazy" decoding="async" onerror="this.src='/images/303-3.PNG';" />
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

// Add/Edit Product Listeners
document.getElementById('admin-product-search')?.addEventListener('input', renderProductsTab);
document.getElementById('admin-product-cat-filter')?.addEventListener('change', renderProductsTab);
document.getElementById('add-product-btn')?.addEventListener('click', () => {
  if (!requireAdminPermission('adminProducts')) return;
  if (!requireAdminPermission('adminPrices', 'إضافة منتج جديد تتطلب صلاحية إدارة الأسعار أيضًا.')) return;
  openProductEditor();
});

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
      const btn = e.target.closest('.delete-cat-btn');
      if (!btn) return;
      if (!requireAdminPermission('adminProducts')) return;
      const id = btn.dataset.id;
      if (confirm(`هل أنت تأكد من رغبتك في حذف القسم "${id}" نهائياً من المتجر؟`)) {
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
      <td><strong>${c.id}</strong></td>
      <td>${c.nameAr}</td>
      <td>${c.nameFr}</td>
      <td>
        <button class="btn btn-danger-outline btn-sm delete-cat-btn" data-id="${c.id}" title="حذف القسم">
          <i class="fa-solid fa-trash"></i> حذف
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.delete-cat-btn').forEach(btn => {
    if (!btn.dataset.bound) {
      btn.dataset.bound = 'true';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!requireAdminPermission('adminProducts')) return;
        const id = e.currentTarget.dataset.id;
        if (confirm(`هل أنت تأكد من رغبتك في حذف القسم "${id}" نهائياً من المتجر؟`)) {
          Store.deleteCategory(id);
          renderCategoriesTab();
          populateCategoryDropdowns();
          window.dispatchEvent(new CustomEvent('joulane:refreshStore'));
          window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: `تم حذف القسم (${id}) بنجاح!` }));
        }
      });
    }
  });
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
  const imgPreview = document.getElementById('pe-image-preview');

  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
  if (cancelBtn) cancelBtn.onclick = () => modal.classList.remove('active');

  if (urlInput) {
    urlInput.addEventListener('input', () => {
      imgPreview.src = urlInput.value.trim() || '/images/303-3.PNG';
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        const uploadLabel = fileInput.closest('label');
        const originalLabelHtml = uploadLabel ? uploadLabel.innerHTML : '';
        if (uploadLabel) {
          uploadLabel.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري رفع الصورة لسيرفر Cloudinary...`;
        }

        const uploadedUrl = await uploadToCloudinary(file);

        urlInput.value = uploadedUrl;
        imgPreview.src = uploadedUrl;

        if (uploadLabel) {
          uploadLabel.innerHTML = `<i class="fa-solid fa-circle-check"></i> تم تخزين الصورة في Cloudinary بنجاح ☁️`;
          setTimeout(() => {
            uploadLabel.innerHTML = originalLabelHtml;
          }, 3500);
        }
      }
    });
  }

  if (form) {
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
        pairsPerSeries: parseInt(document.getElementById('pe-pairs').value, 10) || 6,
        discountBadge: {
          ar: document.getElementById('pe-badge-ar').value.trim(),
          fr: document.getElementById('pe-badge-fr').value.trim()
        },
        image: urlInput.value.trim() || '/images/303-3.PNG',
        colors: {
          ar: document.getElementById('pe-colors-ar').value.split(',').map(s => s.trim()).filter(Boolean),
          fr: document.getElementById('pe-colors-fr').value.split(',').map(s => s.trim()).filter(Boolean)
        },
        description: {
          ar: document.getElementById('pe-desc-ar').value.trim(),
          fr: document.getElementById('pe-desc-fr').value.trim()
        },
        features: {
          ar: document.getElementById('pe-features-ar').value.split(',').map(s => s.trim()).filter(Boolean),
          fr: document.getElementById('pe-features-fr').value.split(',').map(s => s.trim()).filter(Boolean)
        }
      };

      if (existingProduct) {
        Store.updateProduct(id, newProduct);
      } else {
        Store.addProduct({ ...newProduct, seriesQty: 0, stockStatus: 'out_of_stock' });
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
    document.getElementById('pe-series-price').value = 19200;
    document.getElementById('pe-old-price').value = 24000;
    document.getElementById('pe-pairs').value = 6;
    document.getElementById('pe-badge-ar').value = 'جديد';
    document.getElementById('pe-badge-fr').value = 'Nouveau';
    document.getElementById('pe-image-url').value = '/images/303-3.PNG';
    document.getElementById('pe-image-preview').src = '/images/303-3.PNG';
    document.getElementById('pe-colors-ar').value = 'أسود ذهبي, فضي';
    document.getElementById('pe-colors-fr').value = 'Noir dore, Argent';
    document.getElementById('pe-desc-ar').value = 'موديل سهرة فاخر مناسب للمحلات وبوتيكات الأعراس.';
    document.getElementById('pe-desc-fr').value = 'Modele de soiree elegant pour boutiques.';
    document.getElementById('pe-features-ar').value = 'بيع بالجملة فقط, كرطون من 36 إلى 41, توصيل للمنزل أو المكتب';
    document.getElementById('pe-features-fr').value = 'Vente en gros uniquement, Serie du 36 au 41';
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
    document.getElementById('pe-pairs').value = product.pairsPerSeries || 6;
    document.getElementById('pe-badge-ar').value = product.discountBadge?.ar || '';
    document.getElementById('pe-badge-fr').value = product.discountBadge?.fr || '';
    document.getElementById('pe-image-url').value = product.image || '';
    document.getElementById('pe-image-preview').src = product.image || '/images/303-3.PNG';
    document.getElementById('pe-colors-ar').value = (product.colors?.ar || []).join(', ');
    document.getElementById('pe-colors-fr').value = (product.colors?.fr || []).join(', ');
    document.getElementById('pe-desc-ar').value = product.description?.ar || '';
    document.getElementById('pe-desc-fr').value = product.description?.fr || '';
    document.getElementById('pe-features-ar').value = (product.features?.ar || []).join(', ');
    document.getElementById('pe-features-fr').value = (product.features?.fr || []).join(', ');
  }

  modal.classList.add('active');
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
    if (field) field.value = config[key];
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

function setupOrdersTab() {
  const searchInput = document.getElementById('admin-orders-search');
  if (searchInput) searchInput.addEventListener('input', renderOrdersTab);

  document.querySelectorAll('.status-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      activeOrderStatusFilter = e.currentTarget.dataset.status;
      renderOrdersTab();
    });
  });

  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    if (requireAdminPermission('adminOrders')) exportOrdersCsv();
  });
  document.getElementById('clear-orders-btn')?.addEventListener('click', () => {
    if (!requireAdminPermission('adminOrders')) return;
    if (confirm('هل أنت متأكد من رغبتك في مسح كل سجل الطلبات؟')) {
      Store.clearOrders();
      renderOrdersTab();
      renderOverviewTab();
    }
  });
}

function renderOrdersTab() {
  if (!hasAdminPermission('adminOrders')) return;
  const tbody = document.getElementById('admin-orders-tbody');
  const countBadge = document.getElementById('admin-orders-tab-count');
  if (!tbody) return;

  let orders = Store.getOrders();
  if (countBadge) countBadge.textContent = orders.length;

  const searchKeyword = (document.getElementById('admin-orders-search')?.value || '').toLowerCase();

  if (activeOrderStatusFilter !== 'all') {
    orders = orders.filter(o => o.status === activeOrderStatusFilter);
  }

  if (searchKeyword) {
    orders = orders.filter(o => 
      (o.id && o.id.toLowerCase().includes(searchKeyword)) ||
      (o.customerName && o.customerName.toLowerCase().includes(searchKeyword)) ||
      (o.phone && o.phone.includes(searchKeyword)) ||
      (o.wilaya && o.wilaya.toLowerCase().includes(searchKeyword))
    );
  }

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--muted); padding: 30px;">لا توجد طلبات مطابقة للفلاتر</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const status = o.status || 'New';
    const rawPhone = (o.phone || '').replace(/\D/g, '');
    const waPhone = rawPhone.startsWith('0') ? `213${rawPhone.slice(1)}` : rawPhone;
    const waText = encodeURIComponent(`مرحبا ${o.customerName}، نقوم بمتابعة طلبكم للعرائس والمحلات مرجع #${o.id} من متجر JOULANE Fashion.`);
    const waLink = `https://wa.me/${waPhone}?text=${waText}`;

    return `
      <tr>
        <td><strong>#${o.id}</strong></td>
        <td><small>${o.timestamp || ''}</small></td>
        <td><strong>${o.customerName}</strong></td>
        <td><a href="tel:${o.phone}" dir="ltr">${o.phone}</a></td>
        <td>${o.wilaya}<br/><small class="text-muted">${o.commune || ''}</small></td>
        <td>${o.deliveryLabel || (o.deliveryType === 'home' ? 'منزل/محل' : 'مكتب')}</td>
        <td>${o.items ? o.items.map(i => `• ${i.nameAr} (${i.color})`).join('<br/>') : `${o.productName}<br/><small class="text-muted">اللون: ${o.color || 'افتراضي'}</small>`}</td>
        <td>${o.items ? `${o.items.reduce((s, i) => s + i.seriesQty, 0)} كرطون` : (o.seriesQty || '1 كرطون')}</td>
        <td><strong>${(o.totalAmount || 0).toLocaleString()} دج</strong></td>
        <td>
          <select class="order-status-select ${status}" data-id="${o.id}">
            <option value="New" ${status === 'New' ? 'selected' : ''}>جديد</option>
            <option value="Confirmed" ${status === 'Confirmed' ? 'selected' : ''}>مؤكد</option>
            <option value="Shipped" ${status === 'Shipped' ? 'selected' : ''}>تم الشحن</option>
            <option value="Delivered" ${status === 'Delivered' ? 'selected' : ''}>مكتمل</option>
            <option value="Cancelled" ${status === 'Cancelled' ? 'selected' : ''}>ملغى</option>
          </select>
        </td>
        <td>
          <div style="display: flex; gap: 4px;">
            <a href="${waLink}" target="_blank" class="btn btn-whatsapp btn-sm" title="واتساب"><i class="fa-brands fa-whatsapp"></i></a>
            <button class="btn btn-danger-outline btn-sm delete-order-btn" data-id="${o.id}" title="حذف"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Dropdown status change listener
  tbody.querySelectorAll('.order-status-select').forEach(select => {
    select.addEventListener('change', (e) => {
      if (!requireAdminPermission('adminOrders')) return;
      const orderId = e.currentTarget.dataset.id;
      const newStatus = e.currentTarget.value;
      Store.updateOrderStatus(orderId, newStatus);
      renderOrdersTab();
      renderOverviewTab();
    });
  });

  // Delete individual order
  tbody.querySelectorAll('.delete-order-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!requireAdminPermission('adminOrders')) return;
      const id = e.currentTarget.dataset.id;
      if (confirm(`حذف الطلب #${id}؟`)) {
        Store.deleteOrder(id);
        renderOrdersTab();
        renderOverviewTab();
      }
    });
  });
}

function exportOrdersCsv() {
  if (!requireAdminPermission('adminOrders')) return;
  const orders = Store.getOrders();
  if (orders.length === 0) {
    alert('لا توجد طلبات للتصدير حالياً.');
    return;
  }
  let csv = "\uFEFFOrder,Date,Customer,Phone,Wilaya,Commune,Address,Delivery,Product,Color,Quantity,Total,Status\n";
  orders.forEach(o => {
    csv += `"${o.id}","${o.timestamp || ''}","${o.customerName}","${o.phone}","${o.wilaya}","${o.commune}","${o.address}","${o.deliveryLabel || o.deliveryType}","${o.productName}","${o.color}","${o.seriesQty}","${o.totalAmount}","${o.status || 'New'}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `joulane_orders_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
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
      const rates = {};
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
    const nameAr = p.name?.ar || p.name || 'منتج بدون اسم';

    return `
      <tr data-id="${p.id}">
        <td>
          <img src="${p.image}" alt="${nameAr}" loading="lazy" decoding="async" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;" onerror="this.src='/images/303-3.PNG';" />
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
          <select class="form-control form-control-sm inv-status-select" data-id="${p.id}" style="width: 140px;">
            <option value="in_stock" ${stockStatus === 'in_stock' ? 'selected' : ''}>متوفر (In Stock)</option>
            <option value="low_stock" ${stockStatus === 'low_stock' ? 'selected' : ''}>كمية محدودة (Low)</option>
            <option value="out_of_stock" ${stockStatus === 'out_of_stock' ? 'selected' : ''}>نفذ المخزون (Out)</option>
          </select>
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
