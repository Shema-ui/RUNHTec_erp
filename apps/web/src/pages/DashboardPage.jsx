import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Building2,
  FileQuestion,
  FolderKanban,
  FileText,
  ReceiptText,
  Wrench,
  HardHat,
  Activity,
} from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import { useAuth } from '@/context/AuthContext';
import { roleLabel } from '@/lib/permissions';
import pb from '@/lib/pocketbaseClient';

function formatRelativeTime(dateValue) {
  if (!dateValue) return 'recently';
  const diffMs = Date.now() - new Date(dateValue).getTime();
  const diffMin = Math.max(1, Math.round(diffMs / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function StatCard({ stat, index }) {
  const Icon = stat.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' }}
      className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>
      <p className="mt-4 font-display text-2xl font-extrabold tracking-tight text-foreground">
        {stat.value}
      </p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{stat.label}</p>
    </motion.div>
  );
}

function StatCard({ stat, index }) {
  const Icon = stat.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' }}
      className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <span
          className={`flex items-center gap-0.5 text-xs font-semibold ${
            stat.up ? 'text-emerald-600' : 'text-rose-500'
          }`}
        >
          {stat.up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {stat.delta}
        </span>
      </div>
      <p className="mt-4 font-display text-2xl font-extrabold tracking-tight text-foreground">
        {stat.value}
      </p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{stat.label}</p>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.name || 'there').split(' ')[0];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [clientsRes, rfqsRes, quotesRes, projectsRes, maintenanceRes, activitiesRes] = await Promise.all([
          pb.collection('clients').getList(1, 1),
          pb.collection('rfqs').getList(1, 1, { filter: "status = 'new' || status = 'reviewing'" }),
          pb.collection('quotations').getList(1, 1),
          pb.collection('projects').getList(1, 1, { filter: "status = 'scheduled' || status = 'in_progress'" }),
          pb.collection('maintenance_contracts').getList(1, 1),
          pb.collection('client_activities').getList(1, 8, { sort: '-created' }),
        ]);

        if (cancelled) return;

        const liveStats = [
          { key: 'clients', label: 'Total Clients', value: clientsRes.totalItems ?? 0, icon: Building2 },
          { key: 'enquiries', label: 'New Enquiries', value: rfqsRes.totalItems ?? 0, icon: FileQuestion },
          { key: 'rfq', label: 'Pending RFQs', value: rfqsRes.totalItems ?? 0, icon: FileQuestion },
          { key: 'quotations', label: 'Quotations', value: quotesRes.totalItems ?? 0, icon: FileText },
          { key: 'projects', label: 'Active Projects', value: projectsRes.totalItems ?? 0, icon: FolderKanban },
          { key: 'maintenance', label: 'Maintenance Requests', value: maintenanceRes.totalItems ?? 0, icon: Wrench },
        ];

        setStats(liveStats);
        setActivity((activitiesRes?.items || []).map((item) => ({
          t: item.description || 'Activity recorded',
          d: item.actor_name || 'System',
          ago: formatRelativeTime(item.created),
        })));
      } catch (error) {
        console.error('dashboard load error', error);
        if (!cancelled) {
          setStats([
            { key: 'clients', label: 'Total Clients', value: 0, icon: Building2 },
            { key: 'enquiries', label: 'New Enquiries', value: 0, icon: FileQuestion },
            { key: 'rfq', label: 'Pending RFQs', value: 0, icon: FileQuestion },
            { key: 'quotations', label: 'Quotations', value: 0, icon: FileText },
            { key: 'projects', label: 'Active Projects', value: 0, icon: FolderKanban },
            { key: 'maintenance', label: 'Maintenance Requests', value: 0, icon: Wrench },
          ]);
          setActivity([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const activityList = useMemo(() => activity, [activity]);

  return (
    <PortalLayout title="Executive Dashboard" subtitle="Operations overview">
      <Helmet>
        <title>Dashboard | RUNHTec Business Portal</title>
        <meta name="description" content="Executive operations dashboard for RUNHTec Contractors — clients, projects, quotations, invoices and workforce at a glance." />
      </Helmet>

      {/* Welcome banner */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-slate-900 p-6 text-white sm:p-8">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-300">{greeting},</p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Welcome back, {user?.name || firstName}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Role: {roleLabel(user?.role)}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 px-4 py-3 ring-1 ring-white/10">
            <p className="text-xs text-slate-400">Today</p>
            <p className="text-sm font-semibold">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
            <div className="mt-4 h-7 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        )) : stats.map((s, i) => (
          <StatCard key={s.key} stat={s} index={i} />
        ))}
      </div>

      {/* Lower row */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold text-foreground">Recent Activity</h3>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : activityList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activityList.map((a, index) => (
                <li key={`${a.t}-${index}`} className="flex items-start gap-3 py-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{a.t}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.d}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.ago}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display mb-4 text-sm font-bold text-foreground">System Snapshot</h3>
          <div className="space-y-4">
            {[
              { label: 'New enquiries', value: stats.find((item) => item.key === 'enquiries')?.value ?? 0 },
              { label: 'Active projects', value: stats.find((item) => item.key === 'projects')?.value ?? 0 },
              { label: 'Maintenance requests', value: stats.find((item) => item.key === 'maintenance')?.value ?? 0 },
            ].map((m) => (
              <div key={m.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-semibold text-foreground">{m.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Number(m.value) * 10)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
