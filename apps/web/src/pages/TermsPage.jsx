import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// My RUNHTec — Terms of Use & Privacy Notice. Plain language on purpose.
// When you change the meaning of anything here, also change TERMS_VERSION in
// apps/server/src/routes/clientApp.js so you know who accepted which version.
export const TERMS_DATE = '10 November 2026';
const CONTACT_PHONE = '+250 793 229 790';
const CONTACT_SITE = 'runhteccontractors.si';

const SECTIONS = [
  ['Who we are', [
    'My RUNHTec is the client app of RUNHTec Contractors Ltd, Kigali, Rwanda (“RUNHTec”, “we”). You can reach us on ' + CONTACT_PHONE + ' or through ' + CONTACT_SITE + '.',
  ]],
  ['Using My RUNHTec', [
    'Your account is for you or your business. Keep your PIN secret; anyone with your phone number and PIN can act on your account.',
    'Give correct information, especially your phone number and the location of the site.',
    'A request sent in the app is not a confirmed booking until we schedule it and you see the visit date in the app.',
    'Prices are only agreed in a written quotation from RUNHTec. Nothing else in the app is a price offer.',
    'In an emergency (fire, smoke, sparks, flooding), switch off the power if it is safe and call us or the emergency services straight away. Do not rely on the app alone.',
    'Do not misuse the app: no false requests, no abusive messages, no attempts to access other people’s accounts.',
  ]],
  ['What information we collect', [
    'What you give us: your name, phone number, email (optional), company, area and site addresses.',
    'What you send us: descriptions of problems, photos, messages, ratings and comments.',
    'What we record while serving you: your requests, visits, quotations, invoices, payments, equipment and maintenance dates.',
    'Technical details: when you sign in, and a notification address for your phone if you turn on alerts. We do not track your location unless you choose to share it with a request.',
  ]],
  ['Why we use it', [
    'To provide our services: answer requests, schedule visits, send technicians, prepare quotations and invoices, and keep a history of the work done for you.',
    'To keep you informed: updates on your requests, reminders before services and invoice due dates.',
    'To send you news and offers from RUNHTec in the app. You can turn phone alerts off at any time.',
    'To keep accounts and records the law requires, and to protect our clients, staff and systems.',
  ]],
  ['Who sees it', [
    'Only RUNHTec staff and the technicians or contractors working on your job, and only what they need for that job.',
    'Companies that host and run our systems for us, under confidentiality. Some of these servers may be located outside Rwanda.',
    'Authorities, only when the law requires it.',
    'We never sell your information.',
  ]],
  ['How long we keep it', [
    'For as long as you have an account, and afterwards only as long as needed for our legal, tax and warranty obligations. Then we delete it or make it anonymous.',
  ]],
  ['Your rights', [
    'Under Rwanda’s law on the protection of personal data and privacy (Law Nº 058/2021), you can ask to see the information we hold about you, correct it, delete it, object to how we use it, or withdraw your consent.',
    'To do so, contact us on ' + CONTACT_PHONE + ' or by message in the app. You can also complain to the National Cyber Security Authority (NCSA).',
  ]],
  ['Security', [
    'Your PIN is stored in scrambled form that nobody can read, not even our staff. Connections to the app are encrypted, and staff only see what their job needs.',
  ]],
  ['Changes', [
    'If we change these terms, we will tell you in the app. Using the app after a change means you accept the new version.',
  ]],
];

export function TermsContent() {
  return (
    <div className="space-y-6 text-[15px] leading-relaxed text-slate-700">
      <p className="text-sm text-slate-500">Last updated {TERMS_DATE}</p>
      <p>These terms explain how you may use My RUNHTec and how we look after your information. Please read them; by creating an account you agree to them.</p>
      {SECTIONS.map(([title, items], i) => (
        <section key={title}>
          <h2 className="font-display text-base font-bold text-slate-900">{i + 1}. {title}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            {items.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function TermsPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[100dvh] bg-[#F3F5F9] px-4 py-8">
      <Helmet><title>Terms &amp; Privacy | My RUNHTec</title></Helmet>
      <div className="mx-auto max-w-2xl">
        <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/login'))} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600"><ArrowLeft className="h-4 w-4" /> Back</button>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 sm:p-10">
          <img src="/logo.png" alt="RUNHTec Contractors" className="h-12 w-auto" />
          <h1 className="mt-5 font-display text-2xl font-extrabold text-slate-900">Terms of Use &amp; Privacy Notice</h1>
          <div className="mt-6"><TermsContent /></div>
        </div>
        <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-[#003DA5]">Go to sign in</Link></p>
      </div>
    </div>
  );
}
