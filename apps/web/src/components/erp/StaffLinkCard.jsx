import React, { useEffect, useState } from 'react';
import { Link2, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';

// User Management (Super Admin): the private link staff use to sign in.
// The public sign-in page is for clients only.
export default function StaffLinkCard() {
  const { toast } = useToast();
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { pb.get('/api/staff-link').then((r) => setLink(r.link)).catch(() => setLink('')); }, []);
  if (!link) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Copy this link:', link); } };
  const rotate = async () => {
    if (!window.confirm('Make a new staff sign-in link? The current link stops working at once, so you must send the new one to every staff member. People already signed in stay signed in.')) return;
    setBusy(true);
    try { const r = await pb.post('/api/staff-link/rotate'); setLink(r.link); toast({ title: 'New staff link ready', description: 'Send it to your staff with their email and password.' }); }
    catch (e) { toast({ title: 'Could not change the link', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Link2 className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-bold">Staff sign-in link</h4>
          <p className="text-xs text-muted-foreground">Staff can only sign in through this private link. Send it to each new staff member together with their email and password. The public sign-in page is for clients only.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 max-w-full flex-1 truncate rounded-lg bg-secondary px-3 py-2 text-xs">{link}</code>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary">{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}</button>
            <button type="button" onClick={rotate} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} New link</button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Lost it? It’s also shown in Render → your API service → Logs, on the line starting with “[staff-link]”.</p>
        </div>
      </div>
    </div>
  );
}
