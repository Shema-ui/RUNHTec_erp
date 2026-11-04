import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Copy, RefreshCw, Power, Eye, Loader2, Check, KeyRound } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppIcon } from '@/pages/portal/ClientLayout';

const MANAGE = ['super_admin', 'admin', 'sales', 'project_manager'];
const when = (d) => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// On the client profile: create, copy, replace or turn off the client's private portal link.
export default function ClientPortalCard({ client }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [info, setInfo] = useState(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const canManage = MANAGE.includes(user?.role);

  const load = () => pb.get(`/api/portal/access?client=${encodeURIComponent(client.id)}`).then(setInfo).catch(() => setInfo({ exists: false, active: false }));
  useEffect(() => { if (canManage) load(); }, [client.id]);
  if (!canManage) return null;

  const create = async () => {
    if (info?.active && !window.confirm('Make a new link? The old link will stop working straight away.')) return;
    setBusy(true);
    try {
      const r = await pb.post('/api/portal/access', { client: client.id });
      setLink(`${window.location.origin}/p/${r.token}`);
      load();
      toast({ title: 'Portal link ready', description: 'Copy it or send it by WhatsApp now. For safety it is only shown once.' });
    } catch (e) { toast({ title: 'Could not create the link', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    if (!window.confirm(`Turn off portal access for ${client.company_name}? The link stops working at once. You can make a new one later.`)) return;
    setBusy(true);
    try { await pb.post('/api/portal/access/disable', { client: client.id }); setLink(''); load(); toast({ title: 'Portal access turned off' }); }
    catch (e) { toast({ title: 'Could not turn off', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (_) { window.prompt('Copy this link:', link); }
  };
  const shareText = `Hello, this is RUNHTec Contractors. You can follow your project, see site photos, invoices and message our team here: ${link}\nJust open the link and type your name. Please keep it private.`;

  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Globe className="h-5 w-5" /></span>
          <div>
            <h4 className="font-display text-sm font-bold">Client portal</h4>
            <p className="text-xs text-muted-foreground">A private link where the client follows progress, sees the photos you share, invoices and messages. They only type their name, no password.</p>
            {info && (
              <p className="mt-1 text-xs">
                {info.active
                  ? <span className="font-medium text-emerald-700">● Access on{info.link_at ? ` · link made ${when(info.link_at)}` : ''}{info.last_used ? ` · last opened ${when(info.last_used)}${info.last_name ? ` by ${info.last_name}` : ''}` : ' · not opened yet'}</span>
                  : <span className="text-muted-foreground">○ No active link</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/portal?as=${client.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"><Eye className="h-3.5 w-3.5" /> Preview portal</Link>
          <button onClick={create} disabled={busy || !info} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : info?.active ? <RefreshCw className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
            {info?.active ? 'Make a new link' : 'Create portal link'}
          </button>
          {info?.active && <button onClick={disable} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"><Power className="h-3.5 w-3.5" /> Turn off</button>}
        </div>
      </div>

      {link && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-2 text-xs font-semibold text-emerald-800">New link (shown only now, send it to the client):</p>
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={link} aria-label="Portal link" onFocus={(e) => e.target.select()} className="h-9 min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-2 font-mono text-xs" />
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium">{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white"><WhatsAppIcon className="h-3.5 w-3.5" /> Send by WhatsApp</a>
          </div>
        </div>
      )}
    </div>
  );
}
