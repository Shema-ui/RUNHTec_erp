// Email a quotation or invoice (PDF attached) from the company address.
//
// The message always starts "Dear RUNHTec Customer,". The standard wording is
// editable by the Super Admin in Settings → Email (company_settings fields
// quote_email_subject / quote_email_body / invoice_email_subject / invoice_email_body).
// Words in {curly brackets} are filled in: {number} {total} {valid_until}
// {due_date} {company_phone} {company_email} {app_link}
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../auth');
const { collections } = require('../collections');
const { emailEnabled, sendEmail } = require('../mailer');
const { writeAuditEntry } = require('../audit');
const { createLimiter } = require('../rateLimit');

const router = express.Router();
const sendLimit = createLimiter({ windowMs: 60 * 60 * 1000, max: 40 });

const GREETING = 'Dear RUNHTec Customer,';
const DEFAULTS = {
  quotation: {
    subject: 'Quotation {number} from RUNHTec Contractors',
    body: `Dear RUNHTec Customer,

Thank you for choosing RUNHTec Contractors Ltd. Please find attached our quotation {number} for {total}, valid until {valid_until}.

To go ahead, simply reply to this email or call us on {company_phone}. If you use the My RUNHTec app, you can also accept the quotation there: {app_link}

If anything needs to change, we will gladly adjust it.

Kind regards,
RUNHTec Contractors Ltd
Electrical · HVAC · Solar · Generators · Maintenance
{company_phone} · {company_email}`,
  },
  invoice: {
    subject: 'Invoice {number} from RUNHTec Contractors',
    body: `Dear RUNHTec Customer,

Thank you for working with RUNHTec Contractors Ltd. Please find attached invoice {number} for {total}, due on {due_date}.

The payment details are on the invoice. Please use {number} as your payment reference.

For any question about this invoice, simply reply to this email or call us on {company_phone}.

Kind regards,
RUNHTec Contractors Ltd
Electrical · HVAC · Solar · Generators · Maintenance
{company_phone} · {company_email}`,
  },
};

const TYPES = {
  quotation: { collection: 'quotations', number: 'number', subjectField: 'quote_email_subject', bodyField: 'quote_email_body' },
  invoice: { collection: 'invoices', number: 'invoice_number', subjectField: 'invoice_email_subject', bodyField: 'invoice_email_body' },
};

const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
const realEmail = (e) => EMAIL.test(String(e || '').trim()) && !/\.runhtec\.local$/i.test(String(e).trim());
const splitList = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,;\s]+/)).map((x) => String(x).trim().toLowerCase()).filter(Boolean);

// The client's email: the one on the document, else the client's primary contact, else their app login.
async function recipientFor(doc) {
  if (realEmail(doc.bill_to_email)) return String(doc.bill_to_email).trim().toLowerCase();
  if (!doc.client) return '';
  const [contacts] = await pool.query('SELECT email FROM client_contacts WHERE client = ? ORDER BY is_primary DESC, created', [doc.client]);
  const c = contacts.find((x) => realEmail(x.email));
  if (c) return c.email.trim().toLowerCase();
  const [users] = await pool.query("SELECT email FROM users WHERE role = 'client' AND client = ? AND status = 'active'", [doc.client]);
  const u = users.find((x) => realEmail(x.email));
  return u ? u.email.trim().toLowerCase() : '';
}

const money = (v, cur) => `${cur || 'RWF'} ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const dateWords = (v) => {
  const s = String(v || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  return new Date(`${s}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

