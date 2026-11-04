import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import BrandMark from '@/components/BrandMark';

const NAME_KEY = 'runhtec_portal_name';

// Opened from the private link RUNHTec sends a client. No password: the
// person only types their name (remembered on this device for next time).
export default function PortalEnterPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (!busy) { setSlow(false); return undefined; } const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, [busy]);

  const enter = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) { setError('Please enter your name.'); return; }
    setBusy(true); setError('');
    try {
      const res = await pb.post('/api/portal/enter', { token, name: name.trim() });
      try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* private mode */ }
      pb.authStore.save(res.token, res.record);
      navigate('/portal', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not open the portal.');
      setBusy(false);
    }
  };

  if (token === 'bye') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-[#003DA5] to-[#001f57] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
          <div className="mb-6 rounded-xl bg-[#003DA5] px-4 py-3"><BrandMark /></div>
          <h1 className="font-display text-xl font-bold">You have left your portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">To come back, open the private link RUNHTec sent you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-[#003DA5] to-[#001f57] px-4 py-10">
      <Helmet><title>Your project portal | RUNHTec Contractors</title><meta name="robots" content="noindex" /></Helmet>
      <form onSubmit={enter} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
        <div className="mb-6 rounded-xl bg-[#003DA5] px-4 py-3"><BrandMark /></div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">Welcome to your project portal</h1>
        <p className="mt-2 text-sm text-muted-foreground">Follow your project with RUNHTec Contractors: progress, site photos, documents, invoices, and a direct line to our team.</p>
        <label className="mt-6 block text-sm font-medium" htmlFor="portal-name">Your name</label>
        <input id="portal-name" autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aline Uwase"
          className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-primary/30" />
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {slow && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Waking the system up, this can take up to a minute the first time…</p>}
        <button type="submit" disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#003DA5] text-base font-semibold text-white disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Open my portal <ArrowRight className="h-5 w-5" /></>}
        </button>
        <p className="mt-4 text-center text-xs text-muted-foreground">Keep this link private, it gives access to your project.</p>
      </form>
    </div>
  );
}
