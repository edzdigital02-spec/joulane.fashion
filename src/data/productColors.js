export const PRODUCT_COLOR_OPTIONS = [
  { key: 'black', hex: '#111111', ar: 'أسود', fr: 'Noir' },
  { key: 'white', hex: '#f7f7f4', ar: 'أبيض', fr: 'Blanc', light: true },
  { key: 'beige', hex: '#d8c3a5', ar: 'بيج', fr: 'Beige', light: true },
  { key: 'camel', hex: '#b9804a', ar: 'جملي', fr: 'Camel' },
  { key: 'brown', hex: '#6f432a', ar: 'بني', fr: 'Marron' },
  { key: 'gold', hex: '#d4af37', ar: 'ذهبي', fr: 'Doré', aliases: ['Dore'] },
  { key: 'silver', hex: '#c4c8cc', ar: 'فضي', fr: 'Argent', light: true, aliases: ['فضي كلاسيكي', 'Argent classique'] },
  { key: 'gray', hex: '#777b80', ar: 'رمادي', fr: 'Gris' },
  { key: 'red', hex: '#d32f2f', ar: 'أحمر', fr: 'Rouge' },
  { key: 'burgundy', hex: '#6f1d2c', ar: 'خمري', fr: 'Bordeaux' },
  { key: 'pink', hex: '#ef9aaf', ar: 'وردي', fr: 'Rose', light: true, aliases: ['روز'] },
  { key: 'purple', hex: '#7e57c2', ar: 'بنفسجي', fr: 'Violet' },
  { key: 'blue', hex: '#2979ff', ar: 'أزرق', fr: 'Bleu' },
  { key: 'navy', hex: '#172554', ar: 'كحلي', fr: 'Bleu marine', aliases: ['Marine'] },
  { key: 'green', hex: '#2e7d32', ar: 'أخضر', fr: 'Vert' },
  { key: 'olive', hex: '#737a36', ar: 'زيتي', fr: 'Kaki' },
  { key: 'orange', hex: '#ef6c00', ar: 'برتقالي', fr: 'Orange' },
  { key: 'champagne', hex: '#dfc49c', ar: 'شامبانيا', fr: 'Champagne', light: true },
  { key: 'bronze', hex: '#a97142', ar: 'برونزي', fr: 'Bronze' },
  {
    key: 'black_gold',
    hex: 'linear-gradient(135deg, #111111 0 48%, #d4af37 52% 100%)',
    ar: 'أسود ذهبي',
    fr: 'Noir Doré',
    aliases: ['Noir Dore']
  },
  {
    key: 'pearl_gold',
    hex: 'linear-gradient(135deg, #d4af37 0 48%, #f1e7d0 52% 100%)',
    ar: 'ذهبي لؤلؤي',
    fr: 'Doré perlé',
    aliases: ['Dore perle', 'Doré perle', 'Dore perlé'],
    light: true
  },
  {
    key: 'rose_gold',
    hex: 'linear-gradient(135deg, #d7a0a8 0 48%, #d4af37 52% 100%)',
    ar: 'روز ذهبي',
    fr: 'Rose doré',
    aliases: ['Rose dore']
  }
];

export function normalizeProductColorName(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

const COLOR_BY_KEY = new Map(PRODUCT_COLOR_OPTIONS.map(option => [option.key, option]));
const COLOR_BY_NAME = new Map();

PRODUCT_COLOR_OPTIONS.forEach(option => {
  [option.ar, option.fr, ...(option.aliases || [])].forEach(name => {
    COLOR_BY_NAME.set(normalizeProductColorName(name), option);
  });
});

export function productColorOptionByKey(key) {
  return COLOR_BY_KEY.get(String(key || '')) || null;
}

export function productColorOptionFromName(name) {
  const normalized = normalizeProductColorName(name);
  if (!normalized) return null;

  const exact = COLOR_BY_NAME.get(normalized);
  if (exact) return exact;

  // Legacy labels sometimes add a descriptive word such as "classique".
  // Match the longest known label first so "Bleu marine" never becomes "Bleu".
  const candidates = Array.from(COLOR_BY_NAME.entries())
    .filter(([alias]) => alias.length >= 3 && normalized.includes(alias))
    .sort((a, b) => b[0].length - a[0].length);
  return candidates[0]?.[1] || null;
}

export function productColorVisual(name, index = 0, product = null) {
  // The visible label is the first source of truth. This prevents stale or
  // incorrectly ordered colorKeys from painting a different color.
  const fromLabel = productColorOptionFromName(name);
  if (fromLabel) return fromLabel.hex;

  // Only fall back to the stored key when there is no visible label at all.
  // If an unknown label exists, a neutral dot is safer than displaying a
  // confidently wrong color next to it.
  if (!normalizeProductColorName(name)) {
    const storedKey = Array.isArray(product?.colorKeys) ? product.colorKeys[index] : null;
    const fromStoredKey = productColorOptionByKey(storedKey);
    if (fromStoredKey) return fromStoredKey.hex;
  }

  // A neutral fallback is deliberately used for unknown legacy names instead
  // of inventing a misleading random color.
  return '#8b9198';
}

export function inferProductColorKeys(product) {
  const ar = Array.isArray(product?.colors?.ar) ? product.colors.ar : [];
  const fr = Array.isArray(product?.colors?.fr) ? product.colors.fr : [];
  const stored = Array.isArray(product?.colorKeys) ? product.colorKeys : [];
  const count = Math.max(ar.length, fr.length, stored.length);
  const keys = [];

  for (let index = 0; index < count; index += 1) {
    const fromArabic = productColorOptionFromName(ar[index]);
    const fromFrench = productColorOptionFromName(fr[index]);
    const fromStored = productColorOptionByKey(stored[index]);
    const resolved = fromArabic || fromFrench || fromStored;
    if (resolved && !keys.includes(resolved.key)) keys.push(resolved.key);
  }

  return keys;
}

export function localizedProductColors(product, language = 'ar') {
  const direct = product?.colors?.[language];
  if (Array.isArray(direct) && direct.some(color => String(color || '').trim())) {
    return direct.map(color => String(color || '').trim()).filter(Boolean);
  }

  return inferProductColorKeys(product)
    .map(key => productColorOptionByKey(key)?.[language])
    .filter(Boolean);
}
