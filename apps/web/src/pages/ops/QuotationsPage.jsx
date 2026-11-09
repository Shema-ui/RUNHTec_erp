import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { FileText, Search, Filter, Plus, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import SuperDelete from '@/components/erp/SuperDelete';
import { useAuth } from '@/context/AuthContext';
import { canAccessModule } from '@/lib/permissions';
import { useNavigate } from 'react-router-dom';
import { formatMoney, CURRENCIES, DEFAULT_CURRENCY, DEFAULT_TAX_RATE } from '@/lib/money';

function fmt(n, currency = DEFAULT_CURRENCY) {
  return formatMoney(n, currency);
}

// What each status means, shown on the right of every quotation.
// Edit the words or colours here if you want them different.
const STATUS_BADGE = {
  draft: { label: 'Draft — not sent yet', icon: FileText, cls: 'text-slate-600', pill: 'bg-slate-100 text-slate-700' },
  sent: { label: 'Pending client approval', icon: Clock3, cls: 'text-amber-600', pill: 'bg-amber-100 text-amber-800' },
  accepted: { label: 'Accepted — project ready', icon: CheckCircle2, cls: 'text-emerald-600', pill: 'bg-emerald-100 text-emerald-800' },
  declined: { label: 'Declined by client', icon: XCircle, cls: 'text-rose-600', pill: 'bg-rose-100 text-rose-800' },
  expired: { label: 'Expired — no answer', icon: Clock3, cls: 'text-slate-500', pill: 'bg-slate-100 text-slate-600' },
};
// Declined and expired quotes are closed: hidden from the main list,
// still kept and visible with the "Closed" or "Declined" filter.
const CLOSED = ['declined', 'expired'];

export default function QuotationsPage() {
  const [quotes, setQuotes] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const canInvoices = canAccessModule(user, 'invoices');

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
    const clientName = quote.expand?.client?.company_name || quote.bill_to_company || '';
    const matchesQuery = !query || [quote.number, clientName].join(' ').toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === 'all'
      || (status === 'active' && !CLOSED.includes(quote.status))
      || (status === 'closed' && CLOSED.includes(quote.status))
      || quote.status === status;
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
        <Link to="/quotations/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> New quotation
        </Link>
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search quotation or client" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-transparent text-sm outline-none">
            <option value="active">Open (hide declined &amp; expired)</option>
            <option value="all">All statuses</option>
            <option value="closed">Closed (declined &amp; expired)</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading quotations…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">{status === 'active' && quotes.length > 0 ? 'No open quotations. Declined and expired ones are under the “Closed” filter.' : 'No quotations found yet. Create one from an RFQ or start a new one.'}</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((quote) => (
          <Link
            key={quote.id}
            to={`/quotations/${quote.id}/view`}
            className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-accent p-3 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-foreground">{quote.number}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${(STATUS_BADGE[quote.status] || STATUS_BADGE.draft).pill}`}>{quote.status || 'draft'}</span>
                    {quote.source_invoice && (
                      canInvoices
                        ? <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/invoices/${quote.source_invoice}/view`); }} className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:underline">From an invoice</button>
                        : <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">From an invoice</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{quote.expand?.client?.company_name || quote.bill_to_company || 'No client linked'}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>Total: {fmt(quote.total, quote.currency)}</span>
                    {quote.valid_until && <span>Valid until: {quote.valid_until}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground">
                {(() => { const b = STATUS_BADGE[quote.status] || STATUS_BADGE.draft; const Icon = b.icon; return <><Icon className={`h-4 w-4 ${b.cls}`} />{b.label}</>; })()}
              </div>
              <SuperDelete collection="quotations" id={quote.id} label={`quotation ${quote.number || ''}`.trim()} after={() => setQuotes((list) => list.filter((x) => x.id !== quote.id))} />
              </div>
            </div>
          </Link>
          ))}
        </div>
      )}
    </PortalLayout>
  );
}
