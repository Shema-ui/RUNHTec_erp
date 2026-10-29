// Create or edit one project engagement: the per-project contract between
// RUNHTec and an independent contractor.
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Modal, Field, Stars, inputCls, textareaCls, btnPrimary, btnLine, btnDanger } from '@/components/erp/kit';
import {
  ASSIGNMENT_STATUSES, PAYMENT_BASIS, CONTRACTOR_PAYMENT_STATUSES, TRADES, tradeLabel, rateUnitLabel,
} from '@/lib/hr';
import { CURRENCIES, DEFAULT_CURRENCY, formatMoney } from '@/lib/money';

const EMPTY = {
  project: '', contractor: '', role_on_project: '', scope_of_work: '', payment_basis: 'fixed',
  agreed_amount: 0, currency: DEFAULT_CURRENCY, start_date: '', end_date: '', status: 'offered',
  contract_signed: false, payment_status: 'unpaid', amount_paid: 0, performance_rating: 0, notes: '',
};

export default function EngagementDialog({ open, onClose, onSaved, engagement, project }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [contractors, setContractors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tradeFilter, setTradeFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(engagement?.id);

  useEffect(() => {
    if (!open) return;
    setForm(engagement ? { ...EMPTY, ...engagement } : {
      ...EMPTY,
      project: project?.id || '',
      currency: project?.currency || DEFAULT_CURRENCY,
      start_date: project?.start_date || '',
      end_date: project?.due_date || '',
    });
    pb.collection('contractors').getFullList({ sort: 'full_name' }).then(setContractors).catch(() => setContractors([]));
    if (!project) pb.collection('projects').getFullList({ sort: '-created' }).then(setProjects).catch(() => setProjects([]));
  }, [open, engagement?.id]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const chosen = contractors.find((c) => c.id === form.contractor);
  const choices = useMemo(() => contractors.filter((c) =>
    c.id === form.contractor || (!['do_not_engage', 'inactive'].includes(c.status) && (tradeFilter === 'all' || c.trade === tradeFilter))
  ), [contractors, tradeFilter, form.contractor]);

  const pickContractor = (cid) => {
    const c = contractors.find((x) => x.id === cid);
    setForm((p) => ({
      ...p,
      contractor: cid,
      role_on_project: p.role_on_project || (c ? tradeLabel(c.trade) : ''),
      currency: c?.currency || p.currency,
      payment_basis: c?.rate_unit === 'per_day' ? 'daily' : c?.rate_unit === 'per_hour' ? 'hourly' : p.payment_basis,
    }));
  };

  const save = async () => {
    if (!form.project || !form.contractor) { toast({ title: 'Choose a project and a contractor', variant: 'destructive' }); return; }
    setSaving(true);
    const agreed = Number(form.agreed_amount) || 0;
    const paid = Number(form.amount_paid) || 0;
    const data = {
      ...form,
      agreed_amount: agreed,
      amount_paid: paid,
      performance_rating: Number(form.performance_rating) || 0,
      payment_status: paid <= 0 ? 'unpaid' : paid >= agreed && agreed > 0 ? 'paid' : 'partially_paid',
    };
    delete data.id; delete data.expand; delete data.created; delete data.updated;
    try {
      if (isEdit) await pb.collection('project_assignments').update(engagement.id, data);
      else await pb.collection('project_assignments').create(data);
      toast({ title: isEdit ? 'Engagement updated' : 'Contractor engaged on the project' });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm('Remove this engagement from the project?')) return;
    try {
      await pb.collection('project_assignments').delete(engagement.id);
      toast({ title: 'Engagement removed' });
      onSaved?.();
      onClose();
    } catch (e) { toast({ title: 'Could not remove', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Modal open={open} onClose={onClose} wide
      title={isEdit ? 'Edit project engagement' : 'Engage a contractor on this project'}
      description="Each engagement is a separate per-project contract with its own scope, fee and dates.">
      <div className="space-y-4">
        {!project && (
          <Field label="Project" required>
            <select className={inputCls} value={form.project} onChange={(e) => set('project', e.target.value)} disabled={isEdit}>
              <option value="">Choose a project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {!isEdit && (
            <Field label="Filter by skill">
              <select className={inputCls} value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)}>
                <option value="all">All skills</option>
                {TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          )}
          <Field label="Contractor" required className={isEdit ? 'sm:col-span-2' : ''}
            hint={chosen ? `${tradeLabel(chosen.trade)} · ${Number(chosen.rate_amount) ? `${formatMoney(chosen.rate_amount, chosen.currency)} ${rateUnitLabel(chosen.rate_unit)}` : 'no standard rate'}${chosen.verified ? ' · verified' : ''}` : ''}>
            <select className={inputCls} value={form.contractor} onChange={(e) => pickContractor(e.target.value)} disabled={isEdit}>
              <option value="">Choose from the register…</option>
              {choices.map((c) => <option key={c.id} value={c.id}>{c.full_name} — {tradeLabel(c.trade)}</option>)}
            </select>
          </Field>
          <Field label="Role on this project"><input className={inputCls} value={form.role_on_project} onChange={(e) => set('role_on_project', e.target.value)} placeholder="e.g. Lead electrician" /></Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {ASSIGNMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Start date"><input type="date" className={inputCls} value={form.start_date || ''} onChange={(e) => set('start_date', e.target.value)} /></Field>
          <Field label="End date"><input type="date" className={inputCls} value={form.end_date || ''} onChange={(e) => set('end_date', e.target.value)} /></Field>
        </div>

        <Field label="Scope of work" hint="What this contractor is responsible for on this project. It appears on the engagement letter.">
          <textarea className={textareaCls} rows={4} value={form.scope_of_work} onChange={(e) => set('scope_of_work', e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Payment basis">
            <select className={inputCls} value={form.payment_basis} onChange={(e) => set('payment_basis', e.target.value)}>
              {PAYMENT_BASIS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Total agreed fee"><input type="number" min="0" className={inputCls} value={form.agreed_amount} onChange={(e) => set('agreed_amount', e.target.value)} /></Field>
          <Field label="Currency">
            <select className={inputCls} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
            </select>
          </Field>
          <Field label="Amount paid so far" hint={`Payment status: ${(CONTRACTOR_PAYMENT_STATUSES.find((s) => s.value === ((Number(form.amount_paid) || 0) <= 0 ? 'unpaid' : (Number(form.amount_paid) >= Number(form.agreed_amount) && Number(form.agreed_amount) > 0 ? 'paid' : 'partially_paid'))) || {}).label}`}>
            <input type="number" min="0" className={inputCls} value={form.amount_paid} onChange={(e) => set('amount_paid', e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={!!form.contract_signed} onChange={(e) => set('contract_signed', e.target.checked)} /> Engagement letter signed</label>
          <Field label="Performance (after completion)"><Stars value={Number(form.performance_rating) || 0} onChange={(v) => set('performance_rating', v)} /></Field>
        </div>

        <Field label="Notes"><textarea className={textareaCls} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <div>{isEdit && <button className={btnDanger} onClick={remove}>Remove</button>}</div>
          <div className="flex gap-2">
            <button className={btnLine} onClick={onClose}>Cancel</button>
            <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save engagement</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
