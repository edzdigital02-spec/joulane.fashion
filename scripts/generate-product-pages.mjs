import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTS } from "../src/data/products.js";
import { WILAYAS } from "../src/data/wilayas.js";
import {
  META_PIXEL_ID,
  SITE_ORIGIN,
  categoryLabel,
  localizedProductTitle,
  productHeading,
  productImageUrl,
  productPagePath,
  productPageUrl,
  productReference,
  productUnitPrice,
  productSeoDescription,
  productSeoTitle
} from "../src/productSeo.js";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(rootDir, "dist");
const buildDate = new Date().toISOString().slice(0, 10);
const supabaseUrl = "https://jsnsmqwznljllqmnzfrx.supabase.co";
const supabasePublishableKey = "sb_publishable_kkXNEOz2KfLvbcpCXYR0uw_9eHV4G5h";
const viteManifest = JSON.parse(await readFile(resolve(distDir, ".vite", "manifest.json"), "utf8"));
const androidUpdaterAsset = viteManifest["src/androidUpdater.js"]?.file;
if (!androidUpdaterAsset) throw new Error("Android updater entry is missing from the Vite manifest.");
const productQuickOrderAsset = viteManifest["src/productQuickOrder.js"]?.file;
if (!productQuickOrderAsset) throw new Error("Product quick-order entry is missing from the Vite manifest.");

