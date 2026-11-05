// Solar kit builder — no AI, fixed rules (the same as the website's Power Planner).
//
// From a client's load (peak power, daily energy, energy needed during backup)
// it sizes the inverter, battery bank and solar panels, picks the cheapest
// matching items from the vendors' price lists, adds the markup, and returns
// quotation lines. Anything it can't price is added at 0 and listed in
// `missing`, so a person checks the draft before it is sent.
//
// All the numbers below can be changed in Settings → Solar kit builder.

const pool = require('./db');
const { genId } = require('./idGen');
const { nextNumber } = require('./jobs');

const DEFAULTS = {
  enabled: true,
  psh: 4.5,               // peak sun hours per day (Kigali)
  performance: 0.75,      // real output vs panel rating (heat, dust, cables, inverter)
  dod: 0.9,               // usable share of a lithium battery
  inverter_eff: 0.92,
  headroom: 1.25,         // inverter size above the peak load
  three_phase_above_kw: 12,
  default_panel_w: 550,
  // Extra lines for every solar kit. per: 'panel' | 'kwp' | 'fixed'. price = your selling price, cost = your cost (company currency).
  extras: [
    { label: 'Panel mounting structure, rails and clamps', per: 'panel', price: 35000, cost: 25000 },
    { label: 'DC & AC cables, breakers, surge protection and isolators', per: 'kwp', price: 150000, cost: 110000 },
    { label: 'Earthing system', per: 'fixed', price: 200000, cost: 140000 },
    { label: 'Installation, testing and commissioning', per: 'kwp', price: 150000, cost: 90000 },
    { label: 'Transport', per: 'fixed', price: 100000, cost: 60000 },
  ],
};
const WHOLE = new Set(['RWF', 'UGX', 'KES', 'TZS']);
const n = (v) => Number(v) || 0;

function settingsFrom(cfgRow) {
  let raw = cfgRow?.solar_kit;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = null; } }
  const s = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!Array.isArray(s.extras)) s.extras = DEFAULTS.extras;
  return s;
}

// ---- Reading vendor item names -------------------------------------------
const num = (re, s) => { const m = String(s).match(re); return m ? parseFloat(m[1]) : null; };
function voltageType(name) {
  if (/low[\s-]*vol|\b48\s*v\b|-L(-|\b)/i.test(name)) return 'LV';
  if (/high[\s-]*vol|-H\b/i.test(name)) return 'HV';
  return '';
}
function phaseOf(name) {
  if (/three|3\s*-?ph|\b3p\b|EH3P|GR3P/i.test(name)) return 3;
  if (/single|1\s*-?ph|\b1p\b|EH1P|GR1P|EO1P/i.test(name)) return 1;
  return 0;
}
// Sort a vendor item into inverter / battery / panel, with its size.
function classify(it) {
  const name = String(it.name || '');
  const isInv = /inverter/i.test(name);
  const kwh = num(/(\d+(?:\.\d+)?)\s*kwh/i, name);
  if (isInv && /hybrid|energy storage|storage inverter|off[\s-]*grid/i.test(name) && !/battery cabinet|with \d+\s*kwh/i.test(name)) {
    const kw = num(/(\d+(?:\.\d+)?)\s*kw(?!h)/i, name);
    if (kw) return { kind: 'inverter', kw, phase: phaseOf(name), volt: voltageType(name), offgrid: /off[\s-]*grid/i.test(name) };
  }
  if (!isInv && kwh && /batter|lifepo|lithium|\bess\b|storage/i.test(name)) return { kind: 'battery', kwh, volt: voltageType(name) };
  const w = num(/(\d{3,4})\s*w(?:p)?\b/i, name);
  if (!isInv && w && /panel|module|\bpv\b|solar/i.test(name) && !/inverter|battery|light|pump|fan/i.test(name)) return { kind: 'panel', w };
  return null;
}

