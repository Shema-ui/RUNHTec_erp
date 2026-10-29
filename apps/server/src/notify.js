// In-app notifications (the bell in the ERP) for everyone with given roles.
const pool = require('./db');
const { genId } = require('./idGen');

async function notifyRoles(roles, type, message) {
  try {
    const [users] = await pool.query(
      `SELECT id FROM users WHERE status = 'active' AND role IN (${roles.map(() => '?').join(', ')})`,
      roles
    );
    for (const u of users) {
      await pool.query(
        'INSERT INTO notifications (id, user, type, message, `read`, created) VALUES (?, ?, ?, ?, 0, NOW())',
        [genId(), u.id, type, String(message).slice(0, 4000)]
      );
    }
  } catch (err) {
    // A failed notification must never break the request that triggered it.
    console.error('notify failed:', err.message);
  }
}

module.exports = { notifyRoles };
