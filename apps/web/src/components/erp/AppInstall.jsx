import React, { useEffect, useState } from 'react';
import { Smartphone, Download, Bell, BellOff, Share, PlusSquare, CheckCircle2, Loader2, X } from 'lucide-react';
import { Modal, btnPrimary, btnLine } from '@/components/erp/kit';
import {
  isInstalled, isIOS, canPromptInstall, promptInstall, onPwaChange,
  pushSupported, pushNeedsInstall, pushStatus, turnOnPush, turnOffPush, sendTestPush,
} from '@/lib/pwa';

function usePwa() {
  const [, setTick] = useState(0);
  useEffect(() => onPwaChange(() => setTick((t) => t + 1)), []);
  return { installed: isInstalled(), canPrompt: canPromptInstall(), ios: isIOS() };
}

// Step-by-step help when the browser has no one-tap install (iPhone, Firefox…).
function ManualSteps({ ios }) {
  return ios ? (
    <ol className="space-y-2 text-sm text-foreground">
      <li className="flex items-start gap-2"><span className="font-bold">1.</span><span>Open this page in <b>Safari</b>.</span></li>
      <li className="flex items-start gap-2"><span className="font-bold">2.</span><span>Tap the <b>Share</b> button <Share className="inline h-4 w-4 align-text-bottom" /> at the bottom of the screen.</span></li>
      <li className="flex items-start gap-2"><span className="font-bold">3.</span><span>Choose <b>Add to Home Screen</b> <PlusSquare className="inline h-4 w-4 align-text-bottom" />, then <b>Add</b>.</span></li>
      <li className="flex items-start gap-2"><span className="font-bold">4.</span><span>Open My RUNHTec from your home screen.</span></li>
    </ol>
  ) : (
    <ol className="space-y-2 text-sm text-foreground">
      <li className="flex items-start gap-2"><span className="font-bold">1.</span><span>Open this page in <b>Chrome</b> or <b>Edge</b>.</span></li>
      <li className="flex items-start gap-2"><span className="font-bold">2.</span><span>Open the browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.</span></li>
    </ol>
  );
}

// "App & notifications" window, opened from the account menu.
export function AppDialog({ open, onClose }) {
  const { installed, canPrompt, ios } = usePwa();
  const [push, setPush] = useState('off');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { if (open) { setMsg(''); pushStatus().then(setPush); } }, [open]);

  const install = async () => { if (await promptInstall()) setMsg('Installed. Find RUNHTec on your home screen or desktop.'); };
  const togglePush = async () => {
    setBusy(true); setMsg('');
    try {
      if (push === 'on') { await turnOffPush(); setPush('off'); setMsg('Notifications are off on this device.'); }
      else { await turnOnPush(); setPush('on'); await sendTestPush().catch(() => {}); setMsg('Done. A test notification is on its way.'); }
    } catch (e) { setMsg(e.message); setPush(await pushStatus()); }
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="App & notifications" description="Use RUNHTec like a normal app on your phone or computer.">
      <div className="space-y-5">
        <section className="rounded-xl border border-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Smartphone className="h-4 w-4 text-primary" /> Install the app</h3>
          {installed ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> You’re using the installed app.</p>
          ) : canPrompt ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Adds a RUNHTec icon to your home screen or desktop. It opens full screen and stays up to date by itself.</p>
              <button type="button" onClick={install} className={`${btnPrimary} mt-3`}><Download className="h-4 w-4" /> Install My RUNHTec</button>
            </>
          ) : (
            <div className="mt-2"><ManualSteps ios={ios} /></div>
          )}
        </section>

        <section className="rounded-xl border border-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Bell className="h-4 w-4 text-primary" /> Notifications on this device</h3>
          <p className="mt-1 text-sm text-muted-foreground">Get your bell alerts (new requests, messages, overdue invoices, expired quotes, project updates) as pop-ups, even when RUNHTec is closed.</p>
          {!pushSupported() ? (
            <p className="mt-2 text-sm text-amber-700">This browser can’t show notifications. {ios ? 'Install the app first (steps above), then open it from your home screen.' : 'Try Chrome or Edge.'}</p>
          ) : pushNeedsInstall() ? (
            <p className="mt-2 text-sm text-amber-700">On iPhone, install the app first (steps above), then open it from your home screen and turn notifications on there.</p>
          ) : push === 'blocked' ? (
            <p className="mt-2 text-sm text-amber-700">Notifications are blocked for RUNHTec. Allow them in your browser’s site settings (the padlock next to the address) or your phone’s app settings, then come back here.</p>
          ) : (
            <button type="button" onClick={togglePush} disabled={busy} className={`${push === 'on' ? btnLine : btnPrimary} mt-3`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : push === 'on' ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {push === 'on' ? 'Turn off on this device' : 'Turn on notifications'}
            </button>
          )}
          {push === 'on' && <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> On for this device.</p>}
        </section>

        {msg && <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-foreground">{msg}</p>}
        <p className="text-xs text-muted-foreground">Each phone or computer is set up separately. Signing out turns notifications off on that device.</p>
      </div>
    </Modal>
  );
}

// Small invitation shown on the Dashboard until the app is installed (can be hidden).
const HIDE_KEY = 'runhtec-hide-install-banner';
export function InstallBanner({ onOpen }) {
  const { installed } = usePwa();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } });
  if (installed || hidden) return null;
  const hide = () => { try { localStorage.setItem(HIDE_KEY, '1'); } catch { /* ignore */ } setHidden(true); };
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white"><Smartphone className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Get the My RUNHTec app</p>
        <p className="text-xs text-muted-foreground">Install it on your phone or computer and get notifications as they happen.</p>
      </div>
      <button type="button" onClick={onOpen} className={`${btnPrimary} shrink-0`}>Set up</button>
      <button type="button" onClick={hide} aria-label="Hide" className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-white"><X className="h-4 w-4" /></button>
    </div>
  );
}
