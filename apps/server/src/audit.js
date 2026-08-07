const pool = require('./db');
const { genId } = require('./idGen');

const AUDITED = new Set(['users', 'company_settings', 'invoices', 'payments', 'quotations', 'rfqs', 'clients', 'projects']);

const LABEL_FIELD = {
  users: 'email',
  invoices: 'invoice_number',
  payments: 'reference',
  quotations: 'number',
  rfqs: 'company',
  clients: 'company_name',
  projects: 'title',
  company_settings: null, // static label below
};

function recordLabel(collectionName, record) {
  if (collectionName === 'company_settings') return 'Company Settings';
  const field = LABEL_FIELD[collectionName];
  return (field && record?.[field]) || record?.id || '';
}

async function writeAuditEntry({ actor, action, collectionName, record, changes }) {
  if (!AUDITED.has(collectionName)) return;
  try {
    const label = recordLabel(collectionName, record);
    const detail = [label, changes].filter(Boolean).join(' \u2014 ');
    await pool.query(
      'INSERT INTO activity_logs (id, actor, actor_name, action, detail, created) VALUES (?, ?, ?, ?, ?, NOW())',
      [genId(), actor?.id || '', actor?.name || actor?.email || 'System', `${action} ${collectionName}`, detail]
    );
  } catch (err) {
    // Audit logging must never break the operation it is observing.
    console.error('audit log failed:', err.message);
  }
}

function summarizeChanges(watchedFields, before, after) {
  if (!watchedFields || !before) return '';
  const changes = [];
  watchedFields.forEach((field) => {
    const oldVal = before[field];
    const newVal = after[field];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push(`${field}: '${oldVal}' -> '${newVal}'`);
    }
  });
  return changes.join(', ');
}

module.exports = { writeAuditEntry, summarizeChanges };
