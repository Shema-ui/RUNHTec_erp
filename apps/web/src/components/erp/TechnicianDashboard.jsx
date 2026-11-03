import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, CheckCircle2, ListChecks, Camera, Wrench, CalendarDays, MapPin, CalendarCheck, ChevronRight } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { Pill, fmtDate, todayISO } from '@/components/erp/kit';
import { projectStatusInfo } from '@/lib/projects';

const n = (v) => Number(v) || 0;

function Tile({ icon: Icon, label, value, to, tone }) {
  const body = (
    <div className="h-full rounded-2xl border border-border bg-card p-4 shadow-sm transition active:scale-[0.98]">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
      <p className="mt-2 font-display text-2xl font-extrabold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

function ProjectRow({ p, me }) {
  const tasks = Array.isArray(p.tasks) ? p.tasks : [];
  const open = tasks.filter((t) => !t.done).length;
  const progress = Math.max(0, Math.min(100, n(p.progress)));
  const overdue = p.due_date && p.due_date < todayISO() && !['done', 'cancelled'].includes(p.status);
  return (
    <Link to={`/projects/${p.id}`} className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{p.title}</p>
          <p className="truncate text-xs text-muted-foreground">{p.expand?.client?.company_name || 'Client'}{p.lead_technician === me ? ' · You lead this job' : ''}</p>
        </div>
        <Pill info={projectStatusInfo(p.status)} />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{progress}% done</span>
        {tasks.length > 0 && <span>{open ? `${open} task${open === 1 ? '' : 's'} left` : 'All tasks done'}</span>}
        <span className={`inline-flex items-center gap-1 ${overdue ? 'font-semibold text-rose-600' : ''}`}><CalendarDays className="h-3.5 w-3.5" />{p.due_date ? `Due ${fmtDate(p.due_date)}` : 'No due date'}</span>
        {p.site_address && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.site_address}</span>}
      </div>
    </Link>
  );
}

// What a Technician / Lead Technician sees on their dashboard: only their own work.
export default function TechnicianDashboard({ user }) {
  const [data, setData] = useState(null);
  const isLead = user?.role === 'lead_technician';

  useEffect(() => {
    Promise.all([
      pb.collection('projects').getFullList({ sort: 'due_date', expand: 'client' }).catch(() => []),
      pb.collection('maintenance_contracts').getFullList({ sort: 'next_due_date', expand: 'client' }).catch(() => []),
      pb.collection('project_photos').getFullList({ filter: `uploaded_by = '${user.id}'` }).catch(() => []),
      isLead ? pb.collection('project_costs').getFullList({ filter: `recorded_by = '${user.id}'` }).catch(() => []) : Promise.resolve([]),
    ]).then(([projects, maint, photos, costs]) => setData({ projects, maint, photos, costs }));
  }, [user?.id]);

  const v = useMemo(() => {
    if (!data) return null;
    const mine = data.projects.filter((p) => p.lead_technician === user.id || (Array.isArray(p.assigned_technicians) && p.assigned_technicians.includes(user.id)));
    const active = mine.filter((p) => !['done', 'cancelled'].includes(p.status));
    const done = mine.filter((p) => p.status === 'done').sort((a, b) => String(b.completed_date || b.updated).localeCompare(String(a.completed_date || a.updated)));
    const openTasks = active.flatMap((p) => (Array.isArray(p.tasks) ? p.tasks : []).filter((t) => !t.done).map((t) => ({ ...t, project: p })));
    const weekAgo = todayISO(-6);
    const photosWeek = data.photos.filter((ph) => String(ph.taken_on || ph.created).slice(0, 10) >= weekAgo).length;
    const visits = data.maint.filter((m) => Number(m.active) !== 0 && m.assigned_technician === user.id);
    const daysWeek = data.costs.filter((c) => c.category === 'labour' && String(c.cost_date) >= weekAgo).reduce((s, c) => s + n(c.quantity), 0);
    return { active, done, openTasks, photosWeek, visits, daysWeek };
  }, [data, user?.id]);

  if (!v) {
    return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile icon={FolderKanban} label="My active projects" value={v.active.length} to="/projects" tone="bg-blue-50 text-blue-700" />
        <Tile icon={CheckCircle2} label="Projects completed" value={v.done.length} tone="bg-emerald-50 text-emerald-700" />
        <Tile icon={ListChecks} label="Tasks still to do" value={v.openTasks.length} tone="bg-amber-50 text-amber-700" />
        {isLead
          ? <Tile icon={CalendarCheck} label="Work days logged this week" value={v.daysWeek} tone="bg-violet-50 text-violet-700" />
          : <Tile icon={Camera} label="Photos added this week" value={v.photosWeek} tone="bg-violet-50 text-violet-700" />}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-foreground">My projects</h3>
          <Link to="/projects" className="inline-flex items-center text-sm font-medium text-primary">See all <ChevronRight className="h-4 w-4" /></Link>
        </div>
        {v.active.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">You have no active projects right now. When the Project Manager assigns you to a job, it appears here.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">{v.active.map((p) => <ProjectRow key={p.id} p={p} me={user.id} />)}</div>
        )}
      </section>

      {v.openTasks.length > 0 && (
        <section>
          <h3 className="mb-3 font-display text-base font-bold text-foreground">Tasks to do</h3>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
            {v.openTasks.slice(0, 10).map((t) => (
              <li key={`${t.project.id}-${t.id}`}>
                <Link to={`/projects/${t.project.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium">{t.title}</span><span className="block truncate text-xs text-muted-foreground">{t.project.title}</span></span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {v.visits.length > 0 && (
        <section>
          <h3 className="mb-3 font-display text-base font-bold text-foreground">My maintenance visits</h3>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
            {v.visits.slice(0, 8).map((m) => {
              const late = m.next_due_date && m.next_due_date < todayISO();
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2"><Wrench className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0"><span className="block truncate font-medium">{m.service_type}</span><span className="block truncate text-xs text-muted-foreground">{m.expand?.client?.company_name}{m.site ? ` · ${m.site}` : ''}</span></span></span>
                  <span className={`shrink-0 text-xs ${late ? 'font-semibold text-rose-600' : 'text-muted-foreground'}`}>{m.next_due_date ? fmtDate(m.next_due_date) : '—'}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {v.done.length > 0 && (
        <section>
          <h3 className="mb-3 font-display text-base font-bold text-foreground">Completed recently</h3>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
            {v.done.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /><span className="truncate font-medium">{p.title}</span></span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(p.completed_date) || 'Done'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
