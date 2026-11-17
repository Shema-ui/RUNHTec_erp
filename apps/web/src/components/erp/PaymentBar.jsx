import React from 'react';
import { formatMoney, DEFAULT_CURRENCY } from '@/lib/money';

// How far an invoice is paid: a coloured bar plus the amount still owed.
// Grey = nothing paid yet, blue = part paid, green = fully paid, amber = overpaid.
export function paymentLevel(total, paid) {
  const t = Number(total) || 0;
  const p = Number(paid) || 0;
  const pct = t > 0 ? Math.min(100, Math.max(0, (p / t) * 100)) : 0;
  const remaining = Math.max(0, t - p);
  const over = Math.max(0, p - t);
  let tone = 'none';
  if (over > 0.5) tone = 'over';
  else if (t > 0 && remaining < 0.5) tone = 'paid';
  else if (p > 0) tone = 'partial';
  return { pct, remaining, over, tone };
}

const BAR = { none: 'bg-slate-300', partial: 'bg-blue-600', paid: 'bg-emerald-500', over: 'bg-amber-500' };

export default function PaymentBar({ total, paid, currency = DEFAULT_CURRENCY, label, compact = false }) {
  const { pct, remaining, over, tone } = paymentLevel(total, paid);
  const fmt = (v) => formatMoney(v, currency);
  return (
    <div className={compact ? 'min-w-[140px]' : ''}>
      {label && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>}
      <div className={`flex items-baseline justify-between gap-2 ${compact ? 'text-[11px]' : 'text-xs'} text-muted-foreground`}>
        <span>Paid {fmt(paid || 0)} of {fmt(total || 0)}</span>
        <span className="font-semibold text-foreground">{Math.round(pct)}%</span>
      </div>
      <div className={`mt-1 w-full overflow-hidden rounded-full bg-secondary ${compact ? 'h-2' : 'h-3'}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className={`h-full rounded-full transition-all duration-300 ${BAR[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`mt-1 ${compact ? 'text-[11px]' : 'text-sm'}`}>
        {tone === 'paid' && <strong className="text-emerald-700">Fully paid</strong>}
        {tone === 'over' && <>Overpaid by <strong className="text-amber-700">{fmt(over)}</strong></>}
        {(tone === 'none' || tone === 'partial') && <>Remaining <strong className={compact ? '' : 'text-foreground'}>{fmt(remaining)}</strong></>}
      </p>
    </div>
  );
}
