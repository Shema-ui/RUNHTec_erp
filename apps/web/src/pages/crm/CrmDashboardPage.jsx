import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, Users, TrendingUp, CheckCircle2, XCircle, Bell,
  FolderKanban, Wrench, DollarSign, Phone, Mail, CalendarClock,
  ArrowRight, Plus,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import pb from '@/lib/pocketbaseClient';
import PortalLayout from '@/layouts/PortalLayout';
import { PIPELINE_STAGES, CLIENT_STATUSES, formatCurrency } from '@/lib/crm';

const FOLLOWUP_TYPE_ICONS = {
  call: Phone, meeting: Users, site_visit: FolderKanban, email: Mail, task: Bell,
};

function StatCard({ label, value, icon: Icon, color, loading, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>
      <p className="mt-4 font-display text-2xl font-extrabold tracking-tight text-foreground">
        {loading ? <span className="inline-block h-7 w-16 animate-pulse rounded bg-muted" /> : value}
      </p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{label}</p>
    </motion.div>
  );
}

export default function CrmDashboardPage() {
  const [stats, setStats] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [pipelineData, setPipelineData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [totalR, activeR, leadsR, followupsR, oppsR] = await Promise.all([
          pb.collection('clients').getList(1, 1, { requestKey: 'crm-total' }),
          pb.collection('clients').getList(1, 1, { filter: "status = 'active'", requestKey: 'crm-active' }),
          pb.collection('clients').getList(1, 1, { filter: "status = 'lead'", requestKey: 'crm-leads' }),
          pb.collection('client_followups').getList(1, 10, {
            filter: `status = 'pending'`,
            sort: 'due_date',
            expand: 'client',
            requestKey: 'crm-followups',
          }),
          pb.collection('sales_opportunities').getFullList({
            requestKey: 'crm-opps',
          }),
        ]);

        const won = oppsR.filter(o => o.stage === 'won').length;
        const lost = oppsR.filter(o => o.stage === 'lost').length;
        const pipelineValue = oppsR
          .filter(o => o.stage !== 'won' && o.stage !== 'lost')
          .reduce((s, o) => s + (o.value || 0), 0);

        setStats({
          total: totalR.totalItems,
          active: activeR.totalItems,
          leads: leadsR.totalItems,
          followupsDue: followupsR.totalItems,
          won,
          lost,
          pipelineValue,
          totalOpps: oppsR.length,
        });

        setFollowups(followupsR.items);

        // Pipeline bar chart
        const stageCounts = {};
        oppsR.forEach(o => { stageCounts[o.stage] = (stageCounts[o.stage] || 0) + 1; });
        setPipelineData(
          PIPELINE_STAGES.filter(s => s.value !== 'won' && s.value !== 'lost').map(s => ({
            name: s.label.replace(' ', '\n'),
            count: stageCounts[s.value] || 0,
            color: s.color,
          }))
        );

        // Status pie chart
        const statusCounts = { lead: leadsR.totalItems, active: activeR.totalItems };
        setStatusData(
          CLIENT_STATUSES.map(s => ({
            name: s.label,
            value: statusCounts[s.value] || 0,
          })).filter(d => d.value > 0)
        );
      } catch (e) {
        console.error('CRM dashboard load error', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const STAT_CARDS = [
    { label: 'Total Clients', value: stats?.total ?? '—', icon: Building2, color: 'bg-blue-100 text-blue-700' },
    { label: 'Active Clients', value: stats?.active ?? '—', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'New Leads', value: stats?.leads ?? '—', icon: TrendingUp, color: 'bg-amber-100 text-amber-700' },
    { label: 'Pipeline Opportunities', value: stats?.totalOpps ?? '—', icon: FolderKanban, color: 'bg-purple-100 text-purple-700' },
    { label: 'Won Opportunities', value: stats?.won ?? '—', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
    { label: 'Lost Opportunities', value: stats?.lost ?? '—', icon: XCircle, color: 'bg-red-100 text-red-600' },
    { label: 'Upcoming Follow-Ups', value: stats?.followupsDue ?? '—', icon: Bell, color: 'bg-indigo-100 text-indigo-700' },
    { label: 'Active Maintenance Contracts', value: '—', icon: Wrench, color: 'bg-orange-100 text-orange-700' },
    { label: 'Projects in Progress', value: '—', icon: FolderKanban, color: 'bg-cyan-100 text-cyan-700' },
    { label: 'Quotations Sent', value: '—', icon: Mail, color: 'bg-pink-100 text-pink-700' },
    { label: 'Total Pipeline Value', value: stats ? formatCurrency(stats.pipelineValue) : '—', icon: DollarSign, color: 'bg-teal-100 text-teal-700' },
  ];

  const PIE_COLORS = ['#f59e0b', '#10b981', '#64748b', '#ef4444'];

  return (
    <PortalLayout title="CRM Dashboard" subtitle="Customer Relationship Management">
      <Helmet>
        <title>CRM Dashboard | RUNHTec Business Portal</title>
        <meta name="description" content="CRM overview — clients, leads, pipeline, follow-ups and opportunities." />
      </Helmet>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold text-foreground">Customer Relationship Management</h2>
          <p className="text-sm text-muted-foreground">Central database for all client relationships</p>
        </div>
        <div className="flex gap-2">
          <Link to="/crm/pipeline" className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
            <FolderKanban className="h-4 w-4" /> Pipeline
          </Link>
          <Link to="/crm/clients/new" className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Client
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {STAT_CARDS.map((s, i) => (
          <StatCard key={s.label} {...s} loading={loading && !stats} index={i} />
        ))}
      </div>

      {/* Charts row */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Pipeline distribution */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="font-display mb-4 text-sm font-bold text-foreground">Pipeline by Stage</h3>
          {pipelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Opportunities']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {pipelineData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No pipeline data yet — <Link to="/crm/pipeline" className="ml-1 text-primary underline-offset-2 hover:underline">add opportunities</Link>
            </div>
          )}
        </div>

        {/* Client status pie */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display mb-4 text-sm font-bold text-foreground">Client Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No clients yet — <Link to="/crm/clients/new" className="ml-1 text-primary underline-offset-2 hover:underline">add one</Link>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming follow-ups */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold text-foreground">Upcoming Follow-Ups</h3>
          </div>
          <Link to="/crm/clients" className="flex items-center gap-1 text-xs text-primary hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : followups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No pending follow-ups — great work!</p>
        ) : (
          <div className="divide-y divide-border">
            {followups.map((fu) => {
              const Icon = FOLLOWUP_TYPE_ICONS[fu.type] || Bell;
              const clientName = fu.expand?.client?.company_name || 'Unknown Client';
              const dueDate = fu.due_date ? new Date(fu.due_date).toLocaleDateString() : 'No date';
              const isOverdue = fu.due_date && new Date(fu.due_date) < new Date();
              return (
                <div key={fu.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{fu.title}</p>
                    <p className="text-xs text-muted-foreground">{clientName}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {dueDate}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
