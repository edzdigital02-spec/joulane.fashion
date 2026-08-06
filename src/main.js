import { Store } from './store.js';
import { Capacitor } from '@capacitor/core';
import './androidUpdater.js';

import { initAdmin } from './admin.js';
import { initStockPanel } from './stock.js';
import { WILAYAS } from './data/wilayas.js';
import { localizedProductColors } from './data/productColors.js';
import { metaProductParams, productPagePath } from './productSeo.js';
import {
  canShareOrderReceipt,
  downloadOrderReceipt,
  shareOrderReceipt
} from './orderReceipt.js';

const I18N = {
  ar: {
    topNotice: "بيع أحذية نسائية بالجملة يد أولى، توصيل لجميع الولايات",
    brandSub: "Fashion - أحذية نسائية بالجملة",
    langButton: "Français",
    themeDark: "الوضع الداكن",
    themeLight: "الوضع الفاتح",
    ordersAdmin: "الطلبات",
    cartTitle: "سلة التسوق",
    floatingCartEmpty: "فتح السلة، السلة فارغة",
    floatingCartCount: "فتح السلة، {count} كرتون",
    orderNow: "السلة",
    addToCart: "إضافة للسلة",
    addedToCartToast: "تمت إضافة المنتج للسلة بنجاح! 🛒",
    cartHeading: "سلة التسوق والجملة",
    cartSubheading: "المنتجات المختارة لإرسال طلب الجملة الموحد",
    proceedCheckout: "إكمال الطلب",
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
    stickySub: "توصيل لجميع الولايات",
    orderShort: "عرض السلة",
    checkoutTitle: "تأكيد طلب السلة الموحد",
    checkoutText: "املأ بياناتك، سنحفظ الطلب ونرسل إشعاراً تلقائياً إلى واتساب المتجر.",
    qtyLabel: "الكمية",
    colorLabel: "اللون",
    nameLabel: "الاسم الكامل / اسم المحل",
    namePlaceholder: "",
    phoneLabel: "رقم الهاتف",
    phoneHelp: "صيغة الهاتف: 05 أو 06 أو 07 ثم 8 أرقام.",
    invalidPhone: "أدخل رقم هاتف جزائري صحيحاً من 10 أرقام يبدأ بـ 05 أو 06 أو 07.",
    wilayaLabel: "الولاية",
    communeLabel: "البلدية",
    chooseWilayaFirst: "اختر الولاية أولا",
    deliveryTypeLabel: "نوع التوصيل",
    shippingCarrier: "يشحن موقعنا عن طريق كازيتور.",
    shippingPriceContact: "يتم تحديد السعر عند التواصل",
    chooseWilaya: "اختر الولاية",
    homeDelivery: "للمنزل / المحل",
    deskDelivery: "استلام من المكتب",
    addressLabel: "العنوان أو اسم المكتب",
    addressPlaceholder: "الشارع، اسم المحل، أو مكتب التوصيل",
    productsTotalLabel: "مجموع السلة",
    deliveryLabel: "التوصيل",
    totalLabel: "المجموع الكلي عند الاستلام",
    submitOrder: "تأكيد الطلب وإرساله",
    successTitle: "تم حفظ الطلب بنجاح",
    referenceLabel: "المرجع:",
    sendWhatsapp: "فتح محادثة المتجر",
    downloadInvoice: "تنزيل فاتورة PDF",
    shareInvoice: "مشاركة الفاتورة",
    whatsappSending: "جارٍ إرسال إشعار الطلب إلى واتساب المتجر...",
    whatsappSent: "تم إرسال إشعار الطلب تلقائياً إلى واتساب المتجر.",
    whatsappQueued: "تم حفظ الطلب، وسيُرسل إشعار واتساب تلقائياً عند عودة الاتصال.",
    whatsappPendingSetup: "تم حفظ طلبك بنجاح، وسيتواصل معك المتجر لتأكيده.",
    backCatalog: "العودة إلى الموقع",
    oneSeries: "1 كرطون = {pairs} أزواج",
    ordersCount: "{count} طلب",
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
    floatingCartEmpty: "Ouvrir le panier, le panier est vide",
    floatingCartCount: "Ouvrir le panier, {count} carton(s)",
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
    stickySub: "Livraison dans toutes les wilayas",
    orderShort: "Voir Panier",
    checkoutTitle: "Confirmer la commande groupee",
    checkoutText: "Renseignez vos informations : la commande sera enregistree et notifiee automatiquement sur WhatsApp.",
    qtyLabel: "Quantite",
    colorLabel: "Couleur",
    nameLabel: "Nom complet / boutique",
    namePlaceholder: "",
    phoneLabel: "Telephone",
    phoneHelp: "Format: 05, 06 ou 07 puis 8 chiffres.",
    invalidPhone: "Saisissez un numero algerien de 10 chiffres commencant par 05, 06 ou 07.",
    wilayaLabel: "Wilaya",
    communeLabel: "Commune",
    chooseWilayaFirst: "Choisissez la wilaya d'abord",
    deliveryTypeLabel: "Type de livraison",
    shippingCarrier: "Notre site expedie via Kazitour.",
    shippingPriceContact: "Le prix sera determine lors du contact",
    chooseWilaya: "Choisissez la wilaya",
    homeDelivery: "A domicile / boutique",
    deskDelivery: "Retrait au bureau",
    addressLabel: "Adresse ou nom du bureau",
    addressPlaceholder: "Rue, nom de boutique ou bureau de livraison",
    productsTotalLabel: "Total Produits",
    deliveryLabel: "Livraison",
    totalLabel: "Total a la livraison",
    submitOrder: "Confirmer et envoyer",
    successTitle: "Commande enregistree",
    referenceLabel: "Reference:",
    sendWhatsapp: "Ouvrir la discussion",
    downloadInvoice: "Telecharger la facture PDF",
    shareInvoice: "Partager la facture",
    whatsappSending: "Envoi automatique de la notification WhatsApp...",
    whatsappSent: "La notification a ete envoyee automatiquement sur WhatsApp.",
    whatsappQueued: "Commande enregistree. La notification sera envoyee au retour de la connexion.",
    whatsappPendingSetup: "Votre commande est bien enregistree. La boutique vous contactera pour la confirmer.",
    backCatalog: "Retour au site",
    oneSeries: "1 serie = {pairs} paires",
    ordersCount: "{count} commandes",
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
let lastSuccessfulOrder = null;
let incomingProductHandled = false;
let incomingProductRetryAttached = false;
let floatingCartPulseTimer = null;

const ATTRIBUTION_STORAGE_KEY = 'joulane_marketing_attribution';
const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

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
  captureMarketingAttribution();
  renderApp();
  initEventListeners();
  handleIncomingProductLink();

  const pageSurface = window.location.pathname.endsWith('/admin.html')
    ? 'admin'
    : window.location.pathname.endsWith('/stock.html') ? 'stock' : 'customer';
  const nativeSurface = Capacitor.isNativePlatform() ? pageSurface : 'web';

  if (nativeSurface !== 'web') {
    ['admin-install-apk-btn', 'stock-install-apk-btn'].forEach(id => {
      document.getElementById(id)?.remove();
    });
  }

  if (pageSurface === 'customer' || pageSurface === 'admin') initAdmin(renderApp);
  if (pageSurface === 'stock') initStockPanel(renderApp);
  const supabaseReady = Store.initSupabase(renderApp);
  setupOrderTracking(supabaseReady);



  // Global Event Listeners
  window.addEventListener('joulane:refreshStore', () => renderApp());
  window.addEventListener('joulane:configUpdated', () => renderApp());
  window.addEventListener('joulane:productsUpdated', () => renderApp());
  window.addEventListener('joulane:categoriesUpdated', () => renderApp());
  window.addEventListener('joulane:shippingUpdated', () => updatePricingSummary());
  window.addEventListener('joulane:cartUpdated', () => updateCartUI());
  window.addEventListener('joulane:showToast', (e) => showToast(e.detail));
  window.addEventListener('storage', (event) => {
    if (event.key === 'joulane_cart') updateCartUI();
  });
  window.addEventListener('pageshow', () => updateCartUI());
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

const TRACKING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalizeTrackingCode(value) {
  const compact = String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
  const payload = compact.startsWith('JLN') ? compact.slice(3) : compact;
  return payload.length === 10 ? `JLN-${payload}` : String(value || '').trim().toUpperCase();
}

function createTrackingCode() {
  const bytes = new Uint8Array(10);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return `JLN-${Array.from(bytes, byte => TRACKING_ALPHABET[byte % TRACKING_ALPHABET.length]).join('')}`;
}

function trackingLink(trackingCode) {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('track', normalizeTrackingCode(trackingCode));
  url.hash = 'track-order';
  return url.toString();
}

async function copyText(value, successMessage) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
    else {
      const helper = document.createElement('textarea');
      helper.value = value;
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      helper.remove();
    }
    showToast(successMessage || 'تم النسخ بنجاح');
    return true;
  } catch (_) {
    showToast('تعذر النسخ تلقائياً. حدّد النص وانسخه يدوياً.', 'error');
    return false;
  }
}

