import React, { useEffect, useState } from 'react';
import { CalendarCheck, Receipt, Pencil, Trash2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, btnPrimary, btnLine, fmtDate } from '@/components/erp/kit';
import { LogDayDialog, ExpenseDialog, EditCostDialog } from '@/components/erp/ProjectCostsCard';
import { formatMoney } from '@/lib/money';
import { labourRole, costCategoryLabel } from '@/lib/costing';

const n = (v) => Number(v) || 0;

// What the project's Lead Technician sees: log the crew's days and site
// expenses, and fix their own entries until the office has paid them.
// No prices, budget or profit here.
export default function SiteLogCard({ project, team }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const currency = project.currency || 'RWF';

  const load = () => pb.collection('project_costs').getFullList({ filter: `project = '${project.id}'`, sort: '-cost_date' })
    .then((list) => setEntries(list.filter((c) => c.recorded_by === user?.id))).catch(() => setEntries([]));
  useEffect(() => { load(); }, [project.id]);

  const days = (entries || []).filter((c) => c.category === 'labour').reduce((s, c) => s + n(c.quantity), 0);
  const remove = async (c) => {
    if (!window.confirm('Remove this entry?')) return;
    try { await pb.collection('project_costs').delete(c.id); load(); }
    catch (e) { toast({ title: 'Could not remove', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Card
      title="Site log"
      action={(
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} onClick={() => setDialog('day')}><CalendarCheck className="h-4 w-4" /> Log work day</button>
          <button className={btnLine} onClick={() => setDialog('expense')}><Receipt className="h-4 w-4" /> Add site expense</button>
        </div>
      )}
    >
      <p className="mb-3 text-sm text-muted-foreground">You lead this project. Each day on site, tick who came. Add fuel, transport or small materials you paid for. The office sees it straight away. You logged <strong className="text-foreground">{days} person-day{days === 1 ? '' : 's'}</strong> so far.</p>
      {!entries ? <p className="text-sm text-muted-foreground">Loading…</p> : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{c.category === 'labour' ? c.worker_name : (c.description || costCategoryLabel(c.category))}</span>
                <span className="block text-xs text-muted-foreground">
                  {fmtDate(c.cost_date)} · {c.category === 'labour' ? `${labourRole(c.worker_role).label} · ${n(c.quantity) === 0.5 ? 'half day' : `${n(c.quantity)} day${n(c.quantity) === 1 ? '' : 's'}`}` : `${costCategoryLabel(c.category)} · ${formatMoney(c.amount, currency)}`}
                  {Number(c.paid) ? ' · paid' : ''}
                </span>
              </span>
              {!Number(c.paid) && (
                <span className="flex gap-3">
                  <button onClick={() => setEditing(c)} aria-label="Edit entry" className="text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(c)} aria-label="Remove entry" className="text-muted-foreground hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <LogDayDialog open={dialog === 'day'} onClose={() => setDialog(null)} project={project} team={team} costs={entries || []} onSaved={load} />
      <ExpenseDialog open={dialog === 'expense'} onClose={() => setDialog(null)} project={project} onSaved={load} allowPaid={false} />
      <EditCostDialog cost={editing} onClose={() => setEditing(null)} currency={currency} onSaved={load} allowPaid={false} />
    </Card>
  );
}