// ---- Money ----------------------------------------------------------------
function convert(amount, from, to, rates) {
  const f = from || 'RWF'; const t = to || 'RWF';
  if (f === t) return n(amount);
  const a = f === 'RWF' ? 1 : n(rates?.[f]); const b = t === 'RWF' ? 1 : n(rates?.[t]);
  if (!a || !b) return null;
  return n(amount) * a / b;
}
const roundUp = (v, cur) => (WHOLE.has(cur) ? Math.ceil(v / 100) * 100 : Math.ceil(v * 100) / 100);
const roundCost = (v, cur) => (WHOLE.has(cur) ? Math.round(v) : Math.round(v * 100) / 100);
const fmt = (v, cur) => `${cur} ${n(v).toLocaleString('en-US', { maximumFractionDigits: WHOLE.has(cur) ? 0 : 2 })}`;

// ---- Sizing ----------------------------------------------------------------
function size(load, s) {
  const peakW = n(load.peakW);
  const dailyWh = n(load.dailyWh);
  const hours = n(load.hours);
  const backupWh = n(load.backupWh) || (hours && dailyWh ? Math.min(dailyWh, peakW * 0.5 * hours) : 0);
  const motorW = n(load.maxMotorW);
  const surgeW = peakW + 2 * motorW;
  const inverterKw = Math.max(peakW * s.headroom, surgeW / 2) / 1000;
  const batteryKwh = backupWh / s.inverter_eff / s.dod / 1000;
  const solarKwp = load.solar === false ? 0 : dailyWh / (s.psh * s.performance) / 1000;
  return { peakW, dailyWh, hours, backupWh, motorW, inverterKw, batteryKwh, solarKwp, phase: inverterKw > s.three_phase_above_kw ? 3 : 1 };
}

/**
 * Build the kit. `offers` are vendor_items rows (with vendor_name);
 * returns { sizing, lines, missing, notes }.
 */
