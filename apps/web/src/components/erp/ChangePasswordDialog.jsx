import React, { useEffect, useState } from 'react';
import { Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Modal, Field, inputCls, btnPrimary, btnLine } from '@/components/erp/kit';

// Change your own password. Signs out every other device; this one stays signed in.
export default function ChangePasswordDialog({ open, onClose }) {
  const { toast } = useToast();
  const [f, setF] = useState({ current: '', password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setF({ current: '', password: '', confirm: '' }); setErr(''); setShow(false); } }, [open]);

  const save = async () => {
    if (!f.current) { setErr('Enter your current password.'); return; }
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) { setErr('Use at least 8 characters, with letters and numbers.'); return; }
    if (f.password !== f.confirm) { setErr('The two new passwords are not the same.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await pb.post('/api/me/password', { current: f.current, password: f.password });
      pb.authStore.save(r.token, r.record);
      toast({ title: 'Password changed', description: 'Your old password no longer works, and any other phone or computer signed in with it has been signed out.' });
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const box = (k, label, ac) => (
    <Field label={label}>
      <input type={show ? 'text' : 'password'} autoComplete={ac} className={inputCls} value={f[k]} aria-label={label}
        onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && save()} />
    </Field>
  );
  return (
    <Modal open={open} onClose={onClose} title="Change your password" description="After this, only the new password works. Other devices signed in to your account are signed out.">
      <div className="space-y-4">
        {box('current', 'Current password', 'current-password')}
        {box('password', 'New password', 'new-password')}
        {box('confirm', 'Type the new password again', 'new-password')}
        <button type="button" onClick={() => setShow((s) => !s)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {show ? 'Hide passwords' : 'Show passwords'}
        </button>
        <p className="text-xs text-muted-foreground">At least 8 characters, with letters and numbers. A longer phrase is safer, e.g. “Kigali-Solar-2026!”.</p>
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Change password</button>
        </div>
      </div>
    </Modal>
  );
}
