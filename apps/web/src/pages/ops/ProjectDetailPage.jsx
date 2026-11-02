import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Pencil, Plus, Trash2, ReceiptText, FileText, Upload, Printer, CalendarDays, MapPin, User, Building2, Download,
} from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { canAccessModule, canUploadDocs } from '@/lib/permissions';
import SuperDelete from '@/components/erp/SuperDelete';
import { deleteProjectAssignments } from '@/lib/cleanup';
import ProjectCostsCard from '@/components/erp/ProjectCostsCard';
import SiteLogCard from '@/components/erp/SiteLogCard';
import { canSeeCosts } from '@/lib/costing';
import EngagementDialog from '@/components/erp/EngagementDialog';
import DocumentUploadDialog from '@/components/erp/DocumentUploadDialog';
import { Card, BackLink, Loading, Pill, InfoRow, StatCard, Stars, inputCls, btnPrimary, btnLine, fmtDate, todayISO } from '@/components/erp/kit';
import { PROJECT_STATUSES, projectStatusInfo, priorityInfo, serviceLabel } from '@/lib/projects';
import { ASSIGNMENT_STATUSES, CONTRACTOR_PAYMENT_STATUSES, statusInfo } from '@/lib/hr';
import { formatMoney } from '@/lib/money';

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [p, setP] = useState(null);
  const [team, setTeam] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [docs, setDocs] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [engaging, setEngaging] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editTask, setEditTask] = useState(null); // { id, title }

  const canEdit = ['super_admin', 'project_manager'].includes(user?.role);
  const canTeam = ['super_admin', 'project_manager', 'hr'].includes(user?.role);
  const canInvoice = canAccessModule(user, 'invoices');
  const showCosts = canSeeCosts(user);
  const canUpload = canUploadDocs(user);

  const loadProject = () => pb.collection('projects').getOne(id, { expand: 'client,quotation,project_manager,lead_technician' })
    .then(setP).catch(() => navigate('/projects'));
  const loadTeam = () => pb.collection('project_assignments').getFullList({ filter: `project = '${id}'`, sort: 'created', expand: 'contractor' })
    .then(setTeam).catch(() => setTeam([]));
  const loadDocs = () => pb.collection('documents').getFullList({ filter: `project = '${id}'`, sort: '-created' })
    .then(setDocs).catch(() => setDocs([]));

  useEffect(() => {
    loadProject(); loadTeam(); loadDocs();
    if (canInvoice) pb.collection('invoices').getFullList({ filter: `project = '${id}'`, sort: '-created' }).then(setInvoices).catch(() => {});
  }, [id]);

  const tasks = useMemo(() => (Array.isArray(p?.tasks) ? p.tasks : []), [p]);
  const costs = useMemo(() => {
    const active = team.filter((a) => a.status !== 'cancelled');
    return {
      fees: active.reduce((s, a) => s + Number(a.agreed_amount || 0), 0),
      paid: active.reduce((s, a) => s + Number(a.amount_paid || 0), 0),
    };
  }, [team]);
  const invoiced = invoices.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + Number(i.total || 0), 0);

  if (!p) return <PortalLayout title="Project" subtitle="Projects & Work Orders"><Loading /></PortalLayout>;

  const update = async (patch, msg) => {
    try {
      const saved = await pb.collection('projects').update(p.id, patch);
      setP((old) => ({ ...saved, expand: old.expand }));
      if (msg) toast({ title: msg });
    } catch (e) { toast({ title: 'Could not update', description: e.message, variant: 'destructive' }); }
  };

  const saveTasks = (next) => {
    const done = next.filter((t) => t.done).length;
    const progress = next.length ? Math.round((done / next.length) * 100) : Number(p.progress) || 0;
    setP((old) => ({ ...old, tasks: next, progress })); // show the change immediately
    update({ tasks: next, progress });
  };
  const addTask = (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    saveTasks([...tasks, { id: newId(), title: newTask.trim(), done: false }]);
    setNewTask('');
  };

  // The project's Lead Technician moves the work forward on site (tasks, status, crew days).
  const isLeadHere = user?.role === 'lead_technician' && p.lead_technician === user.id;
  const canWork = canEdit || isLeadHere;

  const changeStatus = (status) => update({ status, ...(status === 'done' ? { completed_date: todayISO(), progress: 100 } : {}) }, 'Status updated');
  const currency = p.currency || 'RWF';
  const quote = p.expand?.quotation;
  const value = Number(p.value) || Number(quote?.total) || 0;

  return (
    <PortalLayout title={p.title} subtitle={p.expand?.client?.company_name || 'Project'}>
      <Helmet><title>{p.title} | RUNHTec Business Portal</title></Helmet>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <BackLink to="/projects">Projects</BackLink>
        <Pill info={projectStatusInfo(p.status)} />
        <span className={`text-xs font-semibold ${priorityInfo(p.priority).cls}`}>{priorityInfo(p.priority).label} priority</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {canWork && (
            <select value={p.status} onChange={(e) => changeStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm" aria-label="Change status">
              {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
          {canInvoice && <Link className={btnPrimary} to={`/invoices/new?fromProject=${p.id}`}><ReceiptText className="h-4 w-4" /> Create invoice</Link>}
          {canEdit && <Link className={btnLine} to={`/projects/${p.id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>}
          <SuperDelete collection="projects" id={p.id} text="Delete" label={`project “${p.title}” and its contractor engagements`} before={deleteProjectAssignments} after={() => navigate('/projects')} />
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Progress" value={`${Number(p.progress) || 0}%`} note={tasks.length ? `${tasks.filter((t) => t.done).length} of ${tasks.length} tasks done` : 'Add tasks to track progress'} />
        <StatCard label="Contract value" value={value ? formatMoney(value, currency) : '—'} tone="green" />
        <StatCard label="Contractor fees" value={formatMoney(costs.fees, currency)} note={`${formatMoney(costs.paid, currency)} paid`} tone="amber" />
        {canInvoice ? (
          <StatCard label="Invoiced to client" value={formatMoney(invoiced, currency)} tone={value && invoiced < value ? 'red' : 'green'} note={value ? `${formatMoney(Math.max(0, value - invoiced), currency)} not yet invoiced` : ''} />
        ) : (
          <StatCard label="Due date" value={fmtDate(p.due_date) || 'Not set'} tone="amber" note={p.start_date ? `Started ${fmtDate(p.start_date)}` : ''} />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Card title="Tasks & milestones">
            {tasks.length === 0 && <p className="mb-3 text-sm text-muted-foreground">No tasks yet. Add the main steps — progress updates as you tick them off.</p>}
            <ul className="divide-y divide-border">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <input type="checkbox" checked={!!t.done} disabled={!canWork && user?.role !== 'technician'} aria-label={`Mark ${t.title} done`}
                    onChange={() => saveTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} className="h-4 w-4" />
                  {editTask?.id === t.id ? (
                    <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); if (editTask.title.trim()) saveTasks(tasks.map((x) => (x.id === t.id ? { ...x, title: editTask.title.trim() } : x))); setEditTask(null); }}>
                      <input autoFocus className={inputCls} value={editTask.title} onChange={(e) => setEditTask({ ...editTask, title: e.target.value })} aria-label="Task name" />
                      <button type="submit" className={btnLine}>Save</button>
                      <button type="button" className={btnLine} onClick={() => setEditTask(null)}>Cancel</button>
                    </form>
                  ) : (
                    <span className={`flex-1 text-sm ${t.done ? 'text-muted-foreground line-through' : ''}`}>{t.title}</span>
                  )}
                  {canWork && editTask?.id !== t.id && <button aria-label={`Rename ${t.title}`} onClick={() => setEditTask({ id: t.id, title: t.title })} className="text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>}
                  {canWork && <button aria-label="Delete task" onClick={() => saveTasks(tasks.filter((x) => x.id !== t.id))} className="text-muted-foreground hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                </li>
              ))}
            </ul>
            {canWork && (
              <form onSubmit={addTask} className="mt-3 flex gap-2">
                <input className={inputCls} value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="e.g. Site survey, Material delivery, Installation, Testing & commissioning, Handover" />
                <button type="submit" className={btnLine}><Plus className="h-4 w-4" /> Add</button>
              </form>
            )}
          </Card>

          {showCosts && <ProjectCostsCard project={p} team={team} />}
          {isLeadHere && <SiteLogCard project={p} team={team} />}

          <Card title="Team (per-project contractors)" action={canTeam && <button className={btnLine} onClick={() => setEngaging({})}><Plus className="h-4 w-4" /> Engage contractor</button>}>
            {team.length === 0 ? <p className="text-sm text-muted-foreground">Nobody engaged yet. Pick contractors from the register; each gets their own engagement letter for this project.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="py-2 pr-3">Contractor</th><th className="py-2 pr-3">Fee</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Payment</th><th className="py-2 pr-3">Rating</th><th /></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {team.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-3"><Link to={`/hr/contractors/${a.contractor}`} className="font-semibold hover:text-primary">{a.expand?.contractor?.full_name || '—'}</Link><p className="text-xs text-muted-foreground">{a.role_on_project}{a.expand?.contractor?.phone ? ` · ${a.expand.contractor.phone}` : ''}</p></td>
                        <td className="py-2 pr-3">{formatMoney(a.agreed_amount, a.currency)}</td>
                        <td className="py-2 pr-3"><Pill info={statusInfo(ASSIGNMENT_STATUSES, a.status)} /></td>
                        <td className="py-2 pr-3"><Pill info={statusInfo(CONTRACTOR_PAYMENT_STATUSES, a.payment_status)} /></td>
                        <td className="py-2 pr-3"><Stars value={Number(a.performance_rating) || 0} /></td>
                        <td className="py-2">
                          <div className="flex gap-3">
                            {canTeam && <button aria-label="Edit engagement" onClick={() => setEngaging(a)} className="text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>}
                            <Link aria-label="Engagement letter" title="Engagement letter" to={`/hr/engagements/${a.id}/letter`} className="text-muted-foreground hover:text-primary"><Printer className="h-4 w-4" /></Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Documents" action={canUpload && <button className={btnLine} onClick={() => setUploading(true)}><Upload className="h-4 w-4" /> Upload</button>}>
            {docs.length === 0 ? <p className="text-sm text-muted-foreground">Drawings, BOQs, site reports, test certificates and handover documents for this project.</p> : (
              <ul className="divide-y divide-border">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{d.title}</span><span className="text-xs text-muted-foreground">· {d.type}</span></span>
                    <span className="flex shrink-0 items-center gap-3">
                      {d.file && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={pb.files.getURL(d, d.file)} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /> Open</a>}
                      {canUpload && <button onClick={() => setEditingDoc(d)} aria-label="Edit document" className="text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>}
                      {canEdit && canUpload && <button onClick={async () => { if (!window.confirm(`Delete document “${d.title}”?`)) return; try { await pb.collection('documents').delete(d.id); loadDocs(); } catch (e) { toast({ title: 'Could not delete', description: e.message, variant: 'destructive' }); } }} aria-label="Delete document" className="text-muted-foreground hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card title="Details">
            <div className="space-y-3">
              <InfoRow label="Client">{p.expand?.client ? <Link to={`/crm/clients/${p.client}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Building2 className="h-3.5 w-3.5" />{p.expand.client.company_name}</Link> : 'Not linked'}</InfoRow>
              <InfoRow label="Service">{serviceLabel(p.service_category)}</InfoRow>
              <InfoRow label="Lead technician">{p.expand?.lead_technician ? <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{p.expand.lead_technician.name || p.expand.lead_technician.email}{isLeadHere ? ' (you)' : ''}</span> : 'Not assigned'}</InfoRow>
              <InfoRow label="Project manager">{p.expand?.project_manager ? <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{p.expand.project_manager.name || p.expand.project_manager.email}</span> : 'Not assigned'}</InfoRow>
              <InfoRow label="Site">{p.site_address ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.site_address}</span> : ''}</InfoRow>
              <InfoRow label="Dates"><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{[fmtDate(p.start_date) || 'Start not set', fmtDate(p.due_date) || 'due not set'].join(' → ')}</span></InfoRow>
              <InfoRow label="Completed">{fmtDate(p.completed_date)}</InfoRow>
              <InfoRow label="Scope / description">{p.description}</InfoRow>
              <InfoRow label="Internal notes">{p.notes}</InfoRow>
            </div>
          </Card>

          <Card title="Billing">
            <div className="space-y-3 text-sm">
              {quote ? (
                <p>Quotation <Link to={`/quotations/${quote.id}/view`} className="font-semibold text-primary hover:underline">{quote.number}</Link> · {formatMoney(quote.total, quote.currency)} · {quote.status}</p>
              ) : <p className="text-muted-foreground">No quotation linked.</p>}
              {canInvoice ? (
                <>
                  {invoices.length === 0 ? <p className="text-muted-foreground">No invoices for this project yet.</p> : (
                    <ul className="space-y-1">
                      {invoices.map((inv) => (
                        <li key={inv.id} className="flex justify-between gap-2">
                          <Link to={`/invoices/${inv.id}/view`} className="font-medium text-primary hover:underline">{inv.invoice_number}</Link>
                          <span>{formatMoney(inv.total, inv.currency)} · {inv.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link className={`${btnPrimary} w-full`} to={`/invoices/new?fromProject=${p.id}`}><ReceiptText className="h-4 w-4" /> Create invoice</Link>
                </>
              ) : <p className="text-xs text-muted-foreground">Invoices are handled by Finance.</p>}
            </div>
          </Card>
        </div>
      </div>

      <EngagementDialog open={engaging !== null} project={p} engagement={engaging?.id ? engaging : null} onClose={() => setEngaging(null)} onSaved={loadTeam} />
      <DocumentUploadDialog open={uploading || Boolean(editingDoc)} document={editingDoc} project={p} onClose={() => { setUploading(false); setEditingDoc(null); }} onSaved={loadDocs} />
    </PortalLayout>
  );
}
