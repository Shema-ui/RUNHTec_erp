import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Download, Share, PlusSquare, CheckCircle2, MoreVertical, Smartphone, Monitor, AlertTriangle, Copy } from 'lucide-react';
import { isInstalled, canPromptInstall, promptInstall, onPwaChange } from '@/lib/pwa';

// Public page behind the QR code: https://erp.runhteccontractors.si/app
// It works out which phone/browser the person has and shows only the steps that apply.
const APP_URL = 'https://erp.runhteccontractors.si/app';

function detect() {
  const ua = navigator.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  // Browsers inside other apps can't install anything.
  const inApp = /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|TikTok|musical_ly|LinkedInApp|GSA\//i.test(ua);
  const iosOther = ios && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return { ios, android, inApp, iosOther, desktop: !ios && !android };
}

const Step = ({ n, children }) => (
  <li className="flex gap-3">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#003DA5] text-sm font-bold text-white">{n}</span>
    <span className="pt-0.5 text-[15px] leading-relaxed text-slate-800">{children}</span>
  </li>
);

export default function InstallAppPage() {
  const [d] = useState(detect);
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => onPwaChange(() => setTick((t) => t + 1)), []);
  const installed = isInstalled();

  const copy = async () => { try { await navigator.clipboard.writeText(APP_URL); setCopied(true); } catch { /* ignore */ } };

  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-8">
      <Helmet><title>Get the RUNHTec app</title></Helmet>
      <div className="mx-auto max-w-md">
        <div className="flex flex-col items-center text-center">
          <img src="/icon-192.png" alt="RUNHTec" className="h-20 w-20 rounded-2xl border border-slate-200 bg-white shadow-sm" />
          <h1 className="mt-4 font-display text-2xl font-extrabold text-slate-900">Get the RUNHTec app</h1>
          <p className="mt-1 text-sm text-slate-600">Free. No app store needed. Installs in under a minute.</p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {installed ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-2 font-semibold text-slate-900">The app is installed.</p>
              <Link to="/dashboard" className="mt-4 inline-flex rounded-lg bg-[#003DA5] px-5 py-2.5 text-sm font-semibold text-white">Open RUNHTec</Link>
            </div>
          ) : d.inApp ? (
            <>
              <p className="flex items-center gap-2 font-semibold text-amber-700"><AlertTriangle className="h-5 w-5" /> Open this page in your phone’s browser</p>
              <p className="mt-2 text-sm text-slate-700">You opened the link inside another app (like WhatsApp or Facebook), which can’t install apps.</p>
              <ol className="mt-4 space-y-3">
                <Step n={1}>Tap the <b>⋯</b> or <b>⋮</b> menu at the top or bottom of this screen.</Step>
                <Step n={2}>Choose <b>{d.ios ? 'Open in Safari' : 'Open in Chrome'}</b> (or “Open in browser”).</Step>
                <Step n={3}>Follow the steps you see there.</Step>
              </ol>
              <button type="button" onClick={copy} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"><Copy className="h-4 w-4" />{copied ? 'Link copied' : 'Copy link'}</button>
            </>
          ) : d.ios ? (
            <>
              <p className="flex items-center gap-2 font-semibold text-slate-900"><Smartphone className="h-5 w-5 text-[#003DA5]" /> iPhone / iPad</p>
              {d.iosOther && (
                <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Works best in <b>Safari</b>. If you don’t see “Add to Home Screen”, copy this link and open it in Safari.</p>
              )}
              <ol className="mt-4 space-y-3">
                <Step n={1}>Tap the <b>Share</b> button <Share className="inline h-4 w-4 align-text-bottom text-[#007AFF]" /> {d.iosOther ? 'in the browser bar' : 'at the bottom of Safari (on iPad: top right)'}.<br /><span className="text-sm text-slate-500">Don’t see the bar? Scroll up a little, or tap the address at the bottom.</span></Step>
                <Step n={2}><b>Scroll down</b> the list that opens and tap <b>Add to Home Screen</b> <PlusSquare className="inline h-4 w-4 align-text-bottom" />.<br /><span className="text-sm text-slate-500">Not in the list? Tap <b>Edit Actions…</b> at the very bottom and add it.</span></Step>
                <Step n={3}>Make sure <b>Open as Web App</b> is on (if shown), then tap <b>Add</b>.</Step>
                <Step n={4}>Open <b>RUNHTec</b> from your home screen and sign in.</Step>
              </ol>
              {d.iosOther && <button type="button" onClick={copy} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"><Copy className="h-4 w-4" />{copied ? 'Link copied — paste it in Safari' : 'Copy link for Safari'}</button>}
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 font-semibold text-slate-900">{d.android ? <Smartphone className="h-5 w-5 text-[#003DA5]" /> : <Monitor className="h-5 w-5 text-[#003DA5]" />}{d.android ? 'Android' : 'Computer'}</p>
              {canPromptInstall() ? (
                <button type="button" onClick={promptInstall} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#003DA5] px-5 py-3 text-base font-semibold text-white"><Download className="h-5 w-5" /> Install RUNHTec</button>
              ) : (
                <ol className="mt-4 space-y-3">
                  <Step n={1}>Open this page in <b>Chrome</b>{d.desktop ? ' or Edge' : ''}.</Step>
                  <Step n={2}>{d.android
                    ? <>Tap the menu <MoreVertical className="inline h-4 w-4 align-text-bottom" /> (top right), then <b>Install app</b> or <b>Add to Home screen</b> → <b>Install</b>.</>
                    : <>Click the install icon at the right end of the address bar, or menu → <b>Install RUNHTec</b>.</>}</Step>
                  <Step n={3}>Open <b>RUNHTec</b> and sign in.</Step>
                </ol>
              )}
            </>
          )}
        </div>

        {d.desktop && !installed && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <p className="font-semibold text-slate-900">On your phone instead?</p>
            <p className="mt-1 text-sm text-slate-600">Scan this with your phone’s camera.</p>
            <img src="/app-qr.png" alt="QR code to get the RUNHTec app" className="mx-auto mt-3 h-44 w-44" style={{ imageRendering: 'pixelated' }} />
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="font-semibold text-slate-900">After installing</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li><b>Clients:</b> sign in with your phone number and PIN. New to RUNHTec? <Link to="/join" className="font-semibold text-[#003DA5]">Create your account</Link>.</li>
            <li>Turn on notifications: tap the phone icon at the top (clients) or your name → <b>App &amp; notifications</b> (staff).</li>
            <li>The app updates itself. You never need to reinstall it.</li>
          </ul>
        </div>

        <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-[#003DA5]">Continue in the browser instead</Link></p>
      </div>
    </div>
  );
}
