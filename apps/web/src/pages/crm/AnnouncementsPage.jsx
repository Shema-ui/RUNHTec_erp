import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Megaphone, Send, Loader2, Trash2, Users } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Field, inputCls, textareaCls, btnPrimary } from '@/components/erp/kit';
import { CLIENT_SERVICES } from '@/lib/crm';

// Who can receive a message. Service groups come from the services ticked on each client's profile.
const AUDIENCES = [
  { value: 'all', label: 'All clients in the app' },
  { value: 'contract', label: 'Clients with an active maintenance contract' },
  ...CLIENT_SERVICES.filter((s) => s.value !== 'other').map((s) => ({ value: `service:${s.value}`, label: `Clients using: ${s.label}` })),
];
const audienceLabel = (v) => AUDIENCES.find((a) => a.value === v)?.label || v;
const when = (d) => (d ? new Date(String(d).replace(' ', 'T') + (String(d).includes('Z') ? '' : 'Z')).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// Ideas staff can start from (they edit before sending).
const TEMPLATES = [
  { title: 'Rainy season check', body: 'Lightning and power surges are common this season. Book a quick check of your earthing and surge protection to protect your equipment. Reply in the app or tap Request service.' },
  { title: 'Generator service reminder', body: 'Is your generator ready for the next power cut? Book a service: oil, filters, battery and a load test.' },
  { title: 'Holiday hours', body: 'Our office hours change over the holidays. For emergencies, use “Technician call-out” in the app and choose Emergency.' },
];

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const [list, setList] = useState(null);
  const [f, setF] = useState({ title: '', body: '', audience: 'all', link: '' });
  const [reach, setReach] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => pb.get('/api/client/announcements').then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  useEffect(() => { setReach(null); pb.get(`/api/client/audience?audience=${encodeURIComponent(f.audience)}`).then((r) => setReach(r.count)).catch(() => setReach(null)); }, [f.audience]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const send = async () => {
    if (f.title.trim().length < 3 || f.body.trim().length < 3) { toast({ title: 'Add a title and a message', variant: 'destructive' }); return; }
    if (!window.confirm(`Send “${f.title}” to ${reach ?? 'the selected'} client app user${reach === 1 ? '' : 's'}? They get a notification on their phone.`)) return;
    setBusy(true);
    try {
      const r = await pb.post('/api/client/announcements', f);
      toast({ title: 'Sent', description: `Delivered to ${r.sent_count} client app user${r.sent_count === 1 ? '' : 's'}.` });
      setF({ title: '', body: '', audience: f.audience, link: '' }); load();
    } catch (e) { toast({ title: 'Could not send', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const remove = async (a) => {
    if (!window.confirm(`Remove “${a.title}” from the clients’ News list? (Notifications already delivered stay on their phones.)`)) return;
    await pb.del(`/api/client/announcements/${a.id}`).catch(() => {});
    load();
  };

  return (
    <PortalLayout title="Client App News" subtitle="Send updates, offers and reminders to clients in the app">
      <Helmet><title>Client App News | RUNHTec Business Portal</title></Helmet>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold"><Megaphone className="h-5 w-5 text-primary" /> New message to clients</h2>
          <div className="space-y-4">
            <Field label="Send to">
              <select className={inputCls} value={f.audience} onChange={set('audience')}>{AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
            </Field>
            <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />{reach === null ? 'Counting…' : `${reach} client app user${reach === 1 ? '' : 's'} will receive it`}</p>
            <Field label="Title"><input className={inputCls} maxLength={150} value={f.title} onChange={set('title')} placeholder="e.g. Rainy season check" /></Field>
            <Field label="Message"><textarea className={textareaCls} rows={5} maxLength={3000} value={f.body} onChange={set('body')} placeholder="Keep it short and clear. The first line shows in the phone notification." /></Field>
            <Field label="Link (optional)" hint="A web page to open, starting with https://"><input className={inputCls} value={f.link} onChange={set('link')} placeholder="https://runhteccontractors.si/…" /></Field>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => <button key={t.title} type="button" onClick={() => setF((p) => ({ ...p, title: t.title, body: t.body }))} className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-secondary">Use “{t.title}”</button>)}
            </div>
            <button type="button" onClick={send} disabled={busy} className={`${btnPrimary} w-full`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to clients</button>
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-display text-base font-bold">Sent</h2>
          {list === null ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : list.length === 0 ? <p className="text-sm text-muted-foreground">Nothing sent yet.</p> : (
            <ul className="space-y-3">
              {list.map((a) => (
                <li key={a.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{when(a.created)} · {audienceLabel(a.audience)} · reached {a.sent_count}{a.created_by_name ? ` · by ${a.created_by_name}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => remove(a)} aria-label="Remove" className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-foreground/80">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PortalLayout>
  );
}
