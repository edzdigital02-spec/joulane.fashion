import './styles/style.css';
import { Store } from './store.js';

import { initAdmin } from './admin.js';
import { initStockPanel } from './stock.js';
import { WILAYAS } from './data/wilayas.js';

const I18N = {
  ar: {
    topNotice: "بيع أحذية نسائية بالجملة يد أولى، توصيل لجميع الولايات",
    brandSub: "Fashion - أحذية نسائية بالجملة",
    langButton: "Français",
    themeDark: "الوضع الداكن",
    themeLight: "الوضع الفاتح",
    ordersAdmin: "الطلبات",
    cartTitle: "سلة التسوق",
    orderNow: "السلة",
    addToCart: "إضافة للسلة",
    addedToCartToast: "تمت إضافة المنتج للسلة بنجاح! 🛒",
    cartHeading: "سلة التسوق والجملة",
    cartSubheading: "المنتجات المختارة لإرسال طلب الجملة الموحد",
    proceedCheckout: "إكمال الطلب الموحد",
    clearCart: "تفريغ السلة",
    emptyCartText: "سلتك فارغة حالياً. تصفح الكتالوج وأضف المنتجات للسلة!",
    heroBadge: "بيع أحذية بالجملة - يد أولى",
    heroTitle: "بيع أحذية نسائية بالجملة بجودة عالية وأسعار تنافسية",
    heroText: "نوفر للتجار أحدث الموديلات وبأفضل الأسعار لتحقيق أعلى هامش ربح، مع طلب سهل يجمع الاسم، الهاتف، الولاية، البلدية، ونوع التوصيل.",
    viewProducts: "مشاهدة المنتجات",
    whatsapp: "واتساب",
    quality: "جودة عالية",
    prices: "أسعار تنافسية",
    deliveryAll: "توصيل لجميع الولايات",
    seriesSizes: "كرطون كامل",
    trustShopsTitle: "للتجار والمحلات",
    trustShopsText: "طلب بالجملة بطريقة سهلة ومناسبة للمحلات.",
    trustDeliveryTitle: "توصيل لجميع الولايات",
    trustDeliveryText: "اختيار الولاية، البلدية، والتوصيل للمنزل أو المكتب.",
    trustConfirmTitle: "تأكيد سريع",
    trustConfirmText: "كل طلب يجهز رسالة واتساب فيها كل التفاصيل.",
    catalogLabel: "الكتالوج",
    catalogTitle: "اختر الموديل وأضفه لسلتك",
    catalogText: "تشكيلة راقية من أحذية السهرة، العرائس، الصنادل، الكلاكات والصابو بالجملة.",
    catAll: "كل الموديلات",
    catWedding: "أحذية أعراس",
    catHeels: "كعب عالي",
    catEvening: "سهرة",
    socialLabel: "تابعونا",
    socialTitle: "JOULANE Fashion على فيسبوك، تيك توك، وإنستغرام",
    footerText: "بيع أحذية نسائية بالجملة يد أولى، جودة عالية، أسعار تنافسية، وتوصيل لجميع الولايات.",
    footerDelivery: "توصيل للمنزل أو المكتب",
    stickyTitle: "سلة التسوق",
    stickySub: "توصيل 58 ولاية",
    orderShort: "عرض السلة",
    checkoutTitle: "تأكيد طلب السلة الموحد",
    checkoutText: "املأ بياناتك وسنحضر رسالة واتساب مفصلة بجميع المنتجات المطلوبة.",
    qtyLabel: "الكمية",
    colorLabel: "اللون",
    nameLabel: "الاسم الكامل / اسم المحل",
    namePlaceholder: "مثال: محل الأناقة - أمينة",
    phoneLabel: "رقم الهاتف",
    phoneHelp: "صيغة الهاتف: 05 أو 06 أو 07 ثم 8 أرقام.",
    wilayaLabel: "الولاية",
    communeLabel: "البلدية",
    chooseWilayaFirst: "اختر الولاية أولا",
    deliveryTypeLabel: "نوع التوصيل",
    chooseWilaya: "اختر الولاية",
    homeDelivery: "للمنزل / المحل",
    deskDelivery: "استلام من المكتب",
    addressLabel: "العنوان أو اسم المكتب",
    addressPlaceholder: "الشارع، اسم المحل، أو مكتب التوصيل",
    productsTotalLabel: "مجموع السلة",
    deliveryLabel: "التوصيل",
    totalLabel: "المجموع الكلي عند الاستلام",
    submitOrder: "تأكيد الطلب الموحد وفتح واتساب",
    successTitle: "تم حفظ الطلب بنجاح",
    referenceLabel: "المرجع:",
    sendWhatsapp: "إرسال الطلب عبر واتساب",
    backCatalog: "العودة للكتالوج",
    oneSeries: "1 كرطون = {pairs} أزواج",
    seriesPrice: "{price} / للكرطون",
    seriesSizesLine: "1 كرطون = {pairs} أزواج، المقاسات من 36 إلى 41",
    viewDetails: "عرض التفاصيل",
    chooseWilayaOption: "اختر الولاية",
    chooseCommuneOption: "اختر البلدية",
    quantitySeries: "{series} كرطون",
    summaryQty: "{series} كرطون / {pairs} أزواج",
    invalidLocation: "يرجى اختيار الولاية والبلدية.",
    homeDeliveryShort: "منزل/محل",
    deskDeliveryShort: "مكتب",
    modalOrderButton: "إضافة هذا الموديل للسلة 🛒",
    whatsappMessage: "مرحبا JOULANE، أريد تأكيد الطلب الموحد التالي:"
  },
  fr: {
    topNotice: "Vente de chaussures femme en gros, premiere main, livraison dans toutes les wilayas",
    brandSub: "Fashion - Chaussures femme en gros",
    langButton: "العربية",
    themeDark: "Mode sombre",
    themeLight: "Mode clair",
    ordersAdmin: "Commandes",
    cartTitle: "Mon Panier",
    orderNow: "Panier",
    addToCart: "Ajouter au panier",
    addedToCartToast: "Produit ajoute au panier ! 🛒",
    cartHeading: "Mon Panier d'Achat",
    cartSubheading: "Produits selectionnes pour commande groupee",
    proceedCheckout: "Finaliser la commande",
    clearCart: "Vider le panier",
    emptyCartText: "Votre panier est vide. Parcourez le catalogue et ajoutez des produits !",
    heroBadge: "Vente en gros - premiere main",
    heroTitle: "Chaussures femme en gros, haute qualite et prix competitifs",
    heroText: "Nous fournissons aux commercants les derniers modeles aux meilleurs prix pour augmenter la marge, avec un formulaire simple: nom, telephone, wilaya, commune et type de livraison.",
    viewProducts: "Voir les produits",
    whatsapp: "WhatsApp",
    quality: "Haute qualite",
    prices: "Prix competitifs",
    deliveryAll: "Livraison toutes wilayas",
    seriesSizes: "Serie complete",
    trustShopsTitle: "Pour commercants",
    trustShopsText: "Commande en gros simple pour boutiques et revendeurs.",
    trustDeliveryTitle: "Livraison toutes wilayas",
    trustDeliveryText: "Choix de wilaya, commune, domicile ou bureau.",
    trustConfirmTitle: "Confirmation rapide",
    trustConfirmText: "Chaque commande prepare un message WhatsApp complet.",
    catalogLabel: "Catalogue",
    catalogTitle: "Choisissez un modele et ajoutez-le au panier",
    catalogText: "Une collection elegante de chaussures de soiree, mariage, sandales et claquettes en gros.",
    catAll: "Tous les modeles",
    catWedding: "Mariage",
    catHeels: "Talons",
    catEvening: "Soiree",
    socialLabel: "Suivez-nous",
    socialTitle: "JOULANE Fashion sur Facebook, TikTok et Instagram",
    footerText: "Vente de chaussures femme en gros, premiere main, haute qualite, prix competitifs et livraison dans toutes les wilayas.",
    footerDelivery: "Livraison domicile ou bureau",
    stickyTitle: "Mon Panier",
    stickySub: "Livraison 58 Wilayas",
    orderShort: "Voir Panier",
    checkoutTitle: "Confirmer la commande groupee",
    checkoutText: "Remplissez vos informations pour envoyer la commande globale sur WhatsApp.",
    qtyLabel: "Quantite",
    colorLabel: "Couleur",
    nameLabel: "Nom complet / boutique",
    namePlaceholder: "Exemple: Boutique Nour - Amina",
    phoneLabel: "Telephone",
    phoneHelp: "Format: 05, 06 ou 07 puis 8 chiffres.",
    wilayaLabel: "Wilaya",
    communeLabel: "Commune",
    chooseWilayaFirst: "Choisissez la wilaya d'abord",
    deliveryTypeLabel: "Type de livraison",
    chooseWilaya: "Choisissez la wilaya",
    homeDelivery: "A domicile / boutique",
    deskDelivery: "Retrait au bureau",
    addressLabel: "Adresse ou nom du bureau",
    addressPlaceholder: "Rue, nom de boutique ou bureau de livraison",
    productsTotalLabel: "Total Produits",
    deliveryLabel: "Livraison",
    totalLabel: "Total a la livraison",
    submitOrder: "Confirmer et ouvrir WhatsApp",
    successTitle: "Commande enregistree",
    referenceLabel: "Reference:",
    sendWhatsapp: "Envoyer sur WhatsApp",
    backCatalog: "Retour au catalogue",
    oneSeries: "1 serie = {pairs} paires",
    seriesPrice: "{price} / serie",
    seriesSizesLine: "1 serie = {pairs} paires, tailles 36 a 41",
    viewDetails: "Voir details",
    chooseWilayaOption: "Choisissez la wilaya",
    chooseCommuneOption: "Choisissez la commune",
    quantitySeries: "{series} serie(s)",
    summaryQty: "{series} serie(s) / {pairs} paires",
    invalidLocation: "Veuillez choisir la wilaya et la commune.",
    homeDeliveryShort: "Domicile/boutique",
    deskDeliveryShort: "Bureau",
    modalOrderButton: "Ajouter au panier 🛒",
    whatsappMessage: "Bonjour JOULANE, je veux confirmer cette commande groupee:"
  }
};