function trackingStatusMeta(status) {
  const values = {
    New: { ar: 'تم استلام الطلب', fr: 'Commande reçue', icon: 'fa-receipt' },
    Confirmed: { ar: 'تم تأكيد الطلب', fr: 'Commande confirmée', icon: 'fa-circle-check' },
    Shipped: { ar: 'الطلب في طريقه إليك', fr: 'Commande expédiée', icon: 'fa-truck-fast' },
    Delivered: { ar: 'تم تسليم الطلب', fr: 'Commande livrée', icon: 'fa-box-circle-check' },
    Cancelled: { ar: 'تم إلغاء الطلب', fr: 'Commande annulée', icon: 'fa-ban' }
  };
  return values[status] || values.New;
}

function trackingDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(currentLang === 'fr' ? 'fr-DZ' : 'ar-DZ', {
    dateStyle: 'medium', timeStyle: 'short'
  }).format(date);
}

function renderTrackingResult(payload) {
  const result = document.getElementById('tracking-result');
  if (!result) return;
  result.hidden = false;
  if (payload?.status === 'loading') {
    result.className = 'tracking-result is-loading';
    result.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>جارٍ البحث عن طلبك...</span>';
    return;
  }
  if (payload?.status !== 'ok' || !payload.order) {
    const unavailable = payload?.status === 'unavailable';
    result.className = 'tracking-result is-error';
    result.innerHTML = `<i class="fa-solid ${unavailable ? 'fa-wifi' : 'fa-circle-exclamation'}"></i><div><strong>${unavailable ? 'تعذر الاتصال الآن' : 'لم نعثر على هذا الطلب'}</strong><small>${unavailable ? 'تحقق من الإنترنت وحاول مرة أخرى.' : 'راجع رقم التتبع كما ظهر لك بعد إتمام الطلب.'}</small></div>`;
    return;
  }
  const order = payload.order;
  const status = trackingStatusMeta(order.orderStatus);
  const timeline = Array.isArray(order.timeline) ? order.timeline : [];
  result.className = `tracking-result is-success is-${String(order.orderStatus || 'New').toLowerCase()}`;
  result.innerHTML = `
    <div class="tracking-current-status">
      <span class="tracking-current-status__icon"><i class="fa-solid ${status.icon}"></i></span>
      <div><small>الحالة الحالية</small><strong>${escapeHTML(currentLang === 'fr' ? status.fr : status.ar)}</strong><span>آخر تحديث: ${escapeHTML(trackingDate(order.updatedAt))}</span></div>
    </div>
    <div class="tracking-order-meta">
      <span><small>رقم التتبع</small><b>${escapeHTML(order.trackingCode)}</b></span>
      <span><small>مرجع الطلب</small><b>${escapeHTML(order.reference)}</b></span>
      <span><small>عدد المنتجات</small><b>${Number(order.itemCount) || 1}</b></span>
    </div>
    <ol class="tracking-timeline">
      ${timeline.map((event, index) => {
        const eventMeta = trackingStatusMeta(event.status);
        return `<li class="${index === timeline.length - 1 ? 'is-current' : 'is-complete'}"><span><i class="fa-solid ${eventMeta.icon}"></i></span><div><strong>${escapeHTML(currentLang === 'fr' ? eventMeta.fr : eventMeta.ar)}</strong><small>${escapeHTML(trackingDate(event.at))}</small></div></li>`;
      }).join('')}
    </ol>`;
}

