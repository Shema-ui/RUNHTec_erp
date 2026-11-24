import React, { useEffect, useState } from 'react';
import { Mail, MessageCircle, CalendarDays, Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Field, inputCls, textareaCls, btnPrimary } from '@/components/erp/kit';

const btnLine = 'inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50';
const fmt = (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : '');
const KIND = { email: 'Email', whatsapp: 'WhatsApp', interview: 'Interview', note: 'Note' };

// Message the applicant, schedule an interview and see the history of contact.
export default function ApplicantContact({ application: a }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [events, setEvents] = useState([]);
  const [tpl, setTpl] = useState('documents');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState('');
  const [when, setWhen] = useState('');
  const [place, setPlace] = useState('');
  const [notes, setNotes] = useState('');

  const loadEvents = () => pb.get(`/api/applicant-contact/${a.id}/events`).then(setEvents).catch(() => setEvents([]));

  useEffect(() => {
    pb.get('/api/applicant-contact/templates').then((list) => {
      setTemplates(list);
      const first = list.find((t) => t.key === 'documents') || list[0];
      if (first) { setTpl(first.key); setSubject(first.subject); setBody(first.body); }
    }).catch(() => {});
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id]);

  const pick = (key) => {
    setTpl(key);
    const t = templates.find((x) => x.key === key);
    if (t) { setSubject(t.subject); setBody(t.body); }
  };

  const run = async (label, fn) => {
    setBusy(label);
    try { await fn(); await loadEvents(); } catch (e) {
      toast({ title: 'Could not complete', description: e.message, variant: 'destructive' });
    } finally { setBusy(''); }
  };

  const sendEmail = () => run('email', async () => {
    await pb.post(`/api/applicant-contact/${a.id}/email`, { template: tpl, subject, body });
    toast({ title: 'Email sent', description: `${a.full_name} · ${subject}` });
  });

  const sendWhatsApp = () => run('whatsapp', async () => {
    const r = await pb.post(`/api/applicant-contact/${a.id}/whatsapp`, { body });
    window.open(r.url, '_blank', 'noopener');
  });

  const invite = () => run('interview', async () => {
    const r = await pb.post(`/api/applicant-contact/${a.id}/interview`, { when, place, notes });
    toast({ title: 'Interview scheduled', description: r.when });
    setWhen(''); setPlace(''); setNotes('');
  });

  return (
    <div className="space-y-5 rounded-xl border border-border bg-secondary/30 p-4">
      <p className="text-sm font-semibold">Contact the applicant</p>

      <div className="space-y-3">
        <Field label="Message">
          <select className={inputCls} value={tpl} onChange={(e) => pick(e.target.value)}>
            {templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Subject">
          <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Message text" hint="{name} and {ref} are filled in automatically.">
          <textarea className={textareaCls} rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {a.email && <button className={btnPrimary} disabled={!!busy || !subject || !body} onClick={sendEmail}>{busy === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send email</button>}
          {(a.whatsapp || a.phone) && <button className={btnLine} disabled={!!busy || !body} onClick={sendWhatsApp}><MessageCircle className="h-4 w-4" /> Open WhatsApp</button>}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4" /> Schedule an interview</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date and time (Kigali time)">
            <input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field label="Where">
            <input className={inputCls} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Office address or site" />
          </Field>
        </div>
        <Field label="What to bring or prepare">
          <textarea className={textareaCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ID, certificates, tools for the practical test…" />
        </Field>
        <button className={btnPrimary} disabled={!!busy || !when || !place} onClick={invite}>{busy === 'interview' && <Loader2 className="h-4 w-4 animate-spin" />} Send interview invitation</button>
        <p className="text-xs text-muted-foreground">The applicant gets an email with a calendar file, and a reminder the day before.</p>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-sm font-semibold">History</p>
        {events.length === 0 ? <p className="text-xs text-muted-foreground">No contact yet.</p> : (
          <ul className="divide-y divide-border text-sm">
            {events.map((e) => (
              <li key={e.id} className="py-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{KIND[e.kind] || e.kind}{e.subject ? ` · ${e.subject}` : ''}</span>
                  <span className="text-xs text-muted-foreground">{fmt(e.created)} · {e.created_by_name}</span>
                </div>
                {e.kind === 'interview' && <p className="text-xs text-muted-foreground">Interview {e.subject} at {e.place}{e.reminder_sent ? ' · reminder sent' : ''}</p>}
                {e.body && e.kind !== 'interview' && <p className="line-clamp-2 text-xs text-muted-foreground">{e.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
