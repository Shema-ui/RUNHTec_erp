import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Field, inputCls, textareaCls, btnPrimary } from '@/components/erp/kit';

const MANAGERS = ['super_admin', 'admin', 'project_manager'];
const STATUS_LABEL = { invited: 'Invited', offered: 'Interested', declined: 'Not available', accepted: 'Chosen', not_chosen: 'Not chosen', withdrawn: 'Withdrawn' };
const ROLE_LABEL = { either: 'Either', lead: 'Lead technician', support: 'Support' };
const dayText = (v) => (v ? String(v).slice(0, 10) : '');
const outline = 'rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary';

function Pill({ children, good }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${good ? 'bg-emerald-100 text-emerald-800' : 'bg-secondary text-muted-foreground'}`}>{children}</span>;
}
const Empty = ({ children }) => <p className="text-sm text-muted-foreground">{children}</p>;
const Spin = () => <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

function OpenTab({ toast }) {
  const [list, setList] = useState(null);
  const [formFor, setFormFor] = useState(null);
  const [f, setF] = useState({ available_from: '', available_to: '', role_pref: 'either', note: '' });
  const [busy, setBusy] = useState(false);
  const load = () => pb.get('/api/offers/open').then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const send = async (p, interest) => {
    setBusy(true);
    try {
      await pb.post(`/api/offers/${p.id}/respond`, interest === 'not_available' ? { interest } : { interest, ...f });
      toast({ title: interest === 'interested' ? 'Your offer is sent' : 'Noted', description: 'The office will review it and get back to you.' });
      setFormFor(null);
      load();
    } catch (e) { toast({ title: 'Could not send', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const withdraw = async (p) => {
    if (!window.confirm('Withdraw your offer for this project?')) return;
    try { await pb.post(`/api/offers/${p.id}/withdraw`, {}); toast({ title: 'Offer withdrawn' }); load(); }
    catch (e) { toast({ title: 'Could not withdraw', description: e.message, variant: 'destructive' }); }
  };
  const openForm = (p, from) => { setFormFor(p.id); setF(from); };
  if (list === null) return <Spin />;
  if (!list.length) return <Empty>No projects are open for offers right now. When one matches your skills, it will appear here.</Empty>;
  return (
    <ul className="space-y-3">
      {list.map((p) => {
        const my = p.my;
        const offered = my?.status === 'offered';
        return (
          <li key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-base font-bold">{p.title}</p>
                <p className="text-xs text-muted-foreground">{[p.offer_location, p.offer_deadline ? `Offers close ${dayText(p.offer_deadline)}` : '', Number(p.positions_needed) ? `${p.positions_needed} needed` : ''].filter(Boolean).join(' · ')}</p>
              </div>
              {my && <Pill good={offered}>{STATUS_LABEL[my.status] || 'Invited'}</Pill>}
            </div>
            {p.offer_summary && <p className="mt-2 whitespace-pre-line text-sm text-foreground/80">{p.offer_summary}</p>}
            {formFor !== p.id && (
              <div className="mt-3 flex flex-wrap gap-2">
                {offered ? (
                  <>
                    <button type="button" className={btnPrimary} onClick={() => openForm(p, { available_from: dayText(my.available_from), available_to: dayText(my.available_to), role_pref: my.role_pref || 'either', note: my.note || '' })}>Change my offer</button>
                    <button type="button" className={outline} onClick={() => withdraw(p)}>Withdraw</button>
                  </>
                ) : (
                  <>
                    <button type="button" className={btnPrimary} onClick={() => openForm(p, { available_from: '', available_to: '', role_pref: 'either', note: '' })}>I&apos;m interested</button>
                    <button type="button" className={outline} disabled={busy} onClick={() => send(p, 'not_available')}>Not available</button>
                  </>
                )}
              </div>
            )}
            {formFor === p.id && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Available from"><input type="date" className={inputCls} value={f.available_from} onChange={set('available_from')} /></Field>
                  <Field label="Available to"><input type="date" className={inputCls} value={f.available_to} onChange={set('available_to')} /></Field>
                </div>
                <Field label="Role you can take"><select className={inputCls} value={f.role_pref} onChange={set('role_pref')}>{Object.keys(ROLE_LABEL).map((k) => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}</select></Field>
                <Field label="Note (optional)"><textarea className={textareaCls} rows={3} maxLength={1000} value={f.note} onChange={set('note')} /></Field>
                <div className="flex gap-2">
                  <button type="button" className={btnPrimary} disabled={busy} onClick={() => send(p, 'interested')}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Send my offer</button>
                  <button type="button" className={outline} onClick={() => setFormFor(null)}>Cancel</button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MineTab({ toast }) {
  const [list, setList] = useState(null);
  const load = () => pb.get('/api/offers/mine').then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const withdraw = async (o) => {
    if (!window.confirm('Withdraw this offer?')) return;
    try { await pb.post(`/api/offers/${o.project}/withdraw`, {}); toast({ title: 'Offer withdrawn' }); load(); }
    catch (e) { toast({ title: 'Could not withdraw', description: e.message, variant: 'destructive' }); }
  };
  if (list === null) return <Spin />;
  if (!list.length) return <Empty>You have not made any offers yet.</Empty>;
  return (
    <ul className="space-y-3">
      {list.map((o) => (
        <li key={o.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-semibold">{o.title}</p>
            <Pill good={o.status === 'accepted'}>{STATUS_LABEL[o.status] || o.status}</Pill>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{[o.available_from ? `From ${dayText(o.available_from)}` : '', o.available_to ? `to ${dayText(o.available_to)}` : '', ROLE_LABEL[o.role_pref] || ''].filter(Boolean).join(' ')}</p>
          {o.note && <p className="mt-1 text-sm text-foreground/80">{o.note}</p>}
          {o.decision_note && <p className="mt-2 text-sm italic text-muted-foreground">Message from the office: {o.decision_note}</p>}
          {o.status === 'offered' && <button type="button" className="mt-3 text-sm font-medium text-red-700" onClick={() => withdraw(o)}>Withdraw offer</button>}
        </li>
      ))}
    </ul>
  );
}

function ManageProject({ p, expanded, onToggle, onSaved, toast }) {
  const [f, setF] = useState({
    offers_open: Number(p.offers_open) === 1,
    offer_deadline: dayText(p.offer_deadline),
    positions_needed: p.positions_needed || 0,
    offer_skills: p.offer_skills || '',
    offer_location: p.offer_location || '',
    offer_summary: p.offer_summary || '',
  });
  const [offers, setOffers] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const loadOffers = () => pb.get(`/api/offers/project/${p.id}`).then(setOffers).catch(() => setOffers([]));
  useEffect(() => { if (expanded) loadOffers(); }, [expanded]);
  const save = async () => {
    setSaving(true);
    const wasOpen = Number(p.offers_open) === 1;
    try {
      await pb.collection('projects').update(p.id, {
        offers_open: f.offers_open ? 1 : 0,
        offer_deadline: f.offer_deadline || null,
        positions_needed: Number(f.positions_needed) || 0,
        offer_skills: f.offer_skills,
        offer_location: f.offer_location,
        offer_summary: f.offer_summary,
      });
      toast({ title: 'Saved', description: f.offers_open && !wasOpen ? 'Matching staff have been invited.' : 'Offer settings saved.' });
      onSaved();
    } catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  const decide = async (o, decision) => {
    let message = '';
    if (decision === 'accept') {
      if (!window.confirm(`Choose ${o.name} for ${p.title}? They will be added to the project team.`)) return;
    } else {
      message = window.prompt(`Optional message to ${o.name} (leave blank to send none):`, '') || '';
    }
    try {
      await pb.post(`/api/offers/decide/${o.id}`, { decision, message });
      toast({ title: decision === 'accept' ? `${o.name} chosen` : 'Sent' });
      loadOffers();
      onSaved();
    } catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
  };
  const offersOpen = Number(p.offers_open) === 1;
  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="min-w-0">
          <span className="block truncate font-semibold">{p.title}</span>
          <span className="text-xs text-muted-foreground">{p.status}</span>
        </span>
        <span className="flex items-center gap-2">
          <Pill good={offersOpen}>{offersOpen ? 'Offers open' : 'Offers closed'}</Pill>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={f.offers_open} onChange={set('offers_open')} /> Open this project for offers</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Offers close on"><input type="date" className={inputCls} value={f.offer_deadline} onChange={set('offer_deadline')} /></Field>
            <Field label="People needed"><input type="number" min="0" className={inputCls} value={f.positions_needed} onChange={set('positions_needed')} /></Field>
          </div>
          <Field label="Skills wanted" hint="Comma separated, e.g. electrical, solar. Leave empty to invite everyone."><input className={inputCls} value={f.offer_skills} onChange={set('offer_skills')} /></Field>
          <Field label="Location (town or area only)"><input className={inputCls} value={f.offer_location} onChange={set('offer_location')} /></Field>
          <Field label="Description for staff" hint="Staff see only this text. Do not include client names, prices or pay."><textarea className={textareaCls} rows={4} value={f.offer_summary} onChange={set('offer_summary')} /></Field>
          <button type="button" className={btnPrimary} disabled={saving} onClick={save}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
          <div>
            <p className="mb-2 text-sm font-semibold">Offers</p>
            {offers === null ? <Spin /> : offers.length === 0 ? <Empty>No one has been invited yet.</Empty> : (
              <ul className="space-y-2">
                {offers.map((o) => (
                  <li key={o.id} className="rounded-xl border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{o.name}</span>
                      <Pill good={o.status === 'offered' || o.status === 'accepted'}>{STATUS_LABEL[o.status] || o.status}</Pill>
                    </div>
                    {o.skills && <p className="text-xs text-muted-foreground">Skills: {o.skills}</p>}
                    {(o.available_from || o.available_to) && <p className="text-xs text-muted-foreground">Available {dayText(o.available_from)} to {dayText(o.available_to)}</p>}
                    {o.note && <p className="mt-1 text-foreground/80">{o.note}</p>}
                    {o.status === 'offered' && (
                      <div className="mt-2 flex gap-2">
                        <button type="button" className={btnPrimary} onClick={() => decide(o, 'accept')}>Choose</button>
                        <button type="button" className={outline} onClick={() => decide(o, 'not_chosen')}>Not chosen</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function ManageTab({ toast }) {
  const [projects, setProjects] = useState(null);
  const [openId, setOpenId] = useState(null);
  const load = () => pb.collection('projects').getFullList({ sort: '-created' })
    .then((rows) => setProjects(rows.filter((r) => !['done', 'cancelled'].includes(r.status))))
    .catch(() => setProjects([]));
  useEffect(() => { load(); }, []);
  if (projects === null) return <Spin />;
  if (!projects.length) return <Empty>No active projects.</Empty>;
  return (
    <ul className="space-y-3">
      {projects.map((p) => (
        <ManageProject key={p.id} p={p} expanded={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} onSaved={load} toast={toast} />
      ))}
    </ul>
  );
}

export default function OffersPage() {
  const { toast } = useToast();
  const user = pb.authStore.record;
  const manager = MANAGERS.includes(user?.role);
  const [tab, setTab] = useState('open');
  const tabs = [['open', 'Open projects'], ['mine', 'My offers'], ...(manager ? [['manage', 'Manage offers']] : [])];
  return (
    <PortalLayout title="Project Offers" subtitle="Projects open for offers that match your skills">
      <Helmet><title>Project Offers | RUNHTec Business Portal</title></Helmet>
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-medium ${tab === k ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}>{label}</button>
        ))}
      </div>
      {tab === 'open' && <OpenTab toast={toast} />}
      {tab === 'mine' && <MineTab toast={toast} />}
      {tab === 'manage' && manager && <ManageTab toast={toast} />}
    </PortalLayout>
  );
}
