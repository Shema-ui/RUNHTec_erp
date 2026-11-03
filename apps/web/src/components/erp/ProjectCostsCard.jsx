import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Receipt, Trash2, Loader2, Save, Plus, AlertTriangle, TrendingUp, Pencil } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, Modal, Field, inputCls, btnPrimary, btnLine, fmtDate, todayISO } from '@/components/erp/kit';
import { InternalBadge } from '@/components/erp/CostingPanel';
import { formatMoney } from '@/lib/money';
import {
  LABOUR_ROLES, COST_CATEGORIES, labourRole, costCategoryLabel, computeCosting, summarizeActual, marginTone, canRecordCosts, fixedFeeCosts,
} from '@/lib/costing';

const n = (v) => Number(v) || 0;

function Bar({ used, plan }) {
  if (!plan) return null;
  const pct = Math.round((used / plan) * 100);
  const tone = pct > 100 ? 'bg-rose-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><div className={`h-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <span className={`w-12 text-right text-[11px] font-semibold ${pct > 100 ? 'text-rose-600' : 'text-muted-foreground'}`}>{pct}%</span>
    </div>
  );
}

export default function ProjectCostsCard({ project, team }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const canRecord = canRecordCosts(user);
  const [costs, setCosts] = useState(null);
  const [dialog, setDialog] = useState(null); // 'day' | 'expense'
  const [editCost, setEditCost] = useState(null);
  const currency = project.currency || 'RWF';

  const load = () => pb.collection('project_costs').getFullList({ filter: `project = '${project.id}'`, sort: '-cost_date' })
    .then(setCosts).catch(() => setCosts([]));
  useEffect(() => { load(); }, [project.id]);

  const quote = project.expand?.quotation;
  const plan = useMemo(() => (quote
    ? computeCosting({ items: Array.isArray(quote.items) ? quote.items : [], costing: quote.costing, subtotal: quote.subtotal, discount: quote.discount_amount })
    : null), [quote]);
  const revenue = plan ? plan.revenue : n(project.value);
  const planned = plan ? plan.totalCost : n(project.cost_budget);
  const fees = useMemo(() => fixedFeeCosts(team || []), [team]);
  const actual = useMemo(() => {
    const a = summarizeActual(costs || []);
    // Fixed-fee contractors from the Team section count as wages here.
    return { ...a, total: a.total + fees.total, unpaid: a.unpaid + fees.unpaid, by: { ...a.by, labour: (a.by.labour || 0) + fees.total } };
  }, [costs, fees]);
  const otherActual = actual.total - (actual.by.materials || 0) - (actual.by.labour || 0);
  const profitNow = revenue - actual.total;
  const done = project.status === 'done';

  const rows = [
    { label: 'Materials & equipment', plan: plan?.materials, used: actual.by.materials || 0, note: 'Add materials you buy with “Add expense” → Materials' },
    { label: 'Technician wages', plan: plan?.labour, used: actual.by.labour || 0, note: `${actual.labourDays} of ${plan?.labourDays ?? '—'} person-days used${fees.total ? ` · includes ${formatMoney(fees.total, currency)} fixed contractor fees from Team` : ''}` },
    { label: 'Transport & other', plan: plan ? plan.expenses + plan.contingency : undefined, used: otherActual },
  ];
  // Expected final cost: for each part, what we planned — or what we've already spent if that's more.
  const expectedCost = plan ? rows.reduce((t, r) => t + Math.max(n(r.plan), r.used), 0) : (planned ? Math.max(planned, actual.total) : null);
  const expected = expectedCost === null ? null : revenue - expectedCost;
  const showFinal = done || expected === null;
  const headline = showFinal ? profitNow : expected;
  const headlineMargin = revenue > 0 ? (headline / revenue) * 100 : 0;

  const togglePaid = async (c) => {
    setCosts((list) => list.map((x) => (x.id === c.id ? { ...x, paid: !c.paid } : x)));
    try { await pb.collection('project_costs').update(c.id, { paid: !c.paid }); } catch (e) { toast({ title: 'Could not update', description: e.message, variant: 'destructive' }); load(); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Remove this cost (${formatMoney(c.amount, currency)})?`)) return;
    try { await pb.collection('project_costs').delete(c.id); load(); } catch (e) { toast({ title: 'Could not delete', description: e.message, variant: 'destructive' }); }
  };


  return (
    <Card
      title={<span className="inline-flex flex-wrap items-center gap-2">Costs &amp; profit <InternalBadge /></span>}
      action={canRecord && (
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} onClick={() => setDialog('day')}><CalendarCheck className="h-4 w-4" /> Log work day</button>
          <button className={btnLine} onClick={() => setDialog('expense')}><Receipt className="h-4 w-4" /> Add expense</button>
        </div>
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Mini label="Client pays (excl. VAT)" value={formatMoney(revenue, currency)} />
        <Mini label="Planned cost" value={planned ? formatMoney(planned, currency) : 'Not set'} note={plan ? 'From the quotation costing' : 'Set it on the quotation or project'} />
        <Mini label="Spent so far" value={formatMoney(actual.total, currency)} note={actual.unpaid ? `${formatMoney(actual.unpaid, currency)} not yet paid out` : 'All paid'} />
        <Mini label={done ? 'Final profit' : showFinal ? 'Profit so far' : 'Expected profit'} value={formatMoney(headline, currency)} note={`${headlineMargin.toFixed(1)}% of the price`} cls={marginTone(headlineMargin)} />
      </div>

      {!showFinal && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Expected profit uses the plan for anything not spent yet. Log wages each day and add materials, fuel and other spending as you pay — when the project is marked Done this becomes the final profit.
        </p>
      )}
      {planned > 0 && actual.total > planned && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-rose-700"><AlertTriangle className="h-4 w-4" /> Spending is {formatMoney(actual.total - planned, currency)} over the plan.</p>
      )}

      {plan && (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.label} className="text-sm">
              <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{r.label}</span><span className="text-muted-foreground">{formatMoney(r.used, currency)} of {formatMoney(r.plan || 0, currency)}</span></div>
              <Bar used={r.used} plan={r.plan} />
              {r.note && <p className="text-[11px] text-muted-foreground">{r.note}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cost log</h4>
        {fees.list.length > 0 && (
          <p className="mb-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            Also counted: {fees.list.map((a) => `${a.expand?.contractor?.full_name || 'Contractor'} (fixed fee ${formatMoney(a.agreed_amount, a.currency)})`).join(', ')} from the Team section. Daily-rate contractors are counted through “Log work day” instead.
          </p>
        )}
        {!costs ? <p className="text-sm text-muted-foreground">Loading…</p> : costs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet. Each day on site, click “Log work day” and tick who came — wages add up automatically. Add fuel, transport, materials bought and other spending with “Add expense”.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr><th className="py-1.5 pr-2">Date</th><th className="py-1.5 pr-2">What</th><th className="py-1.5 pr-2 text-right">Amount</th><th className="py-1.5 pr-2 text-center">Paid</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {costs.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap py-2 pr-2">{fmtDate(c.cost_date) || '—'}</td>
                    <td className="py-2 pr-2">
                      <span className="font-medium">{c.category === 'labour' ? (c.worker_name || 'Worker') : (c.description || costCategoryLabel(c.category))}</span>
                      <p className="text-xs text-muted-foreground">
                        {c.category === 'labour'
                          ? `${labourRole(c.worker_role).label} · ${n(c.quantity) === 0.5 ? 'half day' : `${n(c.quantity)} day${n(c.quantity) === 1 ? '' : 's'}`} × ${formatMoney(c.unit_cost, currency)}`
                          : costCategoryLabel(c.category)}
                      </p>
                    </td>
                    <td className="py-2 pr-2 text-right font-semibold">{formatMoney(c.amount, currency)}</td>
                    <td className="py-2 pr-2 text-center"><input type="checkbox" checked={!!c.paid} disabled={!canRecord} onChange={() => togglePaid(c)} aria-label="Paid" className="h-4 w-4" /></td>
                    <td className="whitespace-nowrap py-2 text-right">{canRecord && (<>
                      <button onClick={() => setEditCost(c)} aria-label="Edit cost" className="mr-2 text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(c)} aria-label="Remove cost" className="text-muted-foreground hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LogDayDialog open={dialog === 'day'} onClose={() => setDialog(null)} project={project} team={team} costs={costs || []} onSaved={load} />
      <ExpenseDialog open={dialog === 'expense'} onClose={() => setDialog(null)} project={project} onSaved={load} />
      <EditCostDialog cost={editCost} onClose={() => setEditCost(null)} currency={currency} onSaved={load} />
    </Card>
  );
}

function Mini({ label, value, note, cls = '' }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display text-lg font-bold ${cls}`}>{value}</p>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

const guessRole = (text = '') => (/lead|head|chief|supervisor|foreman/i.test(text) ? 'lead' : /helper|assist|apprentice|intern/i.test(text) ? 'helper' : 'technician');

export function LogDayDialog({ open, onClose, project, team, costs, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [date, setDate] = useState(todayISO());
  const [crew, setCrew] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    const active = (team || []).filter((a) => !['cancelled', 'declined'].includes(a.status));
    setCrew(active.map((a) => {
      const role = guessRole(a.role_on_project);
      const rate = a.payment_basis === 'daily' && n(a.agreed_amount) > 0 ? n(a.agreed_amount) : labourRole(role).rate;
      return { key: a.id, contractor: a.contractor, name: a.expand?.contractor?.full_name || 'Contractor', role, rate, day: 1, present: true };
    }));
  }, [open]);

  const setRow = (i, k, v) => setCrew((rows) => rows.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [k]: v };
    if (k === 'role') next.rate = labourRole(v).rate;
    return next;
  }));
  const addWorker = () => setCrew((rows) => [...rows, { key: `x${Date.now()}`, contractor: '', name: '', role: 'helper', rate: labourRole('helper').rate, day: 1, present: true }]);

  const chosen = crew.filter((r) => r.present && (r.name || '').trim());
  const total = chosen.reduce((s, r) => s + n(r.rate) * n(r.day), 0);
  const already = (r) => costs.some((c) => c.category === 'labour' && c.cost_date === date && ((r.contractor && c.contractor === r.contractor) || (!r.contractor && (c.worker_name || '').toLowerCase() === r.name.trim().toLowerCase())));

  const save = async () => {
    if (!chosen.length) { toast({ title: 'Tick at least one person who worked', variant: 'destructive' }); return; }
    setSaving(true);
    let added = 0; let skipped = 0;
    try {
      for (const r of chosen) {
        if (already(r)) { skipped++; continue; }
        await pb.collection('project_costs').create({
          project: project.id, cost_date: date, category: 'labour',
          description: `${r.name.trim()} — ${labourRole(r.role).label}`,
          contractor: r.contractor || null, worker_name: r.name.trim(), worker_role: r.role,
          quantity: n(r.day), unit_cost: n(r.rate), amount: n(r.rate) * n(r.day), currency: project.currency || 'RWF',
          paid: false, recorded_by_name: user?.name || user?.email || '',
        });
        added++;
      }
      toast({ title: `Work day logged for ${added} ${added === 1 ? 'person' : 'people'}`, description: skipped ? `${skipped} already logged for this date — skipped.` : undefined });
      onSaved(); onClose();
    } catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} wide title="Log a work day" description="Tick who worked on site. Wages are added to the project’s costs at their daily rate.">
      <div className="space-y-4">
        <Field label="Date worked"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-[11px] uppercase text-muted-foreground">
              <tr><th className="w-10 pb-1">Came</th><th className="pb-1">Name</th><th className="pb-1">Role</th><th className="w-28 pb-1">Day</th><th className="w-28 pb-1 text-right">Rate / day</th></tr>
            </thead>
            <tbody>
              {crew.map((r, i) => (
                <tr key={r.key} className={r.present ? '' : 'opacity-50'}>
                  <td className="py-1"><input type="checkbox" checked={r.present} onChange={(e) => setRow(i, 'present', e.target.checked)} aria-label={`${r.name || 'Worker'} worked`} className="h-4 w-4" /></td>
                  <td className="py-1 pr-1">{r.contractor ? <span className="font-medium">{r.name}</span> : <input className={inputCls} value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} placeholder="Worker name" aria-label="Worker name" />}
                    {r.present && r.name && already(r) && <p className="text-[11px] text-amber-700">Already logged for this date</p>}</td>
                  <td className="py-1 pr-1">
                    <select className={inputCls} value={r.role} onChange={(e) => setRow(i, 'role', e.target.value)} aria-label="Role">
                      {LABOUR_ROLES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pr-1">
                    <select className={inputCls} value={r.day} onChange={(e) => setRow(i, 'day', Number(e.target.value))} aria-label="Full or half day">
                      <option value={1}>Full day</option><option value={0.5}>Half day</option>
                    </select>
                  </td>
                  <td className="py-1"><input type="number" min="0" className={`${inputCls} text-right`} value={r.rate} onChange={(e) => setRow(i, 'rate', e.target.value)} aria-label="Rate per day" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {crew.length === 0 && <p className="text-sm text-muted-foreground">No contractors engaged on this project yet — add the people who worked below.</p>}
        <button type="button" onClick={addWorker} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Plus className="h-4 w-4" /> Add another worker</button>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-sm">Wages for this day: <strong>{formatMoney(total, project.currency)}</strong> · {chosen.length} {chosen.length === 1 ? 'person' : 'people'}</p>
          <div className="flex gap-2">
            <button className={btnLine} onClick={onClose}>Cancel</button>
            <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save work day</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function ExpenseDialog({ open, onClose, project, onSaved, allowPaid = true }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const blank = () => ({ cost_date: todayISO(), category: 'transport', description: '', amount: '', paid: true, notes: '' });
  const [f, setF] = useState(blank());
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setF(blank()); }, [open]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const amount = n(f.amount);
    if (amount <= 0) { toast({ title: 'Enter the amount spent', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await pb.collection('project_costs').create({
        project: project.id, cost_date: f.cost_date, category: f.category, description: f.description || costCategoryLabel(f.category),
        quantity: 1, unit_cost: amount, amount, currency: project.currency || 'RWF', paid: f.paid, notes: f.notes,
        recorded_by_name: user?.name || user?.email || '',
      });
      toast({ title: 'Expense added', description: formatMoney(amount, project.currency) });
      onSaved(); onClose();
    } catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add an expense" description="Money spent on this project: fuel, transport, materials bought, meals, tool hire…">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date"><input type="date" className={inputCls} value={f.cost_date} onChange={(e) => set('cost_date', e.target.value)} /></Field>
          <Field label="Type">
            <select className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)}>
              {COST_CATEGORIES.filter((c) => c.value !== 'labour').map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="What was it for" className="sm:col-span-2"><input className={inputCls} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Fuel Kigali–Musanze return, 6mm² cable 100 m" /></Field>
          <Field label="Amount" required><input type="number" min="0" className={inputCls} value={f.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
          {allowPaid && <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={f.paid} onChange={(e) => set('paid', e.target.checked)} className="h-4 w-4" /> Already paid</label>}
        </div>
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Add expense</button>
        </div>
      </div>
    </Modal>
  );
}

// Change any recorded cost: a wrong date, wrong person, half day instead of full, wrong amount…
export function EditCostDialog({ cost, onClose, currency, onSaved, allowPaid = true }) {
  const { toast } = useToast();
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!cost) return;
    setF({
      cost_date: cost.cost_date || '', category: cost.category || 'other', description: cost.description || '',
      worker_name: cost.worker_name || '', worker_role: cost.worker_role || 'technician',
      quantity: n(cost.quantity) || 1, unit_cost: n(cost.unit_cost) || n(cost.amount), paid: !!cost.paid, notes: cost.notes || '',
    });
  }, [cost]);
  if (!cost || !f) return null;
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const isLabour = f.category === 'labour';
  const amount = n(f.quantity) * n(f.unit_cost);

  const save = async () => {
    if (amount <= 0) { toast({ title: 'Amount must be more than zero', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const data = { cost_date: f.cost_date, category: f.category, quantity: n(f.quantity), unit_cost: n(f.unit_cost), amount, paid: f.paid, notes: f.notes };
      if (isLabour) Object.assign(data, { worker_name: f.worker_name, worker_role: f.worker_role, description: `${f.worker_name} — ${labourRole(f.worker_role).label}` });
      else data.description = f.description || costCategoryLabel(f.category);
      await pb.collection('project_costs').update(cost.id, data);
      toast({ title: 'Cost updated' });
      onSaved(); onClose();
    } catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Edit cost" description="Fix anything that was entered wrongly.">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date"><input type="date" className={inputCls} value={f.cost_date} onChange={(e) => set('cost_date', e.target.value)} /></Field>
          <Field label="Type">
            <select className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)}>
              {COST_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          {isLabour ? (
            <>
              <Field label="Worker name"><input className={inputCls} value={f.worker_name} onChange={(e) => set('worker_name', e.target.value)} /></Field>
              <Field label="Role">
                <select className={inputCls} value={f.worker_role} onChange={(e) => { set('worker_role', e.target.value); set('unit_cost', labourRole(e.target.value).rate); }}>
                  {LABOUR_ROLES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </Field>
              <Field label="Days worked" hint="0.5 = half day"><input type="number" min="0" step="0.5" className={inputCls} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
              <Field label="Rate per day"><input type="number" min="0" className={inputCls} value={f.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} /></Field>
            </>
          ) : (
            <>
              <Field label="What was it for" className="sm:col-span-2"><input className={inputCls} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
              <Field label="Quantity"><input type="number" min="0" step="0.01" className={inputCls} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
              <Field label="Cost each"><input type="number" min="0" className={inputCls} value={f.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} /></Field>
            </>
          )}
          <Field label="Notes" className="sm:col-span-2"><input className={inputCls} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          {allowPaid && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.paid} onChange={(e) => set('paid', e.target.checked)} className="h-4 w-4" /> Paid</label>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-sm">Total: <strong>{formatMoney(amount, currency)}</strong></p>
          <div className="flex gap-2">
            <button className={btnLine} onClick={onClose}>Cancel</button>
            <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
