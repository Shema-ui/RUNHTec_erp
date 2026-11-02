import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Loader2, Save, CheckCircle2, Circle, FileText, Trash2, Upload, IdCard, GraduationCap, Phone, UserRound, ShieldAlert, Download,
} from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Card, Field, inputCls, textareaCls, btnPrimary, btnLine, toBody, fmtDate } from '@/components/erp/kit';

const EDUCATION = ['Primary', 'Secondary (O-Level)', 'Secondary (A-Level / A2)', 'TVET certificate', 'Diploma (A1)', "Bachelor's degree (A0)", "Master's degree", 'Other'];
const DOC_KINDS = [
  { value: 'transcript', label: 'Academic transcript' },
  { value: 'certificate', label: 'Certificate / diploma' },
  { value: 'licence', label: 'Professional licence' },
  { value: 'cv', label: 'CV' },
  { value: 'recommendation', label: 'Recommendation letter' },
  { value: 'other', label: 'Other' },
];
const kindLabel = (v) => DOC_KINDS.find((k) => k.value === v)?.label || 'Document';

const FIELDS = ['full_name', 'phone', 'whatsapp', 'momo_number', 'date_of_birth', 'gender', 'national_id_number', 'district', 'address',
  'emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone', 'education_level', 'institution', 'field_of_study', 'skills'];
const BLANK = Object.fromEntries(FIELDS.map((f) => [f, '']));
const MAX = 5 * 1024 * 1024;

export const REQUIRED = [
  ['full_name', 'Full name'], ['phone', 'Phone number'], ['national_id_number', 'ID / passport number'],
  ['emergency_contact_name', 'Emergency contact'], ['emergency_contact_phone', 'Emergency contact phone'],
  ['photo', 'Profile photo'], ['id_document', 'Copy of ID / passport'],
];

/**
 * A staff member's profile: photo, personal details, ID, education and
 * transcripts/certificates. Used on "My profile" (own) and by the Super Admin / HR
 * (any person). `onboarding` shows the first-login "submit to unlock" flow.
 */
