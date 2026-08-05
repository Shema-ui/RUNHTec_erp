import React, { useEffect, useState } from 'react';
import { Plus, X, Loader2, Check, Trash2, FileText, Download } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { DOC_TYPES } from '@/lib/crm';

const inputCls = 'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function DocumentsTab({ clientId }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', doc_type: 'other' });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await pb.collection('client_documents').getFullList({
        filter: `client = '${clientId}'`,
        sort: '-created',
        requestKey: `docs-${clientId}`,
      });
      setDocs(r);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Document title is required'); return; }
    if (!file) { setError('Please select a file to upload'); return; }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('doc_type', form.doc_type);
      fd.append('client', clientId);
      fd.append('uploaded_by', user?.id || '');
      fd.append('uploaded_by_name', user?.name || user?.email || '');
      fd.append('file', file);
      await pb.collection('client_documents').create(fd);
      setForm({ title: '', doc_type: 'other' });
      setFile(null);
      setShowForm(false);
      await load();
    } catch (err) { setError(err.message || 'Failed to upload'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this document?')) return;
    await pb.collection('client_documents').delete(id);
    setDocs(prev => prev.filter(d => d.id !== id));
  };

  const getFileUrl = (doc) => pb.files.getURL(doc, doc.file);

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading documents…</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{docs.length} document{docs.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Cancel' : 'Upload Document'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Upload Document</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Document Title *</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Service Contract 2024" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Document Type</label>
              <select value={form.doc_type} onChange={e => setForm({...form, doc_type: e.target.value})} className={inputCls}>
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground">File *</label>
              <input type="file" onChange={e => setFile(e.target.files[0])} className="w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground" />
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <div className="mt-3">
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Upload
            </button>
          </div>
        </form>
      )}

      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {docs.map(doc => {
            const typeInfo = DOC_TYPES.find(t => t.value === doc.doc_type);
            return (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-8 w-8 shrink-0 text-primary/60" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {typeInfo?.label || doc.doc_type} · {doc.uploaded_by_name} · {new Date(doc.created).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1">
                  {doc.file && (
                    <a href={getFileUrl(doc)} target="_blank" rel="noreferrer" download className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Download">
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                  <button onClick={() => handleDelete(doc.id)} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