function buildKit(load, { offers, rates, markup, currency, settings }) {
  const s = settings;
  const sz = size(load, s);
  const priced = [];
  for (const it of offers) {
    if (!(n(it.price) > 0)) continue;
    const c = classify(it);
    if (!c) continue;
    const cost = convert(it.price, it.currency, currency, rates);
    if (cost === null) continue; // no exchange rate for this currency
    priced.push({ ...it, ...c, unitCost: cost });
  }
  const line = (description, qty, unit, unitCost, extra = {}) => {
    const cost = roundCost(unitCost, currency);
    const price = roundUp(unitCost * (1 + markup / 100), currency);
    return { id: genId(), description, quantity: qty, unit, unit_price: price, list_price: price, amount: Math.round(qty * price * 100) / 100, cost, ...extra };
  };
  const vendorLine = (it, qty, label) => line(label || it.name, qty, it.unit || 'pcs', it.unitCost, {
    vendor_item: it.id, cost_source: `${it.vendor_name}: ${fmt(it.price, it.currency || 'RWF')} + ${markup}%`,
  });
  const placeholder = (description, qty, unit) => ({ id: genId(), description: `${description} — price to confirm`, quantity: qty, unit, unit_price: 0, list_price: 0, amount: 0, cost: 0 });
  const lines = []; const missing = [];

  // 1. Inverter: the cheapest one big enough, same phase when we know it (hybrid preferred over off-grid).
  // …but not absurdly big (e.g. a 100 kW unit for a house).
  const invs = priced.filter((x) => x.kind === 'inverter' && x.kw >= sz.inverterKw - 0.01 && x.kw <= Math.max(sz.inverterKw * 2.5, sz.inverterKw + 10) && (!x.phase || x.phase === sz.phase));
  invs.sort((a, b) => (a.offgrid - b.offgrid) || (a.unitCost - b.unitCost));
  const inv = invs[0];
  if (inv) lines.push(vendorLine(inv, 1));
  else {
    lines.push(placeholder(`Hybrid inverter, at least ${sz.inverterKw.toFixed(1)} kW, ${sz.phase === 3 ? 'three' : 'single'} phase`, 1, 'pcs'));
    missing.push(`inverter (${sz.inverterKw.toFixed(1)} kW)`);
  }

  // 2. Batteries: the cheapest combination of one model that reaches the capacity (matching the inverter's battery voltage).
  if (sz.batteryKwh > 0) {
    let best = null;
    for (const b of priced.filter((x) => x.kind === 'battery' && (!inv?.volt || !x.volt || x.volt === inv.volt))) {
      const qty = Math.max(1, Math.ceil(sz.batteryKwh / b.kwh - 1e-9));
      if (qty > 16) continue;
      // Skip units far bigger than needed (e.g. a 100 kWh commercial cabinet for a home).
      if (qty === 1 && b.kwh > Math.max(sz.batteryKwh * 2, sz.batteryKwh + 10)) continue;
      const total = qty * b.unitCost;
      if (!best || total < best.total) best = { b, qty, total };
    }
    if (best) lines.push(vendorLine(best.b, best.qty));
    else {
      lines.push(placeholder(`Lithium (LiFePO4) battery bank, ${sz.batteryKwh.toFixed(1)} kWh${inv?.volt === 'HV' ? ' high-voltage' : inv?.volt === 'LV' ? ' low-voltage (48 V)' : ''}`, 1, 'set'));
      missing.push(`battery (${sz.batteryKwh.toFixed(1)} kWh)`);
    }
  }

  // 3. Solar panels: the lowest price per watt.
  let panels = 0; let kwp = 0;
  if (sz.solarKwp > 0) {
    const ps = priced.filter((x) => x.kind === 'panel').sort((a, b) => a.unitCost / a.w - b.unitCost / b.w);
    const p = ps[0];
    const w = p ? p.w : s.default_panel_w;
    panels = Math.max(1, Math.ceil((sz.solarKwp * 1000) / w - 1e-9));
    kwp = Math.round((panels * w) / 100) / 10;
    if (p) lines.push(vendorLine(p, panels));
    else {
      lines.push(placeholder(`Solar panel ${w} W monocrystalline`, panels, 'pcs'));
      missing.push(`solar panels (${panels} × ${w} W)`);
    }
  }

  // 4. Extra lines from Settings (mounting, cables, installation…), in the company currency.
  for (const e of s.extras || []) {
    if (!e || !String(e.label || '').trim()) continue;
    let qty = 1; let unit = 'lot';
    if (e.per === 'panel') { if (!panels) continue; qty = panels; unit = 'pcs'; }
    if (e.per === 'kwp') { if (!kwp) continue; qty = kwp; unit = 'kWp'; }
    const price = convert(n(e.price), s.extras_currency || 'RWF', currency, rates);
    const cost = convert(n(e.cost), s.extras_currency || 'RWF', currency, rates);
    if (price === null) continue;
    const p = roundUp(price, currency);
    lines.push({ id: genId(), description: String(e.label).trim(), quantity: qty, unit, unit_price: p, list_price: p, amount: Math.round(qty * p * 100) / 100, cost: roundCost(cost || 0, currency) });
  }

  const notes = [
    'System sized from the load details you provided:',
    `• Peak load ${(sz.peakW / 1000).toFixed(2)} kW${sz.motorW ? ` (largest motor ${(sz.motorW / 1000).toFixed(2)} kW)` : ''}`,
    `• Daily energy ${(sz.dailyWh / 1000).toFixed(1)} kWh${sz.hours ? `, ${sz.hours} hours of backup` : ''}`,
    `• Inverter at least ${sz.inverterKw.toFixed(1)} kW${sz.batteryKwh ? `, battery about ${sz.batteryKwh.toFixed(1)} kWh` : ''}${kwp ? `, solar about ${kwp} kWp (${panels} panels)` : ''}`,
    'Final sizing and price are confirmed after a free site visit.',
  ].join('\n');
  return { sizing: { ...sz, panels, kwp }, lines, missing, notes };
}

