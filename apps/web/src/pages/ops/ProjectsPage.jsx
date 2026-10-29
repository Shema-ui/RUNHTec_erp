import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Plus, CalendarDays, MapPin, Users, FolderKanban } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { Toolbar, SearchBox, FilterSelect, Loading, Empty, Pill, StatCard, btnPrimary, fmtDate, todayISO } from '@/components/erp/kit';
import { PROJECT_STATUSES, PRIORITIES, SERVICE_CATEGORIES, projectStatusInfo, priorityInfo, serviceLabel } from '@/lib/projects';
import { formatMoney, formatMoneyShort, DEFAULT_CURRENCY } from '@/lib/money';

const today = () => todayISO();

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null);
  const [teamCount, setTeamCount] = useState({});
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [service, setService] = useState('all');
  const [priority, setPriority] = useState('all');
  const canCreate = ['super_admin', 'project_manager'].includes(user?.role);

  useEffect(() => {
    pb.collection('projects').getFullList({ sort: '-created', expand: 'client,project_manager' })
      .then(setProjects).catch(() => setProjects([]));
    pb.collection('project_assignments').getFullList({}).then((list) => {
      const m = {};
      list.filter((a) => a.status !== 'cancelled').forEach((a) => { m[a.project] = (m[a.project] || 0) + 1; });
      setTeamCount(m);
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => (projects || []).filter((p) => {
    if (status === 'active' && ['done', 'cancelled'].includes(p.status)) return false;
    if (status !== 'active' && status !== 'all' && p.status !== status) return false;
    if (service !== 'all' && p.service_category !== service) return false;
    if (priority !== 'all' && p.priority !== priority) return false;
    if (q && ![p.title, p.expand?.client?.company_name, p.site_address].join(' ').toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [projects, q, status, service, priority]);

  const stats = useMemo(() => {
    const list = projects || [];
    const live = list.filter((p) => ['scheduled', 'in_progress', 'planning', 'on_hold'].includes(p.status));
    const overdue = live.filter((p) => p.due_date && p.due_date < today());
    const value = live.reduce((s, p) => s + Number(p.value || 0), 0);
    return { live: live.length, inProgress: list.filter((p) => p.status === 'in_progress').length, overdue: overdue.length, value };
  }, [projects]);

  return (
    <PortalLayout title="Projects & Work Orders" subtitle="Every job from accepted quote to handover">
      <Helmet><title>Projects | RUNHTec Business Portal</title></Helmet>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FolderKanban} label="Open projects" value={stats.live} />
        <StatCard label="In progress" value={stats.inProgress} tone="amber" />
        <StatCard label="Past due date" value={stats.overdue} tone={stats.overdue ? 'red' : 'green'} />
        <StatCard label="Value of open projects" value={formatMoneyShort(stats.value, DEFAULT_CURRENCY)} tone="green" />
      </div>

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search project, client or site" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="active">Open projects</option>
          <option value="all">All projects</option>
          {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <FilterSelect value={service} onChange={setService} options={SERVICE_CATEGORIES} allLabel="All services" />
        <FilterSelect value={priority} onChange={setPriority} options={PRIORITIES} allLabel="Any priority" />
        {canCreate && <Link to="/projects/new" className={`${btnPrimary} ml-auto`}><Plus className="h-4 w-4" /> New project</Link>}
      </Toolbar>

      {!projects ? <Loading /> : filtered.length === 0 ? (
        <Empty>No projects here. Create one with “New project”, or open an accepted quotation and click “Convert to project”.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((p) => {
            const overdue = p.due_date && p.due_date < today() && !['done', 'cancelled'].includes(p.status);
            const progress = Math.max(0, Math.min(100, Number(p.progress) || 0));
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-semibold text-foreground">{p.title}</h3>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{p.expand?.client?.company_name || 'No client linked'}{p.service_category ? ` · ${serviceLabel(p.service_category)}` : ''}</p>
                  </div>
                  <Pill info={projectStatusInfo(p.status)} />
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary" aria-label={`${progress}% complete`}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{progress}% complete</span>
                  <span className={`inline-flex items-center gap-1 ${overdue ? 'font-semibold text-rose-600' : ''}`}><CalendarDays className="h-3.5 w-3.5" />{p.due_date ? `Due ${fmtDate(p.due_date)}` : 'No due date'}{overdue ? ' · overdue' : ''}</span>
                  {p.site_address && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.site_address}</span>}
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{teamCount[p.id] || 0} contractor{teamCount[p.id] === 1 ? '' : 's'}</span>
                  <span className={`font-semibold ${priorityInfo(p.priority).cls}`}>{priorityInfo(p.priority).label} priority</span>
                  {Number(p.value) > 0 && <span className="font-semibold text-foreground">{formatMoney(p.value, p.currency)}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
