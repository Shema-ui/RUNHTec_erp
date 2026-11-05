import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Plus, Pencil, Trash2, Loader2, Save, Package, Copy, Truck, Check, AlertTriangle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { convert, roundPrice, DEFAULT_MARKUP } from '@/lib/vendorPricing';
import { availabilityInfo } from '@/lib/vendors';
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
  const [params, setParams] = useSearchParams();
  // Vendor items use buying prices, so the tab only exists for staff who may see costs.
  const tab = showCost && params.get('tab') === 'vendors' ? 'vendors' : 'own';
  const [vendorCount, setVendorCount] = useState(null);

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

      {showCost && (
        <div className="mb-4 inline-flex gap-1 rounded-xl border border-border bg-card p-1">
          <button onClick={() => setParams({})} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === 'own' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}><Package className="mr-1.5 inline h-4 w-4" />My price list{items ? ` (${stats.count})` : ''}</button>
          <button onClick={() => setParams({ tab: 'vendors' })} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === 'vendors' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}><Truck className="mr-1.5 inline h-4 w-4" />From vendors{vendorCount !== null ? ` (${vendorCount})` : ''}</button>
        </div>
      )}
      {tab === 'vendors' ? <VendorItemsTab own={items || []} canEdit={canEdit} onAdded={saved} onCount={setVendorCount} /> : (<>
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

      </>)}
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

// Every vendor's items, with their price, our buying price in the company currency
// and our selling price at the vendor markup (Settings). Staff who may see costs only.
function VendorItemsTab({ own, canEdit, onAdded, onCount }) {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState('all');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    Promise.all([
      pb.collection('vendor_items').getFullList({ sort: 'name' }),
      pb.collection('vendors').getFullList({ sort: 'name' }),
      pb.collection('company_settings').getList(1, 1).then((r) => r.items[0] || {}).catch(() => ({})),
    ]).then(([items, vendors, cfg]) => {
      let rates = cfg.exchange_rates; if (typeof rates === 'string') { try { rates = JSON.parse(rates); } catch { rates = {}; } }
      const markup = cfg.vendor_markup === null || cfg.vendor_markup === undefined || cfg.vendor_markup === '' ? DEFAULT_MARKUP : Number(cfg.vendor_markup);
      const vmap = new Map(vendors.map((v) => [v.id, v]));
      const list = items.filter((i) => vmap.get(i.vendor)?.status !== 'inactive');
      setData({ items: list, vendors: vendors.filter((v) => v.status !== 'inactive'), vmap, rates: rates || {}, markup, currency: cfg.currency || DEFAULT_CURRENCY });
      onCount(list.length);
    }).catch(() => { setData({ items: [], vendors: [], vmap: new Map(), rates: {}, markup: DEFAULT_MARKUP, currency: DEFAULT_CURRENCY }); onCount(0); });
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const mine = new Set(own.map((i) => String(i.name).trim().toLowerCase()));
    return data.items
      .filter((i) => vendor === 'all' || i.vendor === vendor)
      .map((i) => {
        const vname = data.vmap.get(i.vendor)?.name || 'Vendor';
        const priced = n(i.price) > 0;
        const cost = priced ? convert(i.price, i.currency || 'RWF', data.currency, data.rates) : null;
        return { ...i, vname, priced, missingRate: priced && cost === null ? i.currency : '', buy: cost === null ? null : Math.round(cost), sell: cost === null ? null : roundPrice(cost * (1 + data.markup / 100), data.currency), inMine: mine.has(String(i.name).trim().toLowerCase()) };
      })
      .filter((i) => words.every((w) => `${i.name} ${i.brand} ${i.code} ${i.vname}`.toLowerCase().includes(w)));
  }, [data, q, vendor, own]);

  const addToMine = async (i) => {
    setBusy(i.id);
    try {
      await pb.collection('catalog_items').create({
        name: i.name, brand: i.brand || '', code: i.code || '', category: i.category || 'other', unit: i.unit || 'pcs',
        selling_price: i.sell, buying_price: i.buy, currency: data.currency, supplier: i.vname, active: true,
        notes: `From ${i.vname}'s price list: ${formatMoney(i.price, i.currency)} + ${data.markup}%`,
      });
      toast({ title: 'Added to your price list', description: `${i.name} at ${formatMoney(i.sell, data.currency)}. You can change the price there.` });
      onAdded();
    } catch (e) { toast({ title: 'Could not add', description: e.message, variant: 'destructive' }); }
    finally { setBusy(''); }
  };

  if (!data) return <Loading />;
  const cur = data.currency;
  return (
    <>
      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        🔒 Internal: buying prices from your vendors. <b>Your price</b> = buying price + {data.markup}% (change it in <Link to="/settings" className="underline">Settings</Link>). These also appear as suggestions when you type an item on a quotation. Clients never see this page.
      </p>
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search item, brand or vendor" />
        <FilterSelect value={vendor} onChange={setVendor} options={data.vendors.map((v) => ({ value: v.id, label: v.name }))} allLabel="All vendors" />
      </Toolbar>
      {data.items.length === 0 ? <Empty>No vendor items yet. Add vendors and their price lists in <Link to="/vendors" className="text-primary hover:underline">Vendors</Link>.</Empty>
        : rows.length === 0 ? <Empty>No vendor item matches your search.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Item</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Vendor's price</th>
                <th className="px-4 py-3 text-right text-amber-700">Buying price 🔒</th>
                <th className="px-4 py-3 text-right">Your price (+{data.markup}%)</th>
                <th className="w-40 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((i) => (
                <tr key={i.id} className={!i.priced ? 'opacity-60' : ''}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{[i.brand, i.code && `Code ${i.code}`].filter(Boolean).join(' · ')}{i.availability && i.availability !== 'in_stock' ? <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${availabilityInfo(i.availability).cls}`}>{availabilityInfo(i.availability).label}</span> : null}</p>
                  </td>
                  <td className="px-4 py-3"><Link to={`/vendors/${i.vendor}`} className="text-primary hover:underline">{i.vname}</Link></td>
                  <td className="px-4 py-3">{i.unit || '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{i.priced ? formatMoney(i.price, i.currency || 'RWF') : 'price on request'}</td>
                  <td className="px-4 py-3 text-right">{i.missingRate ? <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />Set the {i.missingRate} rate in Settings</span> : i.buy === null ? '—' : formatMoney(i.buy, cur)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{i.sell === null ? '—' : formatMoney(i.sell, cur)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {i.inMine ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Check className="h-3.5 w-3.5" /> In your list</span>
                      : canEdit && i.sell !== null ? <button onClick={() => addToMine(i)} disabled={busy === i.id} className={btnLine}>{busy === i.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add to my list</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
