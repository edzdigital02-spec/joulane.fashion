(function (window, document) {
  "use strict";

  var CONSENT_KEY = "joulane_marketing_consent";
  var CONSENT_GRANTED = "granted";
  var CONSENT_DENIED = "denied";
  var META_PIXEL_SRC = "https://connect.facebook.net/en_US/fbevents.js";
  var pageViewTracked = false;
  var pixelInitialized = false;
  var contactListenerAttached = false;
  var privacyListenerAttached = false;
  var sessionConsent = "";

  var STANDARD_EVENTS = {
    AddPaymentInfo: true,
    AddToCart: true,
    AddToWishlist: true,
    CompleteRegistration: true,
    Contact: true,
    CustomizeProduct: true,
    Donate: true,
    FindLocation: true,
    InitiateCheckout: true,
    Lead: true,
    PageView: true,
    Purchase: true,
    Schedule: true,
    Search: true,
    StartTrial: true,
    SubmitApplication: true,
    Subscribe: true,
    ViewContent: true,
  };

  var SAFE_PARAM_KEYS = {
    availability: true,
    category: true,
    content_category: true,
    content_ids: true,
    content_name: true,
    content_type: true,
    contents: true,
    currency: true,
    cta: true,
    item_count: true,
    language: true,
    num_items: true,
    price: true,
    product_id: true,
    product_reference: true,
    quantity: true,
    status: true,
    value: true,
  };

  var POSITIVE_NUMBER_KEYS = {
    item_count: true,
    num_items: true,
    price: true,
    quantity: true,
    value: true,
  };

  function getPixelId() {
    var meta = document.querySelector('meta[name="meta-pixel-id"]');
    var value = meta && typeof meta.content === "string" ? meta.content.trim() : "";

    return /^\d{5,30}$/.test(value) ? value : "";
  }

  function readConsent() {
    try {
      var value = window.localStorage.getItem(CONSENT_KEY);
      return value === CONSENT_GRANTED || value === CONSENT_DENIED
        ? value
        : sessionConsent;
    } catch (error) {
      return sessionConsent;
    }
  }

  function storeConsent(value) {
    sessionConsent = value;
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
      return true;
    } catch (error) {
      return true;
    }
  }

  function languageIsFrench() {
    var language = String(document.documentElement.lang || "").toLowerCase();
    return language.indexOf("fr") === 0;
  }

  function privacySignalEnabled() {
    var doNotTrack = String(
      window.navigator.doNotTrack || window.doNotTrack || ""
    ).toLowerCase();

    return (
      window.navigator.globalPrivacyControl === true ||
      doNotTrack === "1" ||
      doNotTrack === "yes"
    );
  }

  function trackingAllowed() {
    return readConsent() !== CONSENT_DENIED && !privacySignalEnabled();
  }

  function deleteCookie(name, domain) {
    var cookie =
      name +
      "=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";

    document.cookie = domain ? cookie + "; domain=" + domain : cookie;
  }

  function clearMetaCookies() {
    var hostname = String(window.location.hostname || "");
    var domains = hostname
      ? [hostname, "." + hostname, "." + hostname.split(".").slice(-2).join(".")]
      : [];

    ["_fbp", "_fbc"].forEach(function (name) {
      deleteCookie(name, "");
      domains.forEach(function (domain) {
        deleteCookie(name, domain);
      });
    });
  }

  function updateOptOutControls() {
    var disabled = !trackingAllowed();
    var french = languageIsFrench();
    var label = disabled
      ? french
        ? "Mesure désactivée"
        : "تم إيقاف القياس"
      : french
        ? "Désactiver la mesure"
        : "إيقاف القياس";

    document.querySelectorAll("[data-meta-opt-out]").forEach(function (control) {
      control.textContent = label;
      control.setAttribute("aria-pressed", disabled ? "true" : "false");
      control.disabled = disabled;
    });
  }

  function attachPrivacyControls() {
    if (privacyListenerAttached) {
      return;
    }

    document.addEventListener("click", function (event) {
      var control =
        event.target && typeof event.target.closest === "function"
          ? event.target.closest("[data-meta-opt-out]")
          : null;

      if (!control) {
        return;
      }

      event.preventDefault();
      setConsent(CONSENT_DENIED);
    });

    if (typeof window.MutationObserver === "function") {
      new window.MutationObserver(updateOptOutControls).observe(
        document.documentElement,
        { attributes: true, attributeFilter: ["lang"] }
      );
    }

    privacyListenerAttached = true;
    whenDocumentReady(updateOptOutControls);
  }

  function installMetaPixelQueue() {
    if (typeof window.fbq === "function") {
      return;
    }

    var fbq = function () {
      if (fbq.callMethod) {
        fbq.callMethod.apply(fbq, arguments);
      } else {
        fbq.queue.push(arguments);
      }
    };

    window.fbq = fbq;
    if (!window._fbq) {
      window._fbq = fbq;
    }
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
  }

  function loadMetaPixelScript() {
    if (document.querySelector('script[src="' + META_PIXEL_SRC + '"]')) {
      return;
    }

    var script = document.createElement("script");
    var firstScript = document.getElementsByTagName("script")[0];
    script.async = true;
    script.src = META_PIXEL_SRC;
    script.className = "jou-analytics-pixel-script";

    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      (document.head || document.documentElement).appendChild(script);
    }
  }

  function initializePixel() {
    var pixelId = getPixelId();

    if (!pixelId || !trackingAllowed()) {
      return false;
    }

    if (pixelInitialized) {
      if (typeof window.fbq === "function") {
        window.fbq("consent", "grant");
      }
      return true;
    }

    installMetaPixelQueue();
    loadMetaPixelScript();
    window.fbq("consent", "grant");
    window.fbq("set", "autoConfig", false, pixelId);
    window.fbq("init", pixelId);
    pixelInitialized = true;

    if (!pageViewTracked) {
      window.fbq("track", "PageView");
      pageViewTracked = true;
    }

    return true;
  }

  function safeToken(value, maximumLength) {
    var token = String(value == null ? "" : value).trim();

    if (
      !token ||
      token.length > maximumLength ||
      !/^[A-Za-z0-9._:/-]+$/.test(token)
    ) {
      return "";
    }

    return token;
  }

  function safeText(value, maximumLength) {
    var text = String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text || text.length > maximumLength || /@/.test(text)) {
      return "";
    }

    return text;
  }

  function positiveNumber(value) {
    var number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function sanitizeContentItems(value) {
    if (!Array.isArray(value)) {
      return undefined;
    }

    var items = value.slice(0, 100).reduce(function (result, item) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return result;
      }

      var id = safeToken(item.id, 100);
      if (!id) {
        return result;
      }

      var cleanItem = { id: id };
      var quantity = positiveNumber(item.quantity);
      var itemPrice = positiveNumber(item.item_price);

      if (quantity !== null) {
        cleanItem.quantity = quantity;
      }
      if (itemPrice !== null) {
        cleanItem.item_price = itemPrice;
      }

      result.push(cleanItem);
      return result;
    }, []);

    return items.length ? items : undefined;
  }

  function sanitizeParam(key, value) {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (key === "contents") {
      return sanitizeContentItems(value);
    }

    if (key === "content_ids") {
      if (!Array.isArray(value)) {
        value = [value];
      }

      var ids = value
        .slice(0, 100)
        .map(function (item) {
          return safeToken(item, 100);
        })
        .filter(Boolean);

      return ids.length ? ids : undefined;
    }

    if (key === "currency") {
      var currency = safeToken(value, 3).toUpperCase();
      return /^[A-Z]{3}$/.test(currency) ? currency : undefined;
    }

    if (POSITIVE_NUMBER_KEYS[key]) {
      var number = positiveNumber(value);
      return number === null ? undefined : number;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }

    return safeText(value, 160) || undefined;
  }

  function sanitizeParams(params) {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      return {};
    }

    var cleanParams = Object.keys(params).reduce(function (result, key) {
      if (!SAFE_PARAM_KEYS[key]) {
        return result;
      }

      var value = sanitizeParam(key, params[key]);
      if (value !== undefined) {
        result[key] = value;
      }
      return result;
    }, {});

    var contentsHavePrice =
      Array.isArray(cleanParams.contents) &&
      cleanParams.contents.some(function (item) {
        return typeof item.item_price === "number" && item.item_price > 0;
      });

    if (
      cleanParams.value === undefined &&
      cleanParams.price === undefined &&
      !contentsHavePrice
    ) {
      delete cleanParams.currency;
    }

    return cleanParams;
  }

  function sanitizeEventId(options) {
    if (!options || typeof options !== "object") {
      return "";
    }

    return safeToken(options.eventID || options.eventId, 100);
  }

  function dispatchEvent(command, eventName, cleanParams, eventId) {
    if (typeof window.fbq !== "function") {
      return false;
    }

    if (eventId) {
      window.fbq(command, eventName, cleanParams, { eventID: eventId });
    } else if (Object.keys(cleanParams).length) {
      window.fbq(command, eventName, cleanParams);
    } else {
      window.fbq(command, eventName);
    }

    return true;
  }

  function send(command, eventName, params, options) {
    if (!trackingAllowed()) {
      return false;
    }

    var cleanParams = sanitizeParams(params);
    var eventId = sanitizeEventId(options);

    if (!initializePixel()) {
      return false;
    }

    return dispatchEvent(command, eventName, cleanParams, eventId);
  }

  function track(eventName, params, options) {
    var name = String(eventName || "").trim();

    if (name === "PageView") {
      return trackingAllowed() && initializePixel();
    }

    return STANDARD_EVENTS[name]
      ? send("track", name, params, options)
      : false;
  }

  function trackCustom(eventName, params, options) {
    var name = String(eventName || "").trim();
    return /^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(name)
      ? send("trackCustom", name, params, options)
      : false;
  }

  function setConsent(value) {
    var normalized =
      value === true || value === CONSENT_GRANTED
        ? CONSENT_GRANTED
        : value === false || value === CONSENT_DENIED
          ? CONSENT_DENIED
          : "";

    if (!normalized || !storeConsent(normalized)) {
      return false;
    }

    if (normalized === CONSENT_GRANTED) {
      initializePixel();
    } else if (typeof window.fbq === "function") {
      window.fbq("consent", "revoke");
    }

    if (normalized === CONSENT_DENIED) {
      clearMetaCookies();
    }
    updateOptOutControls();
    return true;
  }

  function resetConsent() {
    sessionConsent = "";
    try {
      window.localStorage.removeItem(CONSENT_KEY);
    } catch (error) {
      // The in-memory preference is still reset for this page.
    }

    if (trackingAllowed()) {
      initializePixel();
    } else if (typeof window.fbq === "function") {
      window.fbq("consent", "revoke");
    }
    updateOptOutControls();
    return true;
  }

  function attachContactTracking() {
    if (contactListenerAttached) {
      return;
    }

    document.addEventListener("click", function (event) {
      var target =
        event.target && typeof event.target.closest === "function"
          ? event.target.closest('[data-meta-contact],a[href*="wa.me"]')
          : null;

      if (target) {
        var productId = target.dataset.metaProductId || "";
        var productReference = target.dataset.metaProductReference || "";
        var params = {
          cta: "whatsapp",
          language: target.dataset.metaLanguage || document.documentElement.lang || "",
        };

        if (productId) {
          params.content_ids = [productId];
          params.product_id = productId;
          params.content_type = "product";
        }
        if (productReference) {
          params.product_reference = productReference;
        }
        if (target.dataset.metaProductCategory) {
          params.content_category = target.dataset.metaProductCategory;
        }

        track("Contact", params);
      }
    });
    contactListenerAttached = true;
  }

  function whenDocumentReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  window.JoulaneAnalytics = Object.freeze({
    track: track,
    trackCustom: trackCustom,
    setConsent: setConsent,
    resetConsent: resetConsent,
    isEnabled: trackingAllowed,
  });

  attachContactTracking();
  attachPrivacyControls();

  if (getPixelId() && trackingAllowed()) {
    initializePixel();
  }
})(window, document);
