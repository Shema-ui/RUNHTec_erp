import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { TrendingUp, ReceiptText, FileText, FolderKanban, Banknote, HardHat } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { Card, StatCard, Loading } from '@/components/erp/kit';
import { formatMoney, DEFAULT_CURRENCY } from '@/lib/money';
import { PROJECT_STATUSES, SERVICE_CATEGORIES } from '@/lib/projects';

const C = DEFAULT_CURRENCY;
const ymd = () => new Date().toISOString().slice(0, 10);
const safe = (p) => p.catch(() => []);

function Bars({ rows, money }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.some((r) => r.value)) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
          <span className="truncate">{r.label}</span>
          <span className="font-semibold">{money ? formatMoney(r.value, C) : r.value}</span>
          <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-secondary"><span className="block h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}

export default function ReportsPage() {
  const [d, setD] = useState(null);

  useEffect(() => {
    Promise.all([
      safe(pb.collection('invoices').getFullList({})),
      safe(pb.collection('payments').getFullList({})),
      safe(pb.collection('quotations').getFullList({})),
      safe(pb.collection('projects').getFullList({})),
      safe(pb.collection('rfqs').getFullList({})),
      safe(pb.collection('project_assignments').getFullList({})),
    ]).then(([invoices, payments, quotes, projects, rfqs, assignments]) => setD({ invoices, payments, quotes, projects, rfqs, assignments }));
  }, []);

  const r = useMemo(() => {
    if (!d) return null;
    const month = ymd().slice(0, 7);
    const year = ymd().slice(0, 4);
    const paid = d.payments.filter((p) => p.status === 'completed');
    const sumPaid = (prefix) => paid.filter((p) => String(p.paid_date || p.created).startsWith(prefix)).reduce((s, p) => s + Number(p.amount || 0), 0);
    const live = d.invoices.filter((i) => !['draft', 'cancelled'].includes(i.status));
    const invoicedYear = live.filter((i) => String(i.invoice_date || i.created).startsWith(year)).reduce((s, i) => s + Number(i.total || 0), 0);
    const paidByInv = {};
    paid.forEach((p) => { if (p.invoice) paidByInv[p.invoice] = (paidByInv[p.invoice] || 0) + Number(p.amount || 0); });
    const open = d.invoices.filter((i) => ['sent', 'overdue'].includes(i.status));
    const outstanding = open.reduce((s, i) => s + Math.max(0, Number(i.total || 0) - (paidByInv[i.id] || 0)), 0);
    const overdue = open.filter((i) => i.status === 'overdue' || (i.due_date && i.due_date < ymd()));
    const decided = d.quotes.filter((q) => ['accepted', 'declined', 'expired'].includes(q.status));
    const won = d.quotes.filter((q) => q.status === 'accepted');
    const winRate = decided.length ? Math.round((won.length / decided.length) * 100) : 0;
    const pipeline = d.quotes.filter((q) => q.status === 'sent').reduce((s, q) => s + Number(q.total || 0), 0);
    const owedContractors = d.assignments.filter((a) => a.status !== 'cancelled').reduce((s, a) => s + Math.max(0, Number(a.agreed_amount || 0) - Number(a.amount_paid || 0)), 0);
    const months = Array.from({ length: 6 }, (_, k) => {
      const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - (5 - k));
      const key = dt.toISOString().slice(0, 7);
      return { label: dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), value: sumPaid(key) };
    });
    const byStatus = PROJECT_STATUSES.map((s) => ({ label: s.label, value: d.projects.filter((p) => p.status === s.value).length }));
    const byService = SERVICE_CATEGORIES.map((s) => ({ label: s.label, value: d.projects.filter((p) => p.service_category === s.value).reduce((t, p) => t + Number(p.value || 0), 0) }))
      .filter((x) => x.value).sort((a, b) => b.value - a.value);
    const rfqMonth = d.rfqs.filter((x) => String(x.created).startsWith(month)).length;
    return { month: sumPaid(month), year: sumPaid(year), invoicedYear, outstanding, overdue: overdue.length, winRate, won: won.length, decided: decided.length, pipeline, owedContractors, months, byStatus, byService, rfqMonth };
  }, [d]);

  return (
    <PortalLayout title="Reports" subtitle="Cash, sales and delivery at a glance">
      <Helmet><title>Reports | RUNHTec Business Portal</title></Helmet>
      {!r ? <Loading /> : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={TrendingUp} label="Cash received this month" value={formatMoney(r.month, C)} note={`${formatMoney(r.year, C)} this year`} tone="green" />
            <StatCard icon={ReceiptText} label="Outstanding from clients" value={formatMoney(r.outstanding, C)} note={`${r.overdue} invoice(s) past due`} tone={r.overdue ? 'red' : 'amber'} />
            <StatCard icon={FileText} label="Quotation win rate" value={`${r.winRate}%`} note={`${r.won} won of ${r.decided} decided · ${formatMoney(r.pipeline, C)} awaiting reply`} />
            <StatCard icon={HardHat} label="Owed to contractors" value={formatMoney(r.owedContractors, C)} tone={r.owedContractors ? 'red' : 'green'} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Cash received — last 6 months"><Bars rows={r.months} money /></Card>
            <Card title="Projects by status"><Bars rows={r.byStatus} /></Card>
            <Card title="Project value by service"><Bars rows={r.byService} money /></Card>
            <Card title="This year">
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between"><span className="inline-flex items-center gap-2"><ReceiptText className="h-4 w-4 text-muted-foreground" />Invoiced</span><strong>{formatMoney(r.invoicedYear, C)}</strong></li>
                <li className="flex justify-between"><span className="inline-flex items-center gap-2"><Banknote className="h-4 w-4 text-muted-foreground" />Received</span><strong>{formatMoney(r.year, C)}</strong></li>
                <li className="flex justify-between"><span className="inline-flex items-center gap-2"><FolderKanban className="h-4 w-4 text-muted-foreground" />Website requests this month</span><strong>{r.rfqMonth}</strong></li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">Figures are in {C}; amounts recorded in other currencies are added as entered.</p>
            </Card>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
