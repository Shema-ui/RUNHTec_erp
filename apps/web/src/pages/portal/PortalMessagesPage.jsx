import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Send, Loader2, LifeBuoy } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import ClientLayout, { usePortal, WhatsAppIcon } from './ClientLayout';
import { dayLabel, timeLabel, whatsappLink } from '@/lib/portal';

function Chat() {
  const { data, reload, preview, openAssist } = usePortal();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [project, setProject] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  const msgs = data.messages;

  // Opening the conversation marks the team's replies as read.
  useEffect(() => {
    if (!preview && msgs.some((m) => m.sender_role === 'staff' && !Number(m.read_by_client))) pb.post('/api/portal/messages/read').then(reload).catch(() => {});
  }, [msgs.length]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);
  useEffect(() => { const t = setInterval(reload, 15000); return () => clearInterval(t); }, [reload]);

  const send = async () => {
    if (preview) { toast({ title: 'Preview only', description: 'Clients write from their own portal.' }); return; }
    if (!text.trim()) return;
    setBusy(true);
    try { await pb.post('/api/portal/messages', { body: text.trim(), project: project || null }); setText(''); await reload(); }
    catch (e) { toast({ title: 'Could not send', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  let lastDay = '';
  const wa = whatsappLink(data.settings, 'Hello RUNHTec, ');
  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <Helmet><title>Messages | Your project portal</title></Helmet>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="font-display text-xl font-bold">Messages</h1><p className="text-sm text-muted-foreground">Write to the RUNHTec team. We reply here and you see a 🔔 alert.</p></div>
        <div className="flex gap-2">
          <button onClick={openAssist} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium"><LifeBuoy className="h-4 w-4" /> Get help</button>
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-semibold text-white"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a>}
        </div>
      </div>

      <div className="min-h-[50vh] rounded-2xl border border-border bg-white p-4 shadow-sm">
        {msgs.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">No messages yet. Say hello or ask a question below.</p> : (
          <ul className="space-y-2">
            {msgs.map((m) => {
              const d = String(m.created).slice(0, 10);
              const showDay = d !== lastDay; lastDay = d;
              const mine = m.sender_role === 'client';
              const proj = data.projects.find((x) => x.id === m.project);
              return (
                <React.Fragment key={m.id}>
                  {showDay && <li className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{dayLabel(m.created)}</li>}
                  <li className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-[#003DA5] text-white' : 'bg-slate-100'}`}>
                      {m.kind === 'assistance' && <p className={`mb-1 text-[11px] font-semibold uppercase ${mine ? 'text-white/80' : 'text-rose-600'}`}>Help request{m.topic ? ` · ${m.topic}` : ''}</p>}
                      {proj && <p className={`mb-1 text-[11px] ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>About: {proj.title}</p>}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>{m.sender_name} · {timeLabel(m.created)}</p>
                    </div>
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        )}
        <div ref={end} />
      </div>

      <div className="sticky bottom-16 mt-3 rounded-2xl border border-border bg-white p-3 shadow-sm md:bottom-4">
        {data.projects.length > 1 && (
          <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Which project" className="mb-2 h-9 w-full rounded-lg border border-border bg-white px-2 text-sm">
            <option value="">General (not about one project)</option>
            {data.projects.map((p) => <option key={p.id} value={p.id}>About: {p.title}</option>)}
          </select>
        )}
        <div className="flex gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Write a message…" aria-label="Message"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#003DA5]/30" />
          <button onClick={send} disabled={busy} aria-label="Send" className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#003DA5] text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
        </div>
      </div>
    </div>
  );
}

export default function PortalMessagesPage() {
  return <ClientLayout><Chat /></ClientLayout>;
}
