import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Home, MessageCircle, LifeBuoy, LogOut, Eye, Loader2, Send, BellRing, ClipboardList, Newspaper, KeyRound, UserRound, Download } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isInstalled } from '@/lib/pwa';
import { AppDialog } from '@/components/erp/AppInstall';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import BrandMark from '@/components/BrandMark';
import NotificationBell from '@/components/erp/NotificationBell';
import { Modal, Field, inputCls, textareaCls, btnPrimary, btnLine } from '@/components/erp/kit';
import { loadPortal, whatsappLink, ASSIST_TOPICS } from '@/lib/portal';

const PortalCtx = createContext(null);
export const usePortal = () => useContext(PortalCtx);

export function WhatsAppIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.5-.5-.9-1-1.3-1.7-.1-.2 0-.4.1-.5l.4-.5.2-.4v-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.6.6-.9 1.4-.9 2.2.1 1 .5 2 1.1 2.8 1.2 1.7 2.7 3 4.6 3.7.6.3 1.3.4 2 .5.7 0 1.5-.3 2-.8.3-.4.4-.8.4-1.3-.1-.1-.2-.2-.5-.3z" /></svg>
  );
}

// Layout + data for the client portal. A client login sees its own client; a
// staff member can preview any client with /portal?as=<clientId>.
export default function ClientLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const isClient = user?.role === 'client';
  const clientId = isClient ? user.client : params.get('as');
  const preview = !isClient;
  const [data, setData] = useState(null);
  const [assist, setAssist] = useState(false);
  const [appOpen, setAppOpen] = useState(false);
  // App sign-in (phone + PIN): asked once after opening the private link.
  const [signin, setSignin] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  useEffect(() => {
    if (!isClient) return;
    pb.get('/api/client/me').then((r) => {
      setSignin(r);
      let asked = false; try { asked = sessionStorage.getItem('runhtec-pin-asked') === '1'; } catch { /* ignore */ }
      if (!r.has_pin && !asked) { setPinOpen(true); try { sessionStorage.setItem('runhtec-pin-asked', '1'); } catch { /* ignore */ } }
    }).catch(() => {});
  }, [isClient]);

  const reload = useCallback(() => (clientId ? loadPortal(clientId).then(setData) : Promise.resolve()), [clientId]);
  useEffect(() => { reload(); const t = setInterval(reload, 30000); return () => clearInterval(t); }, [reload]);

  const unread = (data?.messages || []).filter((m) => m.sender_role === 'staff' && !Number(m.read_by_client)).length;
  const keep = preview && clientId ? `?as=${clientId}` : '';
  const name = data?.client?.company_name || data?.client?.trading_name || 'Your projects';
  const wa = whatsappLink(data?.settings, `Hello RUNHTec, this is ${user?.name || ''} (${name}). `);
  const ctx = useMemo(() => ({ data, reload, preview, clientId, keep, signin, openAssist: () => setAssist(true), openPin: () => setPinOpen(true) }), [data, reload, preview, clientId, keep, signin]);

  const leave = () => { logout(); navigate('/login', { replace: true }); };
  if (!clientId) {
    return <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center text-sm text-muted-foreground">Open the portal from a client’s profile (“Preview portal”).</div>;
  }

  const tab = (to, label, Icon, badge) => (
    <NavLink to={`${to}${keep}`} end className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-[#003DA5]' : 'text-slate-500'}`}>
      <Icon className="h-5 w-5" />{label}
      {badge > 0 && <span className="absolute right-1/4 top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{badge}</span>}
    </NavLink>
  );

  return (
    <PortalCtx.Provider value={ctx}>
      <div className="min-h-[100dvh] bg-slate-50 pb-20 md:pb-0">
        {preview && (
          <div className="flex flex-wrap items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900">
            <Eye className="h-4 w-4" /> Preview: this is exactly what {name} sees. <Link className="underline" to={`/crm/clients/${clientId}`}>Back to the client</Link>
          </div>
        )}
        <header className="sticky top-0 z-30 bg-[#003DA5] text-white shadow">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
            <Link to={`/portal${keep}`} className="shrink-0"><BrandMark title="My RUNHTec" subtitle="" /></Link>
            <nav className="ml-6 hidden items-center gap-1 md:flex">
              {[['/portal', 'Home'], ['/portal/requests', 'Requests'], ['/portal/messages', 'Messages'], ['/portal/news', 'News']].map(([to, label]) => (
                <NavLink key={to} to={`${to}${keep}`} end className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/15' : 'text-white/80 hover:bg-white/10'}`}>
                  {label}{to.endsWith('messages') && unread > 0 && <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[11px] font-bold">{unread}</span>}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setAssist(true)} className="hidden items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25 md:flex"><LifeBuoy className="h-4 w-4" /> Get help</button>
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white md:flex"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a>}
              {isClient && <span className="[&_button]:text-white"><NotificationBell /></span>}
              {isClient ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button aria-label="My account" className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-bold hover:bg-white/25">
                      {(user?.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || <UserRound className="h-5 w-5" />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel>
                      <p className="truncate text-sm">{user?.name || 'My account'}</p>
                      <p className="truncate text-xs font-normal text-muted-foreground">{name}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setAppOpen(true)}><BellRing className="mr-2 h-4 w-4" />Turn on phone alerts</DropdownMenuItem>
                    {!isInstalled() && <DropdownMenuItem onClick={() => setAppOpen(true)}><Download className="mr-2 h-4 w-4" />Install the app</DropdownMenuItem>}
                    <DropdownMenuItem onClick={() => setPinOpen(true)}><KeyRound className="mr-2 h-4 w-4" />{signin?.has_pin ? 'Change my PIN' : 'Set up my PIN'}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { if (window.confirm('Sign out of My RUNHTec? You’ll need your phone number and PIN to sign in again.')) leave(); }} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button onClick={leave} title="Sign out" aria-label="Sign out" className="rounded-lg p-2 text-white/80 hover:bg-white/10"><LogOut className="h-5 w-5" /></button>
              )}
            </div>
          </div>
        </header>

        <AppDialog open={appOpen} onClose={() => setAppOpen(false)} />
        {isClient && <PinDialog open={pinOpen} onClose={() => setPinOpen(false)} current={signin} onDone={(r) => setSignin({ ...(signin || {}), ...r, has_pin: true })} />}
        <main className="mx-auto max-w-6xl px-4 py-5 md:py-8">
          {!data ? <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-[#003DA5]" /></div> : children}
        </main>

        {/* Phone: bottom bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-white md:hidden" aria-label="Portal">
          {tab('/portal', 'Home', Home)}
          {tab('/portal/requests', 'Requests', ClipboardList)}
          {tab('/portal/messages', 'Messages', MessageCircle, unread)}
          {tab('/portal/news', 'News', Newspaper)}
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-[#128C7E]"><WhatsAppIcon />WhatsApp</a>}
        </nav>

        <AssistDialog open={assist} onClose={() => setAssist(false)} />
      </div>
    </PortalCtx.Provider>
  );
}

// App sign-in: the phone number and PIN this person uses in the installed app.
export function PinDialog({ open, onClose, current, onDone }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setPhone(current?.phone ? `+${current.phone}` : ''); setPin(''); setPin2(''); setErr(''); } }, [open]);
  const save = async () => {
    setErr('');
    if (!/^\d{4,6}$/.test(pin)) { setErr('Choose a PIN of 4 to 6 digits.'); return; }
    if (pin !== pin2) { setErr('The two PINs are not the same.'); return; }
    setBusy(true);
    try {
      const r = await pb.post('/api/client/pin', { phone, pin });
      if (r.token) pb.authStore.save(r.token, r.record);
      toast({ title: 'App sign-in ready', description: 'Use your phone number and this PIN to sign in to My RUNHTec.' });
      onDone?.({ phone: phone.replace(/\D/g, '') }); onClose();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={current?.has_pin ? 'Change your app PIN' : 'Set up the My RUNHTec app'} description="Choose a PIN so you can sign in to My RUNHTec on your phone with your phone number. No password to remember.">
      <div className="space-y-4">
        <Field label="Your phone number"><input className={inputCls} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0788 123 456" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="New PIN (4–6 digits)"><input className={`${inputCls} tracking-[0.4em]`} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Repeat PIN"><input className={`${inputCls} tracking-[0.4em]`} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Later</button>
          <button className={btnPrimary} onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Save PIN</button>
        </div>
      </div>
    </Modal>
  );
}

// "Get help": a request that goes straight to the RUNHTec team inside the ERP.
export function AssistDialog({ open, onClose, defaultProject = '' }) {
  const { data, reload, preview } = usePortal();
  const { toast } = useToast();
  const [f, setF] = useState({ topic: ASSIST_TOPICS[0], project: defaultProject, body: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ topic: ASSIST_TOPICS[0], project: defaultProject || (data?.projects?.length === 1 ? data.projects[0].id : ''), body: '' }); }, [open]);
  const send = async () => {
    if (preview) { toast({ title: 'Preview only', description: 'Clients send requests from their own portal.' }); return; }
    if (!f.body.trim()) { toast({ title: 'Describe what you need', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      await pb.post('/api/portal/messages', { kind: 'assistance', topic: f.topic, project: f.project || null, body: f.body.trim() });
      toast({ title: 'Request sent', description: 'Our team has been alerted and will reply in Messages.' });
      onClose(); reload();
    } catch (e) { toast({ title: 'Could not send', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Ask RUNHTec for help" description="Tell us what you need. The team is alerted straight away and replies in Messages.">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What is it about?">
            <select className={inputCls} value={f.topic} onChange={(e) => setF((p) => ({ ...p, topic: e.target.value }))}>{ASSIST_TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
          </Field>
          <Field label="Project">
            <select className={inputCls} value={f.project} onChange={(e) => setF((p) => ({ ...p, project: e.target.value }))}>
              <option value="">General</option>{(data?.projects || []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Your message"><textarea className={textareaCls} rows={4} value={f.body} onChange={(e) => setF((p) => ({ ...p, body: e.target.value }))} placeholder="e.g. The inverter shows a red light since this morning." aria-label="Your message" /></Field>
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={send} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send request</button>
        </div>
      </div>
    </Modal>
  );
}
