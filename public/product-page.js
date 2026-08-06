(function (window, document) {
  "use strict";

  var productNode = document.getElementById("joulane-product-data");
  if (!productNode) return;

  var product;
  try {
    product = JSON.parse(productNode.textContent || "{}");
  } catch (error) {
    return;
  }

  var language = document.body?.dataset.language === "fr" ? "fr" : "ar";
  var copy = language === "fr"
    ? {
        available: "Disponible à la commande en gros",
        unavailable: "Indisponible actuellement",
        pairs: "paires",
        priceOnRequest: "Prix sur demande",
        currency: "DZD",
        image: "Photo du produit",
        whatsappMessage: "Bonjour Joulane Fashion, je suis revendeur et je souhaite les détails de ce modèle :"
      }
    : {
        available: "متاح للطلب بالجملة",
        unavailable: "غير متوفر حاليًا",
        pairs: "زوجًا",
        priceOnRequest: "السعر عند التواصل",
        currency: "دج",
        image: "صورة المنتج",
        whatsappMessage: "مرحبًا جولان فاشن، أنا تاجر جملة وأريد تفاصيل هذا الموديل:"
      };

  function unique(values) {
    return values.filter(function (value, index, list) {
      return value && list.indexOf(value) === index;
    });
  }

  function normalizeImage(image) {
    var value = String(image || "").trim();
    if (!value) return "";
    try {
      var url = new URL(value, window.location.origin);
      if (url.origin === "https://www.joulanefashion.com") {
        return url.pathname + url.search;
      }
      return url.href;
    } catch (error) {
      return value;
    }
  }

  function formatPrice(value) {
    var number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return copy.priceOnRequest;
    return new Intl.NumberFormat(language === "fr" ? "fr-DZ" : "ar-DZ", {
      maximumFractionDigits: 0
    }).format(number) + " " + copy.currency;
  }

  function analyticsParams(currentProduct) {
    var price = Number(currentProduct.price);
    var params = {
      content_ids: [String(currentProduct.id || "")],
      content_name: String(currentProduct.reference || "") + " — " + String(currentProduct.title?.[language] || ""),
      content_type: "product",
      content_category: String(currentProduct.category || ""),
      product_id: String(currentProduct.id || ""),
      product_reference: String(currentProduct.reference || ""),
      availability: currentProduct.isAvailable === false ? "out_of_stock" : "available_for_order",
      language: language
    };
    if (Number.isFinite(price) && price > 0) {
      params.value = price;
      params.currency = "DZD";
    }
    return params;
  }

  function trackViewContent() {
    if (window.JoulaneAnalytics) {
      window.JoulaneAnalytics.track("ViewContent", analyticsParams(product));
    }
  }

  function updateAvailability() {
    var available = product.isAvailable !== false;
    document.body.classList.toggle("is-unavailable", !available);
    document.querySelectorAll("[data-live-availability]").forEach(function (element) {
      element.textContent = available ? copy.available : copy.unavailable;
      element.classList.toggle("pp-badge--available", available);
      element.classList.toggle("pp-badge--unavailable", !available);
    });
  }

  function updateSpecs() {
    var pairs = Number(product.pairsPerSeries);
    var sizes = unique((Array.isArray(product.sizes) ? product.sizes : [])
      .map(Number)
      .filter(Number.isFinite))
      .sort(function (a, b) { return a - b; });

    document.querySelectorAll("[data-product-pairs]").forEach(function (element) {
      element.textContent = pairs > 0 ? pairs + " " + copy.pairs : "—";
    });
    document.querySelectorAll("[data-product-sizes]").forEach(function (element) {
      element.textContent = sizes.length ? sizes.join(" · ") : "—";
    });

    var sizeList = document.querySelector("[data-product-size-list]");
    if (sizeList) {
      sizeList.replaceChildren();
      (sizes.length ? sizes : ["—"]).forEach(function (size) {
        var item = document.createElement("span");
        item.className = "pp-size";
        item.textContent = String(size);
        sizeList.appendChild(item);
      });
    }
  }

  function updatePrice(config) {
    var showPrice = config?.hideAllPrices !== true && config?.hideAllPrices !== "true";
    var price = Number(product.price);
    document.querySelectorAll("[data-product-price]").forEach(function (element) {
      element.textContent = showPrice && price > 0 ? formatPrice(price) : copy.priceOnRequest;
    });
  }

  function buildWhatsappUrl(number) {
    var cleanNumber = String(number || "213660125123").replace(/\D/g, "") || "213660125123";
    var message = [
      copy.whatsappMessage,
      (language === "fr" ? "Référence" : "الريفيرانس") + ": " + product.reference,
      window.location.href
    ].join("\n");
    return "https://wa.me/" + cleanNumber + "?text=" + encodeURIComponent(message);
  }

  function updateWhatsapp(config) {
    var number = config?.whatsappRaw || config?.whatsapp || "213660125123";
    var url = buildWhatsappUrl(number);
    document.querySelectorAll("[data-whatsapp-link]").forEach(function (link) {
      link.href = url;
      link.dataset.metaProductId = String(product.id || "");
      link.dataset.metaProductReference = String(product.reference || "");
      link.dataset.metaProductCategory = String(product.category || "");
      link.dataset.metaLanguage = language;
    });
  }

  function updateOrderAttribution() {
    var sourceParams = new URLSearchParams(window.location.search);
    var allowed = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];

    document.querySelectorAll("[data-order-link]").forEach(function (link) {
      var target = new URL(link.href, window.location.origin);
      allowed.forEach(function (key) {
        if (sourceParams.has(key)) target.searchParams.set(key, sourceParams.get(key));
      });
      link.href = target.pathname + target.search + target.hash;
    });
  }

  function getCartCount() {
    try {
      var cart = JSON.parse(window.localStorage.getItem("joulane_cart") || "[]");
      if (!Array.isArray(cart)) return 0;
      return cart.reduce(function (total, item) {
        return total + Math.max(0, Number(item?.seriesQty) || 0);
      }, 0);
    } catch (error) {
      return 0;
    }
  }

  function updateFloatingCart() {
    var link = document.querySelector("[data-floating-cart]");
    if (!link) return;

    var badge = link.querySelector("[data-floating-cart-count]");
    var count = getCartCount();
    var previousValue = link.dataset.currentCount;
    var previousCount = Number(previousValue || 0);
    var label = count > 0
      ? String(link.dataset.cartCountLabel || "").replace(/\{count\}/g, String(count))
      : String(link.dataset.cartEmptyLabel || link.getAttribute("aria-label") || "");

    link.dataset.currentCount = String(count);
    link.classList.toggle("has-items", count > 0);
    link.setAttribute("aria-label", label);

    if (badge) {
      badge.hidden = count <= 0;
      badge.textContent = count > 99 ? "99+" : String(count);
    }

    if (previousValue !== undefined && count > previousCount) {
      link.classList.remove("is-pulsing");
      void link.offsetWidth;
      link.classList.add("is-pulsing");
      window.setTimeout(function () {
        link.classList.remove("is-pulsing");
      }, 620);
    }
  }

  function renderGallery() {
    var images = unique([
      ...(Array.isArray(product.images) ? product.images : []),
      product.image
    ].map(normalizeImage));
    if (!images.length) return;

    var mainImage = document.querySelector("[data-main-product-image]");
    var counter = document.querySelector("[data-image-counter]");
    var gallery = document.querySelector(".pp-gallery");
    var thumbnails = document.querySelector(".pp-thumbnails");

    function selectImage(index) {
      if (!mainImage || !images[index]) return;
      mainImage.src = images[index];
      mainImage.alt = String(product.reference || "") + " — " + String(product.title?.[language] || copy.image);
      if (counter) counter.textContent = (index + 1) + " / " + images.length;
      document.querySelectorAll("[data-gallery-index]").forEach(function (button) {
        var active = Number(button.dataset.galleryIndex) === index;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-current", active ? "true" : "false");
      });
    }

    if (images.length > 1 && gallery) {
      if (!thumbnails) {
        thumbnails = document.createElement("div");
        thumbnails.className = "pp-thumbnails";
        gallery.appendChild(thumbnails);
      }
      thumbnails.replaceChildren();
      images.forEach(function (image, index) {
        var button = document.createElement("button");
        var thumb = document.createElement("img");
        button.type = "button";
        button.className = "pp-thumb" + (index === 0 ? " is-active" : "");
        button.dataset.galleryImage = image;
        button.dataset.galleryIndex = String(index);
        button.setAttribute("aria-current", index === 0 ? "true" : "false");
        button.setAttribute("aria-label", copy.image + " " + (index + 1));
        thumb.src = image;
        thumb.alt = "";
        thumb.loading = index === 0 ? "eager" : "lazy";
        thumb.decoding = "async";
        button.appendChild(thumb);
        button.addEventListener("click", function () { selectImage(index); });
        thumbnails.appendChild(button);
      });
    }

    selectImage(0);
  }

  function mergeLiveProduct(liveProduct) {
    if (!liveProduct || liveProduct.id !== product.id) return;
    var currentPairs = Number(product.pairsPerSeries) > 0 ? Number(product.pairsPerSeries) : 18;
    var requestedPairs = Number(liveProduct.pairsPerSeries) > 0 ? Math.floor(Number(liveProduct.pairsPerSeries)) : currentPairs;
    var pairsPerSeries = liveProduct.pairsPerSeriesConfigured === true
      ? requestedPairs
      : requestedPairs === 15 ? currentPairs : requestedPairs;
    var unitPrice = Number(liveProduct.price) > 0 ? Number(liveProduct.price) : (Number(product.price) || 3200);
    var rawCartonPrice = Number(liveProduct.seriesPrice) > 0 ? Number(liveProduct.seriesPrice) : 0;
    var legacyCartonPrice = liveProduct.pairsPerSeriesConfigured !== true
      && requestedPairs === 15
      && Math.abs(rawCartonPrice - (unitPrice * requestedPairs)) < 0.01;
    var cartonPrice = rawCartonPrice && !legacyCartonPrice
      ? rawCartonPrice
      : (Number(product.seriesPrice) || unitPrice * pairsPerSeries);
    product = {
      ...product,
      ...liveProduct,
      price: unitPrice,
      seriesPrice: cartonPrice,
      pairsPerSeries: pairsPerSeries,
      title: product.title,
      page: product.page
    };
    updateAvailability();
    updateSpecs();
    renderGallery();
  }

  async function fetchLiveStoreData() {
    var urlMeta = document.querySelector('meta[name="supabase-url"]');
    var keyMeta = document.querySelector('meta[name="supabase-publishable-key"]');
    var baseUrl = String(urlMeta?.content || "").replace(/\/+$/, "");
    var publishableKey = String(keyMeta?.content || "").trim();
    if (!baseUrl || !publishableKey) return;

    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 7000);
    try {
      var endpoint = baseUrl + "/rest/v1/joulane_store?select=id,data&id=in.(products,config,shipping)";
      var response = await fetch(endpoint, {
        headers: { apikey: publishableKey },
        signal: controller.signal
      });
      if (!response.ok) return;
      var rows = await response.json();
      var productsRow = rows.find(function (row) { return row.id === "products"; });
      var configRow = rows.find(function (row) { return row.id === "config"; });
      var shippingRow = rows.find(function (row) { return row.id === "shipping"; });
      var liveProduct = Array.isArray(productsRow?.data)
        ? productsRow.data.find(function (item) { return item.id === product.id; })
        : null;
      mergeLiveProduct(liveProduct);
      updatePrice(configRow?.data || {});
      updateWhatsapp(configRow?.data || {});
      window.JoulaneProductLiveState = {
        product: product,
        config: configRow?.data || {},
        shipping: shippingRow?.data || {}
      };
      window.dispatchEvent(new CustomEvent("joulane:productLiveData", {
        detail: window.JoulaneProductLiveState
      }));
    } catch (error) {
      // The statically rendered page remains fully usable when live sync is unavailable.
    } finally {
      window.clearTimeout(timer);
    }
  }

  function initialize() {
    window.JoulaneProductLiveState = { product: product, config: {}, shipping: {} };
    updateAvailability();
    updateSpecs();
    updatePrice({});
    updateWhatsapp({});
    updateOrderAttribution();
    updateFloatingCart();
    renderGallery();
    trackViewContent();
    fetchLiveStoreData().then(function () {
      // Refresh ViewContent only affects future interactions; avoid a duplicate event.
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  window.addEventListener("storage", function (event) {
    if (event.key === "joulane_cart") updateFloatingCart();
  });
  window.addEventListener("joulane:cartUpdated", updateFloatingCart);
  window.addEventListener("pageshow", updateFloatingCart);
})(window, document);
