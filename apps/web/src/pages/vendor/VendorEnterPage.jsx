import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ArrowRight, Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import BrandMark from '@/components/BrandMark';

const NAME_KEY = 'runhtec_vendor_name';
const inputCls = 'mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-primary/30';

function Shell({ children }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-[#003DA5] to-[#001f57] px-4 py-10">
      <Helmet><title>Supplier portal | RUNHTec Contractors</title><meta name="robots" content="noindex" /></Helmet>
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
        <div className="mb-6 rounded-xl bg-[#003DA5] px-4 py-3"><BrandMark /></div>
        {children}
      </div>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, label }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <label className="mt-4 block text-sm font-medium" htmlFor={id}>{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} pr-12`} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 mt-[3px] -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-secondary">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
      </div>
    </>
  );
}

// Opened from the private link RUNHTec sends a vendor (supplier).
// First visit: the vendor chooses a password. Later visits: link + password.
export default function VendorEnterPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [link, setLink] = useState(null); // {vendor, password_set} | {error}
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (token === 'bye' || token === 'expired') return;
    const t = setTimeout(() => setSlow(true), 4000);
    pb.post('/api/vendor/link', { token }).then(setLink).catch((e) => setLink({ error: e.message })).finally(() => { clearTimeout(t); setSlow(false); });
    return () => clearTimeout(t);
  }, [token]);

  const setup = link && !link.password_set;
  const enter = async (e) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) { setError('Please enter your name.'); return; }
    if (setup) {
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) { setError('Choose a password of at least 8 characters, with letters and numbers.'); return; }
      if (password !== confirm) { setError('The two passwords are not the same.'); return; }
    } else if (!password) { setError('Enter your password.'); return; }
    setBusy(true);
    try {
      const res = await pb.post('/api/vendor/enter', { token, name: name.trim(), ...(setup ? { new_password: password } : { password }) });
      try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* private mode */ }
      pb.authStore.save(res.token, res.record);
      navigate('/vendor', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not open the supplier portal.');
      setPassword(''); setConfirm('');
      setBusy(false);
    }
  };

  if (token === 'bye' || token === 'expired') {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="font-display text-xl font-bold">{token === 'expired' ? 'You were signed out' : 'You have left the supplier portal'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{token === 'expired' ? 'For safety, the supplier portal signs you out after 12 hours. ' : ''}To come back, open the private link RUNHTec sent you and enter your password.</p>
        </div>
      </Shell>
    );
  }
  if (!link) {
    return (
      <Shell>
        <div className="flex flex-col items-center py-6 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#003DA5]" />
          {slow && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Waking the system up, this can take up to a minute the first time…</p>}
        </div>
      </Shell>
    );
  }
  if (link.error) {
    return (
      <Shell>
        <h1 className="font-display text-xl font-bold">This link does not work</h1>
        <p className="mt-2 text-sm text-muted-foreground">{link.error}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={enter}>
        <p className="text-sm font-semibold text-[#003DA5]">{link.vendor}</p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">{setup ? 'Welcome, set your password' : 'RUNHTec supplier portal'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {setup
            ? 'This is where you add the items you supply to RUNHTec Contractors and keep your prices up to date. First, choose a password. You will need it with this link every time.'
            : 'Enter your password to open your price list.'}
        </p>
        <label className="mt-6 block text-sm font-medium" htmlFor="vendor-name">Your name</label>
        <input id="vendor-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eric Mugabo" className={inputCls} />
        {/* Hidden username so phones and browsers can save the password for this link */}
        <input type="text" autoComplete="username" value={`runhtec-vendor-${link.vendor}`} readOnly hidden />
        <PasswordInput id="vendor-password" label={setup ? 'Choose a password' : 'Password'} value={password} onChange={setPassword} autoComplete={setup ? 'new-password' : 'current-password'} />
        {setup && (
          <>
            <p className="mt-1 text-xs text-muted-foreground">At least 8 characters, with letters and numbers.</p>
            <PasswordInput id="vendor-password2" label="Type it again" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          </>
        )}
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#003DA5] text-base font-semibold text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : setup ? <><ShieldCheck className="h-5 w-5" /> Save password and continue</> : <>Open my price list <ArrowRight className="h-5 w-5" /></>}
        </button>
        <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />{setup ? 'Keep the link and the password private.' : 'Forgot your password? Ask RUNHTec for a new link, then you choose a new password.'}</p>
      </form>
    </Shell>
  );
}
