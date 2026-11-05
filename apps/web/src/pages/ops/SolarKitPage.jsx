import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sun, Loader2, Calculator, FilePlus2, AlertTriangle, Settings as SettingsIcon } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Card, Field, inputCls, btnPrimary, btnLine } from '@/components/erp/kit';
import { formatMoney } from '@/lib/money';
import { plannerFromText } from '@/lib/solarKit';

const n = (v) => Number(String(v ?? '').replace(/[\s,]/g, '')) || 0;

// Staff tool: size a solar/backup kit from a load and turn it into a draft quotation.
// Uses the vendors' buying prices, so it is only open to staff who may see costs.
export default function SolarKitPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rfqId = params.get('rfq') || '';
  const [rfq, setRfq] = useState(null);
  const [f, setF] = useState({ peakKw: '', dailyKwh: '', hours: '4', backupKwh: '', motorW: '', solar: true });
  const [kit, setKit] = useState(null);
  const [busy, setBusy] = useState('');
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setKit(null); };

  // Opened from a website request: fill in the Power Planner numbers it carries.
  useEffect(() => {
    if (!rfqId) return;
    pb.collection('rfqs').getOne(rfqId).then((r) => {
      setRfq(r);
      const p = plannerFromText(r.description);
      if (p) setF({ peakKw: String(p.peakKw), dailyKwh: String(p.dailyKwh), hours: String(p.hours || 4), backupKwh: p.backupKwh ? String(p.backupKwh) : '', motorW: p.motorW ? String(p.motorW) : '', solar: p.solar });
    }).catch(() => {});
  }, [rfqId]);

  const load = () => ({
    peakW: n(f.peakKw) * 1000, dailyWh: n(f.dailyKwh) * 1000, hours: n(f.hours),
    backupWh: n(f.backupKwh) * 1000, maxMotorW: n(f.motorW), solar: f.solar,
  });
  const preview = async () => {
    if (!(n(f.peakKw) > 0)) { toast({ title: 'Enter the peak load', variant: 'destructive' }); return; }
    setBusy('preview');
    try { setKit(await pb.post('/api/solar-kit/preview', { load: load() })); }
    catch (e) { toast({ title: 'Could not build the kit', description: e.message, variant: 'destructive' }); }
    finally { setBusy(''); }
  };
  const create = async () => {
    setBusy('quote');
    try {
      const q = await pb.post('/api/solar-kit/quote', { load: load(), rfq: rfqId || null, client: rfq?.client || null });
      toast({ title: `Draft quotation ${q.number} created`, description: q.missing?.length ? `Fill in the prices still needed: ${q.missing.join(', ')}.` : 'Check it, then send it to the client.' });
      navigate(`/quotations/${q.id}/edit`);
    } catch (e) { toast({ title: 'Could not create the quotation', description: e.message, variant: 'destructive' }); setBusy(''); }
  };

  const cur = kit?.currency || 'RWF';
  const box = (k, label, hint, ph) => (
    <Field label={label} hint={hint}>
      <input className={inputCls} inputMode="decimal" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} aria-label={label} />
    </Field>
  );

  return (
    <PortalLayout title="Solar kit builder" subtitle="Size a solar / backup system and turn it into a draft quotation">
      <Helmet><title>Solar kit builder | RUNHTec Business Portal</title></Helmet>
      {rfq && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          For the request from <b>{rfq.name}{rfq.company && rfq.company !== rfq.name ? ` (${rfq.company})` : ''}</b>. The quotation will be linked to it.
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card title={<span className="inline-flex items-center gap-2"><Sun className="h-4 w-4" /> Client's load</span>}>
          <div className="space-y-4">
            {box('peakKw', 'Peak load (kW)', 'Everything that can run at the same time.', 'e.g. 2.4')}
            {box('dailyKwh', 'Daily energy (kWh)', 'Total used in a day. Sizes the solar panels.', 'e.g. 9.5')}
            {box('hours', 'Backup hours', 'How long it must run on the batteries.', 'e.g. 6')}
            {box('backupKwh', 'Energy during backup (kWh), optional', 'Leave empty to estimate it from the peak load and hours.', 'e.g. 5')}
            {box('motorW', 'Largest motor (W), optional', 'Pump, fridge or AC: it needs extra power to start.', 'e.g. 750')}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={f.solar} onChange={(e) => set('solar', e.target.checked)} /> Include solar panels</label>
            <button className={`${btnPrimary} w-full`} onClick={preview} disabled={busy !== ''}>{busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />} Build the kit</button>
            <p className="text-xs text-muted-foreground">The rules (sun hours, battery depth, extra lines) are in <Link to="/settings" className="text-primary hover:underline">Settings → Solar kit builder</Link>.</p>
          </div>
        </Card>

        <Card title="Kit and prices" action={kit && <button className={btnPrimary} onClick={create} disabled={busy !== ''}>{busy === 'quote' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />} Create draft quotation</button>}>
          {!kit ? <p className="text-sm text-muted-foreground">Enter the load and click “Build the kit”. The inverter, batteries and panels are picked from your vendors' price lists (cheapest that fits), with your vendor markup added.</p> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[['Inverter', `${kit.sizing.inverterKw.toFixed(1)} kW+`], ['Battery', `${kit.sizing.batteryKwh.toFixed(1)} kWh`], ['Solar', kit.sizing.kwp ? `${kit.sizing.kwp} kWp` : '—'], ['Panels', kit.sizing.panels || '—']].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-secondary/60 p-3"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className="font-display text-lg font-bold">{v}</p></div>
                ))}
              </div>
              {kit.missing.length > 0 && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>No priced item in your vendor lists for: <b>{kit.missing.join(', ')}</b>. These lines are added at 0 — fill in the price on the quotation, or add the item with its price in Vendors.</span></p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-muted-foreground"><th className="py-2 pr-3">Item</th><th className="py-2 pr-3 text-right">Qty</th><th className="py-2 pr-3 text-right">Buy 🔒</th><th className="py-2 pr-3 text-right">Your price</th><th className="py-2 text-right">Amount</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {kit.lines.map((l) => (
                      <tr key={l.id} className={Number(l.unit_price) === 0 ? 'bg-amber-50/60' : ''}>
                        <td className="py-2 pr-3"><p className="font-medium">{l.description}</p>{l.cost_source && <p className="text-[11px] text-muted-foreground">🚚 {l.cost_source}</p>}</td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap">{l.quantity} {l.unit}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground whitespace-nowrap">{formatMoney(l.cost, cur)}</td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap">{formatMoney(l.unit_price, cur)}</td>
                        <td className="py-2 text-right font-semibold whitespace-nowrap">{formatMoney(l.amount, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Cost 🔒 {formatMoney(kit.cost, cur)}</span>
                <span>Subtotal (before VAT) <b>{formatMoney(kit.subtotal, cur)}</b></span>
                {kit.subtotal > 0 && <span className="text-emerald-700">Margin {Math.round(((kit.subtotal - kit.cost) / kit.subtotal) * 100)}%</span>}
              </div>
              <p className="text-xs text-muted-foreground">The client only sees the item names and your prices. Buying prices and vendors stay internal.</p>
              <div className="flex justify-end"><Link to="/settings" className={btnLine}><SettingsIcon className="h-4 w-4" /> Change the rules</Link></div>
            </div>
          )}
        </Card>
      </div>
    </PortalLayout>
  );
}
