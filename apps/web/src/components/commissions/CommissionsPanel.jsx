import React, { useEffect, useState } from 'react';
import { Coins, Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

const FINANCE = ['super_admin', 'admin', 'accountant'];
const money = (n) => `${Number(n || 0).toLocaleString('en-US')} RWF`;
const dayText = (v) => (v ? String(v).slice(0, 10) : '');
const STATUS = { pending: 'Not yet due (project open or not fully paid)', owed: 'Owed: ready for payout', paid: 'Paid in cash' };

// Staff see their own commission amount and status. Finance also sees profit and can mark payouts paid.
export default function CommissionsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isFinance = FINANCE.includes(user?.role);
  const [mine, setMine] = useState(null);
  const [all, setAll] = useState(null);
  const [busy, setBusy] = useState('');

  const load = () => {
    pb.get('/api/commissions/me').then((r) => setMine(r.commissions)).catch(() => setMine([]));
    if (isFinance) pb.get('/api/commissions/admin').then((r) => setAll(r.commissions)).catch(() => setAll([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isFinance]);

  const markPaid = async (id) => {
    setBusy(id);
    try {
      await pb.post(`/api/commissions/${id}/paid`);
      toast({ title: 'Marked as paid' });
      load();
    } catch (e) {
      toast({ title: 'Could not update', description: e.message, variant: 'destructive' });
    } finally { setBusy(''); }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Coins className="mt-0.5 h-5 w-5 text-[#881946]" />
        <div>
          <h3 className="font-semibold">Commissions</h3>
          <p className="text-xs text-muted-foreground">Your commission is paid in cash once the project is closed and the client has paid in full.</p>
        </div>
      </div>

      {mine === null ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : mine.length === 0 ? (
        <p className="text-sm text-muted-foreground">No commissions yet. They appear when a client you referred starts a project.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {mine.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{c.project_title || 'Project'}</span>
              <span className="text-right">
                <strong>{money(c.amount)}</strong>
                <span className="block text-xs text-muted-foreground">{STATUS[c.status] || c.status}{c.paid_at ? ` · ${dayText(c.paid_at)}` : ''}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {isFinance && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-sm font-semibold">Payouts (finance only)</p>
          {all === null ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : all.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="py-1">Staff</th><th>Project</th><th>Paid by client</th><th>Costs</th><th>Profit</th><th>Commission</th><th>Status</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {all.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2">{c.staff_name || c.staff_email}</td>
                      <td>{c.project_title}</td>
                      <td>{money(c.paid_total)}</td>
                      <td>{money(c.cost_total)}</td>
                      <td>{money(c.profit)}</td>
                      <td><strong>{money(c.amount)}</strong></td>
                      <td>{c.status}</td>
                      <td className="text-right">
                        {c.status === 'owed' && (
                          <button type="button" disabled={!!busy} onClick={() => markPaid(c.id)} className="rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-secondary">
                            {busy === c.id ? 'Saving…' : 'Mark paid'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
