import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Plus, Trash2, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import {
  LABOUR_ROLES, COST_CATEGORIES, labourRole, normalizeCosting, computeCosting, marginTone, rid,
} from '@/lib/costing';

const cell = 'w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary';
const num = `${cell} text-right`;

export function InternalBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      <Lock className="h-3 w-3" /> Internal — client never sees this
    </span>
  );
}

// Editable internal costing for a quote or invoice.
export default function CostingPanel({ items, costing, onChange, subtotal, discount, currency }) {
  const c = normalizeCosting(costing);
  const r = computeCosting({ items, costing: c, subtotal, discount });
  const set = (patch) => onChange({ ...c, ...patch });
  const setLabour = (i, k, v) => {
    const labour = c.labour.map((l, j) => {
      if (j !== i) return l;
      const next = { ...l, [k]: v };
      if (k === 'role') next.rate = labourRole(v).rate;
      return next;
    });
    set({ labour });
  };
  const setExp = (i, k, v) => set({ expenses: c.expenses.map((e, j) => (j === i ? { ...e, [k]: v } : e)) });

  return (
    <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-5 shadow-sm print:hidden" data-internal="costing">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="font-display text-sm font-bold text-foreground">Costing &amp; profit</h3>
        <InternalBadge />
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Enter what each item costs us in the “Our buying price” column above, then estimate the work below.
        Nothing in this box is printed, put in the PDF or shown to the client.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Technician wages (estimate)</h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-muted-foreground">
                  <th className="pb-1">Role</th><th className="w-16 pb-1 text-right">People</th><th className="w-16 pb-1 text-right">Days</th><th className="w-24 pb-1 text-right">Rate / day</th><th className="w-24 pb-1 text-right">Total</th><th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {c.labour.map((l, i) => (
                  <tr key={l.id}>
                    <td className="py-1 pr-1">
                      <select className={cell} value={l.role} onChange={(e) => setLabour(i, 'role', e.target.value)} aria-label="Role">
                        {LABOUR_ROLES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                    </td>
                    <td className="p-1"><input type="number" min="0" className={num} value={l.people} onChange={(e) => setLabour(i, 'people', e.target.value)} aria-label="People" /></td>
                    <td className="p-1"><input type="number" min="0" step="0.5" className={num} value={l.days} onChange={(e) => setLabour(i, 'days', e.target.value)} aria-label="Days" /></td>
                    <td className="p-1"><input type="number" min="0" className={num} value={l.rate} onChange={(e) => setLabour(i, 'rate', e.target.value)} aria-label="Rate per day" /></td>
                    <td className="p-1 text-right font-medium">{formatMoney((Number(l.people) || 0) * (Number(l.rate) || 0) * (Number(l.days) || 0), currency)}</td>
                    <td className="p-1"><button type="button" onClick={() => set({ labour: c.labour.filter((_, j) => j !== i) })} className="rounded p-1 text-muted-foreground hover:text-rose-600" aria-label="Remove wage line"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => set({ labour: [...c.labour, { id: rid(), role: 'technician', people: 1, rate: labourRole('technician').rate, days: 1 }] })} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Plus className="h-4 w-4" /> Add wage line</button>

          <h4 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transport &amp; other costs (estimate)</h4>
          <div className="space-y-2">
            {c.expenses.map((e, i) => (
              <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_110px_32px] gap-1.5">
                <select className={cell} value={e.category} onChange={(ev) => setExp(i, 'category', ev.target.value)} aria-label="Cost type">
                  {COST_CATEGORIES.filter((x) => !['materials', 'labour'].includes(x.value)).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
                <input className={cell} value={e.label} onChange={(ev) => setExp(i, 'label', ev.target.value)} placeholder="e.g. Fuel, 3 trips" aria-label="Description" />
                <input type="number" min="0" className={num} value={e.amount} onChange={(ev) => setExp(i, 'amount', ev.target.value)} aria-label="Amount" />
                <button type="button" onClick={() => set({ expenses: c.expenses.filter((_, j) => j !== i) })} className="rounded p-1 text-muted-foreground hover:text-rose-600" aria-label="Remove cost"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => set({ expenses: [...c.expenses, { id: rid(), category: 'transport', label: '', amount: 0 }] })} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Plus className="h-4 w-4" /> Add cost</button>

          <label className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            Safety margin for extra days / trips
            <input type="number" min="0" max="100" className="w-16 rounded-md border border-border bg-background px-2 py-1 text-right text-sm" value={c.contingency_pct} onChange={(e) => set({ contingency_pct: e.target.value })} aria-label="Contingency percent" />%
            <span className="text-xs text-muted-foreground">of wages + transport/other</span>
          </label>
        </div>

        <ProfitBreakdown r={r} currency={currency} />
      </div>
    </div>
  );
}

export function ProfitBreakdown({ r, currency, title = 'Expected profit' }) {
  const Row = ({ label, value, strong, minus = true }) => (
    <div className={`flex justify-between gap-3 py-1.5 text-sm ${strong ? 'font-semibold' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{minus && value ? '− ' : ''}{formatMoney(value, currency)}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex justify-between gap-3 py-1.5 text-sm font-semibold"><span>Client pays (excl. VAT)</span><span>{formatMoney(r.revenue, currency)}</span></div>
      <div className="divide-y divide-border/60 border-y border-border/60">
        <Row label="Materials (our buying price)" value={r.materials} />
        <Row label={`Technician wages (${r.labourDays || 0} person-days)`} value={r.labour} />
        <Row label="Transport & other" value={r.expenses} />
        {r.contingency > 0 && <Row label="Safety margin" value={r.contingency} />}
      </div>
      <div className="flex justify-between gap-3 py-1.5 text-sm"><span className="text-muted-foreground">Total cost</span><span className="font-medium">{formatMoney(r.totalCost, currency)}</span></div>
      <div className={`mt-2 flex items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2.5 ${marginTone(r.margin)}`}>
        <span className="inline-flex items-center gap-1.5 font-display font-semibold"><TrendingUp className="h-4 w-4" /> {title}</span>
        <span className="text-right font-display text-lg font-bold">{formatMoney(r.profit, currency)}<span className="ml-1.5 text-xs font-semibold">({r.margin.toFixed(1)}%)</span></span>
      </div>
      {r.missingCost > 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {r.missingCost} item{r.missingCost === 1 ? ' has' : 's have'} no buying price yet, so profit looks higher than it really is.</p>
      )}
      {r.revenue > 0 && r.margin < 12 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Margin is below 12% — consider raising the price or cutting costs.</p>
      )}
    </div>
  );
}

// Read-only profit card for the quote / invoice view pages (on screen only).
export function InternalProfitCard({ doc, editTo, extra }) {
  if (!doc) return null;
  const items = Array.isArray(doc.items) ? doc.items : [];
  const hasData = Boolean(doc.costing) || items.some((i) => Number(i.cost) > 0);
  const r = computeCosting({ items, costing: doc.costing, subtotal: doc.subtotal, discount: doc.discount_amount });
  return (
    <div className="no-print mb-6 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-5 print:hidden" data-internal="profit">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-display text-sm font-bold text-foreground">Costing &amp; profit</h3>
        <InternalBadge />
        {editTo && <Link to={editTo} className="ml-auto text-sm font-medium text-primary hover:underline">Edit costs</Link>}
      </div>
      {hasData ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ProfitBreakdown r={r} currency={doc.currency} />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Wages estimate: <strong className="text-foreground">{r.labourDays} person-days</strong>, {formatMoney(r.labour, doc.currency)}.</p>
            <p>This is the plan. Once work starts, real wages and expenses are logged on the project, which shows the actual profit.</p>
            {extra}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No buying prices or job costs entered yet. Click “Edit costs” to add what each item costs us, the technicians’ days and transport, and the profit will be calculated here.</p>
      )}
    </div>
  );
}
