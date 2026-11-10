import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Check, Eye, EyeOff, ArrowRight } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import ClientAuthShell, { PhoneField } from '@/components/ClientAuthShell';
import { Modal } from '@/components/erp/kit';
import { TermsContent } from '@/pages/TermsPage';

// Public sign-up for My RUNHTec. Creates the client (as a lead in the CRM),
// records that they accepted the terms, and signs them straight in.
const inp = 'h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#003DA5] focus:ring-2 focus:ring-[#003DA5]/20';
const WEAK = new Set(['0000', '1111', '1234', '12345', '123456', '000000', '111111', '4321', '2222', '9999']);

function Rule({ ok, children }) {
  return <li className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-700' : 'text-slate-500'}`}><span className={`flex h-4 w-4 items-center justify-center rounded-full ${ok ? 'bg-emerald-500 text-white' : 'bg-slate-200'}`}>{ok && <Check className="h-3 w-3" strokeWidth={3} />}</span>{children}</li>;
}

export default function JoinPage() {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', company: '', phone: '', email: '', location: '', pin: '', pin2: '', website: '' });
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (!loading) { setSlow(false); return undefined; } const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, [loading]);
  const set = (k) => (e) => { const v = typeof e === 'string' ? e : e.target.value; setF((p) => ({ ...p, [k]: k.startsWith('pin') ? v.replace(/\D/g, '') : v })); };

  const pinLen = /^\d{4,6}$/.test(f.pin);
  const pinStrong = pinLen && !WEAK.has(f.pin);
  const pinMatch = pinLen && f.pin === f.pin2;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.name.trim().length < 2) { setError('Please enter your full name.'); return; }
    if (!pinStrong) { setError(pinLen ? 'That PIN is too easy to guess. Please choose another.' : 'Choose a PIN of 4 to 6 digits.'); return; }
    if (!pinMatch) { setError('The two PINs are not the same.'); return; }
    if (!agree) { setError('Please accept the Terms of Use and Privacy Notice to continue.'); return; }
    setLoading(true);
    try {
      const res = await pb.post('/api/client/signup', { name: f.name, company: f.company, phone: f.phone, email: f.email, location: f.location, pin: f.pin, website: f.website, accept_terms: true });
      if (res?.token) {
        try { localStorage.setItem('runhtec-client-phone', f.phone); } catch { /* ignore */ }
        pb.authStore.save(res.token, res.record);
        navigate('/portal', { replace: true });
      } else setLoading(false);
    } catch (err) { setError(err.message || 'Could not create your account.'); setLoading(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  return (
    <ClientAuthShell pageTitle="Create your account">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1 text-[15px] text-slate-600">Free, and it takes less than a minute.</p>

      {error && <div className="mt-5 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
      {slow && <div className="mt-5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900">Waking the system up. This can take up to a minute, please wait.</div>}

      <form onSubmit={submit} className="mt-6 space-y-6">
        <fieldset className="space-y-4">
          <legend className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#003DA5] text-[11px] text-white">1</span> About you</legend>
          <div><label htmlFor="j-name" className="mb-1.5 block text-sm font-semibold text-slate-800">Full name</label><input id="j-name" className={inp} autoComplete="name" required value={f.name} onChange={set('name')} placeholder="e.g. Aline Uwase" /></div>
          <div><label htmlFor="j-company" className="mb-1.5 block text-sm font-semibold text-slate-800">Company <span className="font-normal text-slate-500">(leave empty for a home)</span></label><input id="j-company" className={inp} autoComplete="organization" value={f.company} onChange={set('company')} placeholder="e.g. Kivu Lodge Ltd" /></div>
          <div><label htmlFor="j-loc" className="mb-1.5 block text-sm font-semibold text-slate-800">Area</label><input id="j-loc" className={inp} value={f.location} onChange={set('location')} placeholder="e.g. Kicukiro, Kigali" /></div>
          <div><label htmlFor="j-email" className="mb-1.5 block text-sm font-semibold text-slate-800">Email <span className="font-normal text-slate-500">(optional)</span></label><input id="j-email" type="email" className={inp} autoComplete="email" value={f.email} onChange={set('email')} placeholder="you@example.com" /></div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#003DA5] text-[11px] text-white">2</span> How you’ll sign in</legend>
          <div><label htmlFor="j-phone" className="mb-1.5 block text-sm font-semibold text-slate-800">Phone number</label><PhoneField id="j-phone" value={f.phone} onChange={set('phone')} /><p className="mt-1.5 text-xs text-slate-500">We’ll also use it to call you about your requests.</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="j-pin" className="mb-1.5 block text-sm font-semibold text-slate-800">Choose a PIN</label><input id="j-pin" type={showPin ? 'text' : 'password'} inputMode="numeric" autoComplete="new-password" required maxLength={6} value={f.pin} onChange={set('pin')} placeholder="4–6 digits" className={`${inp} tracking-[0.3em] placeholder:tracking-normal`} /></div>
            <div><label htmlFor="j-pin2" className="mb-1.5 block text-sm font-semibold text-slate-800">Repeat PIN</label><input id="j-pin2" type={showPin ? 'text' : 'password'} inputMode="numeric" autoComplete="new-password" required maxLength={6} value={f.pin2} onChange={set('pin2')} className={`${inp} tracking-[0.3em]`} /></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ul className="space-y-1">
              <Rule ok={pinLen}>4 to 6 digits</Rule>
              <Rule ok={pinStrong}>Not easy to guess (not 1234)</Rule>
              <Rule ok={pinMatch}>Both PINs match</Rule>
            </ul>
            <button type="button" onClick={() => setShowPin((s) => !s)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#003DA5]">{showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{showPin ? 'Hide' : 'Show'} PIN</button>
          </div>
        </fieldset>

        {/* Hidden from people; bots fill it in and are ignored. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden="true" />

        <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed transition ${agree ? 'border-[#003DA5] bg-blue-50/60' : 'border-slate-300'}`}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#003DA5]" />
          <span className="text-slate-700">I agree to the <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="font-semibold text-[#003DA5] underline underline-offset-2">Terms of Use and Privacy Notice</button>, and to RUNHTec using my details to provide its services.</span>
        </label>

        <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#003DA5] text-base font-semibold text-white shadow-sm transition hover:bg-[#00337f] disabled:opacity-60">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Create my account <ArrowRight className="h-5 w-5" /></>}
        </button>
        <p className="text-center text-sm text-slate-600">Already have an account? <Link to="/login" className="font-semibold text-[#003DA5]">Sign in</Link></p>
      </form>

      <Modal open={showTerms} onClose={() => setShowTerms(false)} wide title="Terms of Use & Privacy Notice">
        <TermsContent />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setShowTerms(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Close</button>
          <button type="button" onClick={() => { setAgree(true); setShowTerms(false); }} className="rounded-lg bg-[#003DA5] px-4 py-2 text-sm font-semibold text-white">I agree</button>
        </div>
      </Modal>
    </ClientAuthShell>
  );
}
