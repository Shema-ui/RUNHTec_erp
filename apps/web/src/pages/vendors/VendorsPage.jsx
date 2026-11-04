import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Truck, Phone, ChevronRight, Trophy, ArrowUp, ArrowDown, Download } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';
import { Empty, Loading, SearchBox, btnPrimary, btnLine, fmtDate } from '@/components/erp/kit';
import { formatMoney } from '@/lib/money';
import { availabilityInfo, itemKey } from '@/lib/vendors';
import VendorFormDialog from './VendorFormDialog';

// Staff: all suppliers, and every vendor price side by side.
export default function VendorsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'compare' ? 'compare' : 'list';
  const [vendors, setVendors] = useState(null);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () => Promise.all([
    pb.collection('vendors').getFullList({ sort: 'name' }),
    pb.collection('vendor_items').getFullList({ sort: 'name' }),
  ]).then(([v, i]) => { setVendors(v); setItems(i); }).catch((e) => { setVendors([]); toast({ title: 'Could not load vendors', description: e.message, variant: 'destructive' }); });
  useEffect(() => { load(); }, []);

  const name = (id) => vendors?.find((v) => v.id === id)?.name || '';
  const stats = useMemo(() => {
    const m = {};
    items.forEach((it) => { const s = (m[it.vendor] ||= { count: 0, last: '' }); s.count += 1; if (String(it.updated) > s.last) s.last = String(it.updated); });
    return m;
  }, [items]);

  const t = q.trim().toLowerCase();
  const shownVendors = (vendors || []).filter((v) => !t || [v.name, v.contact_name, v.supplies, v.phone].join(' ').toLowerCase().includes(t));

  // Compare: same item (by name + unit + currency) at several vendors, cheapest first.
  const groups = useMemo(() => {
    const m = new Map();
    items.filter((it) => !t || [it.name, it.brand, it.code, name(it.vendor)].join(' ').toLowerCase().includes(t)).forEach((it) => {
      const k = itemKey(it);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(it);
    });
    return [...m.values()].map((list) => list.sort((a, b) => Number(a.price) - Number(b.price))).sort((a, b) => String(a[0].name).localeCompare(String(b[0].name)));
  }, [items, t, vendors]);

  const exportCsv = () => {
    const rows = [['Item', 'Brand', 'Vendor', 'Price', 'Currency', 'Per', 'Availability', 'Updated']];
    groups.flat().forEach((it) => rows.push([it.name, it.brand, name(it.vendor), it.price, it.currency, it.unit, availabilityInfo(it.availability).label, String(it.updated || '').slice(0, 10)]));
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `vendor-prices-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  const tabBtn = (key, label) => (
    <button onClick={() => setParams(key === 'list' ? {} : { tab: key })} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>{label}</button>
  );

  return (
    <PortalLayout title="Vendors" subtitle="Suppliers and the prices they give us (only staff who see costs)">
      <Helmet><title>Vendors | RUNHTec Business Portal</title></Helmet>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">{tabBtn('list', `Vendors${vendors ? ` (${vendors.length})` : ''}`)}{tabBtn('compare', 'Compare prices')}</div>
        <div className="ml-auto flex gap-2">
          {tab === 'compare' && items.length > 0 && <button className={btnLine} onClick={exportCsv}><Download className="h-4 w-4" /> Excel (CSV)</button>}
          <button className={btnPrimary} onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add vendor</button>
        </div>
      </div>
      <div className="mb-4"><SearchBox value={q} onChange={setQ} placeholder={tab === 'list' ? 'Search vendors' : 'Search an item, e.g. inverter 5kW'} /></div>

      {!vendors ? <Loading /> : tab === 'list' ? (
        shownVendors.length === 0 ? <Empty>{vendors.length ? 'No vendor matches your search.' : 'No vendors yet. Click “Add vendor”, then send them their access link so they can add their items and prices.'}</Empty> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shownVendors.map((v) => (
              <Link key={v.id} to={`/vendors/${v.id}`} className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Truck className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center justify-between gap-2 font-semibold group-hover:text-primary">{v.name}<ChevronRight className="h-4 w-4 text-muted-foreground" /></p>
                    {v.supplies && <p className="truncate text-xs text-muted-foreground">{v.supplies}</p>}
                    {v.phone && <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{v.phone}</p>}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="font-medium">{stats[v.id]?.count || 0} item{stats[v.id]?.count === 1 ? '' : 's'}</span>
                  <span className="text-muted-foreground">{stats[v.id]?.last ? `Prices updated ${fmtDate(stats[v.id].last)}` : 'No prices yet'}</span>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        groups.length === 0 ? <Empty>{items.length ? 'No item matches your search.' : 'No vendor prices yet.'}</Empty> : (
          <div className="space-y-3">
            {groups.map((list) => (
              <div key={itemKey(list[0])} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{list[0].name} <span className="text-xs font-normal text-muted-foreground">per {list[0].unit}</span></h3>
                  <span className="text-xs text-muted-foreground">{list.length} vendor{list.length === 1 ? '' : 's'}{list.length > 1 ? ` · difference ${formatMoney(Number(list[list.length - 1].price) - Number(list[0].price), list[0].currency)}` : ''}</span>
                </div>
                <ul className="divide-y divide-border">
                  {list.map((it, i) => (
                    <li key={it.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                      <button onClick={() => navigate(`/vendors/${it.vendor}`)} className="min-w-[140px] flex-1 text-left font-medium hover:text-primary">
                        {i === 0 && list.length > 1 && <Trophy className="mr-1 inline h-3.5 w-3.5 text-amber-500" />}{name(it.vendor)}
                        {it.brand && <span className="ml-1 text-xs font-normal text-muted-foreground">· {it.brand}</span>}
                      </button>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${availabilityInfo(it.availability).cls}`}>{availabilityInfo(it.availability).label}</span>
                      <span className="w-28 text-xs text-muted-foreground">{fmtDate(it.updated)}</span>
                      <span className="flex w-40 flex-col items-end">
                        <span className={`font-semibold ${i === 0 && list.length > 1 ? 'text-emerald-700' : ''}`}>{formatMoney(it.price, it.currency)}</span>
                        {it.previous_price !== null && it.previous_price !== undefined && (
                          <span className={`inline-flex items-center text-[11px] ${Number(it.price) > Number(it.previous_price) ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {Number(it.price) > Number(it.previous_price) ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />} was {formatMoney(it.previous_price, it.currency)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )
      )}
      <VendorFormDialog open={adding} onClose={() => setAdding(false)} onSaved={(v) => navigate(`/vendors/${v.id}`)} />
    </PortalLayout>
  );
}
