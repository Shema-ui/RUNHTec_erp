// Every invoice also appears on the Quotations page. When an invoice is made
// without a quotation (directly, or from a project with no quote), a matching
// quotation is created and linked, and kept in step while the invoice changes.
const pool = require('./db');
const { genId } = require('./idGen');

const COPY = ['client', 'items', 'subtotal', 'tax_rate', 'tax_amount', 'discount_amount', 'total', 'currency',
  'terms_conditions', 'bill_to_name', 'bill_to_company', 'bill_to_address', 'bill_to_email', 'bill_to_phone', 'costing'];
const JSON_COLS = new Set(['items', 'costing']);

const val = (k, v) => (JSON_COLS.has(k) && v !== null && v !== undefined && typeof v !== 'string' ? JSON.stringify(v) : (v === undefined ? null : v));

async function nextQuoteNumber(db) {
  const year = new Date().getFullYear();
  const [rows] = await db.query('SELECT number FROM quotations WHERE number LIKE ?', [`Q-${year}-%`]);
  const max = rows.reduce((m, r) => Math.max(m, parseInt(String(r.number).split('-')[2], 10) || 0), 0);
  return `Q-${year}-${String(max + 1).padStart(4, '0')}`;
}

// invoice: a raw DB row (JSON columns may be strings). Returns the quotation id.
async function ensureQuoteForInvoice(invoice, db = pool) {
  if (!invoice || invoice.quotation) return invoice?.quotation || null;
  const [existing] = await db.query('SELECT id FROM quotations WHERE source_invoice = ?', [invoice.id]);
  let qid = existing[0]?.id;
  if (!qid) {
    qid = genId();
    const cols = ['id', 'number', 'status', 'source_invoice', 'notes', ...COPY];
    const vals = [qid, await nextQuoteNumber(db), 'accepted', invoice.id, `Created from invoice ${invoice.invoice_number || ''}`.trim(), ...COPY.map((k) => val(k, invoice[k]))];
    await db.query(`INSERT INTO quotations (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
  }
  await db.query('UPDATE invoices SET quotation = ? WHERE id = ?', [qid, invoice.id]);
  return qid;
}

// Keep an auto-created quotation matching its invoice after edits.
async function syncQuoteFromInvoice(invoice, db = pool) {
  if (!invoice) return;
  const [rows] = await db.query('SELECT id FROM quotations WHERE source_invoice = ?', [invoice.id]);
  if (!rows[0]) return;
  await db.query(`UPDATE quotations SET ${COPY.map((c) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`, [...COPY.map((k) => val(k, invoice[k])), rows[0].id]);
}

async function removeQuoteForInvoice(invoiceId, db = pool) {
  await db.query('DELETE FROM quotations WHERE source_invoice = ?', [invoiceId]);
}

module.exports = { ensureQuoteForInvoice, syncQuoteFromInvoice, removeQuoteForInvoice };
