import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import AuthShell from '@/components/AuthShell';
import pb from '@/lib/pocketbaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await pb.collection('users').confirmPasswordReset(token, password, confirm);
      setDone(true);
    } catch (_) {
      setError('This reset link is invalid or has expired. Request a new one.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell pageTitle="Reset password">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Invalid reset link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link is missing its security token. Please request a new password reset.
        </p>
        <Button asChild className="mt-8 w-full">
          <Link to="/forgot-password">Request new link</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell pageTitle="Reset password">
      {done ? (
        <div>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">Password updated</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your password has been changed successfully. You can now sign in with your new password.
          </p>
          <Button className="mt-8 w-full" onClick={() => navigate('/login', { replace: true })}>
            Continue to sign in
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="font-display text-2xl font-extrabold text-foreground">Set a new password</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Choose a strong password to secure your account.
            </p>
          </div>
          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">New password</Label>
              <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpw">Confirm password</Label>
              <Input id="cpw" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" />
            </div>
            <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
            </Button>
          </form>
          <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </>
      )}
    </AuthShell>
  );
}
