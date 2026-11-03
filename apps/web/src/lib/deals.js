import pb from '@/lib/pocketbaseClient';

// The sales pipeline = opportunities typed in by hand + deals that already
// exist elsewhere (website quote requests and quotations), so nobody has to
// enter the same deal twice.
const RFQ_STAGE = { new: 'new_lead', reviewing: 'contacted', scheduled: 'site_visit', in_progress: 'proposal_prep' };
const QUOTE_STAGE = { draft: 'proposal_prep', sent: 'quotation_sent', accepted: 'won', declined: 'lost', expired: 'lost' };
const num = (v) => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0;

export async function loadDeals() {
  const [opps, rfqs, quotes] = await Promise.all([
    pb.collection('sales_opportunities').getFullList({ sort: '-created', expand: 'client,assigned_to' }).catch(() => []),
    pb.collection('rfqs').getFullList({ sort: '-created', expand: 'client' }).catch(() => []),
    pb.collection('quotations').getFullList({ sort: '-created', expand: 'client' }).catch(() => []),
  ]);
  const quotedRfqs = new Set(quotes.map((q) => q.rfq).filter(Boolean));
  const fromRfqs = rfqs
    .filter((r) => (r.request_type || 'quote_request') === 'quote_request' && r.status !== 'quoted' && !quotedRfqs.has(r.id) && RFQ_STAGE[r.request_status || 'new'])
    .map((r) => ({
      id: `rfq-${r.id}`, auto: 'rfq', link: '/rfqs', stage: RFQ_STAGE[r.request_status || 'new'],
      title: r.service_type ? `${r.service_type} request` : 'Website request', client: r.client,
      expand: { client: r.expand?.client || { company_name: r.company || r.name } }, value: num(r.budget), created: r.created,
    }));
  const fromQuotes = quotes
    .filter((q) => QUOTE_STAGE[q.status])
    .map((q) => ({
      id: `q-${q.id}`, auto: 'quote', link: `/quotations/${q.id}/view`, stage: QUOTE_STAGE[q.status],
      title: `Quotation ${q.number}`, client: q.client,
      expand: { client: q.expand?.client || { company_name: q.bill_to_company || q.bill_to_name } }, value: num(q.total), created: q.created,
    }));
  return [...opps, ...fromRfqs, ...fromQuotes];
}
