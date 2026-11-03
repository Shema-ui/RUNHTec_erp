import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Building2, FileText, ReceiptText, FolderKanban, FileQuestion, HardHat, Tags, Wrench } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { canAccessModule } from '@/lib/permissions';
import { formatMoney } from '@/lib/money';
import { Loading } from '@/components/erp/kit';

// One search box for everything the person is allowed to see.
const SOURCES = [
  { key: 'clients', module: 'clients', label: 'Clients', icon: Building2, coll: 'clients',
    text: (r) => [r.company_name, r.trading_name, r.city, r.district, r.industry].join(' '),
    title: (r) => r.company_name, sub: (r) => [r.city, r.status].filter(Boolean).join(' · '), to: (r) => `/crm/clients/${r.id}` },
  { key: 'quotes', module: 'quotations', label: 'Quotations', icon: FileText, coll: 'quotations',
    text: (r) => [r.number, r.bill_to_company, r.bill_to_name, (r.items || []).map((i) => i.description).join(' ')].join(' '),
    title: (r) => `${r.number} — ${r.bill_to_company || r.bill_to_name || ''}`, sub: (r) => `${r.status} · ${formatMoney(r.total, r.currency)}`, to: (r) => `/quotations/${r.id}/view` },
  { key: 'invoices', module: 'invoices', label: 'Invoices', icon: ReceiptText, coll: 'invoices',
    text: (r) => [r.invoice_number, r.bill_to_company, r.bill_to_name, (r.items || []).map((i) => i.description).join(' ')].join(' '),
    title: (r) => `${r.invoice_number} — ${r.bill_to_company || r.bill_to_name || ''}`, sub: (r) => `${r.status} · ${formatMoney(r.total, r.currency)}`, to: (r) => `/invoices/${r.id}/view` },
  { key: 'projects', module: 'projects', label: 'Projects', icon: FolderKanban, coll: 'projects',
    text: (r) => [r.title, r.site_address, r.description].join(' '),
    title: (r) => r.title, sub: (r) => [String(r.status || '').replace('_', ' '), r.site_address].filter(Boolean).join(' · '), to: (r) => `/projects/${r.id}` },
  { key: 'rfqs', module: 'rfq', label: 'Website requests', icon: FileQuestion, coll: 'rfqs',
    text: (r) => [r.name, r.company, r.email, r.phone, r.description, r.service_type].join(' '),
    title: (r) => r.company || r.name, sub: (r) => [r.service_type, r.email].filter(Boolean).join(' · '), to: () => '/rfqs' },
  { key: 'maint', module: 'maintenance', label: 'Maintenance', icon: Wrench, coll: 'maintenance_contracts',
    text: (r) => [r.service_type, r.site, r.notes].join(' '),
    title: (r) => r.service_type, sub: (r) => r.site || '', to: () => '/maintenance' },
  { key: 'contractors', module: 'hr', label: 'Contractors', icon: HardHat, coll: 'contractors',
    text: (r) => [r.full_name, r.code, r.phone, r.email, r.trade, r.city].join(' '),
    title: (r) => `${r.full_name}${r.code ? ` (${r.code})` : ''}`, sub: (r) => [r.trade, r.phone].filter(Boolean).join(' · '), to: (r) => `/hr/contractors/${r.id}` },
  { key: 'items', module: 'catalog', label: 'Items & Prices', icon: Tags, coll: 'catalog_items',
    text: (r) => [r.name, r.code, r.brand, r.description].join(' '),
    title: (r) => r.name, sub: (r) => `${formatMoney(r.selling_price, r.currency)} per ${r.unit || 'unit'}`, to: () => '/items' },
];

export default function SearchPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [text, setText] = useState(q);
  const [data, setData] = useState(null);
  const sources = SOURCES.filter((s) => canAccessModule(user, s.module));

  useEffect(() => { setText(q); }, [q]);
  useEffect(() => {
    Promise.all(sources.map((s) => pb.collection(s.coll).getFullList({ sort: '-created' }).catch(() => [])))
      .then((lists) => setData(Object.fromEntries(sources.map((s, i) => [s.key, lists[i]]))));
  }, [user?.id]);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!data || !words.length) return [];
    return sources.map((s) => ({ s, hits: (data[s.key] || []).filter((r) => { const h = s.text(r).toLowerCase(); return words.every((w) => h.includes(w)); }).slice(0, 8) }))
      .filter((g) => g.hits.length);
  }, [data, q]);

  return (
    <PortalLayout title="Search" subtitle="Find anything in the ERP">
      <Helmet><title>Search | RUNHTec Business Portal</title></Helmet>
      <form onSubmit={(e) => { e.preventDefault(); setParams(text.trim() ? { q: text.trim() } : {}); }} className="mb-5 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input autoFocus className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" value={text} onChange={(e) => setText(e.target.value)} placeholder="Client, quote or invoice number, project, phone, item…" aria-label="Search everything" />
        </div>
        <button type="submit" className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Search</button>
      </form>
      {!q ? <p className="text-sm text-muted-foreground">Type a name, number, phone or item, for example “Kivu”, “INV-2026-0003” or “inverter”.</p>
        : !data ? <Loading />
        : results.length === 0 ? <p className="text-sm text-muted-foreground">Nothing found for “{q}”.</p>
        : (
          <div className="space-y-5">
            {results.map(({ s, hits }) => {
              const Icon = s.icon;
              return (
                <section key={s.key}>
                  <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" /> {s.label} <span className="text-xs font-normal text-muted-foreground">({hits.length})</span></h3>
                  <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
                    {hits.map((r) => (
                      <li key={r.id}><Link to={s.to(r)} className="block px-4 py-3 hover:bg-secondary/40"><span className="block truncate font-medium">{s.title(r)}</span><span className="block truncate text-xs capitalize text-muted-foreground">{s.sub(r)}</span></Link></li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
    </PortalLayout>
  );
}
