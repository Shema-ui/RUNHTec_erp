import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, Plus, Trash2, Save, Eye, Loader2, Search,
} from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { nextDocNumber } from '@/lib/numbering';
import CostingPanel from '@/components/erp/CostingPanel';
import CatalogItemInput from '@/components/erp/CatalogItemInput';
import ItemCards, { TotalsInputs } from '@/components/erp/ItemCards';
import NewClientDialog from '@/components/crm/NewClientDialog';
import { canSeeCosts, emptyCosting, normalizeCosting, loadCostSettings } from '@/lib/costing';
import { useAuth } from '@/context/AuthContext';
import PortalLayout from '@/layouts/PortalLayout';
import { useToast } from '@/hooks/use-toast';
import { formatMoney, CURRENCIES, DEFAULT_CURRENCY, DEFAULT_TAX_RATE } from '@/lib/money';

const localDay = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const TODAY = localDay();
const IN30 = localDay(30);

const DEFAULT_TERMS = `1. This quotation is valid until the date stated above.
2. Prices are exclusive of VAT unless otherwise indicated.
3. Scope of work is limited to items explicitly listed below.
4. A signed acceptance or purchase order is required before work commences.
5. Prices are subject to change if acceptance falls outside the validity period.`;

const emptyItem = () => ({ id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, amount: 0 });

function calcItem(item) {
  return { ...item, amount: parseFloat((Number(item.quantity) * Number(item.unit_price)).toFixed(2)) };
}

function fmt(n, currency = DEFAULT_CURRENCY) {
  return formatMoney(n, currency);
}

