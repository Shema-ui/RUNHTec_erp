import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Save } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Card, Field, BackLink, Loading, inputCls, textareaCls, btnPrimary, btnLine } from '@/components/erp/kit';
import { PROJECT_STATUSES, PRIORITIES, SERVICE_CATEGORIES } from '@/lib/projects';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/money';

const EMPTY = {
  title: '', client: '', quotation: '', service_category: '', status: 'scheduled', priority: 'medium',
  project_manager: '', site_address: '', start_date: '', due_date: '', completed_date: '',
  value: 0, currency: DEFAULT_CURRENCY, progress: 0, description: '', notes: '',
};

export default function ProjectFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [clients, setClients] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    pb.collection('clients').getFullList({ sort: 'company_name' }).then(setClients).catch(() => {});
    pb.collection('quotations').getFullList({ sort: '-created' }).then(setQuotes).catch(() => {});
    pb.collection('users').getFullList({ sort: 'name' })
      .then((u) => setManagers(u.filter((x) => ['project_manager', 'super_admin'].includes(x.role) && x.status === 'active'))).catch(() => {});
    if (isEdit) {
      pb.collection('projects').getOne(id).then((p) => {
        setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, p[k] ?? EMPTY[k]])) });
        setLoading(false);
      }).catch(() => navigate('/projects'));
    }
  }, [id]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const pickQuote = (qid) => {
    const qt = quotes.find((x) => x.id === qid);
    setForm((p) => ({
      ...p,
      quotation: qid,
      client: qt?.client || p.client,
      value: qt ? Number(qt.total) || p.value : p.value,
      currency: qt?.currency || p.currency,
      title: p.title || (qt ? `${qt.bill_to_company || qt.bill_to_name || 'Project'} — ${qt.number}` : ''),
      site_address: p.site_address || qt?.bill_to_address || '',
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast({ title: 'Give the project a title', variant: 'destructive' }); return; }
    setSaving(true);
    const data = {
      ...form,
      client: form.client || null,
      quotation: form.quotation || null,
      project_manager: form.project_manager || null,
      value: Number(form.value) || 0,
      progress: Math.max(0, Math.min(100, Number(form.progress) || 0)),
      completed_date: form.status === 'done' && !form.completed_date ? new Date().toISOString().slice(0, 10) : form.completed_date,
    };
    try {
      const saved = isEdit ? await pb.collection('projects').update(id, data) : await pb.collection('projects').create(data);
      toast({ title: isEdit ? 'Project updated' : 'Project created', description: saved.title });
      navigate(`/projects/${saved.id}`);
    } catch (err) {
      toast({ title: 'Could not save project', description: err.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  return (
    <PortalLayout title={isEdit ? 'Edit project' : 'New project'} subtitle="Projects & Work Orders">
      <Helmet><title>{isEdit ? 'Edit project' : 'New project'} | RUNHTec Business Portal</title></Helmet>
      {loading ? <Loading /> : (
        <form onSubmit={save} className="space-y-5">
          <BackLink to={isEdit ? `/projects/${id}` : '/projects'} />

          <Card title="Project">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Title" required className="sm:col-span-2"><input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. 10 kVA hybrid solar — Kivu Lodge" /></Field>
              <Field label="Service">
                <select className={inputCls} value={form.service_category} onChange={(e) => set('service_category', e.target.value)}>
                  <option value="">Choose…</option>
                  {SERVICE_CATEGORIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="From quotation" hint="Fills client, value and site from the quote">
                <select className={inputCls} value={form.quotation || ''} onChange={(e) => pickQuote(e.target.value)}>
                  <option value="">None</option>
                  {quotes.map((qt) => <option key={qt.id} value={qt.id}>{qt.number} — {qt.bill_to_company || qt.bill_to_name} ({qt.status})</option>)}
                </select>
              </Field>
              <Field label="Client">
                <select className={inputCls} value={form.client || ''} onChange={(e) => set('client', e.target.value)}>
                  <option value="">Choose a client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </Field>
              <Field label="Project manager">
                <select className={inputCls} value={form.project_manager || ''} onChange={(e) => set('project_manager', e.target.value)}>
                  <option value="">Not assigned</option>
                  {managers.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                </select>
              </Field>
              <Field label="Site address" className="sm:col-span-2 lg:col-span-3"><input className={inputCls} value={form.site_address} onChange={(e) => set('site_address', e.target.value)} placeholder="District, sector, street / landmark" /></Field>
            </div>
          </Card>

          <Card title="Schedule, status & value">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Status">
                <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className={inputCls} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                  {PRIORITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Start date"><input type="date" className={inputCls} value={form.start_date || ''} onChange={(e) => set('start_date', e.target.value)} /></Field>
              <Field label="Due date"><input type="date" className={inputCls} value={form.due_date || ''} onChange={(e) => set('due_date', e.target.value)} /></Field>
              <Field label="Contract value"><input type="number" min="0" className={inputCls} value={form.value} onChange={(e) => set('value', e.target.value)} /></Field>
              <Field label="Currency">
                <select className={inputCls} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
                </select>
              </Field>
              <Field label="Progress %" hint="Updates automatically from the task list"><input type="number" min="0" max="100" className={inputCls} value={form.progress} onChange={(e) => set('progress', e.target.value)} /></Field>
              <Field label="Completed on"><input type="date" className={inputCls} value={form.completed_date || ''} onChange={(e) => set('completed_date', e.target.value)} /></Field>
            </div>
          </Card>

          <Card title="Description & notes">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Scope / description"><textarea className={textareaCls} rows={5} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="What will be delivered, key equipment, client requirements" /></Field>
              <Field label="Internal notes"><textarea className={textareaCls} rows={5} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
            </div>
          </Card>

          <div className="flex justify-end gap-2 pb-4">
            <button type="button" className={btnLine} onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className={btnPrimary} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save project</button>
          </div>
        </form>
      )}
    </PortalLayout>
  );
}
