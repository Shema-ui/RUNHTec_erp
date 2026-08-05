import React, { useEffect, useState, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, X, Loader2, Check, ChevronLeft, DollarSign, Building2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import PortalLayout from '@/layouts/PortalLayout';
import { PIPELINE_STAGES, formatCurrency } from '@/lib/crm';

const inputCls = 'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

function OpportunityCard({ opp, onDragStart }) {
  const navigate = useNavigate();
  const stageInfo = PIPELINE_STAGES.find(s => s.value === opp.stage);
  return (
    <div
      draggable
      onDragStart={() => onDragStart(opp)}
      onClick={() => navigate(`/crm/clients/${opp.client}`)}
      className="cursor-pointer rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
    >
      <p className="text-[13px] font-semibold text-foreground leading-tight">{opp.title}</p>
      {opp.expand?.client?.company_name && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{opp.expand.client.company_name}</span>
        </div>
      )}
      {opp.value > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <DollarSign className="h-3 w-3" />
          {formatCurrency(opp.value)}
        </div>
      )}
      {opp.expected_close && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Close: {new Date(opp.expected_close).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', client: '', stage: 'new_lead', value: '', description: '', expected_close: '' });
  const [error, setError] = useState('');
  const [dragOpp, setDragOpp] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [opps, clientList] = await Promise.all([
        pb.collection('sales_opportunities').getFullList({
          sort: '-created',
          expand: 'client,assigned_to',
          requestKey: 'pipeline-opps',
        }),
        pb.collection('clients').getFullList({
          sort: 'company_name',
          fields: 'id,company_name',
          requestKey: 'pipeline-clients',
        }),
      ]);
      setOpportunities(opps);
      setClients(clientList);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.client) { setError('Title and client are required'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, value: form.value ? Number(form.value) : null };
      if (!payload.expected_close) delete payload.expected_close;
      if (!payload.value) delete payload.value;
      await pb.collection('sales_opportunities').create(payload);
      setForm({ title: '', client: '', stage: 'new_lead', value: '', description: '', expected_close: '' });
      setShowForm(false);
      await load();
    } catch (err) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDrop = async (targetStage) => {
    if (!dragOpp || dragOpp.stage === targetStage) { setDragOpp(null); setDragOverStage(null); return; }
    // Optimistic update
    setOpportunities(prev => prev.map(o => o.id === dragOpp.id ? { ...o, stage: targetStage } : o));
    try {
      await pb.collection('sales_opportunities').update(dragOpp.id, { stage: targetStage });
    } catch (e) {
      console.error('move opp failed', e);
      await load();
    }
    setDragOpp(null);
    setDragOverStage(null);
  };

  const stagesByKey = PIPELINE_STAGES.reduce((acc, s) => {
    acc[s.value] = opportunities.filter(o => o.stage === s.value);
    return acc;
  }, {});

  const totalValue = opportunities
    .filter(o => o.stage !== 'lost')
    .reduce((s, o) => s + (o.value || 0), 0);

  return (
    <PortalLayout title="Sales Pipeline" subtitle="CRM — Kanban Board">
      <Helmet>
        <title>Sales Pipeline | RUNHTec CRM</title>
        <meta name="description" content="Drag-and-drop sales pipeline for managing opportunities from lead to close." />
      </Helmet>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/crm" className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary">
          <ChevronLeft className="h-4 w-4" /> CRM
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Total Pipeline Value</p>
            <p className="font-display text-base font-extrabold text-foreground">{formatCurrency(totalValue)}</p>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'New Opportunity'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-5">
          <p className="mb-4 text-sm font-semibold text-foreground">New Opportunity</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Title *</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. HVAC Replacement — Building A" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Client *</label>
              <select value={form.client} onChange={e => setForm({...form, client: e.target.value})} className={inputCls}>
                <option value="">— Select Client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Stage</label>
              <select value={form.stage} onChange={e => setForm({...form, stage: e.target.value})} className={inputCls}>
                {PIPELINE_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Value (R)</label>
              <input value={form.value} onChange={e => setForm({...form, value: e.target.value})} type="number" min="0" placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Expected Close Date</label>
              <input value={form.expected_close} onChange={e => setForm({...form, expected_close: e.target.value})} type="date" className={inputCls} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-foreground">Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Brief description of the opportunity" rows={2} className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <div className="mt-3">
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Create Opportunity
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max gap-3">
            {PIPELINE_STAGES.map(stage => {
              const stageOpps = stagesByKey[stage.value] || [];
              const stageValue = stageOpps.reduce((s, o) => s + (o.value || 0), 0);
              const isDraggingOver = dragOverStage === stage.value;
              return (
                <div
                  key={stage.value}
                  onDragOver={e => { e.preventDefault(); setDragOverStage(stage.value); }}
                  onDragLeave={() => setDragOverStage(null)}
                  onDrop={() => handleDrop(stage.value)}
                  className={`flex w-[240px] shrink-0 flex-col rounded-xl border transition-colors ${
                    isDraggingOver ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary/30'
                  }`}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between rounded-t-xl border-b border-border p-3"
                       style={{ borderTop: `3px solid ${stage.color}` }}>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{stage.label}</p>
                      {stageValue > 0 && (
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(stageValue)}</p>
                      )}
                    </div>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-card text-[10px] font-bold text-muted-foreground shadow-sm">
                      {stageOpps.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div className="min-h-[80px] flex-1 space-y-2 p-2">
                    {stageOpps.map(opp => (
                      <OpportunityCard
                        key={opp.id}
                        opp={opp}
                        onDragStart={setDragOpp}
                      />
                    ))}
                    {stageOpps.length === 0 && (
                      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/60">
                        Drop here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
