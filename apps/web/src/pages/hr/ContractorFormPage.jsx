import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Save } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import HrTabs from './HrTabs';
import { Card, Field, BackLink, Loading, Stars, inputCls, textareaCls, btnPrimary, btnLine, toBody } from '@/components/erp/kit';
import { DEPARTMENTS, TRADES, RATE_UNITS, CONTRACTOR_STATUSES } from '@/lib/hr';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/money';

const EMPTY = {
  full_name: '', email: '', phone: '', whatsapp: '', department: 'technical', trade: '', skills: '',
  experience_years: 0, qualifications: '', certifications: '', country: 'Rwanda', city: '',
  rate_amount: 0, rate_unit: 'per_day', currency: DEFAULT_CURRENCY, has_tools: false, has_transport: false,
  status: 'available', verified: false, rating: 0, emergency_contact: '', payment_details: '', notes: '',
};

export default function ContractorFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState({ cv: null, id_document: null, certificate_file: null });
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    pb.collection('contractors').getOne(id).then((c) => {
      setExisting(c);
      setForm({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, c[k] ?? EMPTY[k]])), skills: Array.isArray(c.skills) ? c.skills.join(', ') : (c.skills || '') });
      setLoading(false);
    }).catch(() => navigate('/hr/contractors'));
  }, [id]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const tradesForDept = TRADES.filter((t) => t.dept === form.department || t.value === 'other');

  const save = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      toast({ title: 'Name and phone are required', variant: 'destructive' }); return;
    }
    setSaving(true);
    const data = {
      ...form,
      skills: form.skills.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean),
      experience_years: Number(form.experience_years) || 0,
      rate_amount: Number(form.rate_amount) || 0,
      rating: Number(form.rating) || 0,
    };
    try {
      const body = toBody(data, files);
      const saved = isEdit ? await pb.collection('contractors').update(id, body) : await pb.collection('contractors').create(body);
      toast({ title: isEdit ? 'Contractor updated' : 'Contractor added', description: `${saved.full_name} · ${saved.code}` });
      navigate(`/hr/contractors/${saved.id}`);
    } catch (err) {
      toast({ title: 'Could not save', description: err.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  const fileInput = (key, label) => (
    <Field label={label} hint={existing?.[key] ? 'A file is already saved; choose a new one only to replace it.' : 'PDF, Word or photo, up to 5 MB'}>
      <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => setFiles((f) => ({ ...f, [key]: e.target.files?.[0] || null }))} className="block w-full text-sm" />
    </Field>
  );

  return (
    <PortalLayout title={isEdit ? `Edit ${form.full_name}` : 'Add contractor'} subtitle="Contractor register">
      <Helmet><title>{isEdit ? 'Edit contractor' : 'Add contractor'} | RUNHTec Business Portal</title></Helmet>
      <HrTabs />
      {loading ? <Loading /> : (
        <form onSubmit={save} className="space-y-5">
          <div className="flex items-center gap-2"><BackLink to={isEdit ? `/hr/contractors/${id}` : '/hr/contractors'} /></div>

          <Card title="Personal & contact details">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Full name" required><input className={inputCls} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
              <Field label="Phone" required><input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+250 7XX XXX XXX" /></Field>
              <Field label="WhatsApp"><input className={inputCls} value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="If different from phone" /></Field>
              <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Country">
                <select className={inputCls} value={form.country} onChange={(e) => set('country', e.target.value)}>
                  {['Rwanda', 'Uganda', 'Kenya', 'Tanzania', 'Burundi', 'DR Congo', 'Other'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="City / district"><input className={inputCls} value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
              <Field label="Emergency contact" className="sm:col-span-2 lg:col-span-1"><input className={inputCls} value={form.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)} placeholder="Name and phone" /></Field>
            </div>
          </Card>

          <Card title="Department, skills & experience">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Department">
                <select className={inputCls} value={form.department} onChange={(e) => set('department', e.target.value)}>
                  {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </Field>
              <Field label="Main skill / trade">
                <select className={inputCls} value={form.trade} onChange={(e) => set('trade', e.target.value)}>
                  <option value="">Choose…</option>
                  {tradesForDept.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Years of experience"><input type="number" min="0" className={inputCls} value={form.experience_years} onChange={(e) => set('experience_years', e.target.value)} /></Field>
              <Field label="Other skills" hint="Separate with commas" className="sm:col-span-2 lg:col-span-3"><input className={inputCls} value={form.skills} onChange={(e) => set('skills', e.target.value)} placeholder="e.g. 3-phase wiring, inverter setup, PLC" /></Field>
              <Field label="Qualifications" className="sm:col-span-2 lg:col-span-1"><textarea className={textareaCls} rows={2} value={form.qualifications} onChange={(e) => set('qualifications', e.target.value)} /></Field>
              <Field label="Certifications / licences" className="sm:col-span-2"><textarea className={textareaCls} rows={2} value={form.certifications} onChange={(e) => set('certifications', e.target.value)} placeholder="e.g. RURA electrician licence, working-at-heights" /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.has_tools} onChange={(e) => set('has_tools', e.target.checked)} /> Has own tools</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.has_transport} onChange={(e) => set('has_transport', e.target.checked)} /> Has own transport</label>
            </div>
          </Card>

          <Card title="Rate & payment">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Standard rate"><input type="number" min="0" className={inputCls} value={form.rate_amount} onChange={(e) => set('rate_amount', e.target.value)} /></Field>
              <Field label="Rate basis">
                <select className={inputCls} value={form.rate_unit} onChange={(e) => set('rate_unit', e.target.value)}>
                  {RATE_UNITS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
              <Field label="Currency">
                <select className={inputCls} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
                </select>
              </Field>
              <Field label="Payment details" hint="Mobile money or bank account for paying fees"><input className={inputCls} value={form.payment_details} onChange={(e) => set('payment_details', e.target.value)} placeholder="MoMo 078… / Bank of Kigali …" /></Field>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">The standard rate is a guide. The fee for each project is agreed separately in the project engagement.</p>
          </Card>

          <Card title="Vetting & status">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Status">
                <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {CONTRACTOR_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Overall rating"><Stars value={Number(form.rating) || 0} onChange={(v) => set('rating', v)} /></Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={!!form.verified} onChange={(e) => set('verified', e.target.checked)} /> Documents & references verified</label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {fileInput('cv', 'CV')}
              {fileInput('id_document', 'ID / passport copy')}
              {fileInput('certificate_file', 'Certificate / licence')}
            </div>
            <Field label="Internal notes" className="mt-4"><textarea className={textareaCls} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          </Card>

          <div className="flex justify-end gap-2 pb-4">
            <button type="button" className={btnLine} onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className={btnPrimary} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save contractor</button>
          </div>
        </form>
      )}
    </PortalLayout>
  );
}
