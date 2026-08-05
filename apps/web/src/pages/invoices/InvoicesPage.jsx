import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Eye, Edit2, Trash2, Copy, Loader2, FileText,
  CheckCircle2, Clock, XCircle, AlertCircle, Send,
} from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import PortalLayout from '@/layouts/PortalLayout';
import { useToast } from '@/hooks/use-toast';

const STATUS_INFO = {
  draft:     { label: 'Draft',     cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: FileText },
  sent:      { label: 'Sent',      cls: 'bg-blue-50 text-blue-700 border-blue-200',    icon: Send },
  paid:      { label: 'Paid',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  overdue:   { label: 'Overdue',   cls: 'bg-rose-50 text-rose-700 border-rose-200',   icon: AlertCircle },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500 border-gray-200',  icon: XCircle },
};

function StatusBadge({ status }) {
  const info = STATUS_INFO[status] || STATUS_INFO.draft;
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${info.cls}`}>
      <Icon className="h-3 w-3" />
      {info.label}
    </span>
  );
}

function fmt(amount, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR', maximumFractionDigits: 2 }).format(amount || 0);
}

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters = [];
      if (search.trim()) filters.push(`(invoice_number ~ "${search}" || bill_to_name ~ "${search}" || bill_to_company ~ "${search}")`);
      if (statusFilter !== 'all') filters.push(`status = "${statusFilter}"`);
      const result = await pb.collection('invoices').getList(1, 200, {
        filter: filters.join(' && ') || '',
        sort: '-created',
        requestKey: 'invoices-list',
      });
      setInvoices(result.items);
    } catch (e) {
      if (e.isAbort) return;
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (inv) => {
    if (!confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    setDeleting(inv.id);
    try {
      await pb.collection('invoices').delete(inv.id);
      setInvoices(p => p.filter(i => i.id !== inv.id));
      toast({ title: 'Invoice deleted' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const handleDuplicate = async (inv) => {
    try {
      const year = new Date().getFullYear();
      const allInv = await pb.collection('invoices').getList(1, 1, { sort: '-created', requestKey: 'dup-count' });
      const num = allInv.totalItems + 1;
      const newNum = `INV-${year}-${String(num).padStart(4, '0')}`;
      const { id, created, updated, ...rest } = inv;
      const created2 = await pb.collection('invoices').create({ ...rest, invoice_number: newNum, status: 'draft' });
      toast({ title: 'Invoice duplicated', description: newNum });
      navigate(`/invoices/${created2.id}/edit`);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const totalsByStatus = invoices.reduce((acc, inv) => {
    acc[inv.status] = (acc[inv.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <PortalLayout title="Invoices" subtitle="Finance — Invoice Management">
      <Helmet>
        <title>Invoices | RUNHTec Business Portal</title>
        <meta name="description" content="Create, manage and track professional invoices for RUNHTec Contractors." />
      </Helmet>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Manage and issue professional invoices</p>
        </div>
        <Link
          to="/invoices/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Invoice
        </Link>
      </div>

      {/* Summary tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { key: 'all', label: 'All', count: invoices.length },
          { key: 'draft', label: 'Draft', count: totalsByStatus.draft || 0 },
          { key: 'sent', label: 'Sent', count: totalsByStatus.sent || 0 },
          { key: 'paid', label: 'Paid', count: totalsByStatus.paid || 0 },
          { key: 'overdue', label: 'Overdue', count: totalsByStatus.overdue || 0 },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`rounded-xl border p-3 text-left transition-all hover:shadow-sm ${statusFilter === s.key ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
          >
            <p className="font-display text-2xl font-extrabold text-foreground">{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search by invoice #, client name or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium text-foreground">No invoices found</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first invoice to get started.</p>
            <Link to="/invoices/new" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Create Invoice
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map(inv => (
                  <tr key={inv.id} className="group transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                      <Link to={`/invoices/${inv.id}/view`} className="hover:underline">{inv.invoice_number}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{inv.bill_to_name || inv.bill_to_company || '—'}</p>
                      {inv.bill_to_company && inv.bill_to_name && (
                        <p className="text-xs text-muted-foreground">{inv.bill_to_company}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.invoice_date || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.due_date || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt(inv.total, inv.currency)}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/invoices/${inv.id}/view`} title="View" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link to={`/invoices/${inv.id}/edit`} title="Edit" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                          <Edit2 className="h-4 w-4" />
                        </Link>
                        <button onClick={() => handleDuplicate(inv)} title="Duplicate" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(inv)}
                          disabled={deleting === inv.id}
                          title="Delete"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          {deleting === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
