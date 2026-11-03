import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Plus, Pencil, Trash2, Loader2, Save, Package, Copy } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Toolbar, SearchBox, FilterSelect, Loading, Empty, StatCard, Modal, Field, inputCls, textareaCls, btnPrimary, btnLine, fmtDate,
} from '@/components/erp/kit';
import { formatMoney, CURRENCIES, DEFAULT_CURRENCY } from '@/lib/money';
import { canSeeCosts, marginTone } from '@/lib/costing';
import { CATALOG_CATEGORIES, UNITS, catalogCategoryLabel, canEditCatalog, resetCatalogCache } from '@/lib/catalog';

const n = (v) => Number(v) || 0;
const marginOf = (i) => (n(i.selling_price) > 0 && n(i.buying_price) > 0 ? ((n(i.selling_price) - n(i.buying_price)) / n(i.selling_price)) * 100 : null);

export default function CatalogPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null);
  const canEdit = canEditCatalog(user);
  const showCost = canSeeCosts(user);

  const load = () => pb.collection('catalog_items').getFullList({ sort: 'name' }).then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const saved = () => { resetCatalogCache(); load(); };

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (items || []).filter((i) => {
      if (!showInactive && Number(i.active) === 0) return false;
      if (category !== 'all' && i.category !== category) return false;
      const hay = `${i.name} ${i.code} ${i.brand} ${i.description}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [items, q, category, showInactive]);

  const stats = useMemo(() => {
    const list = (items || []).filter((i) => Number(i.active) !== 0);
    return { count: list.length, noCost: list.filter((i) => !n(i.buying_price)).length, cats: new Set(list.map((i) => i.category)).size };
  }, [items]);

  const remove = async (i) => {
    if (!window.confirm(`Delete “${i.name}” from the price list?\n\nQuotations that already use it are not changed.`)) return;
    try { await pb.collection('catalog_items').delete(i.id); saved(); toast({ title: 'Item deleted' }); }
    catch (e) { toast({ title: 'Could not delete', description: e.message, variant: 'destructive' }); }
  };

  return (
    <PortalLayout title="Items & Prices" subtitle="Everything we sell and the price we offer it at — used to build quotations">
      <Helmet><title>Items & Prices | RUNHTec Business Portal</title></Helmet>

      <div className={`mb-5 grid grid-cols-2 gap-3 sm:gap-4 ${showCost ? 'sm:grid-cols-3' : ''}`}>
        <StatCard icon={Package} label="Items in the price list" value={stats.count} />
        <StatCard label="Categories used" value={stats.cats} />
        {showCost && <StatCard label="Items without a buying price" value={stats.noCost} tone={stats.noCost ? 'amber' : 'green'} note="Add it so quotes show the real profit" />}
      </div>

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search item, code or brand" />
        <FilterSelect value={category} onChange={setCategory} options={CATALOG_CATEGORIES} allLabel="All categories" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showInactive} onChange={() => setShowInactive((v) => !v)} /> Show hidden items</label>
        {canEdit && <button className={`${btnPrimary} ml-auto`} onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Add item</button>}
      </Toolbar>

      {!items ? <Loading /> : filtered.length === 0 ? (
        <Empty>{items.length === 0 ? (canEdit ? 'The price list is empty. Click “Add item” to add your first product or service with its price.' : 'The price list is empty. Ask Sales or an Administrator to add items.') : 'No items match your search.'}</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Item</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Our price</th>
                {showCost && <th className="px-4 py-3 text-right text-amber-700">Buying price 🔒</th>}
                {showCost && <th className="px-4 py-3 text-right">Margin</th>}
                {canEdit && <th className="w-24 px-2 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((i) => {
                const m = marginOf(i);
                return (
                  <tr key={i.id} className={Number(i.active) === 0 ? 'opacity-50' : ''}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{i.name}{Number(i.active) === 0 && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">hidden</span>}</p>
                      <p className="text-xs text-muted-foreground">{[i.code, i.brand, i.description].filter(Boolean).join(' · ')}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{catalogCategoryLabel(i.category)}</td>
                    <td className="px-4 py-3">{i.unit || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(i.selling_price, i.currency)}</td>
                    {showCost && <td className="px-4 py-3 text-right">{n(i.buying_price) ? formatMoney(i.buying_price, i.currency) : <span className="text-amber-700">not set</span>}</td>}
                    {showCost && <td className={`px-4 py-3 text-right font-semibold ${m === null ? 'text-muted-foreground' : marginTone(m)}`}>{m === null ? '—' : `${m.toFixed(0)}%`}</td>}
                    {canEdit && (
                      <td className="whitespace-nowrap px-2 py-3 text-right">
                        <button onClick={() => setEditing(i)} aria-label={`Edit ${i.name}`} className="mr-1 inline-flex rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setEditing({ ...i, id: undefined, name: `${i.name} (copy)` })} aria-label={`Copy ${i.name}`} title="Make a similar item" className="mr-1 inline-flex rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"><Copy className="h-4 w-4" /></button>
                        <button onClick={() => remove(i)} aria-label={`Delete ${i.name}`} className="inline-flex rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ItemDialog item={editing} onClose={() => setEditing(null)} onSaved={saved} showCost={showCost} />
    </PortalLayout>
  );
}

const BLANK = { name: '', code: '', category: 'solar', unit: 'pcs', brand: '', description: '', selling_price: '', buying_price: '', currency: DEFAULT_CURRENCY, supplier: '', active: true, notes: '' };

function ItemDialog({ item, onClose, onSaved, showCost }) {
  const { toast } = useToast();
  const [f, setF] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(item?.id);
  useEffect(() => {
    if (!item) return;
    setF({ ...BLANK, ...Object.fromEntries(Object.keys(BLANK).map((k) => [k, item[k] ?? BLANK[k]])), active: item.active === undefined ? true : Number(item.active) !== 0 });
  }, [item]);
  if (!item) return null;
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const m = n(f.selling_price) > 0 && n(f.buying_price) > 0 ? ((n(f.selling_price) - n(f.buying_price)) / n(f.selling_price)) * 100 : null;

  const save = async () => {
    if (!f.name.trim()) { toast({ title: 'Give the item a name', variant: 'destructive' }); return; }
    if (n(f.selling_price) <= 0) { toast({ title: 'Enter the price we offer it at', variant: 'destructive' }); return; }
    setSaving(true);
    const data = { ...f, name: f.name.trim(), selling_price: n(f.selling_price), active: f.active ? 1 : 0 };
    if (showCost) data.buying_price = n(f.buying_price); else { delete data.buying_price; delete data.supplier; }
    try {
      if (isEdit) await pb.collection('catalog_items').update(item.id, data);
      else await pb.collection('catalog_items').create(data);
      toast({ title: isEdit ? 'Item updated' : 'Item added', description: data.name });
      onSaved(); onClose();
    } catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} wide title={isEdit ? 'Edit item' : 'Add an item to the price list'} description={isEdit && item.updated ? `Last changed ${fmtDate(item.updated)}${item.updated_by_name ? ` by ${item.updated_by_name}` : ''}` : 'Products, materials and services — anything that goes on a quotation.'}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Item name" required className="sm:col-span-2"><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Hybrid inverter 10 kVA 48V" /></Field>
          <Field label="Code / model (optional)"><input className={inputCls} value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. INV-10K" /></Field>
          <Field label="Category">
            <select className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)}>
              {CATALOG_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Unit" hint="How it is counted on a quote">
            <input className={inputCls} list="catalog-units" value={f.unit} onChange={(e) => set('unit', e.target.value)} />
            <datalist id="catalog-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          </Field>
          <Field label="Brand (optional)"><input className={inputCls} value={f.brand} onChange={(e) => set('brand', e.target.value)} /></Field>
          <Field label="Description shown on quotes (optional)" className="sm:col-span-2 lg:col-span-3"><textarea className={textareaCls} rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Pure sine wave, built-in MPPT 150V, 2-year warranty" /></Field>
        </div>

        <div className="grid gap-4 rounded-xl border border-border bg-secondary/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Our price (to the client)" required><input type="number" min="0" className={inputCls} value={f.selling_price} onChange={(e) => set('selling_price', e.target.value)} /></Field>
          <Field label="Currency">
            <select className={inputCls} value={f.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
            </select>
          </Field>
          {showCost && <Field label="Buying price 🔒" hint="Internal — never shown to clients"><input type="number" min="0" className={`${inputCls} border-amber-300 bg-amber-50/60`} value={f.buying_price} onChange={(e) => set('buying_price', e.target.value)} /></Field>}
          {showCost && <Field label="Supplier 🔒"><input className={inputCls} value={f.supplier} onChange={(e) => set('supplier', e.target.value)} /></Field>}
          {showCost && m !== null && <p className={`text-sm font-semibold sm:col-span-2 lg:col-span-4 ${marginTone(m)}`}>Margin: {formatMoney(n(f.selling_price) - n(f.buying_price), f.currency)} per {f.unit || 'unit'} ({m.toFixed(1)}%)</p>}
        </div>

        <Field label="Internal notes (optional)"><input className={inputCls} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="e.g. Price valid until end of December" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} className="h-4 w-4" /> Available to pick on quotations <span className="text-xs text-muted-foreground">(untick to hide an item you no longer sell)</span></label>

        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {isEdit ? 'Save changes' : 'Add item'}</button>
        </div>
      </div>
    </Modal>
  );
}
