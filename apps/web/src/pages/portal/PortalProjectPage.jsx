import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, X, Camera, CheckCircle2, Circle, CalendarDays, MapPin, FileText, Download, Send, Loader2, Images, Columns2, Sparkles, BadgeCheck, LifeBuoy,
} from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/money';
import { projectStatusInfo } from '@/lib/projects';
import ClientLayout, { usePortal } from './ClientLayout';
import { moneyFor, dayLabel, timeLabel } from '@/lib/portal';

const n = (v) => Number(v) || 0;
const day = (v) => String(v || '').slice(0, 10);

function Card({ title, icon: Icon, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-border bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 font-display text-base font-bold">{Icon && <Icon className="h-5 w-5 text-[#003DA5]" />}{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// Full-screen photo viewer with swipe on phones and arrow keys on computers.
function Lightbox({ photos, index, onIndex, onClose }) {
  const start = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1); if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [index]);
  const ph = photos[index];
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/95" role="dialog" aria-label="Photo viewer"
      onTouchStart={(e) => { start.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (start.current ?? 0); if (dx > 50 && index > 0) onIndex(index - 1); if (dx < -50 && index < photos.length - 1) onIndex(index + 1); }}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm">{dayLabel(ph.taken_on || ph.created)} · {index + 1} / {photos.length}</span>
        <button onClick={onClose} aria-label="Close" className="rounded-full bg-white/10 p-2"><X className="h-5 w-5" /></button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2">
        <img src={pb.files.getURL(ph, ph.photo)} alt={ph.caption || 'Site photo'} className="max-h-full max-w-full object-contain" />
        {index > 0 && <button onClick={() => onIndex(index - 1)} aria-label="Previous photo" className="absolute left-3 hidden rounded-full bg-white/15 p-3 text-white sm:block"><ChevronLeft className="h-6 w-6" /></button>}
        {index < photos.length - 1 && <button onClick={() => onIndex(index + 1)} aria-label="Next photo" className="absolute right-3 hidden rounded-full bg-white/15 p-3 text-white sm:block"><ChevronRight className="h-6 w-6" /></button>}
      </div>
      {ph.caption && <p className="px-5 py-4 text-center text-sm text-white/90">{ph.caption}</p>}
    </div>
  );
}

