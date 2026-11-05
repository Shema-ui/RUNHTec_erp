// What a CLIENT (portal login) may see. Clients never use the staff rules:
// every record is checked here against the client they belong to, and
// internal fields are removed before anything leaves the server.
const pool = require('./db');

const READABLE = new Set(['projects', 'project_photos', 'quotations', 'invoices', 'payments', 'documents', 'client_messages', 'company_settings', 'clients', 'notifications']);
// Writes a client may make through the generic API (everything else goes through routes/portal.js).
const WRITABLE = { notifications: ['PATCH'], activity_logs: ['POST'] };

// Fields a client must never receive.
const HIDDEN = {
  projects: ['notes', 'cost_budget', 'assigned_technicians'],
  quotations: ['costing', 'notes_internal'],
  invoices: ['costing', 'created_by'],
  company_settings: ['labour_rates', 'default_contingency', 'vendor_markup', 'exchange_rates', 'solar_kit'],
  clients: ['potential_value', 'account_manager', 'categories'],
  documents: ['notes'],
  payments: ['notes', 'recorded_by_name'],
};

async function clientContext(user) {
  const [rows] = await pool.query('SELECT id FROM projects WHERE client = ?', [user.client || '__none__']);
  return { clientId: user.client || '__none__', projectIds: new Set(rows.map((r) => r.id)) };
}

function visible(collection, r, user, ctx) {
  const c = ctx.clientId;
  switch (collection) {
    case 'projects': return r.client === c && r.status !== 'cancelled';
    case 'project_photos': return Number(r.shared) === 1 && ctx.projectIds.has(r.project);
    case 'quotations': return r.client === c && r.status !== 'draft';
    case 'invoices': return r.client === c && !['draft', 'cancelled'].includes(r.status);
    case 'payments': return r.client === c && r.status === 'completed';
    case 'documents': return Number(r.share_with_client) === 1 && (r.client === c || ctx.projectIds.has(r.project));
    case 'client_messages': return r.client === c;
    case 'company_settings': return true;
    case 'clients': return r.id === c;
    case 'notifications': return r.user === user.id;
    default: return false;
  }
}

function clean(collection, record) {
  if (!record) return record;
  const out = { ...record };
  (HIDDEN[collection] || []).forEach((f) => delete out[f]);
  if (Array.isArray(out.items)) out.items = out.items.map((i) => (i && typeof i === 'object' ? (({ cost, vendor_item, cost_source, ...rest }) => rest)(i) : i));
  if (out.expand) {
    const e = {};
    for (const [k, v] of Object.entries(out.expand)) {
      if (k === 'quotation' || k === 'invoice') e[k] = clean(k === 'quotation' ? 'quotations' : 'invoices', v);
      else if (k === 'project') e[k] = clean('projects', v);
      else if (k === 'client') e[k] = clean('clients', v);
      else if (['project_manager', 'lead_technician', 'uploaded_by', 'sender'].includes(k) && v) e[k] = { id: v.id, name: v.name, phone: v.phone, email: v.email, role: v.role };
    }
    out.expand = e;
  }
  return out;
}

module.exports = { READABLE, WRITABLE, clientContext, visible, clean };
