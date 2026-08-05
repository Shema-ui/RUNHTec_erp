import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Edit2, Globe, MapPin, Building2, Phone, Mail, Tag, Wrench, User,
  Clock, Trash2, Loader2, AlertTriangle, FileText, FolderKanban, ReceiptText,
  CreditCard, ClipboardList, Construction,
} from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import PortalLayout from '@/layouts/PortalLayout';
import { clientStatusInfo, CLIENT_CATEGORIES, CLIENT_SERVICES, formatCurrency } from '@/lib/crm';
import ContactsTab from '@/components/crm/ContactsTab';
import ActivitiesTab from '@/components/crm/ActivitiesTab';
import EquipmentTab from '@/components/crm/EquipmentTab';
import NotesTab from '@/components/crm/NotesTab';
import DocumentsTab from '@/components/crm/DocumentsTab';
import FollowUpsTab from '@/components/crm/FollowUpsTab';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'activities', label: 'Activities' },
  { key: 'equipment', label: 'Equipment Register' },
  { key: 'followups', label: 'Follow-Ups' },
  { key: 'notes', label: 'Notes' },
  { key: 'documents', label: 'Documents' },
  { key: 'quotations', label: 'Quotations' },
  { key: 'projects', label: 'Projects' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
];

const FUTURE_TABS = ['quotations', 'projects', 'maintenance', 'invoices', 'payments'];

