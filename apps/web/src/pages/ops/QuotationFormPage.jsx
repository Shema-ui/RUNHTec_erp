import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, Plus, Trash2, Save, Eye, Loader2, Search,
} from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import PortalLayout from '@/layouts/PortalLayout';
import { useToast } from '@/hooks/use-toast';

const TODAY = new Date().toISOString().slice(0, 10);
const IN30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

const DEFAULT_TERMS = `1. This quotation is valid until the date stated above.
2. Prices are exclusive of VAT unless otherwise indicated.
3. Scope of work is limited to items explicitly listed below.
4. A signed acceptance or purchase order is required before work commences.
5. Prices are subject to change if acceptance falls outside the validity period.`;

const emptyItem = () => ({ id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, amount: 0 });

function calcItem(item) {
  return { ...item, amount: parseFloat((Number(item.quantity) * Number(item.unit_price)).toFixed(2)) };
}

function fmt(n, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR', minimumFractionDigits: 2 }).format(n || 0);
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
    currency: 'ZAR',
    tax_rate: 0,
    discount_amount: 0,
    notes: '',
    terms_conditions: DEFAULT_TERMS,
    status: 'draft',
  });

  const [items, setItems] = useState([emptyItem()]);

  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0);
  const taxAmount = parseFloat(((subtotal * (Number(form.tax_rate) || 0)) / 100).toFixed(2));
  const discountAmount = parseFloat((Number(form.discount_amount) || 0).toFixed(2));
  const total = parseFloat((subtotal + taxAmount - discountAmount).toFixed(2));

  const genNumber = useCallback(async () => {
    const year = new Date().getFullYear();
    try {
      const r = await pb.collection('quotations').getList(1, 1, { sort: '-created', requestKey: 'gen-quote-num' });
      const n = r.totalItems + 1;
      return `Q-${year}-${String(n).padStart(4, '0')}`;
    } catch {
      return `Q-${year}-0001`;
    }
  }, []);

  useEffect(() => {
    pb.collection('clients').getFullList({ sort: 'company_name', requestKey: 'clients-for-quotation' })
      .then(setClients).catch(() => {});

    if (isEdit) {
      pb.collection('quotations').getOne(id, { requestKey: `quotation-${id}`, expand: 'rfq' })
        .then(q => {
          const { items: qItems, subtotal: _s, tax_amount: _t, total: _tt, ...rest } = q;
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

  const selectClient = (client) => {
    setField('client', client.id);
    setField('bill_to_company', client.company_name);
    setField('bill_to_name', '');
    setField('bill_to_address', [client.street, client.city, client.province, client.country].filter(Boolean).join(', '));
    setField('bill_to_email', '');
    setField('bill_to_phone', '');
    setShowClientDrop(false);
    setClientSearch(client.company_name);
  };

  const updateItem = (idx, k, v) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = calcItem({ ...next[idx], [k]: v });
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
      status: status || form.status,
      items,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total,
    };
    try {
      let saved;
      if (isEdit) {
        saved = await pb.collection('quotations').update(id, payload);
      } else {
        saved = await pb.collection('quotations').create(payload);
      }
      toast({ title: isEdit ? 'Quotation updated' : 'Quotation created', description: saved.number });
      navigate(`/quotations/${saved.id}/view`);
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
                <option value="ZAR">ZAR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="RWF">RWF</option>
                <option value="KES">KES</option>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
                  <th className="w-24 pb-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qty</th>
                  <th className="w-36 pb-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unit Price</th>
                  <th className="w-36 pb-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                  <th className="w-10 pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3">
                      <input
                        className={inputCls}
                        placeholder="Item description or service"
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
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
                    </td>
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
            className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" /> Add Line Item
          </button>

          {/* Totals */}
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
                  className="w-32 rounded border border-border bg-background px-2 py-0.5 text-right text-sm"
                  value={form.discount_amount}
                  onChange={e => setField('discount_amount', e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  VAT / Tax (
                  <input
                    type="number" min="0" max="100" step="0.1"
                    className="mx-1 w-12 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-center"
                    value={form.tax_rate}
                    onChange={e => setField('tax_rate', e.target.value)}
                  />
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
    </PortalLayout>
  );
}
