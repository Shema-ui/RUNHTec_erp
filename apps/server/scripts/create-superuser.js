// One-time helper to create (or update) a super_admin account without
// needing to hand-run bcrypt + SQL separately. Run from apps/server with
// the same environment variables as the running app (DB_HOST, DB_USER,
// DB_PASSWORD, DB_NAME must be set — e.g. via `.env` locally, or paste
// them inline on Hostinger's SSH/terminal if available):
//
//   node scripts/create-superuser.js you@runhteccontractors.com "a-strong-password" "Your Name"
//
// Safe to re-run: if the email already exists, it updates the password
// and role instead of failing.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const { genId } = require('../src/idGen');

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: node scripts/create-superuser.js <email> <password> [name]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password should be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);

  if (existing[0]) {
    await pool.query('UPDATE users SET password_hash = ?, role = ?, status = ? WHERE id = ?', [passwordHash, 'super_admin', 'active', existing[0].id]);
    console.log(`Updated existing account ${email} -> super_admin, password reset.`);
  } else {
    const id = genId();
    await pool.query(
      'INSERT INTO users (id, email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, passwordHash, name || 'Super Administrator', 'super_admin', 'active']
    );
    console.log(`Created super_admin account: ${email}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
