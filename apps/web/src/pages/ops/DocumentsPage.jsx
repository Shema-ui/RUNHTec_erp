import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { FolderArchive, FileText, ShieldCheck } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await pb.collection('documents').getList(1, 100, { sort: '-created' });
        setDocuments(result.items || []);
      } catch (error) {
        console.error('Documents load error', error);
      }
    };
    load();
  }, []);
  return (
    <PortalLayout title="Documents" subtitle="Centralized records and signed paperwork">
      <Helmet>
        <title>Documents | RUNHTec Business Portal</title>
        <meta name="description" content="Store and review client, project and contract documents." />
      </Helmet>

      <div className="grid gap-4">
        {documents.map((doc) => (
          <div key={doc.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-accent p-3 text-primary">
                <FolderArchive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">{doc.title}</h3>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><FileText className="h-4 w-4" /> {doc.type || 'Document'}</span>
                  <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> {doc.client || 'Shared record'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PortalLayout>
  );
}
