import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Phone, Mail, MessageCircle, FileText, BadgeCheck, Trash2, Printer } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import HrTabs from './HrTabs';
import { Card, BackLink, Loading, Pill, InfoRow, Stars, StatCard, btnLine, btnDanger, fmtDate } from '@/components/erp/kit';
import {
  CONTRACTOR_STATUSES, ASSIGNMENT_STATUSES, CONTRACTOR_PAYMENT_STATUSES,
  statusInfo, tradeLabel, deptLabel, rateUnitLabel,
} from '@/lib/hr';
import { formatMoney } from '@/lib/money';

export default function ContractorProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [c, setC] = useState(null);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    pb.collection('contractors').getOne(id).then(setC).catch(() => navigate('/hr/contractors'));
    pb.collection('project_assignments').getFullList({ filter: `contractor = '${id}'`, sort: '-created', expand: 'project' })
      .then(setAssignments).catch(() => setAssignments([]));
  }, [id]);

  const totals = useMemo(() => {
    const active = assignments.filter((a) => a.status !== 'cancelled');
    const agreed = active.reduce((s, a) => s + Number(a.agreed_amount || 0), 0);
    const paid = active.reduce((s, a) => s + Number(a.amount_paid || 0), 0);
    const rated = active.filter((a) => Number(a.performance_rating) > 0);
    const avg = rated.length ? rated.reduce((s, a) => s + Number(a.performance_rating), 0) / rated.length : 0;
    return { count: active.length, completed: active.filter((a) => a.status === 'completed').length, agreed, paid, owed: Math.max(0, agreed - paid), avg };
  }, [assignments]);

  if (!c) return <PortalLayout title="Contractor" subtitle="Contractor register"><HrTabs /><Loading /></PortalLayout>;

  const wa = String(c.whatsapp || c.phone || '').replace(/\D/g, '');
  const currency = c.currency || 'RWF';

  const remove = async () => {
    if (!window.confirm(`Remove ${c.full_name} from the register? Their past project engagements stay on record.`)) return;
    try {
      await pb.collection('contractors').delete(c.id);
      toast({ title: 'Contractor removed' });
      navigate('/hr/contractors');
    } catch (e) { toast({ title: 'Could not remove', description: e.message, variant: 'destructive' }); }
  };

  return (
    <PortalLayout title={c.full_name} subtitle={`${c.code} · ${deptLabel(c.department)}`}>
      <Helmet><title>{c.full_name} | RUNHTec Business Portal</title></Helmet>
      <HrTabs />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <BackLink to="/hr/contractors">Register</BackLink>
        <Pill info={statusInfo(CONTRACTOR_STATUSES, c.status)} />
        {c.verified ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified</span> : <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Not yet verified</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {c.phone && <a className={btnLine} href={`tel:${c.phone}`}><Phone className="h-4 w-4" /> Call</a>}
          {wa && <a className={btnLine} href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
          {c.email && <a className={btnLine} href={`mailto:${c.email}`}><Mail className="h-4 w-4" /> Email</a>}
          <Link className={btnLine} to={`/hr/contractors/${c.id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>
          {['hr', 'super_admin'].includes(user?.role) && <button className={btnDanger} onClick={remove}><Trash2 className="h-4 w-4" /> Remove</button>}
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Projects engaged" value={totals.count} note={`${totals.completed} completed`} />
        <StatCard label="Average performance" value={totals.avg ? `${totals.avg.toFixed(1)} / 5` : '—'} tone="amber" />
        <StatCard label="Fees agreed" value={formatMoney(totals.agreed, currency)} tone="green" />
        <StatCard label="Still to pay" value={formatMoney(totals.owed, currency)} tone={totals.owed ? 'red' : 'green'} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Profile" className="lg:col-span-1">
          <div className="space-y-3">
            <InfoRow label="Main skill">{tradeLabel(c.trade)}</InfoRow>
            <InfoRow label="Other skills">{Array.isArray(c.skills) ? c.skills.join(', ') : c.skills}</InfoRow>
            <InfoRow label="Experience">{`${c.experience_years || 0} years`}</InfoRow>
            <InfoRow label="Standard rate">{Number(c.rate_amount) ? `${formatMoney(c.rate_amount, currency)} ${rateUnitLabel(c.rate_unit)}` : 'Not set'}</InfoRow>
            <InfoRow label="Overall rating"><Stars value={Number(c.rating) || 0} /></InfoRow>
            <InfoRow label="Location">{[c.city, c.country].filter(Boolean).join(', ')}</InfoRow>
            <InfoRow label="Phone / email">{[c.phone, c.email].filter(Boolean).join(' · ')}</InfoRow>
            <InfoRow label="Own tools / transport">{`${c.has_tools ? 'Has tools' : 'No tools'} · ${c.has_transport ? 'Has transport' : 'No transport'}`}</InfoRow>
            <InfoRow label="Qualifications">{c.qualifications}</InfoRow>
            <InfoRow label="Certifications / licences">{c.certifications}</InfoRow>
            <InfoRow label="Payment details">{c.payment_details}</InfoRow>
            <InfoRow label="Emergency contact">{c.emergency_contact}</InfoRow>
            <InfoRow label="Notes">{c.notes}</InfoRow>
            <InfoRow label="Joined register">{fmtDate(c.created)}{c.source === 'application' ? ' · from website application' : ''}</InfoRow>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {[['cv', 'CV'], ['id_document', 'ID copy'], ['certificate_file', 'Certificate']].map(([k, label]) => c[k] ? (
              <a key={k} className={btnLine} href={pb.files.getURL(c, c[k])} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" /> {label}</a>
            ) : null)}
          </div>
        </Card>

        <Card title="Project engagements" className="lg:col-span-2">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not engaged on any project yet. Engage contractors from a project's Team section.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="py-2 pr-3">Project</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Fee</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Payment</th><th className="py-2">Rating</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 pr-3"><Link to={`/projects/${a.project}`} className="font-medium text-primary hover:underline">{a.expand?.project?.title || 'Project'}</Link><p className="text-xs text-muted-foreground">{[fmtDate(a.start_date), fmtDate(a.end_date)].filter(Boolean).join(' – ')}</p></td>
                      <td className="py-2 pr-3">{a.role_on_project || '—'}</td>
                      <td className="py-2 pr-3">{formatMoney(a.agreed_amount, a.currency)}</td>
                      <td className="py-2 pr-3"><Pill info={statusInfo(ASSIGNMENT_STATUSES, a.status)} /></td>
                      <td className="py-2 pr-3"><Pill info={statusInfo(CONTRACTOR_PAYMENT_STATUSES, a.payment_status)} /></td>
                      <td className="py-2"><Stars value={Number(a.performance_rating) || 0} /></td>
                      <td className="py-2 pl-2"><Link to={`/hr/engagements/${a.id}/letter`} title="Engagement letter" className="text-muted-foreground hover:text-primary"><Printer className="h-4 w-4" /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PortalLayout>
  );
}