function fill(text, doc, type, cfg) {
  const vars = {
    number: doc[TYPES[type].number] || '',
    total: money(doc.total, doc.currency),
    valid_until: dateWords(doc.valid_until) || 'the date shown on the quotation',
    due_date: dateWords(doc.due_date) || 'the date shown on the invoice',
    company_phone: cfg.company_phone || '',
    company_email: cfg.company_email || process.env.MAIL_FROM || '',
    app_link: `${(process.env.APP_URL || 'https://erp.runhteccontractors.si').replace(/\/$/, '')}/app`,
  };
  return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// Every client email starts with the same greeting.
function withGreeting(body) {
  const b = String(body || '').replace(/^\s+/, '');
  return b.toLowerCase().startsWith(GREETING.toLowerCase()) ? b : `${GREETING}\n\n${b}`;
}

function toHtml(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const linked = (s) => esc(s).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#003DA5">$1</a>');
  const paras = String(text).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${linked(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1e293b;max-width:600px">${paras}<hr style="border:none;border-top:3px solid #003DA5;margin:22px 0 8px;width:60px;text-align:left"><p style="margin:0;font-size:12px;color:#64748b">RUNHTec Contractors Ltd · Kigali · Kampala</p></div>`;
}

async function loadDoc(type, id, user) {
  const t = TYPES[type];
  if (!t) return { error: [400, 'Unknown document type.'] };
  const def = collections[t.collection];
  const [rows] = await pool.query(`SELECT * FROM \`${def.table}\` WHERE id = ?`, [String(id || '')]);
  const doc = rows[0];
  if (!doc || !def.rules.view(user, doc)) return { error: [404, 'Not found.'] };
  if (!def.rules.update(user, doc)) return { error: [403, 'You are not allowed to send this document.'] };
  const [cfgRows] = await pool.query('SELECT * FROM company_settings LIMIT 1');
  return { doc, cfg: cfgRows[0] || {}, t, def };
}

function template(type, cfg) {
  const t = TYPES[type];
  return { subject: String(cfg[t.subjectField] || '').trim() || DEFAULTS[type].subject, body: String(cfg[t.bodyField] || '').trim() || DEFAULTS[type].body };
}

// GET /api/doc-email/prepare?type=quotation|invoice&id=… — the ready-to-send email.
router.get('/prepare', requireAuth, async (req, res) => {
  try {
    const type = String(req.query.type || '');
    const r = await loadDoc(type, req.query.id, req.user);
    if (r.error) return res.status(r.error[0]).json({ message: r.error[1] });
    const tpl = template(type, r.cfg);
    res.json({
      enabled: emailEnabled(),
      to: await recipientFor(r.doc),
      subject: fill(tpl.subject, r.doc, type, r.cfg),
      body: withGreeting(fill(tpl.body, r.doc, type, r.cfg)),
      emailed_at: r.doc.emailed_at || null,
      emailed_to: r.doc.emailed_to || '',
    });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// GET /api/doc-email/defaults — the standard wording (Settings shows it when nothing is saved).
router.get('/defaults', requireAuth, (req, res) => res.json(DEFAULTS));

// POST /api/doc-email/send {type, id, to, cc, subject, body, pdf (base64), auto}
router.post('/send', requireAuth, async (req, res) => {
  const b = req.body || {};
  const type = String(b.type || '');
  if (!emailEnabled()) return res.status(400).json({ message: 'Email is not set up yet (Settings → Email).' });
  if (sendLimit.isBlocked(req.user.id)) return res.status(429).json({ message: 'Many emails sent in a short time. Please wait a little.' });
  const to = splitList(b.to); const cc = splitList(b.cc);
  if (!to.length) return res.status(400).json({ message: 'Add the client’s email address.' });
  const bad = [...to, ...cc].find((e) => !realEmail(e));
  if (bad) return res.status(400).json({ message: `“${bad}” doesn’t look like an email address.` });
  if (to.length + cc.length > 10) return res.status(400).json({ message: 'Send to at most 10 addresses at once.' });
  const pdf = String(b.pdf || '').replace(/^data:application\/pdf;[^,]*,/, '');
  if (!/^[A-Za-z0-9+/=\s]+$/.test(pdf) || pdf.length < 200) return res.status(400).json({ message: 'The PDF could not be prepared. Please try again.' });
  if (pdf.length > 11 * 1024 * 1024) return res.status(400).json({ message: 'The PDF is too large to email.' });
  try {
    const r = await loadDoc(type, b.id, req.user);
    if (r.error) return res.status(r.error[0]).json({ message: r.error[1] });
    const { doc, cfg, t, def } = r;
    const tpl = template(type, cfg);
    const subject = String(b.subject || '').trim().slice(0, 200) || fill(tpl.subject, doc, type, cfg);
    const body = withGreeting(String(b.body || '').trim() ? String(b.body).slice(0, 8000) : fill(tpl.body, doc, type, cfg));
    const number = doc[t.number] || type;
    sendLimit.hit(req.user.id);
    const ok = await sendEmail({
      to, cc, subject, text: body, html: toHtml(body),
      attachments: [{ name: `${String(number).replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`, content: pdf.replace(/\s/g, '') }],
    });
    if (!ok) return res.status(502).json({ message: 'The email service refused the message. Check Settings → Email, or the Render logs ("email failed").' });
    const sentTo = [...to, ...cc].join(', ').slice(0, 500);
    const newStatus = doc.status === 'draft' ? 'sent' : doc.status;
    await pool.query(`UPDATE \`${def.table}\` SET emailed_at = UTC_TIMESTAMP(), emailed_to = ?, status = ? WHERE id = ?`, [sentTo, newStatus, doc.id]);
    await writeAuditEntry({ actor: req.user, action: 'Updated', collectionName: t.collection, record: { ...doc, status: newStatus }, changes: `${b.auto ? 'Automatically emailed' : 'Emailed'} ${type} ${number} to ${sentTo}` }).catch(() => {});
    const [rows] = await pool.query(`SELECT * FROM \`${def.table}\` WHERE id = ?`, [doc.id]);
    res.json({ ok: true, to: sentTo, status: newStatus, emailed_at: rows[0]?.emailed_at });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
module.exports.withGreeting = withGreeting;
module.exports.fill = fill;
module.exports.DEFAULTS = DEFAULTS;
module.exports.realEmail = realEmail;
