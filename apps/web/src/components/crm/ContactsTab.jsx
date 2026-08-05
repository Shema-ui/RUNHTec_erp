import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Star, Phone, Mail, MessageSquare, Loader2, Edit2, X, Check } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';

function ContactCard({ contact, onDelete, onSetPrimary }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-all ${contact.is_primary ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{contact.full_name}</p>
            {contact.is_primary && (
              <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Star className="h-2.5 w-2.5" /> Primary
              </span>
            )}
          </div>
          {contact.position && <p className="text-xs text-muted-foreground">{contact.position}</p>}
        </div>
        <div className="flex gap-1">
          {!contact.is_primary && (
            <button onClick={() => onSetPrimary(contact)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Set as primary">
              <Star className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={async () => { setDeleting(true); await onDelete(contact.id); setDeleting(false); }}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {contact.mobile && (
          <a href={`tel:${contact.mobile}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" /> {contact.mobile}
          </a>
        )}
        {contact.whatsapp && (
          <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-green-600">
            <MessageSquare className="h-3.5 w-3.5 shrink-0" /> {contact.whatsapp}
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" /> {contact.email}
          </a>
        )}
        {contact.office && (
          <a href={`tel:${contact.office}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" /> {contact.office} (Office)
          </a>
        )}
      </div>
    </div>
  );
}

const inputCls = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function ContactsTab({ clientId }) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', position: '', mobile: '', office: '', whatsapp: '', email: '', is_primary: false });
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await pb.collection('client_contacts').getFullList({
        filter: `client = '${clientId}'`,
        sort: '-is_primary,full_name',
        requestKey: `contacts-${clientId}`,
      });
      setContacts(r);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    setSaving(true); setError('');
    try {
      await pb.collection('client_contacts').create({ ...form, client: clientId });
      setForm({ full_name: '', position: '', mobile: '', office: '', whatsapp: '', email: '', is_primary: false });
      setShowForm(false);
      await load();
    } catch (err) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await pb.collection('client_contacts').delete(id);
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const handleSetPrimary = async (contact) => {
    // Unset all, then set this one
    await Promise.all(contacts.map(c =>
      pb.collection('client_contacts').update(c.id, { is_primary: c.id === contact.id }, { requestKey: `prim-${c.id}` })
    ));
    await load();
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading contacts…</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Cancel' : 'Add Contact'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">New Contact Person</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Full Name *</label>
              <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="John Doe" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Position</label>
              <input value={form.position} onChange={e => setForm({...form, position: e.target.value})} placeholder="Facility Manager" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Mobile</label>
              <input value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} placeholder="+27 82 123 4567" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Office Number</label>
              <input value={form.office} onChange={e => setForm({...form, office: e.target.value})} placeholder="+27 12 123 4567" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">WhatsApp</label>
              <input value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} placeholder="+27 82 123 4567" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Email Address</label>
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" placeholder="john@company.com" className={inputCls} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input type="checkbox" id="is_primary" checked={form.is_primary} onChange={e => setForm({...form, is_primary: e.target.checked})} className="h-4 w-4" />
            <label htmlFor="is_primary" className="text-xs text-foreground">Set as primary contact</label>
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save Contact
            </button>
          </div>
        </form>
      )}

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">No contacts added yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Add a contact person above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map(c => (
            <ContactCard key={c.id} contact={c} onDelete={handleDelete} onSetPrimary={handleSetPrimary} />
          ))}
        </div>
      )}
    </div>
  );
}