function ProjectView() {
  const { id } = useParams();
  const { data, keep, reload, preview, openAssist } = usePortal();
  const { toast } = useToast();
  const p = data.projects.find((x) => x.id === id);
  const [view, setView] = useState(null);
  const [mode, setMode] = useState('timeline');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);

  const photos = useMemo(() => data.photos.filter((ph) => ph.project === id), [data, id]);
  const byDay = useMemo(() => {
    const m = new Map();
    photos.forEach((ph, i) => { const k = day(ph.taken_on || ph.created); if (!m.has(k)) m.set(k, []); m.get(k).push({ ...ph, _i: i }); });
    return [...m.entries()];
  }, [photos]);
  const thread = data.messages.filter((m) => m.project === id);
  const money = moneyFor(data, id);
  const quote = data.quotes.find((q) => q.id === p?.quotation);
  const docs = data.docs.filter((d) => d.project === id);

  if (!p) return <p className="rounded-2xl bg-white p-6 text-sm text-muted-foreground">This project could not be found.</p>;

  const tasks = Array.isArray(p.tasks) ? p.tasks : [];
  const prog = Math.max(0, Math.min(100, n(p.progress)));
  const info = projectStatusInfo(p.status);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const week = {
    photos: photos.filter((ph) => day(ph.taken_on || ph.created) >= weekAgo).length,
    days: new Set(photos.filter((ph) => day(ph.taken_on || ph.created) >= weekAgo).map((ph) => day(ph.taken_on || ph.created))).size,
    tasks: tasks.filter((t) => t.done && t.done_at && day(t.done_at) >= weekAgo),
    notes: [...new Set(photos.filter((ph) => day(ph.taken_on || ph.created) >= weekAgo).map((ph) => ph.caption).filter(Boolean))].slice(0, 4),
  };
  const nextTask = tasks.find((t) => !t.done);
  const first = photos[photos.length - 1];
  const latest = photos[0];

  const send = async () => {
    if (preview) { toast({ title: 'Preview only', description: 'Clients write from their own portal.' }); return; }
    if (!msg.trim()) return;
    setSending(true);
    try { await pb.post('/api/portal/messages', { project: id, body: msg.trim() }); setMsg(''); await reload(); toast({ title: 'Message sent' }); }
    catch (e) { toast({ title: 'Could not send', description: e.message, variant: 'destructive' }); }
    finally { setSending(false); }
  };
  const confirm = async () => {
    if (preview) { toast({ title: 'Preview only' }); return; }
    setConfirming(true);
    try { await pb.post(`/api/portal/projects/${id}/handover`, { note }); await reload(); toast({ title: 'Thank you, handover confirmed' }); }
    catch (e) { toast({ title: 'Could not confirm', description: e.message, variant: 'destructive' }); }
    finally { setConfirming(false); }
  };

  return (
    <div className="space-y-5">
      <Helmet><title>{p.title} | Your project portal</title></Helmet>
      <Link to={`/portal${keep}`} className="inline-flex items-center gap-1 text-sm font-medium text-[#003DA5]"><ChevronLeft className="h-4 w-4" /> All projects</Link>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-lg">
        {latest && <img src={pb.files.getURL(latest, latest.photo)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />}
        <div className="relative bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 pt-24 sm:p-8 sm:pt-32">
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${info.cls || 'bg-white text-slate-800'}`}>{info.label}</span>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-4xl">{p.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/80">
            {p.site_address && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{p.site_address}</span>}
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{p.status === 'done' ? `Completed ${dayLabel(p.completed_date)}` : p.due_date ? `Expected ${dayLabel(p.due_date)}` : 'Date to be confirmed'}</span>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${prog}%` }} /></div>
            <span className="font-display text-2xl font-bold">{prog}%</span>
          </div>
        </div>
      </section>

      {p.status === 'done' && (
        <Card title={p.handover_confirmed_at ? 'Handed over' : 'Your project is complete'} icon={BadgeCheck} className={p.handover_confirmed_at ? 'border-emerald-200 bg-emerald-50' : 'border-[#003DA5]/30'}>
          {p.handover_confirmed_at ? (
            <p className="text-sm">Handover confirmed by <strong>{p.handover_confirmed_by}</strong> on {timeLabel(p.handover_confirmed_at)}.{p.handover_note ? ` “${p.handover_note}”` : ''} Thank you for working with RUNHTec.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p>Please check the work. If everything is as agreed, confirm the handover below. If something still needs attention, tell us in Messages instead.</p>
              <textarea className="w-full rounded-xl border border-border p-3 text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comment (optional), e.g. All working well, thank you." aria-label="Handover comment" />
              <button onClick={confirm} disabled={confirming} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white disabled:opacity-60">{confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm handover</button>
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card title="This week on your project" icon={Sparkles}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3"><p className="font-display text-2xl font-bold">{week.days}</p><p className="text-[11px] text-muted-foreground">day{week.days === 1 ? '' : 's'} with updates</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="font-display text-2xl font-bold">{week.photos}</p><p className="text-[11px] text-muted-foreground">new photo{week.photos === 1 ? '' : 's'}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="font-display text-2xl font-bold">{week.tasks.length}</p><p className="text-[11px] text-muted-foreground">step{week.tasks.length === 1 ? '' : 's'} completed</p></div>
            </div>
            {(week.notes.length > 0 || week.tasks.length > 0) && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {week.tasks.map((t) => <li key={t.id} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{t.title}</li>)}
                {week.notes.map((c) => <li key={c} className="flex gap-2"><Camera className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />{c}</li>)}
              </ul>
            )}
            {nextTask && p.status !== 'done' && <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-[#003DA5]"><strong>Next step:</strong> {nextTask.title}</p>}
          </Card>

          <Card title="Site photos" icon={Images}
            action={photos.length > 1 && (
              <div className="flex rounded-lg border border-border p-0.5 text-xs font-medium">
                <button onClick={() => setMode('timeline')} className={`rounded-md px-2.5 py-1 ${mode === 'timeline' ? 'bg-[#003DA5] text-white' : ''}`}>By day</button>
                <button onClick={() => setMode('compare')} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ${mode === 'compare' ? 'bg-[#003DA5] text-white' : ''}`}><Columns2 className="h-3.5 w-3.5" />Before / now</button>
              </div>
            )}>
            {photos.length === 0 ? <p className="text-sm text-muted-foreground">Photos from the site will appear here as the work progresses.</p>
              : mode === 'compare' ? (
                <div className="grid grid-cols-2 gap-3">
                  {[['First photo', first], ['Latest photo', latest]].map(([label, ph]) => (
                    <button key={label} onClick={() => setView(photos.indexOf(ph))} className="text-left">
                      <img src={pb.files.getURL(ph, ph.photo)} alt={label} className="aspect-[4/3] w-full rounded-xl object-cover" />
                      <p className="mt-1.5 text-xs font-semibold">{label}</p><p className="text-xs text-muted-foreground">{dayLabel(ph.taken_on || ph.created)}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {byDay.map(([d, list]) => (
                    <div key={d}>
                      <p className="mb-1 text-sm font-semibold">{dayLabel(d)}</p>
                      {[...new Set(list.map((x) => x.caption).filter(Boolean))].map((c) => <p key={c} className="mb-2 text-sm text-muted-foreground">{c}</p>)}
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {list.map((ph) => (
                          <button key={ph.id} onClick={() => setView(ph._i)} className="aspect-square overflow-hidden rounded-xl bg-slate-100" aria-label={`Open photo from ${dayLabel(d)}`}>
                            <img src={pb.files.getURL(ph, ph.photo)} alt={ph.caption || 'Site photo'} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </Card>

          <Card title="Messages about this project" icon={Send} action={<Link to={`/portal/messages${keep}`} className="text-sm font-medium text-[#003DA5]">All messages</Link>}>
            {thread.length === 0 ? <p className="mb-3 text-sm text-muted-foreground">Questions or comments about this project? Write to the team here.</p> : (
              <ul className="mb-3 max-h-80 space-y-2 overflow-y-auto">
                {thread.slice(-8).map((m) => (
                  <li key={m.id} className={`flex ${m.sender_role === 'client' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.sender_role === 'client' ? 'bg-[#003DA5] text-white' : 'bg-slate-100'}`}>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${m.sender_role === 'client' ? 'text-white/70' : 'text-muted-foreground'}`}>{m.sender_name} · {timeLabel(m.created)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Write a message…" aria-label="Message about this project" className="h-11 flex-1 rounded-xl border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-[#003DA5]/30" />
              <button onClick={send} disabled={sending} aria-label="Send" className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#003DA5] text-white disabled:opacity-60">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          {tasks.length > 0 && (
            <Card title="Project stages" icon={CheckCircle2}>
              <ol className="relative space-y-3 pl-1">
                {tasks.map((t, i) => {
                  const current = !t.done && tasks.slice(0, i).every((x) => x.done);
                  return (
                    <li key={t.id} className="flex items-start gap-3 text-sm">
                      {t.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className={`mt-0.5 h-5 w-5 shrink-0 ${current ? 'text-[#003DA5]' : 'text-slate-300'}`} />}
                      <span className={t.done ? 'text-muted-foreground' : current ? 'font-semibold' : ''}>{t.title}{current && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#003DA5]">In progress</span>}</span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}

          <Card title="Payments" icon={FileText}>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Contract value</dt><dd className="font-semibold">{formatMoney(money.contract, quote?.currency || p.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Invoiced</dt><dd className="font-semibold">{formatMoney(money.invoiced, p.currency)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Paid</dt><dd className="font-semibold text-emerald-700">{formatMoney(money.paid, p.currency)}</dd></div>
              <div className="flex justify-between border-t border-border pt-2"><dt className="font-semibold">Balance due</dt><dd className={`font-display text-lg font-bold ${money.balance ? 'text-rose-600' : 'text-emerald-700'}`}>{formatMoney(money.balance, p.currency)}</dd></div>
            </dl>
            {money.contract > 0 && <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (money.paid / money.contract) * 100)}%` }} /></div>}
          </Card>

          <Card title="Documents" icon={FileText}>
            <ul className="divide-y divide-border text-sm">
              {quote && <li><Link to={`/quotations/${quote.id}/view`} className="flex items-center justify-between gap-2 py-2.5"><span>Quotation {quote.number}</span><Download className="h-4 w-4 text-[#003DA5]" /></Link></li>}
              {money.invoices.map((inv) => <li key={inv.id}><Link to={`/invoices/${inv.id}/view`} className="flex items-center justify-between gap-2 py-2.5"><span>Invoice {inv.invoice_number} <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : inv.status === 'overdue' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{inv.status}</span></span><Download className="h-4 w-4 text-[#003DA5]" /></Link></li>)}
              {docs.map((d) => <li key={d.id}><a href={pb.files.getURL(d, d.file)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 py-2.5"><span>{d.title}<span className="block text-xs text-muted-foreground">{d.type}</span></span><Download className="h-4 w-4 text-[#003DA5]" /></a></li>)}
              {!quote && money.invoices.length === 0 && docs.length === 0 && <li className="py-2 text-muted-foreground">Your quotation, invoices and documents will appear here.</li>}
            </ul>
          </Card>

          <button onClick={openAssist} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-white py-3 text-sm font-semibold text-[#003DA5] shadow-sm"><LifeBuoy className="h-4 w-4" /> Report a problem or ask for help</button>
        </div>
      </div>

      {view !== null && photos[view] && <Lightbox photos={photos} index={view} onIndex={setView} onClose={() => setView(null)} />}
    </div>
  );
}

export default function PortalProjectPage() {
  return <ClientLayout><ProjectView /></ClientLayout>;
}
