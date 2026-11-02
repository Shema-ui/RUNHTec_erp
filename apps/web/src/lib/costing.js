import pb from '@/lib/pocketbaseClient';

// Internal job costing: buying prices, labour, transport and other costs,
// and the profit they leave. Never printed or shown to clients — the server
// also strips these fields for roles that may not see them.

export const COST_ROLES = ['super_admin', 'sales', 'accountant', 'project_manager'];
export const canSeeCosts = (user) => COST_ROLES.includes(user?.role);
export const canRecordCosts = (user) => ['super_admin', 'accountant', 'project_manager'].includes(user?.role);


// Daily wages per role. These are only the starting values — the Super Admin
// changes them in Settings → Technician wages, and the saved list replaces this one.
export const DEFAULT_LABOUR_ROLES = [
  { value: 'lead', label: 'Lead technician', rate: 20000 },
  { value: 'technician', label: 'Technician', rate: 15000 },
  { value: 'helper', label: 'Assistant technician', rate: 12000 },
];
export const LABOUR_ROLES = DEFAULT_LABOUR_ROLES.map((r) => ({ ...r }));
export const COST_SETTINGS = { contingency: 10 };

export const labourRole = (v) => LABOUR_ROLES.find((r) => r.value === v)
  || (v ? { value: v, label: 'Worker', rate: 0 } : LABOUR_ROLES[0] || DEFAULT_LABOUR_ROLES[0]);

export function applyCostSettings(rec) {
  const list = Array.isArray(rec?.labour_rates) ? rec.labour_rates.filter((r) => r && r.value && r.label) : null;
  if (list && list.length) LABOUR_ROLES.splice(0, LABOUR_ROLES.length, ...list.map((r) => ({ value: r.value, label: r.label, rate: Number(r.rate) || 0 })));
  if (rec && rec.default_contingency !== undefined && rec.default_contingency !== null && rec.default_contingency !== '') COST_SETTINGS.contingency = Number(rec.default_contingency) || 0;
}

let loading = null;
export function loadCostSettings(force = false) {
  if (!loading || force) {
    loading = pb.collection('company_settings').getList(1, 1)
      .then((r) => applyCostSettings(r.items[0]))
      .catch(() => {});
  }
  return loading;
}

export const COST_CATEGORIES = [
  { value: 'materials', label: 'Materials & equipment' },
  { value: 'labour', label: 'Technician wages' },
  { value: 'transport', label: 'Transport & fuel' },
  { value: 'meals', label: 'Meals & accommodation' },
  { value: 'tools', label: 'Tools / equipment hire' },
  { value: 'subcontract', label: 'Subcontractor' },
  { value: 'fees', label: 'Permits, fees & charges' },
  { value: 'other', label: 'Other' },
];
export const costCategoryLabel = (v) => COST_CATEGORIES.find((c) => c.value === v)?.label || 'Other';


export const emptyCosting = () => ({
  labour: LABOUR_ROLES.slice(0, 2).map((r) => ({ id: rid(), role: r.value, people: 1, rate: r.rate, days: 1 })),
  expenses: [{ id: rid(), category: 'transport', label: 'Transport to site', amount: 0 }],
  contingency_pct: COST_SETTINGS.contingency,
});

export function rid() {
  return Math.random().toString(36).slice(2, 10);
}

const n = (v) => Number(v) || 0;

// Make sure a costing object loaded from the database has every part.
export function normalizeCosting(c) {
  if (!c || typeof c !== 'object') return emptyCosting();
  return {
    labour: Array.isArray(c.labour) ? c.labour.map((l) => ({ id: l.id || rid(), ...l })) : [],
    expenses: Array.isArray(c.expenses) ? c.expenses.map((e) => ({ id: e.id || rid(), ...e })) : [],
    contingency_pct: c.contingency_pct ?? COST_SETTINGS.contingency,
  };
}

// Revenue is what the client pays us for the work, WITHOUT VAT (VAT goes to RRA, it isn't income).
export function computeCosting({ items = [], costing, subtotal = 0, discount = 0 }) {
  const c = normalizeCosting(costing);
  const revenue = n(subtotal) - n(discount);
  const materials = items.reduce((s, i) => s + n(i.quantity) * n(i.cost), 0);
  const missingCost = items.filter((i) => (i.description || n(i.unit_price)) && !n(i.cost)).length;
  const labour = c.labour.reduce((s, l) => s + n(l.people) * n(l.rate) * n(l.days), 0);
  const labourDays = c.labour.reduce((s, l) => s + n(l.people) * n(l.days), 0);
  const expenses = c.expenses.reduce((s, e) => s + n(e.amount), 0);
  // Safety margin on the parts that are hard to predict (days, transport).
  const contingency = Math.round(((labour + expenses) * n(c.contingency_pct)) / 100);
  const totalCost = materials + labour + expenses + contingency;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { revenue, materials, labour, labourDays, expenses, contingency, totalCost, profit, margin, missingCost };
}

// Actual costs recorded on a project, grouped.
export function summarizeActual(costs = []) {
  const by = {};
  let total = 0;
  let labourDays = 0;
  let unpaid = 0;
  for (const c of costs) {
    const a = n(c.amount);
    by[c.category] = (by[c.category] || 0) + a;
    total += a;
    if (c.category === 'labour') labourDays += n(c.quantity);
    if (!c.paid) unpaid += a;
  }
  return { by, total, labourDays, unpaid };
}

export const marginTone = (m) => (m >= 25 ? 'text-emerald-700' : m >= 12 ? 'text-amber-700' : 'text-rose-700');
