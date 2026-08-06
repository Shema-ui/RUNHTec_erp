import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Wrench, Search, CalendarDays } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';

export default function MaintenancePage() {
  const [contracts, setContracts] = useState([]);
  const [query, setQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await pb.collection('maintenance_contracts').getList(1, 100, { sort: '-created' });
        if (!cancelled) setContracts(result.items || []);
      } catch (error) {
        console.error('Maintenance contracts load error', error);
        if (!cancelled) setContracts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => contracts.filter((contract) => {
    const matchesQuery = !query || [contract.client, contract.service_type].join(' ').toLowerCase().includes(query.toLowerCase());
    const matchesActive = !activeOnly || contract.active;
    return matchesQuery && matchesActive;
  }), [query, activeOnly, contracts]);

  return (
    <PortalLayout title="Maintenance" subtitle="Recurring contracts and scheduled service work">
      <Helmet>
        <title>Maintenance | RUNHTec Business Portal</title>
        <meta name="description" content="Manage recurring maintenance contracts and service schedules." />
      </Helmet>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search client or service" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={activeOnly} onChange={() => setActiveOnly((v) => !v)} />
          Show active only
        </label>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading maintenance contracts…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No maintenance contracts found.</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((contract) => (
          <div key={contract.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-accent p-3 text-primary">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">{contract.service_type}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{contract.client}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>Frequency: {contract.frequency}</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Next due {contract.next_due}</span>
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
