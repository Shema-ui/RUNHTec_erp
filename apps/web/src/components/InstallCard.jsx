import React, { useEffect, useState } from 'react';
import { Download, Share, Copy, CheckCircle2, ArrowDown, X } from 'lucide-react';
import { isInstalled, canPromptInstall, promptInstall, onPwaChange } from '@/lib/pwa';

// A small "Download the app" button. Tapping it opens the install details
// (steps for the phone, the link, and a copy button). Phones only, and hidden
// once the app is installed.
const APP_URL = 'https://erp.runhteccontractors.si/app';
const APP_LINK_TEXT = 'erp.runhteccontractors.si/app';

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
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => onPwaChange(() => setTick((t) => t + 1)), []);

  // Only phones, and only until the app is installed.
  if (!d.phone || isInstalled()) return null;

  const copy = async () => { try { await navigator.clipboard.writeText(APP_URL); setCopied(true); } catch { /* ignore */ } };

  return (
    <div className="mb-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded="false"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-[#003DA5]"
        >
          <Download className="h-3.5 w-3.5" /> Download the app
        </button>
      ) : (
        <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4" aria-labelledby="install-card-title">
          <div className="flex items-start justify-between gap-2">
            <h2 id="install-card-title" className="font-display text-base font-extrabold text-slate-900">Get the My RUNHTec app</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="-m-1 rounded-full p-1 text-slate-500 hover:bg-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-0.5 text-sm text-slate-600">Free, no app store. It puts an icon on your phone.</p>

          <p className="mt-2 text-sm text-slate-800">
            Link: <a href={APP_URL} className="font-semibold text-[#003DA5] underline break-all">{APP_LINK_TEXT}</a>
          </p>

          {d.inApp ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              You opened this inside another app, which can’t install apps. Tap <b>⋯</b> or <b>⋮</b>, then <b>Open in {d.ios ? 'Safari' : 'Chrome'}</b>.
            </p>
          ) : d.android && canPromptInstall() ? (
            <button type="button" onClick={promptInstall} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#003DA5] text-sm font-semibold text-white shadow-sm">
              <Download className="h-4 w-4" /> Install My RUNHTec
            </button>
          ) : d.android ? (
            <ol className="mt-3 space-y-2 text-sm text-slate-800">
              <li><b>1.</b> Tap the menu <b>⋮</b> at the top right of Chrome.</li>
              <li><b>2.</b> Tap <b>Install app</b> or <b>Add to Home screen</b>, then <b>Install</b>.</li>
            </ol>
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

          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><CheckCircle2 className="h-3.5 w-3.5" /> Already installed? You’ll see the icon on your home screen.</p>
        </section>
      )}
    </div>
  );
}
