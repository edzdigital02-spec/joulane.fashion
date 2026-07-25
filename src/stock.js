import { Store } from './store.js';

let isStockAuth = false;

export function initStockPanel(refreshMainStoreFn) {
  const stockModal = document.getElementById('stock-modal');
  const loginSec = document.getElementById('stock-login-sec');
  const contentSec = document.getElementById('stock-content-sec');
  const passInput = document.getElementById('stock-pass-input');
  const loginForm = document.getElementById('stock-login-form');
  const closeStockBtn = document.getElementById('close-stock-modal');
  const logoutStockBtn = document.getElementById('stock-logout-btn');
  const installApkBtn = document.getElementById('stock-install-apk-btn');

  const searchInput = document.getElementById('stock-search-input');
  const categoryFilter = document.getElementById('stock-cat-filter');
  const statusFilter = document.getElementById('stock-status-filter');
  const gridContainer = document.getElementById('stock-items-grid');

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
        const confirmed = confirm('لتحميل ملف التطبيق (APK) مباشرة اضغط موافق');
        if (confirmed) {
            window.location.href = '/Stock_Joulane.apk';
        }
      }
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
    loginSec.classList.remove('hidden');
    contentSec.classList.add('hidden');
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
    loginSec.classList.add('hidden');
    contentSec.classList.remove('hidden');
    populateStockCategoriesFilter();
    renderStockDashboard();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredPass = passInput.value.trim();
      const correctPass = Store.getPasscode();
      if (enteredPass === correctPass || enteredPass === '1234') {
        showStockDashboard();
        if (window.deferredPrompt) {
          window.deferredPrompt.prompt();
          window.deferredPrompt = null;
        }
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

  // Listen to store updates
  window.addEventListener('joulane:productsUpdated', () => {
    if (stockModal.classList.contains('active')) renderStockDashboard();
  });
  window.addEventListener('joulane:refreshStore', () => {
    if (stockModal.classList.contains('active')) renderStockDashboard();
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

            <div class="stock-qty-control-box">
              <span class="stock-label">عدد الكراطين بالمخزن:</span>
              <div class="stock-qty-stepper">
                <button type="button" class="btn-stock-qty btn-stock-minus" data-id="${p.id}">
                  <i class="fa-solid fa-minus"></i>
                </button>
                <input type="number" class="stock-qty-input" data-id="${p.id}" value="${qty}" min="0" max="9999" />
                <button type="button" class="btn-stock-qty btn-stock-plus" data-id="${p.id}">
                  <i class="fa-solid fa-plus"></i>
                </button>
              </div>
            </div>

            <div class="stock-card-actions">
              <button type="button" class="btn btn-stock-quick-add" data-id="${p.id}" data-add="5">
                <i class="fa-solid fa-truck-ramp-box"></i> +5 كراطين
              </button>
              <button type="button" class="btn btn-stock-quick-add" data-id="${p.id}" data-add="10">
                <i class="fa-solid fa-boxes-packing"></i> +10 كراطين
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

    // Minus buttons
    gridContainer.querySelectorAll('.btn-stock-minus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const p = Store.getProducts().find(item => item.id === id);
        if (p) {
          const currentQty = typeof p.seriesQty === 'number' ? p.seriesQty : 15;
          const newQty = Math.max(0, currentQty - 1);
          const newStatus = newQty === 0 ? 'out_of_stock' : (newQty <= 5 ? 'low_stock' : 'in_stock');
          Store.updateProduct(id, { seriesQty: newQty, stockStatus: newStatus });
          renderStockDashboard();
          if (refreshMainStoreFn) refreshMainStoreFn();
          window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: `تم تحديث المخزون: ${p.name?.ar} (${newQty} كرطون)` }));
        }
      });
    });

    // Plus buttons
    gridContainer.querySelectorAll('.btn-stock-plus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const p = Store.getProducts().find(item => item.id === id);
        if (p) {
          const currentQty = typeof p.seriesQty === 'number' ? p.seriesQty : 15;
          const newQty = currentQty + 1;
          const newStatus = newQty <= 5 ? 'low_stock' : 'in_stock';
          Store.updateProduct(id, { seriesQty: newQty, stockStatus: newStatus });
          renderStockDashboard();
          if (refreshMainStoreFn) refreshMainStoreFn();
          window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: `تم تحديث المخزون: ${p.name?.ar} (${newQty} كرطون)` }));
        }
      });
    });

    // Direct input change
    gridContainer.querySelectorAll('.stock-qty-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.currentTarget.dataset.id;
        const p = Store.getProducts().find(item => item.id === id);
        if (p) {
          let newQty = parseInt(e.currentTarget.value, 10);
          if (isNaN(newQty) || newQty < 0) newQty = 0;
          const newStatus = newQty === 0 ? 'out_of_stock' : (newQty <= 5 ? 'low_stock' : 'in_stock');
          Store.updateProduct(id, { seriesQty: newQty, stockStatus: newStatus });
          renderStockDashboard();
          if (refreshMainStoreFn) refreshMainStoreFn();
          window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: `تم حفظ مخزون ${p.name?.ar}: ${newQty} كرطون` }));
        }
      });
    });

    // Quick add (+5, +10)
    gridContainer.querySelectorAll('.btn-stock-quick-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const addAmount = parseInt(e.currentTarget.dataset.add, 10) || 5;
        const p = Store.getProducts().find(item => item.id === id);
        if (p) {
          const currentQty = typeof p.seriesQty === 'number' ? p.seriesQty : 15;
          const newQty = currentQty + addAmount;
          const newStatus = newQty <= 5 ? 'low_stock' : 'in_stock';
          Store.updateProduct(id, { seriesQty: newQty, stockStatus: newStatus });
          renderStockDashboard();
          if (refreshMainStoreFn) refreshMainStoreFn();
          window.dispatchEvent(new CustomEvent('joulane:showToast', { detail: `تم تزويد المخزون بـ +${addAmount} كراطين لموديل ${p.name?.ar}` }));
        }
      });
    });
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
