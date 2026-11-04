import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Modal, Field, inputCls, textareaCls, btnPrimary, btnLine } from '@/components/erp/kit';
import { CURRENCIES } from '@/lib/money';

const BLANK = { name: '', contact_name: '', phone: '', email: '', address: '', supplies: '', currency: 'RWF', status: 'active', notes: '' };

// Add or edit a vendor (supplier).
export default function VendorFormDialog({ open, onClose, vendor, onSaved }) {
  const { toast } = useToast();
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF(vendor ? { ...BLANK, ...vendor, notes: vendor.notes || '' } : BLANK); }, [open]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (f.name.trim().length < 2) { toast({ title: 'Write the vendor name', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const data = { name: f.name.trim(), contact_name: f.contact_name, phone: f.phone, email: f.email, address: f.address, supplies: f.supplies, currency: f.currency, status: f.status, notes: f.notes };
      const rec = vendor?.id ? await pb.collection('vendors').update(vendor.id, data) : await pb.collection('vendors').create(data);
      toast({ title: vendor?.id ? 'Vendor updated' : 'Vendor added', description: vendor?.id ? undefined : 'Now create their access link so they can add their prices.' });
      onSaved?.(rec); onClose();
    } catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={vendor?.id ? 'Edit vendor' : 'Add a vendor'} description="A supplier we buy materials or services from.">
      <div className="space-y-4">
        <Field label="Vendor / shop name" required><input className={inputCls} autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Kigali Solar Supplies Ltd" aria-label="Vendor name" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact person"><input className={inputCls} value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} /></Field>
          <Field label="Phone / WhatsApp"><input className={inputCls} value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+250 7XX XXX XXX" /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Address"><input className={inputCls} value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        </div>
        <Field label="What they supply"><input className={inputCls} value={f.supplies} onChange={(e) => set('supplies', e.target.value)} placeholder="e.g. Solar panels, inverters, cables" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Usual currency"><select className={inputCls} value={f.currency} onChange={(e) => set('currency', e.target.value)}>{CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
          <Field label="Status"><select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}><option value="active">Active</option><option value="inactive">Not used any more</option></select></Field>
        </div>
        <Field label="Internal notes" hint="Only staff see this, never the vendor."><textarea className={textareaCls} rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Payment terms, reliability, discounts…" /></Field>
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {vendor?.id ? 'Save changes' : 'Add vendor'}</button>
        </div>
      </div>
    </Modal>
  );
}
