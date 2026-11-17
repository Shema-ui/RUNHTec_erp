const pool = require('./db');

// Once a project has invoices, its value is what has been invoiced (excluding VAT).
// Drafts and cancelled invoices don't count. Projects without invoices keep their value.
async function syncProjectValue(projectId, db = pool) {
  if (!projectId) return;
  const [rows] = await db.query(
    "SELECT COALESCE(SUM(subtotal - COALESCE(discount_amount, 0)), 0) AS v, COUNT(*) AS n FROM invoices WHERE project = ? AND status NOT IN ('draft', 'cancelled')",
    [projectId]
  );
  if (Number(rows[0].n) === 0) return;
  await db.query('UPDATE projects SET value = ? WHERE id = ?', [Number(rows[0].v) || 0, projectId]);
}

async function hasInvoices(projectId, db = pool) {
  const [rows] = await db.query("SELECT COUNT(*) AS n FROM invoices WHERE project = ? AND status NOT IN ('draft', 'cancelled')", [projectId]);
  return Number(rows[0].n) > 0;
}

module.exports = { syncProjectValue, hasInvoices };
