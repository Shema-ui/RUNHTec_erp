import React, { useEffect, useState } from 'react';
import { Mail, Loader2, Send, CheckCircle2, MessageCircle } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Modal, Field, inputCls, textareaCls, btnPrimary, btnLine } from '@/components/erp/kit';

// Email a quotation or invoice (PDF attached) from the company email.
// The message always starts "Dear RUNHTec Customer," (the server makes sure).
// The standard wording is edited in Settings → Email.

const when = (v) => {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T') + (String(v).includes('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Sends automatically when the document is marked Sent and the client has an email.
// Returns { sent, to } or { skipped: 'off' | 'noemail' | 'already' }.
export async function autoEmail({ type, id, makePdf }) {
  const prep = await pb.get(`/api/doc-email/prepare?type=${type}&id=${encodeURIComponent(id)}`);
  if (!prep.enabled) return { skipped: 'off' };
  if (!prep.to) return { skipped: 'noemail' };
  if (prep.emailed_at) return { skipped: 'already', to: prep.emailed_to };
  const pdf = await makePdf();
  const r = await pb.post('/api/doc-email/send', { type, id, to: prep.to, subject: prep.subject, body: prep.body, pdf, auto: true });
  return { sent: true, to: r.to, status: r.status, emailed_at: r.emailed_at };
}

// Toast after an automatic attempt.
export function autoEmailToast(toast, res, word) {
  if (res?.sent) toast({ title: `${word} emailed to the client`, description: res.to });
  else if (res?.skipped === 'noemail') toast({ title: `${word} marked Sent: not emailed`, description: 'The client has no email address in the system. Use the Email button to send it to any address.' });
}

export function EmailedNote({ doc }) {
  if (!doc?.emailed_at) return null;
  return (
    <div className="no-print mx-auto mt-3 flex max-w-5xl items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
      <CheckCircle2 className="h-4 w-4 shrink-0" /> Emailed to <b className="font-semibold">{doc.emailed_to}</b> · {when(doc.emailed_at)}
    </div>
  );
}

export function EmailDocButton({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-lg border border-[#003DA5] px-3 py-1.5 text-sm font-semibold text-[#003DA5] hover:bg-blue-50">
      <Mail className="h-4 w-4" /> Email
    </button>
  );
}

export function EmailDocDialog({ open, onClose, type, id, number, makePdf, onSent }) {
  const { toast } = useToast();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!open) return;
    setF(null); setErr('');
    pb.get(`/api/doc-email/prepare?type=${type}&id=${encodeURIComponent(id)}`)
      .then((p) => setF({ to: p.to || '', cc: '', subject: p.subject, body: p.body, enabled: p.enabled, emailed_at: p.emailed_at, emailed_to: p.emailed_to }))
      .catch((e) => setErr(e.message));
  }, [open, type, id]);
  if (!open) return null;
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const send = async () => {
    setErr('');
    if (!f.to.trim()) { setErr('Add at least one email address.'); return; }
    setBusy(true);
    try {
      const pdf = await makePdf();
      const r = await pb.post('/api/doc-email/send', { type, id, to: f.to, cc: f.cc, subject: f.subject, body: f.body, pdf });
      toast({ title: 'Email sent', description: `${number} sent to ${r.to}` });
      onSent?.(r); onClose();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const label = type === 'invoice' ? 'invoice' : 'quotation';
  return (
    <Modal open onClose={onClose} wide title={`Email ${label} ${number || ''}`} description="Sent from the company email with the PDF attached. Replies come back to the company inbox.">
      {!f ? (
        <div className="flex justify-center py-10">{err ? <p className="text-sm text-rose-700">{err}</p> : <Loader2 className="h-6 w-6 animate-spin text-primary" />}</div>
      ) : (
        <div className="space-y-4">
          {!f.enabled && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Email is not set up yet. The Super Admin can switch it on in Settings → Email.</p>}
          {f.emailed_at && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">Already emailed to {f.emailed_to} on {when(f.emailed_at)}. Sending again is fine.</p>}
          <Field label="To (separate several addresses with commas)"><input className={inputCls} type="email" multiple value={f.to} onChange={set('to')} placeholder="client@example.com" /></Field>
          <Field label="CC (optional)"><input className={inputCls} type="email" multiple value={f.cc} onChange={set('cc')} placeholder="manager@example.com" /></Field>
          <Field label="Subject"><input className={inputCls} value={f.subject} onChange={set('subject')} /></Field>
          <Field label="Message"><textarea className={textareaCls} rows={12} value={f.body} onChange={set('body')} /></Field>
          <p className="text-xs text-muted-foreground">Attached: {number || label}.pdf, the same client copy as “Download PDF” (no buying prices). The message always starts “Dear RUNHTec Customer,”.</p>
          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnLine} onClick={onClose}>Cancel</button>
            <button className={btnPrimary} onClick={send} disabled={busy || !f.enabled}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {busy ? 'Preparing PDF…' : 'Send email'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Send by WhatsApp ───────────────────────────────────────────────────────────
// WhatsApp can't be sent from here by itself without a paid WhatsApp service, so the
// PDF and the message are handed to WhatsApp and the person taps Send there. On a phone
// that opens the share sheet with the PDF attached; on a computer the PDF is downloaded
// and the WhatsApp chat opens with the message ready.
function fileFromBase64(b64, name) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: 'application/pdf' });
}
function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

export function WhatsAppDocDialog({ open, onClose, type, id, number, makePdf, onSent }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoaded(false); setErr(''); setDownloaded(false); setBusy(false);
    pb.get(`/api/doc-email/prepare?type=${type}&id=${encodeURIComponent(id)}`)
      .then((p) => { setPhone(String(p.phone || '').replace(/[^\d+]/g, '')); setMessage(p.body || ''); setLoaded(true); })
      .catch((e) => { setErr(e.message); setLoaded(true); });
  }, [open, type, id]);
  if (!open) return null;

  const digits = phone.replace(/\D/g, '');
  const markSent = async () => {
    try {
      const r = await pb.post('/api/doc-email/whatsapp-sent', { type, id, phone: digits });
      toast({ title: 'Marked as sent', description: `${number || type} was sent on WhatsApp.` });
      onSent?.(r); onClose();
    } catch (e) { setErr(e.message); }
  };
  const send = async () => {
    setErr('');
    if (digits.length < 9) { setErr('Add the client’s WhatsApp number, with its country code.'); return; }
    setBusy(true);
    try {
      const b64 = await makePdf();
      const name = `${String(number || type).replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
      const file = fileFromBase64(b64, name);
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: message, title: number || name });
          await markSent();
        } catch (e) { if (e?.name !== 'AbortError') setErr('Could not open the share menu. Try again, or use a computer.'); }
      } else {
        downloadFile(file);
        window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
        setDownloaded(true);
      }
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const label = type === 'invoice' ? 'invoice' : 'quotation';
  return (
    <Modal open onClose={onClose} wide title={`Send ${label} ${number || ''} on WhatsApp`} description="The PDF and the message open in WhatsApp. You tap Send there.">
      {!loaded ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4">
          <Field label="WhatsApp number (with country code)"><input className={inputCls} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+250 788 123 456" /></Field>
          <Field label="Message"><textarea className={textareaCls} rows={9} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
          <p className="text-xs text-muted-foreground">Attached: {number || label}.pdf, the same client copy as “Download PDF” (no buying prices).</p>
          {downloaded && (
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
              The PDF has been downloaded and WhatsApp is open. Attach the PDF in WhatsApp, tap Send, then come back here and tap <b>I’ve sent it</b>.
            </div>
          )}
          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button className={btnLine} onClick={onClose}>Cancel</button>
            {downloaded
              ? <button className={btnPrimary} onClick={markSent}><CheckCircle2 className="h-4 w-4" /> I’ve sent it</button>
              : <button className={btnPrimary} onClick={send} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} {busy ? 'Preparing PDF…' : 'Open WhatsApp'}</button>}
          </div>
        </div>
      )}
    </Modal>
  );
}

// The Send button: choose Email or WhatsApp, then send.
export function SendDocChooser({ type, id, number, makePdf, onSent }) {
  const [chooser, setChooser] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const label = type === 'invoice' ? 'invoice' : 'quotation';
  const common = { type, id, number, makePdf, onSent };
  return (
    <>
      <button onClick={() => setChooser(true)} className="flex items-center gap-1.5 rounded-lg border border-[#003DA5] px-3 py-1.5 text-sm font-semibold text-[#003DA5] hover:bg-blue-50">
        <Send className="h-4 w-4" /> Send
      </button>
      {chooser && (
        <Modal open onClose={() => setChooser(false)} title={`Send ${label} ${number || ''}`} description="How do you want to send it?">
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => { setChooser(false); setEmailOpen(true); }} className="rounded-xl border border-border p-4 text-left hover:border-[#003DA5] hover:bg-blue-50">
              <span className="flex items-center gap-2 font-semibold"><Mail className="h-5 w-5 text-[#003DA5]" /> By email</span>
              <span className="mt-1 block text-sm text-muted-foreground">Sent straight from the company email, with the PDF attached. You check the message, then tap Send.</span>
            </button>
            <button type="button" onClick={() => { setChooser(false); setWaOpen(true); }} className="rounded-xl border border-border p-4 text-left hover:border-[#25D366] hover:bg-emerald-50">
              <span className="flex items-center gap-2 font-semibold"><MessageCircle className="h-5 w-5 text-[#25D366]" /> By WhatsApp</span>
              <span className="mt-1 block text-sm text-muted-foreground">Opens WhatsApp with the PDF and the message ready. You tap Send in WhatsApp.</span>
            </button>
          </div>
        </Modal>
      )}
      <EmailDocDialog open={emailOpen} onClose={() => setEmailOpen(false)} {...common} />
      <WhatsAppDocDialog open={waOpen} onClose={() => setWaOpen(false)} {...common} />
    </>
  );
}
