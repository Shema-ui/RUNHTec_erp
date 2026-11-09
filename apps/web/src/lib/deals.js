import pb from '@/lib/pocketbaseClient';

// The sales pipeline = opportunities typed in by hand + deals that already
// exist elsewhere (website quote requests and quotations), so nobody has to
// enter the same deal twice.
const RFQ_STAGE = { new: 'new_lead', reviewing: 'contacted', scheduled: 'site_visit', in_progress: 'proposal_prep' };
const QUOTE_STAGE = { draft: 'proposal_prep', sent: 'quotation_sent', accepted: 'won', declined: 'lost', expired: 'lost' };
const RANK = { accepted: 4, sent: 3, draft: 2, declined: 1, expired: 1 };
// Deals still being worked on (not won or lost yet)
export const isOpenDeal = (d) => d.stage !== 'won' && d.stage !== 'lost';
const num = (v) => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0;

export async function loadDeals() {
  const [opps, rfqs, quotes] = await Promise.all([
    pb.collection('sales_opportunities').getFullList({ sort: '-created', expand: 'client,assigned_to' }).catch(() => []),
    pb.collection('rfqs').getFullList({ sort: '-created', expand: 'client' }).catch(() => []),
    pb.collection('quotations').getFullList({ sort: '-created', expand: 'client' }).catch(() => []),
  ]);
  const quotedRfqs = new Set(quotes.map((q) => q.rfq).filter(Boolean));
  // A website request is a deal until it gets a quotation (then the quote takes
  // over) or until it's declined/closed.
  const fromRfqs = rfqs
    .filter((r) => (r.request_type || 'quote_request') === 'quote_request' && !['quoted', 'declined'].includes(r.status) && !quotedRfqs.has(r.id) && RFQ_STAGE[r.request_status || 'new'])
    .map((r) => ({
      id: `rfq-${r.id}`, auto: 'rfq', link: '/rfqs', stage: RFQ_STAGE[r.request_status || 'new'],
      title: r.service_type ? `${r.service_type} request` : 'Website request', client: r.client,
      expand: { client: r.expand?.client || { company_name: r.company || r.name } }, value: num(r.budget), created: r.created,
    }));
  // Quotations made automatically from an invoice are bookkeeping copies, not
  // sales deals, so they stay out. Several quotes for the same request (options
  // like cassette vs ducted) are ONE deal: it takes the furthest status
  // (accepted > sent > draft > declined/expired).
  const groups = new Map();
  quotes.filter((q) => !q.source_invoice && QUOTE_STAGE[q.status]).forEach((q) => {
    const key = q.rfq ? `rfq-${q.rfq}` : `q-${q.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  });
  const fromQuotes = [...groups.values()].map((list) => {
    const q = [...list].sort((a, b) => (RANK[b.status] || 0) - (RANK[a.status] || 0) || String(b.created).localeCompare(String(a.created)))[0];
    const extra = list.length - 1;
    return {
      id: `q-${q.id}`, auto: 'quote', link: `/quotations/${q.id}/view`, stage: QUOTE_STAGE[q.status],
      title: `Quotation ${q.number}${extra ? ` (+${extra} option${extra === 1 ? '' : 's'})` : ''}`, client: q.client,
      expand: { client: q.expand?.client || { company_name: q.bill_to_company || q.bill_to_name } }, value: num(q.total), created: q.created,
    };
  });
  return [...opps, ...fromRfqs, ...fromQuotes];
}
