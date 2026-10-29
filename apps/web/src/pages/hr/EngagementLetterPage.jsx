// Printable per-project engagement letter (independent contractor agreement).
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Printer, Loader2 } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { BackLink } from '@/components/erp/kit';
import { PAYMENT_BASIS, tradeLabel } from '@/lib/hr';
import { formatMoney } from '@/lib/money';

const PRINT = `@media print { .no-print { display: none !important; } body { background: #fff !important; } .sheet { box-shadow: none !important; margin: 0 !important; } @page { size: A4; margin: 18mm; } }`;

const longDate = (v) => {
  if (!v) return '____________';
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function EngagementLetterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const a = await pb.collection('project_assignments').getOne(id, { expand: 'contractor,project' });
        const cfgList = await pb.collection('company_settings').getList(1, 1).catch(() => ({ items: [] }));
        let client = null;
        if (a.expand?.project?.client) client = await pb.collection('clients').getOne(a.expand.project.client).catch(() => null);
        setData({ a, c: a.expand?.contractor || {}, p: a.expand?.project || {}, cfg: cfgList.items[0] || {}, client });
      } catch (_) { navigate('/hr/engagements'); }
    })();
  }, [id]);

  if (!data) return <div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const { a, c, p, cfg, client } = data;
  const company = cfg.company_name || 'RUNHTec Contractors Ltd';
  const basis = PAYMENT_BASIS.find((b) => b.value === a.payment_basis)?.label || a.payment_basis;

  return (
    <div className="min-h-[100dvh] bg-slate-100 py-6">
      <style>{PRINT}</style>
      <Helmet><title>Engagement letter · {c.full_name || ''}</title></Helmet>
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center gap-2 px-4">
        <BackLink to={`/projects/${a.project}`}>Project</BackLink>
        <button onClick={() => window.print()} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Printer className="h-4 w-4" /> Print / save as PDF</button>
      </div>

      <article className="sheet mx-auto max-w-3xl space-y-5 bg-white p-10 text-[14px] leading-relaxed text-slate-800 shadow">
        <header className="border-b border-slate-200 pb-4">
          <p className="text-xl font-bold text-slate-900">{company}</p>
          <p className="text-xs text-slate-500">{[cfg.company_address, cfg.company_phone, cfg.company_email].filter(Boolean).join(' · ')}</p>
        </header>

        <h1 className="text-lg font-bold uppercase tracking-wide text-slate-900">Independent contractor engagement — per project</h1>
        <p>Date: {longDate(new Date().toISOString())}</p>

        <section>
          <p><strong>Between:</strong> {company} (“RUNHTec”)</p>
          <p><strong>And:</strong> {c.full_name}{c.phone ? `, tel. ${c.phone}` : ''}{c.email ? `, ${c.email}` : ''} (“the Contractor”), contractor code {c.code || '—'}</p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">1. Project</h2>
          <p>{p.title || '—'}{client?.company_name ? ` for ${client.company_name}` : ''}{p.site_address ? `, at ${p.site_address}` : ''}.</p>
          <p>Role: <strong>{a.role_on_project || tradeLabel(c.trade)}</strong>. Period: {longDate(a.start_date)} to {longDate(a.end_date)}.</p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">2. Scope of work</h2>
          <p className="whitespace-pre-line">{a.scope_of_work || 'As described by the RUNHTec project manager for this project.'}</p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">3. Fee and payment</h2>
          <p>Total agreed fee: <strong>{formatMoney(a.agreed_amount, a.currency)}</strong> ({basis}). Payment is made against work completed to the satisfaction of the RUNHTec project manager{c.payment_details ? `, to: ${c.payment_details}` : ''}. The Contractor is responsible for their own taxes and statutory contributions.</p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">4. Nature of the engagement</h2>
          <p>This is a contract for this project only. The Contractor is an independent contractor and <strong>not an employee</strong> of {company}. There is no salary, and this engagement does not create an employment relationship or guarantee further work. Any future project will be agreed separately.</p>
        </section>

        <section>
          <h2 className="font-bold text-slate-900">5. Conduct, safety and quality</h2>
          <p>The Contractor will follow site safety rules and the instructions of the RUNHTec project manager, use appropriate protective equipment, work to good trade standards, and keep client information confidential. RUNHTec may end this engagement if these terms are not respected.</p>
        </section>

        <div className="grid grid-cols-2 gap-10 pt-10">
          <div><div className="border-t border-slate-400 pt-1 text-xs">For {company}<br />Name, signature & date</div></div>
          <div><div className="border-t border-slate-400 pt-1 text-xs">The Contractor: {c.full_name}<br />Signature & date</div></div>
        </div>
      </article>
    </div>
  );
}
