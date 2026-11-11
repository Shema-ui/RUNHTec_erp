import React, { useEffect, useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Modal, Field, inputCls, btnPrimary, btnLine } from '@/components/erp/kit';

// "+ New client" on the quotation and invoice forms. Adds the client (and the
// contact person) to the CRM, or finds the existing one with the same name,
// email or phone, then hands it back to the form.
export default function NewClientDialog({ open, onClose, initialName = '', onCreated }) {
  const { toast } = useToast();
  const [f, setF] = useState({ company: '', name: '', phone: '', email: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setF({ company: initialName, name: '', phone: '', email: '', address: '' }); setErr(''); } }, [open]);
  if (!open) return null;
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setErr('');
    if ((f.company || f.name).trim().length < 2) { setErr('Type the company or the person’s full name.'); return; }
    setBusy(true);
    try {
      const client = await pb.post('/api/crm/quick-client', f);
      toast({ title: client.existed ? 'Client already in the CRM' : 'Client added to the CRM', description: client.company_name });
      onCreated?.(client, f); onClose();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="New client" description="Saved in CRM → Clients. If the client is already there (same name, email or phone), that one is used.">
      <div className="space-y-4">
        <Field label="Company name (or the person’s full name for a private client)"><input className={inputCls} value={f.company} onChange={set('company')} autoFocus /></Field>
        <Field label="Contact person"><input className={inputCls} value={f.name} onChange={set('name')} placeholder="e.g. Aline Uwase" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone"><input className={inputCls} type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="+250 788 123 456" /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={f.email} onChange={set('email')} placeholder="name@company.rw" /></Field>
        </div>
        <Field label="Address"><input className={inputCls} value={f.address} onChange={set('address')} placeholder="e.g. KN 5 Rd, Kiyovu, Kigali" /></Field>
        {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add client</button>
        </div>
      </div>
    </Modal>
  );
}
