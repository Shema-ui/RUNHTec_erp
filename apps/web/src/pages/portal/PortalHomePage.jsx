import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Camera, CalendarDays, MapPin, Phone, Mail, ChevronRight, LifeBuoy, Wallet, FolderKanban, CheckCircle2, MessageCircle, Cpu, Newspaper, KeyRound, ClipboardList } from 'lucide-react';
import { REQUEST_KINDS, ToRate, RateDialog, statusChip } from './ClientAppPages';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/money';
import { projectStatusInfo } from '@/lib/projects';
import ClientLayout, { usePortal, WhatsAppIcon } from './ClientLayout';
import { moneyFor, whatsappLink, dayLabel, timeLabel } from '@/lib/portal';

const n = (v) => Number(v) || 0;
const initials = (s) => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function Home() {
  const { user } = useAuth();
  const { data, keep, openAssist, reload, signin, openPin } = usePortal();
  const [rate, setRate] = React.useState(null);
  const openRequests = data.requests.filter((r) => !['completed', 'closed'].includes(r.request_status));
  const name = data.client?.company_name || data.client?.trading_name || '';
  const first = String(user?.role === 'client' ? user?.name : name).split(' ')[0];
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const money = moneyFor(data, '');
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const photosWeek = data.photos.filter((p) => String(p.taken_on || p.created).slice(0, 10) >= weekAgo).length;
  const active = data.projects.filter((p) => p.status !== 'done');
  const done = data.projects.filter((p) => p.status === 'done');
  const cover = (pid) => data.photos.find((ph) => ph.project === pid);
  const pm = data.projects.map((p) => p.expand?.project_manager).find(Boolean);
  const feed = useMemo(() => {
    const items = [
      ...data.photos.slice(0, 12).map((ph) => ({ t: ph.taken_on || ph.created, kind: 'photo', ph })),
      ...data.messages.filter((m) => m.sender_role === 'staff').slice(-5).map((m) => ({ t: m.created, kind: 'msg', m })),
    ];
    return items.sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, 6);
  }, [data]);

  return (
    <div className="space-y-6">
      <Helmet><title>Your projects | RUNHTec Contractors</title></Helmet>

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#003DA5] to-[#0a2a6b] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-center gap-4">
          {data.client?.logo
            ? <img src={pb.files.getURL(data.client, data.client.logo)} alt="" className="h-16 w-16 rounded-2xl bg-white object-contain p-1.5" />
            : <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 font-display text-2xl font-bold">{initials(name)}</span>}
          <div className="min-w-0">
            <p className="text-sm text-white/70">{hello}{first ? `, ${first}` : ''}</p>
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
            <p className="text-sm text-white/70">Your projects with RUNHTec Contractors</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/10 p-3"><FolderKanban className="h-5 w-5 text-white/70" /><p className="mt-1 font-display text-2xl font-bold">{active.length}</p><p className="text-[11px] text-white/70">Active project{active.length === 1 ? '' : 's'}</p></div>
          <div className="rounded-2xl bg-white/10 p-3"><Camera className="h-5 w-5 text-white/70" /><p className="mt-1 font-display text-2xl font-bold">{photosWeek}</p><p className="text-[11px] text-white/70">New photos this week</p></div>
          <div className="rounded-2xl bg-white/10 p-3"><Wallet className="h-5 w-5 text-white/70" /><p className="mt-1 font-display text-lg font-bold sm:text-2xl">{formatMoney(money.balance, data.invoices[0]?.currency)}</p><p className="text-[11px] text-white/70">Balance due</p></div>
        </div>
      </section>

      {/* What the client can do, one tap away */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">How can we help?</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {REQUEST_KINDS.map((k) => {
            const Icon = k.icon;
            return (
              <Link key={k.key} to={`/portal/requests/new${keep ? `${keep}&` : '?'}kind=${k.key}`} className="flex flex-col gap-2 rounded-2xl border border-border bg-white p-4 shadow-sm transition active:scale-[0.98]">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${k.tone}`}><Icon className="h-5 w-5" /></span>
                <span className="text-sm font-semibold leading-tight text-slate-900">{k.label}</span>
                <span className="text-xs leading-snug text-muted-foreground">{k.hint}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Link to={`/portal/requests${keep}`} className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white py-2.5 text-sm font-medium"><ClipboardList className="h-4 w-4 text-[#003DA5]" /> Requests{openRequests.length > 0 && <span className="rounded-full bg-[#003DA5] px-1.5 text-[11px] font-bold text-white">{openRequests.length}</span>}</Link>
          <Link to={`/portal/equipment${keep}`} className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white py-2.5 text-sm font-medium"><Cpu className="h-4 w-4 text-[#003DA5]" /> Equipment</Link>
          <Link to={`/portal/news${keep}`} className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-white py-2.5 text-sm font-medium"><Newspaper className="h-4 w-4 text-[#003DA5]" /> News</Link>
        </div>
      </section>

      <ToRate onRate={setRate} />
      <RateDialog item={rate} onClose={() => setRate(null)} onDone={reload} />

      {signin && !signin.has_pin && (
        <button type="button" onClick={openPin} className="flex w-full items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#003DA5] text-white"><KeyRound className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">Set up your app sign-in</span><span className="block text-xs text-slate-600">Choose a PIN to sign in to the RUNHTec app with your phone number.</span></span>
          <ChevronRight className="h-5 w-5 text-[#003DA5]" />
        </button>
      )}

      {openRequests.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Open requests</h2>
          <div className="space-y-2">
            {openRequests.slice(0, 3).map((r) => {
              const chip = statusChip(r);
              return (
                <Link key={r.id} to={`/portal/requests${keep}`} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{r.service_type}</span><span className="block truncate text-xs text-muted-foreground">{r.scheduled_for ? `Visit ${dayLabel(r.scheduled_for)}${r.technician_name ? ` · ${r.technician_name}` : ''}` : r.description}</span></span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.cls}`}>{chip.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {data.projects.length > 0 && (
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Your projects</h2>
        {data.projects.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">Your projects will appear here once work is scheduled.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {[...active, ...done].map((p) => {
              const c = cover(p.id);
              const prog = Math.max(0, Math.min(100, n(p.progress)));
              const info = projectStatusInfo(p.status);
              return (
                <Link key={p.id} to={`/portal/projects/${p.id}${keep}`} className="group overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition hover:shadow-md active:scale-[0.99]">
                  <div className="relative h-40 bg-slate-200">
                    {c ? <img src={pb.files.getURL(c, c.photo)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400"><Camera className="h-8 w-8" /></div>}
                    <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow ${info.cls || 'bg-white'}`}>{info.label}</span>
                    {c && <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white">Latest photo · {dayLabel(c.taken_on || c.created)}</span>}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-base font-bold group-hover:text-[#003DA5]">{p.title}</h3>
                      <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#003DA5]" style={{ width: `${prog}%` }} /></div>
                      <span className="text-sm font-bold">{prog}%</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {p.status === 'done'
                        ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{p.handover_confirmed_at ? 'Handed over' : 'Complete, please confirm the handover'}</span>
                        : <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{p.due_date ? `Expected ${dayLabel(p.due_date)}` : 'Date to be confirmed'}</span>}
                      {p.site_address && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.site_address}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-display text-base font-bold">Latest updates</h2>
          {feed.length === 0 ? <p className="text-sm text-muted-foreground">Photos and messages from the team will show here.</p> : (
            <ul className="space-y-3">
              {feed.map((f, i) => f.kind === 'photo' ? (
                <li key={`p${i}`}>
                  <Link to={`/portal/projects/${f.ph.project}${keep}`} className="flex gap-3">
                    <img src={pb.files.getURL(f.ph, f.ph.photo)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    <span className="min-w-0 text-sm"><span className="block font-medium">New photo · {data.projects.find((p) => p.id === f.ph.project)?.title}</span><span className="block truncate text-muted-foreground">{f.ph.caption || 'Progress on site'}</span><span className="text-xs text-muted-foreground">{dayLabel(f.t)}</span></span>
                  </Link>
                </li>
              ) : (
                <li key={`m${i}`}>
                  <Link to={`/portal/messages${keep}`} className="flex gap-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#003DA5]"><MessageCircle className="h-6 w-6" /></span>
                    <span className="min-w-0 text-sm"><span className="block font-medium">{f.m.sender_name} replied</span><span className="block truncate text-muted-foreground">{f.m.body}</span><span className="text-xs text-muted-foreground">{timeLabel(f.t)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-display text-base font-bold">Your RUNHTec contact</h2>
          {pm ? (
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#003DA5] font-semibold text-white">{initials(pm.name)}</span>
              <div className="min-w-0"><p className="font-semibold">{pm.name}</p><p className="text-xs text-muted-foreground">Project manager</p></div>
            </div>
          ) : <p className="text-sm text-muted-foreground">The RUNHTec team</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(pm?.phone || data.settings.company_phone) && <a href={`tel:${pm?.phone || data.settings.company_phone}`} className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-medium"><Phone className="h-4 w-4" /> Call</a>}
            {whatsappLink(data.settings) && <a href={whatsappLink(data.settings, `Hello RUNHTec, this is ${name}. `)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-2.5 text-sm font-semibold text-white"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a>}
            {(pm?.email || data.settings.company_email) && <a href={`mailto:${pm?.email || data.settings.company_email}`} className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-medium"><Mail className="h-4 w-4" /> Email</a>}
            <button onClick={openAssist} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#003DA5] py-2.5 text-sm font-semibold text-white"><LifeBuoy className="h-4 w-4" /> Get help</button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function PortalHomePage() {
  return <ClientLayout><Home /></ClientLayout>;
}