function setupOrderTracking(supabaseReady) {
  const toggle = document.getElementById('tracking-widget-toggle');
  const panel = document.getElementById('tracking-widget-panel');
  const form = document.getElementById('tracking-search-form');
  const input = document.getElementById('tracking-code-input');
  if (!toggle || !panel || !form || !input) return;
  const setOpen = open => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    document.getElementById('track-order')?.classList.toggle('is-open', open);
    toggle.closest('.catalog-command-bar')?.classList.toggle('is-tracking-open', open);
  };
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  input.addEventListener('input', () => { input.value = normalizeTrackingCode(input.value).slice(0, 14); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const code = normalizeTrackingCode(input.value);
    if (!/^JLN-[A-Z2-9]{10}$/.test(code)) {
      renderTrackingResult({ status: 'invalid' });
      return;
    }
    input.value = code;
    renderTrackingResult({ status: 'loading' });
    renderTrackingResult(await Store.trackOrder(code));
  });
  const incomingCode = new URLSearchParams(window.location.search).get('track');
  if (incomingCode) {
    setOpen(true);
    input.value = normalizeTrackingCode(incomingCode);
    document.getElementById('track-order')?.scrollIntoView({ block: 'center' });
    Promise.resolve(supabaseReady).finally(() => form.requestSubmit());
  }
}

function t(key) {
  return I18N[currentLang][key] || key;
}

function trackMetaEvent(eventName, product, extra = {}, options = {}) {
  if (!window.JoulaneAnalytics) return false;
  const params = product
    ? metaProductParams(product, currentLang, extra)
    : extra;
  return window.JoulaneAnalytics.track(eventName, params, options);
}

function captureMarketingAttribution() {
  const query = new URLSearchParams(window.location.search);
  const currentTouch = {};
  ATTRIBUTION_KEYS.forEach(key => {
    const value = (query.get(key) || '').trim();
    if (value) currentTouch[key] = value.slice(0, 500);
  });
  if (!Object.keys(currentTouch).length) return;

  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    const capturedAt = new Date().toISOString();
    const attribution = {
      firstTouch: existing.firstTouch || { ...currentTouch, capturedAt },
      lastTouch: { ...currentTouch, capturedAt }
    };
    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  } catch (_) {
    // Attribution is optional and must never block the storefront.
  }
}

