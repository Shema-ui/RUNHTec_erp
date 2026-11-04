// In-app notifications (the bell in the ERP) for everyone with given roles.
const pool = require('./db');
const { genId } = require('./idGen');

async function notifyRoles(roles, type, message, link = '') {
  try {
    const [users] = await pool.query(
      `SELECT id FROM users WHERE status = 'active' AND role IN (${roles.map(() => '?').join(', ')})`,
      roles
    );
    for (const u of users) {
      await pool.query(
        'INSERT INTO notifications (id, user, type, message, `read`, link, created) VALUES (?, ?, ?, ?, 0, ?, NOW())',
        [genId(), u.id, type, String(message).slice(0, 4000), link || '']
      );
    }
  } catch (err) {
    // A failed notification must never break the request that triggered it.
    console.error('notify failed:', err.message);
  }
}

// Notify specific people (by user id).
async function notifyUsers(userIds, type, message, link = '') {
  try {
    for (const id of [...new Set((userIds || []).filter(Boolean))]) {
      await pool.query(
        'INSERT INTO notifications (id, user, type, message, `read`, link, created) VALUES (?, ?, ?, ?, 0, ?, NOW())',
        [genId(), id, type, String(message).slice(0, 4000), link || '']
      );
    }
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
