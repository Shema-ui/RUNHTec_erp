// Same defaults as the server (apps/server/src/solarKit.js). Editable in Settings → Solar kit builder.
export const SOLAR_KIT_DEFAULTS = {
  enabled: true,
  psh: 4.5,
  performance: 0.75,
  dod: 0.9,
  inverter_eff: 0.92,
  headroom: 1.25,
  three_phase_above_kw: 12,
  default_panel_w: 550,
  extras: [
    { label: 'Panel mounting structure, rails and clamps', per: 'panel', price: 35000, cost: 25000 },
    { label: 'DC & AC cables, breakers, surge protection and isolators', per: 'kwp', price: 150000, cost: 110000 },
    { label: 'Earthing system', per: 'fixed', price: 200000, cost: 140000 },
    { label: 'Installation, testing and commissioning', per: 'kwp', price: 150000, cost: 90000 },
    { label: 'Transport', per: 'fixed', price: 100000, cost: 60000 },
  ],
};
export const EXTRA_PER = [
  { value: 'fixed', label: 'Once per job' },
  { value: 'panel', label: 'Per solar panel' },
  { value: 'kwp', label: 'Per kWp of solar' },
];
export function solarKitFrom(raw) {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = null; } }
  const s = { ...SOLAR_KIT_DEFAULTS, ...(v && typeof v === 'object' ? v : {}) };
  if (!Array.isArray(s.extras)) s.extras = SOLAR_KIT_DEFAULTS.extras;
  return s;
}
// Reads the Power Planner summary the website puts in a request's description.
export function plannerFromText(text) {
  const t = String(text || '').replace(/,(?=\d{3})/g, '');
  if (!/Power Planner estimate/i.test(t)) return null;
  const f = (re) => { const m = t.match(re); return m ? parseFloat(m[1]) : null; };
  const peak = f(/Peak load\s+([\d.]+)\s*kW/i);
  if (!peak) return null;
  return { peakKw: peak, dailyKwh: f(/daily energy\s+([\d.]+)\s*kWh/i) || 0, hours: f(/backup\s+([\d.]+)\s*h/i) || 0, solar: /kWp solar/i.test(t),
    backupKwh: f(/backup energy\s+([\d.]+)\s*kWh/i) || '', motorW: f(/largest motor\s+([\d.]+)\s*W/i) || '' };
}