let currentLang = localStorage.getItem('joulane_lang') || 'ar';
let currentTheme = localStorage.getItem('joulane_theme') || 'dark';
let selectedProduct = null;
let currentWilaya = null;
let deliveryType = "home";
let activeCategory = "all";

const productsContainer = document.getElementById('products-container');
const categoriesBar = document.getElementById('categories-bar');
const wilayaSelect = document.getElementById('customer-wilaya');
const communeSelect = document.getElementById('customer-commune');
const cartModal = document.getElementById('cart-modal');
const checkoutModal = document.getElementById('checkout-modal');
const successModal = document.getElementById('success-modal');
const productModal = document.getElementById('product-modal');
const checkoutForm = document.getElementById('express-checkout-form');
const langToggle = document.getElementById('lang-toggle');
const themeToggle = document.getElementById('theme-toggle');

document.addEventListener('DOMContentLoaded', () => {
  renderApp();
  initEventListeners();

  initAdmin(renderApp);
  initStockPanel(renderApp);
  Store.initSupabase(renderApp);



  // Global Event Listeners
  window.addEventListener('joulane:refreshStore', () => renderApp());
  window.addEventListener('joulane:configUpdated', () => renderApp());
  window.addEventListener('joulane:productsUpdated', () => renderApp());
  window.addEventListener('joulane:categoriesUpdated', () => renderApp());
  window.addEventListener('joulane:cartUpdated', () => updateCartUI());
  window.addEventListener('joulane:showToast', (e) => showToast(e.detail));
});

