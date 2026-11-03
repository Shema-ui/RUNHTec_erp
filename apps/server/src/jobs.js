// Small background jobs that keep data correct without anyone remembering to.
const pool = require('./db');
const { notifyRoles } = require('./notify');

// Today's date in Kigali (the business's time zone), as YYYY-MM-DD.
function todayKigali() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// Sent invoices whose due date has passed become "Overdue", and Finance is told once.
let running = false;
async function markOverdueInvoices() {
  if (running) return;
  running = true;
  try {
    const today = todayKigali();
    const [rows] = await pool.query(
      "SELECT id, invoice_number, bill_to_company, total, currency FROM invoices WHERE status = 'sent' AND due_date <> '' AND due_date IS NOT NULL AND due_date < ?",
      [today]
    );
    if (!rows.length) return;
    await pool.query(`UPDATE invoices SET status = 'overdue' WHERE id IN (${rows.map(() => '?').join(', ')})`, rows.map((r) => r.id));
    const list = rows.map((r) => `${r.invoice_number}${r.bill_to_company ? ` (${r.bill_to_company})` : ''}`).join(', ');
    await notifyRoles(['accountant', 'super_admin', 'admin'], 'invoice',
      `${rows.length} invoice${rows.length === 1 ? ' is' : 's are'} now overdue: ${list}`);
  } catch (err) {
    console.error('overdue job failed:', err.message);
  } finally {
    running = false;
  }
}

function startJobs() {
  markOverdueInvoices();
  setInterval(markOverdueInvoices, 30 * 60 * 1000);
}

// Next free document number like Q-2026-0007 / INV-2026-0012 (highest + 1,
// so deleting a document never makes a number come back).
async function nextNumber(table, column, prefix) {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(`SELECT \`${column}\` AS n FROM \`${table}\` WHERE \`${column}\` LIKE ?`, [`${prefix}-${year}-%`]);
  const max = rows.reduce((m, r) => Math.max(m, parseInt(String(r.n).split('-').pop(), 10) || 0), 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}

module.exports = { startJobs, markOverdueInvoices, nextNumber, todayKigali };
