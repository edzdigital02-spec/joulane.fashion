import { PRODUCTS } from "../src/data/products.js";
import {
  categoryLabel,
  localizedProductTitle,
  productImageUrl,
  productPageUrl,
  productReference,
  productSeoDescription
} from "../src/productSeo.js";

const SUPABASE_URL = "https://jsnsmqwznljllqmnzfrx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_kkXNEOz2KfLvbcpCXYR0uw_9eHV4G5h";
const DEFAULT_UNIT_PRICE = 3200;
const PAIRS_PER_CARTON = 18;

function normalizedUnitPrice(product) {
  return Number(product?.price) > 0 ? Number(product.price) : DEFAULT_UNIT_PRICE;
}

function normalizedPairsPerCarton(product) {
  const requestedPairs = Number(product?.pairsPerSeries);
  const validPairs = Number.isFinite(requestedPairs) && requestedPairs >= 1
    ? Math.floor(requestedPairs)
    : 0;
  if (product?.pairsPerSeriesConfigured === true && validPairs) return validPairs;
  if (validPairs && validPairs !== 15) return validPairs;
  return PAIRS_PER_CARTON;
}

function normalizedCartonPrice(product, pairsPerCarton) {
  return Number(product?.seriesPrice) > 0
    ? Number(product.seriesPrice)
    : normalizedUnitPrice(product) * pairsPerCarton;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function catalogRows(products) {
  return products
    .filter(product => normalizedUnitPrice(product) > 0)
    .map(product => {
      const pairsPerCarton = normalizedPairsPerCarton(product);
      const normalizedProduct = {
        ...product,
        price: normalizedUnitPrice(product),
        seriesPrice: normalizedCartonPrice(product, pairsPerCarton),
        pairsPerSeries: pairsPerCarton
      };
      const reference = productReference(normalizedProduct);
      return {
        id: normalizedProduct.id,
        title: `${reference} — ${localizedProductTitle(normalizedProduct, "ar")}`,
        description: productSeoDescription(normalizedProduct, "ar"),
        availability: normalizedProduct.isAvailable === false ? "out of stock" : "in stock",
        condition: "new",
        price: `${normalizedProduct.price.toFixed(2)} DZD`,
        link: productPageUrl(normalizedProduct, "ar"),
        image_link: productImageUrl(normalizedProduct),
        brand: "Joulane Fashion",
        custom_label_0: categoryLabel(normalizedProduct.category, "fr"),
        custom_label_1: `${pairsPerCarton} pairs per carton`,
        custom_label_2: reference,
        custom_label_3: `${normalizedProduct.seriesPrice.toFixed(2)} DZD per carton`
      };
    });
}

async function liveProducts() {
  const endpoint = `${SUPABASE_URL}/rest/v1/joulane_store?select=data&id=eq.products`;
  const response = await fetch(endpoint, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
  });
  if (!response.ok) throw new Error(`Supabase catalog read failed: ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows?.[0]?.data) ? rows[0].data : PRODUCTS;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  let products = PRODUCTS;
  let source = "static_fallback";
  try {
    products = await liveProducts();
    source = "supabase_live";
  } catch (_) {
    // A static fallback keeps the feed endpoint deterministic during a brief sync outage.
  }

  const rows = catalogRows(products);
  const excludedWithoutPrice = products.length - rows.length;
  const defaultedUnitPrices = products.filter(product => !(Number(product?.price) > 0)).length;
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("X-Joulane-Catalog-Source", source);
  res.setHeader("X-Joulane-Excluded-Without-Price", String(excludedWithoutPrice));

  if (req.query?.status === "1" || req.query?.format === "json") {
    return res.status(200).json({
      status: rows.length ? "ready" : "waiting_for_real_wholesale_prices",
      source,
      totalProducts: products.length,
      eligibleProducts: rows.length,
      excludedWithoutPrice,
      defaultUnitPrice: `${DEFAULT_UNIT_PRICE} DZD`,
      defaultedUnitPrices,
      feedUrl: "/api/meta-catalog"
    });
  }

  const headers = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "brand",
    "custom_label_0",
    "custom_label_1",
    "custom_label_2",
    "custom_label_3"
  ];
  const csv = [
    headers.join(","),
    ...rows.map(row => headers.map(header => csvCell(row[header])).join(","))
  ].join("\r\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="joulane-meta-catalog.csv"');
  return res.status(200).send(`\uFEFF${csv}\r\n`);
}
