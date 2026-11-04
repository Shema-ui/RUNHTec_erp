import React, { useState } from 'react';
import { Pencil, Trash2, Check, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { AVAILABILITY, availabilityInfo, toNumber } from '@/lib/vendors';
import { fmtDate } from '@/components/erp/kit';

// Price box that saves on its own when you leave it or press Enter.
function PriceInput({ item, onPatch }) {
  const [v, setV] = useState(String(Number(item.price) || 0));
  const [state, setState] = useState(''); // '', 'saving', 'saved', 'error'
  React.useEffect(() => { setV(String(Number(item.price) || 0)); }, [item.price]);
  const commit = async () => {
    const n = toNumber(v);
    if (n === '' ) { setV(String(Number(item.price) || 0)); return; }
    if (n === Number(item.price)) return;
    setState('saving');
    try { await onPatch(item.id, { price: n }); setState('saved'); setTimeout(() => setState(''), 1500); }
    catch (_) { setState('error'); }
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <input value={v} inputMode="decimal" onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label={`Price of ${item.name}`} className={`h-9 w-28 rounded-lg border bg-background px-2 text-right text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30 ${state === 'error' ? 'border-rose-400' : 'border-border'}`} />
      <span className="w-4">{state === 'saving' ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : state === 'saved' ? <Check className="h-4 w-4 text-emerald-600" /> : null}</span>
    </span>
  );
}

function Change({ item }) {
  if (item.previous_price === null || item.previous_price === undefined || item.previous_price === '') return null;
  const up = Number(item.price) > Number(item.previous_price);
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${up ? 'text-rose-600' : 'text-emerald-700'}`} title={`Was ${formatMoney(item.previous_price, item.currency)}${item.price_changed_at ? ` until ${fmtDate(item.price_changed_at)}` : ''}`}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />} was {formatMoney(item.previous_price, item.currency)}
    </span>
  );
}

// The price list. Price and availability can be changed right in the list.
export default function VendorItemsTable({ items, onPatch, onEdit, onDelete, showChange = false }) {
  const avail = (it) => (
    <select value={it.availability || 'in_stock'} onChange={(e) => Promise.resolve(onPatch(it.id, { availability: e.target.value })).catch(() => {})} aria-label={`Availability of ${it.name}`}
      className={`h-8 rounded-full border-0 px-2 text-xs font-semibold ${availabilityInfo(it.availability).cls}`}>
      {AVAILABILITY.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
    </select>
  );
  const actions = (it) => (
    <span className="flex items-center justify-end gap-1">
      <button onClick={() => onEdit(it)} aria-label={`Edit ${it.name}`} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-primary"><Pencil className="h-4 w-4" /></button>
      <button onClick={() => onDelete(it)} aria-label={`Remove ${it.name}`} className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
    </span>
  );
  return (
    <>
      {/* Computer: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Item</th><th className="py-2 pr-3">Per</th><th className="py-2 pr-3 text-right">Price</th><th className="py-2 pr-3">Availability</th><th className="py-2 pr-3">Updated</th><th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((it) => (
              <tr key={it.id} className="align-middle">
                <td className="py-2.5 pr-3">
                  <p className="font-medium">{it.name}</p>
                  <p className="text-xs text-muted-foreground">{[it.brand, it.code && `Code ${it.code}`, it.lead_time && `Delivery ${it.lead_time}`].filter(Boolean).join(' · ')}</p>
                </td>
                <td className="py-2.5 pr-3 text-muted-foreground">{it.unit}</td>
                <td className="py-2.5 pr-3 text-right">
                  <span className="inline-flex flex-col items-end gap-0.5"><span className="inline-flex items-center gap-1"><span className="text-xs text-muted-foreground">{it.currency}</span><PriceInput item={it} onPatch={onPatch} /></span>{showChange && <Change item={it} />}</span>
                </td>
                <td className="py-2.5 pr-3">{avail(it)}</td>
                <td className="py-2.5 pr-3 text-xs text-muted-foreground">{fmtDate(it.updated || it.created)}</td>
                <td className="py-2.5">{actions(it)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Phone: cards */}
      <ul className="space-y-3 md:hidden">
        {items.map((it) => (
          <li key={it.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="font-medium">{it.name}</p><p className="text-xs text-muted-foreground">{[it.brand, it.lead_time && `Delivery ${it.lead_time}`].filter(Boolean).join(' · ')}</p></div>
              {actions(it)}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-sm"><span className="text-xs text-muted-foreground">{it.currency}</span><PriceInput item={it} onPatch={onPatch} /><span className="text-xs text-muted-foreground">/ {it.unit}</span></span>
              {avail(it)}
            </div>
            {showChange && <div className="mt-1"><Change item={it} /></div>}
          </li>
        ))}
      </ul>
    </>
  );
}
