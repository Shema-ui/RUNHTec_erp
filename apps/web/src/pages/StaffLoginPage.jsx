import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Loader2, Eye, EyeOff, AlertCircle, ShieldAlert } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import AuthShell from '@/components/AuthShell';
import { useAuth } from '@/context/AuthContext';
import { rememberStaffLink, forgetStaffLink } from '@/lib/staffLink';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

// Staff sign-in, only through the private link the administrator gives each
// staff member (/staff/<key>). The public sign-in page is for clients.
export default function StaffLoginPage() {
  const { key } = useParams();
  const { login, rememberedEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [valid, setValid] = useState(null); // null = checking
  const [email, setEmail] = useState(rememberedEmail());
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(Boolean(rememberedEmail()));
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (!loading && valid !== null) { setSlow(false); return undefined; } const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, [loading, valid]);

  useEffect(() => {
    pb.get(`/api/staff-link/check?key=${encodeURIComponent(key || '')}`)
      .then(() => setValid(true))
      .catch(() => { setValid(false); forgetStaffLink(); });
  }, [key]);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const auth = await login(email.trim(), password, remember, key);
      rememberStaffLink(key);
      navigate(auth?.record?.role === 'vendor' ? '/vendor' : (location.state?.from?.pathname || '/dashboard'), { replace: true });
    } catch (err) {
      setError(err?.status === 400 ? 'Wrong email or password. Please try again.' : err?.status === 404 ? 'This staff link is no longer valid. Ask the administrator for the new one.' : err?.status === 429 ? err.message : 'Unable to sign in right now. Please try again shortly.');
      setLoading(false);
    }
  };

  return (
    <AuthShell pageTitle="Staff sign in">
      {valid === null ? (
        <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          {slow ? 'Waking the system up, this can take up to a minute…' : 'Checking your link…'}
        </div>
      ) : valid === false ? (
        <div className="py-6 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-3 font-display text-xl font-extrabold">This link is not valid</h1>
          <p className="mt-2 text-sm text-muted-foreground">It may have been replaced. Ask your administrator for the current staff sign-in link.</p>
          <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-primary">Are you a client? Sign in here</Link>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">Staff sign in</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">RUNHTec Business Portal. Use the email and password your administrator gave you.</p>
          </div>
          {slow && <div className="mb-5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">The system is waking up after a quiet period. This can take up to a minute. Please wait.</div>}
          {error && <div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@runhteccontractors.si" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pr-10" />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
              Remember me on this device
            </label>
            <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}</Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">Keep this link private. It is only for RUNHTec staff.</p>
        </>
      )}
    </AuthShell>
  );
}
