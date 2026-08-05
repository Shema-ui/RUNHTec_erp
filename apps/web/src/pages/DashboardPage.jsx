import React from 'react';
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
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import { useAuth } from '@/context/AuthContext';
import { roleLabel } from '@/lib/permissions';

const STATS = [
  { key: 'clients', label: 'Total Clients', value: '148', delta: '+6', up: true, icon: Building2 },
  { key: 'rfq', label: 'Pending RFQs', value: '12', delta: '+3', up: true, icon: FileQuestion },
  { key: 'projects', label: 'Active Projects', value: '27', delta: '+2', up: true, icon: FolderKanban },
  { key: 'quotations', label: 'Pending Quotations', value: '19', delta: '-4', up: false, icon: FileText },
  { key: 'invoices', label: 'Outstanding Invoices', value: 'R 486k', delta: '-8%', up: false, icon: ReceiptText },
  { key: 'revenue', label: 'Revenue This Month', value: 'R 1.24M', delta: '+11%', up: true, icon: TrendingUp },
  { key: 'maintenance', label: 'Scheduled Maintenance', value: '34', delta: '+5', up: true, icon: Wrench },
  { key: 'techs', label: 'Active Technicians', value: '22', delta: '+1', up: true, icon: HardHat },
];

const ACTIVITY = [
  { t: 'New RFQ received', d: 'Client: Meridian Facilities — HVAC upgrade', ago: '18m ago' },
  { t: 'Quotation approved', d: 'QUO-2041 accepted by Brightline Retail', ago: '1h ago' },
  { t: 'Project milestone reached', d: 'Substation Refit — Phase 2 completed', ago: '3h ago' },
  { t: 'Invoice paid', d: 'INV-1188 settled — R 92,400', ago: '5h ago' },
  { t: 'Technician assigned', d: 'J. Naidoo dispatched to Site 7', ago: 'Yesterday' },
];

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
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.name || 'there').split(' ')[0];

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s, i) => (
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
          <ul className="divide-y divide-border">
            {ACTIVITY.map((a) => (
              <li key={a.t + a.ago} className="flex items-start gap-3 py-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{a.t}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.d}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{a.ago}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] italic text-muted-foreground/70">
            Sample data — live activity connects when operational modules go online.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display mb-4 text-sm font-bold text-foreground">Workforce Snapshot</h3>
          <div className="space-y-4">
            {[
              { label: 'Technicians on duty', value: 22, total: 30 },
              { label: 'Open work orders', value: 41, total: 60 },
              { label: 'Maintenance SLAs met', value: 94, total: 100, suffix: '%' },
            ].map((m) => {
              const pct = Math.round((m.value / m.total) * 100);
              return (
                <div key={m.label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="font-semibold text-foreground">
                      {m.value}
                      {m.suffix || ` / ${m.total}`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
