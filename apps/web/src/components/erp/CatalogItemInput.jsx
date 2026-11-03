import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tags } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { loadCatalog, searchCatalog, catalogCategoryLabel } from '@/lib/catalog';

/**
 * The description box on a quotation/invoice line. As you type, matching items
 * from the price list appear underneath; picking one fills the line. You can
 * still type anything that isn't in the list.
 */
export default function CatalogItemInput({ value, onChange, onPick, className, placeholder = 'Type to search the price list, or describe the item' }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  useEffect(() => { loadCatalog().then(setItems); }, []);

  const matches = open ? searchCatalog(items, value) : [];
  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 320) });
  };
  useEffect(() => {
    if (!open) return undefined;
    place();
    const h = () => place();
    window.addEventListener('scroll', h, true);
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); };
  }, [open]);

  const pick = (item) => { onPick(item); setOpen(false); };

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
          if (!matches.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); pick(matches[active]); }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && matches.length > 0 && pos && createPortal(
        <div role="listbox" className="fixed z-[60] max-h-72 overflow-y-auto rounded-lg border border-border bg-white py-1 shadow-xl" style={{ left: pos.left, top: pos.top, width: pos.width }}>
          <p className="flex items-center gap-1 px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Tags className="h-3 w-3" /> From the price list</p>
          {matches.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(m); }}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm ${i === active ? 'bg-secondary' : ''}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{m.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{[m.code, m.brand, catalogCategoryLabel(m.category)].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="shrink-0 text-right font-semibold">{formatMoney(m.selling_price, m.currency)}<span className="block text-[11px] font-normal text-muted-foreground">per {m.unit || 'unit'}</span></span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
