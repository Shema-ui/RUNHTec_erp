// Staff commission: 5% of profit on the first project a staff member brings in.
// Profit = money the client has paid for the project minus all recorded project costs.
// The commission becomes owed only when the project is done AND the client has paid in full.
// Staff see only their own amount and status. Profit is never shown to staff.
const pool = require('./db');
const { genId } = require('./idGen');
const { notifyUsers } = require('./notify');

const COMMISSION_PERCENT = 5;

async function staffReferralFor(clientId) {
  const [rows] = await pool.query(
    `SELECT r.id, r.owner_user FROM referrals r JOIN users u ON u.id = r.owner_user
     WHERE r.referred_client = ? AND u.role NOT IN ('client', 'vendor') ORDER BY r.created ASC LIMIT 1`,
    [clientId]
  );
  return rows[0] || null;
}

async function refreshProject(projectId) {
  if (!projectId) return;
  const [pr] = await pool.query('SELECT id, client, status FROM projects WHERE id = ?', [projectId]);
  const project = pr[0];
  if (!project || !project.client) return;
  const ref = await staffReferralFor(project.client);
  if (!ref) return;
  // Only the first project this client gives us counts
  const [first] = await pool.query('SELECT id FROM projects WHERE client = ? ORDER BY created ASC, id ASC LIMIT 1', [project.client]);
  if (!first[0] || first[0].id !== project.id) return;

  const [[paidRow]] = await pool.query(
    "SELECT COALESCE(SUM(p.amount), 0) AS s FROM payments p JOIN invoices i ON i.id = p.invoice WHERE i.project = ? AND p.status = 'completed'",
    [project.id]
  );
  const [[invRow]] = await pool.query("SELECT COALESCE(SUM(total), 0) AS s FROM invoices WHERE project = ? AND status <> 'cancelled'", [project.id]);
  const [[costRow]] = await pool.query('SELECT COALESCE(SUM(amount), 0) AS s FROM project_costs WHERE project = ?', [project.id]);
  const paid = Number(paidRow.s) || 0;
  const invoiced = Number(invRow.s) || 0;
  const costs = Number(costRow.s) || 0;
  const profit = paid - costs;
  const amount = profit > 0 ? Math.round(profit * COMMISSION_PERCENT / 100) : 0;
  const ready = project.status === 'done' && invoiced > 0 && paid >= invoiced - 1;

  const [existing] = await pool.query('SELECT * FROM commissions WHERE project = ? AND staff_user = ?', [project.id, ref.owner_user]);
  const row = existing[0];
  if (row && row.status === 'paid') return; // never change a commission that has been paid

  const status = ready ? 'owed' : 'pending';
  if (row) {
    await pool.query(
      'UPDATE commissions SET paid_total = ?, cost_total = ?, profit = ?, amount = ?, status = ?, owed_at = COALESCE(owed_at, ?) WHERE id = ?',
      [paid, costs, profit, amount, status, ready ? new Date() : null, row.id]
    );
  } else {
    await pool.query(
      'INSERT INTO commissions (id, staff_user, project, client, referral, paid_total, cost_total, profit, amount, status, owed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [genId(), ref.owner_user, project.id, project.client, ref.id, paid, costs, profit, amount, status, ready ? new Date() : null]
    );
  }
  if (ready && (!row || row.status !== 'owed')) {
    await notifyUsers([ref.owner_user], 'commission', `Your commission of ${amount.toLocaleString('en-US')} RWF is ready. It will be paid in cash.`, '/referrals');
  }
}

// Works out which project a changed record belongs to and refreshes its commission.
async function commissionsHook(collectionName, row) {
  if (!row) return;
  if (collectionName === 'projects') return refreshProject(row.id);
  if (collectionName === 'project_costs') return refreshProject(row.project);
  if (collectionName === 'invoices') return refreshProject(row.project);
  if (collectionName === 'payments' && row.invoice) {
    const [inv] = await pool.query('SELECT project FROM invoices WHERE id = ?', [row.invoice]);
    return refreshProject(inv[0] && inv[0].project);
  }
}

module.exports = { commissionsHook, refreshProject, COMMISSION_PERCENT };
