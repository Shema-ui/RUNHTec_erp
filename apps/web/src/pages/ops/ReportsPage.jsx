import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { TrendingUp, ReceiptText, FileText, FolderKanban, Banknote, HardHat, Download } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { Card, StatCard, Loading, todayISO, btnLine } from '@/components/erp/kit';
import { formatMoney, DEFAULT_CURRENCY } from '@/lib/money';
import { PROJECT_STATUSES, SERVICE_CATEGORIES } from '@/lib/projects';
import { Link } from 'react-router-dom';
import { computeCosting, marginTone, fixedFeeCosts } from '@/lib/costing';
import { splitExpenses, downloadCsv } from '@/lib/finance';

const C = DEFAULT_CURRENCY;
const ymd = () => todayISO();
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
      safe(pb.collection('projects').getFullList({ sort: 'code' })),
      safe(pb.collection('rfqs').getFullList({})),
      safe(pb.collection('project_assignments').getFullList({})),
      safe(pb.collection('project_costs').getFullList({})),
    ]).then(([invoices, payments, quotes, projects, rfqs, assignments, costs]) => setD({ invoices, payments, quotes, projects, rfqs, assignments, costs }));
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
    // Win rate counts real quotations only (not the copies made from invoices).
    const realQuotes = d.quotes.filter((q) => !q.source_invoice);
    const decided = realQuotes.filter((q) => ['accepted', 'declined', 'expired'].includes(q.status));
    const won = realQuotes.filter((q) => q.status === 'accepted');
    const winRate = decided.length ? Math.round((won.length / decided.length) * 100) : 0;
    const pipeline = d.quotes.filter((q) => q.status === 'sent').reduce((s, q) => s + Number(q.total || 0), 0);
    const owedContractors = d.assignments.filter((a) => a.status !== 'cancelled').reduce((s, a) => s + Math.max(0, Number(a.agreed_amount || 0) - Number(a.amount_paid || 0)), 0);
    const months = Array.from({ length: 6 }, (_, k) => {
      const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - (5 - k));
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      return { label: dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), value: sumPaid(key) };
    });
    const byStatus = PROJECT_STATUSES.map((s) => ({ label: s.label, value: d.projects.filter((p) => p.status === s.value).length }));
    const byService = SERVICE_CATEGORIES.map((s) => ({ label: s.label, value: d.projects.filter((p) => p.service_category === s.value).reduce((t, p) => t + Number(p.value || 0), 0) }))
      .filter((x) => x.value).sort((a, b) => b.value - a.value);
    const rfqMonth = d.rfqs.filter((x) => String(x.created).startsWith(month)).length;

    // Per project: price, every expense split by type, what the client has paid, and profit.
    const quoteById = Object.fromEntries(d.quotes.map((q) => [q.id, q]));
    const costsBy = {};
    d.costs.forEach((c) => { (costsBy[c.project] = costsBy[c.project] || []).push(c); });
    const receivedBy = {};
    d.invoices.forEach((i) => { if (i.project) receivedBy[i.project] = (receivedBy[i.project] || 0) + (paidByInv[i.id] || 0); });
    const profit = d.projects.filter((p) => p.status !== 'cancelled').map((p) => {
      const q = quoteById[p.quotation];
      const plan = q ? computeCosting({ items: Array.isArray(q.items) ? q.items : [], costing: q.costing, subtotal: q.subtotal, discount: q.discount_amount }) : null;
      const revenue = Number(p.value || 0) || (plan ? plan.revenue : 0);
      const planned = plan ? plan.totalCost : Number(p.cost_budget || 0);
      const split = splitExpenses(costsBy[p.id] || []);
      // Fixed-fee contractors from the Team section count as wages.
      const fixed = fixedFeeCosts(d.assignments.filter((a) => a.project === p.id)).total;
      split.wages += fixed;
      split.total += fixed;
      const received = receivedBy[p.id] || 0;
      return {
        id: p.id, code: p.code || '', title: p.title, status: p.status, revenue, planned,
        materials: split.materials, wages: split.wages, other: split.other, spent: split.total, unpaid: split.unpaid,
        received, plannedProfit: planned ? revenue - planned : null,
        profit: revenue - split.total, margin: revenue ? ((revenue - split.total) / revenue) * 100 : 0,
        cashProfit: received - split.total,
      };
    }).filter((x) => x.revenue || x.spent || x.received).sort((a, b) => b.revenue - a.revenue);
    const doneProfit = profit.filter((x) => x.status === 'done').reduce((s, x) => s + x.profit, 0);
    return { profit, doneProfit, month: sumPaid(month), year: sumPaid(year), invoicedYear, outstanding, overdue: overdue.length, winRate, won: won.length, decided: decided.length, pipeline, owedContractors, months, byStatus, byService, rfqMonth };
  }, [d]);

  const exportCsv = () => {
    if (!r) return;
    const head = ['Project code', 'Project', 'Status', 'Price excl. VAT', 'Materials', 'Wages', 'Transport & other', 'Total spent', 'Still unpaid', 'Received from client', 'Profit (price − spent)', 'Cash profit (received − spent)', 'Margin %'];
    const body = r.profit.map((x) => [x.code, x.title, x.status, x.revenue, x.materials, x.wages, x.other, x.spent, x.unpaid, x.received, x.profit, x.cashProfit, x.margin.toFixed(1)]);
    downloadCsv(`project-profit-${ymd()}.csv`, [head, ...body]);
  };

  return (
    <PortalLayout title="Reports" subtitle="Cash, sales and delivery at a glance">
      <Helmet><title>Reports | RUNHTec Business Portal</title></Helmet>
      {!r ? <Loading /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={TrendingUp} label="Cash received this month" value={formatMoney(r.month, C)} note={`${formatMoney(r.year, C)} this year`} tone="green" />
            <StatCard icon={ReceiptText} label="Outstanding from clients" value={formatMoney(r.outstanding, C)} note={`${r.overdue} invoice(s) past due`} tone={r.overdue ? 'red' : 'amber'} />
            <StatCard icon={FileText} label="Quotation win rate" value={`${r.winRate}%`} note={`${r.won} won of ${r.decided} decided · ${formatMoney(r.pipeline, C)} awaiting reply`} />
            <StatCard icon={HardHat} label="Owed to contractors" value={formatMoney(r.owedContractors, C)} tone={r.owedContractors ? 'red' : 'green'} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Cash received — last 6 months"><Bars rows={r.months} money /></Card>
            <Card title="Projects by status"><Bars rows={r.byStatus} /></Card>
            <Card title="Project value by service"><Bars rows={r.byService} money /></Card>
            <Card
              title="Profit by project (internal)"
              className="lg:col-span-2"
              action={r.profit.length > 0 && <button className={btnLine} onClick={exportCsv}><Download className="h-4 w-4" /> Download CSV</button>}
            >
              {r.profit.length === 0 ? <p className="text-sm text-muted-foreground">No projects with a price or costs yet. Add buying prices on quotations and log work days and expenses on projects.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3">Project</th>
                        <th className="py-2 pr-3 text-right">Price excl. VAT</th>
                        <th className="py-2 pr-3 text-right">Materials</th>
                        <th className="py-2 pr-3 text-right">Wages</th>
                        <th className="py-2 pr-3 text-right">Transport &amp; other</th>
                        <th className="py-2 pr-3 text-right">Total spent</th>
                        <th className="py-2 pr-3 text-right">Received</th>
                        <th className="py-2 pr-3 text-right">Profit</th>
                        <th className="py-2 text-right">Cash profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {r.profit.map((x) => (
                        <tr key={x.id}>
                          <td className="py-2 pr-3">
                            <Link to={`/projects/${x.id}`} className="font-medium hover:text-primary">{x.title}</Link>
                            <p className="text-xs text-muted-foreground">{x.code ? `${x.code} · ` : ''}<span className="capitalize">{String(x.status).replace('_', ' ')}</span></p>
                          </td>
                          <td className="py-2 pr-3 text-right">{formatMoney(x.revenue, C)}</td>
                          <td className="py-2 pr-3 text-right">{formatMoney(x.materials, C)}</td>
                          <td className="py-2 pr-3 text-right">{formatMoney(x.wages, C)}</td>
                          <td className="py-2 pr-3 text-right">{formatMoney(x.other, C)}</td>
                          <td className="py-2 pr-3 text-right font-semibold">{formatMoney(x.spent, C)}{x.unpaid > 0 && <p className="text-[11px] font-normal text-amber-700">{formatMoney(x.unpaid, C)} unpaid</p>}</td>
                          <td className="py-2 pr-3 text-right">{formatMoney(x.received, C)}</td>
                          <td className={`py-2 pr-3 text-right font-semibold ${marginTone(x.margin)}`}>{formatMoney(x.profit, C)} <span className="text-xs">({x.margin.toFixed(0)}%)</span></td>
                          <td className={`py-2 text-right font-semibold ${x.cashProfit < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatMoney(x.cashProfit, C)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-xs text-muted-foreground"><strong>Profit</strong> = price − everything spent. <strong>Cash profit</strong> = what the client has paid so far − everything spent. Prices exclude VAT; fixed-fee contractors count when paid. Check VAT treatment with your accountant.</p>
                  <p className="mt-2 text-sm">Profit on completed projects: <strong>{formatMoney(r.doneProfit, C)}</strong></p>
                </div>
              )}
            </Card>
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
