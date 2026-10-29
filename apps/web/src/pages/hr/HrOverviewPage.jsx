import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Inbox, Users, HardHat, Banknote, ArrowRight } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import HrTabs from './HrTabs';
import { Card, StatCard, Loading, Pill } from '@/components/erp/kit';
import { DEPARTMENTS, APPLICATION_STATUSES, statusInfo, tradeLabel } from '@/lib/hr';
import { formatMoney, DEFAULT_CURRENCY } from '@/lib/money';

export default function HrOverviewPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      pb.collection('job_applications').getFullList({ sort: '-created' }).catch(() => []),
      pb.collection('contractors').getFullList({ sort: 'full_name' }).catch(() => []),
      pb.collection('project_assignments').getFullList({ sort: '-created', expand: 'contractor,project' }).catch(() => []),
    ]).then(([applications, contractors, assignments]) => setData({ applications, contractors, assignments }));
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const open = data.applications.filter((a) => ['new', 'shortlisted', 'interview', 'on_hold'].includes(a.status));
    const activeContractors = data.contractors.filter((c) => !['inactive', 'do_not_engage'].includes(c.status));
    const live = data.assignments.filter((a) => ['accepted', 'in_progress'].includes(a.status));
    const owed = data.assignments
      .filter((a) => a.status !== 'cancelled' && a.payment_status !== 'paid')
      .reduce((s, a) => s + Math.max(0, Number(a.agreed_amount || 0) - Number(a.amount_paid || 0)), 0);
    const byDept = DEPARTMENTS.map((d) => ({ ...d, count: activeContractors.filter((c) => c.department === d.value).length }));
    const pipeline = APPLICATION_STATUSES.map((s) => ({ ...s, count: data.applications.filter((a) => a.status === s.value).length }));
    return { open, activeContractors, live, owed, byDept, pipeline };
  }, [data]);

  return (
    <PortalLayout title="HR & Contractors" subtitle="Applications, contractor register and per-project engagements">
      <Helmet><title>HR & Contractors | RUNHTec Business Portal</title></Helmet>
      <HrTabs showModel />

      {!stats ? <Loading /> : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Inbox} label="Applications to review" value={stats.open.length} note="New, shortlisted, interview or on hold" tone="amber" />
            <StatCard icon={Users} label="Contractors in register" value={stats.activeContractors.length} note="Excluding inactive / do not engage" />
            <StatCard icon={HardHat} label="Engaged on projects now" value={stats.live.length} note="Accepted or on site" tone="green" />
            <StatCard icon={Banknote} label="Contractor fees still to pay" value={formatMoney(stats.owed, DEFAULT_CURRENCY)} tone="red" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Contractors by department">
              <ul className="space-y-2">
                {stats.byDept.map((d) => (
                  <li key={d.value}>
                    <Link to={`/hr/contractors?department=${d.value}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-secondary">
                      <span>{d.label}</span>
                      <span className="font-semibold">{d.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Application pipeline" action={<Link to="/hr/applications" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">Open <ArrowRight className="h-3.5 w-3.5" /></Link>}>
              <ul className="space-y-2">
                {stats.pipeline.map((s) => (
                  <li key={s.value} className="flex items-center justify-between px-2 py-1.5 text-sm">
                    <Pill info={s} />
                    <span className="font-semibold">{s.count}</span>
                  </li>
                ))}
              </ul>
              {stats.open.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest</p>
                  {stats.open.slice(0, 5).map((a) => (
                    <Link key={a.id} to={`/hr/applications?open=${a.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-secondary">
                      <span><strong>{a.full_name}</strong> · {tradeLabel(a.trade)}</span>
                      <Pill info={statusInfo(APPLICATION_STATUSES, a.status)} />
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card title="Who is on site now" action={<Link to="/hr/engagements" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">All engagements <ArrowRight className="h-3.5 w-3.5" /></Link>}>
            {stats.live.length === 0 ? <p className="text-sm text-muted-foreground">Nobody is engaged on a project right now.</p> : (
              <ul className="divide-y divide-border">
                {stats.live.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <Link to={`/hr/contractors/${a.contractor}`} className="font-semibold hover:text-primary">{a.expand?.contractor?.full_name || 'Contractor'}</Link>
                    <span className="text-muted-foreground">{a.role_on_project || '—'}</span>
                    <Link to={`/projects/${a.project}`} className="text-primary hover:underline">{a.expand?.project?.title || 'Project'}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </PortalLayout>
  );
}
