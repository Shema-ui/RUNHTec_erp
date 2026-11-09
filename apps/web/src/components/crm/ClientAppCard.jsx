import React, { useEffect, useState } from 'react';
import { Smartphone, KeyRound, Star, Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

const MANAGE = ['super_admin', 'admin', 'sales', 'project_manager'];
const when = (d) => (d ? new Date(String(d).replace(' ', 'T') + (String(d).includes('Z') ? '' : 'Z')).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// On the client profile: who uses the client app (phone + PIN), PIN reset, and their ratings.
export default function ClientAppCard({ client }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logins, setLogins] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [busy, setBusy] = useState('');
  const can = MANAGE.includes(user?.role);
  const load = () => {
    pb.get(`/api/client/logins?client=${encodeURIComponent(client.id)}`).then(setLogins).catch(() => setLogins([]));
    pb.get(`/api/client/ratings?client=${encodeURIComponent(client.id)}`).then(setRatings).catch(() => setRatings([]));
  };
  useEffect(() => { if (can) load(); }, [client.id]);
  if (!can) return null;

  const reset = async (l) => {
    if (!window.confirm(`Reset the app PIN for ${l.name || 'this person'} (+${l.phone})? They’ll be signed out and must set a new PIN from their private link.`)) return;
    setBusy(l.id);
    try { await pb.post('/api/client/pin-reset', { user: l.id }); toast({ title: 'PIN reset', description: 'Send them their private link so they can choose a new PIN.' }); load(); }
    catch (e) { toast({ title: 'Could not reset', description: e.message, variant: 'destructive' }); }
    finally { setBusy(''); }
  };
  const withPhone = (logins || []).filter((l) => l.phone);
  const avg = ratings.length ? (ratings.reduce((s, r) => s + Number(r.rating), 0) / ratings.length).toFixed(1) : null;

  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Smartphone className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-bold">Client app</h4>
          <p className="text-xs text-muted-foreground">People who sign in to the RUNHTec app with their phone number and PIN.</p>
          {logins === null ? <Loader2 className="mt-3 h-4 w-4 animate-spin text-muted-foreground" /> : withPhone.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nobody yet. When they open the private link (above) they’re asked to choose a PIN for the app.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {withPhone.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{l.name || 'Client'}</span> <span className="text-muted-foreground">+{l.phone}</span>
                    <span className="block text-xs text-muted-foreground">{l.has_pin ? 'PIN set' : 'No PIN (reset)'}{l.signup_source === 'app' ? ' · signed up in the app' : ''}{l.portal_last_used ? ` · last used ${when(l.portal_last_used)}` : ''}</span>
                  </span>
                  {l.has_pin && <button type="button" onClick={() => reset(l)} disabled={busy === l.id} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary">{busy === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} Reset PIN</button>}
                </li>
              ))}
            </ul>
          )}
          {ratings.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {avg} average from {ratings.length} rating{ratings.length === 1 ? '' : 's'}</p>
              <ul className="mt-2 space-y-2">
                {ratings.slice(0, 5).map((r) => (
                  <li key={r.id} className="text-sm">
                    <span className="text-amber-500">{'★'.repeat(r.rating)}<span className="text-slate-300">{'★'.repeat(5 - r.rating)}</span></span> <span className="font-medium">{r.target_title}</span> <span className="text-xs text-muted-foreground">{when(r.created)}</span>
                    {r.comment && <p className="text-muted-foreground">“{r.comment}”</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