function renderApp() {
  applyTheme();
  applyConfigToDOM();
  applyLanguage();
  renderCategoriesBar();
  initCatalog(activeCategory);
  updateCartUI();
  updateAdminBadgeCount();
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') return String(str);
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function t(key) {
  return I18N[currentLang][key] || key;
}

function template(key, values = {}) {
  return t(key).replace(/\{(\w+)\}/g, (_, token) => values[token] ?? '');
}

function productText(product, field) {
  const value = product[field];
  if (!value) return '';
  return typeof value === 'object' ? (value[currentLang] || value.ar || '') : value;
}

function productImageUrl(product) {
  const rawImg = typeof product === 'string' ? product : (product?.image || '/images/303-3.PNG');
  if (!rawImg) return '/images/303-3.PNG';
  if (rawImg.startsWith('http://') || rawImg.startsWith('https://') || rawImg.startsWith('data:')) return rawImg;
  const fileName = rawImg.replace(/^\/?images\//, '');
  return `/images/${fileName}`;
}

function formatDzd(amount, isShipping = false) {
  const isHidePrices = !!Store.getConfig()?.hideAllPrices;
  if (isHidePrices && !isShipping) {
    return currentLang === 'ar' ? 'السعر عند الطلب' : 'Prix sur demande';
  }
  const value = Number(amount).toLocaleString(currentLang === 'ar' ? 'ar-DZ' : 'fr-DZ');
  return currentLang === 'ar' ? `${value} دج` : `${value} DZD`;
}

function applyTheme() {
  document.documentElement.dataset.theme = currentTheme;
  const icon = themeToggle.querySelector('i');
  if (icon) icon.className = currentTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  const label = themeToggle.querySelector('[data-i18n="themeButton"]');
  if (label) label.textContent = currentTheme === 'dark' ? t('themeLight') : t('themeDark');
}

function applyConfigToDOM() {
  const config = Store.getConfig();

  // Top Notice
  const topNoticeEl = document.querySelector('[data-i18n="topNotice"]');
  if (topNoticeEl) topNoticeEl.textContent = config[`topNotice_${currentLang}`] || config.topNotice_ar;

  // Contacts
  const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
  phoneLinks.forEach(link => {
    link.href = `tel:${config.phone.replace(/\s+/g, '')}`;
    link.innerHTML = `<i class="fa-solid fa-phone"></i> ${config.phone}`;
  });

  const waLinks = document.querySelectorAll('a[href*="wa.me"]');
  const cleanWa = (config.whatsapp || '213660125123').replace(/\D/g, '');
  waLinks.forEach(link => {
    link.href = `https://wa.me/${cleanWa}`;
  });

  // Header branding & Logo
  const brandTitleEl = document.querySelector('.brand-title');
  if (brandTitleEl) brandTitleEl.textContent = config.brandTitle || 'JOULANE';
  
  const brandSubEl = document.querySelector('.brand-sub');
  if (brandSubEl) brandSubEl.textContent = config[`brandSub_${currentLang}`] || config.brandSub_ar;

  const logos = document.querySelectorAll('.brand-logo, .checkout-logo, .footer-logo');
  logos.forEach(img => {
    if (config.logoImg) img.src = config.logoImg;
  });

  // Cover Strip
  const coverImg = document.querySelector('.brand-cover-img');
  if (coverImg && config.coverImg) coverImg.src = config.coverImg;

  // Hero Section
  const heroBadgeEl = document.querySelector('.hero-badge [data-i18n="heroBadge"]');
  if (heroBadgeEl) heroBadgeEl.textContent = config[`heroBadge_${currentLang}`] || config.heroBadge_ar;

  const heroTitleEl = document.querySelector('h1[data-i18n="heroTitle"]');
  if (heroTitleEl) heroTitleEl.textContent = config[`heroTitle_${currentLang}`] || config.heroTitle_ar;

  const heroTextEl = document.querySelector('p[data-i18n="heroText"]');
  if (heroTextEl) heroTextEl.textContent = config[`heroText_${currentLang}`] || config.heroText_ar;

  const heroImgEl = document.querySelector('.hero-img');
  if (heroImgEl && config.heroImg) heroImgEl.src = config.heroImg;

  const floatingNumEl = document.querySelector('.floating-badge strong');
  if (floatingNumEl && config.heroFloatingNum) floatingNumEl.textContent = config.heroFloatingNum;

  const floatingTextEl = document.querySelector('.floating-badge [data-i18n="seriesSizes"]');
  if (floatingTextEl) floatingTextEl.textContent = config[`heroFloatingText_${currentLang}`] || config.heroFloatingText_ar;

  // Trust Cards
  const trustGrid = document.querySelector('.trust-grid');
  if (trustGrid) {
    const items = trustGrid.querySelectorAll('.trust-item');
    if (items[0]) {
      items[0].querySelector('h4').textContent = config[`trust1_title_${currentLang}`] || config.trust1_title_ar;
      items[0].querySelector('p').textContent = config[`trust1_text_${currentLang}`] || config.trust1_text_ar;
    }
    if (items[1]) {
      items[1].querySelector('h4').textContent = config[`trust2_title_${currentLang}`] || config.trust2_title_ar;
      items[1].querySelector('p').textContent = config[`trust2_text_${currentLang}`] || config.trust2_text_ar;
    }
    if (items[2]) {
      items[2].querySelector('h4').textContent = config[`trust3_title_${currentLang}`] || config.trust3_title_ar;
      items[2].querySelector('p').textContent = config[`trust3_text_${currentLang}`] || config.trust3_text_ar;
    }
  }

  // Social Links
  const fbBtn = document.querySelector('.social-btn.fb');
  if (fbBtn && config.facebookUrl) fbBtn.href = config.facebookUrl;
  const ttBtn = document.querySelector('.social-btn.tt');
  if (ttBtn && config.tiktokUrl) ttBtn.href = config.tiktokUrl;
  const igBtn = document.querySelector('.social-btn.ig');
  if (igBtn && config.instagramUrl) igBtn.href = config.instagramUrl;

  // Footer Text
  const footerTextEl = document.querySelector('p[data-i18n="footerText"]');
  if (footerTextEl) footerTextEl.textContent = config[`footerText_${currentLang}`] || config.footerText_ar;

  // Dynamic Section Visibilities
  const toggleVisibility = (selector, isVisibleVal) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const isVisible = isVisibleVal === true || isVisibleVal === 'true' || isVisibleVal === undefined || isVisibleVal === null;
    if (!isVisible) {
      el.style.setProperty('display', 'none', 'important');
      el.classList.add('section-hidden');
    } else {
      el.style.removeProperty('display');
      el.classList.remove('section-hidden');
    }
  };

  toggleVisibility('.top-notice-strip', config.showTopNotice);
  toggleVisibility('.cover-strip', config.showCoverStrip);
  toggleVisibility('.hero-section', config.showHeroSection);
  toggleVisibility('.trust-strip', config.showTrustStrip);
  toggleVisibility('.catalog-section', config.showCatalogSection);
  toggleVisibility('.social-strip', config.showSocialStrip);
  toggleVisibility('.mobile-sticky-bar', config.showMobileStickyBar);
}

function applyLanguage() {
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key === 'themeButton' || key === 'topNotice' || key === 'heroBadge' || key === 'heroTitle' || key === 'heroText' || key === 'seriesSizes' || key === 'footerText') return;
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  applyTheme();
  initWilayaDropdown();
  updateDeliveryLabels();
  updatePricingSummary();
}

