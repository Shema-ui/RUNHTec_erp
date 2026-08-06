import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { FileQuestion, Search, Filter, Plus, ArrowRight, CheckCircle2 } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';

const STATUS_LABELS = {
  new: 'New',
  reviewing: 'Reviewing',
  quoted: 'Quoted',
  declined: 'Declined',
};

export default function RfqsPage() {
  const [rfqs, setRfqs] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await pb.collection('rfqs').getList(1, 100, { sort: '-created' });
        if (!cancelled) setRfqs(result.items || []);
      } catch (error) {
        console.error('RFQs load error', error);
        if (!cancelled) setRfqs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return rfqs.filter((rfq) => {
      const haystack = [rfq.company, rfq.name, rfq.service_type, rfq.email].join(' ').toLowerCase();
      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      const matchesStatus = status === 'all' || rfq.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status, rfqs]);

  return (
    <PortalLayout title="RFQs" subtitle="Public inquiries and estimating intake">
      <Helmet>
        <title>RFQs | RUNHTec Business Portal</title>
        <meta name="description" content="Review incoming requests for quotation and convert them into quotes and projects." />
      </Helmet>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">RFQ intake</p>
          <p className="text-sm text-muted-foreground">Capture every new inquiry, triage it quickly, and move it into quotation and project workflows.</p>
        </div>
        <Link to="/quotations" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Create quotation
        </Link>
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by company, contact or service" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-transparent text-sm outline-none">
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="reviewing">Reviewing</option>
            <option value="quoted">Quoted</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading RFQs…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No RFQs match the current filters. Clear the search or create a new quotation flow.
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((rfq) => (
            <div key={rfq.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-accent p-3 text-primary">
                    <FileQuestion className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold text-foreground">{rfq.company}</h3>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">{STATUS_LABELS[rfq.status]}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{rfq.name} • {rfq.email}</p>
                    <p className="mt-2 text-sm text-foreground">{rfq.description}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span>Service: {rfq.service_type}</span>
                      <span>Urgency: {rfq.urgency}</span>
                      <span>Received: {rfq.created}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Ready for quotation
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