function InfoRow({ label, value, href }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{value}</a>
      ) : (
        <span className="text-sm text-foreground">{value}</span>
      )}
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h4 className="font-display mb-4 border-b border-border pb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function OverviewTab({ client }) {
  const statusInfo = clientStatusInfo(client.status);
  const cats = Array.isArray(client.categories) ? client.categories : client.categories ? [client.categories] : [];
  const svcs = Array.isArray(client.services) ? client.services : client.services ? [client.services] : [];
  const getCatLabel = v => CLIENT_CATEGORIES.find(c => c.value === v)?.label || v;
  const getSvcLabel = v => CLIENT_SERVICES.find(s => s.value === v)?.label || v;
  const am = client.expand?.account_manager;

  return (
    <div className="space-y-5">
      <InfoCard title="Company Information">
        <InfoRow label="Company Name" value={client.company_name} />
        <InfoRow label="Trading Name" value={client.trading_name} />
        <InfoRow label="Client ID" value={client.client_id} />
        <InfoRow label="Industry" value={client.industry} />
        <InfoRow label="Registration No." value={client.registration_number} />
        <InfoRow label="VAT / Tax No." value={client.vat_number} />
        <InfoRow label="Website" value={client.website} href={client.website} />
        <InfoRow label="Potential Value" value={formatCurrency(client.potential_value)} />
        <InfoRow label="Account Manager" value={am?.name || am?.email} />
        <InfoRow label="Date Added" value={new Date(client.created).toLocaleDateString()} />
      </InfoCard>

      <InfoCard title="Address">
        <InfoRow label="Street" value={client.street} />
        <InfoRow label="Building" value={client.building_name} />
        <InfoRow label="Office" value={client.office_number_addr} />
        <InfoRow label="Suburb / Sector" value={client.sector} />
        <InfoRow label="City" value={client.city} />
        <InfoRow label="District" value={client.district} />
        <InfoRow label="Province / State" value={client.province} />
        <InfoRow label="Country" value={client.country} />
        <InfoRow label="GPS Coordinates" value={client.gps_coordinates} />
      </InfoCard>

      {(cats.length > 0 || svcs.length > 0) && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h4 className="font-display mb-4 border-b border-border pb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Classification & Services</h4>
          {cats.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Categories</p>
              <div className="flex flex-wrap gap-2">
                {cats.map(c => (
                  <span key={c} className="rounded-full border border-border bg-secondary px-3 py-0.5 text-xs text-foreground">{getCatLabel(c)}</span>
                ))}
              </div>
            </div>
          )}
          {svcs.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Services</p>
              <div className="flex flex-wrap gap-2">
                {svcs.map(s => (
                  <span key={s} className="rounded-full border border-primary/30 bg-primary/5 px-3 py-0.5 text-xs text-primary">{getSvcLabel(s)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlaceholderTab({ label, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm font-medium text-foreground">{label} Module</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        This module is not yet developed. When available, all {label.toLowerCase()} linked to this client will appear here, automatically retrieving client data from this CRM record.
      </p>
    </div>
  );
}

export default function ClientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    pb.collection('clients').getOne(id, { expand: 'account_manager', requestKey: `profile-${id}` })
      .then(c => { setClient(c); setLoading(false); })
      .catch(() => { navigate('/crm/clients'); });
  }, [id]);

  useEffect(() => {
    if (!client) return;
    const loadCounts = async () => {
      try {
        const [contacts, activities, equipment, notes, docs, followups] = await Promise.all([
          pb.collection('client_contacts').getList(1, 1, { filter: `client = '${id}'`, requestKey: `cnt-contacts` }),
          pb.collection('client_activities').getList(1, 1, { filter: `client = '${id}'`, requestKey: `cnt-activities` }),
          pb.collection('equipment').getList(1, 1, { filter: `client = '${id}'`, requestKey: `cnt-equipment` }),
          pb.collection('client_notes').getList(1, 1, { filter: `client = '${id}'`, requestKey: `cnt-notes` }),
          pb.collection('client_documents').getList(1, 1, { filter: `client = '${id}'`, requestKey: `cnt-docs` }),
          pb.collection('client_followups').getList(1, 1, { filter: `client = '${id}' && status = 'pending'`, requestKey: `cnt-followups` }),
        ]);
        setCounts({
          contacts: contacts.totalItems,
          activities: activities.totalItems,
          equipment: equipment.totalItems,
          notes: notes.totalItems,
          documents: docs.totalItems,
          followups: followups.totalItems,
        });
      } catch (e) { /* non-critical */ }
    };
    loadCounts();
  }, [client]);

  const setTab = (tab) => setSearchParams({ tab });

  const handleDelete = async () => {
    if (!confirm(`Delete ${client.company_name}? This will remove all related records (contacts, activities, equipment, etc.) and cannot be undone.`)) return;
    setDeleting(true);
    try {
      await pb.collection('clients').delete(id);
      navigate('/crm/clients');
    } catch (e) {
      alert('Failed to delete client: ' + e.message);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <PortalLayout title="Client Profile" subtitle="CRM">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PortalLayout>
    );
  }

  const statusInfo = clientStatusInfo(client.status);

  const tabCountKey = {
    contacts: 'contacts', activities: 'activities', equipment: 'equipment',
    notes: 'notes', documents: 'documents', followups: 'followups',
  };

  return (
    <PortalLayout title={client.company_name} subtitle="CRM — Client Profile">
      <Helmet>
        <title>{client.company_name} | RUNHTec CRM</title>
        <meta name="description" content={`Client profile for ${client.company_name} — contacts, equipment, activities and more.`} />
      </Helmet>

      {/* Back + actions */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button onClick={() => navigate('/crm/clients')} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div className="ml-auto flex gap-2">
          <Link to={`/crm/clients/${id}/edit`} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary">
            <Edit2 className="h-4 w-4" /> Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </button>
        </div>
      </div>

      {/* Profile header */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-start gap-4 p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-extrabold text-primary">
            {(client.company_name || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-xl font-extrabold text-foreground">{client.company_name}</h1>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
              {client.client_id && (
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-mono text-muted-foreground">{client.client_id}</span>
              )}
            </div>
            {client.trading_name && (
              <p className="mt-0.5 text-sm text-muted-foreground">t/a {client.trading_name}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {client.industry && (
                <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{client.industry}</span>
              )}
              {(client.city || client.country) && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[client.city, client.country].filter(Boolean).join(', ')}</span>
              )}
              {client.website && (
                <a href={client.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary">
                  <Globe className="h-3.5 w-3.5" />{client.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
          {client.potential_value > 0 && (
            <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-right">
              <p className="text-[11px] text-muted-foreground">Potential Value</p>
              <p className="font-display text-lg font-extrabold text-foreground">{formatCurrency(client.potential_value)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-xl border border-border bg-secondary/40 p-1">
          {TABS.map(tab => {
            const cnt = counts[tabCountKey[tab.key]];
            return (
              <button
                key={tab.key}
                onClick={() => setTab(tab.key)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {cnt > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">{cnt}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && <OverviewTab client={client} />}
        {activeTab === 'contacts' && <ContactsTab clientId={id} />}
        {activeTab === 'activities' && <ActivitiesTab clientId={id} />}
        {activeTab === 'equipment' && <EquipmentTab clientId={id} />}
        {activeTab === 'followups' && <FollowUpsTab clientId={id} />}
        {activeTab === 'notes' && <NotesTab clientId={id} />}
        {activeTab === 'documents' && <DocumentsTab clientId={id} />}
        {activeTab === 'quotations' && <PlaceholderTab label="Quotations" icon={FileText} />}
        {activeTab === 'projects' && <PlaceholderTab label="Projects" icon={FolderKanban} />}
        {activeTab === 'maintenance' && <PlaceholderTab label="Maintenance" icon={Wrench} />}
        {activeTab === 'invoices' && <PlaceholderTab label="Invoices" icon={ReceiptText} />}
        {activeTab === 'payments' && <PlaceholderTab label="Payments" icon={CreditCard} />}
      </div>
    </PortalLayout>
  );
}
