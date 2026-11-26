// Staff sign-in accounts created from approved applications.
// The staff link is emailed automatically on approval. The password is only
// created when an admin presses "Send login password" and is shown once, so the
// server never stores it in readable form. A temporary password expires after 72 hours.
const crypto = require('crypto');
const pool = require('./db');
const { genId } = require('./idGen');
const { bcrypt } = require('./auth');

const TEMP_HOURS = 72;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (0/o, 1/l/i)

function randomPassword(len = 10) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

// Returns the user row for this applicant, creating a staff account if needed.
// The account gets an unguessable password so it cannot be used until an admin sends one.
async function ensureStaffAccount(app) {
  const email = String(app.email || '').trim().toLowerCase();
  if (!email) return null;
  const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(email) = ?', [email]);
  if (rows[0]) {
    if (['client', 'vendor'].includes(rows[0].role)) return null; // never turn a client account into staff
    return rows[0];
  }
  const id = genId();
  const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  await pool.query(
    "INSERT INTO users (id, email, password_hash, name, phone, role, status, registration_complete) VALUES (?, ?, ?, ?, ?, 'technician', 'active', 0)",
    [id, email, hash, app.full_name || '', app.phone || '']
  );
  const [created] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  return created[0];
}

// Creates a new temporary password for an existing staff account. Returns it once.
async function issueTempPassword(email) {
  const password = randomPassword();
  const hash = await bcrypt.hash(password, 10);
  const expires = new Date(Date.now() + TEMP_HOURS * 3600 * 1000);
  const [res] = await pool.query(
    "UPDATE users SET password_hash = ?, temp_password_expires = ? WHERE LOWER(email) = ? AND role NOT IN ('client','vendor')",
    [hash, expires, String(email).trim().toLowerCase()]
  );
  if (!res.affectedRows) return null;
  return { password, expires };
}

module.exports = { ensureStaffAccount, issueTempPassword, TEMP_HOURS };
