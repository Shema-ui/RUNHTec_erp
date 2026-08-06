import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { FileText, Search, Filter, Plus, CheckCircle2, Clock3 } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';

export default function QuotationsPage() {
  const [quotes, setQuotes] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await pb.collection('quotations').getList(1, 100, { sort: '-created', expand: 'client' });
        if (!cancelled) setQuotes(result.items || []);
      } catch (error) {
        console.error('Quotations load error', error);
        if (!cancelled) setQuotes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => quotes.filter((quote) => {
    const clientName = quote.expand?.client?.company_name || '';
    const matchesQuery = !query || [quote.number, clientName].join(' ').toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === 'all' || quote.status === status;
    return matchesQuery && matchesStatus;
  }), [query, status, quotes]);

  return (
    <PortalLayout title="Quotations" subtitle="RFQ conversion and client approvals">
      <Helmet>
        <title>Quotations | RUNHTec Business Portal</title>
        <meta name="description" content="Manage quotations, client approvals, and automated project handoff." />
      </Helmet>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Quotation workflow</p>
          <p className="text-sm text-muted-foreground">Approved quotes automatically trigger projects and operational follow-up.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> New quotation
        </button>
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search quotation or client" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-transparent text-sm outline-none">
            <option value="all">All statuses</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading quotations…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">No quotations found yet.</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((quote) => (
          <div key={quote.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-accent p-3 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-foreground">{quote.number}</h3>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">{quote.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{quote.expand?.client?.company_name || 'No client linked'}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>Total: {quote.total}</span>
                    <span>Valid until: {quote.valid_until}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground">
                {quote.status === 'accepted' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock3 className="h-4 w-4 text-amber-600" />}
                {quote.status === 'accepted' ? 'Accepted — project ready' : 'Pending client approval'}
              </div>
            </div>
          </div>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
