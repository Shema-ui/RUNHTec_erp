// In-app notifications (the bell in the ERP), also sent by email and to the
// person's phone/computer if they turned notifications on (see webpush.js).
const pool = require('./db');
const { genId } = require('./idGen');
const { emailEnabled, sendEmail } = require('./mailer');
const { renderEmail } = require('./emailLayout');

const APP_URL = () => process.env.APP_URL || 'https://erp.runhteccontractors.si';

// Push is loaded lazily and never blocks the request.
function push(ids, message, link) {
  try { require('./webpush').pushToUsers(ids, { body: message, link }).catch(() => {}); } catch (_) { /* ignore */ }
}

// Default email for a notification: the same words, with a button into the app.
function defaultEmail(user, message, link) {
  const text = String(message);
  const m = renderEmail({
    greeting: `Dear ${user.name || 'colleague'},`,
    paragraphs: [text],
    button: link ? { label: 'Open in the RUNHTec portal', url: `${APP_URL()}${link}` } : null,
    closing: ['Thank you.'],
    signoff: 'RUNHTec Contractors Ltd',
  });
  return { subject: `RUNHTec: ${text.slice(0, 90)}`, text: m.text, html: m.html };
}

// Sends the email for each person who has an address. Never throws.
function emailUsers(users, message, link, opts = {}) {
  if (!emailEnabled()) return;
  for (const u of users) {
    if (!u.email) continue;
    let m;
    try { m = opts.email ? opts.email(u) : defaultEmail(u, message, link); } catch (_) { continue; }
    sendEmail({ to: u.email, subject: m.subject, text: m.text, html: m.html })
      .catch((err) => console.error('Notification email failed:', err.message));
  }
}

async function insertNotification(userId, type, message, link) {
  await pool.query(
    'INSERT INTO notifications (id, user, type, message, `read`, link, created) VALUES (?, ?, ?, ?, 0, ?, NOW())',
    [genId(), userId, type, String(message).slice(0, 4000), link || '']
  );
}

async function notifyRoles(roles, type, message, link = '') {
  try {
    const [users] = await pool.query(
      `SELECT id, name, email FROM users WHERE status = 'active' AND role IN (${roles.map(() => '?').join(', ')})`,
      roles
    );
    for (const u of users) await insertNotification(u.id, type, message, link);
    push(users.map((u) => u.id), message, link);
    emailUsers(users, message, link);
  } catch (err) {
    // A failed notification must never break the request that triggered it.
    console.error('notify failed:', err.message);
  }
}

// Notify specific people (by user id). opts.email(user) can supply a custom email.
async function notifyUsers(userIds, type, message, link = '', opts = {}) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return;
    const [users] = await pool.query(`SELECT id, name, email FROM users WHERE id IN (${ids.map(() => '?').join(', ')})`, ids);
    for (const id of ids) await insertNotification(id, type, message, link);
    push(ids, message, link);
    emailUsers(users, message, link, opts);
  } catch (err) {
    console.error('notify failed:', err.message);
  }
}

// Everyone with a portal login for a client.
async function notifyClient(clientId, type, message, link = '') {
  if (!clientId) return;
  try {
    const [rows] = await pool.query("SELECT id FROM users WHERE role = 'client' AND status = 'active' AND client = ?", [clientId]);
    await notifyUsers(rows.map((r) => r.id), type, message, link);
  } catch (err) { console.error('notify failed:', err.message); }
}

module.exports = { notifyRoles, notifyUsers, notifyClient };