const COPY = Object.freeze({
  ar: {
    locale: "ar_DZ",
    alternateLocale: "fr_DZ",
    dir: "rtl",
    brandSub: "أحذية نسائية بالجملة",
    skip: "انتقل إلى معلومات المنتج",
    back: "العودة للكتالوج",
    language: "Français",
    home: "الرئيسية",
    catalog: "الكتالوج",
    reference: "الريفيرانس",
    available: "متاح للطلب بالجملة",
    unavailable: "غير متوفر حاليًا",
    wholesaleOnly: "مخصص للتجار والمحلات",
    introTitle: "موديل جاهز لطلب الجملة",
    introText: "أرسل الريفيرانس مباشرة وسنؤكد لك الألوان، الكمية، والسعر الحالي عبر واتساب.",
    carton: "محتوى الكرتون",
    pairs: "زوجًا",
    sizes: "المقاسات",
    category: "القسم",
    price: "سعر الزوج بالجملة",
    priceOnRequest: "السعر عند التواصل",
    priceNote: "يتأكد السعر والتوفر قبل تثبيت الطلب.",
    whatsapp: "اطلب هذا الموديل عبر واتساب",
    addOrder: "أضف الموديل إلى طلبك",
    cart: "السلة",
    cartEmpty: "فتح السلة، السلة فارغة",
    cartCount: "فتح السلة، {count} كرتون",
    ctaHint: "اذكر الريفيرانس لتأكيد أسرع.",
    whyKicker: "مصمم لطلب الجملة",
    whyTitle: "كل ما يحتاجه التاجر لاتخاذ قرار سريع",
    whyIntro: "صفحة مستقلة لكل موديل، رابط واضح، ومعلومات طلب لا تضيع بين الصور.",
    trustReferenceTitle: "ريفيرانس ثابت",
    trustReferenceText: "استخدم رقم الموديل نفسه في الرسالة والطلب والإعلان.",
    trustCartonTitle: "طلب بالكرتون",
    trustCartonText: "عدد الأزواج والمقاسات ظاهر قبل التواصل.",
    trustDeliveryTitle: "توصيل لجميع الولايات",
    trustDeliveryText: "نتواصل معك لتأكيد الولاية ونوع التوصيل.",
    trustReplyTitle: "تأكيد مباشر",
    trustReplyText: "واتساب سريع للمحلات وتجار إعادة البيع.",
    detailsKicker: "تفاصيل الموديل",
    detailsTitle: "معلومات واضحة قبل طلب الكمية",
    orderDetails: "تفاصيل الجملة",
    orderDetailsText: "هذا الموديل مخصص للبيع بالجملة. يتأكد الفريق من السعر والألوان والتوفر قبل تثبيت الطلب.",
    sizeDetails: "المقاسات المتاحة في السيرية",
    traderBenefits: "مزايا الطلب من جولان",
    traderBenefitsItems: [
      "تشكيلة أحذية نسائية موجهة للمحلات وتجار إعادة البيع",
      "تأكيد الريفيرانس والكمية عبر واتساب",
      "إمكانية جمع عدة موديلات في طلب موحد",
      "توصيل لجميع الولايات حسب بيانات الطلب"
    ],
    relatedKicker: "موديلات من القسم نفسه",
    relatedTitle: "قد تناسب تشكيلة محلك أيضًا",
    relatedLink: "شاهد الموديل",
    mobileText: "أرسل الريفيرانس الآن",
    footer: "Joulane Fashion — بيع أحذية نسائية بالجملة للتجار والمحلات.",
    privacyOptOut: "إيقاف القياس",
    whatsappMessage: "مرحبًا جولان فاشن، أنا تاجر جملة وأريد تفاصيل هذا الموديل:",
    liveChecking: "جارٍ تأكيد التوفر...",
    quickCta: "اطلب بسرعة",
    quickKicker: "طلب مباشر من صفحة المنتج",
    quickTitle: "أرسل طلبك في أقل من دقيقة",
    quickIntro: "أدخل معلومات التوصيل وسيتصل بك فريق جولان لتأكيد الموديل والكمية.",
    quickFullName: "الاسم واللقب / اسم المحل",
    quickNamePlaceholder: "مثال: محمد بن علي — محل الأناقة",
    quickPhone: "رقم الهاتف",
    quickPhonePlaceholder: "05 / 06 / 07XXXXXXXX",
    quickWilaya: "الولاية",
    quickWilayaPlaceholder: "اختر الولاية",
    quickCommune: "البلدية",
    quickCommunePlaceholder: "اختر البلدية",
    quickAddress: "العنوان بالتفصيل",
    quickAddressPlaceholder: "الحي، الشارع، اسم المحل أو نقطة دالة",
    quickDelivery: "طريقة التوصيل",
    quickHome: "إلى العنوان",
    quickDesk: "مكتب كازيتور",
    quickQty: "عدد الكرطونات",
    quickCarton: "كرطون",
    quickPairsTotal: "إجمالي الأزواج",
    quickSubtotal: "المنتجات",
    quickShipping: "التوصيل",
    quickTotal: "المجموع",
    quickChecking: "يُحسب تلقائيًا",
    quickSubmit: "تأكيد الطلب السريع",
    quickTrustCash: "الدفع عند الاستلام",
    quickTrustConfirm: "اتصال لتأكيد الطلب",
    quickStatusHint: "لن تحتاج إلى فتح واتساب لإرسال الطلب.",
    quickSuccessTitle: "تم تسجيل طلبك بنجاح",
    quickSuccessText: "سيتصل بك فريق جولان لتأكيد التوفر والتوصيل.",
    quickOrderReference: "رقم الطلب",
    quickTrackingCode: "رقم التتبع",
    quickCopyTracking: "نسخ رابط التتبع",
    quickNewOrder: "إرسال طلب آخر",
    noImages: "صورة المنتج"
  },
  fr: {
    locale: "fr_DZ",
    alternateLocale: "ar_DZ",
    dir: "ltr",
    brandSub: "Chaussures femme en gros",
    skip: "Aller aux informations du produit",
    back: "Retour au catalogue",
    language: "العربية",
    home: "Accueil",
    catalog: "Catalogue",
    reference: "Référence",
    available: "Disponible à la commande en gros",
    unavailable: "Indisponible actuellement",
    wholesaleOnly: "Réservé aux boutiques et revendeurs",
    introTitle: "Un modèle prêt pour votre commande de gros",
    introText: "Envoyez la référence : nous confirmons les couleurs, la quantité et le prix actuel sur WhatsApp.",
    carton: "Contenu du carton",
    pairs: "paires",
    sizes: "Pointures",
    category: "Catégorie",
    price: "Prix de gros par paire",
    priceOnRequest: "Prix sur demande",
    priceNote: "Prix et disponibilité confirmés avant validation.",
    whatsapp: "Commander ce modèle sur WhatsApp",
    addOrder: "Ajouter le modèle à votre commande",
    cart: "Panier",
    cartEmpty: "Ouvrir le panier, le panier est vide",
    cartCount: "Ouvrir le panier, {count} carton(s)",
    ctaHint: "Mentionnez la référence pour une confirmation rapide.",
    whyKicker: "Pensé pour la vente en gros",
    whyTitle: "Tout ce qu’un revendeur doit savoir rapidement",
    whyIntro: "Une page par modèle, un lien clair et des informations faciles à retrouver depuis vos publicités.",
    trustReferenceTitle: "Référence stable",
    trustReferenceText: "Le même identifiant pour le message, la commande et la publicité.",
    trustCartonTitle: "Commande par carton",
    trustCartonText: "Nombre de paires et pointures visibles avant contact.",
    trustDeliveryTitle: "Livraison toutes wilayas",
    trustDeliveryText: "Nous confirmons la wilaya et le mode de livraison avec vous.",
    trustReplyTitle: "Confirmation directe",
    trustReplyText: "Échange WhatsApp rapide pour boutiques et revendeurs.",
    detailsKicker: "Détails du modèle",
    detailsTitle: "Des informations claires avant de commander",
    orderDetails: "Détails de gros",
    orderDetailsText: "Ce modèle est destiné à la vente en gros. Notre équipe confirme le prix, les couleurs et la disponibilité avant validation.",
    sizeDetails: "Pointures de la série",
    traderBenefits: "Pourquoi commander chez Joulane",
    traderBenefitsItems: [
      "Collection femme pensée pour boutiques et revendeurs",
      "Confirmation de la référence et de la quantité sur WhatsApp",
      "Possibilité de regrouper plusieurs modèles dans une commande",
      "Livraison dans toutes les wilayas selon votre demande"
    ],
    relatedKicker: "Modèles de la même catégorie",
    relatedTitle: "À découvrir aussi pour votre boutique",
    relatedLink: "Voir le modèle",
    mobileText: "Envoyez la référence",
    footer: "Joulane Fashion — chaussures femme en gros pour boutiques et revendeurs.",
    privacyOptOut: "Désactiver la mesure",
    whatsappMessage: "Bonjour Joulane Fashion, je suis revendeur et je souhaite les détails de ce modèle :",
    liveChecking: "Vérification de la disponibilité...",
    quickCta: "Commande rapide",
    quickKicker: "Commande directe depuis la fiche produit",
    quickTitle: "Commandez en moins d’une minute",
    quickIntro: "Renseignez la livraison et l’équipe Joulane vous appellera pour confirmer le modèle et la quantité.",
    quickFullName: "Nom complet / boutique",
    quickNamePlaceholder: "Ex. Mohamed Benali — Boutique Élégance",
    quickPhone: "Téléphone",
    quickPhonePlaceholder: "05 / 06 / 07XXXXXXXX",
    quickWilaya: "Wilaya",
    quickWilayaPlaceholder: "Choisir la wilaya",
    quickCommune: "Commune",
    quickCommunePlaceholder: "Choisir la commune",
    quickAddress: "Adresse détaillée",
    quickAddressPlaceholder: "Quartier, rue, boutique ou point de repère",
    quickDelivery: "Mode de livraison",
    quickHome: "À l’adresse",
    quickDesk: "Bureau Kazitour",
    quickQty: "Nombre de cartons",
    quickCarton: "carton(s)",
    quickPairsTotal: "Total des paires",
    quickSubtotal: "Produits",
    quickShipping: "Livraison",
    quickTotal: "Total",
    quickChecking: "Calcul automatique",
    quickSubmit: "Confirmer la commande rapide",
    quickTrustCash: "Paiement à la livraison",
    quickTrustConfirm: "Appel de confirmation",
    quickStatusHint: "La commande est envoyée sans ouvrir WhatsApp.",
    quickSuccessTitle: "Commande enregistrée",
    quickSuccessText: "L’équipe Joulane vous appellera pour confirmer la disponibilité et la livraison.",
    quickOrderReference: "Référence de commande",
    quickTrackingCode: "Numéro de suivi",
    quickCopyTracking: "Copier le lien de suivi",
    quickNewOrder: "Envoyer une autre commande",
    noImages: "Photo du produit"
  }
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function escapeXml(value) {
  return escapeHtml(value);
}

function jsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function absoluteImages(product) {
  const rawImages = [
    ...(Array.isArray(product.images) ? product.images : []),
    product.image
  ].filter(Boolean);
  const unique = [...new Set(rawImages.map(image => {
    if (/^https?:\/\//i.test(image)) return image;
    return `${SITE_ORIGIN}${image.startsWith("/") ? image : `/${image}`}`;
  }))];
  return unique.length ? unique : [productImageUrl(product)];
}

function localAssetUrl(url) {
  try {
    const parsed = new URL(url, SITE_ORIGIN);
    return parsed.origin === SITE_ORIGIN ? `${parsed.pathname}${parsed.search}` : parsed.href;
  } catch {
    return url;
  }
}

function productSizes(product) {
  const sizes = Array.isArray(product.sizes)
    ? product.sizes.map(Number).filter(Number.isFinite)
    : [];
  return [...new Set(sizes)].sort((a, b) => a - b);
}

function relatedProducts(product) {
  const candidates = PRODUCTS.filter(item => (
    item.id !== product.id && item.category === product.category
  ));
  const currentIndex = PRODUCTS.findIndex(item => item.id === product.id);
  return [...candidates]
    .sort((a, b) => {
      const aIndex = PRODUCTS.findIndex(item => item.id === a.id);
      const bIndex = PRODUCTS.findIndex(item => item.id === b.id);
      const aDistance = (aIndex - currentIndex + PRODUCTS.length) % PRODUCTS.length;
      const bDistance = (bIndex - currentIndex + PRODUCTS.length) % PRODUCTS.length;
      return aDistance - bDistance;
    })
    .slice(0, 4);
}

function schemaGraph(product, lang, canonicalUrl, description, images) {
  const copy = COPY[lang];
  const reference = productReference(product);
  const title = localizedProductTitle(product, lang);
  const alternateTitle = localizedProductTitle(product, lang === "ar" ? "fr" : "ar");
  const sizes = productSizes(product);
  const pairs = Number(product.pairsPerSeries) || 0;
  const unitPrice = productUnitPrice(product);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}/#organization`,
        name: "Joulane Fashion",
        url: `${SITE_ORIGIN}/`,
        logo: `${SITE_ORIGIN}https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/skilwjfxosy60qtgwkxw.jpg`,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "wholesale sales",
          telephone: "+213660125123",
          availableLanguage: ["Arabic", "French"]
        },
        sameAs: [
          "https://facebook.com/Joulane.Fashion",
          "https://instagram.com/joulane.fashion",
          "https://tiktok.com/@joulane.fashion"
        ]
      },
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: productSeoTitle(product, lang),
        description,
        inLanguage: lang === "ar" ? "ar-DZ" : "fr-DZ",
        isPartOf: {
          "@type": "WebSite",
          "@id": `${SITE_ORIGIN}/#website`,
          name: "Joulane Fashion",
          url: `${SITE_ORIGIN}/`
        },
        primaryImageOfPage: {
          "@type": "ImageObject",
          contentUrl: images[0]
        },
        mainEntity: {
          "@id": `${canonicalUrl}#product`
        }
      },
      {
        "@type": "Product",
        "@id": `${canonicalUrl}#product`,
        name: title,
        alternateName: alternateTitle,
        description,
        url: canonicalUrl,
        image: images,
        sku: String(product.id),
        mpn: reference,
        model: reference,
        category: categoryLabel(product.category, lang),
        brand: {
          "@type": "Brand",
          name: "Joulane Fashion"
        },
        audience: {
          "@type": "BusinessAudience",
          audienceType: lang === "ar"
            ? "تجار الجملة ومحلات الأحذية النسائية"
            : "Boutiques et revendeurs de chaussures femme"
        },
        offers: unitPrice > 0 ? {
          "@type": "Offer",
          price: unitPrice.toFixed(2),
          priceCurrency: "DZD",
          availability: product.isAvailable === false
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
          url: canonicalUrl,
          itemCondition: "https://schema.org/NewCondition"
        } : undefined,
        additionalProperty: [
          pairs ? {
            "@type": "PropertyValue",
            name: copy.carton,
            value: `${pairs} ${copy.pairs}`
          } : null,
          sizes.length ? {
            "@type": "PropertyValue",
            name: copy.sizes,
            value: sizes.join(", ")
          } : null,
          {
            "@type": "PropertyValue",
            name: copy.reference,
            value: reference
          }
        ].filter(Boolean)
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumbs`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: copy.home,
            item: `${SITE_ORIGIN}/`
          },
          {
            "@type": "ListItem",
            position: 2,
            name: copy.catalog,
            item: `${SITE_ORIGIN}/#catalog`
          },
          {
            "@type": "ListItem",
            position: 3,
            name: reference,
            item: canonicalUrl
          }
        ]
      }
    ]
  };
}