export default function StaffProfileEditor({ userId, account, onboarding = false, onCompleted }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null); // saved record (or null)
  const [form, setForm] = useState(BLANK);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyFile, setBusyFile] = useState('');
  const [newDoc, setNewDoc] = useState({ kind: 'transcript', title: '', file: null });
  const [fileKey, setFileKey] = useState(0);

  const load = async () => {
    const [p] = await pb.collection('staff_profiles').getFullList({ filter: `user = '${userId}'` }).catch(() => []);
    setProfile(p || null);
    setForm(p ? { ...BLANK, ...Object.fromEntries(FIELDS.map((f) => [f, p[f] ?? ''])) } : { ...BLANK, full_name: account?.name || '', phone: account?.phone || '' });
    const d = await pb.collection('staff_documents').getFullList({ filter: `user = '${userId}'`, sort: '-created' }).catch(() => []);
    setDocs(d);
    setLoading(false);
  };
  useEffect(() => { if (userId) load(); }, [userId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const merged = { ...(profile || {}), ...form };
  const checklist = useMemo(() => REQUIRED.map(([k, label]) => ({ k, label, done: Boolean(String(merged[k] || '').trim()) })), [form, profile]);
  const doneCount = checklist.filter((c) => c.done).length;

  // Create the profile record the first time, update it afterwards.
  const saveProfile = async (extra = {}, files = {}) => {
    const body = toBody({ ...form, ...extra, user: userId }, files);
    const saved = profile?.id
      ? await pb.collection('staff_profiles').update(profile.id, body)
      : await pb.collection('staff_profiles').create(body);
    setProfile(saved);
    return saved;
  };

  const uploadOwnFile = async (field, file) => {
    if (!file) return;
    if (file.size > MAX) { toast({ title: 'File too large', description: 'Maximum 5 MB.', variant: 'destructive' }); return; }
    if (field === 'photo' && !/^image\//.test(file.type)) { toast({ title: 'Choose a photo (JPG or PNG)', variant: 'destructive' }); return; }
    setBusyFile(field);
    try {
      await saveProfile({}, { [field]: file });
      toast({ title: field === 'photo' ? 'Photo saved' : 'ID copy saved' });
    } catch (e) { toast({ title: 'Upload failed', description: e.message, variant: 'destructive' }); }
    finally { setBusyFile(''); }
  };

  const addDoc = async () => {
    if (!newDoc.file) { toast({ title: 'Choose the file to upload', variant: 'destructive' }); return; }
    if (newDoc.file.size > MAX) { toast({ title: 'File too large', description: 'Maximum 5 MB.', variant: 'destructive' }); return; }
    setBusyFile('doc');
    try {
      await pb.collection('staff_documents').create(toBody({ user: userId, kind: newDoc.kind, title: newDoc.title || newDoc.file.name }, { file: newDoc.file }));
      setNewDoc({ kind: newDoc.kind, title: '', file: null }); setFileKey((k) => k + 1);
      setDocs(await pb.collection('staff_documents').getFullList({ filter: `user = '${userId}'`, sort: '-created' }));
      toast({ title: 'Document added' });
    } catch (e) { toast({ title: 'Upload failed', description: e.message, variant: 'destructive' }); }
    finally { setBusyFile(''); }
  };
  const removeDoc = async (d) => {
    if (!window.confirm(`Remove “${d.title}”?`)) return;
    try { await pb.collection('staff_documents').delete(d.id); setDocs((list) => list.filter((x) => x.id !== d.id)); }
    catch (e) { toast({ title: 'Could not remove', description: e.message, variant: 'destructive' }); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveProfile();
      if (onboarding) {
        await pb.completeProfile();
        toast({ title: 'Profile complete — welcome!', description: 'Your pages are now open.' });
        onCompleted?.();
        navigate('/dashboard', { replace: true });
        return;
      }
      toast({ title: 'Profile saved' });
    } catch (e) {
      toast({ title: onboarding ? 'Profile not complete yet' : 'Could not save', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const photoUrl = profile?.photo ? pb.files.getURL(profile, profile.photo) : '';
  const allDone = doneCount === checklist.length;

  return (
    <div className="space-y-5">
      {onboarding && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="font-display text-lg font-bold text-foreground">Welcome{account?.name ? `, ${account.name.split(' ')[0]}` : ''}! Let’s set up your profile.</h2>
          <p className="mt-1 text-sm text-muted-foreground">Before you can use the portal, add your photo, contact details, a copy of your ID and your transcripts or certificates. When everything marked required is done, press <strong>Submit profile</strong> at the bottom and your pages will open.</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            {checklist.map((c) => (
              <span key={c.k} className={`inline-flex items-center gap-1.5 text-sm ${c.done ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                {c.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}{c.label}
              </span>
            ))}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / checklist.length) * 100}%` }} /></div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card title={<span className="inline-flex items-center gap-2"><Camera className="h-4 w-4" /> Photo</span>}>
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-4 border-secondary bg-secondary">
              {photoUrl ? <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" /> : <UserRound className="h-16 w-16 text-muted-foreground/50" />}
            </div>
            <label className={`${btnLine} cursor-pointer`}>
              {busyFile === 'photo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {photoUrl ? 'Change photo' : 'Upload photo'} <span className="text-rose-600">*</span>
              <input type="file" accept="image/*" className="sr-only" aria-label="Profile photo" onChange={(e) => uploadOwnFile('photo', e.target.files?.[0])} />
            </label>
            <p className="text-center text-xs text-muted-foreground">A clear passport-style photo of your face. JPG or PNG, up to 5 MB.</p>
          </div>
        </Card>

        <Card title={<span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" /> Personal &amp; contact details</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name (as on your ID)" required><input className={inputCls} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
            <Field label="Phone number" required><input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+250 7XX XXX XXX" /></Field>
            <Field label="WhatsApp (if different)"><input className={inputCls} value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></Field>
            <Field label="Mobile money number for payments" hint="MTN MoMo or Airtel Money"><input className={inputCls} value={form.momo_number} onChange={(e) => set('momo_number', e.target.value)} /></Field>
            <Field label="Date of birth"><input type="date" className={inputCls} value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} /></Field>
            <Field label="Gender">
              <select className={inputCls} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">Choose…</option><option>Male</option><option>Female</option><option>Prefer not to say</option>
              </select>
            </Field>
            <Field label="District"><input className={inputCls} value={form.district} onChange={(e) => set('district', e.target.value)} placeholder="e.g. Gasabo" /></Field>
            <Field label="Home address"><input className={inputCls} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Sector, cell, village / street" /></Field>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={<span className="inline-flex items-center gap-2"><IdCard className="h-4 w-4" /> Identity</span>}>
          <div className="space-y-4">
            <Field label="National ID or passport number" required><input className={inputCls} value={form.national_id_number} onChange={(e) => set('national_id_number', e.target.value)} /></Field>
            <div>
              <p className="mb-1.5 text-sm font-medium">Copy of ID / passport <span className="text-rose-600">*</span></p>
              <div className="flex flex-wrap items-center gap-2">
                <label className={`${btnLine} cursor-pointer`}>
                  {busyFile === 'id_document' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {profile?.id_document ? 'Replace ID copy' : 'Upload ID copy'}
                  <input type="file" accept="image/*,application/pdf" className="sr-only" aria-label="ID copy" onChange={(e) => uploadOwnFile('id_document', e.target.files?.[0])} />
                </label>
                {profile?.id_document && <a href={pb.files.getURL(profile, profile.id_document)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><Download className="h-4 w-4" /> View uploaded ID</a>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Photo or scan of both sides, or a PDF. Up to 5 MB.</p>
            </div>
          </div>
        </Card>

        <Card title={<span className="inline-flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Emergency contact</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required><input className={inputCls} value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)} /></Field>
            <Field label="Relationship"><input className={inputCls} value={form.emergency_contact_relation} onChange={(e) => set('emergency_contact_relation', e.target.value)} placeholder="e.g. Spouse, parent" /></Field>
            <Field label="Phone" required className="sm:col-span-2"><input className={inputCls} value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)} /></Field>
          </div>
        </Card>
      </div>

      <Card title={<span className="inline-flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Education, transcripts &amp; certificates</span>}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Highest education">
            <select className={inputCls} value={form.education_level} onChange={(e) => set('education_level', e.target.value)}>
              <option value="">Choose…</option>{EDUCATION.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="School / institution"><input className={inputCls} value={form.institution} onChange={(e) => set('institution', e.target.value)} /></Field>
          <Field label="Field of study / trade"><input className={inputCls} value={form.field_of_study} onChange={(e) => set('field_of_study', e.target.value)} placeholder="e.g. Electrical installation" /></Field>
          <Field label="Skills" className="sm:col-span-3"><textarea className={textareaCls} rows={2} value={form.skills} onChange={(e) => set('skills', e.target.value)} placeholder="e.g. Solar installation, CCTV, welding, AutoCAD" /></Field>
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-border p-4">
          <p className="mb-3 text-sm font-semibold">Add a transcript, certificate or other document</p>
          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <Field label="Type">
              <select className={inputCls} value={newDoc.kind} onChange={(e) => setNewDoc((d) => ({ ...d, kind: e.target.value }))} aria-label="Document type">
                {DOC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </Field>
            <Field label="Title"><input className={inputCls} value={newDoc.title} onChange={(e) => setNewDoc((d) => ({ ...d, title: e.target.value }))} placeholder="e.g. A2 Electricity certificate" aria-label="Document title" /></Field>
            <Field label="File (PDF or photo, 5 MB max)"><input key={fileKey} type="file" accept="image/*,application/pdf" className="block w-full text-sm" aria-label="Document file" onChange={(e) => setNewDoc((d) => ({ ...d, file: e.target.files?.[0] || null }))} /></Field>
            <button type="button" className={btnPrimary} onClick={addDoc} disabled={busyFile === 'doc'}>{busyFile === 'doc' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Add</button>
          </div>
        </div>

        {docs.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No transcripts or certificates uploaded yet.</p> : (
          <ul className="mt-4 divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate font-medium">{d.title}</span><span className="text-xs text-muted-foreground">· {kindLabel(d.kind)} · {fmtDate(d.created)}</span></span>
                <span className="flex items-center gap-3">
                  {d.file && <a href={pb.files.getURL(d, d.file)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Download className="h-4 w-4" /> Open</a>}
                  <button onClick={() => removeDoc(d)} aria-label={`Remove ${d.title}`} className="text-muted-foreground hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3 pb-4">
        {onboarding && !allDone && <p className="text-sm text-muted-foreground">{checklist.length - doneCount} required item{checklist.length - doneCount === 1 ? '' : 's'} left</p>}
        <button className={btnPrimary} onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : onboarding ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {onboarding ? 'Submit profile' : 'Save profile'}
        </button>
      </div>
    </div>
  );
}
