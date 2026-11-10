import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, AlertCircle, ArrowRight, Phone, HelpCircle } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import ClientAuthShell, { PhoneField } from '@/components/ClientAuthShell';

// The public sign-in page: clients only, with their phone number and PIN.
// (Staff sign in through their private staff link, /staff/<key>.)
const HELP_PHONE = '+250793229790';
const HELP_PHONE_LABEL = '+250 793 229 790';

export default function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(() => { try { return localStorage.getItem('runhtec-client-phone') || ''; } catch { return ''; } });
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => { if (!loading) { setSlow(false); return undefined; } const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, [loading]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4,6}$/.test(pin)) { setError('Your PIN is 4 to 6 digits.'); return; }
    setLoading(true);
    try {
      const res = await pb.post('/api/client/login', { phone, pin });
      try { localStorage.setItem('runhtec-client-phone', phone); } catch { /* ignore */ }
      pb.authStore.save(res.token, res.record);
      navigate('/portal', { replace: true });
    } catch (err) { setError(err.message || 'Could not sign in. Please try again.'); setLoading(false); }
  };

  return (
    <ClientAuthShell pageTitle="Sign in">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">Welcome back 👋</h1>
      <p className="mt-1 text-[15px] text-slate-600">Sign in with your phone number and PIN.</p>

      {error && <div className="mt-5 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
      {slow && <div className="mt-5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900">Waking the system up. The first sign-in of the day can take up to a minute, please wait.</div>}

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-slate-800">Phone number</label>
          <PhoneField id="phone" value={phone} onChange={setPhone} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="pin" className="text-sm font-semibold text-slate-800">PIN</label>
            <button type="button" onClick={() => setHelp((h) => !h)} className="text-sm font-semibold text-[#003DA5]">Forgot PIN?</button>
          </div>
          <div className="relative">
            <input id="pin" type={show ? 'text' : 'password'} inputMode="numeric" autoComplete="current-password" required maxLength={6} value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="4–6 digits"
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-lg tracking-[0.35em] text-slate-900 outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#003DA5] focus:ring-2 focus:ring-[#003DA5]/20" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide PIN' : 'Show PIN'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
          </div>
        </div>
        {help && (
          <div className="rounded-xl bg-blue-50 p-4 text-sm text-slate-700">
            <p className="flex items-center gap-2 font-semibold text-slate-900"><HelpCircle className="h-4 w-4 text-[#003DA5]" /> Forgot your PIN?</p>
            <p className="mt-1">No problem. Call or WhatsApp us and we’ll reset it. Then open the private link we send you to choose a new PIN.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={`tel:${HELP_PHONE}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 font-semibold text-slate-800"><Phone className="h-4 w-4" /> Call</a>
              <a href={`https://wa.me/${HELP_PHONE.replace('+', '')}?text=${encodeURIComponent('Hello RUNHTec, I forgot my My RUNHTec PIN. My phone number is ')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center rounded-lg bg-[#25D366] py-2 font-semibold text-white">WhatsApp</a>
            </div>
            <p className="mt-2 text-xs text-slate-500">{HELP_PHONE_LABEL}</p>
          </div>
        )}
        <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#003DA5] text-base font-semibold text-white shadow-sm transition hover:bg-[#00337f] disabled:opacity-60">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Sign in <ArrowRight className="h-5 w-5" /></>}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />New to RUNHTec?<span className="h-px flex-1 bg-slate-200" /></div>
      <Link to="/join" className="flex h-12 w-full items-center justify-center rounded-xl border-2 border-[#003DA5] text-base font-semibold text-[#003DA5] transition hover:bg-blue-50">Create my free account</Link>
    </ClientAuthShell>
  );
}
