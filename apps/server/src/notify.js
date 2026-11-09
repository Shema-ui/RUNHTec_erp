// In-app notifications (the bell in the ERP) for everyone with given roles.
const pool = require('./db');
const { genId } = require('./idGen');

// Also send each notification to the person's phone/computer if they turned
// notifications on (see webpush.js). Loaded lazily; never blocks the request.
function push(ids, message, link) {
  try { require('./webpush').pushToUsers(ids, { body: message, link }).catch(() => {}); } catch (_) { /* ignore */ }
}

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
    push(users.map((u) => u.id), message, link);
  } catch (err) {
    // A failed notification must never break the request that triggered it.
    console.error('notify failed:', err.message);
  }
}

// Notify specific people (by user id).
async function notifyUsers(userIds, type, message, link = '') {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    for (const id of ids) {
      await pool.query(
        'INSERT INTO notifications (id, user, type, message, `read`, link, created) VALUES (?, ?, ?, ?, 0, ?, NOW())',
        [genId(), id, type, String(message).slice(0, 4000), link || '']
      );
    }
    push(ids, message, link);
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
