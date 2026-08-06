import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { ClipboardList, Search, Filter, Wrench, CalendarDays } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await pb.collection('projects').getList(1, 100, { sort: '-created' });
        if (!cancelled) setProjects(result.items || []);
      } catch (error) {
        console.error('Projects load error', error);
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => projects.filter((project) => {
    const matchesQuery = !query || [project.title, project.client].join(' ').toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === 'all' || project.status === status;
    return matchesQuery && matchesStatus;
  }), [query, status, projects]);

  return (
    <PortalLayout title="Projects & Work Orders" subtitle="Delivery tracking for accepted quotes">
      <Helmet>
        <title>Projects | RUNHTec Business Portal</title>
        <meta name="description" content="Track projects, work orders, assigned technicians and delivery status." />
      </Helmet>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search project or client" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-transparent text-sm outline-none">
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading projects…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No projects found yet.</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((project) => (
          <div key={project.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-accent p-3 text-primary">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">{project.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{project.client}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Wrench className="h-4 w-4" /> {project.status.replace('_', ' ')}</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Due {project.due_date}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