function renderRelatedCard(product, lang, copy) {
  const reference = productReference(product);
  const title = localizedProductTitle(product, lang);
  const image = localAssetUrl(productImageUrl(product));
  const href = productPagePath(product, lang);

  return `
    <article class="pp-related-card">
      <a href="${escapeHtml(href)}" aria-label="${escapeHtml(`${reference} — ${title}`)}">
        <div class="pp-related-card__media">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(`${reference} — ${title}`)}" loading="lazy" decoding="async" width="940" height="788" />
        </div>
        <div class="pp-related-card__body">
          <strong class="pp-related-card__ref">${escapeHtml(reference)}</strong>
          <p class="pp-related-card__title">${escapeHtml(title)}</p>
          <span class="pp-related-card__link">${escapeHtml(copy.relatedLink)} <span aria-hidden="true">→</span></span>
        </div>
      </a>
    </article>`;
}

function renderProductPage(product, lang) {
  const copy = COPY[lang];
  const reference = productReference(product);
  const title = localizedProductTitle(product, lang);
  const alternateLang = lang === "ar" ? "fr" : "ar";
  const alternateTitle = localizedProductTitle(product, alternateLang);
  const canonicalUrl = productPageUrl(product, lang);
  const alternateUrl = productPageUrl(product, alternateLang);
  const description = productSeoDescription(product, lang);
  const category = categoryLabel(product.category, lang);
  const images = absoluteImages(product);
  const localImages = images.map(localAssetUrl);
  const sizes = productSizes(product);
  const pairs = Number(product.pairsPerSeries) || 0;
  const available = product.isAvailable !== false;
  const schema = schemaGraph(product, lang, canonicalUrl, description, images);
  const related = relatedProducts(product);
  const orderUrl = `/?add=${encodeURIComponent(product.id)}&cart=open&utm_source=product_page&utm_medium=referral&utm_campaign=wholesale_catalog#catalog`;
  const whatsappText = `${copy.whatsappMessage}\n${copy.reference}: ${reference}\n${canonicalUrl}`;
  const whatsappUrl = `https://wa.me/213660125123?text=${encodeURIComponent(whatsappText)}`;
  const embeddedProduct = {
    id: product.id,
    reference,
    category: product.category,
    pairsPerSeries: pairs,
    sizes,
    price: productUnitPrice(product),
    seriesPrice: Number(product.seriesPrice) || 0,
    isAvailable: available,
    image: images[0],
    images,
    colors: product.colors || { ar: [], fr: [] },
    title: {
      ar: localizedProductTitle(product, "ar"),
      fr: localizedProductTitle(product, "fr")
    },
    page: {
      ar: productPagePath(product, "ar"),
      fr: productPagePath(product, "fr")
    }
  };

  return `<!doctype html>
<html lang="${lang === "ar" ? "ar-DZ" : "fr-DZ"}" dir="${copy.dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(productSeoTitle(product, lang))}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
  <meta name="theme-color" content="#090908" />
  <meta name="meta-pixel-id" content="${META_PIXEL_ID}" />
  <meta name="supabase-url" content="${supabaseUrl}" />
  <meta name="supabase-publishable-key" content="${supabasePublishableKey}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <link rel="alternate" hreflang="ar-DZ" href="${productPageUrl(product, "ar")}" />
  <link rel="alternate" hreflang="fr-DZ" href="${productPageUrl(product, "fr")}" />
  <link rel="alternate" hreflang="x-default" href="${productPageUrl(product, "ar")}" />
  <link rel="preload" as="image" href="${escapeHtml(localImages[0])}" fetchpriority="high" />
  <link rel="icon" href="https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955418/joulane/products/opsarwpedahajpkgostn.png" type="image/png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/product-page.css" />
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="Joulane Fashion" />
  <meta property="og:locale" content="${copy.locale}" />
  <meta property="og:locale:alternate" content="${copy.alternateLocale}" />
  <meta property="og:title" content="${escapeHtml(productHeading(product, lang))}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${escapeHtml(images[0])}" />
  <meta property="og:image:alt" content="${escapeHtml(`${reference} — ${title}`)}" />
  <meta property="product:retailer_item_id" content="${escapeHtml(product.id)}" />
  <meta property="product:condition" content="new" />
  <meta property="product:price:amount" content="${productUnitPrice(product).toFixed(2)}" />
  <meta property="product:price:currency" content="DZD" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(productHeading(product, lang))}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(images[0])}" />
  <script type="application/ld+json">${jsonForHtml(schema)}</script>
  <script id="joulane-product-data" type="application/json">${jsonForHtml(embeddedProduct)}</script>
  <script defer src="/meta-analytics.js"></script>
  <script defer src="/product-page.js"></script>
  <script type="module" src="/${productQuickOrderAsset}"></script>
  <script type="module" src="/${androidUpdaterAsset}"></script>
</head>
<body class="pp-page" data-product-id="${escapeHtml(product.id)}" data-language="${lang}">
  <a class="pp-skip-link" href="#product-info">${escapeHtml(copy.skip)}</a>

  <header class="pp-site-header">
    <div class="pp-container pp-site-header__inner">
      <a class="pp-brand" href="/" aria-label="Joulane Fashion">
        <img class="pp-brand__logo" src="https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/skilwjfxosy60qtgwkxw.jpg" alt="" width="42" height="42" />
        <span>
          <strong class="pp-brand__name">JOULANE</strong>
          <small class="pp-brand__sub">${escapeHtml(copy.brandSub)}</small>
        </span>
      </a>
      <nav class="pp-header__actions" aria-label="${escapeHtml(copy.catalog)}">
        <a class="pp-back-link" href="/#catalog"><span aria-hidden="true">←</span> ${escapeHtml(copy.back)}</a>
        <a class="pp-lang-btn" href="${escapeHtml(productPagePath(product, alternateLang))}" hreflang="${alternateLang === "ar" ? "ar-DZ" : "fr-DZ"}">${escapeHtml(copy.language)}</a>
      </nav>
    </div>
  </header>

  <main>
    <div class="pp-container">
      <nav class="pp-breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">${escapeHtml(copy.home)}</a></li>
          <li aria-hidden="true">/</li>
          <li><a href="/#catalog">${escapeHtml(copy.catalog)}</a></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">${escapeHtml(reference)}</li>
        </ol>
      </nav>

      <section class="pp-hero" id="product-info">
        <div class="pp-gallery" aria-label="${escapeHtml(copy.noImages)}">
          <div class="pp-main-image">
            <span class="pp-gallery-status pp-badge ${available ? "pp-badge--available" : "pp-badge--unavailable"}" data-live-availability>
              ${escapeHtml(available ? copy.available : copy.unavailable)}
            </span>
            <img data-main-product-image src="${escapeHtml(localImages[0])}" alt="${escapeHtml(`${reference} — ${title}`)}" decoding="async" fetchpriority="high" width="940" height="788" />
            <span class="pp-image-counter" data-image-counter>1 / ${localImages.length}</span>
          </div>
          ${localImages.length > 1 ? `
          <div class="pp-thumbnails" aria-label="${escapeHtml(copy.noImages)}">
            ${localImages.map((image, index) => `
              <button class="pp-thumb ${index === 0 ? "is-active" : ""}" type="button" data-gallery-image="${escapeHtml(image)}" data-gallery-index="${index}" aria-current="${index === 0 ? "true" : "false"}" aria-label="${escapeHtml(`${copy.noImages} ${index + 1}`)}">
                <img src="${escapeHtml(image)}" alt="" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" width="120" height="120" />
              </button>`).join("")}
          </div>` : ""}
        </div>

        <div class="pp-product-info">
          <p class="pp-reference">${escapeHtml(copy.reference)}: <strong data-product-reference>${escapeHtml(reference)}</strong></p>
          <div class="pp-badges">
            <span class="pp-badge pp-badge--gold">${escapeHtml(category)}</span>
            <span class="pp-badge">${escapeHtml(copy.wholesaleOnly)}</span>
          </div>
          <h1 class="pp-title"><span class="pp-title__accent">${escapeHtml(reference)}</span><br />${escapeHtml(title)}</h1>
          <p class="pp-title-fr" lang="${alternateLang === "ar" ? "ar-DZ" : "fr-DZ"}">${escapeHtml(alternateTitle)}</p>
          <p class="pp-description">${escapeHtml(description)}</p>

          <div class="pp-price-row">
            <div>
              <span class="pp-price-label">${escapeHtml(copy.price)}</span>
              <strong class="pp-price" data-product-price>${escapeHtml(copy.priceOnRequest)}</strong>
            </div>
            <small class="pp-price-note">${escapeHtml(copy.priceNote)}</small>
          </div>

          <div class="pp-actions">
            <a class="pp-btn pp-btn--gold pp-actions__primary" href="#quick-order">
              <span aria-hidden="true">⚡</span> ${escapeHtml(copy.quickCta)}
            </a>
            <a class="pp-btn pp-btn--whatsapp" data-whatsapp-link data-meta-contact href="${escapeHtml(whatsappUrl)}" target="_blank" rel="noopener noreferrer">
              <span aria-hidden="true">●</span> ${escapeHtml(copy.whatsapp)}
            </a>
            <a class="pp-btn pp-btn--outline" data-order-link href="${escapeHtml(orderUrl)}">
              <span aria-hidden="true">＋</span> ${escapeHtml(copy.addOrder)}
            </a>
            <p class="pp-actions-hint">${escapeHtml(copy.ctaHint)}</p>
          </div>

          <aside class="pp-wholesale-note">
            <strong>${escapeHtml(copy.introTitle)}</strong>
            ${escapeHtml(copy.introText)}
          </aside>

          <dl class="pp-specs">
            <div class="pp-spec">
              <dt class="pp-spec__label">${escapeHtml(copy.carton)}</dt>
              <dd class="pp-spec__value" data-product-pairs>${pairs ? `${pairs} ${copy.pairs}` : "—"}</dd>
            </div>
            <div class="pp-spec">
              <dt class="pp-spec__label">${escapeHtml(copy.sizes)}</dt>
              <dd class="pp-spec__value" data-product-sizes>${sizes.length ? sizes.join(" · ") : "—"}</dd>
            </div>
            <div class="pp-spec">
              <dt class="pp-spec__label">${escapeHtml(copy.category)}</dt>
              <dd class="pp-spec__value">${escapeHtml(category)}</dd>
            </div>
            <div class="pp-spec">
              <dt class="pp-spec__label">${escapeHtml(copy.reference)}</dt>
              <dd class="pp-spec__value">${escapeHtml(reference)}</dd>
            </div>
          </dl>

          <section class="pp-quick-order" id="quick-order" aria-labelledby="quick-order-title">
            <header class="pp-quick-order__header">
              <span class="pp-quick-order__kicker">${escapeHtml(copy.quickKicker)}</span>
              <h2 id="quick-order-title">${escapeHtml(copy.quickTitle)}</h2>
              <p>${escapeHtml(copy.quickIntro)}</p>
              <div class="pp-quick-order__trust" aria-label="${escapeHtml(copy.quickTrustCash)}">
                <span><b aria-hidden="true">✓</b> ${escapeHtml(copy.quickTrustCash)}</span>
                <span><b aria-hidden="true">✓</b> ${escapeHtml(copy.quickTrustConfirm)}</span>
              </div>
            </header>

            <form class="pp-order-form" id="quick-order-form">
              <div class="pp-honeypot" aria-hidden="true">
                <label for="qo-website">Website</label>
                <input id="qo-website" name="website" type="text" tabindex="-1" autocomplete="off" />
              </div>

              <div class="pp-order-fields">
                <label class="pp-order-field">
                  <span>${escapeHtml(copy.quickFullName)} <b aria-hidden="true">*</b></span>
                  <input id="qo-name" name="customerName" type="text" minlength="3" maxlength="80" autocomplete="name" placeholder="${escapeHtml(copy.quickNamePlaceholder)}" required />
                </label>
                <label class="pp-order-field">
                  <span>${escapeHtml(copy.quickPhone)} <b aria-hidden="true">*</b></span>
                  <input id="qo-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="10" pattern="0[567][0-9]{8}" placeholder="${escapeHtml(copy.quickPhonePlaceholder)}" required />
                </label>
                <label class="pp-order-field">
                  <span>${escapeHtml(copy.quickWilaya)} <b aria-hidden="true">*</b></span>
                  <select id="qo-wilaya" name="wilayaCode" autocomplete="address-level1" required>
                    <option value="">${escapeHtml(copy.quickWilayaPlaceholder)}</option>
                  </select>
                </label>
                <label class="pp-order-field">
                  <span>${escapeHtml(copy.quickCommune)} <b aria-hidden="true">*</b></span>
                  <select id="qo-commune" name="commune" autocomplete="address-level2" disabled required>
                    <option value="">${escapeHtml(copy.quickCommunePlaceholder)}</option>
                  </select>
                </label>
                <label class="pp-order-field pp-order-field--wide">
                  <span>${escapeHtml(copy.quickAddress)} <b data-address-required aria-hidden="true">*</b></span>
                  <input id="qo-address" name="address" type="text" minlength="4" maxlength="180" autocomplete="street-address" placeholder="${escapeHtml(copy.quickAddressPlaceholder)}" required />
                </label>
              </div>

              <fieldset class="pp-delivery-options">
                <legend>${escapeHtml(copy.quickDelivery)}</legend>
                <label class="pp-delivery-option">
                  <input type="radio" name="deliveryType" value="home" checked />
                  <span><b aria-hidden="true">⌂</b> ${escapeHtml(copy.quickHome)}</span>
                </label>
                <label class="pp-delivery-option">
                  <input type="radio" name="deliveryType" value="desk" />
                  <span><b aria-hidden="true">▣</b> ${escapeHtml(copy.quickDesk)}</span>
                </label>
              </fieldset>

              <div class="pp-order-quantity">
                <div>
                  <span class="pp-order-quantity__label">${escapeHtml(copy.quickQty)}</span>
                  <small><span data-quick-pairs-total>${pairs || 0}</span> ${escapeHtml(copy.pairs)}</small>
                </div>
                <div class="pp-quantity-stepper" role="group" aria-label="${escapeHtml(copy.quickQty)}">
                  <button type="button" data-quantity-minus aria-label="−">−</button>
                  <input id="qo-quantity" name="cartons" type="number" inputmode="numeric" min="1" max="50" step="1" value="1" aria-label="${escapeHtml(copy.quickQty)}" required />
                  <button type="button" data-quantity-plus aria-label="+">+</button>
                </div>
              </div>

              <div class="pp-order-summary" aria-live="polite">
                <div><span>${escapeHtml(copy.quickSubtotal)}</span><strong data-quick-subtotal>${escapeHtml(copy.quickChecking)}</strong></div>
                <div><span>${escapeHtml(copy.quickShipping)}</span><strong data-quick-shipping>${escapeHtml(copy.quickChecking)}</strong></div>
                <div class="pp-order-summary__total"><span>${escapeHtml(copy.quickTotal)}</span><strong data-quick-total>${escapeHtml(copy.quickChecking)}</strong></div>
              </div>

              <button class="pp-btn pp-btn--gold pp-order-submit" type="submit" data-quick-submit>
                <span aria-hidden="true">✓</span> ${escapeHtml(copy.quickSubmit)}
              </button>
              <p class="pp-order-status" data-quick-status aria-live="polite">${escapeHtml(copy.quickStatusHint)}</p>
            </form>

            <div class="pp-order-success" data-quick-success hidden tabindex="-1">
              <span class="pp-order-success__icon" aria-hidden="true">✓</span>
              <h3>${escapeHtml(copy.quickSuccessTitle)}</h3>
              <p data-quick-success-message>${escapeHtml(copy.quickSuccessText)}</p>
              <div>${escapeHtml(copy.quickOrderReference)}: <strong data-quick-order-reference>—</strong></div>
              <div class="pp-order-success__tracking">
                <span>${escapeHtml(copy.quickTrackingCode)}: <strong data-quick-tracking-code>—</strong></span>
                <button class="pp-btn pp-btn--gold" type="button" data-quick-copy-tracking>${escapeHtml(copy.quickCopyTracking)}</button>
              </div>
              <button class="pp-btn pp-btn--outline" type="button" data-quick-new-order>${escapeHtml(copy.quickNewOrder)}</button>
            </div>
          </section>
        </div>
      </section>
    </div>

    <section class="pp-section pp-section--soft">
      <div class="pp-container">
        <header class="pp-section-heading">
          <span class="pp-section-kicker">${escapeHtml(copy.whyKicker)}</span>
          <h2 class="pp-section-title">${escapeHtml(copy.whyTitle)}</h2>
          <p class="pp-section-intro">${escapeHtml(copy.whyIntro)}</p>
        </header>
        <div class="pp-trust-grid">
          <article class="pp-trust-card"><span class="pp-trust-card__icon" aria-hidden="true">#</span><h3>${escapeHtml(copy.trustReferenceTitle)}</h3><p>${escapeHtml(copy.trustReferenceText)}</p></article>
          <article class="pp-trust-card"><span class="pp-trust-card__icon" aria-hidden="true">▣</span><h3>${escapeHtml(copy.trustCartonTitle)}</h3><p>${escapeHtml(copy.trustCartonText)}</p></article>
          <article class="pp-trust-card"><span class="pp-trust-card__icon" aria-hidden="true">⌖</span><h3>${escapeHtml(copy.trustDeliveryTitle)}</h3><p>${escapeHtml(copy.trustDeliveryText)}</p></article>
          <article class="pp-trust-card"><span class="pp-trust-card__icon" aria-hidden="true">✓</span><h3>${escapeHtml(copy.trustReplyTitle)}</h3><p>${escapeHtml(copy.trustReplyText)}</p></article>
        </div>
      </div>
    </section>

    <section class="pp-section">
      <div class="pp-container">
        <header class="pp-section-heading">
          <span class="pp-section-kicker">${escapeHtml(copy.detailsKicker)}</span>
          <h2 class="pp-section-title">${escapeHtml(copy.detailsTitle)}</h2>
        </header>
        <div class="pp-details">
          <article class="pp-detail-card">
            <h2>${escapeHtml(copy.orderDetails)}</h2>
            <p>${escapeHtml(copy.orderDetailsText)}</p>
          </article>
          <article class="pp-detail-card">
            <h2>${escapeHtml(copy.sizeDetails)}</h2>
            <div class="pp-size-list" data-product-size-list>
              ${sizes.length ? sizes.map(size => `<span class="pp-size">${size}</span>`).join("") : "<span class=\"pp-size\">—</span>"}
            </div>
          </article>
          <article class="pp-detail-card">
            <h2>${escapeHtml(copy.traderBenefits)}</h2>
            <ul class="pp-feature-list">
              ${copy.traderBenefitsItems.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </article>
        </div>
      </div>
    </section>

    <section class="pp-related pp-section--soft">
      <div class="pp-container">
        <header class="pp-section-heading">
          <span class="pp-section-kicker">${escapeHtml(copy.relatedKicker)}</span>
          <h2 class="pp-section-title">${escapeHtml(copy.relatedTitle)}</h2>
        </header>
        <div class="pp-related-grid">
          ${related.map(item => renderRelatedCard(item, lang, copy)).join("")}
        </div>
      </div>
    </section>
  </main>

  <footer class="pp-footer">
    <div class="pp-container pp-footer__inner">
      <span><strong>JOULANE</strong> — ${escapeHtml(copy.footer)}</span>
      <button class="pp-analytics-opt-out" type="button" data-meta-opt-out>${escapeHtml(copy.privacyOptOut)}</button>
    </div>
  </footer>

  <a
    class="pp-floating-cart"
    data-floating-cart
    data-cart-empty-label="${escapeHtml(copy.cartEmpty)}"
    data-cart-count-label="${escapeHtml(copy.cartCount)}"
    href="/?cart=open#catalog"
    aria-label="${escapeHtml(copy.cartEmpty)}"
    title="${escapeHtml(copy.cart)}"
  >
    <span class="pp-floating-cart__shine" aria-hidden="true"></span>
    <svg class="pp-floating-cart__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 4h2l1.9 9.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L20 8H7.1M9 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
    <span class="pp-floating-cart__label">${escapeHtml(copy.cart)}</span>
    <span class="pp-floating-cart__badge" data-floating-cart-count aria-hidden="true" hidden>0</span>
  </a>

  <aside class="pp-mobile-cta" aria-label="${escapeHtml(copy.quickCta)}">
    <div class="pp-mobile-cta__copy">
      <strong class="pp-mobile-cta__ref">${escapeHtml(reference)}</strong>
      <small class="pp-mobile-cta__hint">${escapeHtml(copy.mobileText)}</small>
    </div>
    <a class="pp-btn pp-btn--gold" href="#quick-order">${escapeHtml(copy.quickCta)}</a>
  </aside>
</body>
</html>`;
}

