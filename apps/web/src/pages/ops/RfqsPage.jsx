import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Wrench, MessageSquare, Search, ArrowRight, Pencil, Loader2, Save, Sun, Truck, MapPin, CalendarClock, Mic, Building2 } from 'lucide-react';
import { Modal, Field, inputCls, textareaCls, btnPrimary, btnLine } from '@/components/erp/kit';
import PortalLayout from '@/layouts/PortalLayout';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbaseClient';
import SuperDelete from '@/components/erp/SuperDelete';
import { useAuth } from '@/context/AuthContext';
import { canAccessModule } from '@/lib/permissions';
import { plannerFromText } from '@/lib/solarKit';

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
  const { user } = useAuth();
  const canKit = canAccessModule(user, 'solar_kit');
  const { toast } = useToast();
  const [rfqs, setRfqs] = useState([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('quote_request');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);

  const loadRfqs = async () => {
    try {
      const result = await pb.collection('rfqs').getList(1, 200, { sort: '-created', expand: 'client,site' });
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

  // The technician has left for the site: the client gets a phone alert.
  const onTheWay = async (rfq, undo = false) => {
    setBusyId(rfq.id);
    try {
      const saved = await pb.post(`/api/client/requests/${rfq.id}/on-the-way`, undo ? { undo: true } : {});
      setRfqs((prev) => prev.map((item) => (item.id === rfq.id ? { ...item, ...saved, expand: item.expand } : item)));
      toast({ title: undo ? 'Cleared' : 'Client notified', description: undo ? '' : 'The client got an alert that the technician is on the way.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not update', description: error?.message || 'Please try again.' });
    } finally { setBusyId(null); }
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
                        {rfq.source === 'app' ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">Client app</span>
                        ) : rfq.source && (
                          <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            via {rfq.source}
                          </span>
                        )}
                        {['urgent', 'emergency'].includes(String(rfq.urgency).toLowerCase()) && (
                          <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold uppercase text-white">{rfq.urgency}</span>
                        )}
                        {rfq.on_the_way_at && !['completed', 'closed'].includes(reqStatus) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white"><Truck className="h-3.5 w-3.5" /> On the way</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {rfq.name} • {rfq.email}
                        {clientName ? ` • Linked client: ${clientName}` : ' • Not yet linked to a client record'}
                      </p>
                      {rfq.description && rfq.description !== '(voice note)' && <p className="mt-2 text-sm text-foreground">{rfq.description}</p>}
                      {rfq.reschedule_request && !['completed', 'closed'].includes(reqStatus) && (
                        <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0" /><span><b>Client asks to reschedule:</b> {rfq.reschedule_request}. Set the new date in “Schedule / edit”.</span></p>
                      )}
                      {rfq.voice_note && (
                        <div className="mt-2 max-w-sm"><p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Mic className="h-3.5 w-3.5" /> Voice note from the client</p><audio controls preload="none" src={pb.files.getURL(null, rfq.voice_note)} className="h-10 w-full" /></div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>Service: {rfq.service_type || '—'}</span>
                        {rfq.urgency && <span>Urgency: {rfq.urgency}</span>}
                        <span>Received: {rfq.created ? new Date(rfq.created).toLocaleDateString() : '—'}</span>
                        {rfq.phone && <a href={`tel:${rfq.phone}`} className="font-medium text-primary">{rfq.phone}</a>}
                        {rfq.expand?.site?.name && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{rfq.expand.site.name}</span>}
                        {rfq.address && <span>Site: {rfq.address}</span>}
                        {rfq.latitude != null && rfq.longitude != null && rfq.latitude !== '' && (
                          <a href={`https://www.google.com/maps?q=${rfq.latitude},${rfq.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary"><MapPin className="h-3.5 w-3.5" /> Open in Maps</a>
                        )}
                        {rfq.preferred_time && <span>Prefers: {rfq.preferred_time}</span>}
                      </div>
                      {(rfq.scheduled_for || rfq.technician_name) && (
                        <p className="mt-2 inline-flex rounded-lg bg-blue-50 px-2.5 py-1 text-sm text-blue-900">
                          Visit {rfq.scheduled_for ? new Date(`${rfq.scheduled_for}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : 'date not set'}{rfq.technician_name ? ` · ${rfq.technician_name}` : ''}
                        </p>
                      )}
                      {(() => {
                        let files = rfq.attachments;
                        if (typeof files === 'string') { try { files = JSON.parse(files); } catch { files = []; } }
                        return Array.isArray(files) && files.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {files.map((fid) => <a key={fid} href={pb.files.getURL(null, fid)} target="_blank" rel="noreferrer"><img src={pb.files.getURL(null, fid)} alt="Photo from the client" loading="lazy" className="h-16 w-16 rounded-lg object-cover" /></a>)}
                          </div>
                        ) : null;
                      })()}
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
                    {tab === 'quote_request' && canKit && (
                      <button onClick={() => navigate(`/solar-kit?rfq=${rfq.id}`)} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${plannerFromText(rfq.description) ? 'bg-amber-500 text-white hover:bg-amber-600' : 'border border-border hover:bg-secondary'}`}>
                        <Sun className="h-4 w-4" /> Build solar quote
                      </button>
                    )}
                    {tab === 'service_request' && rfq.client && ['new', 'reviewing', 'scheduled', 'in_progress'].includes(reqStatus) && (
                      rfq.on_the_way_at
                        ? <button onClick={() => onTheWay(rfq, true)} disabled={busyId === rfq.id} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary">Clear “on the way”</button>
                        : <button onClick={() => onTheWay(rfq)} disabled={busyId === rfq.id} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"><Truck className="h-4 w-4" /> Technician on the way</button>
                    )}
                    <button onClick={() => setEditing(rfq)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"><Pencil className="h-4 w-4" /> {tab === 'service_request' ? 'Schedule / edit' : 'Edit details'}</button>
                    <SuperDelete collection="rfqs" id={rfq.id} text="Delete" label={`request from ${rfq.company || rfq.name || 'website'}`} after={() => setRfqs((prev) => prev.filter((x) => x.id !== rfq.id))} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <RfqEditDialog rfq={editing} onClose={() => setEditing(null)} onSaved={(saved) => setRfqs((prev) => prev.map((x) => (x.id === saved.id ? { ...x, ...saved, expand: x.expand } : x)))} />
    </PortalLayout>
  );
}

// Visit planning: the client sees these in their app and gets a notification when they change.
const PLAN_FIELDS = ['scheduled_for', 'technician_name', 'client_note'];

const RFQ_FIELDS = [
  ['name', 'Contact name'], ['company', 'Company'], ['email', 'Email'], ['phone', 'Phone'],
  ['service_type', 'Service'], ['urgency', 'Urgency'], ['budget', 'Budget'], ['address', 'Location / address'],
];

function RfqEditDialog({ rfq, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (rfq) setForm(Object.fromEntries([...RFQ_FIELDS.map(([k]) => [k, rfq[k] || '']), ...PLAN_FIELDS.map((k) => [k, rfq[k] || '']), ['description', rfq.description || '']])); }, [rfq]);
  if (!rfq) return null;
  const save = async () => {
    setSaving(true);
    try {
      // Setting a visit date on a new request books it: status becomes Scheduled (the client is notified once).
      const body = { ...form };
      if (form.scheduled_for && ['', 'new', 'reviewing'].includes(rfq.request_status || '')) body.request_status = 'scheduled';
      // A new date answers the client's reschedule ask.
      if (rfq.reschedule_request && form.scheduled_for !== (rfq.scheduled_for || '')) body.reschedule_request = '';
      const saved = await pb.collection('rfqs').update(rfq.id, body);
      toast({ title: 'Request updated' });
      onSaved(saved); onClose();
    } catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} wide title="Edit request" description="Correct the client's details or the description of what they need.">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {RFQ_FIELDS.map(([k, label]) => (
            <Field key={k} label={label}><input className={inputCls} value={form[k] || ''} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} /></Field>
          ))}
        </div>
        <Field label="What they need"><textarea className={textareaCls} rows={4} value={form.description || ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></Field>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <p className="mb-3 text-sm font-semibold text-blue-900">Plan the visit <span className="font-normal text-blue-800">· the client sees this in their app</span></p>
          {rfq.reschedule_request && <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">Client asks: {rfq.reschedule_request}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Visit date"><input type="date" className={inputCls} value={form.scheduled_for || ''} onChange={(e) => setForm((p) => ({ ...p, scheduled_for: e.target.value }))} /></Field>
            <Field label="Technician"><input className={inputCls} value={form.technician_name || ''} onChange={(e) => setForm((p) => ({ ...p, technician_name: e.target.value }))} placeholder="e.g. Eric Habimana" /></Field>
          </div>
          <div className="mt-4"><Field label="Note to the client (optional)"><textarea className={textareaCls} rows={2} value={form.client_note || ''} onChange={(e) => setForm((p) => ({ ...p, client_note: e.target.value }))} placeholder="e.g. Our technician will call 30 minutes before arriving." /></Field></div>
          <p className="mt-2 text-xs text-blue-800">Saving a visit date marks the request “Scheduled” and notifies the client.</p>
        </div>
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes</button>
        </div>
      </div>
    </Modal>
  );
}
