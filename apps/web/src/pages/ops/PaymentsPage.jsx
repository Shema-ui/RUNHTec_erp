import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Plus, Loader2, Save, CreditCard, Pencil, ChevronRight } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Toolbar, SearchBox, Loading, Empty, StatCard, Modal, Field, inputCls, textareaCls, btnPrimary, btnLine, fmtDate, todayISO,
} from '@/components/erp/kit';
import { formatMoney, DEFAULT_CURRENCY } from '@/lib/money';
import SuperDelete from '@/components/erp/SuperDelete';
import PaymentBar from '@/components/erp/PaymentBar';
import BusinessFilter, { inBusiness } from '@/components/erp/BusinessFilter';

const METHODS = ['Bank transfer', 'Mobile money (MoMo)', 'Airtel Money', 'Cheque', 'Cash', 'Card', 'Other'];
const today = () => todayISO();

export default function PaymentsPage() {
  const [payments, setPayments] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [q, setQ] = useState('');
  const [business, setBusiness] = useState('all');
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState(null);
  const [projects, setProjects] = useState([]);
  const [openKey, setOpenKey] = useState(null);

  const load = () => Promise.all([
    pb.collection('payments').getFullList({ sort: '-created', expand: 'invoice,client' }),
    pb.collection('invoices').getFullList({ sort: '-created' }),
    pb.collection('projects').getFullList({}).catch(() => []),
  ]).then(([p, i, pr]) => { setPayments(p); setInvoices(i); setProjects(pr); }).catch(() => setPayments([]));
  useEffect(() => { load(); }, []);

  const paidByInvoice = useMemo(() => {
    const m = {};
    (payments || []).filter((p) => p.status === 'completed').forEach((p) => { if (p.invoice) m[p.invoice] = (m[p.invoice] || 0) + Number(p.amount || 0); });
    return m;
  }, [payments]);

  const stats = useMemo(() => {
    const month = today().slice(0, 7);
    const done = (payments || []).filter((p) => p.status === 'completed');
    const thisMonth = done.filter((p) => String(p.paid_date || p.created).slice(0, 7) === month).reduce((s, p) => s + Number(p.amount || 0), 0);
    const open = invoices.filter((i) => ['sent', 'overdue'].includes(i.status));
    const outstanding = open.reduce((s, i) => s + Math.max(0, Number(i.total || 0) - (paidByInvoice[i.id] || 0)), 0);
    return { thisMonth, outstanding, openCount: open.length };
  }, [payments, invoices, paidByInvoice]);

  // After a payment is deleted, re-open its invoice if it is no longer fully paid.
  const afterDelete = (p) => async () => {
    const inv = invoices.find((i) => i.id === p.invoice);
    if (inv && inv.status === 'paid' && p.status === 'completed') {
      const left = (paidByInvoice[inv.id] || 0) - Number(p.amount || 0);
      if (left < Number(inv.total || 0) - 0.5) await pb.collection('invoices').update(inv.id, { status: 'sent' }).catch(() => {});
    }
    await load();
  };

  // Invoice total and what is still owed on the invoice this payment belongs to.
  const progressFor = (p) => {
    const inv = p.expand?.invoice;
    if (!inv) return null;
    return { total: Number(inv.total) || 0, paid: paidByInvoice[inv.id] || 0, currency: inv.currency || p.currency };
  };
  const filtered = (payments || []).filter((p) => inBusiness(p, business)).filter((p) => !q || [p.reference, p.transaction_reference, p.expand?.invoice?.invoice_number, p.expand?.client?.company_name, p.expand?.invoice?.bill_to_company].join(' ').toLowerCase().includes(q.toLowerCase()));
  // One card per client per project: every payment from one person about one project.
  const projectById = Object.fromEntries((projects || []).map((pr) => [pr.id, pr]));
  const groupMap = new Map();
  filtered.forEach((p) => {
    const inv = p.expand?.invoice;
    const clientName = p.expand?.client?.company_name || inv?.bill_to_company || 'No client';
    const projectId = inv?.project || '';
    const key = `${p.client || inv?.client || clientName}::${projectId || p.invoice || 'none'}`;
    if (!groupMap.has(key)) groupMap.set(key, { key, clientName, projectId, payments: [], invoiceIds: new Set(), currency: p.currency });
    const g = groupMap.get(key);
    g.payments.push(p);
    if (p.invoice) g.invoiceIds.add(p.invoice);
  });
  const groups = [...groupMap.values()].map((g) => {
    const invs = [...g.invoiceIds].map((id) => invoices.find((i) => i.id === id)).filter(Boolean);
    const pr = projectById[g.projectId];
    const projectLabel = pr ? (pr.code ? `${pr.code} · ${pr.title}` : pr.title) : (invs[0]?.invoice_number || 'No project');
    return {
      ...g,
      projectLabel,
      total: g.payments.reduce((s, p) => s + Number(p.amount || 0), 0),
      owed: invs.reduce((s, i) => s + (Number(i.total) || 0), 0),
      paidOnInvoices: invs.reduce((s, i) => s + (paidByInvoice[i.id] || 0), 0),
    };
  });
  const openGroup = groups.find((g) => g.key === openKey) || null;

  return (
    <PortalLayout title="Payments" subtitle="Money received from clients, matched to invoices">
      <Helmet><title>Payments | RUNHTec Business Portal</title></Helmet>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <StatCard icon={CreditCard} label="Received this month" value={formatMoney(stats.thisMonth, DEFAULT_CURRENCY)} tone="green" />
        <StatCard label="Still owed on sent invoices" value={formatMoney(stats.outstanding, DEFAULT_CURRENCY)} tone={stats.outstanding ? 'red' : 'green'} />
        <StatCard label="Invoices awaiting payment" value={stats.openCount} tone="amber" />
      </div>

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search invoice, client or reference" />
        <BusinessFilter value={business} onChange={setBusiness} />
        <button className={`${btnPrimary} ml-auto`} onClick={() => setRecording(true)}><Plus className="h-4 w-4" /> Record payment</button>
      </Toolbar>

      {!payments ? <Loading /> : groups.length === 0 ? (
        <Empty>No payments recorded yet. When a client pays, click “Record payment” and choose the invoice — it is marked paid automatically once fully settled.</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <li key={g.key}>
              <button onClick={() => setOpenKey(g.key)} className="block w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block truncate font-semibold">{g.clientName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{g.projectLabel}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{g.payments.length} payment{g.payments.length === 1 ? '' : 's'} · last {fmtDate(g.payments[0].paid_date || g.payments[0].created)}</span>
                  <span className="font-semibold">{formatMoney(g.total, g.currency)}</span>
                </div>
                {g.owed > 0 && <div className="mt-2"><PaymentBar compact total={g.owed} paid={g.paidOnInvoices} currency={g.currency} /></div>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(openGroup)} onClose={() => setOpenKey(null)} title={openGroup ? `${openGroup.clientName} · ${openGroup.projectLabel}` : ''} description="Every payment from this client for this project." wide>
        {openGroup && (
          <div className="space-y-2">
            {openGroup.payments.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                <div className="min-w-0">
                  <span className="block text-sm font-medium">{fmtDate(p.paid_date || p.created)} · {p.method || '—'}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.expand?.invoice?.invoice_number ? `${p.expand.invoice.invoice_number} · ` : ''}{p.transaction_reference || p.reference || 'No reference'}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold">{formatMoney(p.amount, p.currency)}</span>
                  <button onClick={() => { setOpenKey(null); setEditing(p); }} aria-label="Edit payment" className="inline-flex rounded-lg border border-border p-1.5 text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                  <SuperDelete collection="payments" id={p.id} label={`payment of ${formatMoney(p.amount, p.currency)}`} after={afterDelete(p)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <RecordPaymentDialog open={recording || Boolean(editing)} payment={editing} onClose={() => { setRecording(false); setEditing(null); }} invoices={invoices} paidByInvoice={paidByInvoice} onSaved={load} />
    </PortalLayout>
  );
}

function RecordPaymentDialog({ open, payment, onClose, invoices, paidByInvoice: paidAll, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ invoice: '', amount: 0, method: METHODS[0], paid_date: today(), transaction_reference: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(payment?.id);
  // When editing, this payment's own amount shouldn't count as already paid.
  const paidByInvoice = useMemo(() => {
    if (!isEdit || payment.status !== 'completed' || !payment.invoice) return paidAll;
    return { ...paidAll, [payment.invoice]: (paidAll[payment.invoice] || 0) - Number(payment.amount || 0) };
  }, [paidAll, payment, isEdit]);
  const open_ = invoices.filter((i) => ['sent', 'overdue', 'draft'].includes(i.status) || (isEdit && i.id === payment.invoice));
  const inv = invoices.find((i) => i.id === form.invoice);
  const balance = inv ? Math.max(0, Number(inv.total || 0) - (paidByInvoice[inv.id] || 0)) : 0;

  useEffect(() => {
    if (!open) return;
    if (payment?.id) setForm({ invoice: payment.invoice || '', amount: Number(payment.amount) || 0, method: payment.method || METHODS[0], paid_date: payment.paid_date || today(), transaction_reference: payment.transaction_reference || '', notes: payment.notes || '' });
    else setForm({ invoice: '', amount: 0, method: METHODS[0], paid_date: today(), transaction_reference: '', notes: '' });
  }, [open, payment]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const amount = Number(form.amount) || 0;
    if (!inv || amount <= 0) { toast({ title: 'Choose an invoice and enter the amount received', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const data = {
        invoice: inv.id, client: inv.client || '', amount, currency: inv.currency || DEFAULT_CURRENCY,
        status: 'completed', method: form.method, paid_date: form.paid_date,
        reference: inv.invoice_number, transaction_reference: form.transaction_reference, notes: form.notes,
      };
      if (isEdit) await pb.collection('payments').update(payment.id, data);
      else await pb.collection('payments').create({ ...data, recorded_by_name: user?.name || user?.email || '' });
      // If the payment moved to another invoice, re-check the old one too.
      if (isEdit && payment.invoice && payment.invoice !== inv.id) {
        const old = invoices.find((i) => i.id === payment.invoice);
        if (old && old.status === 'paid' && (paidByInvoice[old.id] || 0) < Number(old.total || 0) - 0.5) await pb.collection('invoices').update(old.id, { status: 'sent' });
      }
      const fullyPaid = (paidByInvoice[inv.id] || 0) + amount >= Number(inv.total || 0) - 0.5;
      if (fullyPaid && inv.status !== 'paid') await pb.collection('invoices').update(inv.id, { status: 'paid' });
      if (!fullyPaid && inv.status === 'paid') await pb.collection('invoices').update(inv.id, { status: 'sent' });
      toast({ title: isEdit ? 'Payment updated' : 'Payment recorded', description: fullyPaid ? `${inv.invoice_number} is now marked paid.` : `${formatMoney(balance - amount, inv.currency)} still outstanding on ${inv.invoice_number}.` });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: 'Could not record payment', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit payment' : 'Record a payment'} description="Money received from a client against an invoice.">
      <div className="space-y-4">
        <Field label="Invoice" required>
          <select className={inputCls} value={form.invoice} onChange={(e) => {
            const i = invoices.find((x) => x.id === e.target.value);
            setForm((p) => ({ ...p, invoice: e.target.value, amount: i ? Math.max(0, Number(i.total || 0) - (paidByInvoice[i.id] || 0)) : 0 }));
          }}>
            <option value="">Choose an unpaid invoice…</option>
            {open_.map((i) => <option key={i.id} value={i.id}>{i.invoice_number} — {i.bill_to_company || i.bill_to_name} — {formatMoney(i.total, i.currency)}</option>)}
          </select>
        </Field>
        {inv && (
          <div className="rounded-xl border border-border bg-background p-3">
            <PaymentBar label="Invoice after this payment" total={inv.total} paid={(paidByInvoice[inv.id] || 0) + (Number(form.amount) || 0)} currency={inv.currency} />
            <p className="mt-2 text-xs text-muted-foreground">Updates as you type the amount. Balance before this payment: {formatMoney(balance, inv.currency)}.</p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount received" required><input type="number" min="0" className={inputCls} value={form.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
          <Field label="Date received"><input type="date" className={inputCls} value={form.paid_date} onChange={(e) => set('paid_date', e.target.value)} /></Field>
          <Field label="Method">
            <select className={inputCls} value={form.method} onChange={(e) => set('method', e.target.value)}>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Transaction reference"><input className={inputCls} value={form.transaction_reference} onChange={(e) => set('transaction_reference', e.target.value)} placeholder="Bank / MoMo reference" /></Field>
        </div>
        <Field label="Notes"><textarea className={textareaCls} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {isEdit ? 'Save changes' : 'Record payment'}</button>
        </div>
      </div>
    </Modal>
  );
}