function Field({ label, required, children, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-colors';
const textareaCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none';

export default function QuotationFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [linkedRfq, setLinkedRfq] = useState(null);

  const [form, setForm] = useState({
    rfq: '',
    client: '',
    bill_to_name: '',
    bill_to_company: '',
    bill_to_address: '',
    bill_to_email: '',
    bill_to_phone: '',
    number: '',
    valid_until: IN30,
    currency: DEFAULT_CURRENCY,
    tax_rate: DEFAULT_TAX_RATE,
    discount_amount: 0,
    notes: '',
    terms_conditions: DEFAULT_TERMS,
    status: 'draft',
  });

  const [items, setItems] = useState([emptyItem()]);
  const [costing, setCosting] = useState(emptyCosting());
  const { user } = useAuth();
  const showCosts = canSeeCosts(user);
  // New documents start with the wage rates and safety margin from Settings.
  useEffect(() => { if (!isEdit) loadCostSettings().then(() => setCosting(emptyCosting())); }, []);

  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0);
  const taxAmount = parseFloat(((subtotal * (Number(form.tax_rate) || 0)) / 100).toFixed(2));
  const discountAmount = parseFloat((Number(form.discount_amount) || 0).toFixed(2));
  const total = parseFloat((subtotal + taxAmount - discountAmount).toFixed(2));

  const genNumber = useCallback(() => nextDocNumber('quotations', 'number', 'Q'), []);

  useEffect(() => {
    pb.collection('clients').getFullList({ sort: 'company_name', requestKey: 'clients-for-quotation' })
      .then(setClients).catch(() => {});

    if (isEdit) {
      pb.collection('quotations').getOne(id, { requestKey: `quotation-${id}`, expand: 'rfq' })
        .then(q => {
          const { items: qItems, subtotal: _s, tax_amount: _t, total: _tt, costing: qCosting, expand: _e, ...rest } = q;
          setCosting(normalizeCosting(qCosting));
          setForm(prev => ({
            ...prev,
            ...rest,
            // A freshly-converted draft may have no number generated yet server-side;
            // this collection requires one, so keep whatever it already has.
            number: rest.number || '',
            valid_until: rest.valid_until || IN30,
            terms_conditions: rest.terms_conditions || DEFAULT_TERMS,
          }));
          setItems((qItems && Array.isArray(qItems) && qItems.length) ? qItems.map(i => ({ ...i, id: i.id || crypto.randomUUID() })) : [emptyItem()]);
          if (q.expand?.rfq) setLinkedRfq(q.expand.rfq);
          setLoading(false);
        })
        .catch(() => navigate('/quotations'));
    } else {
      genNumber().then(n => setForm(p => ({ ...p, number: n })));
      pb.collection('company_settings').getList(1, 1, { requestKey: 'settings-for-quotation' })
        .then(r => {
          const cfg = r.items[0];
          if (!cfg) return;
          setForm(p => ({
            ...p,
            currency: cfg.currency || p.currency,
            terms_conditions: cfg.default_terms_conditions || p.terms_conditions,
          }));
        })
        .catch(() => {});
    }
  }, [isEdit, id]);

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const [newClient, setNewClient] = useState(false);
  // Picking a CRM client fills in its main contact too.
  const selectClient = (client, contact = null) => {
    setField('client', client.id);
    setField('bill_to_company', client.company_name);
    setField('bill_to_name', contact?.name || '');
    setField('bill_to_address', contact?.address || [client.street, client.city, client.province, client.country].filter(Boolean).join(', '));
    setField('bill_to_email', contact?.email || '');
    setField('bill_to_phone', contact?.phone || '');
    setShowClientDrop(false);
    setClientSearch(client.company_name);
    if (!contact) {
      pb.collection('client_contacts').getList(1, 1, { filter: `client = '${client.id}'`, sort: '-is_primary,created' })
        .then((r) => { const c = r.items[0]; if (!c) return; setForm((p) => (p.client !== client.id ? p : { ...p, bill_to_name: p.bill_to_name || c.full_name || '', bill_to_email: p.bill_to_email || c.email || '', bill_to_phone: p.bill_to_phone || c.mobile || c.whatsapp || '' })); })
        .catch(() => {});
    }
  };
  const onClientAdded = (client, typed) => {
    setClients((list) => (list.some((c) => c.id === client.id) ? list : [client, ...list]));
    selectClient(client, { name: typed.name, email: typed.email, phone: typed.phone, address: typed.address });
  };

  const updateItem = (idx, k, v) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = calcItem({ ...next[idx], [k]: v });
      return next;
    });
  };

  // Fill a line from the price list: name, our price and (internally) the buying price.
  const pickCatalogItem = (idx, c) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = calcItem({
        ...next[idx],
        description: c.description ? `${c.name} — ${c.description}` : c.name,
        unit_price: Number(c.selling_price) || 0,
        list_price: Number(c.selling_price) || 0,
        // From Items & Prices (catalog_item) or from a vendor's price list (vendor_item).
        catalog_item: c.vendor_item ? '' : c.id,
        vendor_item: c.vendor_item || '',
        cost_source: c.cost_source || '',
        unit: c.unit || '',
        ...(c.buying_price !== undefined ? { cost: Number(c.buying_price) || 0 } : {}),
      });
      return next;
    });
  };

  const addItem = () => setItems(p => [...p, emptyItem()]);
  const removeItem = (idx) => setItems(p => p.filter((_, i) => i !== idx));

  const handleSave = async (status = null) => {
    if (!form.number.trim()) {
      toast({ title: 'Quotation number required', variant: 'destructive' }); return;
    }
    setSaving(true);
    const payload = {
      ...form,
      bill_to_company: form.bill_to_company || (!form.client ? clientSearch.trim() : ''),
      status: status || form.status,
      items,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
      ...(showCosts ? { costing } : {}),
    };
    try {
      let saved;
      if (isEdit) {
        saved = await pb.collection('quotations').update(id, payload);
      } else {
        saved = await pb.collection('quotations').create(payload);
      }
      toast({ title: isEdit ? 'Quotation updated' : 'Quotation created', description: saved.number });
      navigate(`/quotations/${saved.id}/view${status === 'sent' && form.status !== 'sent' ? '?send=1' : ''}`);
    } catch (e) {
      toast({ title: 'Error saving quotation', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredClients = clients.filter(c =>
    !clientSearch || c.company_name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.trading_name?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  if (loading) {
    return (
      <PortalLayout title={isEdit ? 'Edit Quotation' : 'New Quotation'} subtitle="Quotations">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title={isEdit ? `Edit ${form.number}` : 'New Quotation'} subtitle="Quotations">
      <Helmet>
        <title>{isEdit ? `Edit ${form.number}` : 'New Quotation'} | RUNHTec Business Portal</title>
        <meta name="description" content="Create or edit a client quotation." />
      </Helmet>

      {/* Top bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/quotations" className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>
          <button
            onClick={() => handleSave('sent')}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Save & Send
          </button>
        </div>
      </div>

      {linkedRfq && (
        <div className="mb-5 rounded-xl border border-border bg-accent/40 p-4 text-sm text-muted-foreground">
          Converted from RFQ: <span className="font-semibold text-foreground">{linkedRfq.company || linkedRfq.name}</span> — {linkedRfq.description}
        </div>
      )}

      <div className="space-y-5">
        {/* Quote meta */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display mb-4 text-sm font-bold text-foreground">Quotation Details</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Quotation Number" required>
              <input className={inputCls} value={form.number} onChange={e => setField('number', e.target.value)} />
            </Field>
            <Field label="Valid Until">
              <input type="date" className={inputCls} value={form.valid_until} onChange={e => setField('valid_until', e.target.value)} />
            </Field>
            <Field label="Currency">
              <select className={inputCls} value={form.currency} onChange={e => setField('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={form.status} onChange={e => setField('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="expired">Expired</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Client */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display mb-4 text-sm font-bold text-foreground">Client</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Search Client" className="relative sm:col-span-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={`${inputCls} pl-9`}
                  placeholder="Search existing clients…"
                  value={clientSearch}
                  onFocus={() => setShowClientDrop(true)}
                  onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); }}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {form.client
                  ? <span className="font-medium text-emerald-700">✓ Linked to the CRM</span>
                  : (form.bill_to_company || form.bill_to_name || clientSearch.trim()) && <span className="text-muted-foreground">Not in the CRM yet: it will be added when you save.</span>}
                <button type="button" onClick={() => setNewClient(true)} className="font-semibold text-primary hover:underline">+ New client</button>
              </div>
              {showClientDrop && clientSearch.trim().length > 1 && filteredClients.length === 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                  <button type="button" onMouseDown={() => setNewClient(true)} className="block w-full px-3 py-2.5 text-left text-sm font-semibold text-primary hover:bg-secondary">+ Add “{clientSearch.trim()}” as a new client</button>
                </div>
              )}
              {showClientDrop && filteredClients.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                  {filteredClients.slice(0, 20).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      {c.company_name}
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Contact Name">
              <input className={inputCls} value={form.bill_to_name} onChange={e => setField('bill_to_name', e.target.value)} />
            </Field>
            <Field label="Company Name">
              <input className={inputCls} placeholder="Company / organization" value={form.bill_to_company} onChange={e => setField('bill_to_company', e.target.value)} />
            </Field>
            <Field label="Email">
              <input className={inputCls} type="email" value={form.bill_to_email} onChange={e => setField('bill_to_email', e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className={inputCls} value={form.bill_to_phone} onChange={e => setField('bill_to_phone', e.target.value)} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <textarea className={textareaCls} rows={2} value={form.bill_to_address} onChange={e => setField('bill_to_address', e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Items Table */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display mb-4 text-sm font-bold text-foreground">Quotation Items</h3>
          <ItemCards items={items} updateItem={updateItem} removeItem={removeItem} pickCatalogItem={pickCatalogItem} addItem={addItem} showCosts={showCosts} currency={form.currency} fmt={fmt} />
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
                  <th className="w-24 pb-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qty</th>
                  <th className="w-36 pb-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unit Price</th>
                  {showCosts && <th className="w-36 pb-2 text-right text-xs font-semibold uppercase tracking-wide text-amber-700" title="Internal — never shown to the client">Our buying price 🔒</th>}
                  <th className="w-36 pb-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                  <th className="w-10 pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3">
                      <CatalogItemInput
                        className={inputCls}
                        value={item.description}
                        onChange={(v) => updateItem(idx, 'description', v)}
                        onPick={(c) => pickCatalogItem(idx, c)}
                        currency={form.currency}
                      />
                    </td>
                    <td className="py-2 px-1.5">
                      <input
                        type="number" min="0" step="0.01"
                        className={`${inputCls} text-right`}
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-1.5">
                      <input
                        type="number" min="0" step="0.01"
                        className={`${inputCls} text-right`}
                        value={item.unit_price}
                        onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                      />
                      {Number(item.list_price) > 0 && Number(item.unit_price) < Number(item.list_price) - 0.5 && (
                        <p className="mt-0.5 text-right text-[11px] font-medium text-amber-700" title="Price is lower than the price list">
                          ⚠ Below list price ({fmt(item.list_price, form.currency)})
                        </p>
                      )}
                    </td>
                    {showCosts && (
                      <td className="py-2 px-1.5">
                        <input
                          type="number" min="0" step="0.01"
                          className={`${inputCls} border-amber-300 bg-amber-50/60 text-right`}
                          value={item.cost ?? 0}
                          onChange={e => updateItem(idx, 'cost', e.target.value)}
                          aria-label="Our buying price per unit"
                          placeholder="0"
                        />
                        {item.cost_source && <p className="mt-0.5 truncate text-right text-[10px] text-muted-foreground" title={item.cost_source}>🚚 {item.cost_source}</p>}
                        {Number(item.cost) > 0 && Number(item.unit_price) > 0 && (
                          <p className={`mt-0.5 text-right text-[11px] ${Number(item.unit_price) > Number(item.cost) ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {Math.round(((Number(item.unit_price) - Number(item.cost)) / Number(item.unit_price)) * 100)}% margin
                          </p>
                        )}
                      </td>
                    )}
                    <td className="py-2 pl-1.5 text-right font-medium text-foreground">
                      {fmt(item.amount, form.currency)}
                    </td>
                    <td className="py-2 pl-2">
                      <button
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={addItem}
            className="mt-3 hidden items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary md:flex"
          >
            <Plus className="h-4 w-4" /> Add Line Item
          </button>

          {/* Totals */}
          <div className="mt-5"><TotalsInputs discount={form.discount_amount} taxRate={form.tax_rate} onDiscount={(v) => setField('discount_amount', v)} onTax={(v) => setField('tax_rate', v)} /></div>
          <div className="mt-5 flex justify-end">
            <div className="w-full max-w-sm space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{fmt(subtotal, form.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <input
                  type="number" min="0" step="0.01"
                  className="hidden w-32 rounded border border-border bg-background px-2 py-0.5 text-right text-sm md:block"
                  value={form.discount_amount}
                  onChange={e => setField('discount_amount', e.target.value)}
                />
                <span className="font-medium md:hidden">{fmt(Number(form.discount_amount) || 0, form.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  VAT / Tax (
                  <input
                    type="number" min="0" max="100" step="0.1"
                    className="mx-1 hidden w-12 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-center md:inline-block"
                    value={form.tax_rate}
                    onChange={e => setField('tax_rate', e.target.value)}
                  /><span className="md:hidden">{form.tax_rate}</span>
                  %)
                </span>
                <span className="font-medium">{fmt(taxAmount, form.currency)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Total</span>
                <span className="text-primary">{fmt(total, form.currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {showCosts && (
          <CostingPanel items={items} costing={costing} onChange={setCosting} subtotal={subtotal} discount={discountAmount} currency={form.currency} />
        )}

        {/* Notes & Terms */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display mb-3 text-sm font-bold text-foreground">Notes</h3>
          <textarea
            className={textareaCls}
            rows={3}
            placeholder="Additional notes visible to the client..."
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display mb-3 text-sm font-bold text-foreground">Terms &amp; Conditions</h3>
          <textarea
            className={textareaCls}
            rows={5}
            value={form.terms_conditions}
            onChange={e => setField('terms_conditions', e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-4">
          <Link to="/quotations" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">
            Cancel
          </Link>
          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>
          <button
            onClick={() => handleSave('sent')}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Save & View
          </button>
        </div>
      </div>
      <NewClientDialog open={newClient} onClose={() => setNewClient(false)} initialName={clientSearch.trim() || form.bill_to_company} onCreated={onClientAdded} />
    </PortalLayout>
  );
}
