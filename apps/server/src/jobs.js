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

// Sent quotations whose "valid until" date has passed become "Expired", so
// they leave the open pipeline and stop showing as waiting for an answer.
// Sales is told once. (A quote with no validity date never expires by itself.)
let runningQ = false;
async function markExpiredQuotes() {
  if (runningQ) return;
  runningQ = true;
  try {
    const today = todayKigali();
    const [rows] = await pool.query(
      "SELECT id, number, bill_to_company FROM quotations WHERE status = 'sent' AND valid_until LIKE '____-__-__' AND valid_until < ?",
      [today]
    );
    if (!rows.length) return;
    await pool.query(`UPDATE quotations SET status = 'expired' WHERE id IN (${rows.map(() => '?').join(', ')})`, rows.map((r) => r.id));
    const list = rows.map((r) => `${r.number}${r.bill_to_company ? ` (${r.bill_to_company})` : ''}`).join(', ');
    await notifyRoles(['sales', 'super_admin', 'admin'], 'quotation',
      `${rows.length} quotation${rows.length === 1 ? ' has' : 's have'} passed the validity date and ${rows.length === 1 ? 'is' : 'are'} now Expired: ${list}. Re-send with a new date if the client is still interested.`);
  } catch (err) {
    console.error('quote expiry job failed:', err.message);
  } finally {
    runningQ = false;
  }
}

// Reminders to clients (in their app): maintenance visits and equipment
// service due in the next 2 days, invoices due in 3 days, warranties ending
// within 30 days. Each reminder is sent once.
let runningR = false;
const fmtDay = (iso) => { const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); };
function addDays(iso, n) { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
async function sendClientReminders() {
  if (runningR) return;
  runningR = true;
  const { notifyClient } = require('./notify');
  try {
    const today = todayKigali();
    const in2 = addDays(today, 2); const in3 = addDays(today, 3); const in30 = addDays(today, 30);
    const [visits] = await pool.query(
      "SELECT id, client, service_type, next_due_date FROM maintenance_contracts WHERE active = 1 AND client IS NOT NULL AND next_due_date LIKE '____-__-__' AND next_due_date >= ? AND next_due_date <= ? AND (last_reminded IS NULL OR last_reminded <> next_due_date)",
      [today, in2]);
    for (const v of visits) {
      await notifyClient(v.client, 'reminder', `Reminder: your ${v.service_type || 'maintenance'} visit is due on ${fmtDay(v.next_due_date)}. Need to change the day? Message us in the app.`, '/portal/equipment');
      await pool.query('UPDATE maintenance_contracts SET last_reminded = next_due_date WHERE id = ?', [v.id]);
    }
    const [eq] = await pool.query(
      "SELECT id, client, name, next_service_date FROM equipment WHERE client IS NOT NULL AND status <> 'decommissioned' AND next_service_date IS NOT NULL AND next_service_date >= ? AND next_service_date <= ?",
      [today, in2]);
    for (const e of eq) {
      const due = String(e.next_service_date instanceof Date ? e.next_service_date.toISOString() : e.next_service_date).slice(0, 10);
      const [chk] = await pool.query('SELECT last_reminded FROM equipment WHERE id = ?', [e.id]);
      if (chk[0]?.last_reminded === due) continue;
      await notifyClient(e.client, 'reminder', `Reminder: ${e.name} is due for service on ${fmtDay(due)}. Tap to request the visit.`, '/portal/requests/new?kind=maintenance');
      await pool.query('UPDATE equipment SET last_reminded = ? WHERE id = ?', [due, e.id]);
    }
    const [inv] = await pool.query(
      "SELECT id, client, invoice_number, total, currency, due_date FROM invoices WHERE status = 'sent' AND client IS NOT NULL AND due_reminded = 0 AND due_date LIKE '____-__-__' AND due_date >= ? AND due_date <= ?",
      [today, in3]);
    for (const i of inv) {
      const amount = `${i.currency || 'RWF'} ${Number(i.total || 0).toLocaleString('en-US')}`;
      await notifyClient(i.client, 'invoice', `Friendly reminder: invoice ${i.invoice_number} (${amount}) is due on ${fmtDay(i.due_date)}.`, '/portal');
      await pool.query('UPDATE invoices SET due_reminded = 1 WHERE id = ?', [i.id]);
    }
    const [war] = await pool.query(
      "SELECT id, client, name, warranty_expiry FROM equipment WHERE client IS NOT NULL AND warranty_reminded = 0 AND status <> 'decommissioned' AND warranty_expiry IS NOT NULL AND warranty_expiry >= ? AND warranty_expiry <= ?",
      [today, in30]);
    for (const w of war) {
      const end = String(w.warranty_expiry instanceof Date ? w.warranty_expiry.toISOString() : w.warranty_expiry).slice(0, 10);
      await notifyClient(w.client, 'reminder', `The warranty on ${w.name} ends on ${fmtDay(end)}. Book a check-up before it ends.`, '/portal/requests/new?kind=warranty');
      await pool.query('UPDATE equipment SET warranty_reminded = 1 WHERE id = ?', [w.id]);
    }
  } catch (err) {
    console.error('client reminders failed:', err.message);
  } finally {
    runningR = false;
  }
}

function startJobs() {
  markOverdueInvoices();
  markExpiredQuotes();
  sendClientReminders();
  setInterval(() => { markOverdueInvoices(); markExpiredQuotes(); sendClientReminders(); }, 30 * 60 * 1000);
}

// Next free document number like Q-2026-0007 / INV-2026-0012 (highest + 1,
// so deleting a document never makes a number come back).
async function nextNumber(table, column, prefix) {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(`SELECT \`${column}\` AS n FROM \`${table}\` WHERE \`${column}\` LIKE ?`, [`${prefix}-${year}-%`]);
  const max = rows.reduce((m, r) => Math.max(m, parseInt(String(r.n).split('-').pop(), 10) || 0), 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}

module.exports = { startJobs, markOverdueInvoices, markExpiredQuotes, sendClientReminders, nextNumber, todayKigali };
