import pb from '@/lib/pocketbaseClient';
import { formatMoney } from '@/lib/money';

// Vendor prices as quotation suggestions: the vendor's buying price, converted
// to the quotation's currency, plus our markup (Settings → Vendor prices).
export const DEFAULT_MARKUP = 30;
const WHOLE = new Set(['RWF', 'UGX', 'KES', 'TZS']);

let cache = null;
export function loadVendorOffers(force = false) {
  if (!cache || force) {
    cache = Promise.all([
      pb.collection('vendor_items').getFullList({ sort: 'name' }),
      pb.collection('vendors').getFullList({ sort: 'name' }),
      pb.collection('company_settings').getList(1, 1).then((r) => r.items[0] || {}).catch(() => ({})),
    ]).then(([items, vendors, cfg]) => {
      const vmap = new Map(vendors.map((v) => [v.id, v]));
      let rates = cfg.exchange_rates;
      if (typeof rates === 'string') { try { rates = JSON.parse(rates); } catch { rates = {}; } }
      const markup = cfg.vendor_markup === null || cfg.vendor_markup === undefined || cfg.vendor_markup === '' ? DEFAULT_MARKUP : Number(cfg.vendor_markup);
      return {
        markup: Number.isFinite(markup) ? markup : DEFAULT_MARKUP,
        rates: rates && typeof rates === 'object' ? rates : {},
        // Only priced items from vendors still in use.
        items: items
          .filter((i) => Number(i.price) > 0 && vmap.get(i.vendor)?.status !== 'inactive')
          .map((i) => ({ ...i, vendor_name: vmap.get(i.vendor)?.name || 'Vendor' })),
      };
    }).catch(() => ({ markup: DEFAULT_MARKUP, rates: {}, items: [] })); // roles that can't see buying prices get nothing
  }
  return cache;
}
export const resetVendorOffers = () => { cache = null; };

// How many RWF one unit of `cur` is worth (RWF itself is 1). null if not set.
function inRwf(cur, rates) {
  if (!cur || cur === 'RWF') return 1;
  const r = Number(rates?.[cur]);
  return r > 0 ? r : null;
}

// Convert an amount between currencies through RWF. null if a rate is missing.
export function convert(amount, from, to, rates) {
  if ((from || 'RWF') === (to || 'RWF')) return Number(amount) || 0;
  const a = inRwf(from, rates); const b = inRwf(to, rates);
  if (!a || !b) return null;
  return (Number(amount) || 0) * a / b;
}

// Prices in RWF/UGX/KES/TZS are rounded UP to the next 100; others to 2 decimals.
export function roundPrice(n, currency) {
  if (WHOLE.has(currency)) return Math.ceil(n / 100) * 100;
  return Math.ceil(n * 100) / 100;
}

// One vendor item, priced for a quotation in `currency`.
export function offerFor(item, currency, { markup, rates }) {
  const cost = convert(item.price, item.currency || 'RWF', currency, rates);
  if (cost === null) return { ...item, missingRate: item.currency !== 'RWF' ? item.currency : currency };
  const buy = WHOLE.has(currency) ? Math.round(cost) : Math.round(cost * 100) / 100;
  const sell = roundPrice(cost * (1 + markup / 100), currency);
  const converted = (item.currency || 'RWF') !== currency;
  return {
    ...item,
    buy,
    sell,
    cost_source: `${item.vendor_name}: ${formatMoney(item.price, item.currency)}${converted ? ` (rate ${Number(rates[item.currency] || 1) / Number(rates[currency] || 1)})` : ''} + ${markup}%`,
  };
}

export function searchVendorItems(items, text, limit = 8) {
  const words = String(text || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return items
    .filter((i) => {
      const hay = `${i.name} ${i.brand} ${i.code} ${i.vendor_name}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .slice(0, limit);
}
