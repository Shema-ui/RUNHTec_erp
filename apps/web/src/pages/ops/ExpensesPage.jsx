import React, { useEffect, useMemo, useState } from 'react';
import BusinessFilter, { inBusiness } from '@/components/erp/BusinessFilter';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Receipt, Plus, Download, Search } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { Card, StatCard, Loading, Empty, Field, inputCls, btnPrimary, btnLine, fmtDate, todayISO } from '@/components/erp/kit';
import { ExpenseDialog } from '@/components/erp/ProjectCostsCard';
import { canSeeCosts, COST_CATEGORIES } from '@/lib/costing';
import { formatMoney, DEFAULT_CURRENCY } from '@/lib/money';
import { expenseTypeLabel, downloadCsv } from '@/lib/finance';

const safe = (p) => p.catch(() => []);

// All project expenses in one place, filterable by project, type and month.
export default function ExpensesPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null);
  const [costs, setCosts] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState('');
  const [month, setMonth] = useState('');
  const [q, setQ] = useState('');
  const [business, setBusiness] = useState('all');
  const [addOpen, setAddOpen] = useState(false);

  const load = () => Promise.all([
    safe(pb.collection('projects').getFullList({ sort: 'code' })),
    safe(pb.collection('project_costs').getFullList({ sort: '-cost_date' })),
  ]).then(([p, c]) => { setProjects(p); setCosts(c); });
  useEffect(() => { load(); }, []);

  const projectById = useMemo(() => Object.fromEntries((projects || []).map((p) => [p.id, p])), [projects]);
  const rows = useMemo(() => (costs || []).filter((c) => inBusiness(c, business)).filter((c) => {
    if (projectId && c.project !== projectId) return false;
    if (type && c.category !== type) return false;
    if (month && !String(c.cost_date || '').startsWith(month)) return false;
    if (q) {
      const hay = `${c.description || ''} ${c.worker_name || ''} ${c.notes || ''} ${projectById[c.project]?.title || ''} ${projectById[c.project]?.code || ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [business, costs, projectId, type, month, q, projectById]);

  // Totals are per currency, so mixed-currency projects never get added together.
  const byCurrency = useMemo(() => {
    const m = {};
    rows.forEach((c) => { const cur = c.currency || DEFAULT_CURRENCY; m[cur] = (m[cur] || 0) + (Number(c.amount) || 0); });
    return m;
  }, [rows]);
  const unpaid = rows.filter((c) => !c.paid).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const selectedProject = projectById[projectId];

  const exportCsv = () => {
    const head = ['Date', 'Project code', 'Project', 'Type', 'What', 'Amount', 'Currency', 'Paid', 'Recorded by'];
    const body = rows.map((c) => {
      const p = projectById[c.project] || {};
      return [c.cost_date || '', p.code || '', p.title || '', expenseTypeLabel(c), c.description || c.worker_name || '', c.amount || 0, c.currency || DEFAULT_CURRENCY, c.paid ? 'Yes' : 'No', c.recorded_by_name || ''];
    });
    downloadCsv(`expenses-${todayISO()}.csv`, [head, ...body]);
  };

  if (!canSeeCosts(user)) {
    return (
      <PortalLayout title="Expenses" subtitle="Money spent on projects">
        <Helmet><title>Expenses | RUNHTec Business Portal</title></Helmet>
        <Empty>You don’t have access to project expenses. Ask an administrator if you need it.</Empty>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Expenses" subtitle="Money spent on every project, in one place">
      <Helmet><title>Expenses | RUNHTec Business Portal</title></Helmet>
      {!costs || !projects ? <Loading /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard icon={Receipt} label="Spent (shown)" value={Object.keys(byCurrency).length ? Object.entries(byCurrency).map(([cur, v]) => formatMoney(v, cur)).join(' + ') : formatMoney(0)} note={`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`} />
            <StatCard icon={Receipt} label="Not yet paid out" value={formatMoney(unpaid, DEFAULT_CURRENCY)} note="Shown in the currency of each entry" tone={unpaid ? 'amber' : 'green'} />
            <StatCard icon={Receipt} label="Projects with expenses" value={new Set(rows.map((c) => c.project)).size} note="In the current view" />
            <StatCard icon={Receipt} label="Awaiting approval" value={rows.filter((c) => !c.approved).length} note="Accountant or admin to approve" tone={rows.some((c) => !c.approved) ? 'amber' : 'green'} />
          </div>

          <Card
            title="All expenses"
            action={(
              <div className="flex flex-wrap gap-2">
                <button className={btnLine} onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" /> Download CSV</button>
                <button className={btnPrimary} onClick={() => setAddOpen(true)} disabled={!projects.length}><Plus className="h-4 w-4" /> Add expense</button>
              </div>
            )}
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Business">
                <BusinessFilter value={business} onChange={setBusiness} />
              </Field>
              <Field label="Project">
                <select className={inputCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">All projects</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.title}</option>)}
                </select>
              </Field>
              <Field label="Type">
                <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">All types</option>
                  {COST_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Month">
                <input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} />
              </Field>
              <Field label="Search">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input className={`${inputCls} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Description, worker, project" />
                </div>
              </Field>
            </div>

            {rows.length === 0 ? (
              <Empty>No expenses match these filters. Add one with “Add expense”, or log wages from a project’s page.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Project</th><th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">What</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3 text-center">Paid</th><th className="py-2">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((c) => {
                      const p = projectById[c.project];
                      return (
                        <tr key={c.id}>
                          <td className="whitespace-nowrap py-2 pr-3">{fmtDate(c.cost_date) || '—'}</td>
                          <td className="py-2 pr-3">
                            {p ? <Link to={`/projects/${p.id}`} className="font-medium hover:text-primary">{p.title}</Link> : <span className="text-muted-foreground">Deleted project</span>}
                            {p?.code && <p className="text-xs text-muted-foreground">{p.code}</p>}
                          </td>
                          <td className="py-2 pr-3">{expenseTypeLabel(c)}</td>
                          <td className="py-2 pr-3">{c.description || c.worker_name || '—'}</td>
                          <td className="py-2 pr-3 text-right font-semibold">{formatMoney(c.amount, c.currency || DEFAULT_CURRENCY)}</td>
                          <td className="py-2 pr-3 text-center">{c.paid ? 'Yes' : <span className="text-amber-700">No</span>}</td>
                          <td className="py-2 text-xs text-muted-foreground">{c.recorded_by_name || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-muted-foreground">Amounts are in each project’s own currency.</p>
              </div>
            )}
          </Card>

          {addOpen && (
            <AddExpense projects={projects} onClose={() => setAddOpen(false)} onSaved={load} initialId={projectId} />
          )}
        </div>
      )}
    </PortalLayout>
  );
}

// Pick the project first, then reuse the same expense form the project page uses.
function AddExpense({ projects, onClose, onSaved, initialId }) {
  const [id, setId] = useState(initialId || (projects[0]?.id || ''));
  const [started, setStarted] = useState(false);
  const project = projects.find((p) => p.id === id);
  return (
    <>
      {!started && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl">
            <h3 className="font-display text-lg font-bold">Which project is this expense for?</h3>
            <div className="mt-4">
              <Field label="Project" required>
                <select className={inputCls} value={id} onChange={(e) => setId(e.target.value)}>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.title}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className={btnLine} onClick={onClose}>Cancel</button>
              <button className={btnPrimary} disabled={!project} onClick={() => setStarted(true)}>Continue</button>
            </div>
          </div>
        </div>
      )}
      {started && project && (
        <ExpenseDialog open project={project} onClose={onClose} onSaved={onSaved} />
      )}
    </>
  );
}
