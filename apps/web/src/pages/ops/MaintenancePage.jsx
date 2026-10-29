import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Plus, Wrench, CalendarDays, Pencil, Loader2, Save, MapPin, HardHat } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Toolbar, SearchBox, Loading, Empty, StatCard, Modal, Field, inputCls, textareaCls, btnPrimary, btnLine, btnDanger, fmtDate,
} from '@/components/erp/kit';
import { SERVICE_CATEGORIES } from '@/lib/projects';
import { tradeLabel } from '@/lib/hr';
import { formatMoney, CURRENCIES, DEFAULT_CURRENCY } from '@/lib/money';

const FREQUENCIES = ['Weekly', 'Twice a week', 'Every 2 weeks', 'Monthly', 'Quarterly', 'Every 6 months', 'Yearly', 'On call'];
const today = () => new Date().toISOString().slice(0, 10);

export default function MaintenancePage() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState(null);
  const [q, setQ] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [editing, setEditing] = useState(null);
  const canEdit = ['super_admin', 'project_manager'].includes(user?.role);

  const load = () => pb.collection('maintenance_contracts').getFullList({ sort: 'next_due_date', expand: 'client,contractor' })
    .then(setContracts).catch(() => setContracts([]));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => (contracts || []).filter((c) => {
    if (activeOnly && !c.active) return false;
    if (q && ![c.expand?.client?.company_name, c.service_type, c.site].join(' ').toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [contracts, q, activeOnly]);

  const stats = useMemo(() => {
    const active = (contracts || []).filter((c) => c.active);
    const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    return {
      active: active.length,
      dueWeek: active.filter((c) => c.next_due_date && c.next_due_date <= soon && c.next_due_date >= today()).length,
      overdue: active.filter((c) => c.next_due_date && c.next_due_date < today()).length,
      value: active.reduce((s, c) => s + Number(c.contract_value || 0), 0),
    };
  }, [contracts]);

  return (
    <PortalLayout title="Maintenance contracts" subtitle="Recurring service agreements and upcoming visits">
      <Helmet><title>Maintenance | RUNHTec Business Portal</title></Helmet>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wrench} label="Active contracts" value={stats.active} />
        <StatCard label="Visits due in 7 days" value={stats.dueWeek} tone="amber" />
        <StatCard label="Visits overdue" value={stats.overdue} tone={stats.overdue ? 'red' : 'green'} />
        <StatCard label="Value of active contracts" value={formatMoney(stats.value, DEFAULT_CURRENCY)} tone="green" />
      </div>

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search client, service or site" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={activeOnly} onChange={() => setActiveOnly((v) => !v)} /> Active only</label>
        {canEdit && <button className={`${btnPrimary} ml-auto`} onClick={() => setEditing({})}><Plus className="h-4 w-4" /> New contract</button>}
      </Toolbar>

      {!contracts ? <Loading /> : filtered.length === 0 ? (
        <Empty>No maintenance contracts yet. Add one with “New contract” — e.g. 6-month generator servicing, 2 visits a week.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((c) => {
            const overdue = c.active && c.next_due_date && c.next_due_date < today();
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-semibold text-foreground">{c.service_type || 'Maintenance'}</h3>
                    <p className="text-sm text-muted-foreground">{c.client ? <Link to={`/crm/clients/${c.client}`} className="hover:text-primary">{c.expand?.client?.company_name || 'Client'}</Link> : 'No client linked'}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{c.active ? 'Active' : 'Ended'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{c.frequency || 'Frequency not set'}</span>
                  <span className={`inline-flex items-center gap-1 ${overdue ? 'font-semibold text-rose-600' : ''}`}><CalendarDays className="h-3.5 w-3.5" />Next visit {c.next_due_date ? fmtDate(c.next_due_date) : 'not set'}{overdue ? ' · overdue' : ''}</span>
                  {c.site && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.site}</span>}
                  {c.expand?.contractor && <span className="inline-flex items-center gap-1"><HardHat className="h-3.5 w-3.5" />{c.expand.contractor.full_name}</span>}
                  {(c.start_date || c.end_date) && <span>{[fmtDate(c.start_date), fmtDate(c.end_date)].filter(Boolean).join(' – ')}</span>}
                  {Number(c.contract_value) > 0 && <span className="font-semibold text-foreground">{formatMoney(c.contract_value, c.currency)}</span>}
                </div>
                {canEdit && (
                  <div className="mt-3 flex justify-end">
                    <button className={btnLine} onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /> Edit / log visit</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ContractDialog contract={editing} onClose={() => setEditing(null)} onSaved={load} />
    </PortalLayout>
  );
}

function ContractDialog({ contract, onClose, onSaved }) {
  const { toast } = useToast();
  const isEdit = Boolean(contract?.id);
  const EMPTY = { client: '', service_type: '', site: '', frequency: 'Monthly', next_due_date: '', start_date: today(), end_date: '', contract_value: 0, currency: DEFAULT_CURRENCY, contractor: '', active: true, notes: '' };
  const [form, setForm] = useState(EMPTY);
  const [clients, setClients] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!contract) return;
    setForm(isEdit ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, contract[k] ?? EMPTY[k]])), active: Boolean(contract.active) } : EMPTY);
    pb.collection('clients').getFullList({ sort: 'company_name' }).then(setClients).catch(() => {});
    pb.collection('contractors').getFullList({ sort: 'full_name' }).then(setContractors).catch(() => {});
  }, [contract]);

  if (!contract) return null;
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.client || !form.service_type) { toast({ title: 'Choose a client and service', variant: 'destructive' }); return; }
    setSaving(true);
    const data = { ...form, contractor: form.contractor || null, contract_value: Number(form.contract_value) || 0 };
    try {
      if (isEdit) await pb.collection('maintenance_contracts').update(contract.id, data);
      else await pb.collection('maintenance_contracts').create(data);
      toast({ title: isEdit ? 'Contract updated' : 'Contract added' });
      onSaved(); onClose();
    } catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm('Delete this maintenance contract?')) return;
    try { await pb.collection('maintenance_contracts').delete(contract.id); onSaved(); onClose(); }
    catch (e) { toast({ title: 'Could not delete', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Modal open onClose={onClose} wide title={isEdit ? 'Edit maintenance contract' : 'New maintenance contract'} description="After each visit, move “Next visit” forward to the following service date.">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client" required>
            <select className={inputCls} value={form.client || ''} onChange={(e) => set('client', e.target.value)}>
              <option value="">Choose…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </Field>
          <Field label="Service" required>
            <input className={inputCls} list="maint-services" value={form.service_type} onChange={(e) => set('service_type', e.target.value)} placeholder="e.g. Generator servicing" />
            <datalist id="maint-services">{SERVICE_CATEGORIES.map((s) => <option key={s.value} value={s.label} />)}</datalist>
          </Field>
          <Field label="Site"><input className={inputCls} value={form.site} onChange={(e) => set('site', e.target.value)} placeholder="Building / location" /></Field>
          <Field label="Visit frequency">
            <select className={inputCls} value={form.frequency} onChange={(e) => set('frequency', e.target.value)}>
              {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Next visit"><input type="date" className={inputCls} value={form.next_due_date || ''} onChange={(e) => set('next_due_date', e.target.value)} /></Field>
          <Field label="Assigned contractor">
            <select className={inputCls} value={form.contractor || ''} onChange={(e) => set('contractor', e.target.value)}>
              <option value="">Not assigned</option>
              {contractors.filter((c) => !['do_not_engage', 'inactive'].includes(c.status) || c.id === form.contractor).map((c) => <option key={c.id} value={c.id}>{c.full_name} — {tradeLabel(c.trade)}</option>)}
            </select>
          </Field>
          <Field label="Contract start"><input type="date" className={inputCls} value={form.start_date || ''} onChange={(e) => set('start_date', e.target.value)} /></Field>
          <Field label="Contract end"><input type="date" className={inputCls} value={form.end_date || ''} onChange={(e) => set('end_date', e.target.value)} /></Field>
          <Field label="Contract value"><input type="number" min="0" className={inputCls} value={form.contract_value} onChange={(e) => set('contract_value', e.target.value)} /></Field>
          <Field label="Currency">
            <select className={inputCls} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.active} onChange={(e) => set('active', e.target.checked)} /> Contract is active</label>
        <Field label="Notes / visit log"><textarea className={textareaCls} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="e.g. 12 Nov: oil & filters changed, battery OK" /></Field>
        <div className="flex flex-wrap justify-between gap-2">
          <div>{isEdit && <button className={btnDanger} onClick={remove}>Delete</button>}</div>
          <div className="flex gap-2">
            <button className={btnLine} onClick={onClose}>Cancel</button>
            <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
