import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BarChart3, TrendingUp, HardHat, ReceiptText } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';

const REPORTS = [
  { label: 'Revenue this month', value: 'R 1.24M', icon: TrendingUp },
  { label: 'Technician utilization', value: '82%', icon: HardHat },
  { label: 'Outstanding invoices', value: 'R 486k', icon: ReceiptText },
];

export default function ReportsPage() {
  const [stats, setStats] = useState({ invoices: 0, projects: 0, rfqs: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [invoices, projects, rfqs] = await Promise.all([
          pb.collection('invoices').getList(1, 1),
          pb.collection('projects').getList(1, 1),
          pb.collection('rfqs').getList(1, 1),
        ]);
        setStats({ invoices: invoices.totalItems || 0, projects: projects.totalItems || 0, rfqs: rfqs.totalItems || 0 });
      } catch (error) {
        console.error('Reports load error', error);
      }
    };
    load();
  }, []);
  return (
    <PortalLayout title="Reports" subtitle="Revenue, utilization and SLA insight">
      <Helmet>
        <title>Reports | RUNHTec Business Portal</title>
        <meta name="description" content="View project, finance and workforce operative reports." />
      </Helmet>

      <div className="grid gap-4 md:grid-cols-3">
        {REPORTS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-accent p-3 text-primary"><Icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="font-display text-xl font-semibold text-foreground">{item.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">Operations snapshot</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-sm font-semibold text-foreground">RFQs in system</p>
            <p className="mt-2 font-display text-2xl font-semibold text-foreground">{stats.rfqs}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-sm font-semibold text-foreground">Projects tracked</p>
            <p className="mt-2 font-display text-2xl font-semibold text-foreground">{stats.projects}</p>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
