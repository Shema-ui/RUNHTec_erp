// What a FIELD WORKER (technician / lead technician) may see. Office staff use the
// normal role rules in collections.js. A worker sees a project only when it is
// assigned to them or it is open for offers and matches their skills. Client
// details are cut down to the basics needed to find the site, and prices, contract
// values and internal notes are removed.
const pool = require('./db');
const { recipientsFor } = require('./routes/projectOffers');

const FIELD_ROLES = ['technician', 'lead_technician'];
const SCOPED = new Set(['projects', 'clients', 'client_sites', 'equipment', 'project_photos', 'documents', 'maintenance_contracts']);

// Only ready (registration complete) field workers get scoped access.
const isField = (u) => Boolean(u) && FIELD_ROLES.includes(u.role) && Number(u.registration_complete) !== 0;

const parseList = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch (_) { return []; } }
  return [];
};

async function fieldContext(user) {
  const [rows] = await pool.query('SELECT id, client, status, assigned_technicians, lead_technician, offers_open, offer_skills FROM projects');
  const projectIds = new Set();
  const clientIds = new Set();
  for (const p of rows) {
    if (p.status === 'cancelled') continue;
    const mine = parseList(p.assigned_technicians).includes(user.id) || p.lead_technician === user.id;
    let offered = false;
    if (!mine && Number(p.offers_open) === 1) {
      const invited = await recipientsFor(p).catch(() => []);
      offered = invited.some((u) => u.id === user.id);
    }
    if (mine || offered) {
      projectIds.add(p.id);
      if (p.client) clientIds.add(p.client);
    }
  }
  return { user, projectIds, clientIds };
}

function visibleToField(collection, r, ctx) {
  switch (collection) {
    case 'projects': return ctx.projectIds.has(r.id);
    case 'clients': return ctx.clientIds.has(r.id);
    case 'client_sites':
    case 'equipment': return ctx.clientIds.has(r.client);
    case 'project_photos':
    case 'documents': return ctx.projectIds.has(r.project);
    case 'maintenance_contracts': return r.assigned_technician === ctx.user.id;
    default: return false;
  }
}

const CLIENT_KEYS = ['id', 'client_id', 'company_name', 'trading_name', 'city', 'district', 'sector', 'street', 'building_name', 'gps_coordinates'];
const PERSON_KEYS = ['id', 'name', 'role', 'job_title'];

function cleanForField(collection, record, ctx) {
  if (!record) return record;
  const out = { ...record };
  if (collection === 'projects') ['value', 'currency', 'cost_budget', 'notes', 'quotation'].forEach((f) => delete out[f]);
  if (collection === 'documents') delete out.notes;
  if (collection === 'maintenance_contracts') ['contract_value', 'currency', 'notes'].forEach((f) => delete out[f]);
  if (collection === 'clients') return Object.fromEntries(Object.entries(out).filter(([k]) => CLIENT_KEYS.includes(k)));
  if (collection === 'users' && ctx && ctx.user && out.id !== ctx.user.id) {
    ['email', 'phone', 'whatsapp', 'registration_complete', 'profile_completed'].forEach((f) => delete out[f]);
  }
  if (out.expand) {
    const e = {};
    for (const [k, v] of Object.entries(out.expand)) {
      if (k === 'client') e[k] = v ? Object.fromEntries(Object.entries(v).filter(([kk]) => CLIENT_KEYS.includes(kk))) : v;
      else if (k === 'project') e[k] = cleanForField('projects', v, ctx);
      else if (['project_manager', 'lead_technician'].includes(k) && v) e[k] = Object.fromEntries(Object.entries(v).filter(([kk]) => PERSON_KEYS.includes(kk)));
    }
    out.expand = e;
  }
  return out;
}

module.exports = { isField, SCOPED, fieldContext, visibleToField, cleanForField };
