import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import AuthShell from '@/components/AuthShell';
import pb from '@/lib/pocketbaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await pb.collection('users').requestPasswordReset(email.trim());
    } catch (_) {
      // Do not reveal whether an account exists.
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthShell pageTitle="Reset password">
      {sent ? (
        <div>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
            <MailCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
            Check your inbox
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email}</span>,
            we have sent instructions to reset the password. The link expires shortly for security.
          </p>
          <Button asChild variant="outline" className="mt-8 w-full">
            <Link to="/login">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
              Forgot your password?
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your account email and we will send you a secure reset link.
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@runhteccontractors.com"
              />
            </div>
            <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
            </Button>
          </form>
          <Link
            to="/login"
            className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </>
      )}
    </AuthShell>
  );
}
