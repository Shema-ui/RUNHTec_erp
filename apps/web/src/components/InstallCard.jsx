import React, { useEffect, useState } from 'react';
import { Download, Share, Copy, CheckCircle2, ArrowDown } from 'lucide-react';
import { isInstalled, canPromptInstall, promptInstall, onPwaChange } from '@/lib/pwa';

// The big "Get the app" card at the top of the sign-in and sign-up pages (phones only).
// Android/Chrome: one tap. iPhone: a short guide to Safari's Share button.
// Hidden once the app is installed, and on computers (they use the QR code on /app).
const APP_URL = 'https://erp.runhteccontractors.si/app';

function detect() {
  const ua = navigator.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const inApp = /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|TikTok|musical_ly|LinkedInApp|GSA\//i.test(ua);
  const iosOther = ios && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return { ios, android, inApp, iosOther, phone: ios || android };
}

export default function InstallCard() {
  const [d] = useState(detect);
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  useEffect(() => onPwaChange(() => setTick((t) => t + 1)), []);

  // Phones always; computers only when Chrome/Edge offers the one-tap install.
  // Hidden once the app is installed.
  if (isInstalled() || (!d.phone && !canPromptInstall())) return null;

  // One tap: Chrome's own "Add to Home screen / Install" prompt. If Chrome hasn't offered
  // it yet, the button shows the exact menu steps instead.
  const tapInstall = async () => {
    if (canPromptInstall()) { await promptInstall(); return; }
    setShowSteps(true);
  };

  const copy = async () => { try { await navigator.clipboard.writeText(APP_URL); setCopied(true); } catch { /* ignore */ } };

  return (
    <section className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3" aria-labelledby="install-card-title">
      <h2 id="install-card-title" className="font-display text-sm font-extrabold text-slate-900">Get the My RUNHTec app</h2>
      <p className="mt-0.5 text-xs text-slate-600">Free. No app store needed.</p>

      {d.inApp ? (
        <>
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            You opened this inside another app, which can’t install apps. Tap <b>⋯</b> or <b>⋮</b>, then <b>Open in {d.ios ? 'Safari' : 'Chrome'}</b>.
          </p>
        </>
      ) : d.android || canPromptInstall() ? (
        <>
          <button type="button" onClick={tapInstall} className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#003DA5] text-sm font-semibold text-white shadow-sm">
            <Download className="h-4 w-4" /> Install My RUNHTec
          </button>
          {(showSteps || !canPromptInstall()) && (
            <ol className="mt-2 space-y-1 text-xs text-slate-800">
              <li><b>1.</b> Tap the menu <b>⋮</b> at the top right of Chrome{d.android ? '' : ' (or the install icon in the address bar)'}.</li>
              <li><b>2.</b> Tap <b>Install app</b> or <b>Add to Home screen</b>, then <b>Install</b>.</li>
            </ol>
          )}
        </>
      ) : d.iosOther ? (
        <>
          <p className="mt-3 text-sm text-slate-800">On iPhone the app installs from <b>Safari</b>. Copy this link and open it there:</p>
          <button type="button" onClick={copy} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">
            <Copy className="h-4 w-4" /> {copied ? 'Link copied, paste it in Safari' : 'Copy link for Safari'}
          </button>
        </>
      ) : (
        <div className="mt-3">
          <ol className="space-y-2 text-sm text-slate-800">
            <li className="flex items-start gap-2"><b>1.</b><span>Tap the <b>Share</b> button <Share className="inline h-4 w-4 align-text-bottom text-[#007AFF]" /> at the <b>bottom</b> of Safari.</span></li>
            <li className="flex items-start gap-2"><b>2.</b><span>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
          </ol>
          <p className="mt-3 flex items-center gap-2 text-xs font-medium text-[#003DA5]"><ArrowDown className="h-4 w-4 animate-bounce" /> The Share button is at the bottom of the screen</p>
        </div>
      )}

      
    </section>
  );
}
