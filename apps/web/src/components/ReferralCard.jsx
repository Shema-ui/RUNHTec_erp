import React, { useEffect, useState } from 'react';
import { Gift, Copy, Check, Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';

const money = (n) => `${Number(n || 0).toLocaleString('en-US')} RWF`;
const KIND = { individual: 'Individual', company: 'Company' };
const STATUS = { signed_up: 'Signed up, first payment pending', rewarded: 'Credit earned' };

export default function ReferralCard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    pb.get('/api/referrals/me').then(setData).catch((e) => setErr(e.message || 'Could not load your referrals.'));
  }, []);

  if (err) return <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">{err}</div>;
  if (!data) return <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your referral link…</div>;

  const message = `Join RUNHTec Contractors through my link and get started: ${data.link}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(data.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-5 w-5 text-[#881946]" />
        <div>
          <h3 className="font-semibold">Refer and earn credit</h3>
          <p className="text-xs text-muted-foreground">
            Individuals: {money(data.rules.individual)} credit when someone you refer pays for their first job.
            Companies: {data.rules.companyPercent}% of their first payment, up to {money(data.rules.companyCap)}.
            Credit never expires.
          </p>
        </div>
      </div>
      <div className="rounded-xl bg-secondary/40 p-4">
        <p className="text-xs text-muted-foreground">Your credit balance</p>
        <p className="text-2xl font-bold">{money(data.balance)}</p>
      </div>
      <div className="space-y-2">
        <p className="break-all rounded-lg border border-border bg-background px-3 py-2 text-xs">{data.link}</p>
        <div className="flex flex-wrap gap-2">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-lg bg-[#881946] px-4 text-sm font-semibold text-white">Share on WhatsApp</a>
          <button type="button" onClick={copy} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>
      {data.referrals.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Your referrals</p>
          <ul className="divide-y divide-border text-sm">
            {data.referrals.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span>{r.referred_name || 'New client'} <span className="text-xs text-muted-foreground">· {KIND[r.kind] || r.kind}</span></span>
                <span className="text-right text-xs text-muted-foreground">{r.status === 'rewarded' ? `+${money(r.rewarded_credit)}` : STATUS[r.status] || r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
