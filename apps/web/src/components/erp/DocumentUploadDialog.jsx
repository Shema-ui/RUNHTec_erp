import React, { useEffect, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Modal, Field, inputCls, textareaCls, btnPrimary, btnLine, toBody } from '@/components/erp/kit';

export const DOCUMENT_TYPES = [
  'Contract / agreement', 'Drawing / design', 'Bill of quantities (BOQ)', 'Purchase order', 'Delivery note',
  'Site report', 'Inspection / test certificate', 'Handover / completion certificate', 'Photo', 'Warranty', 'Permit / licence', 'Other',
];

export default function DocumentUploadDialog({ open, onClose, onSaved, project, client }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ title: '', type: DOCUMENT_TYPES[0], client: '', project: '', notes: '' });
  const [file, setFile] = useState(null);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ title: '', type: DOCUMENT_TYPES[0], client: client || project?.client || '', project: project?.id || '', notes: '' });
    setFile(null);
    if (!project) {
      pb.collection('clients').getFullList({ sort: 'company_name' }).then(setClients).catch(() => {});
      pb.collection('projects').getFullList({ sort: '-created' }).then(setProjects).catch(() => {});
    }
  }, [open]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!file) { toast({ title: 'Choose a file to upload', variant: 'destructive' }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'File too large', description: 'Maximum 5 MB per file.', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await pb.collection('documents').create(toBody({
        title: form.title || file.name,
        type: form.type,
        client: form.client || '',
        project: form.project || '',
        notes: form.notes,
        uploaded_by_name: user?.name || user?.email || '',
      }, { file }));
      toast({ title: 'Document uploaded' });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Upload a document" description="PDF, Word, Excel or photo, up to 5 MB.">
      <div className="space-y-4">
        <Field label="File" required><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm" /></Field>
        <Field label="Title"><input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Defaults to the file name" /></Field>
        <Field label="Type">
          <select className={inputCls} value={form.type} onChange={(e) => set('type', e.target.value)}>
            {DOCUMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        {!project && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client">
              <select className={inputCls} value={form.client} onChange={(e) => set('client', e.target.value)}>
                <option value="">None</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </Field>
            <Field label="Project">
              <select className={inputCls} value={form.project} onChange={(e) => set('project', e.target.value)}>
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
          </div>
        )}
        <Field label="Notes"><textarea className={textareaCls} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload</button>
        </div>
      </div>
    </Modal>
  );
}
