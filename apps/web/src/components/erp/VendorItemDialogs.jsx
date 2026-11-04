import React, { useEffect, useState } from 'react';
import { Loader2, Save, Plus, Trash2, ClipboardPaste, Rows3 } from 'lucide-react';
import { Modal, Field, inputCls, textareaCls, btnPrimary, btnLine } from '@/components/erp/kit';
import { CURRENCIES } from '@/lib/money';
import { AVAILABILITY, BLANK_ITEM, UNITS, VENDOR_CATEGORIES, parsePasted, toNumber } from '@/lib/vendors';

// One item: add or edit. Used by the vendor portal and by staff on a vendor's page.
export function VendorItemDialog({ open, onClose, item, currency = 'RWF', onSave }) {
  const [f, setF] = useState(BLANK_ITEM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setF(item ? { ...BLANK_ITEM, ...item, price: item.price ?? '' } : { ...BLANK_ITEM, currency }); setErr(''); } }, [open]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (f.name.trim().length < 2) { setErr('Write the item name.'); return; }
    if (toNumber(f.price) === '') { setErr('Write the price (numbers only).'); return; }
    setBusy(true); setErr('');
    try { await onSave({ ...f, name: f.name.trim(), price: toNumber(f.price) }); onClose(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit item' : 'Add an item'} description="The price is what you charge RUNHTec for one unit.">
      <div className="space-y-4">
        <Field label="Item name" required><input className={inputCls} autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Solar panel 550W mono" aria-label="Item name" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand / model"><input className={inputCls} value={f.brand} onChange={(e) => set('brand', e.target.value)} placeholder="e.g. Jinko Tiger Neo" /></Field>
          <Field label="Your item code" hint="Optional, as on your invoices"><input className={inputCls} value={f.code} onChange={(e) => set('code', e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
          <Field label="Price" required><input className={inputCls} inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="0" aria-label="Price" /></Field>
          <Field label="Per">
            <select className={inputCls} value={f.unit} onChange={(e) => set('unit', e.target.value)}>{[...new Set([...UNITS, f.unit])].map((u) => <option key={u}>{u}</option>)}</select>
          </Field>
          <Field label="Currency">
            <select className={inputCls} value={f.currency} onChange={(e) => set('currency', e.target.value)}>{CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}</select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Availability">
            <select className={inputCls} value={f.availability} onChange={(e) => set('availability', e.target.value)}>{AVAILABILITY.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
          </Field>
          <Field label="Delivery time"><input className={inputCls} value={f.lead_time} onChange={(e) => set('lead_time', e.target.value)} placeholder="e.g. 3 days" /></Field>
          <Field label="Category">
            <select className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">Choose…</option>{VENDOR_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes"><textarea className={textareaCls} rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Warranty, minimum order, discount for quantity…" /></Field>
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {item ? 'Save changes' : 'Add item'}</button>
        </div>
      </div>
    </Modal>
  );
}

// Many items at once: type rows, or paste a list from Excel / WhatsApp.
export function VendorBulkDialog({ open, onClose, currency = 'RWF', onSave }) {
  const blank = () => ({ ...BLANK_ITEM, currency });
  const [rows, setRows] = useState([blank(), blank(), blank()]);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setRows([blank(), blank(), blank()]); setPaste(false); setText(''); setErr(''); } }, [open]);
  const setRow = (i, k, v) => setRows((list) => list.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const usePasted = () => {
    const parsed = parsePasted(text, currency);
    if (!parsed.length) { setErr('Nothing found. Put one item per line: name, then price.'); return; }
    setRows(parsed); setPaste(false); setErr('');
  };
  const filled = rows.filter((r) => r.name.trim());
  const save = async () => {
    if (!filled.length) { setErr('Fill in at least one item.'); return; }
    const bad = filled.find((r) => toNumber(r.price) === '');
    if (bad) { setErr(`Write the price of “${bad.name}”.`); return; }
    setBusy(true); setErr('');
    try { await onSave(filled.map((r) => ({ ...r, name: r.name.trim(), price: toNumber(r.price) }))); onClose(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} wide title="Add several items" description="Type one item per row, or paste your price list.">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button className={paste ? btnLine : btnPrimary} onClick={() => setPaste(false)}><Rows3 className="h-4 w-4" /> Type rows</button>
          <button className={paste ? btnPrimary : btnLine} onClick={() => setPaste(true)}><ClipboardPaste className="h-4 w-4" /> Paste a list</button>
        </div>
        {paste ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Copy the rows from Excel or Google Sheets (columns: <b>Name, Price, Unit, Brand</b>) and paste them here. A simple list also works, one per line like <i>“Cable 2.5mm 45000”</i>.</p>
            <textarea className={textareaCls} rows={8} value={text} onChange={(e) => setText(e.target.value)} aria-label="Pasted list" placeholder={'Solar panel 550W\t185000\tpcs\tJinko\nCable 6mm² red\t1200\tm'} />
            <button className={btnPrimary} onClick={usePasted}>Read the list</button>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_110px_90px_130px_36px] gap-2 px-1 text-[11px] font-semibold uppercase text-muted-foreground md:grid">
              <span>Item name</span><span>Brand / model</span><span>Price ({currency})</span><span>Per</span><span>Availability</span><span />
            </div>
            <div className="max-h-[50vh] space-y-3 overflow-y-auto md:space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_110px_90px_130px_36px] md:border-0 md:p-0">
                  <input className={`${inputCls} col-span-2 md:col-span-1`} value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} placeholder="Item name" aria-label={`Item ${i + 1} name`} />
                  <input className={`${inputCls} col-span-2 md:col-span-1`} value={r.brand} onChange={(e) => setRow(i, 'brand', e.target.value)} placeholder="Brand / model" aria-label={`Item ${i + 1} brand`} />
                  <input className={inputCls} inputMode="decimal" value={r.price} onChange={(e) => setRow(i, 'price', e.target.value)} placeholder="Price" aria-label={`Item ${i + 1} price`} />
                  <select className={inputCls} value={r.unit} onChange={(e) => setRow(i, 'unit', e.target.value)} aria-label={`Item ${i + 1} unit`}>{[...new Set([...UNITS, r.unit])].map((u) => <option key={u}>{u}</option>)}</select>
                  <select className={inputCls} value={r.availability} onChange={(e) => setRow(i, 'availability', e.target.value)} aria-label={`Item ${i + 1} availability`}>{AVAILABILITY.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
                  <button onClick={() => setRows((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : [blank()]))} aria-label="Remove row" className="flex h-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button className={btnLine} onClick={() => setRows((l) => [...l, blank()])}><Plus className="h-4 w-4" /> Add a row</button>
          </>
        )}
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-sm text-muted-foreground">{filled.length} item{filled.length === 1 ? '' : 's'} ready</span>
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={busy || paste}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save {filled.length || ''} item{filled.length === 1 ? '' : 's'}</button>
        </div>
      </div>
    </Modal>
  );
}
