import React, { useEffect, useState } from 'react';
import { Building2, MapPin, Plus, Pencil, Trash2, Loader2, Save } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Modal, Field, inputCls, btnPrimary, btnLine } from '@/components/erp/kit';

// A client's sites (home, office, branches). Clients can add their own in the app;
// staff can add, correct or remove them here.
const EMPTY = { name: '', address: '', latitude: '', longitude: '', contact_name: '', contact_phone: '', notes: '' };
const CAN_EDIT = ['super_admin', 'admin', 'sales', 'project_manager'];

export default function ClientSitesCard({ client }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sites, setSites] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const canEdit = CAN_EDIT.includes(user?.role);
  const load = () => pb.collection('client_sites').getFullList({ filter: `client = '${String(client.id).replace(/'/g, '')}'`, sort: 'name' }).then(setSites).catch(() => setSites([]));
  useEffect(() => { if (client?.id) load(); }, [client?.id]);

  const save = async () => {
    if (String(editing.name || '').trim().length < 2) { toast({ title: 'Give the site a name', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const body = { ...editing, client: client.id, latitude: editing.latitude === '' ? null : editing.latitude, longitude: editing.longitude === '' ? null : editing.longitude };
      delete body.id; delete body.created; delete body.updated; delete body.expand;
      if (editing.id) await pb.collection('client_sites').update(editing.id, body);
      else await pb.collection('client_sites').create(body);
      setEditing(null); load();
    } catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  const remove = async (s) => {
    if (!window.confirm(`Remove the site “${s.name}”? Requests already sent keep their address.`)) return;
    try { await pb.collection('client_sites').delete(s.id); load(); } catch (e) { toast({ title: 'Could not remove', description: e.message, variant: 'destructive' }); }
  };
  const set = (k) => (e) => setEditing((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold"><Building2 className="h-4 w-4 text-primary" /> Sites</h3>
          <p className="text-xs text-muted-foreground">Places we work for this client. The client can add their own in the app and pick one when they send a request.</p>
        </div>
        {canEdit && <button onClick={() => setEditing({ ...EMPTY })} className={btnLine}><Plus className="h-4 w-4" /> Add site</button>}
      </div>
      {sites.length === 0 ? <p className="text-sm text-muted-foreground">No sites yet.</p> : (
        <ul className="divide-y divide-border">
          {sites.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[s.address, s.contact_name, s.contact_phone].filter(Boolean).join(' · ') || '—'}</p>
              </div>
              {s.latitude != null && s.latitude !== '' && <a href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary"><MapPin className="h-3.5 w-3.5" /> Map</a>}
              {canEdit && <button onClick={() => setEditing({ ...EMPTY, ...s, latitude: s.latitude ?? '', longitude: s.longitude ?? '' })} className="rounded p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Edit"><Pencil className="h-4 w-4" /></button>}
              {canEdit && <button onClick={() => remove(s)} className="rounded p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? 'Edit site' : 'Add site'}>
          <div className="space-y-4">
            <Field label="Site name"><input className={inputCls} value={editing.name} onChange={set('name')} placeholder="e.g. Main office, Musanze branch" /></Field>
            <Field label="Address"><input className={inputCls} value={editing.address || ''} onChange={set('address')} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude (optional)"><input className={inputCls} inputMode="decimal" value={editing.latitude} onChange={set('latitude')} placeholder="-1.9441" /></Field>
              <Field label="Longitude (optional)"><input className={inputCls} inputMode="decimal" value={editing.longitude} onChange={set('longitude')} placeholder="30.0619" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact person"><input className={inputCls} value={editing.contact_name || ''} onChange={set('contact_name')} /></Field>
              <Field label="Contact phone"><input className={inputCls} value={editing.contact_phone || ''} onChange={set('contact_phone')} /></Field>
            </div>
            <Field label="Notes (staff only)"><input className={inputCls} value={editing.notes || ''} onChange={set('notes')} placeholder="e.g. Gate code, parking, generator room on level -1" /></Field>
            <div className="flex justify-end gap-2">
              <button className={btnLine} onClick={() => setEditing(null)}>Cancel</button>
              <button className={btnPrimary} onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
