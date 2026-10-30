import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Plus, Loader2, Save, CreditCard } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Toolbar, SearchBox, Loading, Empty, StatCard, Modal, Field, inputCls, textareaCls, btnPrimary, btnLine, fmtDate, todayISO,
} from '@/components/erp/kit';
import { formatMoney, DEFAULT_CURRENCY } from '@/lib/money';
import SuperDelete from '@/components/erp/SuperDelete';

const METHODS = ['Bank transfer', 'Mobile money (MoMo)', 'Airtel Money', 'Cheque', 'Cash', 'Card', 'Other'];
const today = () => todayISO();

export default function PaymentsPage() {
  const [payments, setPayments] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [q, setQ] = useState('');
  const [recording, setRecording] = useState(false);

  const load = () => Promise.all([
    pb.collection('payments').getFullList({ sort: '-created', expand: 'invoice,client' }),
    pb.collection('invoices').getFullList({ sort: '-created' }),
  ]).then(([p, i]) => { setPayments(p); setInvoices(i); }).catch(() => setPayments([]));
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

  const filtered = (payments || []).filter((p) => !q || [p.reference, p.transaction_reference, p.expand?.invoice?.invoice_number, p.expand?.client?.company_name, p.expand?.invoice?.bill_to_company].join(' ').toLowerCase().includes(q.toLowerCase()));

  return (
    <PortalLayout title="Payments" subtitle="Money received from clients, matched to invoices">
      <Helmet><title>Payments | RUNHTec Business Portal</title></Helmet>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard icon={CreditCard} label="Received this month" value={formatMoney(stats.thisMonth, DEFAULT_CURRENCY)} tone="green" />
        <StatCard label="Still owed on sent invoices" value={formatMoney(stats.outstanding, DEFAULT_CURRENCY)} tone={stats.outstanding ? 'red' : 'green'} />
        <StatCard label="Invoices awaiting payment" value={stats.openCount} tone="amber" />
      </div>

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search invoice, client or reference" />
        <button className={`${btnPrimary} ml-auto`} onClick={() => setRecording(true)}><Plus className="h-4 w-4" /> Record payment</button>
      </Toolbar>

      {!payments ? <Loading /> : filtered.length === 0 ? (
        <Empty>No payments recorded yet. When a client pays, click “Record payment” and choose the invoice — it is marked paid automatically once fully settled.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3 text-right">Amount</th><th className="w-12 px-2 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">{fmtDate(p.paid_date || p.created)}</td>
                  <td className="px-4 py-3">{p.invoice ? <Link to={`/invoices/${p.invoice}/view`} className="font-medium text-primary hover:underline">{p.expand?.invoice?.invoice_number || 'Invoice'}</Link> : '—'}</td>
                  <td className="px-4 py-3">{p.expand?.client?.company_name || p.expand?.invoice?.bill_to_company || '—'}</td>
                  <td className="px-4 py-3">{p.method || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.transaction_reference || p.reference || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(p.amount, p.currency)}</td>
                  <td className="px-2 py-3 text-right"><SuperDelete collection="payments" id={p.id} label={`payment of ${formatMoney(p.amount, p.currency)}${p.expand?.invoice?.invoice_number ? ` on ${p.expand.invoice.invoice_number}` : ''}`} after={afterDelete(p)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RecordPaymentDialog open={recording} onClose={() => setRecording(false)} invoices={invoices} paidByInvoice={paidByInvoice} onSaved={load} />
    </PortalLayout>
  );
}

function RecordPaymentDialog({ open, onClose, invoices, paidByInvoice, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ invoice: '', amount: 0, method: METHODS[0], paid_date: today(), transaction_reference: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const open_ = invoices.filter((i) => ['sent', 'overdue', 'draft'].includes(i.status));
  const inv = invoices.find((i) => i.id === form.invoice);
  const balance = inv ? Math.max(0, Number(inv.total || 0) - (paidByInvoice[inv.id] || 0)) : 0;

  useEffect(() => { if (open) setForm({ invoice: '', amount: 0, method: METHODS[0], paid_date: today(), transaction_reference: '', notes: '' }); }, [open]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const amount = Number(form.amount) || 0;
    if (!inv || amount <= 0) { toast({ title: 'Choose an invoice and enter the amount received', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await pb.collection('payments').create({
        invoice: inv.id, client: inv.client || '', amount, currency: inv.currency || DEFAULT_CURRENCY,
        status: 'completed', method: form.method, paid_date: form.paid_date,
        reference: inv.invoice_number, transaction_reference: form.transaction_reference, notes: form.notes,
        recorded_by_name: user?.name || user?.email || '',
      });
      const fullyPaid = (paidByInvoice[inv.id] || 0) + amount >= Number(inv.total || 0) - 0.5;
      if (fullyPaid && inv.status !== 'paid') await pb.collection('invoices').update(inv.id, { status: 'paid' });
      toast({ title: 'Payment recorded', description: fullyPaid ? `${inv.invoice_number} is now marked paid.` : `${formatMoney(balance - amount, inv.currency)} still outstanding on ${inv.invoice_number}.` });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: 'Could not record payment', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Record a payment" description="Money received from a client against an invoice.">
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
        {inv && <p className="rounded-lg bg-secondary/50 px-3 py-2 text-sm">Balance due: <strong>{formatMoney(balance, inv.currency)}</strong> of {formatMoney(inv.total, inv.currency)}</p>}
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
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Record payment</button>
        </div>
      </div>
    </Modal>
  );
}