/* ==========================================================================
   DYNAMIC CATEGORIES BAR
   ========================================================================== */

function renderCategoriesBar() {
  if (!categoriesBar) return;
  const categories = Store.getCategories();
  
  let html = `
    <button class="filter-btn ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">
      <i class="fa-solid fa-border-all"></i> ${t('catAll')}
    </button>
  `;

  categories.forEach(c => {
    const label = currentLang === 'ar' ? c.nameAr : c.nameFr;
    html += `
      <button class="filter-btn ${activeCategory === c.id ? 'active' : ''}" data-cat="${c.id}">
        ${label}
      </button>
    `;
  });

  categoriesBar.innerHTML = html;
}

function categoryLabel(category) {
  const categories = Store.getCategories();
  const found = categories.find(c => c.id === category);
  if (found) {
    return currentLang === 'ar' ? found.nameAr : found.nameFr;
  }
  const map = { wedding: 'catWedding', heels: 'catHeels', evening: 'catEvening' };
  return t(map[category] || 'catAll');
}

/* ==========================================================================
   CATALOG RENDERING
   ========================================================================== */

function initCatalog(category = 'all', searchQuery = '') {
  activeCategory = category;
  productsContainer.innerHTML = '';
  const products = Store.getProducts();
  let filtered = category === 'all' ? products : products.filter(p => p.category === category);

  const query = (searchQuery || '').trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(p => {
      const nameAr = (p.name?.ar || p.name || '').toLowerCase();
      const nameFr = (p.name?.fr || p.name || '').toLowerCase();
      const id = (p.id || '').toLowerCase();
      const descAr = (p.description?.ar || '').toLowerCase();
      const descFr = (p.description?.fr || '').toLowerCase();
      return nameAr.includes(query) || nameFr.includes(query) || id.includes(query) || descAr.includes(query) || descFr.includes(query);
    });
  }

  if (filtered.length === 0) {
    productsContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--muted);">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 3rem; margin-bottom: 12px; opacity: 0.3;"></i>
        <h4>${query ? (currentLang === 'ar' ? `لا توجد نتائج مطابقة لـ "${escapeHTML(query)}"` : `Aucun résultat pour "${escapeHTML(query)}"`) : (currentLang === 'ar' ? 'لا توجد منتجات متوفرة حالياً في هذا القسم' : 'Aucun produit disponible')}</h4>
      </div>`;
    return;
  }

  filtered.forEach(product => {
    const isOutOfStock = product.stockStatus === 'out_of_stock';
    const isHidePrices = !!Store.getConfig()?.hideAllPrices;
    const card = document.createElement('article');
    card.className = `product-card ${isOutOfStock ? 'out-of-stock-card' : ''}`;
    card.innerHTML = `
      <div class="product-image-box">
        <img src="${productImageUrl(product)}" alt="${productText(product, 'name')}" class="product-img" onerror="this.onerror=null; this.src='${product.image || '/images/303-3.PNG'}';" />
        <span class="discount-badge">${productText(product, 'discountBadge')}</span>
        <span class="stock-badge">
          <i class="fa-solid fa-box"></i> 
          ${isOutOfStock ? (currentLang === 'ar' ? 'غير متوفر' : 'Épuisé') : template('oneSeries', { pairs: product.pairsPerSeries || 6 })}
        </span>
      </div>
      <div class="product-details">
        <span class="product-cat">${categoryLabel(product.category)}</span>
        <h3 class="product-title">${productText(product, 'name')}</h3>
        <div class="product-rating">
          <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
          <span>${product.rating || 5.0} (${template('ordersCount', { count: product.reviewsCount || 100 })})</span>
        </div>
        <div class="price-box">
          ${isHidePrices ? `
            <span class="current-price price-hidden-badge"><i class="fa-solid fa-lock"></i> ${currentLang === 'ar' ? 'السعر عند الطلب' : 'Prix sur demande'}</span>
          ` : `
            <span class="current-price">${formatDzd(product.seriesPrice)}</span>
            ${product.oldPrice ? `<span class="old-price">${formatDzd(product.oldPrice)}</span>` : ''}
          `}
        </div>
        <p class="product-description">${productText(product, 'description')}</p>
        <div class="product-actions">
          <button class="btn btn-gold add-to-cart-btn" data-id="${product.id}" ${isOutOfStock ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
            <i class="fa-solid fa-cart-plus"></i> ${isOutOfStock ? (currentLang === 'ar' ? 'غير متوفر' : 'Épuisé') : t('addToCart')}
          </button>
          <button class="btn btn-outline-white view-details-btn" data-id="${product.id}" title="${t('viewDetails')}">
            <i class="fa-solid fa-eye"></i>
          </button>
        </div>
      </div>
    `;
    productsContainer.appendChild(card);
  });

  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    if (!btn.disabled) {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const products = Store.getProducts();
        const product = products.find(p => p.id === id);
        if (product) {
          const colors = product.colors ? (product.colors[currentLang] || product.colors.ar || []) : [];
          const selectedColor = colors.length > 0 ? colors[0] : 'افتراضي';
          Store.addToCart(product, selectedColor, 1);
          showToast(t('addedToCartToast'));
        }
      });
    }
  });

  document.querySelectorAll('.view-details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => openProductModal(e.currentTarget.dataset.id));
  });
}

/* ==========================================================================
   SHOPPING CART & MODALS LOGIC
   ========================================================================== */

function updateCartUI() {
  const count = Store.getCartCount();
  const total = Store.getCartTotal();
  const isHidePrices = !!Store.getConfig()?.hideAllPrices;

  // Header Badge
  const headerBadge = document.getElementById('header-cart-badge');
  if (headerBadge) headerBadge.textContent = count;

  // Mobile Sticky Info
  const stickyPrice = document.querySelector('.sticky-price');
  if (stickyPrice) {
    if (count > 0) {
      stickyPrice.textContent = isHidePrices
        ? (currentLang === 'ar' ? `السلة: ${count} كرطون` : `Panier: ${count} serie(s)`)
        : (currentLang === 'ar' ? `السلة: ${count} كرطون (${formatDzd(total)})` : `Panier: ${count} serie(s) (${formatDzd(total)})`);
    } else {
      stickyPrice.textContent = t('stickyTitle');
    }
  }

  // Render Cart Modal Items
  renderCartModalItems();
}

function renderCartModalItems() {
  const container = document.getElementById('cart-items-container');
  const footer = document.getElementById('cart-modal-footer');
  const subtotalEl = document.getElementById('cart-subtotal-price');
  if (!container) return;

  const cart = Store.getCart();
  const isHidePrices = !!Store.getConfig()?.hideAllPrices;

  if (cart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 48px 16px; color: var(--muted);">
        <i class="fa-solid fa-cart-arrow-down" style="font-size: 3.5rem; margin-bottom: 16px; opacity: 0.4;"></i>
        <h4>${t('emptyCartText')}</h4>
      </div>
    `;
    if (footer) footer.style.display = 'none';
    return;
  }

  if (footer) footer.style.display = 'block';
  if (subtotalEl) {
    subtotalEl.textContent = isHidePrices
      ? (currentLang === 'ar' ? 'السعر عند الطلب' : 'Prix sur demande')
      : formatDzd(Store.getCartTotal());
  }

  const products = Store.getProducts();

  container.innerHTML = cart.map((item, index) => {
    const product = products.find(p => p.id === item.productId) || {};
    const colors = product.colors ? (product.colors[currentLang] || product.colors.ar || [item.color]) : [item.color];

    const metaHtml = isHidePrices
      ? `<span class="price-hidden-badge"><i class="fa-solid fa-lock"></i> ${currentLang === 'ar' ? 'السعر عند الطلب' : 'Prix sur demande'}</span>`
      : `<span class="text-gold"><strong>${formatDzd(item.seriesPrice)}</strong> / للكرطون (${item.pairsPerSeries} أزواج)</span>`;

    const itemTotalHtml = isHidePrices
      ? `<span class="price-hidden-badge" style="font-size:0.8rem;"><i class="fa-solid fa-lock"></i> عند الطلب</span>`
      : formatDzd(item.totalPrice);

    return `
      <div class="cart-item-card">
        <img src="${productImageUrl(item.image)}" alt="${currentLang === 'ar' ? item.nameAr : item.nameFr}" class="cart-item-img" onerror="this.onerror=null; this.src='${item.image || '/images/303-3.PNG'}';" />
        <div class="cart-item-details">
          <h4>${currentLang === 'ar' ? item.nameAr : item.nameFr}</h4>
          <div class="cart-item-meta">
            ${metaHtml}
          </div>
          <div class="cart-item-controls">
            <div class="color-picker-box">
              <label>اللون:</label>
              <select class="form-control cart-item-color-select" data-index="${index}">
                ${colors.map(c => `<option value="${c}" ${c === item.color ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="qty-stepper-box">
              <button class="qty-btn dec-qty" data-index="${index}">-</button>
              <span class="qty-val">${item.seriesQty} كرطون</span>
              <button class="qty-btn inc-qty" data-index="${index}">+</button>
            </div>
          </div>
        </div>
        <div class="cart-item-side">
          <div class="cart-item-total">${itemTotalHtml}</div>
          <button class="btn btn-danger-outline remove-cart-item-btn" data-index="${index}" title="حذف من السلة">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Cart Item Listeners
  container.querySelectorAll('.cart-item-color-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      const cart = Store.getCart();
      if (cart[idx]) {
        cart[idx].color = e.currentTarget.value;
        Store.saveCart(cart);
      }
    });
  });

  container.querySelectorAll('.dec-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      const cart = Store.getCart();
      if (cart[idx]) {
        Store.updateCartQty(idx, cart[idx].seriesQty - 1);
      }
    });
  });

  container.querySelectorAll('.inc-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      const cart = Store.getCart();
      if (cart[idx]) {
        Store.updateCartQty(idx, cart[idx].seriesQty + 1);
      }
    });
  });

  container.querySelectorAll('.remove-cart-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      Store.removeFromCart(idx);
    });
  });
}

