import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import AuthShell from '@/components/AuthShell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// Public sign-up for the client app. Creates a client (as a lead in the CRM)
// and signs them straight in. The team is notified.
export default function JoinPage() {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', company: '', phone: '', email: '', location: '', pin: '', pin2: '', website: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (!loading) { setSlow(false); return undefined; } const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, [loading]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: k.startsWith('pin') ? e.target.value.replace(/\D/g, '') : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4,6}$/.test(f.pin)) { setError('Choose a PIN of 4 to 6 digits.'); return; }
    if (f.pin !== f.pin2) { setError('The two PINs are not the same.'); return; }
    setLoading(true);
    try {
      const res = await pb.post('/api/client/signup', { name: f.name, company: f.company, phone: f.phone, email: f.email, location: f.location, pin: f.pin, website: f.website });
      if (res?.token) {
        try { localStorage.setItem('runhtec-client-phone', f.phone); localStorage.setItem('runhtec-login-mode', 'client'); } catch { /* ignore */ }
        pb.authStore.save(res.token, res.record);
        navigate('/portal', { replace: true });
      } else setLoading(false);
    } catch (err) { setError(err.message || 'Could not create your account.'); setLoading(false); }
  };

  return (
    <AuthShell pageTitle="Create your account">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">Create your My RUNHTec account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Request technicians, maintenance and quotations, chat with our team and follow your work, all from your phone.</p>
      </div>
      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}
      {slow && <div className="mb-5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">The system is waking up. This can take up to a minute the first time…</div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="j-name">Your full name</Label><Input id="j-name" autoComplete="name" required value={f.name} onChange={set('name')} placeholder="e.g. Aline Uwase" /></div>
        <div className="space-y-2"><Label htmlFor="j-company">Company (optional)</Label><Input id="j-company" autoComplete="organization" value={f.company} onChange={set('company')} placeholder="Leave empty for a home" /></div>
        <div className="space-y-2"><Label htmlFor="j-phone">Phone number</Label><Input id="j-phone" type="tel" inputMode="tel" autoComplete="tel" required value={f.phone} onChange={set('phone')} placeholder="0788 123 456" /><p className="text-xs text-muted-foreground">You’ll sign in with this number.</p></div>
        <div className="space-y-2"><Label htmlFor="j-email">Email (optional)</Label><Input id="j-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} /></div>
        <div className="space-y-2"><Label htmlFor="j-loc">Area / location</Label><Input id="j-loc" value={f.location} onChange={set('location')} placeholder="e.g. Kicukiro, Kigali" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label htmlFor="j-pin">Choose a PIN</Label><Input id="j-pin" type="password" inputMode="numeric" autoComplete="new-password" required maxLength={6} value={f.pin} onChange={set('pin')} placeholder="4–6 digits" className="tracking-[0.3em]" /></div>
          <div className="space-y-2"><Label htmlFor="j-pin2">Repeat PIN</Label><Input id="j-pin2" type="password" inputMode="numeric" autoComplete="new-password" required maxLength={6} value={f.pin2} onChange={set('pin2')} className="tracking-[0.3em]" /></div>
        </div>
        {/* Hidden from people; bots fill it in and are ignored. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden="true" />
        <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}</Button>
        <p className="text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" onClick={() => { try { localStorage.setItem('runhtec-login-mode', 'client'); } catch { /* ignore */ } }} className="font-semibold text-primary hover:underline">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
