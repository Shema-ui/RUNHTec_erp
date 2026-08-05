import React, { useEffect, useState } from 'react';
import { Plus, X, Loader2, Check, Trash2, Bell, CheckCircle2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { FOLLOWUP_TYPES } from '@/lib/crm';

const PRIORITIES = [
  { value: 'low', label: 'Low', cls: 'bg-slate-100 text-slate-600' },
  { value: 'medium', label: 'Medium', cls: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High', cls: 'bg-red-100 text-red-600' },
];

const inputCls = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function FollowUpsTab({ clientId }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'call', title: '', description: '', due_date: '', priority: 'medium', assigned_to: '' });
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [r, usersR] = await Promise.all([
        pb.collection('client_followups').getFullList({
          filter: `client = '${clientId}'`,
          sort: 'status,due_date',
          expand: 'assigned_to',
          requestKey: `followups-${clientId}`,
        }),
        pb.collection('users').getFullList({ sort: 'name', requestKey: 'fu-users' }),
      ]);
      setItems(r);
      setUsers(usersR);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, client: clientId, status: 'pending' };
      if (!payload.assigned_to) delete payload.assigned_to;
      if (!payload.due_date) delete payload.due_date;
      await pb.collection('client_followups').create(payload);
      setForm({ type: 'call', title: '', description: '', due_date: '', priority: 'medium', assigned_to: '' });
      setShowForm(false);
      await load();
    } catch (err) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleComplete = async (id) => {
    await pb.collection('client_followups').update(id, { status: 'completed' });
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'completed' } : i));
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this follow-up?')) return;
    await pb.collection('client_followups').delete(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const pending = items.filter(i => i.status === 'pending');
  const completed = items.filter(i => i.status !== 'pending');

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading follow-ups…</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{pending.length} pending · {completed.length} completed</p>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Cancel' : 'Schedule Follow-Up'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Schedule Follow-Up</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className={inputCls}>
                {FOLLOWUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Title *</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Follow up on proposal" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Priority</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className={inputCls}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Assign To</label>
              <select value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})} className={inputCls}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground">Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Additional details…" rows={2} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <div className="mt-3">
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save Follow-Up
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {pending.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending</p>
              <div className="space-y-2">
                {pending.map(fu => {
                  const pri = PRIORITIES.find(p => p.value === fu.priority);
                  const typeLabel = FOLLOWUP_TYPES.find(t => t.value === fu.type)?.label || fu.type;
                  const isOverdue = fu.due_date && new Date(fu.due_date) < new Date();
                  return (
                    <div key={fu.id} className={`flex items-start gap-3 rounded-xl border p-4 ${isOverdue ? 'border-red-200 bg-red-50' : 'border-border bg-card'}`}>
                      <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${isOverdue ? 'text-red-500' : 'text-primary'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{fu.title}</p>
                          {pri && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pri.cls}`}>{pri.label}</span>}
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{typeLabel}</span>
                        </div>
                        {fu.description && <p className="mt-1 text-xs text-muted-foreground">{fu.description}</p>}
                        {fu.due_date && (
                          <p className={`mt-1 text-xs ${isOverdue ? 'font-semibold text-red-500' : 'text-muted-foreground'}`}>
                            Due: {new Date(fu.due_date).toLocaleDateString()}
                            {isOverdue && ' — Overdue'}
                          </p>
                        )}
                        {fu.expand?.assigned_to?.name && (
                          <p className="text-xs text-muted-foreground">Assigned to: {fu.expand.assigned_to.name}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleComplete(fu.id)} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50" title="Mark complete">
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(fu.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
              <div className="space-y-2">
                {completed.map(fu => (
                  <div key={fu.id} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3 opacity-60">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-sm text-foreground line-through">{fu.title}</p>
                    <button onClick={() => handleDelete(fu.id)} className="ml-auto rounded p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
