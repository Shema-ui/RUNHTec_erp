import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import {
  Banknote, ReceiptText, AlertTriangle, FileText, FolderKanban, Wrench, Inbox, Clock3, Plus,
  ArrowUpRight, ArrowDownRight, Activity, ChevronRight, CalendarClock, PhoneCall, CheckCircle2,
} from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import { useAuth } from '@/context/AuthContext';
import { roleLabel, canAccessModule } from '@/lib/permissions';
import TechnicianDashboard from '@/components/erp/TechnicianDashboard';
import pb from '@/lib/pocketbaseClient';
import { formatMoney, formatMoneyShort, DEFAULT_CURRENCY } from '@/lib/money';
import { fmtDate, todayISO } from '@/components/erp/kit';
import { PROJECT_STATUSES } from '@/lib/projects';

// ─────────────────────────────────────────────────────────────────────────────
// The main Dashboard: a business overview (money, quotes, projects, what needs
// attention today). Client/lead counts live on the CRM Dashboard instead.
// Each section only shows to people allowed to open that module, so e.g.
// sales staff never see invoice totals here.
// Colours used by the charts — change them here if you want.
const COLORS = {
  blue: '#003DA5', // RUNHTec blue
  blueLight: '#8FB2EC',
  green: '#16A34A',
  amber: '#D97706',
  red: '#DC2626',
  grey: '#94A3B8',
};
// ─────────────────────────────────────────────────────────────────────────────

const C = DEFAULT_CURRENCY;
const n = (v) => Number(v) || 0;
const safe = (ok, p) => (ok ? p.catch(() => []) : Promise.resolve([]));
const dayOf = (v) => String(v || '').slice(0, 10);
const monthOf = (v) => String(v || '').slice(0, 7);

function ago(v) {
  if (!v) return '';
  const mins = Math.max(1, Math.round((Date.now() - new Date(String(v).replace(' ', 'T')).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

// Convert any currency to RWF with the rates from Settings → Vendor prices.
// Amounts in a currency with no rate set are left out (and counted in `skipped`).
function makeToRwf(rates) {
  return (amount, cur) => {
    const c = cur || 'RWF';
    if (c === 'RWF') return n(amount);
    const r = n(rates?.[c]);
    return r > 0 ? n(amount) * r : null;
  };
}

function KpiCard({ icon: Icon, label, value, sub, trend, tone, to, i }) {
  const body = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: i * 0.05 }}
      className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
    >
      <span className={`absolute right-0 top-0 h-full w-1.5 ${tone.bar}`} />
      <div className="flex items-center justify-between gap-2">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.icon}`}><Icon className="h-5 w-5" /></span>
        {trend != null && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-[13px] font-medium text-foreground/80">{label}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </motion.div>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}

function Panel({ title, icon: Icon, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
          {Icon && <Icon className="h-4 w-4 text-primary" />}{title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function NeedsAttention({ todo }) {
  return (
          <Panel title="Needs attention" icon={AlertTriangle}>
            {todo.every((t) => !t.count) ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <p className="text-sm font-medium text-foreground">All caught up</p>
                <p className="text-xs text-muted-foreground">Nothing waiting on you right now.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {todo.filter((t) => t.count).map((t) => {
                  const Icon = t.icon;
                  return (
                    <li key={t.key}>
                      <Link to={t.to} className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:bg-secondary/60">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.tone}`}><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1 text-sm text-foreground"><span className="font-display text-base font-extrabold">{t.count}</span> {t.text(t.count)}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

  );
}

const SeeAll = ({ to, children = 'See all' }) => (
  <Link to={to} className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">{children}<ChevronRight className="h-3.5 w-3.5" /></Link>
);

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />{p.name}: <span className="font-semibold text-foreground">{formatMoney(p.value, C)}</span>
        </p>
      ))}
    </div>
  );
}

function CountTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <span className="font-semibold text-foreground">{p.payload.label}</span>: {p.value}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isTech = ['technician', 'lead_technician'].includes(user?.role);
  const can = (m) => canAccessModule(user, m);
  const seeMoney = can('invoices');
  const seeQuotes = can('quotations');
  const seeProjects = can('projects');
  const seeRfq = can('rfq');
  const seeMaint = can('maintenance');
  const seeCrm = can('crm');
  const [d, setD] = useState(null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    if (isTech) return undefined;
    let cancelled = false;
    Promise.all([
      safe(seeMoney, pb.collection('invoices').getFullList({ sort: '-created' })),
      safe(seeMoney, pb.collection('payments').getFullList({ sort: '-created' })),
      safe(seeQuotes, pb.collection('quotations').getFullList({ sort: '-created', expand: 'client' })),
      safe(seeProjects, pb.collection('projects').getFullList({ sort: '-updated', expand: 'client' })),
      safe(seeRfq, pb.collection('rfqs').getFullList({ sort: '-created' })),
      safe(seeMaint, pb.collection('maintenance_contracts').getFullList({ expand: 'client' })),
      safe(seeCrm, pb.collection('client_followups').getFullList({ filter: "status = 'pending'", sort: 'due_date', expand: 'client' })),
      pb.collection('client_activities').getList(1, 8, { sort: '-created' }).then((r) => r.items || []).catch(() => []),
      pb.collection('company_settings').getList(1, 1).then((r) => r.items?.[0] || {}).catch(() => ({})),
    ]).then(([invoices, payments, quotes, projects, rfqs, maint, followups, activity, cfg]) => {
      if (cancelled) return;
      let rates = cfg.exchange_rates;
      if (typeof rates === 'string') { try { rates = JSON.parse(rates); } catch { rates = {}; } }
      setD({ invoices, payments, quotes, projects, rfqs, maint, followups, activity, rates: rates || {} });
    });
    return () => { cancelled = true; };
  }, [isTech, seeMoney, seeQuotes, seeProjects, seeRfq, seeMaint, seeCrm]);

  const r = useMemo(() => {
    if (!d) return null;
    const toRwf = makeToRwf(d.rates);
    let skipped = 0;
    const rwf = (amount, cur) => { const v = toRwf(amount, cur); if (v === null) { skipped += 1; return 0; } return v; };
    const today = todayISO();
    const thisMonth = today.slice(0, 7);
    const lm = new Date(); lm.setDate(1); lm.setMonth(lm.getMonth() - 1);
    const lastMonth = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`;
    const in7 = todayISO(7);

    // Money
    const paid = d.payments.filter((p) => p.status === 'completed');
    const paidDate = (p) => dayOf(p.paid_date || p.created);
    const received = (m) => paid.filter((p) => monthOf(paidDate(p)) === m).reduce((s, p) => s + rwf(p.amount, p.currency), 0);
    const recThis = received(thisMonth);
    const recLast = received(lastMonth);
    const trend = recLast > 0 ? Math.round(((recThis - recLast) / recLast) * 100) : null;
    const paidByInv = {};
    paid.forEach((p) => { if (p.invoice) paidByInv[p.invoice] = (paidByInv[p.invoice] || 0) + n(p.amount); });
    const open = d.invoices.filter((i) => ['sent', 'overdue'].includes(i.status));
    const balance = (i) => Math.max(0, n(i.total) - (paidByInv[i.id] || 0));
    const isLate = (i) => i.status === 'overdue' || (i.due_date && i.due_date < today);
    const outstanding = open.reduce((s, i) => s + rwf(balance(i), i.currency), 0);
    const lateInv = open.filter((i) => isLate(i) && balance(i) > 0);
    const lateAmount = lateInv.reduce((s, i) => s + rwf(balance(i), i.currency), 0);

    // Last 6 months: invoiced vs received
    const months = Array.from({ length: 6 }, (_, k) => {
      const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - (5 - k));
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      return {
        label: dt.toLocaleDateString('en-GB', { month: 'short' }),
        invoiced: d.invoices.filter((i) => !['draft', 'cancelled'].includes(i.status) && monthOf(i.invoice_date || i.created) === key)
          .reduce((s, i) => s + rwf(i.total, i.currency), 0),
        received: received(key),
      };
    });

    // Quotes
    const awaiting = d.quotes.filter((q) => q.status === 'sent');
    const awaitingValue = awaiting.reduce((s, q) => s + rwf(q.total, q.currency), 0);
    const staleQuotes = awaiting.filter((q) => dayOf(q.updated || q.created) <= todayISO(-7));
    const year = today.slice(0, 4);
    const qYear = d.quotes.filter((q) => String(q.created).startsWith(year));
    const qCount = (s) => qYear.filter((q) => q.status === s).length;
    const quoteMix = [
      { label: 'Accepted', value: qCount('accepted'), color: COLORS.green },
      { label: 'Waiting', value: qCount('sent'), color: COLORS.amber },
      { label: 'Declined', value: qCount('declined'), color: COLORS.red },
      { label: 'Expired', value: qCount('expired'), color: COLORS.grey },
    ];
    const decided = qCount('accepted') + qCount('declined') + qCount('expired');
    const winRate = decided ? Math.round((qCount('accepted') / decided) * 100) : null;

    // Projects
    const active = d.projects.filter((p) => ['planning', 'scheduled', 'in_progress', 'on_hold'].includes(p.status));
    const lateProjects = active.filter((p) => p.due_date && p.due_date < today);
    const byStatus = PROJECT_STATUSES.filter((s) => s.value !== 'cancelled')
      .map((s) => ({ label: s.label, value: d.projects.filter((p) => p.status === s.value).length }));
    const doneThisMonth = d.projects.filter((p) => p.status === 'done' && monthOf(p.completed_date || p.updated) === thisMonth).length;

    // Today's to-do
    const openReq = (x) => ['', 'new', 'reviewing', undefined, null].includes(x.request_status);
    const newEnquiries = d.rfqs.filter((x) => openReq(x));
    const maintDue = d.maint.filter((m) => Number(m.active) !== 0 && m.active !== false && m.next_due_date && m.next_due_date <= in7);
    const followDue = d.followups.filter((f) => f.due_date && dayOf(f.due_date) <= today);

    const todo = [
      seeRfq && { key: 'rfq', icon: Inbox, tone: 'bg-blue-50 text-blue-700', count: newEnquiries.length, text: (c) => `new website request${c === 1 ? '' : 's'} to answer`, to: '/rfqs' },
      seeQuotes && { key: 'stale', icon: PhoneCall, tone: 'bg-amber-50 text-amber-700', count: staleQuotes.length, text: (c) => `quote${c === 1 ? '' : 's'} sent over a week ago — follow up`, to: '/quotations' },
      seeMoney && { key: 'late', icon: AlertTriangle, tone: 'bg-rose-50 text-rose-700', count: lateInv.length, text: (c) => `overdue invoice${c === 1 ? '' : 's'} to chase`, to: '/invoices' },
      seeProjects && { key: 'lateP', icon: CalendarClock, tone: 'bg-rose-50 text-rose-700', count: lateProjects.length, text: (c) => `project${c === 1 ? '' : 's'} past the due date`, to: '/projects' },
      seeMaint && { key: 'maint', icon: Wrench, tone: 'bg-violet-50 text-violet-700', count: maintDue.length, text: (c) => `maintenance visit${c === 1 ? '' : 's'} due this week`, to: '/maintenance' },
      seeCrm && { key: 'fu', icon: Clock3, tone: 'bg-indigo-50 text-indigo-700', count: followDue.length, text: (c) => `client follow-up${c === 1 ? '' : 's'} due`, to: '/crm' },
    ].filter(Boolean);

    return {
      recThis, trend, outstanding, open, lateInv, lateAmount, months, awaiting, awaitingValue, quoteMix, winRate,
      active, lateProjects, byStatus, doneThisMonth, todo, skipped,
    };
  }, [d, seeRfq, seeQuotes, seeMoney, seeProjects, seeMaint, seeCrm]);

  const actions = [
    seeQuotes && { to: '/quotations/new', label: 'New quotation', icon: FileText },
    seeProjects && can('projects') && ['super_admin', 'admin', 'project_manager'].includes(user?.role) && { to: '/projects/new', label: 'New project', icon: FolderKanban },
    seeMoney && { to: '/invoices/new', label: 'New invoice', icon: ReceiptText },
  ].filter(Boolean);

  const kpis = r ? [
    seeMoney && { key: 'rec', icon: Banknote, label: 'Received this month', value: formatMoneyShort(r.recThis, C), sub: r.trend == null ? 'No payments last month to compare' : 'compared with last month', trend: r.trend, tone: { icon: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' }, to: '/payments' },
    seeMoney && { key: 'out', icon: ReceiptText, label: 'Unpaid invoices', value: formatMoneyShort(r.outstanding, C), sub: `${r.open.length} invoice${r.open.length === 1 ? '' : 's'} not fully paid`, tone: { icon: 'bg-blue-50 text-blue-700', bar: 'bg-blue-600' }, to: '/invoices' },
    seeMoney && { key: 'late', icon: AlertTriangle, label: 'Overdue', value: formatMoneyShort(r.lateAmount, C), sub: `${r.lateInv.length} past the due date`, tone: { icon: 'bg-rose-50 text-rose-700', bar: 'bg-rose-500' }, to: '/invoices' },
    seeQuotes && { key: 'quotes', icon: FileText, label: 'Quotes awaiting answer', value: formatMoneyShort(r.awaitingValue, C), sub: `${r.awaiting.length} quote${r.awaiting.length === 1 ? '' : 's'} sent`, tone: { icon: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500' }, to: '/quotations' },
    seeProjects && { key: 'proj', icon: FolderKanban, label: 'Active projects', value: r.active.length, sub: `${r.doneThisMonth} completed this month`, tone: { icon: 'bg-indigo-50 text-indigo-700', bar: 'bg-indigo-500' }, to: '/projects' },
  ].filter(Boolean).slice(0, 4) : [];

  return (
    <PortalLayout title={isTech ? 'My work' : 'Dashboard'} subtitle={isTech ? 'Your projects, tasks and visits' : 'Business overview'}>
      <Helmet>
        <title>Dashboard | RUNHTec Business Portal</title>
      </Helmet>

      {/* Welcome banner */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#002B75] via-[#003DA5] to-[#1D5BD0] p-5 text-white shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-[#E4141B]/25" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-blue-100">{greeting},</p>
            <h2 className="font-display text-xl font-extrabold tracking-tight sm:text-3xl">{user?.name || 'Welcome back'}</h2>
            <p className="mt-1 text-sm text-blue-100">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {roleLabel(user?.role)}
            </p>
          </div>
          {!isTech && actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Link key={a.to} to={a.to} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25">
                  <Plus className="h-4 w-4" />{a.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {isTech ? <TechnicianDashboard user={user} /> : !r ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (<>
        {/* KPI cards */}
        {kpis.length > 0 && (
          <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${kpis.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            {kpis.map((k, i) => <KpiCard key={k.key} {...k} i={i} />)}
          </div>
        )}
        {seeMoney && r.skipped > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Some amounts are in a currency with no exchange rate set, so they’re left out. Add rates in Settings → Vendor prices.</p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left (wide) column */}
          <div className="space-y-6 lg:col-span-2">
          {/* On phones the to-do list comes first */}
          <div className="lg:hidden"><NeedsAttention todo={r.todo} /></div>
          {/* Cash flow chart */}
          {seeMoney && (
            <Panel title="Invoiced vs received — last 6 months" icon={Banknote} action={<SeeAll to="/reports">Reports</SeeAll>}>
              {r.months.some((m) => m.invoiced || m.received) ? (
                <div className="h-64 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={r.months} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#E5EAF2" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                      <YAxis tickLine={false} axisLine={false} width={58} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => formatMoneyShort(v, '').trim()} />
                      <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(0,61,165,0.06)' }} />
                      <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="invoiced" name="Invoiced" fill={COLORS.blueLight} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                      <Bar dataKey="received" name="Received" fill={COLORS.blue} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="py-10 text-center text-sm text-muted-foreground">No invoices or payments in the last 6 months yet.</p>}
              <p className="mt-2 text-xs text-muted-foreground">All amounts shown in {C}.</p>
            </Panel>
          )}

          {/* Projects */}
          {seeProjects && (
            <Panel title="Active projects" icon={FolderKanban} action={<SeeAll to="/projects" />}>
              <div className="grid gap-6 md:grid-cols-5">
                <div className="md:col-span-3">
                  {r.active.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No active projects right now.</p> : (
                    <ul className="space-y-3">
                      {r.active.slice(0, 5).map((p) => {
                        const late = p.due_date && p.due_date < todayISO();
                        const pct = Math.max(0, Math.min(100, n(p.progress)));
                        return (
                          <li key={p.id}>
                            <Link to={`/projects/${p.id}`} className="block rounded-xl p-2 -m-2 transition hover:bg-secondary/60">
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="truncate font-medium text-foreground">{p.title}</span>
                                <span className="shrink-0 font-semibold text-foreground">{pct}%</span>
                              </div>
                              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: late ? COLORS.red : COLORS.blue }} />
                              </div>
                              <p className={`mt-1 text-xs ${late ? 'font-semibold text-rose-600' : 'text-muted-foreground'}`}>
                                {p.expand?.client?.company_name ? `${p.expand.client.company_name} · ` : ''}
                                {p.due_date ? (late ? `Late — was due ${fmtDate(p.due_date)}` : `Due ${fmtDate(p.due_date)}`) : 'No due date'}
                              </p>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="md:col-span-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">All projects by status</p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={r.byStatus} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide allowDecimals={false} />
                        <YAxis type="category" dataKey="label" width={84} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                        <Tooltip content={<CountTooltip />} cursor={{ fill: 'rgba(0,61,165,0.06)' }} />
                        <Bar dataKey="value" fill={COLORS.blue} radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fontSize: 12, fill: '#0F172A' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          </div>

          {/* Right column */}
          <div className="space-y-6">
          <div className="hidden lg:block"><NeedsAttention todo={r.todo} /></div>
          {/* Quote results donut */}
          {seeQuotes && (
            <Panel title={`Quotes this year`} icon={FileText} action={<SeeAll to="/quotations" />}>
              {r.quoteMix.some((q) => q.value) ? (
                <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
                  <div className="relative h-44 w-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={r.quoteMix.filter((q) => q.value)} dataKey="value" nameKey="label" innerRadius="66%" outerRadius="100%" paddingAngle={2} stroke="#FFFFFF" strokeWidth={2}>
                          {r.quoteMix.filter((q) => q.value).map((q) => <Cell key={q.label} fill={q.color} />)}
                        </Pie>
                        <Tooltip content={<CountTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-2xl font-extrabold text-foreground">{r.winRate == null ? '—' : `${r.winRate}%`}</span>
                      <span className="text-[11px] text-muted-foreground">win rate</span>
                    </div>
                  </div>
                  <ul className="w-full space-y-2 text-sm">
                    {r.quoteMix.map((q) => (
                      <li key={q.label} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: q.color }} />{q.label}</span>
                        <span className="font-semibold text-foreground">{q.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : <p className="py-10 text-center text-sm text-muted-foreground">No quotations this year yet.</p>}
              <p className="mt-3 text-xs text-muted-foreground">Win rate = accepted ÷ (accepted + declined + expired).</p>
            </Panel>
          )}

          {/* Recent activity */}
          <Panel title="Recent activity" icon={Activity}>
            {d.activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
              <ol className="relative space-y-4 border-l border-border pl-4">
                {d.activity.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                    <p className="text-sm font-medium text-foreground">{a.description || 'Activity recorded'}</p>
                    <p className="text-xs text-muted-foreground">{a.actor_name || 'System'} · {ago(a.created)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          </div>
        </div>

        {seeCrm && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Client numbers, leads and the sales pipeline are on the <Link to="/crm" className="font-semibold text-primary hover:underline">CRM Dashboard</Link>.
          </p>
        )}
      </>)}
    </PortalLayout>
  );
}