function openCartModal() {
  updateCartUI();
  cartModal.classList.add('active');
}

function openCheckoutFromCart() {
  const cart = Store.getCart();
  if (cart.length === 0) {
    alert(t('emptyCartText'));
    return;
  }
  cartModal.classList.remove('active');

  const isHidePrices = !!Store.getConfig()?.hideAllPrices;
  const preview = document.getElementById('checkout-product-preview');
  preview.innerHTML = `
    <div class="checkout-cart-summary-list">
      <h4><i class="fa-solid fa-boxes-packing"></i> المنتجات المطلوبة بالسلة (${cart.length}):</h4>
      ${cart.map(item => `
        <div class="checkout-cart-item-row">
          <img src="${productImageUrl(item.image)}" class="checkout-item-thumb" onerror="this.onerror=null; this.src='${item.image || '/images/303-3.PNG'}';" />
          <div>
            <strong>${currentLang === 'ar' ? item.nameAr : item.nameFr}</strong>
            <div class="text-muted" style="font-size:0.85rem;">اللون: ${item.color} | الكمية: ${item.seriesQty} كرطون (${item.seriesQty * item.pairsPerSeries} زوج)</div>
          </div>
          <div style="margin-inline-start: auto; font-weight: 800;" class="text-gold">
            ${isHidePrices ? `<span class="price-hidden-badge" style="font-size:0.8rem;"><i class="fa-solid fa-lock"></i> عند الطلب</span>` : formatDzd(item.totalPrice)}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  updatePricingSummary();
  checkoutModal.classList.add('active');
}

