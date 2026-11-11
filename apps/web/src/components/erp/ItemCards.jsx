import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import CatalogItemInput from '@/components/erp/CatalogItemInput';

// Quotation / invoice lines on a PHONE: one card per item with large boxes and
// the number keypad. (Computers keep the table.) Used by QuotationFormPage and
// InvoiceFormPage.
const big = 'h-12 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-primary/30';
const numProps = { type: 'number', inputMode: 'decimal', min: '0', step: 'any', onFocus: (e) => e.target.select() };

export default function ItemCards({ items, updateItem, removeItem, pickCatalogItem, addItem, showCosts, currency, fmt }) {
  return (
    <div className="space-y-3 md:hidden">
      {items.map((item, idx) => (
        <div key={item.id} className="rounded-xl border border-border bg-background/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Item {idx + 1}</span>
            <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1} aria-label={`Remove item ${idx + 1}`}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-30">
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          </div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Description</label>
          <CatalogItemInput className={big} value={item.description} onChange={(v) => updateItem(idx, 'description', v)} onPick={(c) => pickCatalogItem(idx, c)} currency={currency} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Quantity</label>
              <input {...numProps} className={`${big} text-right`} value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} aria-label={`Quantity, item ${idx + 1}`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Unit price</label>
              <input {...numProps} className={`${big} text-right`} value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} aria-label={`Unit price, item ${idx + 1}`} />
            </div>
          </div>
          {Number(item.list_price) > 0 && Number(item.unit_price) < Number(item.list_price) - 0.5 && (
            <p className="mt-1 text-xs font-medium text-amber-700">⚠ Below list price ({fmt(item.list_price, currency)})</p>
          )}
          {showCosts && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold text-amber-700">Our buying price per unit 🔒 (never shown to the client)</label>
              <input {...numProps} className={`${big} border-amber-300 bg-amber-50/60 text-right`} value={item.cost ?? 0} onChange={(e) => updateItem(idx, 'cost', e.target.value)} aria-label={`Buying price, item ${idx + 1}`} />
              <div className="mt-1 flex justify-between gap-2 text-[11px]">
                <span className="truncate text-muted-foreground">{item.cost_source ? `🚚 ${item.cost_source}` : ''}</span>
                {Number(item.cost) > 0 && Number(item.unit_price) > 0 && (
                  <span className={Number(item.unit_price) > Number(item.cost) ? 'text-emerald-700' : 'text-rose-600'}>{Math.round(((Number(item.unit_price) - Number(item.cost)) / Number(item.unit_price)) * 100)}% margin</span>
                )}
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
            <span className="text-sm text-muted-foreground">Amount</span>
            <span className="text-base font-bold">{fmt(item.amount, currency)}</span>
          </div>
        </div>
      ))}
      <button type="button" onClick={addItem} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 text-sm font-semibold text-primary">
        <Plus className="h-5 w-5" /> Add item
      </button>
    </div>
  );
}

// Discount and VAT boxes, phone-friendly (used under the items on both forms).
export function TotalsInputs({ discount, taxRate, onDiscount, onTax }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:hidden">
      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Discount</label>
        <input {...numProps} className={`${big} text-right`} value={discount} onChange={(e) => onDiscount(e.target.value)} aria-label="Discount amount" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">VAT / Tax %</label>
        <input {...numProps} max="100" className={`${big} text-right`} value={taxRate} onChange={(e) => onTax(e.target.value)} aria-label="VAT percent" />
      </div>
    </div>
  );
}
