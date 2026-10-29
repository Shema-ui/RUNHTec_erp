import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { UserPlus, BadgeCheck, Phone, MapPin } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import HrTabs from './HrTabs';
import { Toolbar, SearchBox, FilterSelect, Loading, Empty, Pill, Stars, btnPrimary } from '@/components/erp/kit';
import {
  DEPARTMENTS, TRADES, CONTRACTOR_STATUSES, statusInfo, tradeLabel, deptShort, rateUnitLabel,
} from '@/lib/hr';
import { formatMoney } from '@/lib/money';

export default function ContractorsPage() {
  const [params] = useSearchParams();
  const [items, setItems] = useState(null);
  const [busyIds, setBusyIds] = useState(new Set());
  const [q, setQ] = useState('');
  const [dept, setDept] = useState(params.get('department') || 'all');
  const [trade, setTrade] = useState('all');
  const [status, setStatus] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    Promise.all([
      pb.collection('contractors').getFullList({ sort: 'full_name' }),
      pb.collection('project_assignments').getFullList({ filter: "status = 'accepted' || status = 'in_progress'" }).catch(() => []),
    ]).then(([list, live]) => {
      setItems(list);
      setBusyIds(new Set(live.map((a) => a.contractor)));
    }).catch(() => setItems([]));
  }, []);

  const filtered = useMemo(() => (items || []).filter((c) => {
    if (dept !== 'all' && c.department !== dept) return false;
    if (trade !== 'all' && c.trade !== trade) return false;
    if (status !== 'all' && c.status !== status) return false;
    if (verifiedOnly && !c.verified) return false;
    if (q && ![c.full_name, c.code, c.phone, c.email, c.city, ...(Array.isArray(c.skills) ? c.skills : [])].join(' ').toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [items, q, dept, trade, status, verifiedOnly]);

  return (
    <PortalLayout title="Contractor register" subtitle="Vetted professionals engaged per project">
      <Helmet><title>Contractor register | RUNHTec Business Portal</title></Helmet>
      <HrTabs />

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search name, code, phone, skill, city" />
        <FilterSelect value={dept} onChange={setDept} options={DEPARTMENTS} allLabel="All departments" />
        <FilterSelect value={trade} onChange={setTrade} options={TRADES} allLabel="All skills" />
        <FilterSelect value={status} onChange={setStatus} options={CONTRACTOR_STATUSES} allLabel="Any status" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={verifiedOnly} onChange={() => setVerifiedOnly((v) => !v)} /> Verified only
        </label>
        <Link to="/hr/contractors/new" className={`${btnPrimary} ml-auto`}><UserPlus className="h-4 w-4" /> Add contractor</Link>
      </Toolbar>

      {!items ? <Loading /> : filtered.length === 0 ? (
        <Empty>No contractors match. Approve an application or add someone directly with “Add contractor”.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const st = busyIds.has(c.id) && c.status === 'available' ? statusInfo(CONTRACTOR_STATUSES, 'engaged') : statusInfo(CONTRACTOR_STATUSES, c.status);
            return (
              <Link key={c.id} to={`/hr/contractors/${c.id}`} className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate font-display text-base font-semibold text-foreground">
                      {c.full_name}{c.verified ? <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Verified" /> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.code} · {deptShort(c.department)}</p>
                  </div>
                  <Pill info={st} />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">{tradeLabel(c.trade)}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{c.phone}</span>}
                  {(c.city || c.country) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[c.city, c.country].filter(Boolean).join(', ')}</span>}
                  <span>{c.experience_years || 0} yrs experience</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                  <Stars value={Number(c.rating) || 0} />
                  <span className="font-semibold">{Number(c.rate_amount) ? `${formatMoney(c.rate_amount, c.currency)} ${rateUnitLabel(c.rate_unit)}` : 'Rate not set'}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PortalLayout>
  );
}
