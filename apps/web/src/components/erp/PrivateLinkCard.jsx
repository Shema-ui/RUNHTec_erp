import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Copy, RefreshCw, Power, Eye, Loader2, Check, KeyRound } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';

const WA = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" /></svg>
);
const when = (d) => (d ? new Date(String(d).replace(' ', 'T') + (String(d).includes('Z') ? '' : 'Z')).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// Create / copy / replace / turn off a private no-password link (client portal, vendor portal).
// api: '/api/portal' or '/api/vendor'; field: 'client' or 'vendor'; path: '/p/' or '/v/'.
export default function PrivateLinkCard({ api, field, id, name, path, title, description, previewTo, shareText, icon: Icon = Globe, withPassword = false }) {
  const { toast } = useToast();
  const [info, setInfo] = useState(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => pb.get(`${api}/access?${field}=${encodeURIComponent(id)}`).then(setInfo).catch(() => setInfo({ exists: false, active: false }));
  useEffect(() => { load(); setLink(''); }, [id]);

  const create = async () => {
    if (info?.active && !window.confirm(withPassword ? 'Make a new link? The old link stops working straight away, and the password is cleared: the vendor chooses a new one when they open the new link.' : 'Make a new link? The old link will stop working straight away.')) return;
    setBusy(true);
    try {
      const r = await pb.post(`${api}/access`, { [field]: id });
      setLink(`${window.location.origin}${path}${r.token}`);
      load();
      toast({ title: 'Link ready', description: 'Copy it or send it by WhatsApp now. For safety it is only shown once.' });
    } catch (e) { toast({ title: 'Could not create the link', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    if (!window.confirm(`Turn off access for ${name}? The link stops working at once. You can make a new one later.`)) return;
    setBusy(true);
    try { await pb.post(`${api}/access/disable`, { [field]: id }); setLink(''); load(); toast({ title: 'Access turned off' }); }
    catch (e) { toast({ title: 'Could not turn off', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (_) { window.prompt('Copy this link:', link); }
  };

  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
          <div>
            <h4 className="font-display text-sm font-bold">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
            {info && (
              <p className="mt-1 text-xs">
                {info.active
                  ? <span className="font-medium text-emerald-700">● Access on{withPassword ? (info.password_set ? ' · password set 🔒' : ' · waiting for them to set a password') : ''}{info.link_at ? ` · link made ${when(info.link_at)}` : ''}{info.last_used ? ` · last opened ${when(info.last_used)}${info.last_name ? ` by ${info.last_name}` : ''}` : ' · not opened yet'}</span>
                  : <span className="text-muted-foreground">○ No active link</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {previewTo && <Link to={previewTo} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"><Eye className="h-3.5 w-3.5" /> Preview</Link>}
          <button onClick={create} disabled={busy || !info} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : info?.active ? <RefreshCw className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
            {info?.active ? 'Make a new link' : 'Create access link'}
          </button>
          {info?.active && <button onClick={disable} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"><Power className="h-3.5 w-3.5" /> Turn off</button>}
        </div>
      </div>

      {link && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-2 text-xs font-semibold text-emerald-800">New link (shown only now, send it to {name}):</p>
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={link} aria-label="Access link" onFocus={(e) => e.target.select()} className="h-9 min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-2 font-mono text-xs" />
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium">{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText(link))}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white"><WA /> Send by WhatsApp</a>
          </div>
        </div>
      )}
    </div>
  );
}
