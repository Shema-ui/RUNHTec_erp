import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Wrench, ClipboardCheck, MessageCircle, BellRing } from 'lucide-react';
import InstallCard from '@/components/InstallCard';
import { useState } from 'react';
import { COUNTRIES, flagOf } from '@/lib/countries';

// The frame around the client sign-in and sign-up pages (My RUNHTec).
// Phone: a blue band with the logo on top and the form card below.
// Computer: a blue panel on the left explaining the app, the form on the right.
const BENEFITS = [
  { icon: Wrench, t: 'Call a technician in seconds', d: 'Normal, urgent or emergency, with photos.' },
  { icon: ClipboardCheck, t: 'Follow every job', d: 'See the visit date and who is coming.' },
  { icon: MessageCircle, t: 'Talk to our team', d: 'Messages and quotations in one place.' },
  { icon: BellRing, t: 'Never miss a service', d: 'Reminders before every visit.' },
];

export default function ClientAuthShell({ pageTitle, children }) {
  return (
    <div className="min-h-[100dvh] bg-[#F3F5F9] lg:grid lg:grid-cols-[1fr_1fr]">
      <Helmet>
        <title>{pageTitle} | My RUNHTec</title>
        <meta name="description" content="My RUNHTec: request technicians, maintenance and quotations from RUNHTec Contractors, and follow your work from your phone." />
      </Helmet>

      {/* Computer: brand panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0B1B3D] via-[#0A2A6B] to-[#003DA5] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-96 w-96 rounded-full bg-[#E4141B]/10" />
        <div className="relative">
          <span className="inline-flex rounded-2xl bg-white p-3 shadow-lg"><img src="/logo.png" alt="RUNHTec Contractors" className="h-14 w-auto" /></span>
        </div>
        <div className="relative mt-auto max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">My RUNHTec</p>
          <h2 className="mt-3 font-display text-4xl font-extrabold leading-tight">Your technical services, one tap away.</h2>
          <ul className="mt-10 space-y-5">
            {BENEFITS.map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><Icon className="h-5 w-5" /></span>
                <span><span className="block font-semibold">{t}</span><span className="block text-sm text-blue-100/80">{d}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-blue-100/60">RUNHTec Contractors Ltd · Kigali, Rwanda</p>
      </aside>

      {/* Phone: blue band; both: the form card */}
      <main className="flex min-h-[100dvh] flex-col lg:min-h-0 lg:items-center lg:justify-center lg:p-10">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0B1B3D] to-[#003DA5] px-6 pb-16 pt-10 text-white lg:hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
          <span className="relative inline-flex rounded-2xl bg-white p-2.5 shadow-lg"><img src="/logo.png" alt="RUNHTec Contractors" className="h-11 w-auto" /></span>
          <p className="relative mt-5 font-display text-2xl font-extrabold">My RUNHTec</p>
          <p className="relative mt-1 text-sm text-blue-100">Your technical services, one tap away.</p>
        </div>
        <div className="relative z-10 -mt-10 flex flex-1 flex-col px-4 pb-8 lg:mt-0 lg:w-full lg:max-w-md lg:flex-none lg:px-0">
          <div className="rounded-3xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5 sm:p-8">
            <InstallCard />
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            <Link to="/terms" className="font-medium text-slate-600 underline-offset-2 hover:underline">Terms &amp; Privacy</Link>
            <span className="mx-2">·</span>
            <Link to="/app" className="font-medium text-slate-600 underline-offset-2 hover:underline">Install the app</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

// Phone number with a country choice (every country in the world). People pick
// their country and type the number the way they know it. Rwanda is the default.
// The value sent on is the full number, like +250788123456 or +447700900123.
// A saved full number (+250788…) is split back into country code and digits.
function split(full) {
  const v = String(full || '');
  if (!v.startsWith('+')) return { dial: '250', national: v };
  const digits = v.slice(1);
  const match = COUNTRIES.filter((c) => digits.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length)[0];
  return match ? { dial: match.dial, national: digits.slice(match.dial.length) } : { dial: '250', national: v };
}

export function PhoneField({ id, value, onChange, autoFocus }) {
  const [start] = useState(() => split(value));
  const [dial, setDial] = useState(start.dial);
  const [national, setNational] = useState(start.national);
  const emit = (code, num) => {
    const t = num.trim();
    if (t.startsWith('+')) return onChange(t); // typed the full number with its code
    const digits = t.replace(/\D/g, '').replace(/^0+/, ''); // 0788… → 788…
    onChange(digits ? `+${code}${digits}` : '');
  };
  const pick = (e) => { setDial(e.target.value); emit(e.target.value, national); };
  const type = (e) => { setNational(e.target.value); emit(dial, e.target.value); };
  const current = COUNTRIES.find((c) => c.dial === dial && c.iso === 'RW') || COUNTRIES.find((c) => c.dial === dial);
  return (
    <div className="flex h-12 overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-[#003DA5] focus-within:ring-2 focus-within:ring-[#003DA5]/20">
      <label className="relative flex shrink-0 items-center gap-1 border-r border-slate-200 bg-slate-50 pl-3 pr-2 text-sm font-semibold text-slate-700">
        <span aria-hidden="true">{flagOf(current?.iso || 'RW')} +{dial}</span>
        <span className="sr-only">Country</span>
        <select aria-label="Country code" value={dial} onChange={pick} className="absolute inset-0 cursor-pointer opacity-0">
          {COUNTRIES.map((c) => <option key={c.iso} value={c.dial}>{flagOf(c.iso)} {c.name} (+{c.dial})</option>)}
        </select>
      </label>
      <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" required autoFocus={autoFocus} value={national} onChange={type} placeholder="788 123 456"
        className="min-w-0 flex-1 bg-transparent px-3 text-base text-slate-900 outline-none placeholder:text-slate-400" />
    </div>
  );
}
