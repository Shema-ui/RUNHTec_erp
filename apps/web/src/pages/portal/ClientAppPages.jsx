import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wrench, HardHat, ShieldAlert, FileText, Camera, X, Loader2, Send, ChevronRight, CalendarDays, UserRound,
  Clock3, Plus, Star, Newspaper, Cpu, ShieldCheck, ExternalLink, ArrowLeft,
} from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Modal, Field, inputCls, textareaCls, btnPrimary, btnLine } from '@/components/erp/kit';
import ClientLayout, { usePortal } from './ClientLayout';
import { dayLabel, timeLabel } from '@/lib/portal';

// ─────────────────────────────────────────────────────────────────────────────
// What a client can ask for. The words here are what the client sees.
export const REQUEST_KINDS = [
  { key: 'callout', label: 'Technician call-out', hint: 'Something is not working', icon: HardHat, tone: 'bg-rose-50 text-rose-700' },
  { key: 'maintenance', label: 'Maintenance visit', hint: 'Routine service or check-up', icon: Wrench, tone: 'bg-blue-50 text-[#003DA5]' },
  { key: 'quote', label: 'New quotation', hint: 'Solar, AC, CCTV, electrical…', icon: FileText, tone: 'bg-emerald-50 text-emerald-700' },
  { key: 'warranty', label: 'Warranty / fault', hint: 'Problem with work we did', icon: ShieldAlert, tone: 'bg-amber-50 text-amber-700' },
];
// Request status as the client sees it, in order.
const STEPS = [
  { key: 'new', label: 'Received' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Done' },
];
// ─────────────────────────────────────────────────────────────────────────────

const stepIndex = (s) => Math.max(0, STEPS.findIndex((x) => x.key === (s || 'new')));
export function statusChip(r) {
  if (r.request_status === 'closed') return { label: 'Closed', cls: 'bg-slate-100 text-slate-600' };
  if (r.request_status === 'completed') return { label: 'Done', cls: 'bg-emerald-100 text-emerald-700' };
  if (r.request_status === 'in_progress') return { label: 'In progress', cls: 'bg-amber-100 text-amber-800' };
  if (r.request_status === 'scheduled') return { label: 'Scheduled', cls: 'bg-blue-100 text-[#003DA5]' };
  if (r.request_status === 'reviewing') return { label: 'Reviewing', cls: 'bg-violet-100 text-violet-700' };
  return { label: 'Received', cls: 'bg-slate-100 text-slate-700' };
}
const kindOf = (r) => REQUEST_KINDS.find((k) => k.key === r.kind) || REQUEST_KINDS[0];

// ── Rate the job ─────────────────────────────────────────────────────────────
export function RateDialog({ item, onClose, onDone }) {
  const { toast } = useToast();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setStars(0); setComment(''); }, [item]);
  if (!item) return null;
  const send = async () => {
    if (!stars) { toast({ title: 'Tap the stars to rate', variant: 'destructive' }); return; }
    setBusy(true);
    try { await pb.post('/api/client/ratings', { type: item.type, id: item.id, rating: stars, comment }); toast({ title: 'Thank you!', description: 'Your rating helps us serve you better.' }); onDone?.(); onClose(); }
    catch (e) { toast({ title: 'Could not send', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const words = ['', 'Poor', 'Not great', 'OK', 'Good', 'Excellent'];
  return (
    <Modal open onClose={onClose} title="How did we do?" description={item.title}>
      <div className="space-y-4">
        <div className="flex justify-center gap-2" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((v) => (
            <button key={v} type="button" role="radio" aria-checked={stars === v} aria-label={`${v} star${v > 1 ? 's' : ''}`} onClick={() => setStars(v)} className="p-1">
              <Star className={`h-10 w-10 ${v <= stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
            </button>
          ))}
        </div>
        <p className="h-5 text-center text-sm font-semibold text-slate-700">{words[stars]}</p>
        <Field label="Anything to add? (optional)"><textarea className={textareaCls} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What went well, or what we can improve" /></Field>
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Later</button>
          <button className={btnPrimary} onClick={send} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send rating</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Requests list ────────────────────────────────────────────────────────────
function RequestCard({ r }) {
  const k = kindOf(r); const Icon = k.icon; const chip = statusChip(r);
  const at = stepIndex(r.request_status);
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${k.tone}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{r.service_type || k.label}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.cls}`}>{chip.label}</span>
            {r.urgency && r.urgency !== 'normal' && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-rose-700">{r.urgency}</span>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{r.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">Sent {timeLabel(r.created)}</p>
        </div>
      </div>
      {r.request_status !== 'closed' && (
        <ol className="mt-4 flex items-center gap-1" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-1 flex-col items-center gap-1">
              <span className={`h-1.5 w-full rounded-full ${i <= at ? 'bg-[#003DA5]' : 'bg-slate-200'}`} />
              <span className={`text-[10px] ${i === at ? 'font-bold text-[#003DA5]' : 'text-slate-400'}`}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}
      {(r.scheduled_for || r.technician_name || r.client_note) && (
        <div className="mt-3 space-y-1 rounded-xl bg-blue-50 p-3 text-sm text-slate-800">
          {r.scheduled_for && <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#003DA5]" /> Visit: <b>{dayLabel(r.scheduled_for)}</b></p>}
          {r.technician_name && <p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-[#003DA5]" /> Technician: <b>{r.technician_name}</b></p>}
          {r.client_note && <p className="text-slate-700">{r.client_note}</p>}
        </div>
      )}
      {Array.isArray(r.attachments) && r.attachments.length > 0 && (
        <div className="mt-3 flex gap-2">
          {r.attachments.map((f) => <img key={f} src={pb.files.getURL(null, f)} alt="" loading="lazy" className="h-14 w-14 rounded-lg object-cover" />)}
        </div>
      )}
    </div>
  );
}

function Requests() {
  const { data, keep, reload } = usePortal();
  const [rate, setRate] = useState(null);
  const open = data.requests.filter((r) => !['completed', 'closed'].includes(r.request_status));
  const past = data.requests.filter((r) => ['completed', 'closed'].includes(r.request_status));
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Helmet><title>Requests | RUNHTec</title></Helmet>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-xl font-bold">Your requests</h1><p className="text-sm text-muted-foreground">Ask for a technician, a service visit or a quotation, and follow it here.</p></div>
        <Link to={`/portal/requests/new${keep}`} className={btnPrimary}><Plus className="h-4 w-4" /> New request</Link>
      </div>
      <ToRate onRate={setRate} />
      {data.requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
          <Wrench className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 font-semibold">No requests yet</p>
          <p className="text-sm text-muted-foreground">Need us? Send a request and we’ll get back to you quickly.</p>
          <Link to={`/portal/requests/new${keep}`} className={`${btnPrimary} mt-4`}><Plus className="h-4 w-4" /> New request</Link>
        </div>
      ) : (
        <>
          {open.length > 0 && <section className="space-y-3"><h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Open</h2>{open.map((r) => <RequestCard key={r.id} r={r} />)}</section>}
          {past.length > 0 && <section className="space-y-3"><h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Finished</h2>{past.map((r) => <RequestCard key={r.id} r={r} />)}</section>}
        </>
      )}
      <RateDialog item={rate} onClose={() => setRate(null)} onDone={reload} />
    </div>
  );
}

// "Rate your service" cards for finished work not rated yet.
export function ToRate({ onRate }) {
  const { data, preview } = usePortal();
  if (preview || !data.toRate?.length) return null;
  return (
    <div className="space-y-2">
      {data.toRate.map((t) => (
        <button key={`${t.type}${t.id}`} type="button" onClick={() => onRate(t)} className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-white"><Star className="h-5 w-5 fill-white" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">How did we do?</span><span className="block truncate text-xs text-slate-600">Rate “{t.title}”</span></span>
          <ChevronRight className="h-5 w-5 text-amber-600" />
        </button>
      ))}
    </div>
  );
}

// ── New request ──────────────────────────────────────────────────────────────
function NewRequest() {
  const { data, keep, reload, preview } = usePortal();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [kind, setKind] = useState(REQUEST_KINDS.some((k) => k.key === params.get('kind')) ? params.get('kind') : '');
  const [f, setF] = useState({ description: '', urgency: 'normal', address: '', preferred_time: '', project: '' });
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const addPhotos = (e) => {
    const list = Array.from(e.target.files || []).filter((x) => x.type.startsWith('image/'));
    setPhotos((p) => [...p, ...list].slice(0, 4));
    e.target.value = '';
  };
  const send = async () => {
    if (preview) { toast({ title: 'Preview only', description: 'Clients send requests from their own app.' }); return; }
    if (f.description.trim().length < 5) { toast({ title: 'Please describe what you need', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('kind', kind);
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      photos.forEach((p) => fd.append('photos', p));
      await pb.post('/api/client/requests', fd);
      toast({ title: 'Request sent', description: 'Our team has been alerted. You’ll get a notification when it’s scheduled.' });
      await reload();
      navigate(`/portal/requests${keep}`, { replace: true });
    } catch (e) { toast({ title: 'Could not send', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  if (!kind) {
    return (
      <div className="mx-auto max-w-xl">
        <Helmet><title>New request | RUNHTec</title></Helmet>
        <Link to={`/portal/requests${keep}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Requests</Link>
        <h1 className="font-display text-xl font-bold">What do you need?</h1>
        <div className="mt-4 grid gap-3">
          {REQUEST_KINDS.map((k) => {
            const Icon = k.icon;
            return (
              <button key={k.key} type="button" onClick={() => setKind(k.key)} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4 text-left shadow-sm transition active:scale-[0.99]">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${k.tone}`}><Icon className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{k.label}</span><span className="block text-sm text-muted-foreground">{k.hint}</span></span>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const k = REQUEST_KINDS.find((x) => x.key === kind);
  return (
    <div className="mx-auto max-w-xl">
      <Helmet><title>{k.label} | RUNHTec</title></Helmet>
      <button type="button" onClick={() => setKind('')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Change type</button>
      <h1 className="font-display text-xl font-bold">{k.label}</h1>
      <div className="mt-4 space-y-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <Field label={kind === 'quote' ? 'What would you like a quotation for?' : 'What’s happening?'}>
          <textarea className={textareaCls} rows={4} value={f.description} onChange={set('description')} autoFocus
            placeholder={kind === 'quote' ? 'e.g. Solar backup for a 3-bedroom house, about 10 hours of lights, TV and fridge' : 'e.g. The generator does not start since this morning'} />
        </Field>
        {kind !== 'quote' && (
          <Field label="How urgent is it?">
            <div className="grid grid-cols-3 gap-2">
              {[['normal', 'Normal'], ['urgent', 'Urgent'], ['emergency', 'Emergency']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setF((p) => ({ ...p, urgency: v }))}
                  className={`rounded-xl border px-2 py-2.5 text-sm font-semibold ${f.urgency === v ? (v === 'normal' ? 'border-[#003DA5] bg-[#003DA5] text-white' : 'border-rose-600 bg-rose-600 text-white') : 'border-border bg-white text-slate-700'}`}>{l}</button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Location / site"><input className={inputCls} value={f.address} onChange={set('address')} placeholder="e.g. Kiyovu, house near the roundabout" /></Field>
        <Field label="When suits you? (optional)"><input className={inputCls} value={f.preferred_time} onChange={set('preferred_time')} placeholder="e.g. Tomorrow morning, or any weekday after 2 pm" /></Field>
        {data.projects.length > 0 && (
          <Field label="Is it about one of your projects? (optional)">
            <select className={inputCls} value={f.project} onChange={set('project')}>
              <option value="">No / not sure</option>
              {data.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
        )}
        <div>
          <p className="mb-1.5 text-sm font-medium">Photos (optional, up to 4)</p>
          <div className="flex flex-wrap gap-2">
            {previews.map((u, i) => (
              <span key={u} className="relative">
                <img src={u} alt="" className="h-20 w-20 rounded-xl object-cover" />
                <button type="button" aria-label="Remove photo" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 p-1 text-white"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {photos.length < 4 && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-500">
                <Camera className="h-6 w-6" /><span className="text-[11px]">Add</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
              </label>
            )}
          </div>
        </div>
        <button type="button" onClick={send} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#003DA5] text-base font-semibold text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Send request
        </button>
        {f.urgency === 'emergency' && data.settings.company_phone && (
          <p className="text-center text-sm text-rose-700">For danger (fire, sparks, smoke), switch off the power and call us now: <a className="font-bold underline" href={`tel:${data.settings.company_phone}`}>{data.settings.company_phone}</a></p>
        )}
      </div>
    </div>
  );
}

// ── News ─────────────────────────────────────────────────────────────────────
function News() {
  const { data } = usePortal();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Helmet><title>News | RUNHTec</title></Helmet>
      <div><h1 className="font-display text-xl font-bold">News from RUNHTec</h1><p className="text-sm text-muted-foreground">Offers, tips and updates from our team.</p></div>
      {data.news.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground"><Newspaper className="mx-auto mb-2 h-8 w-8 text-slate-400" />No news yet.</div>
      ) : data.news.map((n) => (
        <article key={n.id} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">{dayLabel(n.created)}</p>
          <h2 className="mt-1 font-display text-lg font-bold text-slate-900">{n.title}</h2>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{n.body}</p>
          {n.link && <a href={n.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#003DA5]">Learn more <ExternalLink className="h-3.5 w-3.5" /></a>}
        </article>
      ))}
    </div>
  );
}

// ── Equipment & service schedule ─────────────────────────────────────────────
function Equipment() {
  const { data, keep } = usePortal();
  const today = new Date().toISOString().slice(0, 10);
  const dateOf = (v) => String(v || '').slice(0, 10);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Helmet><title>My equipment | RUNHTec</title></Helmet>
      <div><h1 className="font-display text-xl font-bold">My equipment & service</h1><p className="text-sm text-muted-foreground">Your systems and when they’re next serviced. We remind you before each visit.</p></div>
      {data.contracts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Maintenance plan</h2>
          {data.contracts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#003DA5]"><CalendarDays className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.service_type || 'Maintenance'}{c.frequency ? <span className="font-normal text-muted-foreground"> · {c.frequency}</span> : null}</p>
                <p className="text-sm text-slate-600">{c.next_due_date ? `Next visit: ${dayLabel(c.next_due_date)}` : 'Next visit to be scheduled'}{c.site ? ` · ${c.site}` : ''}</p>
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Equipment</h2>
        {data.equipment.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground"><Cpu className="mx-auto mb-2 h-8 w-8 text-slate-400" />Equipment we install or service for you will show here.</div>
        ) : data.equipment.map((e) => {
          const warranty = dateOf(e.warranty_expiry);
          const next = dateOf(e.next_service_date);
          return (
            <div key={e.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{e.name}</p>
                  <p className="text-sm text-muted-foreground">{[e.brand, e.model_number, e.capacity].filter(Boolean).join(' · ')}{e.asset_location ? ` · ${e.asset_location}` : ''}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.status === 'faulty' ? 'bg-rose-100 text-rose-700' : e.status === 'under_maintenance' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{e.status === 'faulty' ? 'Needs repair' : e.status === 'under_maintenance' ? 'Being serviced' : 'Working'}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {next && <span className={`inline-flex items-center gap-1 ${next < today ? 'font-semibold text-rose-700' : 'text-slate-700'}`}><Clock3 className="h-4 w-4" />{next < today ? `Service overdue since ${dayLabel(next)}` : `Next service ${dayLabel(next)}`}</span>}
                {warranty && <span className={`inline-flex items-center gap-1 ${warranty < today ? 'text-slate-500' : 'text-emerald-700'}`}><ShieldCheck className="h-4 w-4" />{warranty < today ? 'Warranty ended' : `Warranty until ${dayLabel(warranty)}`}</span>}
              </div>
              <Link to={`/portal/requests/new${keep ? `${keep}&` : '?'}kind=${e.status === 'faulty' ? 'callout' : 'maintenance'}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#003DA5]">{e.status === 'faulty' ? 'Request a repair' : 'Request a service'} <ChevronRight className="h-4 w-4" /></Link>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export const PortalRequestsPage = () => <ClientLayout><Requests /></ClientLayout>;
export const PortalNewRequestPage = () => <ClientLayout><NewRequest /></ClientLayout>;
export const PortalNewsPage = () => <ClientLayout><News /></ClientLayout>;
export const PortalEquipmentPage = () => <ClientLayout><Equipment /></ClientLayout>;
