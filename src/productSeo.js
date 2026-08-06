import { getProductPageTitle } from "./data/productPageTitles.js";

export const SITE_ORIGIN = "https://www.joulanefashion.com";
export const META_PIXEL_ID = "1771872164232706";
export const SUPPORTED_PRODUCT_LANGUAGES = Object.freeze(["ar", "fr"]);

const CATEGORY_LABELS = Object.freeze({
  sabot: { ar: "صابو نسائي", fr: "Sabots femme" },
  shoes: { ar: "أحذية نسائية", fr: "Chaussures femme" },
  sandals: { ar: "صنادل وأحذية سهرة", fr: "Sandales et escarpins de soirée" },
  claquette: { ar: "كلاكيت نسائية", fr: "Claquettes femme" }
});

function text(value) {
  return String(value ?? "").trim();
}

function safeLanguage(lang) {
  return lang === "fr" ? "fr" : "ar";
}

export function productReference(product) {
  return text(product?.reference || product?.id);
}

export function productRouteToken(product) {
  const reference = productReference(product)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "modele";
  const identity = text(product?.id)
    .replace(/^joulane-/, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "produit";

  return `${reference}-${identity}`;
}

export function productPagePath(product, lang = "ar") {
  return `/${safeLanguage(lang)}/produits/${productRouteToken(product)}/`;
}

export function productPageUrl(product, lang = "ar") {
  return `${SITE_ORIGIN}${productPagePath(product, lang)}`;
}

export function productImageUrl(product) {
  const raw = text(product?.image || product?.images?.[0] || "https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/azsvctjhsfzzhmr4xeev.jpg");
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${SITE_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

export function categoryLabel(category, lang = "ar") {
  const language = safeLanguage(lang);
  return CATEGORY_LABELS[category]?.[language]
    || (language === "fr" ? "Chaussures femme" : "أحذية نسائية");
}

export function localizedProductTitle(product, lang = "ar") {
  return getProductPageTitle(product, safeLanguage(lang));
}

export function productHeading(product, lang = "ar") {
  const language = safeLanguage(lang);
  const reference = productReference(product);
  const title = localizedProductTitle(product, language);
  return language === "fr"
    ? `${reference} — ${title}`
    : `${reference} — ${title}`;
}

export function productSeoTitle(product, lang = "ar") {
  const language = safeLanguage(lang);
  const heading = productHeading(product, language);
  return language === "fr"
    ? `${heading} | Joulane Fashion Grossiste`
    : `${heading} | جولان فاشن للجملة`;
}

export function productSeoDescription(product, lang = "ar") {
  const language = safeLanguage(lang);
  const reference = productReference(product);
  const title = localizedProductTitle(product, language);
  const pairs = Number(product?.pairsPerSeries) || 0;
  const sizes = Array.isArray(product?.sizes) && product.sizes.length
    ? `${Math.min(...product.sizes)}–${Math.max(...product.sizes)}`
    : "";

  if (language === "fr") {
    return [
      `${title}, référence ${reference}, disponible en commande de gros chez Joulane Fashion.`,
      pairs ? `Carton de ${pairs} paires.` : "",
      sizes ? `Pointures ${sizes}.` : "",
      "Pour boutiques et revendeurs, avec livraison dans toutes les wilayas."
    ].filter(Boolean).join(" ");
  }

  return [
    `${title}، ريفيرانس ${reference}، متاح للطلب بالجملة من جولان فاشن.`,
    pairs ? `الكرتون يحتوي ${pairs} زوجًا.` : "",
    sizes ? `المقاسات ${sizes}.` : "",
    "مخصص للمحلات وتجار الجملة مع توصيل لجميع الولايات."
  ].filter(Boolean).join(" ");
}

export function productUnitPrice(product) {
  const directPrice = Number(product?.price);
  if (Number.isFinite(directPrice) && directPrice > 0) return directPrice;

  const cartonPrice = Number(product?.seriesPrice);
  const pairs = Number(product?.pairsPerSeries);
  if (Number.isFinite(cartonPrice) && cartonPrice > 0 && Number.isFinite(pairs) && pairs > 0) {
    return cartonPrice / pairs;
  }

  return 0;
}

export function metaProductParams(product, lang = "ar", extra = {}) {
  const language = safeLanguage(lang);
  const price = productUnitPrice(product);
  const params = {
    content_ids: [text(product?.id)],
    content_name: productHeading(product, language),
    content_type: "product",
    content_category: categoryLabel(product?.category, language),
    product_id: text(product?.id),
    product_reference: productReference(product),
    availability: product?.isAvailable === false ? "out_of_stock" : "available_for_order",
    language,
    ...extra
  };

  if (Number.isFinite(price) && price > 0) {
    if (!(Number(params.value) > 0)) params.value = price;
    if (!params.currency) params.currency = "DZD";
  }

  return params;
}
