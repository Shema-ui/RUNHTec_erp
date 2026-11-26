// Registration for a new staff member: read the agreement, draw a signature, type your name.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Eraser, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

const card = 'rounded-2xl border border-border bg-card p-5 shadow-sm';
const btn = 'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50';

// Drawn signature. Works with a finger, a stylus or a mouse.
function SignaturePad({ onChange }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const ink = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const point = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (ref.current.width / r.width), y: (e.clientY - r.top) * (ref.current.height / r.height) };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = point(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = point(e);
    const ctx = ref.current.getContext('2d');
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
    if (!ink.current) { ink.current = true; setHasInk(true); }
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(ink.current ? ref.current.toDataURL('image/png') : '');
  };
  const clear = () => {
    const c = ref.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    ink.current = false; setHasInk(false); onChange('');
  };

  return (
    <div>
      <canvas
        ref={ref}
        width={800}
        height={260}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        style={{ touchAction: 'none', width: '100%', aspectRatio: '800 / 260' }}
        className="rounded-lg border-2 border-dashed border-border bg-white"
        aria-label="Draw your signature here"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{hasInk ? 'Signature drawn.' : 'Draw your signature inside the box.'}</span>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><Eraser className="h-3.5 w-3.5" /> Clear</button>
      </div>
    </div>
  );
}

function Step({ n, label, state }) {
  const done = state === 'done';
  const active = state === 'active';
  return (
    <li className="flex items-center gap-3">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-600 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : n}
      </span>
      <span className={`text-sm ${active ? 'font-semibold text-foreground' : done ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
    </li>
  );
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [signature, setSignature] = useState('');
  const [saving, setSaving] = useState(false);
  const onSignature = useCallback((v) => setSignature(v), []);

  const load = () => pb.onboarding.me().then(setState).catch(() => setState({ error: true })).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (state?.registration_complete) navigate('/dashboard', { replace: true }); }, [state, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (!agree) return toast({ title: 'Tick the box to agree first', variant: 'destructive' });
    if (!signature) return toast({ title: 'Draw your signature first', variant: 'destructive' });
    if (!name.trim()) return toast({ title: 'Type your full name', variant: 'destructive' });
    setSaving(true);
    try {
      await pb.onboarding.sign({ signed_name: name, signature, agree: true });
      toast({ title: 'Agreement signed', description: 'HR and your project manager will review it.' });
      await load();
    } catch (err) {
      toast({ title: 'Could not sign', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!state || state.error) return <div className={card}><p className="text-sm">We could not load your registration. Refresh the page and try again.</p></div>;

  const c = state.contract;
  const contractStatus = c?.status;
  const canSign = state.profile_complete && c && ['issued', 'changes_requested'].includes(contractStatus);
  const stepState = {
    profile: state.profile_complete ? 'done' : 'active',
    sign: !state.profile_complete ? 'todo' : ['signed', 'approved'].includes(contractStatus) ? 'done' : 'active',
    review: contractStatus === 'approved' ? 'done' : contractStatus === 'signed' ? 'active' : 'todo',
    complete: 'todo',
  };

  return (
    <>
      <Helmet><title>Finish your registration — RUNHTec</title></Helmet>
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Finish your registration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.name ? `Welcome, ${user.name.split(' ')[0]}. ` : ''}Your projects and client pages open once you have signed the agreement and HR has confirmed your registration.
          </p>
        </div>

        <ol className={`${card} space-y-3`}>
          <Step n={1} label="Complete your profile" state={stepState.profile} />
          <Step n={2} label="Read and sign the agreement" state={stepState.sign} />
          <Step n={3} label="HR and project manager review" state={stepState.review} />
          <Step n={4} label="HR confirms your registration" state={stepState.complete} />
        </ol>

        {!state.profile_complete && (
          <div className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
            <p className="text-sm">First, fill in your profile: photo, personal details, ID copy and certificates.</p>
            <Link to="/my-profile" className={btn}>Go to my profile</Link>
          </div>
        )}

        {state.profile_complete && contractStatus === 'changes_requested' && (
          <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div><p className="font-semibold">Changes were requested</p><p className="mt-1 whitespace-pre-wrap">{c.review_notes}</p><p className="mt-2">Read the agreement again, then sign it below.</p></div>
          </div>
        )}

        {state.profile_complete && contractStatus === 'signed' && (
          <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Thank you. Your signed agreement is with HR and your project manager. You will be notified when it is reviewed.</p>
          </div>
        )}

        {contractStatus === 'approved' && (
          <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Your agreement is approved. HR will confirm your registration, and then your projects open. Refresh the page after you are notified.</p>
          </div>
        )}

        {canSign && (
          <form onSubmit={submit} className={`${card} space-y-5`}>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">{c.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">Version {c.version} · Read the whole agreement before you sign.</p>
            </div>
            <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">{c.body}</div>

            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4" />
              <span>I have read this agreement, I understand it, and I agree to be bound by it.</span>
            </label>

            <div>
              <label htmlFor="signed-name" className="mb-1 block text-sm font-semibold text-foreground">Type your full name as on your profile</label>
              <input id="signed-name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="e.g. Jean Claude Habimana" autoComplete="name" />
            </div>

            <div>
              <p className="mb-1 text-sm font-semibold text-foreground">Your signature</p>
              <SignaturePad onChange={onSignature} />
            </div>

            <button type="submit" disabled={saving} className={`${btn} w-full`}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Sign agreement
            </button>
          </form>
        )}

        {state.profile_complete && c && !canSign && contractStatus !== 'approved' && contractStatus !== 'signed' && (
          <p className="text-sm text-muted-foreground">Your agreement is being prepared. Refresh the page in a moment.</p>
        )}
      </div>
    </>
  );
}
