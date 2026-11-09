import React, { useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import AuthShell from '@/components/AuthShell';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const MODE_KEY = 'runhtec-login-mode';

// Clients sign in with their phone number and PIN (no email, no password).
function ClientSignIn() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(() => { try { return localStorage.getItem('runhtec-client-phone') || ''; } catch { return ''; } });
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await pb.post('/api/client/login', { phone, pin });
      try { localStorage.setItem('runhtec-client-phone', phone); } catch { /* ignore */ }
      pb.authStore.save(res.token, res.record);
      navigate('/portal', { replace: true });
    } catch (err) { setError(err.message || 'Could not sign in.'); setLoading(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="phone">Phone number</Label>
        <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0788 123 456" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pin">PIN</Label>
        <Input id="pin" type="password" inputMode="numeric" autoComplete="current-password" required maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" className="tracking-[0.4em]" />
      </div>
      <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">New to RUNHTec? <Link to="/join" className="font-semibold text-primary hover:underline">Create your account</Link></p>
      <p className="text-center text-xs text-muted-foreground">Forgot your PIN? Open the private link we sent you, or call RUNHTec to reset it.</p>
    </form>
  );
}

export default function LoginPage() {
  const [mode, setModeState] = useState(() => { try { return localStorage.getItem(MODE_KEY) || 'staff'; } catch { return 'staff'; } });
  const setMode = (m) => { setModeState(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ } };
  const { login, rememberedEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(rememberedEmail());
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(Boolean(rememberedEmail()));
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  // If the server is still waking up after a few seconds, say so (instead of looking frozen).
  useEffect(() => { if (!loading) { setSlow(false); return undefined; } const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, [loading]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const auth = await login(email.trim(), password, remember);
      const to = auth?.record?.role === 'client' ? '/portal' : auth?.record?.role === 'vendor' ? '/vendor' : (location.state?.from?.pathname || '/dashboard');
      navigate(to, { replace: true });
    } catch (err) {
      if (err?.status === 400) {
        setError('Invalid email or password. Please try again.');
      } else if (err?.status === 403) {
        setError('This account is suspended. Contact your administrator.');
      } else {
        setError('Unable to sign in right now. Please try again shortly.');
      }
      setLoading(false);
    }
  };

  return (
    <AuthShell pageTitle="Sign in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
          {mode === 'client' ? 'Welcome to RUNHTec' : 'Sign in to your portal'}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mode === 'client' ? 'Sign in with your phone number and PIN.' : 'Enter your credentials to access the workspace.'}
        </p>
      </div>
      <div className="mb-6 grid grid-cols-2 rounded-xl bg-secondary p-1" role="tablist" aria-label="Who is signing in">
        {[['client', 'I’m a client'], ['staff', 'RUNHTec staff']].map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{label}</button>
        ))}
      </div>
      {mode === 'client' ? <ClientSignIn /> : (<>

      {slow && (
        <div className="mb-5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          The system is waking up after a quiet period. This can take up to a minute the first time. Please wait, you don’t need to click again.
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@runhteccontractors.si"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
          Remember me on this device
        </label>

        <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
        </Button>
      </form>
      </>)}

      <p className="mt-6 text-center text-sm">
        <Link to="/app" className="font-semibold text-primary hover:underline">Install the RUNHTec app on your phone</Link>
      </p>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {mode === 'client' ? 'Your details stay private and are only used to serve you.' : 'Staff accounts are created by administrators only.'}
      </p>
    </AuthShell>
  );
}