function sitemapXml() {
  const productEntries = PRODUCTS.flatMap(product => ["ar", "fr"].map(lang => {
    const location = productPageUrl(product, lang);
    const arUrl = productPageUrl(product, "ar");
    const frUrl = productPageUrl(product, "fr");
    return `  <url>
    <loc>${escapeXml(location)}</loc>
    <lastmod>${buildDate}</lastmod>
    <xhtml:link rel="alternate" hreflang="ar-DZ" href="${escapeXml(arUrl)}" />
    <xhtml:link rel="alternate" hreflang="fr-DZ" href="${escapeXml(frUrl)}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(arUrl)}" />
    <image:image>
      <image:loc>${escapeXml(productImageUrl(product))}</image:loc>
      <image:title>${escapeXml(productHeading(product, lang))}</image:title>
    </image:image>
  </url>`;
  }));

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE_ORIGIN}/</loc>
    <lastmod>${buildDate}</lastmod>
    <image:image>
      <image:loc>${SITE_ORIGIN}https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955417/joulane/products/qvyvxxiae7cjygigkrtw.jpg</image:loc>
      <image:title>Joulane Fashion — أحذية نسائية بالجملة</image:title>
    </image:image>
  </url>
${productEntries.join("\n")}
</urlset>
`;
}

function robotsTxt() {
  return `User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /stock.html