function initWilayaDropdown() {
  const selected = wilayaSelect.value;
  wilayaSelect.innerHTML = `<option value="">${t('chooseWilayaOption')}</option>`;
  WILAYAS.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w.code;
    opt.textContent = `${w.code.toString().padStart(2, '0')} - ${currentLang === 'ar' ? w.nameAr : w.nameFr}`;
    wilayaSelect.appendChild(opt);
  });
  wilayaSelect.value = selected;
  populateCommunes();
}

function populateCommunes() {
  const selectedCommune = communeSelect.value;
  const wCode = parseInt(wilayaSelect.value, 10);
  communeSelect.innerHTML = `<option value="">${wCode ? t('chooseCommuneOption') : t('chooseWilayaFirst')}</option>`;
  if (!wCode) {
    communeSelect.disabled = true;
    return;
  }
  const foundWilaya = WILAYAS.find(w => w.code === wCode);
  const communes = currentLang === 'ar' ? foundWilaya.communesAr : foundWilaya.communesFr;
  communes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    communeSelect.appendChild(opt);
  });
  communeSelect.disabled = false;
  if (selectedCommune && communes.includes(selectedCommune)) communeSelect.value = selectedCommune;
}

function initEventListeners() {
  langToggle.addEventListener('click', () => {
    currentLang = currentLang === 'ar' ? 'fr' : 'ar';
    localStorage.setItem('joulane_lang', currentLang);
    applyLanguage();
  });

  themeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('joulane_theme', currentTheme);
    applyTheme();
  });

  categoriesBar.addEventListener('click', (e) => {
    const button = e.target.closest('.filter-btn');
    if (!button) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    const searchInput = document.getElementById('catalog-search-input');
    initCatalog(button.dataset.cat, searchInput ? searchInput.value : '');
  });

  const searchInput = document.getElementById('catalog-search-input');
  const clearSearchBtn = document.getElementById('clear-catalog-search');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (clearSearchBtn) {
        if (val) clearSearchBtn.classList.remove('hidden');
        else clearSearchBtn.classList.add('hidden');
      }
      initCatalog(activeCategory, val);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        initCatalog(activeCategory, '');
      }
    });
  }

  // Header Cart Button
  document.getElementById('header-cart-btn').addEventListener('click', openCartModal);
  
  // Mobile Sticky Bar Cart Button
  const stickyBtn = document.querySelector('.mobile-sticky-bar .btn');
  if (stickyBtn) {
    stickyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openCartModal();
    });
  }

  // Cart Modal Action Buttons
  document.getElementById('proceed-checkout-btn')?.addEventListener('click', openCheckoutFromCart);
  document.getElementById('clear-cart-btn')?.addEventListener('click', () => {
    if (confirm(t('clearConfirm') || 'مسح السلة؟')) {
      Store.clearCart();
    }
  });

  wilayaSelect.addEventListener('change', () => {
    populateCommunes();
    updatePricingSummary();
  });

  document.getElementById('option-home-delivery').addEventListener('click', () => {
    deliveryType = 'home';
    document.getElementById('option-home-delivery').classList.add('active');
    document.getElementById('option-desk-delivery').classList.remove('active');
    
    const addressGroup = document.getElementById('address-group');
    const addrInput = document.getElementById('customer-address');
    
    if (addressGroup) addressGroup.style.display = 'block';
    if (addrInput) addrInput.required = true;
    
    updatePricingSummary();
  });

  document.getElementById('option-desk-delivery').addEventListener('click', () => {
    deliveryType = 'desk';
    document.getElementById('option-desk-delivery').classList.add('active');
    document.getElementById('option-home-delivery').classList.remove('active');

    const addressGroup = document.getElementById('address-group');
    const addrInput = document.getElementById('customer-address');

    if (addressGroup) addressGroup.style.display = 'none';
    if (addrInput) {
      addrInput.required = false;
      addrInput.value = '';
    }

    updatePricingSummary();
  });

  checkoutForm.addEventListener('submit', handleCheckoutSubmit);

  document.getElementById('close-product-modal').addEventListener('click', () => productModal.classList.remove('active'));
  document.getElementById('close-cart-modal').addEventListener('click', () => cartModal.classList.remove('active'));
  document.getElementById('close-checkout-modal').addEventListener('click', () => checkoutModal.classList.remove('active'));
  document.getElementById('close-success-btn').addEventListener('click', () => successModal.classList.remove('active'));

  [productModal, cartModal, checkoutModal, successModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });
}

