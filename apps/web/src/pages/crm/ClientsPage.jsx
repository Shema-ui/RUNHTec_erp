import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, Filter, Building2, ChevronLeft, ChevronRight, Globe, MapPin } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import PortalLayout from '@/layouts/PortalLayout';
import { CLIENT_STATUSES, clientStatusInfo, getInitials } from '@/lib/crm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PER_PAGE = 20;

export default function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const searchTimer = useRef(null);

  const load = useCallback(async (pg = 1, q = search, st = statusFilter) => {
    setLoading(true);
    try {
      const filters = [];
      if (st && st !== 'all') filters.push(`status = '${st}'`);
      if (q.trim()) {
        const safe = q.trim().replace(/'/g, "''");
        filters.push(`(company_name ~ '${safe}' || trading_name ~ '${safe}' || city ~ '${safe}' || industry ~ '${safe}')`);
      }
      const result = await pb.collection('clients').getList(pg, PER_PAGE, {
        filter: filters.join(' && ') || undefined,
        sort: '-created',
        expand: 'account_manager',
        requestKey: `clients-list-${pg}`,
      });
      setClients(result.items);
      setTotal(result.totalItems);
      setTotalPages(result.totalPages);
      setPage(pg);
    } catch (e) {
      console.error('clients load error', e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(1, search, statusFilter); }, []);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, val, statusFilter), 350);
  };

  const handleStatus = (val) => {
    setStatusFilter(val);
    load(1, search, val);
  };

  return (
    <PortalLayout title="Client Database" subtitle="CRM — All clients">
      <Helmet>
        <title>Clients | RUNHTec CRM</title>
        <meta name="description" content="Full client database — search, filter and manage all company relationships." />
      </Helmet>

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search company, city, industry…"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatus}>
          <SelectTrigger className="h-9 w-[160px]">
            <Filter className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {CLIENT_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link
          to="/crm/clients/new"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Client
        </Link>
      </div>

      {/* Count */}
      <p className="mb-3 text-xs text-muted-foreground">{loading ? 'Loading…' : `${total} client${total !== 1 ? 's' : ''} found`}</p>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-0 divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No clients found</p>
            <p className="text-xs text-muted-foreground">
              {search || statusFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Get started by adding your first client.'}
            </p>
            {!search && statusFilter === 'all' && (
              <Link to="/crm/clients/new" className="mt-1 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Add First Client
              </Link>
            )}
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="hidden grid-cols-[2fr_1fr_1fr_1.5fr_1fr] gap-4 border-b border-border bg-secondary/50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <span>Company</span>
              <span>Status</span>
              <span>Industry</span>
              <span>Location</span>
              <span>Account Manager</span>
            </div>
            <div className="divide-y divide-border">
              {clients.map(client => {
                const statusInfo = clientStatusInfo(client.status);
                const am = client.expand?.account_manager;
                return (
                  <div
                    key={client.id}
                    onClick={() => navigate(`/crm/clients/${client.id}`)}
                    className="grid cursor-pointer grid-cols-1 gap-2 px-5 py-4 transition-colors hover:bg-secondary/40 md:grid-cols-[2fr_1fr_1fr_1.5fr_1fr] md:items-center md:gap-4"
                  >
                    {/* Company */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {client.client_id
                          ? <span className="text-[9px]">{client.client_id}</span>
                          : getInitials(client.company_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{client.company_name}</p>
                        {client.trading_name && (
                          <p className="truncate text-xs text-muted-foreground">t/a {client.trading_name}</p>
                        )}
                      </div>
                    </div>
                    {/* Status */}
                    <div>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    {/* Industry */}
                    <p className="text-sm text-muted-foreground">{client.industry || '—'}</p>
                    {/* Location */}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      {(client.city || client.country) ? (
                        <>
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{[client.city, client.country].filter(Boolean).join(', ')}</span>
                        </>
                      ) : '—'}
                    </div>
                    {/* AM */}
                    <p className="text-sm text-muted-foreground">{am?.name || '—'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => load(page - 1)}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-40 hover:bg-secondary"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => load(page + 1)}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-40 hover:bg-secondary"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