Disallow: /api/

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
}

async function writeProductPages() {
  const seenPaths = new Set();
  let count = 0;

  for (const product of PRODUCTS) {
    for (const lang of ["ar", "fr"]) {
      const pathname = productPagePath(product, lang);
      if (seenPaths.has(pathname)) {
        throw new Error(`Duplicate product path: ${pathname}`);
      }
      seenPaths.add(pathname);

      const targetDir = resolve(distDir, pathname.replace(/^\/+|\/+$/g, ""));
      await mkdir(targetDir, { recursive: true });
      await writeFile(resolve(targetDir, "index.html"), renderProductPage(product, lang), "utf8");
      count += 1;
    }
  }

  return count;
}

await mkdir(distDir, { recursive: true });
const generatedPages = await writeProductPages();
await writeFile(resolve(distDir, "sitemap.xml"), sitemapXml(), "utf8");
await writeFile(resolve(distDir, "robots.txt"), robotsTxt(), "utf8");
await writeFile(resolve(distDir, "order-locations.json"), JSON.stringify({
  version: buildDate,
  wilayas: WILAYAS.map(wilaya => ({
    code: wilaya.code,
    nameAr: wilaya.nameAr,
    nameFr: wilaya.nameFr,
    communesAr: wilaya.communesAr,
    communesFr: wilaya.communesFr
  }))
}), "utf8");
await mkdir(resolve(distDir, "feeds"), { recursive: true });
await writeFile(resolve(distDir, "feeds", "meta-catalog-status.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalProducts: PRODUCTS.length,
  eligibleProducts: PRODUCTS.filter(product => productUnitPrice(product) > 0).length,
  excludedWithoutPrice: PRODUCTS.filter(product => !(productUnitPrice(product) > 0)).length,
  status: PRODUCTS.some(product => productUnitPrice(product) > 0) ? "ready" : "waiting_for_real_wholesale_prices",
  note: "Catalog price is the per-pair wholesale price. Cartons contain 18 pairs."
}, null, 2), "utf8");

console.log(`Generated ${generatedPages} localized product pages for ${PRODUCTS.length} products.`);
