// Keeps an invoice's status in step with the payments recorded against it.
// Called after a payment is created, changed or deleted, so the invoice list,
// the invoice page, reminders and reports all agree with the money received.
const pool = require('./db');

async function syncInvoicePayments(invoiceId) {
  if (!invoiceId) return;
  const [[inv]] = await pool.query('SELECT id, total, status FROM invoices WHERE id = ?', [invoiceId]);
  if (!inv || inv.status === 'cancelled' || inv.status === 'draft') return;
  const [[sum]] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice = ? AND status = 'completed'",
    [invoiceId]
  );
  const paid = Number(sum.paid) || 0;
  const total = Number(inv.total) || 0;
  const fullyPaid = total > 0 && paid >= total - 0.5;
  if (fullyPaid && inv.status !== 'paid') {
    await pool.query("UPDATE invoices SET status = 'paid' WHERE id = ?", [invoiceId]);
  } else if (!fullyPaid && inv.status === 'paid') {
    await pool.query("UPDATE invoices SET status = 'sent' WHERE id = ?", [invoiceId]);
  }
}

module.exports = { syncInvoicePayments };
