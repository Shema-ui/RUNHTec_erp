import React, { useEffect, useState } from 'react';
import { Plus, X, Loader2, Check, Phone, Mail, Users, MapPin, FileQuestion, FileText, ClipboardList, FolderKanban, Wrench, ReceiptText, CreditCard, StickyNote, Paperclip, Circle } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { ACTIVITY_TYPES } from '@/lib/crm';

const TYPE_ICONS = {
  call: Phone, email: Mail, meeting: Users, site_visit: MapPin, rfq: FileQuestion,
  quotation: FileText, work_order: ClipboardList, project: FolderKanban,
  maintenance: Wrench, invoice: ReceiptText, payment: CreditCard,
  note: StickyNote, attachment: Paperclip, other: Circle,
};

const TYPE_COLORS = {
  call: 'bg-blue-100 text-blue-700', email: 'bg-indigo-100 text-indigo-700',
  meeting: 'bg-purple-100 text-purple-700', site_visit: 'bg-amber-100 text-amber-700',
  rfq: 'bg-orange-100 text-orange-700', quotation: 'bg-teal-100 text-teal-700',
  work_order: 'bg-cyan-100 text-cyan-700', project: 'bg-green-100 text-green-700',
  maintenance: 'bg-yellow-100 text-yellow-700', invoice: 'bg-pink-100 text-pink-700',
  payment: 'bg-emerald-100 text-emerald-700', note: 'bg-slate-100 text-slate-600',
  attachment: 'bg-gray-100 text-gray-600', other: 'bg-secondary text-muted-foreground',
};

const inputCls = 'w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function ActivitiesTab({ clientId }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'call', description: '' });
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PER_PAGE = 15;

  const load = async (pg = 1) => {
    setLoading(pg === 1);
    try {
      const r = await pb.collection('client_activities').getList(pg, PER_PAGE, {
        filter: `client = '${clientId}'`,
        sort: '-created',
        requestKey: `activities-${clientId}-${pg}`,
      });
      setActivities(pg === 1 ? r.items : prev => [...prev, ...r.items]);
      setPage(pg);
      setTotalPages(r.totalPages);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, [clientId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) { setError('Description is required'); return; }
    setSaving(true); setError('');
    try {
      await pb.collection('client_activities').create({
        client: clientId,
        type: form.type,
        description: form.description,
        actor: user?.id,
        actor_name: user?.name || user?.email || '',
      });
      setForm({ type: 'call', description: '' });
      setShowForm(false);
      await load(1);
    } catch (err) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const formatDate = (created) => {
    const d = new Date(created);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading activities…</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{activities.length} activit{activities.length !== 1 ? 'ies' : 'y'}</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Cancel' : 'Log Activity'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Log New Activity</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Activity Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className={`h-9 ${inputCls}`}>
                {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground">Description *</label>
              <textarea
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="What happened? Who was involved? What was discussed or decided?"
                rows={3}
                className={`py-2 ${inputCls} resize-none`}
              />
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <div className="mt-3">
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Log Activity
            </button>
          </div>
        </form>
      )}

      {activities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">No activities logged yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Log calls, emails, meetings and site visits above.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[22px] top-0 h-full w-0.5 bg-border" />
          <div className="space-y-4">
            {activities.map(a => {
              const Icon = TYPE_ICONS[a.type] || Circle;
              const color = TYPE_COLORS[a.type] || TYPE_COLORS.other;
              const typeLabel = ACTIVITY_TYPES.find(t => t.value === a.type)?.label || a.type;
              return (
                <div key={a.id} className="relative flex gap-4">
                  <div className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-background ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{typeLabel}</span>
                      <span className="text-[11px] text-muted-foreground">{formatDate(a.created)}</span>
                    </div>
                    <p className="text-sm text-foreground">{a.description}</p>
                    {a.actor_name && (
                      <p className="mt-1 text-[11px] text-muted-foreground">by {a.actor_name}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {page < totalPages && (
            <button
              onClick={() => load(page + 1)}
              className="mt-4 w-full rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
