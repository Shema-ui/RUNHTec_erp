// The private staff sign-in link: https://erp.runhteccontractors.si/staff/<key>
//
// Staff passwords are only accepted when they come with this key, so the public
// sign-in page is for clients only. The key lives in the database (never in the
// code, which is public), is created automatically, and the Super Admin can see
// it and replace it under User Management. It is also printed in the server log
// (Render → Logs) at every start, so the owner can always recover it.
const crypto = require('crypto');
const pool = require('./db');

let cache = null;
async function getStaffKey() {
  if (cache) return cache;
  const [rows] = await pool.query("SELECT value FROM app_secrets WHERE name = 'staff_login_key'");
  if (rows[0]) return (cache = rows[0].value);
  await pool.query("INSERT IGNORE INTO app_secrets (name, value) VALUES ('staff_login_key', ?)", [crypto.randomBytes(18).toString('base64url')]);
  const [again] = await pool.query("SELECT value FROM app_secrets WHERE name = 'staff_login_key'");
  return (cache = again[0].value);
}

async function rotateStaffKey() {
  const key = crypto.randomBytes(18).toString('base64url');
  await pool.query("INSERT INTO app_secrets (name, value) VALUES ('staff_login_key', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [key]);
  cache = key;
  return key;
}

// Constant-time comparison so the key can't be guessed letter by letter.
async function isStaffKey(candidate) {
  const key = await getStaffKey();
  const a = Buffer.from(String(candidate || ''));
  const b = Buffer.from(key);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const staffLink = (key) => `${process.env.APP_URL || 'https://erp.runhteccontractors.si'}/staff/${key}`;

module.exports = { getStaffKey, rotateStaffKey, isStaffKey, staffLink };
