import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, FileText, ChevronRight } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Modal, Field, inputCls, textareaCls, btnPrimary, btnLine } from '@/components/erp/kit';
import { formatMoney } from '@/lib/money';
import { dayLabel } from '@/lib/portal';
import { useLang } from '@/lib/i18n';

// Quotations the client can still answer: sent, not expired, not an invoice copy.
export function answerable(q) {
  if (!q || q.status !== 'sent' || q.source_invoice) return false;
  const until = String(q.valid_until || '').slice(0, 10);
  return !(/^\d{4}-\d{2}-\d{2}$/.test(until) && until < new Date().toISOString().slice(0, 10));
}

// Accept (with name as signature) or decline, from the client app.
export function QuoteAnswerDialog({ quote, decision, onClose, onDone }) {
  const { t } = useLang();
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (quote) { setName(user?.name || ''); setNote(''); } }, [quote, decision]);
  if (!quote) return null;
  const accept = decision === 'accept';
  const send = async () => {
    setBusy(true);
    try {
      await pb.post(`/api/client/quotes/${quote.id}/respond`, { decision, name, note });
      toast(accept ? { title: t('Thank you! Quotation accepted.'), description: t('Our team will contact you to plan the work.') } : { title: t('Thanks for letting us know.') });
      onDone?.(); onClose();
    } catch (e) { toast({ title: t('Could not send'), description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t(accept ? 'Accept quotation {number}' : 'Decline quotation {number}', { number: quote.number })}
      description={`${t('Total')}: ${formatMoney(quote.total, quote.currency)}`}>
      <div className="space-y-4">
        {accept && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{t('By accepting, you agree to the work and price in this quotation. Our team will contact you to plan the start.')}</p>}
        {accept && <Field label={t('Your full name')}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>}
        <Field label={t(accept ? 'Note for us (optional)' : 'Why are you declining? (optional)')}>
          <textarea className={textareaCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={accept ? '' : t('e.g. Price too high, chose another option, not needed now')} />
        </Field>
        <div className="flex justify-end gap-2">
          <button className={btnLine} onClick={onClose}>{t('Cancel')}</button>
          <button className={accept ? btnPrimary : 'inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60'} onClick={send} disabled={busy || (accept && name.trim().length < 2)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : accept ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {t(accept ? 'Accept and sign' : 'Decline')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// "Quotations for you" cards on Home and Requests.
export function QuotesWaiting({ quotes, preview, onDone }) {
  const { t } = useLang();
  const [answer, setAnswer] = useState(null);
  const list = (quotes || []).filter(answerable);
  if (!list.length) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold">{t('Quotations for you')}</h2>
      <div className="space-y-2">
        {list.map((q) => (
          <div key={q.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <Link to={`/quotations/${q.id}/view`} className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><FileText className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{q.number} · {formatMoney(q.total, q.currency)}</span>
                <span className="block text-xs text-slate-600">{t('Waiting for your answer')}{q.valid_until ? ` · ${t('Valid until {date}', { date: dayLabel(q.valid_until) })}` : ''}</span>
              </span>
              <span className="inline-flex items-center text-sm font-semibold text-[#003DA5]">{t('View')}<ChevronRight className="h-4 w-4" /></span>
            </Link>
            {!preview && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAnswer({ q, d: 'decline' })} className="rounded-xl border border-rose-300 bg-white py-2.5 text-sm font-semibold text-rose-700">{t('Decline')}</button>
                <button type="button" onClick={() => setAnswer({ q, d: 'accept' })} className="rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white">{t('Accept')}</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <QuoteAnswerDialog quote={answer?.q} decision={answer?.d} onClose={() => setAnswer(null)} onDone={onDone} />
    </section>
  );
}
