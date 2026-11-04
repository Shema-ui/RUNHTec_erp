import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Loader2, ImagePlus, Trash2, Save, ChevronLeft, ChevronRight, Pencil, Share2, EyeOff, Globe } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, Modal, Field, inputCls, textareaCls, btnPrimary, btnLine, fmtDate, todayISO, toBody } from '@/components/erp/kit';
import { compressImage } from '@/lib/images';

const MANAGERS = ['super_admin', 'admin', 'project_manager'];

// Daily progress photos for a project, grouped by day.
export default function SitePhotosCard({ project, canAdd }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null); // index into flat list

  const load = () => pb.collection('project_photos').getFullList({ filter: `project = '${project.id}'`, sort: '-taken_on' })
    .then((list) => setPhotos(list.sort((a, b) => String(b.taken_on).localeCompare(String(a.taken_on)) || String(b.created).localeCompare(String(a.created)))))
    .catch(() => setPhotos([]));
  useEffect(() => { load(); }, [project.id]);

  const days = useMemo(() => {
    const m = new Map();
    (photos || []).forEach((ph, i) => {
      const k = ph.taken_on || String(ph.created).slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push({ ...ph, _i: i });
    });
    return [...m.entries()];
  }, [photos]);

  const canChange = (ph) => MANAGERS.includes(user?.role) || ph.uploaded_by === user?.id;
  const canShare = MANAGERS.includes(user?.role);
  const shareDay = async (list, on) => {
    try {
      for (const ph of list) if (Boolean(Number(ph.shared)) !== on) await pb.collection('project_photos').update(ph.id, { shared: on ? 1 : 0 });
      toast({ title: on ? 'Shared with the client' : 'Hidden from the client', description: on ? 'They see these photos in their portal and get an alert.' : undefined });
      load();
    } catch (e) { toast({ title: 'Could not change', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Card
      title={<span className="inline-flex items-center gap-2"><Camera className="h-4 w-4" /> Daily site photos</span>}
      action={canAdd && <button className={btnPrimary} onClick={() => setAdding(true)}><ImagePlus className="h-4 w-4" /> Add today’s photos</button>}
    >
      {!photos ? <p className="text-sm text-muted-foreground">Loading…</p> : photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canAdd ? 'No photos yet. Each day on site, take a few photos of the work and add them here with a short note on what was done.' : 'No photos yet. The technicians on this project add progress photos here each day.'}
        </p>
      ) : (
        <div className="space-y-5">
          {days.map(([day, list]) => (
            <div key={day}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold">{fmtDate(day)}</h4>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{list.length} photo{list.length === 1 ? '' : 's'} · {[...new Set(list.map((x) => x.uploaded_by_name).filter(Boolean))].join(', ')}
                  {canShare && (list.every((x) => Number(x.shared))
                    ? <button onClick={() => shareDay(list, false)} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-medium hover:bg-secondary"><EyeOff className="h-3 w-3" /> Hide day from client</button>
                    : <button onClick={() => shareDay(list, true)} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 font-medium text-white hover:bg-emerald-700"><Share2 className="h-3 w-3" /> Share this day with client</button>)}
                </span>
              </div>
              {[...new Set(list.map((x) => x.caption).filter(Boolean))].map((c) => <p key={c} className="mb-2 text-sm text-foreground">{c}</p>)}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {list.map((ph) => (
                  <button key={ph.id} type="button" onClick={() => setOpen(ph._i)} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-secondary" aria-label={`Open photo from ${fmtDate(day)}`}>
                    {ph.photo && <img src={pb.files.getURL(ph, ph.photo)} alt={ph.caption || 'Site photo'} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />}
                    {Number(ph.shared) ? <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"><Globe className="h-2.5 w-2.5" /> Client</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddPhotosDialog open={adding} onClose={() => setAdding(false)} project={project} onSaved={load} canShare={canShare} />
      {open !== null && photos?.[open] && (
        <PhotoViewer
          photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)}
          canChange={canChange(photos[open])}
          canShare={canShare}
          onChanged={() => { load(); }}
          onDeleted={() => { setOpen(null); load(); toast({ title: 'Photo removed' }); }}
        />
      )}
    </Card>
  );
}

function AddPhotosDialog({ open, onClose, project, onSaved, canShare }) {
  const { toast } = useToast();
  const [date, setDate] = useState(todayISO());
  const [files, setFiles] = useState([]);
  const [caption, setCaption] = useState('');
  const [share, setShare] = useState(false);
  const [progress, setProgress] = useState(null);
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => { if (open) { setDate(todayISO()); setFiles([]); setCaption(''); setShare(false); setProgress(null); setInputKey((k) => k + 1); } }, [open]);
  const previews = useMemo(() => files.map((f) => ({ f, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const save = async () => {
    if (!files.length) { toast({ title: 'Choose at least one photo', variant: 'destructive' }); return; }
    let done = 0; let failed = 0;
    setProgress(0);
    for (const f of files) {
      try {
        const small = await compressImage(f);
        await pb.collection('project_photos').create(toBody({ project: project.id, taken_on: date, caption, ...(canShare && share ? { shared: 1 } : {}) }, { photo: small }));
        done++;
      } catch (e) { failed++; if (failed === 1) toast({ title: 'A photo could not be uploaded', description: e.message, variant: 'destructive' }); }
      setProgress(done + failed);
    }
    if (done) toast({ title: `${done} photo${done === 1 ? '' : 's'} added`, description: fmtDate(date) });
    setProgress(null);
    onSaved();
    if (!failed) onClose();
  };

  const busy = progress !== null;
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Add site photos" description="Take or choose photos of today’s work. They are made smaller automatically so they upload quickly.">
      <div className="space-y-4">
        <Field label="Photos" required>
          <input key={inputKey} type="file" accept="image/*" multiple aria-label="Choose photos" className="block w-full text-sm"
            onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 20))} />
        </Field>
        {previews.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                {!busy && <button type="button" onClick={() => setFiles((list) => list.filter((_, j) => j !== i))} aria-label="Remove photo" className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"><Trash2 className="h-3 w-3" /></button>}
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
          <Field label="Date taken"><input type="date" className={inputCls} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="What was done today"><textarea className={textareaCls} rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Mounted 8 panels on the roof, ran DC cables to inverter room" aria-label="What was done today" /></Field>
        </div>
        {canShare && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={share} onChange={(e) => setShare(e.target.checked)} />
            <span><span className="font-medium">Share with the client</span><span className="block text-xs text-muted-foreground">They will see these photos in their portal. You can change this later.</span></span>
          </label>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {busy && <span className="mr-auto text-sm text-muted-foreground">Uploading {progress} of {files.length}…</span>}
          <button className={btnLine} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Upload {files.length || ''} photo{files.length === 1 ? '' : 's'}</button>
        </div>
      </div>
    </Modal>
  );
}

function PhotoViewer({ photos, index, onIndex, onClose, canChange, canShare, onChanged, onDeleted }) {
  const { toast } = useToast();
  const ph = photos[index];
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(ph.caption || '');
  const [date, setDate] = useState(ph.taken_on || '');
  useEffect(() => { setEditing(false); setCaption(ph.caption || ''); setDate(ph.taken_on || ''); }, [ph.id]);

  const save = async () => {
    try { await pb.collection('project_photos').update(ph.id, { caption, taken_on: date }); setEditing(false); onChanged(); toast({ title: 'Photo updated' }); }
    catch (e) { toast({ title: 'Could not save', description: e.message, variant: 'destructive' }); }
  };
  const shared = Boolean(Number(ph.shared));
  const toggleShare = async () => {
    try { await pb.collection('project_photos').update(ph.id, { shared: shared ? 0 : 1 }); onChanged(); toast({ title: shared ? 'Hidden from the client' : 'Shared with the client' }); }
    catch (e) { toast({ title: 'Could not change', description: e.message, variant: 'destructive' }); }
  };
  const remove = async () => {
    if (!window.confirm('Remove this photo?')) return;
    try { await pb.collection('project_photos').delete(ph.id); onDeleted(); }
    catch (e) { toast({ title: 'Could not remove', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Modal open onClose={onClose} wide title={fmtDate(ph.taken_on || ph.created)} description={ph.uploaded_by_name ? `Added by ${ph.uploaded_by_name}` : undefined}>
      <div className="space-y-3">
        <div className="relative flex items-center justify-center overflow-hidden rounded-xl bg-black">
          {ph.photo && <img src={pb.files.getURL(ph, ph.photo)} alt={ph.caption || 'Site photo'} className="max-h-[65vh] w-auto object-contain" />}
          {index > 0 && <button onClick={() => onIndex(index - 1)} aria-label="Previous photo" className="absolute left-2 rounded-full bg-black/60 p-2 text-white"><ChevronLeft className="h-5 w-5" /></button>}
          {index < photos.length - 1 && <button onClick={() => onIndex(index + 1)} aria-label="Next photo" className="absolute right-2 rounded-full bg-black/60 p-2 text-white"><ChevronRight className="h-5 w-5" /></button>}
        </div>
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <Field label="Date taken"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Note"><textarea className={textareaCls} rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} /></Field>
          </div>
        ) : (ph.caption && <p className="text-sm">{ph.caption}</p>)}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{index + 1} of {photos.length}{shared ? ' · the client can see this photo' : ''}</span>
          <div className="flex flex-wrap gap-2">
            {canShare && <button className={shared ? btnLine : btnPrimary} onClick={toggleShare}>{shared ? <><EyeOff className="h-4 w-4" /> Hide from client</> : <><Share2 className="h-4 w-4" /> Share with client</>}</button>}
            <a className={btnLine} href={pb.files.getURL(ph, ph.photo)} target="_blank" rel="noreferrer">Open full size</a>
            {canChange && !editing && <button className={btnLine} onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</button>}
            {canChange && editing && <button className={btnPrimary} onClick={save}><Save className="h-4 w-4" /> Save</button>}
            {canChange && <button className={btnLine} onClick={remove}><Trash2 className="h-4 w-4" /> Remove</button>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
