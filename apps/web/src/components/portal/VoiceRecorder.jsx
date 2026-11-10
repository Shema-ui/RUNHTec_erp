import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';

// Records a short voice note on the phone (up to MAX_SECONDS) and hands back a File.
const MAX_SECONDS = 120;
const TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

export default function VoiceRecorder({ value, onChange }) {
  const { t } = useLang();
  const [rec, setRec] = useState(null);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState('');
  const chunks = useRef([]);
  const timer = useRef(null);
  const url = React.useMemo(() => (value ? URL.createObjectURL(value) : ''), [value]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { clearInterval(timer.current); rec?.stream?.getTracks().forEach((x) => x.stop()); }, [rec]);

  const supported = typeof window !== 'undefined' && window.MediaRecorder && navigator.mediaDevices?.getUserMedia;

  const start = async () => {
    setErr('');
    if (!supported) { setErr(t('Voice notes don’t work in this browser. Please type instead.')); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = TYPES.find((x) => window.MediaRecorder.isTypeSupported?.(x)) || '';
      const r = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data?.size) chunks.current.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach((x) => x.stop());
        clearInterval(timer.current);
        const type = (r.mimeType || mimeType || 'audio/webm').split(';')[0];
        const blob = new Blob(chunks.current, { type });
        if (blob.size) onChange(new File([blob], `voice-note.${type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'}`, { type }));
        setRec(null);
      };
      r.start();
      setRec(r); setSecs(0);
      timer.current = setInterval(() => setSecs((s) => { if (s + 1 >= MAX_SECONDS) r.state === 'recording' && r.stop(); return s + 1; }), 1000);
    } catch {
      setErr(t('Allow the microphone to record a voice note.'));
    }
  };
  const stop = () => { if (rec?.state === 'recording') rec.stop(); };
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-slate-50 p-2">
        <audio controls src={url} className="h-10 min-w-0 flex-1" />
        <button type="button" onClick={() => onChange(null)} aria-label={t('Delete voice note')} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-5 w-5" /></button>
      </div>
    );
  }
  return (
    <div>
      {rec ? (
        <button type="button" onClick={stop} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-semibold text-white">
          <Square className="h-4 w-4 fill-white" /> {t('Recording… tap to stop')} <span className="tabular-nums">{mmss(secs)}</span>
        </button>
      ) : (
        <button type="button" onClick={start} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-700">
          <Mic className="h-5 w-5 text-[#003DA5]" /> {t('Record a voice note')}
        </button>
      )}
      {err && <p className="mt-1.5 text-sm text-rose-700">{err}</p>}
    </div>
  );
}