function marketingAttributionSnapshot() {
  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function addProductToCart(product) {
  if (!product || product.isAvailable === false) {
    showToast(
      currentLang === 'ar' ? 'هذا الموديل غير متوفر حاليًا.' : 'Ce modèle est indisponible actuellement.',
      'error'
    );
    return false;
  }

  const allColors = availableProductColors(product);
  const colorsToAdd = allColors.length ? allColors : ['تشكيلة حسب الموديل'];
  Store.addToCart(product, colorsToAdd, 1);
  trackMetaEvent('AddToCart', product, {
    quantity: 1,
    contents: [{ id: product.id, quantity: 1 }],
    value: Number(product.seriesPrice) || (Number(product.price) * (Number(product.pairsPerSeries) || 18)),
    currency: 'DZD'
  });
  showToast(t('addedToCartToast'));
  updateCartUI();
  return true;
}

function removeIncomingProductParameter() {
  try {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('add');
    nextUrl.searchParams.delete('product');
    nextUrl.searchParams.delete('cart');
    window.history.replaceState(
      window.history.state,
      '',
      `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
    );
  } catch (_) {
    // URL cleanup is optional and must never block product browsing.
  }
}

function focusCatalogProduct(productId) {
  window.requestAnimationFrame(() => {
    const linkedCard = Array.from(
      productsContainer?.querySelectorAll('[data-product-id]') || []
    ).find(card => card.dataset.productId === productId);
    const target = linkedCard || document.getElementById('catalog');

    target?.scrollIntoView({
      behavior: 'smooth',
      block: linkedCard ? 'center' : 'start'
    });

    if (linkedCard) {
      linkedCard.classList.add('is-linked-product');
      window.setTimeout(() => linkedCard.classList.remove('is-linked-product'), 3200);
    }
  });
}

function handleIncomingProductLink() {
  if (incomingProductHandled) return;
  const query = new URLSearchParams(window.location.search);
  const addProductId = query.get('add');
  const productId = addProductId || query.get('product');
  const shouldOpenCart = ['open', '1', 'true'].includes((query.get('cart') || '').toLowerCase());
  if (!productId) {
    if (shouldOpenCart) {
      incomingProductHandled = true;
      removeIncomingProductParameter();
      openCartModal();
    }
    return;
  }

  const product = Store.getProducts().find(item => item.id === productId);
  if (!product) {
    if (!incomingProductRetryAttached) {
      incomingProductRetryAttached = true;
      window.addEventListener('joulane:productsUpdated', () => {
        incomingProductRetryAttached = false;
        handleIncomingProductLink();
      }, { once: true });
    }
    return;
  }

  incomingProductHandled = true;
  removeIncomingProductParameter();
  focusCatalogProduct(product.id);

  if (addProductId) {
    addProductToCart(product);
  }
  if (shouldOpenCart) openCartModal();
}

function template(key, values = {}) {
  return t(key).replace(/\{(\w+)\}/g, (_, token) => values[token] ?? '');
}

function normalizeDeliveryCopy(value) {
  return String(value || '')
    .replace(/توصيل\s+58\s+ولاية/g, 'توصيل لجميع الولايات')
    .replace(/Livraison\s+58\s+wilayas/gi, 'Livraison dans toutes les wilayas');
}

function productText(product, field) {
  const value = product[field];
  if (!value) return '';
  return normalizeDeliveryCopy(typeof value === 'object' ? (value[currentLang] || value.ar || '') : value);
}

function productImageUrl(product) {
  const rawImg = typeof product === 'string' ? product : (product?.image || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg');
  if (!rawImg) return 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg';
  if (rawImg.startsWith('http://') || rawImg.startsWith('https://') || rawImg.startsWith('data:')) return rawImg;
  return 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg';
}

function availableProductColors(product, lang) {
  var colors = localizedProductColors(product, lang || currentLang);
  var unique = [];
  colors.forEach(function(c) { var s = String(c).trim(); if (s && unique.indexOf(s) === -1) unique.push(s); });
  return unique;
}

function cartonQuantityLabel(quantity) {
  const count = Math.max(1, Number(quantity) || 1);
  if (currentLang === 'fr') return `${count} carton${count > 1 ? 's' : ''}`;
  if (count === 1) return 'كرتون واحد';
  if (count === 2) return 'كرتونان';
  if (count >= 3 && count <= 10) return `${count} كراتين`;
  return `${count} كرتون`;
}

function configFlag(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['false', '0', 'off', 'no', 'hidden'].includes(normalized)) return false;
    if (['true', '1', 'on', 'yes', 'visible'].includes(normalized)) return true;
  }
  return fallback;
}

function formatDzd(amount, isShipping = false) {
  const isHidePrices = configFlag(Store.getConfig()?.hideAllPrices, false);
  if (isHidePrices && !isShipping) {
    return t('shippingPriceContact');
  }
  const value = Number(amount).toLocaleString(currentLang === 'ar' ? 'ar-DZ' : 'fr-DZ');
  return currentLang === 'ar' ? `${value} دج` : `${value} DZD`;
}

function shippingPricesAreVisible(shippingRates = Store.getShippingRates()) {
  return configFlag(shippingRates?._showPrices, false);
}

function shippingRateAmount(rate, field) {
  const amount = Number(rate?.[field]);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
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
    const isVisible = configFlag(isVisibleVal, true);
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
  const productOrderStats = Store.getProductOrderStats();
  const catalogConfig = Store.getConfig();
  const showPromoBadge = configFlag(catalogConfig.showProductPromoBadge, true);
  const showCartonBadge = configFlag(catalogConfig.showCartonBadge, true);
  const showProductCategory = configFlag(catalogConfig.showProductCategory, true);
  const showProductStars = configFlag(catalogConfig.showProductStars, true);
  const showProductRating = configFlag(catalogConfig.showProductRating, false);
  const showProductDescription = configFlag(catalogConfig.showProductDescription, true);
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
    const isUnavailable = product.isAvailable === false;
    const isHidePrices = configFlag(catalogConfig.hideAllPrices, false);
    const realOrderCount = Math.max(0, Number(productOrderStats?.[product.id]?.orders) || 0);
    const card = document.createElement('article');
    card.className = `product-card ${isUnavailable ? 'out-of-stock-card' : ''}`;
    card.dataset.productId = product.id;
    card.innerHTML = `
      <a class="product-card-link" href="${escapeHTML(productPagePath(product, currentLang))}" aria-label="${escapeHTML(`${t('viewDetails')}: ${productText(product, 'name')}`)}"></a>
      <div class="product-image-box">
        <img src="${productImageUrl(product)}" alt="${productText(product, 'name')}" class="product-img" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='${product.image || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg'}';" />
        ${showPromoBadge && productText(product, 'discountBadge') ? `<span class="discount-badge">${productText(product, 'discountBadge')}</span>` : ''}
        ${showCartonBadge || isUnavailable ? `<span class="stock-badge">
          <i class="fa-solid fa-box"></i> 
          ${isUnavailable ? (currentLang === 'ar' ? 'غير متوفر' : 'Indisponible') : template('oneSeries', { pairs: product.pairsPerSeries || 18 })}
        </span>` : ''}
      </div>
      <div class="product-details">
        ${showProductCategory ? `<span class="product-cat">${categoryLabel(product.category)}</span>` : ''}
        <h3 class="product-title">${productText(product, 'name')}</h3>
        ${showProductStars || (showProductRating && realOrderCount > 0) ? `<div class="product-rating">
          ${showProductStars ? `<span class="product-stars" role="img" aria-label="${currentLang === 'ar' ? 'تقييم خمس نجوم' : 'Note de cinq étoiles'}">
            <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
          </span>` : ''}
          ${showProductRating && realOrderCount > 0 ? `<span class="product-orders-count"><i class="fa-solid fa-box-open"></i> ${template('ordersCount', { count: realOrderCount })}</span>` : ''}
        </div>` : ''}
        <div class="price-box">
          ${isHidePrices ? `
            <span class="current-price price-hidden-badge">${t('shippingPriceContact')}</span>
          ` : `
            <span class="current-price">${formatDzd(product.seriesPrice)}</span>
            ${product.oldPrice ? `<span class="old-price">${formatDzd(product.oldPrice)}</span>` : ''}
          `}
        </div>
        ${showProductDescription ? `<p class="product-description">${productText(product, 'description')}</p>` : ''}
        <div class="product-actions">
          <button class="btn btn-gold add-to-cart-btn" data-id="${product.id}" aria-label="${isUnavailable ? (currentLang === 'ar' ? 'المنتج غير متوفر' : 'Produit indisponible') : `${t('addToCart')}: ${productText(product, 'name')}`}" ${isUnavailable ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
            <i class="fa-solid fa-cart-plus"></i> ${isUnavailable ? (currentLang === 'ar' ? 'غير متوفر' : 'Indisponible') : t('addToCart')}
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
          addProductToCart(product);
        }
      });
    }
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

  const floatingButton = document.getElementById('floating-cart-btn');
  const floatingBadge = document.getElementById('floating-cart-badge');
  if (floatingButton) {
    const previousCount = Number(floatingButton.dataset.cartCount || 0);
    floatingButton.dataset.cartCount = String(count);
    floatingButton.classList.toggle('has-items', count > 0);
    floatingButton.setAttribute(
      'aria-label',
      count > 0 ? template('floatingCartCount', { count }) : t('floatingCartEmpty')
    );

    if (count > previousCount) {
      floatingButton.classList.remove('is-pulsing');
      void floatingButton.offsetWidth;
      floatingButton.classList.add('is-pulsing');
      window.clearTimeout(floatingCartPulseTimer);
      floatingCartPulseTimer = window.setTimeout(() => {
        floatingButton.classList.remove('is-pulsing');
      }, 620);
    }
  }
  if (floatingBadge) {
    floatingBadge.hidden = count <= 0;
    floatingBadge.textContent = count > 99 ? '99+' : String(count);
  }

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
      ? t('shippingPriceContact')
      : formatDzd(Store.getCartTotal());
  }

  container.innerHTML = cart.map((item, index) => {
    const metaHtml = isHidePrices
      ? `<span class="price-hidden-badge">${t('shippingPriceContact')}</span>`
      : `<span class="text-gold"><strong>${formatDzd(item.seriesPrice)}</strong> / للكرطون (${item.pairsPerSeries} أزواج)</span>`;

    const itemTotalHtml = isHidePrices
      ? `<span class="price-hidden-badge" style="font-size:0.8rem;">${t('shippingPriceContact')}</span>`
      : formatDzd(item.totalPrice);

    return `
      <div class="cart-item-card">
        <div class="cart-item-heading">
          <div class="cart-item-details">
            <span class="cart-model-kicker"><i class="fa-solid fa-box"></i> ${currentLang === 'ar' ? 'طلب بالكرتون' : 'Commande par carton'}</span>
            <h4>${currentLang === 'ar' ? item.nameAr : item.nameFr}</h4>
            <div class="cart-item-meta">${metaHtml}</div>
          </div>
          <img src="${productImageUrl(item.image)}" alt="${currentLang === 'ar' ? item.nameAr : item.nameFr}" class="cart-item-img" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='${item.image || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg'}';" />
        </div>
        <div class="cart-item-controls">
          <div class="qty-stepper-box" aria-label="${currentLang === 'ar' ? 'تحديد عدد الكراتين' : 'Choisir le nombre de cartons'}">
            <button type="button" class="qty-btn dec-qty" data-index="${index}" aria-label="${currentLang === 'ar' ? 'إنقاص كرتون' : 'Retirer un carton'}">−</button>
            <span class="qty-val">
              <strong>${cartonQuantityLabel(item.seriesQty)}</strong>
              <small>${item.seriesQty * item.pairsPerSeries} ${currentLang === 'ar' ? 'زوج' : 'paires'}</small>
            </span>
            <button type="button" class="qty-btn inc-qty" data-index="${index}" aria-label="${currentLang === 'ar' ? 'إضافة كرتون' : 'Ajouter un carton'}">+</button>
          </div>
          <div class="cart-item-total">${itemTotalHtml}</div>
          <button type="button" class="btn btn-danger-outline remove-cart-item-btn" data-index="${index}" title="حذف من السلة" aria-label="حذف المنتج من السلة">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Cart Item Listeners
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
  if (checkoutModal?.classList.contains('active')) closeCheckoutModal();
  updateCartUI();
  cartModal.classList.add('active');
  document.getElementById('floating-cart-btn')?.setAttribute('aria-expanded', 'true');
}

function closeCartModal() {
  cartModal.classList.remove('active');
  document.getElementById('floating-cart-btn')?.setAttribute('aria-expanded', 'false');
}

function closeCheckoutModal() {
  checkoutModal.classList.remove('active');
  document.body.classList.remove('checkout-active');
}

function openCheckoutFromCart() {
  const cart = Store.getCart();
  if (cart.length === 0) {
    alert(t('emptyCartText'));
    return;
  }
  if (window.JoulaneAnalytics) {
    const contentIds = cart.map(item => item.productId).filter(Boolean);
    window.JoulaneAnalytics.track('InitiateCheckout', {
      content_ids: contentIds,
      content_type: 'product',
      contents: cart.map(item => ({
        id: item.productId,
        quantity: Number(item.seriesQty) || 1
      })),
      item_count: contentIds.length,
      num_items: cart.reduce((sum, item) => sum + (Number(item.seriesQty) || 1), 0),
      language: currentLang
    });
  }
  closeCartModal();

  const isHidePrices = !!Store.getConfig()?.hideAllPrices;
  const preview = document.getElementById('checkout-product-preview');
  preview.innerHTML = `
    <div class="checkout-cart-summary-list">
      <h4><i class="fa-solid fa-boxes-packing"></i> المنتجات المطلوبة بالسلة (${cart.length}):</h4>
      ${cart.map(item => `
        <div class="checkout-cart-item-row">
          <img src="${productImageUrl(item.image)}" alt="${currentLang === 'ar' ? item.nameAr : item.nameFr}" class="checkout-item-thumb" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='${item.image || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg'}';" />
          <div>
            <strong>${currentLang === 'ar' ? item.nameAr : item.nameFr}</strong>
            <div class="text-muted" style="font-size:0.85rem;">${currentLang === 'ar' ? 'الكمية' : 'Quantité'}: ${cartonQuantityLabel(item.seriesQty)} (${item.seriesQty * item.pairsPerSeries} ${currentLang === 'ar' ? 'زوج' : 'paires'})</div>
          </div>
          <div style="margin-inline-start: auto; font-weight: 800;" class="text-gold">
            ${isHidePrices ? `<span class="price-hidden-badge" style="font-size:0.8rem;">${t('shippingPriceContact')}</span>` : formatDzd(item.totalPrice)}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  updatePricingSummary();
  checkoutModal.classList.add('active');
  document.body.classList.add('checkout-active');
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
    renderApp();
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

  // Persistent floating cart button
  document.getElementById('floating-cart-btn')?.addEventListener('click', openCartModal);
  
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

  const checkoutPhoneInput = document.getElementById('customer-phone');
  checkoutPhoneInput?.addEventListener('input', () => {
    checkoutPhoneInput.value = checkoutPhoneInput.value.replace(/\D/g, '').slice(0, 10);
    checkoutPhoneInput.setCustomValidity('');
  });
  checkoutForm.addEventListener('submit', handleCheckoutSubmit);

  document.getElementById('close-product-modal').addEventListener('click', () => productModal.classList.remove('active'));
  document.getElementById('close-cart-modal').addEventListener('click', closeCartModal);
  document.getElementById('close-checkout-modal').addEventListener('click', closeCheckoutModal);
  document.getElementById('close-success-btn').addEventListener('click', () => successModal.classList.remove('active'));
  document.getElementById('copy-tracking-code-btn')?.addEventListener('click', () => {
    const code = document.getElementById('success-tracking-code')?.textContent || '';
    if (code) void copyText(code, 'تم نسخ رقم التتبع');
  });
  document.getElementById('copy-tracking-link-btn')?.addEventListener('click', () => {
    const link = document.getElementById('success-tracking-link')?.value || '';
    if (link) void copyText(link, 'تم نسخ رابط تتبع طلبك');
  });
  document.getElementById('download-order-pdf-btn')?.addEventListener('click', async () => {
    if (!lastSuccessfulOrder) return;
    await runReceiptAction('download-order-pdf-btn', () => downloadOrderReceipt(lastSuccessfulOrder));
  });
  document.getElementById('share-order-pdf-btn')?.addEventListener('click', async () => {
    if (!lastSuccessfulOrder) return;
    await runReceiptAction('share-order-pdf-btn', () => shareOrderReceipt(lastSuccessfulOrder));
  });

  [productModal, cartModal, checkoutModal, successModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target !== modal) return;
      if (modal === cartModal) closeCartModal();
      else if (modal === checkoutModal) closeCheckoutModal();
      else modal.classList.remove('active');
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openModal = [successModal, checkoutModal, cartModal, productModal]
      .find(modal => modal?.classList.contains('active'));
    if (openModal === cartModal) closeCartModal();
    else if (openModal === checkoutModal) closeCheckoutModal();
    else openModal?.classList.remove('active');
  });
}

function openProductModal(productId) {
  const products = Store.getProducts();
  const product = products.find(p => p.id === productId) || products[0];
  selectedProduct = product;
  const isUnavailable = product.isAvailable === false;
  trackMetaEvent('ViewContent', product);

  const content = document.getElementById('product-modal-content');
  const features = product.features
    ? (product.features[currentLang] || product.features.ar || []).map(normalizeDeliveryCopy)
    : [];

  content.innerHTML = `
    <div class="product-modal-media">
      <img src="${productImageUrl(product)}" alt="${productText(product, 'name')}" class="modal-product-img" decoding="async" onerror="this.onerror=null; this.src='${product.image || 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg'}';" />
    </div>
    <div class="product-modal-info">
      <span class="product-cat">${categoryLabel(product.category)}</span>
      <h2>${productText(product, 'name')}</h2>
      <div class="price-box">
        ${Store.getConfig()?.hideAllPrices ? `
          <span class="current-price price-hidden-badge">${t('shippingPriceContact')}</span>
        ` : `
          <span class="current-price">${formatDzd(product.seriesPrice)}</span>
          ${product.oldPrice ? `<span class="old-price">${formatDzd(product.oldPrice)}</span>` : ''}
        `}
      </div>
      <p class="modal-series-info"><i class="fa-solid fa-boxes-stacked"></i> ${template('seriesSizesLine', { pairs: product.pairsPerSeries || 18 })}</p>
      <p>${productText(product, 'description')}</p>
      
      ${features.length ? `<ul class="modal-features">${features.map(f => `<li><i class="fa-solid fa-check"></i> ${f}</li>`).join('')}</ul>` : ''}
      
      <button class="btn btn-gold btn-block btn-lg margin-top-16 modal-add-cart-btn" data-id="${product.id}" ${isUnavailable ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
        <i class="fa-solid ${isUnavailable ? 'fa-ban' : 'fa-cart-plus'}"></i> ${isUnavailable ? (currentLang === 'ar' ? 'الموديل غير متوفر' : 'Modèle indisponible') : t('modalOrderButton')}
      </button>
    </div>
  `;

  if (!isUnavailable) {
    content.querySelector('.modal-add-cart-btn').addEventListener('click', () => {
      if (addProductToCart(product)) {
        productModal.classList.remove('active');
      }
    });
  }

  productModal.classList.add('active');
}

function updateDeliveryLabels() {
  const shippingRates = Store.getShippingRates();
  const label = shippingPricesAreVisible(shippingRates) ? t('chooseWilaya') : t('shippingPriceContact');
  document.getElementById('home-delivery-rate').textContent = label;
  document.getElementById('desk-delivery-rate').textContent = label;
}

function updatePricingSummary() {
  const cart = Store.getCart();
  const productsSubtotal = Store.getCartTotal();
  const isHidePrices = !!Store.getConfig()?.hideAllPrices;

  const wilayaCode = parseInt(wilayaSelect.value, 10);
  const shippingRates = Store.getShippingRates();
  const showShippingPrices = shippingPricesAreVisible(shippingRates);
  const wilayaRate = shippingRates[wilayaCode] || (wilayaCode ? (WILAYAS.find(w => w.code === wilayaCode) || {}) : null);

  let shippingFee = 0;
  if (wilayaRate) {
    const homePrice = shippingRateAmount(wilayaRate, 'homePrice');
    const deskPrice = shippingRateAmount(wilayaRate, 'deskPrice');
    shippingFee = showShippingPrices ? (deliveryType === 'home' ? homePrice : deskPrice) : 0;
    document.getElementById('home-delivery-rate').textContent = showShippingPrices
      ? formatDzd(homePrice, true)
      : t('shippingPriceContact');
    document.getElementById('desk-delivery-rate').textContent = showShippingPrices
      ? formatDzd(deskPrice, true)
      : t('shippingPriceContact');
  } else {
    updateDeliveryLabels();
  }

  const grandTotal = productsSubtotal + shippingFee;

  const seriesCount = Store.getCartCount();
  const pairsCount = cart.reduce((sum, item) => sum + (item.seriesQty * item.pairsPerSeries), 0);

  document.getElementById('summary-series-qty').textContent = template('summaryQty', { series: seriesCount, pairs: pairsCount });
  document.getElementById('summary-product-price').textContent = isHidePrices
    ? t('shippingPriceContact')
    : formatDzd(productsSubtotal);

  document.getElementById('summary-shipping-fee').textContent = showShippingPrices
    ? formatDzd(wilayaRate ? shippingFee : 0, true)
    : t('shippingPriceContact');
  
  document.getElementById('summary-total-price').textContent = isHidePrices || !showShippingPrices
    ? t('shippingPriceContact')
    : formatDzd(grandTotal);
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  const cart = Store.getCart();
  if (cart.length === 0) {
    alert(t('emptyCartText'));
    return;
  }

  const customerName = document.getElementById('customer-name').value.trim();
  const phoneInput = document.getElementById('customer-phone');
  const phone = phoneInput.value.replace(/\D/g, '').slice(0, 10);
  phoneInput.value = phone;
  const wilayaCode = parseInt(wilayaSelect.value, 10);
  const commune = communeSelect.value;
  const rawAddress = document.getElementById('customer-address').value.trim();
  const address = deliveryType === 'home' ? rawAddress : (rawAddress || (currentLang === 'ar' ? 'الاستلام من مقر مكتب التوصيل بالولاية' : 'Retrait au bureau de livraison'));

  if (!/^0[567]\d{8}$/.test(phone)) {
    phoneInput.setCustomValidity(t('invalidPhone'));
    phoneInput.reportValidity();
    phoneInput.setCustomValidity('');
    return;
  }

  if (!wilayaCode || !commune) {
    alert(t('invalidLocation'));
    return;
  }

  const shippingRates = Store.getShippingRates();
  const showShippingPrices = shippingPricesAreVisible(shippingRates);
  const wilayaData = WILAYAS.find(w => w.code === wilayaCode);
  const wilayaRate = shippingRates[wilayaCode] || wilayaData;

  const shippingFee = showShippingPrices
    ? shippingRateAmount(wilayaRate, deliveryType === 'home' ? 'homePrice' : 'deskPrice')
    : 0;
  const productPriceTotal = Store.getCartTotal();
  const grandTotal = productPriceTotal + shippingFee;
  const orderCreatedAt = new Date();
  const orderRandomPart = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase()
    : Math.random().toString(36).slice(2, 9).toUpperCase();
  const orderRef = `JOU-${orderCreatedAt.getTime().toString(36).toUpperCase()}-${orderRandomPart}`;

  const deliveryLabel = t(deliveryType === 'home' ? 'homeDeliveryShort' : 'deskDeliveryShort');
  const wilayaName = currentLang === 'ar' ? wilayaData.nameAr : wilayaData.nameFr;

  const formattedItems = cart.map(item => ({
    productId: item.productId,
    nameAr: item.nameAr,
    nameFr: item.nameFr,
    image: item.image,
    color: item.color,
    seriesQty: item.seriesQty,
    seriesPrice: Number(item.seriesPrice) || 0,
    pairsPerSeries: Number(item.pairsPerSeries) || 18,
    pairsCount: item.seriesQty * (Number(item.pairsPerSeries) || 18),
    price: item.totalPrice
  }));

  const firstItem = cart[0];
  const summaryProductName = cart.length === 1 ? firstItem.nameAr : `طلب سلة موحد (${cart.length} موديلات)`;
  const totalSeriesCount = Store.getCartCount();
  const trackingCode = createTrackingCode();

  const newOrder = {
    id: orderRef,
    trackingCode,
    timestamp: orderCreatedAt.toLocaleString(currentLang === 'ar' ? 'ar-DZ' : 'fr-DZ'),
    createdAt: orderCreatedAt.toISOString(),
    updatedAt: orderCreatedAt.toISOString(),
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
    pricesHidden: !!Store.getConfig()?.hideAllPrices,
    deliveryPriceHidden: !showShippingPrices,
    attribution: marketingAttributionSnapshot(),
    status: "New",
    history: [{ action: 'status_changed', status: 'New', at: orderCreatedAt.toISOString(), by: 'storefront' }]
  };

  const orderSynced = await Store.addOrder(newOrder);
  if (!orderSynced) {
    showToast(currentLang === 'ar'
      ? 'تم حفظ الطلب على جهازك وسيُرسل تلقائياً عند عودة الاتصال.'
      : 'Commande sauvegardee et en attente de synchronisation.', 'warning');
  }
  Store.clearCart();
  updateAdminBadgeCount();

  if (window.JoulaneAnalytics) {
    const contentIds = formattedItems.map(item => item.productId).filter(Boolean);
    const eventParams = {
      content_ids: contentIds,
      content_name: summaryProductName,
      content_type: 'product',
      contents: formattedItems.map(item => ({
        id: item.productId,
        quantity: Number(item.seriesQty) || 1,
        item_price: Number(item.seriesPrice) > 0 ? Number(item.seriesPrice) : undefined
      })),
      item_count: contentIds.length,
      num_items: totalSeriesCount,
      language: currentLang,
      status: orderSynced ? 'synced' : 'queued'
    };
    if (!newOrder.pricesHidden && productPriceTotal > 0) {
      eventParams.value = productPriceTotal;
      eventParams.currency = 'DZD';
    }
    window.JoulaneAnalytics.track('Lead', eventParams, {
      eventID: `lead-${newOrder.id}`
    });
    window.JoulaneAnalytics.trackCustom('WholesaleOrderSubmitted', eventParams, {
      eventID: `wholesale-${newOrder.id}`
    });
  }

  closeCheckoutModal();
  checkoutForm.reset();
  const notificationTask = orderSynced
    ? notifyOrderServer(newOrder.id)
    : Promise.resolve({ status: 'queued' });
  showSuccessModal(newOrder, wilayaName, formattedItems, notificationTask);
}

function showSuccessModal(order, wilayaName, items, notificationTask) {
  lastSuccessfulOrder = order;
  const isHidePrices = !!Store.getConfig()?.hideAllPrices;
  const isDeliveryPriceHidden = order.deliveryPriceHidden === true;
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
  const orderTrackingLink = trackingLink(order.trackingCode);
  const trackingCodeNode = document.getElementById('success-tracking-code');
  const trackingLinkNode = document.getElementById('success-tracking-link');
  if (trackingCodeNode) trackingCodeNode.textContent = order.trackingCode;
  if (trackingLinkNode) trackingLinkNode.value = orderTrackingLink;

  const itemsHtml = items.map(item => `
    <div style="padding: 6px 0; border-bottom: 1px dashed var(--line);">
      📌 <strong>${item.nameAr}</strong> - <span>${cartonQuantityLabel(item.seriesQty)}</span> ${!isHidePrices ? `= <strong>${formatDzd(item.price)}</strong>` : ''}
    </div>
  `).join('');

  const totalHtml = isHidePrices || isDeliveryPriceHidden
    ? t('shippingPriceContact')
    : formatDzd(order.totalAmount);
  const deliveryPriceHtml = isDeliveryPriceHidden
    ? t('shippingPriceContact')
    : formatDzd(order.shippingFee, true);

  document.getElementById('success-summary-box').innerHTML = `
    <div class="summary-field"><span>${fields.customer}</span><strong>${order.customerName}</strong></div>
    <div class="summary-field"><span>${fields.phone}</span><strong>${order.phone}</strong></div>
    <div class="summary-field"><span>${fields.location}</span><strong>${wilayaName} - ${order.commune}</strong></div>
    <div class="summary-field"><span>${fields.address}</span><strong>${order.address}</strong></div>
    <div class="summary-field"><span>${fields.delivery}</span><strong>${order.deliveryLabel} — ${deliveryPriceHtml}</strong></div>
    <div style="margin-top: 10px;">
      <span style="font-weight: 800;">المنتجات المطلوبة بالطلب:</span>
      <div style="margin-top: 6px;">${itemsHtml}</div>
    </div>
    <div class="summary-field total" style="margin-top: 12px;"><span>${fields.total}</span><strong>${totalHtml}</strong></div>
  `;

  const cleanWa = (config.whatsapp || '213660125123').replace(/\D/g, '');
  
  const itemsTextList = items.map((item, i) => `${i + 1}. *${item.nameAr}* - ${cartonQuantityLabel(item.seriesQty)} ${!isHidePrices ? `(${formatDzd(item.price)})` : ''}`).join('\n');

  const messageLines = [
    `*${t('whatsappMessage')}*`,
    `--------------------------`,
    `📌 *المرجع:* #${order.id}`,
    `📍 *تتبع الطلب:* ${orderTrackingLink}`,
    `👤 *الزبون:* ${order.customerName}`,
    `📞 *الهاتف:* ${order.phone}`,
    `📍 *المكان:* ${wilayaName} - ${order.commune}`,
    `🏠 *العنوان:* ${order.address}`,
    `🚚 *التوصيل عبر كازيتور:* ${order.deliveryLabel} — ${deliveryPriceHtml}`,
    `--------------------------`,
    `👠 *المنتجات المطلوبة (${items.length}):*`,
    itemsTextList,
    `--------------------------`,
    isHidePrices || isDeliveryPriceHidden
      ? `💰 *المجموع:* يتم تحديد السعر عند التواصل`
      : `💰 *المجموع النهائي عند الاستلام:* ${formatDzd(order.totalAmount)}`
  ];

  const waBtn = document.getElementById('whatsapp-order-btn');
  waBtn.href = `https://wa.me/${cleanWa}?text=${encodeURIComponent(messageLines.join('\n'))}`;

  const shareButton = document.getElementById('share-order-pdf-btn');
  if (shareButton) shareButton.hidden = !canShareOrderReceipt();
  updateWhatsappNotificationState('sending');
  successModal.classList.add('active');

  Promise.resolve(notificationTask)
    .then(result => updateWhatsappNotificationState(result?.status || 'pending_setup'))
    .catch(() => updateWhatsappNotificationState(navigator.onLine ? 'pending_setup' : 'queued'));
}

async function notifyOrderServer(orderId) {
  try {
    const notificationUrl = Capacitor.isNativePlatform()
      ? 'https://www.joulanefashion.com/api/order-notification'
      : '/api/order-notification';
    const response = await fetch(notificationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { status: response.status === 503 ? 'pending_setup' : (navigator.onLine ? 'pending_setup' : 'queued') };
    }
    return payload;
  } catch (_) {
    return { status: navigator.onLine ? 'pending_setup' : 'queued' };
  }
}

function updateWhatsappNotificationState(status) {
  const element = document.getElementById('whatsapp-notification-status');
  if (!element) return;
  const normalized = ['sent', 'already_sent'].includes(status)
    ? 'sent'
    : status === 'queued' ? 'queued' : status === 'sending' || status === 'processing' ? 'sending' : 'pending_setup';
  const icon = normalized === 'sent'
    ? 'fa-circle-check'
    : normalized === 'sending' ? 'fa-spinner fa-spin' : normalized === 'queued' ? 'fa-clock' : 'fa-triangle-exclamation';
  const translationKey = normalized === 'sent'
    ? 'whatsappSent'
    : normalized === 'sending' ? 'whatsappSending' : normalized === 'queued' ? 'whatsappQueued' : 'whatsappPendingSetup';
  element.className = `whatsapp-notification-status is-${normalized}`;
  element.innerHTML = `<i class="fa-solid ${icon}"></i><span>${t(translationKey)}</span>`;
}

async function runReceiptAction(buttonId, action) {
  const button = document.getElementById(buttonId);
  if (!button || button.disabled) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  try {
    await action();
  } catch (error) {
    if (error?.name !== 'AbortError') {
      showToast(currentLang === 'ar' ? 'تعذر إنشاء الفاتورة. حاول مرة أخرى.' : 'Impossible de creer la facture.', 'error');
    }
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
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

// PWA Install Prompt Logic (Stored for #stock panel)
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
});
