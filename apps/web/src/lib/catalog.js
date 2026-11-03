import pb from '@/lib/pocketbaseClient';
import { SERVICE_CATEGORIES } from '@/lib/projects';

// Price-list categories follow RUNHTec's services, plus general groups.
export const CATALOG_CATEGORIES = [
  ...SERVICE_CATEGORIES.filter((c) => !['maintenance', 'other'].includes(c.value)),
  { value: 'materials', label: 'General materials & accessories' },
  { value: 'labour', label: 'Labour & services' },
  { value: 'transport', label: 'Transport & logistics' },
  { value: 'other', label: 'Other' },
];
export const catalogCategoryLabel = (v) => CATALOG_CATEGORIES.find((c) => c.value === v)?.label || 'Other';

export const UNITS = ['pcs', 'set', 'm', 'roll', 'kg', 'litre', 'box', 'pair', 'lot', 'job', 'day', 'hour', 'trip', 'm²', 'kVA', 'kW'];

export const canEditCatalog = (user) => ['super_admin', 'admin', 'sales'].includes(user?.role);

// The list is loaded once and shared by every quote/invoice line on the page.
let cache = null;
export function loadCatalog(force = false) {
  if (!cache || force) {
    cache = pb.collection('catalog_items').getFullList({ sort: 'name' })
      .then((list) => list.filter((i) => Number(i.active) !== 0))
      .catch(() => []);
  }
  return cache;
}
export const resetCatalogCache = () => { cache = null; };

// Simple search: every word typed must appear in the name, code, brand or category.
export function searchCatalog(items, text, limit = 8) {
  const words = String(text || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return items
    .filter((i) => {
      const hay = `${i.name} ${i.code} ${i.brand} ${catalogCategoryLabel(i.category)} ${i.description}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .slice(0, limit);
}
