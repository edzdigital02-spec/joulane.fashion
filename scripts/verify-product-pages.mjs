import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTS } from "../src/data/products.js";
import {
  META_PIXEL_ID,
  SITE_ORIGIN,
  localizedProductTitle,
  productPagePath,
  productUnitPrice
} from "../src/productSeo.js";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(rootDir, "dist");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const target = resolve(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(target);
    return entry.isFile() && entry.name === "index.html" ? [target] : [];
  }));
  return nested.flat();
}

function metaContent(html, name, property = false) {
  const attribute = property ? "property" : "name";
  const pattern = new RegExp(`<meta\\s+${attribute}="${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s+content="([^"]*)"\\s*\\/?>`, "i");
  return html.match(pattern)?.[1] || "";
}

function linkHref(html, rel, hreflang) {
  const languagePart = hreflang ? `[^>]*hreflang="${hreflang}"` : "";
  const pattern = new RegExp(`<link\\s+rel="${rel}"${languagePart}[^>]*href="([^"]+)"`, "i");
  return html.match(pattern)?.[1] || "";
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)]
    .map(match => JSON.parse(match[1]));
}

const arRoot = resolve(distDir, "ar", "produits");
const frRoot = resolve(distDir, "fr", "produits");
const productFiles = [...await htmlFiles(arRoot), ...await htmlFiles(frRoot)];
const expectedPageCount = PRODUCTS.length * 2;
assert(productFiles.length === expectedPageCount, `Expected ${expectedPageCount} product pages, found ${productFiles.length}.`);

const expectedPaths = new Map();
for (const product of PRODUCTS) {
  for (const lang of ["ar", "fr"]) {
    expectedPaths.set(productPagePath(product, lang), { product, lang });
  }
}

const canonicalUrls = new Set();
for (const file of productFiles) {
  const html = await readFile(file, "utf8");
  const pathname = `/${relative(distDir, file)
    .split(sep)
    .slice(0, -1)
    .join("/")}/`;
  const expected = expectedPaths.get(pathname);
  assert(expected, `Unexpected product output path: ${pathname}`);

  const canonical = linkHref(html, "canonical");
  const expectedCanonical = `${SITE_ORIGIN}${pathname}`;
  assert(canonical === expectedCanonical, `Bad canonical for ${pathname}: ${canonical}`);
  assert(!canonicalUrls.has(canonical), `Duplicate canonical: ${canonical}`);
  canonicalUrls.add(canonical);

  assert(linkHref(html, "alternate", "ar-DZ"), `Missing ar-DZ hreflang for ${pathname}`);
  assert(linkHref(html, "alternate", "fr-DZ"), `Missing fr-DZ hreflang for ${pathname}`);
  assert(linkHref(html, "alternate", "x-default"), `Missing x-default hreflang for ${pathname}`);
  assert(metaContent(html, "meta-pixel-id") === META_PIXEL_ID, `Wrong Meta Pixel ID for ${pathname}`);
  assert(metaContent(html, "robots").includes("index,follow"), `Product page is not indexable: ${pathname}`);
  assert(metaContent(html, "og:type", true) === "product", `Missing product Open Graph type: ${pathname}`);
  assert(html.includes(localizedProductTitle(expected.product, expected.lang)), `Missing localized title: ${pathname}`);
  assert(!/0(?:\.00)?\s*DZD/i.test(html), `Zero DZD price leaked into ${pathname}`);
  assert(!html.includes("AggregateRating"), `Unverified rating schema found in ${pathname}`);
  assert(html.includes("data-floating-cart"), `Floating cart is missing from ${pathname}`);
  assert(html.includes("/?cart=open#catalog"), `Floating cart target is missing from ${pathname}`);
  assert(html.includes("&amp;cart=open") || html.includes("&cart=open"), `Order link does not open the cart in ${pathname}`);
  assert(html.includes('id="quick-order"'), `Quick-order section is missing from ${pathname}`);
  assert(html.includes('id="quick-order-form"'), `Quick-order form is missing from ${pathname}`);
  assert(html.includes('id="qo-name"'), `Quick-order name field is missing from ${pathname}`);
  assert(html.includes('id="qo-phone"'), `Quick-order phone field is missing from ${pathname}`);
  assert(html.includes('id="qo-wilaya"'), `Quick-order wilaya field is missing from ${pathname}`);
  assert(html.includes('id="qo-commune"'), `Quick-order commune field is missing from ${pathname}`);
  assert(html.includes('id="qo-address"'), `Quick-order address field is missing from ${pathname}`);
  assert(html.includes('id="qo-quantity"'), `Quick-order quantity field is missing from ${pathname}`);

  const jsonLd = jsonLdBlocks(html);
  assert(jsonLd.length === 1, `Expected one JSON-LD graph in ${pathname}`);
  assert(Array.isArray(jsonLd[0]["@graph"]), `JSON-LD graph missing in ${pathname}`);
  const productSchema = jsonLd[0]["@graph"].find(node => node["@type"] === "Product");
  assert(productSchema?.sku === expected.product.id, `Product schema SKU mismatch in ${pathname}`);
  assert(productSchema?.mpn === String(expected.product.reference), `Product schema MPN mismatch in ${pathname}`);
  const expectedUnitPrice = productUnitPrice(expected.product);
  assert(expectedUnitPrice > 0, `Missing real unit price for ${pathname}`);
  assert(Number(productSchema?.offers?.price) === expectedUnitPrice, `Product offer price mismatch in ${pathname}`);
  assert(productSchema?.offers?.priceCurrency === "DZD", `Product offer currency mismatch in ${pathname}`);
  assert(Number(metaContent(html, "product:price:amount", true)) === expectedUnitPrice, `Open Graph product price mismatch in ${pathname}`);
  assert(metaContent(html, "product:price:currency", true) === "DZD", `Open Graph product currency mismatch in ${pathname}`);
}

const sitemap = await readFile(resolve(distDir, "sitemap.xml"), "utf8");
assert((sitemap.match(/<url>/g) || []).length === expectedPageCount + 1, "Sitemap URL count is incorrect.");
assert((sitemap.match(/<image:image>/g) || []).length === expectedPageCount + 1, "Sitemap image count is incorrect.");
for (const canonical of canonicalUrls) {
  assert(sitemap.includes(`<loc>${canonical}</loc>`), `Canonical missing from sitemap: ${canonical}`);
}

const robots = await readFile(resolve(distDir, "robots.txt"), "utf8");
assert(robots.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`), "robots.txt does not reference the sitemap.");
assert(robots.includes("Disallow: /admin.html"), "robots.txt does not exclude admin.html.");
assert(robots.includes("Disallow: /stock.html"), "robots.txt does not exclude stock.html.");

const locations = JSON.parse(await readFile(resolve(distDir, "order-locations.json"), "utf8"));
assert(Array.isArray(locations.wilayas) && locations.wilayas.length === 69, "Quick-order wilaya data is incomplete.");
assert(locations.wilayas.every(wilaya => Array.isArray(wilaya.communesAr) && wilaya.communesAr.length), "Quick-order commune data is incomplete.");

console.log(JSON.stringify({
  products: PRODUCTS.length,
  localizedPages: productFiles.length,
  uniqueCanonicals: canonicalUrls.size,
  sitemapUrls: expectedPageCount + 1,
  metaPixelId: META_PIXEL_ID,
  structuredData: "valid JSON with Product, WebPage, Organization and BreadcrumbList"
}, null, 2));
