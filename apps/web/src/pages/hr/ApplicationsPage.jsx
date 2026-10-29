import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, Mail, MapPin, FileText, UserCheck, Loader2, MessageCircle } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import HrTabs from './HrTabs';
import {
  Toolbar, SearchBox, FilterSelect, Loading, Empty, Pill, Modal, InfoRow, Stars, Field,
  textareaCls, btnPrimary, btnLine, fmtDate,
} from '@/components/erp/kit';
import {
  APPLICATION_STATUSES, DEPARTMENTS, TRADES, statusInfo, tradeLabel, deptLabel, rateUnitLabel,
} from '@/lib/hr';

export default function ApplicationsPage() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('open');
  const [dept, setDept] = useState('all');
  const [trade, setTrade] = useState('all');
  const [params, setParams] = useSearchParams();
  const openId = params.get('open');

  const load = () => pb.collection('job_applications').getFullList({ sort: '-created' })
    .then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => (items || []).filter((a) => {
    if (status === 'open' && !['new', 'shortlisted', 'interview', 'on_hold'].includes(a.status)) return false;
    if (status !== 'open' && status !== 'all' && a.status !== status) return false;
    if (dept !== 'all' && a.department !== dept) return false;
    if (trade !== 'all' && a.trade !== trade) return false;
    if (q && ![a.full_name, a.email, a.phone, a.city, a.ref, a.other_skills].join(' ').toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, q, status, dept, trade]);

  const selected = (items || []).find((a) => a.id === openId) || null;
  const setOpen = (id) => { const p = new URLSearchParams(params); if (id) p.set('open', id); else p.delete('open'); setParams(p, { replace: true }); };

  return (
    <PortalLayout title="Contractor applications" subtitle="Applications from the website's Work with us page">
      <Helmet><title>Applications | RUNHTec Business Portal</title></Helmet>
      <HrTabs />

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search name, phone, city, reference" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="open">Still to decide</option>
          <option value="all">All statuses</option>
          {APPLICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <FilterSelect value={dept} onChange={setDept} options={DEPARTMENTS} allLabel="All departments" />
        <FilterSelect value={trade} onChange={setTrade} options={TRADES} allLabel="All skills" />
      </Toolbar>

      {!items ? <Loading /> : filtered.length === 0 ? (
        <Empty>No applications here yet. They arrive automatically from the “Work with us” page on runhteccontractors.si.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Skill</th>
                <th className="px-4 py-3">Experience</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((a) => (
                <tr key={a.id} tabIndex={0} onClick={() => setOpen(a.id)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(a.id); }} className="cursor-pointer hover:bg-secondary/40">
                  <td className="px-4 py-3"><p className="font-semibold">{a.full_name}</p><p className="text-xs text-muted-foreground">{a.ref} · {a.phone}</p></td>
                  <td className="px-4 py-3">{tradeLabel(a.trade)}<p className="text-xs text-muted-foreground">{deptLabel(a.department)}</p></td>
                  <td className="px-4 py-3">{a.experience_years || 0} yrs</td>
                  <td className="px-4 py-3">{[a.city, a.country].filter(Boolean).join(', ')}</td>
                  <td className="px-4 py-3"><Stars value={Number(a.score) || 0} /></td>
                  <td className="px-4 py-3"><Pill info={statusInfo(APPLICATION_STATUSES, a.status)} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(a.created)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReviewDialog application={selected} onClose={() => setOpen(null)} onChanged={load} />
    </PortalLayout>
  );
}

function ReviewDialog({ application: a, onClose, onChanged }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [score, setScore] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => { if (a) { setScore(Number(a.score) || 0); setNotes(a.review_notes || ''); } }, [a?.id]);
  if (!a) return null;

  const save = async (patch, label) => {
    setBusy(label);
    try {
      await pb.collection('job_applications').update(a.id, { score, review_notes: notes, reviewed_by: user?.id || null, ...patch });
      toast({ title: 'Application updated', description: `${a.full_name}: ${label}` });
      await onChanged();
    } catch (e) {
      toast({ title: 'Could not update', description: e.message, variant: 'destructive' });
    } finally { setBusy(''); }
  };

  const approve = async () => {
    setBusy('Approve');
    try {
      const rate = parseFloat(String(a.expected_rate || '').replace(/[^0-9.]/g, '')) || 0;
      const contractor = await pb.collection('contractors').create({
        full_name: a.full_name, email: a.email, phone: a.phone, whatsapp: a.whatsapp,
        department: a.department || 'technical', trade: a.trade,
        skills: a.other_skills ? a.other_skills.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : [],
        experience_years: Number(a.experience_years) || 0,
        qualifications: a.qualifications || '', certifications: a.certifications || '',
        country: a.country || 'Rwanda', city: a.city || '',
        rate_amount: rate, rate_unit: a.rate_unit || 'per_day',
        has_tools: Boolean(a.has_tools), has_transport: Boolean(a.has_transport),
        status: 'available', rating: score || 0,
        cv: a.cv || null, certificate_file: a.certificate_file || null,
        notes: notes || '', source: 'application', application: a.id,
      });
      await pb.collection('job_applications').update(a.id, { status: 'approved', score, review_notes: notes, reviewed_by: user?.id || null, contractor: contractor.id });
      toast({ title: 'Approved and added to the register', description: `${a.full_name} · ${contractor.code}` });
      navigate(`/hr/contractors/${contractor.id}`);
    } catch (e) {
      toast({ title: 'Could not approve', description: e.message, variant: 'destructive' });
      setBusy('');
    }
  };

  const waNumber = String(a.whatsapp || a.phone || '').replace(/\D/g, '');
  const decided = ['approved', 'rejected'].includes(a.status);

  return (
    <Modal open onClose={onClose} wide title={a.full_name} description={`${a.ref} · ${tradeLabel(a.trade)} · received ${fmtDate(a.created)}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Pill info={statusInfo(APPLICATION_STATUSES, a.status)} />
          {a.phone && <a href={`tel:${a.phone}`} className={btnLine}><Phone className="h-4 w-4" /> Call</a>}
          {waNumber && <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" className={btnLine}><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
          {a.email && <a href={`mailto:${a.email}`} className={btnLine}><Mail className="h-4 w-4" /> Email</a>}
          {a.cv && <a href={pb.files.getURL(a, a.cv)} target="_blank" rel="noreferrer" className={btnLine}><FileText className="h-4 w-4" /> CV</a>}
          {a.certificate_file && <a href={pb.files.getURL(a, a.certificate_file)} target="_blank" rel="noreferrer" className={btnLine}><FileText className="h-4 w-4" /> Certificate</a>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <InfoRow label="Department">{deptLabel(a.department)}</InfoRow>
          <InfoRow label="Main skill">{tradeLabel(a.trade)}</InfoRow>
          <InfoRow label="Experience">{`${a.experience_years || 0} years`}</InfoRow>
          <InfoRow label="Location"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[a.city, a.country].filter(Boolean).join(', ') || '—'}</span></InfoRow>
          <InfoRow label="Expected rate">{a.expected_rate ? `${a.expected_rate} ${rateUnitLabel(a.rate_unit)}` : '—'}</InfoRow>
          <InfoRow label="Availability">{a.availability || '—'}</InfoRow>
          <InfoRow label="Own tools / transport">{`${a.has_tools ? 'Has own tools' : 'No own tools'} · ${a.has_transport ? 'Has transport' : 'No transport'}`}</InfoRow>
          <InfoRow label="Phone / email">{[a.phone, a.email].filter(Boolean).join(' · ')}</InfoRow>
          <InfoRow label="Other skills">{a.other_skills}</InfoRow>
          <InfoRow label="Qualifications">{a.qualifications}</InfoRow>
          <InfoRow label="Certifications / licences">{a.certifications}</InfoRow>
        </div>
        <InfoRow label="Previous projects">{a.previous_projects}</InfoRow>

        <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
          <Field label="Your assessment (1–5)"><Stars value={score} onChange={setScore} /></Field>
          <Field label="Review notes (internal)">
            <textarea className={textareaCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Interview / practical test results, references checked, documents seen…" />
          </Field>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button className={btnLine} disabled={!!busy} onClick={() => save({}, 'Notes saved')}>{busy === 'Notes saved' && <Loader2 className="h-4 w-4 animate-spin" />}Save notes</button>
          {!decided && <button className={btnLine} disabled={!!busy} onClick={() => save({ status: 'shortlisted' }, 'Shortlisted')}>Shortlist</button>}
          {!decided && <button className={btnLine} disabled={!!busy} onClick={() => save({ status: 'interview' }, 'Interview / test')}>Interview / test</button>}
          {!decided && <button className={btnLine} disabled={!!busy} onClick={() => save({ status: 'on_hold' }, 'On hold')}>On hold</button>}
          {!decided && <button className={btnLine} disabled={!!busy} onClick={() => save({ status: 'rejected' }, 'Not selected')}>Not selected</button>}
          {a.status === 'approved' && a.contractor && <button className={btnPrimary} onClick={() => navigate(`/hr/contractors/${a.contractor}`)}>Open contractor profile</button>}
          {a.status !== 'approved' && (
            <button className={btnPrimary} disabled={!!busy} onClick={approve}>
              {busy === 'Approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} Approve & add to register
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
