import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Wrench, MessageSquare, Search, ArrowRight } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbaseClient';

const TABS = [
  { key: 'quote_request', label: 'Quote Requests', icon: FileQuestion },
  { key: 'service_request', label: 'Service Requests', icon: Wrench },
  { key: 'contact_enquiry', label: 'General Enquiries', icon: MessageSquare },
];

const REQUEST_STATUS_LABELS = {
  new: 'New',
  reviewing: 'Reviewing',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  closed: 'Closed',
};

const REQUEST_STATUS_OPTIONS = Object.keys(REQUEST_STATUS_LABELS);

function normalizedType(rfq) {
  // Older/manually-created records may not have request_type set — fall back
  // to treating them as quote requests so nothing already in the pipeline
  // disappears from view.
  return rfq.request_type || 'quote_request';
}

function normalizedStatus(rfq) {
  return rfq.request_status || 'new';
}

export default function RfqsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rfqs, setRfqs] = useState([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('quote_request');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const loadRfqs = async () => {
    try {
      const result = await pb.collection('rfqs').getList(1, 200, { sort: '-created', expand: 'client' });
      setRfqs(result.items || []);
    } catch (error) {
      console.error('RFQs load error', error);
      setRfqs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRfqs();
  }, []);

  const counts = useMemo(() => {
    const base = { quote_request: 0, service_request: 0, contact_enquiry: 0 };
    rfqs.forEach((rfq) => {
      const type = normalizedType(rfq);
      if (base[type] !== undefined) base[type] += 1;
    });
    return base;
  }, [rfqs]);

  const filtered = useMemo(() => {
    return rfqs.filter((rfq) => {
      const matchesTab = normalizedType(rfq) === tab;
      const haystack = [rfq.company, rfq.name, rfq.service_type, rfq.email].join(' ').toLowerCase();
      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      return matchesTab && matchesQuery;
    });
  }, [query, tab, rfqs]);

  const updateStatus = async (rfq, request_status) => {
    setBusyId(rfq.id);
    try {
      await pb.collection('rfqs').update(rfq.id, { request_status });
      setRfqs((prev) => prev.map((item) => (item.id === rfq.id ? { ...item, request_status } : item)));
    } catch (error) {
      console.error('RFQ status update error', error);
      toast({ variant: 'destructive', title: 'Could not update status', description: error?.message || 'Please try again.' });
    } finally {
      setBusyId(null);
    }
  };

  const convertToQuotation = async (rfq) => {
    setBusyId(rfq.id);
    try {
      const number = `Q-${Date.now().toString(36).toUpperCase()}`;
      const quotation = await pb.collection('quotations').create({
        rfq: rfq.id,
        client: rfq.client || null,
        number,
        bill_to_name: rfq.name || '',
        bill_to_company: rfq.company || '',
        bill_to_email: rfq.email || '',
        bill_to_phone: rfq.phone || '',
        bill_to_address: rfq.address || '',
        items: [],
        subtotal: 0,
        tax_rate: 0,
        tax_amount: 0,
        discount_amount: 0,
        total: 0,
        currency: 'RWF',
        status: 'draft',
        notes: `Drafted from RFQ: ${rfq.description || rfq.service_type || ''}`.trim(),
      });
      await pb.collection('rfqs').update(rfq.id, { status: 'quoted', request_status: 'reviewing' });
      setRfqs((prev) => prev.map((item) => (item.id === rfq.id ? { ...item, status: 'quoted', request_status: 'reviewing' } : item)));
      toast({ title: 'Draft quotation created', description: `${number} was added to the Quotations workflow.` });
      navigate(`/quotations/${quotation.id}/edit`);
    } catch (error) {
      console.error('Convert to quotation error', error);
      toast({ variant: 'destructive', title: 'Could not create quotation', description: error?.message || 'Please try again.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PortalLayout title="RFQs & Requests" subtitle="Website submissions, quote requests, and service tickets">
      <Helmet>
        <title>RFQs | RUNHTec Business Portal</title>
        <meta name="description" content="Review incoming quote requests, service tickets, and general enquiries from the website and convert them into quotations." />
      </Helmet>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by company, contact or service" className="w-full bg-transparent text-sm outline-none" />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
              tab === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            <span className={`rounded-full px-1.5 text-xs ${tab === key ? 'bg-white/20' : 'bg-secondary'}`}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading requests…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No {TABS.find((t) => t.key === tab)?.label.toLowerCase()} match the current search.
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((rfq) => {
            const clientName = rfq.expand?.client?.company_name;
            const reqStatus = normalizedStatus(rfq);
            return (
              <div key={rfq.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-accent p-3 text-primary">
                      <FileQuestion className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold text-foreground">{rfq.company || rfq.name}</h3>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          {REQUEST_STATUS_LABELS[reqStatus] || reqStatus}
                        </span>
                        {rfq.source && (
                          <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            via {rfq.source}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {rfq.name} • {rfq.email}
                        {clientName ? ` • Linked client: ${clientName}` : ' • Not yet linked to a client record'}
                      </p>
                      <p className="mt-2 text-sm text-foreground">{rfq.description}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>Service: {rfq.service_type || '—'}</span>
                        {rfq.urgency && <span>Urgency: {rfq.urgency}</span>}
                        <span>Received: {rfq.created ? new Date(rfq.created).toLocaleDateString() : '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-stretch gap-2 self-start">
                    <select
                      value={reqStatus}
                      disabled={busyId === rfq.id}
                      onChange={(e) => updateStatus(rfq, e.target.value)}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                    >
                      {REQUEST_STATUS_OPTIONS.map((value) => (
                        <option key={value} value={value}>{REQUEST_STATUS_LABELS[value]}</option>
                      ))}
                    </select>
                    {tab === 'quote_request' && (
                      <button
                        onClick={() => convertToQuotation(rfq)}
                        disabled={busyId === rfq.id}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        Convert to quotation <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
