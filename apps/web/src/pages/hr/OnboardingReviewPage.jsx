// HR and project managers review signed staff agreements, then HR marks the registration complete.
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import HrTabs from '@/pages/hr/HrTabs';

const card = 'rounded-2xl border border-border bg-card p-4 shadow-sm';
const btn = 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50';
const STATUS = {
  none: 'Not issued yet',
  issued: 'Waiting for signature',
  signed: 'Signed — needs review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
};

export default function OnboardingReviewPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canComplete = ['super_admin', 'admin', 'hr'].includes(user?.role);
  const [items, setItems] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => pb.onboarding.queue().then((r) => setItems(r.items || [])).catch((e) => { setItems([]); toast({ title: 'Could not load', description: e.message, variant: 'destructive' }); });
  useEffect(() => { load(); }, []);

  const open = async (id) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id); setNotes('');
    if (!detail[id]) {
      try { const c = await pb.onboarding.contract(id); setDetail((d) => ({ ...d, [id]: c })); }
      catch (_) { setDetail((d) => ({ ...d, [id]: { missing: true } })); }
    }
  };

  const act = async (fn, okTitle) => {
    setBusy(true);
    try { await fn(); toast({ title: okTitle }); setDetail({}); await load(); }
    catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Helmet><title>Staff onboarding — RUNHTec</title></Helmet>
      <HrTabs />
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Staff onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review signed agreements. When the agreement is approved and the profile is complete, HR confirms the registration so the person’s projects open.</p>
      </div>

      {items === null && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
      {items && items.length === 0 && <div className={card}><p className="text-sm text-muted-foreground">Nobody is waiting for registration right now.</p></div>}

      <div className="space-y-3">
        {(items || []).map((it) => {
          const status = it.contract?.status || 'none';
          const d = detail[it.id];
          const expanded = openId === it.id;
          return (
            <div key={it.id} className={card}>
              <button type="button" onClick={() => open(it.id)} className="flex w-full items-center justify-between gap-3 text-left">
                <div>
                  <p className="font-semibold text-foreground">{it.name || it.email}</p>
                  <p className="text-xs text-muted-foreground">{[it.email, it.phone].filter(Boolean).join(' · ')}</p>
                  <p className="mt-1 text-xs">
                    <span className={it.profile_completed ? 'text-emerald-700' : 'text-amber-700'}>Profile: {it.profile_completed ? 'complete' : 'not complete'}</span>
                    <span className="text-muted-foreground"> · Agreement: {STATUS[status] || status}</span>
                  </p>
                </div>
                {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
              </button>

              {expanded && (
                <div className="mt-4 space-y-4 border-t border-border pt-4">
                  {!d && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                  {d?.missing && <p className="text-sm text-muted-foreground">The agreement has not been issued yet. It is created when the profile is complete.</p>}
                  {d && !d.missing && (
                    <>
                      <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background p-3 text-xs leading-relaxed whitespace-pre-wrap">{d.body}</div>
                      {d.signature && (
                        <div className="rounded-lg border border-border bg-white p-3">
                          <p className="mb-2 text-xs text-muted-foreground">Signed as <strong className="text-foreground">{d.signed_name}</strong> on {d.signed_at ? new Date(d.signed_at).toLocaleString('en-GB') : '—'}</p>
                          <img src={d.signature} alt="Signature" className="h-24 w-auto" />
                          <p className="mt-2 break-all text-[10px] text-muted-foreground">Record fingerprint: {d.document_hash}</p>
                        </div>
                      )}
                      {d.review_notes && <p className="text-xs text-muted-foreground">Last review note: {d.review_notes}</p>}

                      {d.status === 'signed' && (
                        <div className="space-y-2">
                          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes (required if you ask for changes)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                          <div className="flex flex-wrap gap-2">
                            <button disabled={busy} onClick={() => act(() => pb.onboarding.review({ user: it.id, decision: 'approve', notes }), 'Agreement approved')} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>Approve agreement</button>
                            <button disabled={busy} onClick={() => act(() => pb.onboarding.review({ user: it.id, decision: 'changes', notes }), 'Changes requested')} className={`${btn} border border-border bg-background hover:bg-secondary`}>Ask for changes</button>
                          </div>
                        </div>
                      )}

                      {d.status === 'approved' && canComplete && it.profile_completed === 1 && (
                        <button disabled={busy} onClick={() => act(() => pb.onboarding.complete(it.id), 'Registration completed')} className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}>
                          <CheckCircle2 className="h-4 w-4" /> Mark registration complete
                        </button>
                      )}
                      {d.status === 'approved' && !canComplete && <p className="text-xs text-muted-foreground">HR confirms the registration.</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
