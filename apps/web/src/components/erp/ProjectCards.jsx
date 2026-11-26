// A worker's project cards: each job they have been on. No prices, values or client names.
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Download, Briefcase, MapPin, Camera } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { savePdf } from '@/lib/pdfExport';
import { useToast } from '@/hooks/use-toast';

const STATUS = { new: 'New', planned: 'Planned', active: 'Active', in_progress: 'In progress', done: 'Done', on_hold: 'On hold' };
const fmt = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function ProjectCards() {
  const { toast } = useToast();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    pb.workHistory.me().then((r) => setItems(r.items || [])).catch(() => setItems([]));
  }, []);

  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    try { await savePdf(ref.current, 'my-project-cards.pdf'); }
    catch (e) { toast({ title: 'Could not save PDF', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  return (
    <section id="project-cards" className="mt-8 scroll-mt-20 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">My project cards</h2>
          <p className="text-sm text-muted-foreground">Every job you have been on. Kept here automatically.</p>
        </div>
        {items && items.length > 0 && (
          <button type="button" onClick={download} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Save as PDF
          </button>
        )}
      </div>

      {items === null && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      {items && items.length === 0 && <p className="text-sm text-muted-foreground">No project cards yet. They appear here once you are on a project team.</p>}

      <div ref={ref} className="grid gap-4 sm:grid-cols-2">
        {(items || []).map((p) => (
          <article key={p.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{p.code || 'Project'}{p.category ? ` · ${p.category}` : ''}</p>
                <h3 className="font-display text-base font-bold text-foreground">{p.title}</h3>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">{STATUS[p.status] || p.status}</span>
            </div>
            {p.summary && <p className="text-sm text-muted-foreground">{p.summary}</p>}
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {p.role}</span>
              <span>Team of {p.team_size}</span>
              <span>{fmt(p.start)} → {fmt(p.end)}</span>
              {p.area && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {p.area}</span>}
              {p.photos > 0 && <span className="inline-flex items-center gap-1"><Camera className="h-3.5 w-3.5" /> {p.photos} photos</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
