import pb from '@/lib/pocketbaseClient';

const n = (v) => Number(v) || 0;
const q = (v) => String(v || '').replace(/['"\\]/g, '');

// Everything the client portal shows for one client. For a client login the
// server already limits the data; the same rules are applied here so that a
// staff "preview as client" shows exactly what the client sees.
export async function loadPortal(clientId) {
  const safe = (p) => p.catch(() => []);
  const [projects, quotes, invoices, payments, msgs, settingsList, clientRec] = await Promise.all([
    safe(pb.collection('projects').getFullList({ filter: `client = '${q(clientId)}'`, sort: '-created', expand: 'project_manager,lead_technician' })),
    safe(pb.collection('quotations').getFullList({ filter: `client = '${q(clientId)}'`, sort: '-created' })),
    safe(pb.collection('invoices').getFullList({ filter: `client = '${q(clientId)}'`, sort: '-created' })),
    safe(pb.collection('payments').getFullList({ filter: `client = '${q(clientId)}'`, sort: '-created' })),
    safe(pb.collection('client_messages').getFullList({ filter: `client = '${q(clientId)}'`, sort: 'created' })),
    pb.collection('company_settings').getList(1, 1).then((r) => r.items).catch(() => []),
    pb.collection('clients').getOne(clientId).catch(() => null),
  ]);
  const myProjects = projects.filter((p) => p.client === clientId && p.status !== 'cancelled');
  const ids = new Set(myProjects.map((p) => p.id));
  const [photos, docs] = await Promise.all([
    safe(pb.collection('project_photos').getFullList({ sort: '-taken_on' })),
    safe(pb.collection('documents').getFullList({ sort: '-created' })),
  ]);
  return {
    client: clientRec,
    settings: settingsList[0] || {},
    projects: myProjects,
    quotes: quotes.filter((x) => x.client === clientId && x.status !== 'draft'),
    invoices: invoices.filter((x) => x.client === clientId && !['draft', 'cancelled'].includes(x.status)),
    payments: payments.filter((x) => x.client === clientId && x.status === 'completed'),
    messages: msgs.filter((m) => m.client === clientId),
    photos: photos.filter((ph) => Number(ph.shared) === 1 && ids.has(ph.project)).sort((a, b) => String(b.taken_on || b.created).localeCompare(String(a.taken_on || a.created)) || String(b.created).localeCompare(String(a.created))),
    docs: docs.filter((d) => Number(d.share_with_client) === 1 && (d.client === clientId || ids.has(d.project))),
  };
}

// Money for one project (or all when projectId is empty): what was agreed, invoiced, paid.
export function moneyFor(data, projectId) {
  const invs = data.invoices.filter((i) => !projectId || i.project === projectId || (!i.project && data.projects.find((p) => p.id === projectId)?.quotation && i.quotation === data.projects.find((p) => p.id === projectId)?.quotation));
  const invIds = new Set(invs.map((i) => i.id));
  const paid = data.payments.filter((p) => invIds.has(p.invoice)).reduce((s, p) => s + n(p.amount), 0);
  const invoiced = invs.reduce((s, i) => s + n(i.total), 0);
  let contract = 0;
  if (projectId) {
    const pr = data.projects.find((p) => p.id === projectId);
    const qt = data.quotes.find((x) => x.id === pr?.quotation);
    contract = qt ? n(qt.total) : n(pr?.value);
  } else {
    contract = data.projects.reduce((s, pr) => { const qt = data.quotes.find((x) => x.id === pr.quotation); return s + (qt ? n(qt.total) : n(pr.value)); }, 0);
  }
  return { invoices: invs, invoiced, paid, balance: Math.max(0, invoiced - paid), contract };
}

export function whatsappLink(settings, text) {
  const num = String(settings?.whatsapp_number || settings?.company_phone || '').replace(/\D/g, '');
  return num ? `https://wa.me/${num}?text=${encodeURIComponent(text || 'Hello RUNHTec, ')}` : '';
}

export const ASSIST_TOPICS = ['Question', 'Fault / something not working', 'Site visit', 'Payment', 'Change request', 'Other'];

// Kigali dates shown as e.g. "Mon 3 Nov 2026"; in the viewer's own time zone.
export const dayLabel = (v) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : String(v).replace(' ', 'T') + (String(v).includes('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};
export const timeLabel = (v) => {
  const d = new Date(String(v).replace(' ', 'T') + (String(v).includes('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
