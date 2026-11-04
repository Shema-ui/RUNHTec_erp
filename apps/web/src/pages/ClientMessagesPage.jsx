import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { Send, Loader2, Eye, Building2, LifeBuoy, ChevronLeft } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Empty, Loading } from '@/components/erp/kit';
import { dayLabel, timeLabel } from '@/lib/portal';

// Staff inbox: every conversation with clients (portal messages and help requests).
export default function ClientMessagesPage() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const active = params.get('client') || '';
  const [msgs, setMsgs] = useState(null);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [text, setText] = useState('');
  const [project, setProject] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  const load = () => pb.collection('client_messages').getFullList({ sort: 'created' }).then(setMsgs).catch(() => setMsgs([]));
  useEffect(() => {
    load();
    pb.collection('clients').getFullList({ sort: 'company_name' }).then(setClients).catch(() => {});
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setProject('');
    if (!active) return;
    pb.collection('projects').getFullList({ filter: `client = '${active.replace(/'/g, '')}'`, sort: '-created' }).then(setProjects).catch(() => setProjects([]));
  }, [active]);

  const threads = useMemo(() => {
    const m = new Map();
    (msgs || []).forEach((x) => {
      const t = m.get(x.client) || { client: x.client, last: null, unread: 0, help: 0 };
      t.last = x;
      if (x.sender_role === 'client' && !Number(x.read_by_staff)) { t.unread += 1; if (x.kind === 'assistance') t.help += 1; }
      m.set(x.client, t);
    });
    return [...m.values()].sort((a, b) => String(b.last.created).localeCompare(String(a.last.created)));
  }, [msgs]);
  const thread = (msgs || []).filter((x) => x.client === active);
  const clientName = (id) => clients.find((c) => c.id === id)?.company_name || 'Client';

  useEffect(() => {
    if (active && thread.some((x) => x.sender_role === 'client' && !Number(x.read_by_staff))) pb.post('/api/portal/staff-read', { client: active }).then(load).catch(() => {});
    end.current?.scrollIntoView({ block: 'end' });
  }, [active, thread.length]);

  const send = async () => {
    if (!text.trim() || !active) return;
    setBusy(true);
    try {
      await pb.collection('client_messages').create({ client: active, project: project || null, body: text.trim(), kind: 'message' });
      setText(''); await load();
    } catch (e) { toast({ title: 'Could not send', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  let lastDay = '';
  return (
    <PortalLayout title="Client Messages" subtitle="Conversations and help requests from the client portal">
      <Helmet><title>Client Messages | RUNHTec Business Portal</title></Helmet>
      {!msgs ? <Loading /> : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className={`${active ? 'hidden lg:block' : ''} rounded-2xl border border-border bg-card shadow-sm`}>
            <div className="border-b border-border p-3">
              <select className="h-10 w-full rounded-lg border border-border bg-background px-2 text-sm" value="" onChange={(e) => e.target.value && setParams({ client: e.target.value })} aria-label="Start a conversation">
                <option value="">+ Message a client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            {threads.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No messages from clients yet.</p> : (
              <ul className="divide-y divide-border">
                {threads.map((t) => (
                  <li key={t.client}>
                    <button onClick={() => setParams({ client: t.client })} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-secondary/50 ${active === t.client ? 'bg-secondary' : ''}`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2"><span className={`truncate text-sm ${t.unread ? 'font-bold' : 'font-medium'}`}>{clientName(t.client)}</span>{t.unread > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{t.unread}</span>}</span>
                        <span className="block truncate text-xs text-muted-foreground">{t.help > 0 && <LifeBuoy className="mr-1 inline h-3 w-3 text-rose-600" />}{t.last.sender_role === 'staff' ? 'You: ' : ''}{t.last.body}</span>
                        <span className="text-[11px] text-muted-foreground">{timeLabel(t.last.created)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {!active ? <div className="hidden lg:block"><Empty>Choose a conversation on the left, or “Message a client…” to start one.</Empty></div> : (
            <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
                <button onClick={() => setParams({})} className="rounded-lg p-1.5 hover:bg-secondary lg:hidden" aria-label="Back to conversations"><ChevronLeft className="h-5 w-5" /></button>
                <Link to={`/crm/clients/${active}`} className="font-semibold hover:text-primary">{clientName(active)}</Link>
                <Link to={`/portal?as=${active}`} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"><Eye className="h-3.5 w-3.5" /> See their portal</Link>
              </div>
              <div className="max-h-[60vh] min-h-[320px] flex-1 overflow-y-auto p-4">
                {thread.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No messages yet. Your message will appear in the client’s portal with a 🔔 alert.</p> : (
                  <ul className="space-y-2">
                    {thread.map((m) => {
                      const d = String(m.created).slice(0, 10); const showDay = d !== lastDay; lastDay = d;
                      const mine = m.sender_role === 'staff';
                      const proj = projects.find((x) => x.id === m.project);
                      return (
                        <React.Fragment key={m.id}>
                          {showDay && <li className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{dayLabel(m.created)}</li>}
                          <li className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-primary text-primary-foreground' : m.kind === 'assistance' ? 'border border-rose-200 bg-rose-50' : 'bg-secondary'}`}>
                              {m.kind === 'assistance' && <p className="mb-1 text-[11px] font-semibold uppercase text-rose-600">Help request{m.topic ? ` · ${m.topic}` : ''}</p>}
                              {proj && <p className={`mb-1 text-[11px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>About: {proj.title}</p>}
                              <p className="whitespace-pre-wrap">{m.body}</p>
                              <p className={`mt-1 text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{m.sender_name} · {timeLabel(m.created)}</p>
                            </div>
                          </li>
                        </React.Fragment>
                      );
                    })}
                  </ul>
                )}
                <div ref={end} />
              </div>
              <div className="border-t border-border p-3">
                {projects.length > 0 && (
                  <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="About which project" className="mb-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
                    <option value="">General</option>{projects.map((p) => <option key={p.id} value={p.id}>About: {p.title}</option>)}
                  </select>
                )}
                <div className="flex gap-2">
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Reply to the client…" aria-label="Reply" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                  <button onClick={send} disabled={busy} aria-label="Send reply" className="flex w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </PortalLayout>
  );
}
