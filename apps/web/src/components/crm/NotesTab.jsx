import React, { useEffect, useState } from 'react';
import { Plus, X, Loader2, Check, Trash2, StickyNote } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'technical', label: 'Technical' },
  { value: 'financial', label: 'Financial' },
  { value: 'legal', label: 'Legal' },
  { value: 'other', label: 'Other' },
];
const PRIORITIES = [
  { value: 'low', label: 'Low', cls: 'bg-slate-100 text-slate-600' },
  { value: 'medium', label: 'Medium', cls: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High', cls: 'bg-red-100 text-red-600' },
];

const inputCls = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function NotesTab({ clientId }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', category: 'general', priority: 'low' });
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await pb.collection('client_notes').getFullList({
        filter: `client = '${clientId}'`,
        sort: '-created',
        requestKey: `notes-${clientId}`,
      });
      setNotes(r);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.body.trim()) { setError('Note content is required'); return; }
    setSaving(true); setError('');
    try {
      await pb.collection('client_notes').create({
        ...form,
        client: clientId,
        author: user?.id,
        author_name: user?.name || user?.email || '',
      });
      setForm({ title: '', body: '', category: 'general', priority: 'low' });
      setShowForm(false);
      await load();
    } catch (err) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this note?')) return;
    await pb.collection('client_notes').delete(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading notes…</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Cancel' : 'Add Note'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">New Note</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground">Title</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Optional title" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className={inputCls}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Priority</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className={inputCls}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground">Note *</label>
              <textarea
                value={form.body}
                onChange={e => setForm({...form, body: e.target.value})}
                placeholder="Write your note here…"
                rows={5}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <div className="mt-3">
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save Note
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <StickyNote className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(n => {
            const pri = PRIORITIES.find(p => p.value === n.priority);
            const cat = CATEGORIES.find(c => c.value === n.category);
            return (
              <div key={n.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {n.title && <p className="text-sm font-semibold text-foreground">{n.title}</p>}
                    {pri && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pri.cls}`}>{pri.label}</span>}
                    {cat && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{cat.label}</span>}
                  </div>
                  <button onClick={() => handleDelete(n.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">{n.body}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {n.author_name && `${n.author_name} · `}
                  {new Date(n.created).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