// ---- Loading data and saving a draft quotation -----------------------------
async function loadContext() {
  const [cfgRows] = await pool.query('SELECT * FROM company_settings LIMIT 1');
  const cfg = cfgRows[0] || {};
  let rates = cfg.exchange_rates;
  if (typeof rates === 'string') { try { rates = JSON.parse(rates); } catch { rates = {}; } }
  const [offers] = await pool.query(
    "SELECT vi.*, v.name AS vendor_name FROM vendor_items vi JOIN vendors v ON v.id = vi.vendor WHERE v.status <> 'inactive' AND vi.price > 0"
  );
  const markup = cfg.vendor_markup === null || cfg.vendor_markup === undefined ? 30 : n(cfg.vendor_markup);
  return { cfg, offers, rates: rates || {}, markup, currency: cfg.currency || 'RWF', settings: settingsFrom(cfg) };
}

async function createDraftQuote({ load, rfq = null, client = null, billTo = {}, force = false }) {
  const ctx = await loadContext();
  // Automatic quotes from the website can be switched off in Settings; the ERP page always works.
  if (ctx.settings.enabled === false && !force) return null;
  const kit = buildKit(load, ctx);
  const subtotal = Math.round(kit.lines.reduce((t, l) => t + n(l.amount), 0) * 100) / 100;
  const taxRate = 18;
  const tax = Math.round(subtotal * taxRate) / 100;
  const id = genId();
  const number = await nextNumber('quotations', 'number', 'Q');
  const valid = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  await pool.query(
    `INSERT INTO quotations (id, rfq, client, number, items, subtotal, tax_rate, tax_amount, discount_amount, total, currency, notes, terms_conditions, status, valid_until,
      bill_to_name, bill_to_company, bill_to_address, bill_to_email, bill_to_phone, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, rfq, client, number, JSON.stringify(kit.lines), subtotal, taxRate, tax, Math.round((subtotal + tax) * 100) / 100, ctx.currency,
      kit.notes, ctx.cfg.default_terms_conditions || '', valid,
      billTo.name || '', billTo.company || '', billTo.address || '', billTo.email || '', billTo.phone || '']
  );
  return { id, number, kit, total: subtotal + tax, currency: ctx.currency };
}

// ---- Reading the website's Power Planner data -------------------------------
// Prefer the structured numbers the planner sends; fall back to its text summary.
function loadFromPayload(payload) {
  const p = payload && typeof payload.planner === 'object' ? payload.planner : null;
  if (p && n(p.peakW) > 0) {
    return { peakW: Math.min(n(p.peakW), 2e6), dailyWh: Math.min(n(p.dailyWh), 5e7), backupWh: Math.min(n(p.backupWh), 5e7), hours: Math.min(n(p.hours), 72), maxMotorW: Math.min(n(p.maxMotorW), 2e5), solar: p.solar !== false };
  }
  const text = String(payload?.message || '');
  if (!/Power Planner estimate/i.test(text)) return null;
  const peak = num(/Peak load\s+([\d.,]+)\s*kW/i, text.replace(/,(?=\d{3})/g, ''));
  const daily = num(/daily energy\s+([\d.,]+)\s*kWh/i, text.replace(/,(?=\d{3})/g, ''));
  const hours = num(/backup\s+([\d.]+)\s*h/i, text);
  if (!peak) return null;
  return { peakW: peak * 1000, dailyWh: (daily || 0) * 1000, hours: hours || 0, backupWh: 0, maxMotorW: 0, solar: /kWp solar/i.test(text) };
}

module.exports = { DEFAULTS, buildKit, size, classify, createDraftQuote, loadContext, loadFromPayload, settingsFrom };
