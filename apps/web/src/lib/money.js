// Money formatting for RUNHTec (Rwanda & Uganda). Rwanda Francs by default.
export const DEFAULT_CURRENCY = 'RWF';
export const DEFAULT_TAX_RATE = 18; // VAT: 18% in both Rwanda and Uganda

export const CURRENCIES = [
  { value: 'RWF', label: 'RWF — Rwandan Franc' },
  { value: 'UGX', label: 'UGX — Ugandan Shilling' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'KES', label: 'KES — Kenyan Shilling' },
  { value: 'TZS', label: 'TZS — Tanzanian Shilling' },
];

// Currencies normally written without decimals
const WHOLE = new Set(['RWF', 'UGX', 'KES', 'TZS']);

export function formatMoney(amount, currency = DEFAULT_CURRENCY) {
  const code = currency || DEFAULT_CURRENCY;
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'code',
      minimumFractionDigits: WHOLE.has(code) ? 0 : 2,
      maximumFractionDigits: WHOLE.has(code) ? 0 : 2,
    }).format(n).replace(/ /g, ' ');
  } catch (_) {
    return `${code} ${n.toLocaleString('en-US')}`;
  }
}

// Short form for dashboards: RWF 1.2M, RWF 450K
export function formatMoneyShort(amount, currency = DEFAULT_CURRENCY) {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${currency} ${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${currency} ${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${currency} ${(n / 1e3).toFixed(0)}K`;
  return formatMoney(n, currency);
}
