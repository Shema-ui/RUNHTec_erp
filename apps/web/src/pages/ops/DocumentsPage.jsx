import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Upload, FileText, Download } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import DocumentUploadDialog, { DOCUMENT_TYPES } from '@/components/erp/DocumentUploadDialog';
import { Toolbar, SearchBox, Loading, Empty, btnPrimary, fmtDate } from '@/components/erp/kit';

export default function DocumentsPage() {
  const [docs, setDocs] = useState(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [uploading, setUploading] = useState(false);

  const load = () => pb.collection('documents').getFullList({ sort: '-created', expand: 'client,project' })
    .then(setDocs).catch(() => setDocs([]));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => (docs || []).filter((d) => {
    if (type !== 'all' && d.type !== type) return false;
    if (q && ![d.title, d.type, d.expand?.client?.company_name, d.expand?.project?.title, d.notes].join(' ').toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [docs, q, type]);

  return (
    <PortalLayout title="Documents" subtitle="Contracts, drawings, certificates and site records">
      <Helmet><title>Documents | RUNHTec Business Portal</title></Helmet>

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search title, client or project" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="all">All types</option>
          {DOCUMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className={`${btnPrimary} ml-auto`} onClick={() => setUploading(true)}><Upload className="h-4 w-4" /> Upload document</button>
      </Toolbar>

      {!docs ? <Loading /> : filtered.length === 0 ? (
        <Empty>No documents yet. Upload contracts, drawings, BOQs, test certificates and handover documents here or from a project page.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Document</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Added</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-2 font-medium"><FileText className="h-4 w-4 text-muted-foreground" />{d.title}</span>{d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}</td>
                  <td className="px-4 py-3">{d.type || '—'}</td>
                  <td className="px-4 py-3">{d.client ? <Link to={`/crm/clients/${d.client}`} className="hover:text-primary">{d.expand?.client?.company_name || '—'}</Link> : '—'}</td>
                  <td className="px-4 py-3">{d.project ? <Link to={`/projects/${d.project}`} className="hover:text-primary">{d.expand?.project?.title || '—'}</Link> : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(d.created)}{d.uploaded_by_name ? ` · ${d.uploaded_by_name}` : ''}</td>
                  <td className="px-4 py-3">{d.file && <a href={pb.files.getURL(d, d.file)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Download className="h-4 w-4" /> Open</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DocumentUploadDialog open={uploading} onClose={() => setUploading(false)} onSaved={load} />
    </PortalLayout>
  );
}
