import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Plus, Printer, Pencil } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import HrTabs from './HrTabs';
import EngagementDialog from '@/components/erp/EngagementDialog';
import { Toolbar, SearchBox, FilterSelect, Loading, Empty, Pill, StatCard, btnPrimary, fmtDate } from '@/components/erp/kit';
import { ASSIGNMENT_STATUSES, CONTRACTOR_PAYMENT_STATUSES, statusInfo } from '@/lib/hr';
import { formatMoney, DEFAULT_CURRENCY } from '@/lib/money';

export default function EngagementsPage() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [pay, setPay] = useState('all');
  const [editing, setEditing] = useState(null); // engagement object, or {} for new

  const load = () => pb.collection('project_assignments').getFullList({ sort: '-created', expand: 'contractor,project' })
    .then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => (items || []).filter((a) => {
    if (status !== 'all' && a.status !== status) return false;
    if (pay !== 'all' && a.payment_status !== pay) return false;
    if (q && ![a.expand?.contractor?.full_name, a.expand?.project?.title, a.role_on_project].join(' ').toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, q, status, pay]);

  const sums = useMemo(() => {
    const list = filtered.filter((a) => a.status !== 'cancelled');
    const agreed = list.reduce((s, a) => s + Number(a.agreed_amount || 0), 0);
    const paid = list.reduce((s, a) => s + Number(a.amount_paid || 0), 0);
    return { agreed, paid, owed: Math.max(0, agreed - paid) };
  }, [filtered]);

  return (
    <PortalLayout title="Project engagements" subtitle="Every per-project contract: scope, fee, dates and payment">
      <Helmet><title>Project engagements | RUNHTec Business Portal</title></Helmet>
      <HrTabs />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Fees agreed (shown)" value={formatMoney(sums.agreed, DEFAULT_CURRENCY)} />
        <StatCard label="Paid" value={formatMoney(sums.paid, DEFAULT_CURRENCY)} tone="green" />
        <StatCard label="Still to pay" value={formatMoney(sums.owed, DEFAULT_CURRENCY)} tone={sums.owed ? 'red' : 'green'} />
      </div>

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search contractor, project or role" />
        <FilterSelect value={status} onChange={setStatus} options={ASSIGNMENT_STATUSES} allLabel="Any status" />
        <FilterSelect value={pay} onChange={setPay} options={CONTRACTOR_PAYMENT_STATUSES} allLabel="Any payment" />
        <button className={`${btnPrimary} ml-auto`} onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New engagement</button>
      </Toolbar>

      {!items ? <Loading /> : filtered.length === 0 ? (
        <Empty>No engagements yet. Engage contractors from a project page (Team section) or with “New engagement”.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Contractor</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Fee</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Letter</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-3"><Link to={`/hr/contractors/${a.contractor}`} className="font-semibold hover:text-primary">{a.expand?.contractor?.full_name || '—'}</Link><p className="text-xs text-muted-foreground">{a.role_on_project}</p></td>
                  <td className="px-4 py-3"><Link to={`/projects/${a.project}`} className="text-primary hover:underline">{a.expand?.project?.title || '—'}</Link></td>
                  <td className="px-4 py-3 text-muted-foreground">{[fmtDate(a.start_date), fmtDate(a.end_date)].filter(Boolean).join(' – ') || '—'}</td>
                  <td className="px-4 py-3">{formatMoney(a.agreed_amount, a.currency)}</td>
                  <td className="px-4 py-3"><Pill info={statusInfo(CONTRACTOR_PAYMENT_STATUSES, a.payment_status)} /><p className="mt-0.5 text-xs text-muted-foreground">{formatMoney(a.amount_paid, a.currency)}</p></td>
                  <td className="px-4 py-3"><Pill info={statusInfo(ASSIGNMENT_STATUSES, a.status)} /></td>
                  <td className="px-4 py-3">{a.contract_signed ? <span className="text-xs font-semibold text-emerald-700">Signed</span> : <span className="text-xs font-semibold text-amber-700">Not signed</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button title="Edit" aria-label="Edit engagement" onClick={() => setEditing(a)} className="text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
                      <Link title="Engagement letter" aria-label="Engagement letter" to={`/hr/engagements/${a.id}/letter`} className="text-muted-foreground hover:text-primary"><Printer className="h-4 w-4" /></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EngagementDialog open={editing !== null} engagement={editing?.id ? editing : null} onClose={() => setEditing(null)} onSaved={load} />
    </PortalLayout>
  );
}
