const productDataNode = document.getElementById('joulane-product-data');
import { Capacitor } from '@capacitor/core';

const quickOrderForm = document.getElementById('quick-order-form');
const API_ORIGIN = Capacitor.isNativePlatform()
  ? 'https://www.joulanefashion.com'
  : '';

function apiUrl(path) {
  return `${API_ORIGIN}${path}`;
}

if (productDataNode && quickOrderForm) {
  const language = document.body?.dataset.language === 'fr' ? 'fr' : 'ar';
  const COPY = {
    ar: {
      pairs: 'زوجًا',
      currency: 'دج',
      priceOnRequest: 'يُحدد عند التأكيد',
      shippingPending: 'اختر الولاية',
      submitting: 'جارٍ تسجيل طلبك…',
      submit: 'تأكيد الطلب السريع',
      invalidPhone: 'أدخل رقمًا جزائريًا صحيحًا من 10 أرقام يبدأ بـ 05 أو 06 أو 07.',
      invalidLocation: 'اختر الولاية والبلدية.',
      invalidAddress: 'أدخل عنوان التوصيل بالتفصيل.',
      unavailable: 'هذا الموديل غير متوفر حاليًا.',
      genericError: 'تعذر تسجيل الطلب الآن. تحقق من الاتصال وحاول مجددًا.',
      queuedSuccess: 'تم تسجيل طلبك وسيتصل بك فريق جولان لتأكيده.',
      home: 'التوصيل إلى العنوان',
      desk: 'الاستلام من مكتب كازيتور',
      deskAddress: 'الاستلام من مكتب التوصيل في الولاية',
      assortedColors: 'ألوان الكرتون حسب الموديل',
      communePlaceholder: 'اختر البلدية'
    },
    fr: {
      pairs: 'paires',
      currency: 'DZD',
      priceOnRequest: 'Confirmé par téléphone',
      shippingPending: 'Choisir la wilaya',
      submitting: 'Enregistrement de la commande…',
      submit: 'Confirmer la commande rapide',
      invalidPhone: 'Saisissez un numéro algérien de 10 chiffres commençant par 05, 06 ou 07.',
      invalidLocation: 'Choisissez la wilaya et la commune.',
      invalidAddress: 'Saisissez l’adresse de livraison détaillée.',
      unavailable: 'Ce modèle est actuellement indisponible.',
      genericError: 'Impossible d’enregistrer la commande. Vérifiez la connexion et réessayez.',
      queuedSuccess: 'Commande enregistrée. L’équipe Joulane vous appellera pour la confirmer.',
      home: 'Livraison à l’adresse',
      desk: 'Retrait au bureau Kazitour',
      deskAddress: 'Retrait au bureau de livraison de la wilaya',
      assortedColors: 'Couleurs assorties selon le modèle',
      communePlaceholder: 'Choisir la commune'
    }
  };
  const copy = COPY[language];
  const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
  const attributionStorageKey = 'joulane_marketing_attribution';
  const nameInput = document.getElementById('qo-name');
  const phoneInput = document.getElementById('qo-phone');
  const wilayaSelect = document.getElementById('qo-wilaya');
  const communeSelect = document.getElementById('qo-commune');
  const addressInput = document.getElementById('qo-address');
  const quantityInput = document.getElementById('qo-quantity');
  const submitButton = quickOrderForm.querySelector('[data-quick-submit]');
  const statusNode = quickOrderForm.querySelector('[data-quick-status]');
  const successPanel = document.querySelector('[data-quick-success]');
  const successMessage = document.querySelector('[data-quick-success-message]');
  const orderReference = document.querySelector('[data-quick-order-reference]');
  const trackingCodeNode = document.querySelector('[data-quick-tracking-code]');
  const copyTrackingButton = document.querySelector('[data-quick-copy-tracking]');
  const addressRequiredMark = document.querySelector('[data-address-required]');
  let product = parseProduct(productDataNode.textContent);
  let config = {};
  let shippingRates = {};
  let wilayas = [];
  let submitting = false;
  let pendingRequestId = '';

  function parseProduct(value) {
    try {
      return typeof value === 'string' ? JSON.parse(value || '{}') : (value || {});
    } catch (_) {
      return {};
    }
  }

  function positiveNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function normalizeProduct(nextProduct) {
    const incoming = nextProduct && typeof nextProduct === 'object' ? nextProduct : {};
    const currentPairs = positiveNumber(product?.pairsPerSeries, 18);
    const requestedPairs = Math.floor(positiveNumber(incoming.pairsPerSeries, currentPairs));
    const pairsPerSeries = incoming.pairsPerSeriesConfigured === true
      ? requestedPairs
      : requestedPairs === 15 ? currentPairs : requestedPairs;
    const unitPrice = positiveNumber(incoming.price, positiveNumber(product?.price, 3200));
    const rawCartonPrice = positiveNumber(incoming.seriesPrice, 0);
    const legacyCartonPrice = incoming.pairsPerSeriesConfigured !== true
      && requestedPairs === 15
      && Math.abs(rawCartonPrice - (unitPrice * requestedPairs)) < 0.01;
    const cartonPrice = rawCartonPrice && !legacyCartonPrice
      ? rawCartonPrice
      : positiveNumber(product?.seriesPrice, unitPrice * pairsPerSeries);

    return {
      ...product,
      ...incoming,
      title: incoming.title || product?.title || incoming.name || {},
      image: incoming.image || product?.image || '',
      colors: incoming.colors || product?.colors || { ar: [], fr: [] },
      pairsPerSeries,
      price: unitPrice,
      seriesPrice: cartonPrice,
      isAvailable: incoming.isAvailable !== false
    };
  }

  function flag(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'on', 'yes', 'visible'].includes(normalized)) return true;
      if (['false', '0', 'off', 'no', 'hidden'].includes(normalized)) return false;
    }
    return fallback;
  }

  function formatMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return copy.priceOnRequest;
    return `${new Intl.NumberFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
      maximumFractionDigits: 0
    }).format(amount)} ${copy.currency}`;
  }

  function selectedDeliveryType() {
    return quickOrderForm.querySelector('input[name="deliveryType"]:checked')?.value === 'desk' ? 'desk' : 'home';
  }

  function selectedWilaya() {
    const code = Number(wilayaSelect?.value);
    return wilayas.find(item => Number(item.code) === code) || null;
  }

  function cartonQuantity() {
    const quantity = Math.floor(Number(quantityInput?.value));
    return Number.isFinite(quantity) ? Math.min(50, Math.max(1, quantity)) : 1;
  }

  function shippingAmount() {
    const wilaya = selectedWilaya();
    if (!wilaya) return 0;
    const rate = shippingRates?.[String(wilaya.code)] || shippingRates?.[wilaya.code] || wilaya;
    const field = selectedDeliveryType() === 'desk' ? 'deskPrice' : 'homePrice';
    const amount = Number(rate?.[field]);
    return Number.isFinite(amount) && amount >= 0 ? amount : 0;
  }

  function updateAddressRequirement() {
    const required = selectedDeliveryType() === 'home';
    if (addressInput) addressInput.required = required;
    if (addressRequiredMark) addressRequiredMark.hidden = !required;
  }

  function updateSummary() {
    const quantity = cartonQuantity();
    if (quantityInput) quantityInput.value = String(quantity);
    const pairsPerSeries = Math.max(1, Math.floor(positiveNumber(product?.pairsPerSeries, 18)));
    const cartonPrice = positiveNumber(product?.seriesPrice, positiveNumber(product?.price, 3200) * pairsPerSeries);
    const productsTotal = cartonPrice * quantity;
    const shippingVisible = flag(shippingRates?._showPrices, false);
    const pricesHidden = flag(config?.hideAllPrices, false);
    const hasWilaya = !!selectedWilaya();
    const shipping = shippingAmount();

    document.querySelectorAll('[data-quick-pairs-total]').forEach(node => {
      node.textContent = String(pairsPerSeries * quantity);
    });
    const subtotalNode = document.querySelector('[data-quick-subtotal]');
    const shippingNode = document.querySelector('[data-quick-shipping]');
    const totalNode = document.querySelector('[data-quick-total]');
    if (subtotalNode) subtotalNode.textContent = pricesHidden ? copy.priceOnRequest : formatMoney(productsTotal);
    if (shippingNode) {
      shippingNode.textContent = !hasWilaya
        ? copy.shippingPending
        : shippingVisible ? formatMoney(shipping) : copy.priceOnRequest;
    }
    if (totalNode) {
      totalNode.textContent = pricesHidden || !shippingVisible
        ? copy.priceOnRequest
        : formatMoney(productsTotal + shipping);
    }

    const unavailable = product?.isAvailable === false;
    if (submitButton) submitButton.disabled = unavailable || submitting;
    if (unavailable && statusNode) {
      statusNode.textContent = copy.unavailable;
      statusNode.className = 'pp-order-status is-error';
    }
  }

  function populateWilayas() {
    if (!wilayaSelect) return;
    const placeholder = wilayaSelect.options[0]?.textContent || '';
    wilayaSelect.replaceChildren(new Option(placeholder, ''));
    wilayas.forEach(wilaya => {
      const label = `${String(wilaya.code).padStart(2, '0')} — ${language === 'fr' ? wilaya.nameFr : wilaya.nameAr}`;
      wilayaSelect.appendChild(new Option(label, String(wilaya.code)));
    });
    wilayaSelect.disabled = false;
  }

  function populateCommunes() {
    if (!communeSelect) return;
    communeSelect.replaceChildren(new Option(copy.communePlaceholder, ''));
    const wilaya = selectedWilaya();
    const communes = language === 'fr' ? wilaya?.communesFr : wilaya?.communesAr;
    (Array.isArray(communes) ? communes : []).forEach(commune => {
      communeSelect.appendChild(new Option(String(commune), String(commune)));
    });
    communeSelect.disabled = !wilaya;
  }

  async function loadLocations() {
    if (wilayaSelect) wilayaSelect.disabled = true;
    try {
      const response = await fetch('/order-locations.json', { cache: 'force-cache' });
      if (!response.ok) throw new Error('location_data_unavailable');
      const payload = await response.json();
      wilayas = Array.isArray(payload?.wilayas) ? payload.wilayas : [];
      populateWilayas();
    } catch (_) {
      if (statusNode) {
        statusNode.textContent = copy.genericError;
        statusNode.className = 'pp-order-status is-error';
      }
    }
  }

  function captureAttribution() {
    const query = new URLSearchParams(window.location.search);
    const touch = {};
    attributionKeys.forEach(key => {
      const value = String(query.get(key) || '').trim();
      if (value) touch[key] = value.slice(0, 500);
    });
    try {
      const existing = JSON.parse(localStorage.getItem(attributionStorageKey) || '{}');
      if (Object.keys(touch).length) {
        const capturedAt = new Date().toISOString();
        const next = {
          firstTouch: existing.firstTouch || { ...touch, capturedAt },
          lastTouch: { ...touch, capturedAt }
        };
        localStorage.setItem(attributionStorageKey, JSON.stringify(next));
        return next;
      }
      return existing && typeof existing === 'object' ? existing : null;
    } catch (_) {
      return Object.keys(touch).length ? { lastTouch: touch } : null;
    }
  }

  function setSubmitting(active) {
    submitting = active;
    if (submitButton) {
      submitButton.disabled = active || product?.isAvailable === false;
      submitButton.innerHTML = active
        ? `<span class="pp-order-spinner" aria-hidden="true"></span>${copy.submitting}`
        : `<span aria-hidden="true">✓</span>${copy.submit}`;
    }
  }

  function setStatus(message, type = '') {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.className = `pp-order-status${type ? ` is-${type}` : ''}`;
  }

  function showSuccess(payload) {
    quickOrderForm.hidden = true;
    if (successPanel) {
      successPanel.hidden = false;
      if (orderReference) orderReference.textContent = payload.orderId || '—';
      if (trackingCodeNode) trackingCodeNode.textContent = payload.trackingCode || '—';
      if (copyTrackingButton) copyTrackingButton.dataset.trackingUrl = payload.trackingUrl || '';
      if (successMessage) successMessage.textContent = payload.message || copy.queuedSuccess;
      successPanel.focus({ preventScroll: true });
      successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function trackOrder(payload, quantity) {
    if (!window.JoulaneAnalytics) return;
    const params = {
      content_ids: [String(product.id || '')],
      content_name: String(product.reference || product.id || ''),
      content_type: 'product',
      contents: [{ id: String(product.id || ''), quantity }],
      num_items: quantity,
      order_id: payload.orderId,
      language,
      source: 'quick_order_product_page'
    };
    if (Number(payload.productTotal) > 0 && !flag(config?.hideAllPrices, false)) {
      params.value = Number(payload.productTotal);
      params.currency = 'DZD';
    }
    window.JoulaneAnalytics.track('Lead', params, { eventID: `lead-${payload.orderId}` });
    window.JoulaneAnalytics.trackCustom('WholesaleQuickOrderSubmitted', params, {
      eventID: `quick-order-${payload.orderId}`
    });
  }

  async function notifyStore(orderId) {
    try {
      await fetch(apiUrl('/api/order-notification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
        keepalive: true
      });
    } catch (_) {
      // The order is already stored; notification failures must not affect success.
    }
  }

  async function submitQuickOrder(event) {
    event.preventDefault();
    if (submitting || product?.isAvailable === false) return;
    phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
    if (!/^0[567]\d{8}$/.test(phoneInput.value)) {
      phoneInput.setCustomValidity(copy.invalidPhone);
      phoneInput.reportValidity();
      phoneInput.setCustomValidity('');
      setStatus(copy.invalidPhone, 'error');
      return;
    }
    if (!selectedWilaya() || !communeSelect.value) {
      setStatus(copy.invalidLocation, 'error');
      (selectedWilaya() ? communeSelect : wilayaSelect)?.focus();
      return;
    }
    updateAddressRequirement();
    if (addressInput.required && addressInput.value.trim().length < 4) {
      setStatus(copy.invalidAddress, 'error');
      addressInput.focus();
      return;
    }
    if (!quickOrderForm.reportValidity()) return;

    const quantity = cartonQuantity();
    if (!pendingRequestId) {
      pendingRequestId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 26000);
    setSubmitting(true);
    setStatus(copy.submitting);
    try {
      const response = await fetch(apiUrl('/api/quick-order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          requestId: pendingRequestId,
          customerName: nameInput.value.trim(),
          phone: phoneInput.value,
          wilayaCode: Number(wilayaSelect.value),
          commune: communeSelect.value,
          address: addressInput.value.trim(),
          deliveryType: selectedDeliveryType(),
          cartons: quantity,
          language,
          attribution: captureAttribution(),
          pageUrl: window.location.href,
          website: quickOrderForm.elements.website?.value || ''
        }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.status !== 'created') {
        throw new Error(payload.error || 'order_submission_failed');
      }
      showSuccess({ ...payload, message: copy.queuedSuccess });
      pendingRequestId = '';
      trackOrder(payload, quantity);
      void notifyStore(payload.orderId);
    } catch (_) {
      setStatus(copy.genericError, 'error');
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  }

  product = normalizeProduct(product);
  wilayaSelect?.addEventListener('change', () => {
    populateCommunes();
    updateSummary();
  });
  communeSelect?.addEventListener('change', updateSummary);
  quickOrderForm.querySelectorAll('input[name="deliveryType"]').forEach(input => {
    input.addEventListener('change', () => {
      updateAddressRequirement();
      updateSummary();
    });
  });
  phoneInput?.addEventListener('input', () => {
    phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
    phoneInput.setCustomValidity('');
  });
  quantityInput?.addEventListener('input', updateSummary);
  quickOrderForm.querySelector('[data-quantity-minus]')?.addEventListener('click', () => {
    quantityInput.value = String(Math.max(1, cartonQuantity() - 1));
    updateSummary();
  });
  quickOrderForm.querySelector('[data-quantity-plus]')?.addEventListener('click', () => {
    quantityInput.value = String(Math.min(50, cartonQuantity() + 1));
    updateSummary();
  });
  quickOrderForm.addEventListener('submit', submitQuickOrder);
  quickOrderForm.addEventListener('focusin', () => document.body.classList.add('pp-quick-order-focus'));
  quickOrderForm.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!quickOrderForm.contains(document.activeElement)) document.body.classList.remove('pp-quick-order-focus');
    }, 0);
  });
  const quickOrderSection = document.getElementById('quick-order');
  if ('IntersectionObserver' in window && quickOrderSection) {
    const sectionObserver = new IntersectionObserver(entries => {
      document.body.classList.toggle('pp-quick-order-visible', entries.some(entry => entry.isIntersecting));
    }, { threshold: 0.05 });
    sectionObserver.observe(quickOrderSection);
  }
  document.querySelector('[data-quick-new-order]')?.addEventListener('click', () => {
    pendingRequestId = '';
    successPanel.hidden = true;
    quickOrderForm.hidden = false;
    quickOrderForm.reset();
    populateCommunes();
    updateAddressRequirement();
    updateSummary();
    nameInput.focus({ preventScroll: true });
  });
  copyTrackingButton?.addEventListener('click', async () => {
    const trackingUrl = copyTrackingButton.dataset.trackingUrl || '';
    if (!trackingUrl) return;
    const originalText = copyTrackingButton.textContent;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      copyTrackingButton.textContent = language === 'fr' ? 'Lien copié ✓' : 'تم نسخ الرابط ✓';
    } catch (_) {
      window.prompt(language === 'fr' ? 'Copiez ce lien :' : 'انسخ هذا الرابط:', trackingUrl);
    }
    window.setTimeout(() => { copyTrackingButton.textContent = originalText; }, 2200);
  });

  window.addEventListener('joulane:productLiveData', event => {
    const detail = event.detail || {};
    if (detail.product) product = normalizeProduct(detail.product);
    config = detail.config || config;
    shippingRates = detail.shipping || shippingRates;
    updateSummary();
  });

  const initialLiveState = window.JoulaneProductLiveState;
  if (initialLiveState) {
    if (initialLiveState.product) product = normalizeProduct(initialLiveState.product);
    config = initialLiveState.config || {};
    shippingRates = initialLiveState.shipping || {};
  }
  captureAttribution();
  updateAddressRequirement();
  updateSummary();
  void loadLocations();
}
