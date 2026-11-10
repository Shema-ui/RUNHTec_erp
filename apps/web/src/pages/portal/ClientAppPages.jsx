import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wrench, HardHat, ShieldAlert, FileText, Camera, X, Loader2, Send, ChevronRight, CalendarDays, UserRound,
  Clock3, Plus, Star, Newspaper, Cpu, ShieldCheck, ExternalLink, ArrowLeft, MapPin, Truck, CalendarClock, LocateFixed, Trash2, Building2, Mic,
} from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Modal, Field, inputCls, textareaCls, btnPrimary, btnLine } from '@/components/erp/kit';
import ClientLayout, { usePortal } from './ClientLayout';
import { dayLabel, timeLabel } from '@/lib/portal';
import { useLang, translate } from '@/lib/i18n';
import VoiceRecorder from '@/components/portal/VoiceRecorder';
import { QuotesWaiting } from '@/components/portal/QuoteAnswer';

const mapUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
const hasPos = (x) => x && x.latitude != null && x.longitude != null && x.latitude !== '' && x.longitude !== '';
// "On the way" shows for 6 hours after the technician leaves.
const onTheWay = (r) => {
  if (!r.on_the_way_at || ['completed', 'closed'].includes(r.request_status)) return false;
  const d = new Date(String(r.on_the_way_at).replace(' ', 'T') + (String(r.on_the_way_at).includes('Z') ? '' : 'Z'));
  return !Number.isNaN(d.getTime()) && Date.now() - d.getTime() < 6 * 3600e3;
};

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
  const c = (label, cls) => ({ label: translate(label), cls });
  if (r.request_status === 'closed') return c('Closed', 'bg-slate-100 text-slate-600');
  if (r.request_status === 'completed') return c('Done', 'bg-emerald-100 text-emerald-700');
  if (onTheWay(r)) return { label: translate('Your technician is on the way'), cls: 'bg-emerald-600 text-white' };
  if (r.request_status === 'in_progress') return c('In progress', 'bg-amber-100 text-amber-800');
  if (r.request_status === 'scheduled') return c('Scheduled', 'bg-blue-100 text-[#003DA5]');
  if (r.request_status === 'reviewing') return c('Reviewing', 'bg-violet-100 text-violet-700');
  return c('Received', 'bg-slate-100 text-slate-700');
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
function RequestCard({ r, onMove, sites = [] }) {
  const { t } = useLang();
  const k = kindOf(r); const Icon = k.icon; const chip = statusChip(r);
  const at = stepIndex(r.request_status);
  const site = sites.find((x) => x.id === r.site);
  const moving = ['new', 'reviewing', 'scheduled'].includes(r.request_status || 'new');
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${k.tone}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{t(k.label)}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.cls}`}>{chip.label}</span>
            {r.urgency && r.urgency !== 'normal' && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-rose-700">{t(r.urgency)}</span>}
          </div>
          {r.description && r.description !== '(voice note)' && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{r.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{t('Sent {time}', { time: timeLabel(r.created) })}{site ? ` · ${site.name}` : ''}</p>
        </div>
      </div>
      {onTheWay(r) && (
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-600 p-3 text-white">
          <Truck className="h-6 w-6 shrink-0" />
          <div className="min-w-0 text-sm"><p className="font-bold">{t('Your technician is on the way')}</p><p className="text-white/85">{r.technician_name ? `${r.technician_name} · ` : ''}{t('Left at {time}', { time: timeLabel(r.on_the_way_at) })}</p></div>
        </div>
      )}
      {r.request_status !== 'closed' && (
        <ol className="mt-4 flex items-center gap-1" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-1 flex-col items-center gap-1">
              <span className={`h-1.5 w-full rounded-full ${i <= at ? 'bg-[#003DA5]' : 'bg-slate-200'}`} />
              <span className={`text-center text-[10px] leading-tight ${i === at ? 'font-bold text-[#003DA5]' : 'text-slate-400'}`}>{t(s.label)}</span>
            </li>
          ))}
        </ol>
      )}
      {(r.scheduled_for || r.technician_name || r.client_note) && (
        <div className="mt-3 space-y-1 rounded-xl bg-blue-50 p-3 text-sm text-slate-800">
          {r.scheduled_for && <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#003DA5]" /> <span>{t('Visit: {date}', { date: '' })}<b>{dayLabel(r.scheduled_for)}</b></span></p>}
          {r.technician_name && <p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-[#003DA5]" /> <span>{t('Technician: {name}', { name: '' })}<b>{r.technician_name}</b></span></p>}
          {r.client_note && <p className="text-slate-700">{r.client_note}</p>}
        </div>
      )}
      {r.reschedule_request && moving && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t('You asked to move this visit: {text}', { text: r.reschedule_request })} {t('We’ll confirm the new day.')}</p>
      )}
      {r.voice_note && (
        <div className="mt-3"><p className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600"><Mic className="h-3.5 w-3.5" />{t('Voice note')}</p><audio controls preload="none" src={pb.files.getURL(null, r.voice_note)} className="h-10 w-full" /></div>
      )}
      {Array.isArray(r.attachments) && r.attachments.length > 0 && (
        <div className="mt-3 flex gap-2">
          {r.attachments.map((f) => <img key={f} src={pb.files.getURL(null, f)} alt="" loading="lazy" className="h-14 w-14 rounded-lg object-cover" />)}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {hasPos(r) && <a href={mapUrl(r.latitude, r.longitude)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[#003DA5]"><MapPin className="h-4 w-4" />{t('See on map')}</a>}
        {onMove && moving && r.scheduled_for && !r.reschedule_request && (
          <button type="button" onClick={() => onMove(r)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#003DA5]"><CalendarClock className="h-4 w-4" />{t('Ask for another day')}</button>
        )}
      </div>
    </div>
  );
}

// The client asks for another day for a planned visit.
function RescheduleDialog({ request, onClose, onDone }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [when, setWhen] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setWhen(''); setReason(''); }, [request]);
  if (!request) return null;
  const send = async () => {
    if (when.trim().length < 2) return;
    setBusy(true);
    try {
      await pb.post(`/api/client/requests/${request.id}/reschedule`, { when, reason });
      toast({ title: t('Request sent'), description: t('Our team will confirm the new day.') });
      onDone?.(); onClose();
    } catch (e) { toast({ title: t('Could not send'), description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('Move this visit')} description={request.scheduled_for ? t('Visit: {date}', { date: dayLabel(request.scheduled_for) }) : ''}>
      <div className="space-y-4">
        <Field label={t('Which day or time suits you better?')}><input className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} placeholder={t('e.g. Thursday afternoon, or any day next week')} autoFocus /></Field>
        <Field label={t('Reason (optional)')}><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>{t('Cancel')}</button>
          <button className={btnPrimary} onClick={send} disabled={busy || when.trim().length < 2}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t('Send')}</button>
        </div>
      </div>
    </Modal>
  );
}

function Requests() {
  const { data, keep, reload, preview } = usePortal();
  const { t } = useLang();
  const [rate, setRate] = useState(null);
  const [move, setMove] = useState(null);
  const open = data.requests.filter((r) => !['completed', 'closed'].includes(r.request_status));
  const past = data.requests.filter((r) => ['completed', 'closed'].includes(r.request_status));
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Helmet><title>Requests | RUNHTec</title></Helmet>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-xl font-bold">{t('Your requests')}</h1><p className="text-sm text-muted-foreground">{t('Ask for a technician, a service visit or a quotation, and follow it here.')}</p></div>
        <Link to={`/portal/requests/new${keep}`} className={btnPrimary}><Plus className="h-4 w-4" /> {t('New request')}</Link>
      </div>
      <QuotesWaiting quotes={data.quotes} preview={preview} onDone={reload} />
      <ToRate onRate={setRate} />
      {data.requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
          <Wrench className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 font-semibold">{t('No requests yet')}</p>
          <p className="text-sm text-muted-foreground">{t('Need us? Send a request and we’ll get back to you quickly.')}</p>
          <Link to={`/portal/requests/new${keep}`} className={`${btnPrimary} mt-4`}><Plus className="h-4 w-4" /> {t('New request')}</Link>
        </div>
      ) : (
        <>
          {open.length > 0 && <section className="space-y-3"><h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('Open')}</h2>{open.map((r) => <RequestCard key={r.id} r={r} sites={data.sites} onMove={preview ? null : setMove} />)}</section>}
          {past.length > 0 && <section className="space-y-3"><h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('Finished')}</h2>{past.map((r) => <RequestCard key={r.id} r={r} sites={data.sites} />)}</section>}
        </>
      )}
      <RateDialog item={rate} onClose={() => setRate(null)} onDone={reload} />
      <RescheduleDialog request={move} onClose={() => setMove(null)} onDone={reload} />
    </div>
  );
}

// "Rate your service" cards for finished work not rated yet.
export function ToRate({ onRate }) {
  const { data, preview } = usePortal();
  const { t } = useLang();
  if (preview || !data.toRate?.length) return null;
  return (
    <div className="space-y-2">
      {data.toRate.map((x) => (
        <button key={`${x.type}${x.id}`} type="button" onClick={() => onRate(x)} className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-white"><Star className="h-5 w-5 fill-white" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{t('How did we do?')}</span><span className="block truncate text-xs text-slate-600">{t('Rate “{title}”', { title: x.title })}</span></span>
          <ChevronRight className="h-5 w-5 text-amber-600" />
        </button>
      ))}
    </div>
  );
}

// ── New request ──────────────────────────────────────────────────────────────
function NewRequest() {
  const { data, keep, reload, preview } = usePortal();
  const { t } = useLang();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [kind, setKind] = useState(REQUEST_KINDS.some((k) => k.key === params.get('kind')) ? params.get('kind') : '');
  const sites = data.sites || [];
  const [f, setF] = useState({ description: '', urgency: 'normal', address: '', preferred_time: '', project: '', site: sites.length === 1 ? sites[0].id : '' });
  const [pos, setPos] = useState(null); // { latitude, longitude }
  const [locating, setLocating] = useState(false);
  const [voice, setVoice] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [addSite, setAddSite] = useState(false);
  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const addPhotos = (e) => {
    const list = Array.from(e.target.files || []).filter((x) => x.type.startsWith('image/'));
    setPhotos((p) => [...p, ...list].slice(0, 4));
    e.target.value = '';
  };
  const locate = () => {
    if (!navigator.geolocation) { toast({ title: t('Could not get your location. Allow location for this app, or type the address.'), variant: 'destructive' }); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) }); setLocating(false); toast({ title: t('Location added') }); },
      () => { setLocating(false); toast({ title: t('Could not get your location. Allow location for this app, or type the address.'), variant: 'destructive' }); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };
  const send = async () => {
    if (preview) { toast({ title: 'Preview only', description: 'Clients send requests from their own app.' }); return; }
    if (f.description.trim().length < 5 && !voice) { toast({ title: t('Please describe what you need'), variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('kind', kind);
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      if (pos) { fd.append('latitude', pos.latitude); fd.append('longitude', pos.longitude); }
      photos.forEach((p) => fd.append('photos', p));
      if (voice) fd.append('voice', voice);
      await pb.post('/api/client/requests', fd);
      toast({ title: t('Request sent'), description: t('Our team has been alerted. You’ll get a notification when it’s scheduled.') });
      await reload();
      navigate(`/portal/requests${keep}`, { replace: true });
    } catch (e) { toast({ title: t('Could not send'), description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  if (!kind) {
    return (
      <div className="mx-auto max-w-xl">
        <Helmet><title>New request | RUNHTec</title></Helmet>
        <Link to={`/portal/requests${keep}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> {t('Requests')}</Link>
        <h1 className="font-display text-xl font-bold">{t('What do you need?')}</h1>
        <div className="mt-4 grid gap-3">
          {REQUEST_KINDS.map((k) => {
            const Icon = k.icon;
            return (
              <button key={k.key} type="button" onClick={() => setKind(k.key)} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4 text-left shadow-sm transition active:scale-[0.99]">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${k.tone}`}><Icon className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{t(k.label)}</span><span className="block text-sm text-muted-foreground">{t(k.hint)}</span></span>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const k = REQUEST_KINDS.find((x) => x.key === kind);
  const chosen = sites.find((x) => x.id === f.site);
  return (
    <div className="mx-auto max-w-xl">
      <Helmet><title>{k.label} | RUNHTec</title></Helmet>
      <button type="button" onClick={() => setKind('')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> {t('Change type')}</button>
      <h1 className="font-display text-xl font-bold">{t(k.label)}</h1>
      <div className="mt-4 space-y-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
        <Field label={t(kind === 'quote' ? 'What would you like a quotation for?' : 'What’s happening?')}>
          <textarea className={textareaCls} rows={4} value={f.description} onChange={set('description')} autoFocus
            placeholder={kind === 'quote' ? 'e.g. Solar backup for a 3-bedroom house, about 10 hours of lights, TV and fridge' : 'e.g. The generator does not start since this morning'} />
          <p className="mt-1 text-xs text-muted-foreground">{t('Type it, or record a voice note below.')}</p>
        </Field>
        <VoiceRecorder value={voice} onChange={setVoice} />
        {kind !== 'quote' && (
          <Field label={t('How urgent is it?')}>
            <div className="grid grid-cols-3 gap-2">
              {[['normal', 'Normal'], ['urgent', 'Urgent'], ['emergency', 'Emergency']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setF((p) => ({ ...p, urgency: v }))}
                  className={`rounded-xl border px-2 py-2.5 text-sm font-semibold ${f.urgency === v ? (v === 'normal' ? 'border-[#003DA5] bg-[#003DA5] text-white' : 'border-rose-600 bg-rose-600 text-white') : 'border-border bg-white text-slate-700'}`}>{t(l)}</button>
              ))}
            </div>
          </Field>
        )}
        <Field label={t('Which site?')}>
          <select className={inputCls} value={f.site} onChange={(e) => { if (e.target.value === '__new') { setAddSite(true); return; } setF((p) => ({ ...p, site: e.target.value })); }}>
            <option value="">{sites.length ? t('Somewhere else') : t('Choose a site')}</option>
            {sites.map((x) => <option key={x.id} value={x.id}>{x.name}{x.address ? ` · ${x.address}` : ''}</option>)}
            {!preview && <option value="__new">{t('+ Add a new site')}</option>}
          </select>
        </Field>
        {!chosen && <Field label={t('Location / site')}><input className={inputCls} value={f.address} onChange={set('address')} placeholder={t('e.g. Kiyovu, house near the roundabout')} /></Field>}
        {pos ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <MapPin className="h-4 w-4" /> <a href={mapUrl(pos.latitude, pos.longitude)} target="_blank" rel="noreferrer" className="font-semibold underline">{t('Location added')}</a>
            <button type="button" onClick={() => setPos(null)} className="ml-auto text-xs font-semibold text-slate-600">{t('Remove')}</button>
          </p>
        ) : !hasPos(chosen) && (
          <button type="button" onClick={locate} disabled={locating} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-[#003DA5]">
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} {locating ? t('Getting your location…') : t('Share my location')}
          </button>
        )}
        <Field label={t('When suits you? (optional)')}><input className={inputCls} value={f.preferred_time} onChange={set('preferred_time')} placeholder={t('e.g. Tomorrow morning, or any weekday after 2 pm')} /></Field>
        {data.projects.length > 0 && (
          <Field label={t('Is it about one of your projects? (optional)')}>
            <select className={inputCls} value={f.project} onChange={set('project')}>
              <option value="">{t('No / not sure')}</option>
              {data.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
        )}
        <div>
          <p className="mb-1.5 text-sm font-medium">{t('Photos (optional, up to 4)')}</p>
          <div className="flex flex-wrap gap-2">
            {previews.map((u, i) => (
              <span key={u} className="relative">
                <img src={u} alt="" className="h-20 w-20 rounded-xl object-cover" />
                <button type="button" aria-label="Remove photo" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 p-1 text-white"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {photos.length < 4 && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-500">
                <Camera className="h-6 w-6" /><span className="text-[11px]">{t('Add')}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
              </label>
            )}
          </div>
        </div>
        <button type="button" onClick={send} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#003DA5] text-base font-semibold text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} {t('Send request')}
        </button>
        {f.urgency === 'emergency' && data.settings.company_phone && (
          <p className="text-center text-sm text-rose-700">{t('For danger (fire, sparks, smoke), switch off the power and call us now:')} <a className="font-bold underline" href={`tel:${data.settings.company_phone}`}>{data.settings.company_phone}</a></p>
        )}
      </div>
      <SiteDialog open={addSite} onClose={() => setAddSite(false)} onSaved={(site) => { setF((p) => ({ ...p, site: site.id })); reload(); }} />
    </div>
  );
}

// ── Sites: home, office, branch… ─────────────────────────────────────────────
export function SiteDialog({ open, onClose, onSaved }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [f, setF] = useState({ name: '', address: '', contact_name: '', contact_phone: '' });
  const [pos, setPos] = useState(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF({ name: '', address: '', contact_name: '', contact_phone: '' }); setPos(null); } }, [open]);
  if (!open) return null;
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) }); setLocating(false); },
      () => { setLocating(false); toast({ title: t('Could not get your location. Allow location for this app, or type the address.'), variant: 'destructive' }); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  const save = async () => {
    setBusy(true);
    try {
      const site = await pb.post('/api/client/sites', { ...f, ...(pos || {}) });
      toast({ title: t('Site saved') });
      onSaved?.(site); onClose();
    } catch (e) { toast({ title: t('Could not send'), description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('Add a site')}>
      <div className="space-y-4">
        <Field label={t('Site name')}><input className={inputCls} value={f.name} onChange={set('name')} placeholder={t('e.g. Home, Main office, Musanze branch')} autoFocus /></Field>
        <Field label={t('Address')}><input className={inputCls} value={f.address} onChange={set('address')} placeholder={t('e.g. Kiyovu, house near the roundabout')} /></Field>
        {pos ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><MapPin className="h-4 w-4" /> {t('Location added')}<button type="button" onClick={() => setPos(null)} className="ml-auto text-xs font-semibold text-slate-600">{t('Remove')}</button></p>
        ) : (
          <button type="button" onClick={locate} disabled={locating} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-[#003DA5]">
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} {locating ? t('Getting your location…') : t('Share my location')}
          </button>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Contact person (optional)')}><input className={inputCls} value={f.contact_name} onChange={set('contact_name')} /></Field>
          <Field label={t('Contact phone (optional)')}><input className={inputCls} type="tel" inputMode="tel" value={f.contact_phone} onChange={set('contact_phone')} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>{t('Cancel')}</button>
          <button className={btnPrimary} onClick={save} disabled={busy || f.name.trim().length < 2}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t('Save site')}</button>
        </div>
      </div>
    </Modal>
  );
}

function Sites() {
  const { data, reload, preview } = usePortal();
  const { t } = useLang();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const sites = data.sites || [];
  const remove = async (s) => {
    if (!window.confirm(t('Remove this site? Requests already sent keep their address.'))) return;
    try { await pb.del(`/api/client/sites/${s.id}`); reload(); } catch (e) { toast({ title: t('Could not send'), description: e.message, variant: 'destructive' }); }
  };
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div><h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('My sites')}</h2><p className="text-xs text-muted-foreground">{t('Your places (home, office, branch…). Pick one when you send a request.')}</p></div>
        {!preview && <button type="button" onClick={() => setAdding(true)} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#003DA5]"><Plus className="h-4 w-4" />{t('Add a site')}</button>}
      </div>
      {sites.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-white p-5 text-center text-sm text-muted-foreground">{t('No sites yet.')}</p>
      ) : sites.map((s) => (
        <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#003DA5]"><Building2 className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{s.name}</p>
            <p className="truncate text-sm text-muted-foreground">{[s.address, s.contact_name, s.contact_phone].filter(Boolean).join(' · ')}</p>
            {hasPos(s) && <a href={mapUrl(s.latitude, s.longitude)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#003DA5]"><MapPin className="h-3.5 w-3.5" />{t('See on map')}</a>}
          </div>
          {!preview && <button type="button" onClick={() => remove(s)} aria-label={t('Remove')} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
        </div>
      ))}
      <SiteDialog open={adding} onClose={() => setAdding(false)} onSaved={reload} />
    </section>
  );
}

// ── News ─────────────────────────────────────────────────────────────────────
function News() {
  const { data } = usePortal();
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Helmet><title>News | RUNHTec</title></Helmet>
      <div><h1 className="font-display text-xl font-bold">{t('News from RUNHTec')}</h1><p className="text-sm text-muted-foreground">{t('Offers, tips and updates from our team.')}</p></div>
      {data.news.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground"><Newspaper className="mx-auto mb-2 h-8 w-8 text-slate-400" />{t('No news yet.')}</div>
      ) : data.news.map((n) => (
        <article key={n.id} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">{dayLabel(n.created)}</p>
          <h2 className="mt-1 font-display text-lg font-bold text-slate-900">{n.title}</h2>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{n.body}</p>
          {n.link && <a href={n.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#003DA5]">{t('Learn more')} <ExternalLink className="h-3.5 w-3.5" /></a>}
        </article>
      ))}
    </div>
  );
}

// ── Equipment, service schedule and sites ────────────────────────────────────
function Equipment() {
  const { data, keep } = usePortal();
  const { t } = useLang();
  const today = new Date().toISOString().slice(0, 10);
  const dateOf = (v) => String(v || '').slice(0, 10);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Helmet><title>My equipment | RUNHTec</title></Helmet>
      <div><h1 className="font-display text-xl font-bold">{t('My equipment & service')}</h1><p className="text-sm text-muted-foreground">{t('Your systems and when they’re next serviced. We remind you before each visit.')}</p></div>
      {data.contracts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('Maintenance plan')}</h2>
          {data.contracts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#003DA5]"><CalendarDays className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.service_type || 'Maintenance'}{c.frequency ? <span className="font-normal text-muted-foreground"> · {c.frequency}</span> : null}</p>
                <p className="text-sm text-slate-600">{c.next_due_date ? t('Next visit: {date}', { date: dayLabel(c.next_due_date) }) : t('Next visit to be scheduled')}{c.site ? ` · ${c.site}` : ''}</p>
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('Equipment')}</h2>
        {data.equipment.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground"><Cpu className="mx-auto mb-2 h-8 w-8 text-slate-400" />{t('Equipment we install or service for you will show here.')}</div>
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
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.status === 'faulty' ? 'bg-rose-100 text-rose-700' : e.status === 'under_maintenance' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{t(e.status === 'faulty' ? 'Needs repair' : e.status === 'under_maintenance' ? 'Being serviced' : 'Working')}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {next && <span className={`inline-flex items-center gap-1 ${next < today ? 'font-semibold text-rose-700' : 'text-slate-700'}`}><Clock3 className="h-4 w-4" />{next < today ? t('Service overdue since {date}', { date: dayLabel(next) }) : t('Next service {date}', { date: dayLabel(next) })}</span>}
                {warranty && <span className={`inline-flex items-center gap-1 ${warranty < today ? 'text-slate-500' : 'text-emerald-700'}`}><ShieldCheck className="h-4 w-4" />{warranty < today ? t('Warranty ended') : t('Warranty until {date}', { date: dayLabel(warranty) })}</span>}
              </div>
              <Link to={`/portal/requests/new${keep ? `${keep}&` : '?'}kind=${e.status === 'faulty' ? 'callout' : 'maintenance'}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#003DA5]">{t(e.status === 'faulty' ? 'Request a repair' : 'Request a service')} <ChevronRight className="h-4 w-4" /></Link>
            </div>
          );
        })}
      </section>
      <Sites />
    </div>
  );
}

export const PortalRequestsPage = () => <ClientLayout><Requests /></ClientLayout>;
export const PortalNewRequestPage = () => <ClientLayout><NewRequest /></ClientLayout>;
export const PortalNewsPage = () => <ClientLayout><News /></ClientLayout>;
export const PortalEquipmentPage = () => <ClientLayout><Equipment /></ClientLayout>;
