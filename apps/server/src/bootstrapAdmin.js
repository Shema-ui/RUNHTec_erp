// Creates the first Super Administrator automatically on startup.
//
// Free hosting (e.g. Render's free plan) has no terminal, so the
// scripts/create-superuser.js helper can't be run there. Instead, set these
// environment variables on the hosting platform:
//
//   ADMIN_EMAIL     e.g. admin@runhteccontractors.si
//   ADMIN_PASSWORD  at least 8 characters
//   ADMIN_NAME      optional, defaults to "Super Administrator"
//
// On startup, if NO super_admin account exists yet, one is created with
// these details. If a super_admin already exists, nothing happens, so the
// variables can't be used to take over an existing system. After the first
// successful login you can delete ADMIN_PASSWORD from the platform.

const bcrypt = require('bcryptjs');
const pool = require('./db');
const { genId } = require('./idGen');

async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return;

  const [rows] = await pool.query("SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin'");
  if (rows[0].n > 0) {
    console.log('[bootstrap] super_admin already exists; ADMIN_* variables ignored.');
    return;
  }
  if (password.length < 8) {
    console.warn('[bootstrap] ADMIN_PASSWORD must be at least 8 characters; no account created.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing[0]) {
    await pool.query('UPDATE users SET password_hash = ?, role = ?, status = ? WHERE id = ?',
      [passwordHash, 'super_admin', 'active', existing[0].id]);
  } else {
    await pool.query(
      'INSERT INTO users (id, email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [genId(), email, passwordHash, process.env.ADMIN_NAME || 'Super Administrator', 'super_admin', 'active']
    );
  }
  console.log(`[bootstrap] Created first super_admin account: ${email}`);
}

module.exports = { bootstrapAdmin };
