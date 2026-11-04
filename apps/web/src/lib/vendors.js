import { CATALOG_CATEGORIES, UNITS } from '@/lib/catalog';

export { UNITS };
export const VENDOR_CATEGORIES = CATALOG_CATEGORIES;
export const AVAILABILITY = [
  { value: 'in_stock', label: 'In stock', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'on_order', label: 'On order', cls: 'bg-amber-100 text-amber-800' },
  { value: 'out_of_stock', label: 'Out of stock', cls: 'bg-rose-100 text-rose-700' },
];
export const availabilityInfo = (v) => AVAILABILITY.find((a) => a.value === v) || AVAILABILITY[0];
export const BLANK_ITEM = { name: '', brand: '', code: '', category: '', unit: 'pcs', price: '', currency: 'RWF', availability: 'in_stock', lead_time: '', notes: '' };

// "12,500" / "12 500" / "12500.50" -> 12500.5 ; '' when not a number.
export function toNumber(v) {
  const n = Number(String(v ?? '').replace(/[\s,]/g, ''));
  return String(v ?? '').trim() === '' || !Number.isFinite(n) ? '' : n;
}

// Rows pasted from Excel / Google Sheets / WhatsApp: one item per line,
// columns separated by tabs (or ; or |): Name, Price, Unit, Brand.
export function parsePasted(text, currency = 'RWF') {
  return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const cols = line.split(/\t|;|\|/).map((c) => c.trim());
    let [name, price, unit, brand] = cols;
    if (cols.length === 1) { // "Cable 2.5mm 45000" -> last number is the price
      const m = line.match(/^(.*?)[\s:–-]+([\d][\d\s,.]*)\s*([A-Za-z²]*)$/);
      if (m) { name = m[1]; price = m[2]; unit = m[3]; }
    }
    return { ...BLANK_ITEM, name: name || '', price: toNumber(price), unit: unit || 'pcs', brand: brand || '', currency };
  }).filter((r) => r.name);
}

// Same item at different vendors: compare on a simplified name.
export const itemKey = (it) => `${String(it.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${String(it.unit || '').toLowerCase()}|${it.currency || ''}`;