function openProductModal(productId) {
  const products = Store.getProducts();
  const product = products.find(p => p.id === productId) || products[0];
  selectedProduct = product;

  const content = document.getElementById('product-modal-content');
  const colors = product.colors ? (product.colors[currentLang] || product.colors.ar || []) : [];
  const features = product.features ? (product.features[currentLang] || product.features.ar || []) : [];

  content.innerHTML = `
    <div class="product-modal-media">
      <img src="${productImageUrl(product)}" alt="${productText(product, 'name')}" class="modal-product-img" onerror="this.onerror=null; this.src='${product.image || '/images/303-3.PNG'}';" />
    </div>
    <div class="product-modal-info">
      <span class="product-cat">${categoryLabel(product.category)}</span>
      <h2>${productText(product, 'name')}</h2>
      <div class="price-box">
        ${Store.getConfig()?.hideAllPrices ? `
          <span class="current-price price-hidden-badge"><i class="fa-solid fa-lock"></i> ${currentLang === 'ar' ? 'السعر عند الطلب' : 'Prix sur demande'}</span>
        ` : `
          <span class="current-price">${formatDzd(product.seriesPrice)}</span>
          ${product.oldPrice ? `<span class="old-price">${formatDzd(product.oldPrice)}</span>` : ''}
        `}
      </div>
      <p class="modal-series-info"><i class="fa-solid fa-boxes-stacked"></i> ${template('seriesSizesLine', { pairs: product.pairsPerSeries || 6 })}</p>
      <p>${productText(product, 'description')}</p>
      
      ${colors.length ? `
        <div class="form-group margin-top-16">
          <label>اختر اللون المفصل:</label>
          <select id="modal-color-select" class="form-control">
            ${colors.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
      ` : ''}

      ${features.length ? `<ul class="modal-features">${features.map(f => `<li><i class="fa-solid fa-check"></i> ${f}</li>`).join('')}</ul>` : ''}
      
      <button class="btn btn-gold btn-block btn-lg margin-top-16 modal-add-cart-btn" data-id="${product.id}">
        <i class="fa-solid fa-cart-plus"></i> ${t('modalOrderButton')}
      </button>
    </div>
  `;

  content.querySelector('.modal-add-cart-btn').addEventListener('click', () => {
    const colorSel = document.getElementById('modal-color-select');
    const color = colorSel ? colorSel.value : (colors[0] || 'افتراضي');
    Store.addToCart(product, color, 1);
    productModal.classList.remove('active');
    showToast(t('addedToCartToast'));
    openCartModal();
  });

  productModal.classList.add('active');
}

function updateDeliveryLabels() {
  if (!currentWilaya) {
    document.getElementById('home-delivery-rate').textContent = t('chooseWilaya');
    document.getElementById('desk-delivery-rate').textContent = t('chooseWilaya');
  }
}

function updatePricingSummary() {
  const cart = Store.getCart();
  const productsSubtotal = Store.getCartTotal();
  const isHidePrices = !!Store.getConfig()?.hideAllPrices;

  const wilayaCode = parseInt(wilayaSelect.value, 10);
  const shippingRates = Store.getShippingRates();
  const wilayaRate = shippingRates[wilayaCode] || (wilayaCode ? (WILAYAS.find(w => w.code === wilayaCode) || {}) : null);

  let shippingFee = 0;
  if (wilayaRate) {
    shippingFee = deliveryType === 'home' ? (wilayaRate.homePrice || 650) : (wilayaRate.deskPrice || 400);
    document.getElementById('home-delivery-rate').textContent = formatDzd(wilayaRate.homePrice || 650, true);
    document.getElementById('desk-delivery-rate').textContent = formatDzd(wilayaRate.deskPrice || 400, true);
  } else {
    updateDeliveryLabels();
  }

  const grandTotal = productsSubtotal + shippingFee;

  const seriesCount = Store.getCartCount();
  const pairsCount = cart.reduce((sum, item) => sum + (item.seriesQty * item.pairsPerSeries), 0);

  document.getElementById('summary-series-qty').textContent = template('summaryQty', { series: seriesCount, pairs: pairsCount });
  document.getElementById('summary-product-price').textContent = isHidePrices
    ? (currentLang === 'ar' ? 'السعر عند الطلب' : 'Prix sur demande')
    : formatDzd(productsSubtotal);

  document.getElementById('summary-shipping-fee').textContent = formatDzd(wilayaRate ? shippingFee : 0, true);
  
  document.getElementById('summary-total-price').textContent = isHidePrices
    ? (currentLang === 'ar' ? 'السعر عند الطلب' : 'Prix sur demande')
    : formatDzd(grandTotal);
}

function handleCheckoutSubmit(e) {
  e.preventDefault();
  const cart = Store.getCart();
  if (cart.length === 0) {
    alert(t('emptyCartText'));
    return;
  }

  const customerName = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const wilayaCode = parseInt(wilayaSelect.value, 10);
  const commune = communeSelect.value;
  const rawAddress = document.getElementById('customer-address').value.trim();
  const address = deliveryType === 'home' ? rawAddress : (rawAddress || (currentLang === 'ar' ? 'الاستلام من مقر مكتب التوصيل بالولاية' : 'Retrait au bureau de livraison'));

  if (!wilayaCode || !commune) {
    alert(t('invalidLocation'));
    return;
  }

  const shippingRates = Store.getShippingRates();
  const wilayaData = WILAYAS.find(w => w.code === wilayaCode);
  const wilayaRate = shippingRates[wilayaCode] || wilayaData;

  const shippingFee = deliveryType === 'home' ? (wilayaRate.homePrice || 650) : (wilayaRate.deskPrice || 400);
  const productPriceTotal = Store.getCartTotal();
  const grandTotal = productPriceTotal + shippingFee;
  const orderRef = `JOU-${Math.floor(1000 + Math.random() * 9000)}`;

  const deliveryLabel = t(deliveryType === 'home' ? 'homeDeliveryShort' : 'deskDeliveryShort');
  const wilayaName = currentLang === 'ar' ? wilayaData.nameAr : wilayaData.nameFr;

  const formattedItems = cart.map(item => ({
    nameAr: item.nameAr,
    nameFr: item.nameFr,
    color: item.color,
    seriesQty: item.seriesQty,
    pairsCount: item.seriesQty * item.pairsPerSeries,
    price: item.totalPrice
  }));

  const firstItem = cart[0];
  const summaryProductName = cart.length === 1 ? firstItem.nameAr : `طلب سلة موحد (${cart.length} موديلات)`;
  const totalSeriesCount = Store.getCartCount();

  const newOrder = {
    id: orderRef,
    timestamp: new Date().toLocaleString(currentLang === 'ar' ? 'ar-DZ' : 'fr-DZ'),
    customerName,
    phone,
    wilaya: wilayaName,
    commune,
    address,
    deliveryType,
    deliveryLabel,
    productName: summaryProductName,
    items: formattedItems,
    color: firstItem.color,
    seriesQty: `${totalSeriesCount} كرطون`,
    productPrice: productPriceTotal,
    shippingFee,
    totalAmount: grandTotal,
    status: "New"
  };

  Store.addOrder(newOrder);
  Store.clearCart();
  updateAdminBadgeCount();

  if (window.fbq) {
    window.fbq('track', 'Purchase', {
      value: grandTotal,
      currency: 'DZD',
      content_name: summaryProductName,
      content_type: 'product'
    });
  }

  checkoutModal.classList.remove('active');
  checkoutForm.reset();
  showSuccessModal(newOrder, wilayaName, formattedItems);
}

function showSuccessModal(order, wilayaName, items) {
  const isHidePrices = !!Store.getConfig()?.hideAllPrices;
  const fields = {
    customer: currentLang === 'ar' ? 'الزبون / المحل:' : 'Client / Boutique:',
    phone: currentLang === 'ar' ? 'الهاتف:' : 'Telephone:',
    location: currentLang === 'ar' ? 'الولاية والبلدية:' : 'Wilaya & Commune:',
    address: currentLang === 'ar' ? 'العنوان:' : 'Adresse:',
    delivery: currentLang === 'ar' ? 'التوصيل:' : 'Livraison:',
    total: currentLang === 'ar' ? 'المجموع النهائي عند الاستلام:' : 'Total a la livraison:'
  };
  const config = Store.getConfig();
  document.getElementById('success-order-id').textContent = `#${order.id}`;

  const itemsHtml = items.map(item => `
    <div style="padding: 6px 0; border-bottom: 1px dashed var(--line);">
      📌 <strong>${item.nameAr}</strong> (${item.color}) - <span>${item.seriesQty} كرطون</span> ${!isHidePrices ? `= <strong>${formatDzd(item.price)}</strong>` : ''}
    </div>
  `).join('');

  const totalHtml = isHidePrices
    ? (currentLang === 'ar' ? 'تحديد السعر عند التواصل (السعر مخفي)' : 'Prix sur demande')
    : formatDzd(order.totalAmount);

  document.getElementById('success-summary-box').innerHTML = `
    <div class="summary-field"><span>${fields.customer}</span><strong>${order.customerName}</strong></div>
    <div class="summary-field"><span>${fields.phone}</span><strong>${order.phone}</strong></div>
    <div class="summary-field"><span>${fields.location}</span><strong>${wilayaName} - ${order.commune}</strong></div>
    <div class="summary-field"><span>${fields.address}</span><strong>${order.address}</strong></div>
    <div class="summary-field"><span>${fields.delivery}</span><strong>${order.deliveryLabel} (${formatDzd(order.shippingFee, true)})</strong></div>
    <div style="margin-top: 10px;">
      <span style="font-weight: 800;">المنتجات المطلوبة بالطلب:</span>
      <div style="margin-top: 6px;">${itemsHtml}</div>
    </div>
    <div class="summary-field total" style="margin-top: 12px;"><span>${fields.total}</span><strong>${totalHtml}</strong></div>
  `;

  const cleanWa = (config.whatsapp || '213660125123').replace(/\D/g, '');
  
  const itemsTextList = items.map((item, i) => `${i + 1}. *${item.nameAr}* (${item.color}) - ${item.seriesQty} كرطون ${!isHidePrices ? `(${formatDzd(item.price)})` : ''}`).join('\n');

  const messageLines = [
    `*${t('whatsappMessage')}*`,
    `--------------------------`,
    `📌 *المرجع:* #${order.id}`,
    `👤 *الزبون:* ${order.customerName}`,
    `📞 *الهاتف:* ${order.phone}`,
    `📍 *المكان:* ${wilayaName} - ${order.commune}`,
    `🏠 *العنوان:* ${order.address}`,
    `🚚 *التوصيل:* ${order.deliveryLabel} (${formatDzd(order.shippingFee, true)})`,
    `--------------------------`,
    `👠 *المنتجات المطلوبة (${items.length}):*`,
    itemsTextList,
    `--------------------------`,
    isHidePrices
      ? `💰 *المجموع:* تحديد السعر عند التواصل`
      : `💰 *المجموع النهائي عند الاستلام:* ${formatDzd(order.totalAmount)}`
  ];

  const waBtn = document.getElementById('whatsapp-order-btn');
  waBtn.href = `https://wa.me/${cleanWa}?text=${encodeURIComponent(messageLines.join('\n'))}`;

  successModal.classList.add('active');
}

function updateAdminBadgeCount() {
  const badge = document.getElementById('admin-orders-badge');
  if (badge) badge.textContent = Store.getOrders().length;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) {
    let toast = document.getElementById('joulane-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'joulane-toast';
      toast.className = 'joulane-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `joulane-toast ${type}`;
  toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// PWA Install Prompt Logic (Only for #stock panel)
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  if (window.location.hash === '#stock') {
    deferredPrompt.prompt();
    deferredPrompt = null;
  }
});

window.addEventListener('hashchange', () => {
  if (window.location.hash === '#stock' && deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt = null;
  }
});
