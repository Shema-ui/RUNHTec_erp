import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tags, Truck, AlertTriangle } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { loadCatalog, searchCatalog, catalogCategoryLabel } from '@/lib/catalog';
import { loadVendorOffers, searchVendorItems, offerFor } from '@/lib/vendorPricing';

/**
 * The description box on a quotation/invoice line. As you type, matching items
 * appear underneath: first from Items & Prices, then from the vendors' price
 * lists (buying price + our markup, converted to the quotation's currency).
 * Picking one fills the line. You can still type anything that isn't listed.
 * Vendor suggestions only appear for staff allowed to see buying prices.
 */
export default function CatalogItemInput({ value, onChange, onPick, className, currency = 'RWF', placeholder = 'Type to search the price lists, or describe the item' }) {
  const [items, setItems] = useState([]);
  const [vendor, setVendor] = useState({ items: [], markup: 30, rates: {} });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  useEffect(() => { loadCatalog().then(setItems); loadVendorOffers().then(setVendor); }, []);

  const own = open ? searchCatalog(items, value, 6) : [];
  const offers = open
    ? searchVendorItems(vendor.items, value, 12).map((v) => offerFor(v, currency, vendor)).sort((a, b) => (a.missingRate ? 1 : 0) - (b.missingRate ? 1 : 0) || (a.buy ?? 0) - (b.buy ?? 0)).slice(0, 8)
    : [];
  // One list for the keyboard: own items first, then vendor offers that can be priced.
  const choices = [...own.map((m) => ({ kind: 'own', m })), ...offers.filter((o) => !o.missingRate).map((o) => ({ kind: 'vendor', o }))];
  const shown = own.length + offers.length;
  // Same item from several vendors: mark the cheapest.
  const best = {};
  offers.filter((o) => !o.missingRate).forEach((o) => { const k = String(o.name).toLowerCase(); best[k] = best[k] ? { n: best[k].n + 1, min: Math.min(best[k].min, o.buy) } : { n: 1, min: o.buy }; });

  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 400) });
  };
  useEffect(() => {
    if (!open) return undefined;
    place();
    const h = () => place();
    window.addEventListener('scroll', h, true);
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); };
  }, [open]);

  const pick = (c) => {
    if (c.kind === 'own') onPick(c.m);
    else {
      const o = c.o;
      onPick({
        name: o.brand && !String(o.name).toLowerCase().includes(String(o.brand).toLowerCase()) ? `${o.name} (${o.brand})` : o.name,
        unit: o.unit,
        selling_price: o.sell,
        buying_price: o.buy,
        vendor_item: o.id,
        cost_source: o.cost_source,
      });
    }
    setOpen(false);
  };
  const idxOf = (kind, id) => choices.findIndex((c) => (c.kind === kind) && (kind === 'own' ? c.m.id === id : c.o.id === id));

  return (
    <>
      <input
        ref={ref}
        className={className}
        value={value}
        placeholder={placeholder}
        aria-label="Item description"
        autoComplete="off"
        onFocus={() => { setOpen(true); setActive(0); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={(e) => {
          if (!choices.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, choices.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); pick(choices[active]); }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && shown > 0 && pos && createPortal(
        <div role="listbox" className="fixed z-[60] max-h-80 overflow-y-auto rounded-lg border border-border bg-white py-1 shadow-xl" style={{ left: pos.left, top: pos.top, width: pos.width }}>
          {own.length > 0 && <p className="flex items-center gap-1 px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Tags className="h-3 w-3" /> From Items &amp; Prices</p>}
          {own.map((m) => {
            const i = idxOf('own', m.id);
            return (
              <button key={m.id} type="button" role="option" aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(choices[i]); }} onMouseEnter={() => setActive(i)}
                className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm ${i === active ? 'bg-secondary' : ''}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[m.code, m.brand, catalogCategoryLabel(m.category)].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="shrink-0 text-right font-semibold">{formatMoney(m.selling_price, m.currency)}<span className="block text-[11px] font-normal text-muted-foreground">per {m.unit || 'unit'}</span></span>
              </button>
            );
          })}
          {offers.length > 0 && (
            <p className={`flex items-center gap-1 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${own.length ? 'mt-1 border-t border-border' : ''}`}>
              <Truck className="h-3 w-3" /> From vendors · buying price → your price (+{vendor.markup}%)
            </p>
          )}
          {offers.map((o) => {
            if (o.missingRate) {
              return (
                <div key={o.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm opacity-70">
                  <span className="min-w-0"><span className="block truncate font-medium">{o.name}</span><span className="block truncate text-xs text-muted-foreground">{o.vendor_name}</span></span>
                  <span className="shrink-0 text-right text-[11px] text-amber-700"><AlertTriangle className="mr-0.5 inline h-3 w-3" />{formatMoney(o.price, o.currency)}<span className="block">Set the {o.missingRate} rate in Settings</span></span>
                </div>
              );
            }
            const i = idxOf('vendor', o.id);
            const b = best[String(o.name).toLowerCase()];
            const cheapest = b && b.n > 1 && o.buy === b.min;
            return (
              <button key={o.id} type="button" role="option" aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(choices[i]); }} onMouseEnter={() => setActive(i)}
                className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm ${i === active ? 'bg-secondary' : ''}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{o.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {o.vendor_name}{cheapest ? ' · cheapest' : ''}{o.availability === 'out_of_stock' ? ' · out of stock' : o.availability === 'on_order' ? ' · on order' : ''}
                    {(o.currency || 'RWF') !== currency ? ` · ${formatMoney(o.price, o.currency)}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[11px] text-muted-foreground">Buy {formatMoney(o.buy, currency)}</span>
                  <span className="block font-semibold text-emerald-700">You {formatMoney(o.sell, currency)}</span>
                  <span className="block text-[11px] text-muted-foreground">per {o.unit || 'unit'}</span>
                </span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
