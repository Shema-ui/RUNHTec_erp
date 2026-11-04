// Client portal actions (clients can't use the staff API to write anything).
const express = require('express');
const pool = require('../db');
const { genId } = require('../idGen');
const crypto = require('crypto');
const { requireAuth, signToken, sanitizeUser, bcrypt } = require('../auth');
const { notifyUsers, notifyRoles, notifyClient } = require('../notify');
const { createLimiter } = require('../rateLimit');
const msgLimit = createLimiter({ windowMs: 60 * 60 * 1000, max: 30 });
const enterLimit = createLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
const GRANT = ['super_admin', 'admin', 'sales', 'project_manager'];
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

const router = express.Router();
const STAFF = ['super_admin', 'admin', 'sales', 'project_manager', 'accountant', 'hr'];
const TOPICS = ['Question', 'Fault / something not working', 'Site visit', 'Payment', 'Change request', 'Other'];

function clientOnly(req, res, next) {
  if (req.user?.role !== 'client' || !req.user.client) return res.status(403).json({ message: 'Client portal only.' });
  next();
}

// Who on the team should hear about a client's message.
async function alertTeam(clientId, projectId, text, link) {
  const ids = new Set();
  if (projectId) {
    const [p] = await pool.query('SELECT project_manager, client FROM projects WHERE id = ?', [projectId]);
    if (p[0]?.project_manager) ids.add(p[0].project_manager);
  }
  const [c] = await pool.query('SELECT account_manager FROM clients WHERE id = ?', [clientId]);
  if (c[0]?.account_manager) ids.add(c[0].account_manager);
  if (ids.size) await notifyUsers([...ids], 'client', text, link);
  await notifyRoles(['super_admin', 'admin'], 'client', text, link);
}

// POST /api/portal/messages — client writes to the team (message or assistance request).
router.post('/messages', requireAuth, clientOnly, async (req, res) => {
  const body = String(req.body?.body || '').trim().slice(0, 4000);
  const kind = req.body?.kind === 'assistance' ? 'assistance' : 'message';
  const topic = TOPICS.includes(req.body?.topic) ? req.body.topic : '';
  let project = req.body?.project || null;
  if (!body) return res.status(400).json({ message: 'Write your message first.' });
  if (msgLimit.isBlocked(req.user.id)) return res.status(429).json({ message: 'Too many messages, please wait a little.' });
  msgLimit.hit(req.user.id);
  try {
    if (project) {
      const [p] = await pool.query('SELECT id FROM projects WHERE id = ? AND client = ?', [project, req.user.client]);
      if (!p[0]) project = null;
    }
    const id = genId();
    await pool.query(
      'INSERT INTO client_messages (id, client, project, sender, sender_name, sender_role, kind, topic, body, read_by_client, read_by_staff) VALUES (?, ?, ?, ?, ?, \'client\', ?, ?, ?, 1, 0)',
      [id, req.user.client, project, req.user.id, req.user.name || req.user.email, kind, topic, body]
    );
    const [cl] = await pool.query('SELECT company_name FROM clients WHERE id = ?', [req.user.client]);
    const who = cl[0]?.company_name || req.user.name || 'A client';
    await alertTeam(req.user.client, project,
      kind === 'assistance' ? `Assistance request from ${who}${topic ? ` (${topic})` : ''}: ${body.slice(0, 120)}` : `Message from ${who}: ${body.slice(0, 120)}`,
      `/client-messages?client=${req.user.client}`);
    const [rows] = await pool.query('SELECT * FROM client_messages WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// POST /api/portal/messages/read — client has seen the team's replies.
router.post('/messages/read', requireAuth, clientOnly, async (req, res) => {
  await pool.query("UPDATE client_messages SET read_by_client = 1 WHERE client = ? AND sender_role = 'staff'", [req.user.client]);
  res.json({ ok: true });
});

// POST /api/portal/staff-read — a team member has read a client's messages.
router.post('/staff-read', requireAuth, async (req, res) => {
  if (!STAFF.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  await pool.query("UPDATE client_messages SET read_by_staff = 1 WHERE client = ? AND sender_role = 'client'", [String(req.body?.client || '')]);
  res.json({ ok: true });
});

// POST /api/portal/projects/:id/handover — client confirms the work is handed over.
router.post('/projects/:id/handover', requireAuth, clientOnly, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ? AND client = ?', [req.params.id, req.user.client]);
    const p = rows[0];
    if (!p) return res.status(404).json({ message: 'Project not found.' });
    if (p.status !== 'done') return res.status(400).json({ message: 'The project is not marked complete yet.' });
    if (p.handover_confirmed_at) return res.status(400).json({ message: 'Handover was already confirmed.' });
    const note = String(req.body?.note || '').trim().slice(0, 1000);
    await pool.query('UPDATE projects SET handover_confirmed_at = UTC_TIMESTAMP(), handover_confirmed_by = ?, handover_note = ? WHERE id = ?',
      [req.user.name || req.user.email, note, p.id]);
    await alertTeam(req.user.client, p.id, `${req.user.name || 'The client'} confirmed the handover of “${p.title}”${note ? `: ${note.slice(0, 120)}` : '.'}`, `/projects/${p.id}`);
    const [after] = await pool.query('SELECT * FROM projects WHERE id = ?', [p.id]);
    res.json({ handover_confirmed_at: after[0].handover_confirmed_at, handover_confirmed_by: after[0].handover_confirmed_by });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ---------- Access by private link (no password) ----------

async function portalUserFor(clientId) {
  const [rows] = await pool.query("SELECT * FROM users WHERE role = 'client' AND client = ? ORDER BY created LIMIT 1", [clientId]);
  return rows[0] || null;
}

// GET /api/portal/access?client=ID — is a portal link active for this client?
router.get('/access', requireAuth, async (req, res) => {
  if (!GRANT.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const u = await portalUserFor(String(req.query.client || ''));
  res.json(u ? { exists: true, active: u.status === 'active' && Boolean(u.portal_token_hash), link_at: u.portal_link_at, last_used: u.portal_last_used, last_name: u.name } : { exists: false, active: false });
});

// POST /api/portal/access {client} — create (or replace) the client's private link.
// Returns the link code ONCE; only its hash is kept. Replacing it stops the old link.
router.post('/access', requireAuth, async (req, res) => {
  if (!GRANT.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const clientId = String(req.body?.client || '');
  try {
    const [c] = await pool.query('SELECT id, company_name FROM clients WHERE id = ?', [clientId]);
    if (!c[0]) return res.status(404).json({ message: 'Client not found.' });
    const token = crypto.randomBytes(24).toString('base64url');
    let u = await portalUserFor(clientId);
    if (u) {
      await pool.query("UPDATE users SET portal_token_hash = ?, portal_link_at = UTC_TIMESTAMP(), status = 'active', tokens_valid_after = UTC_TIMESTAMP() WHERE id = ?", [hash(token), u.id]);
    } else {
      const id = genId();
      const pw = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      await pool.query(
        "INSERT INTO users (id, email, password_hash, name, role, status, client, profile_completed, can_upload_documents, portal_token_hash, portal_link_at) VALUES (?, ?, ?, ?, 'client', 'active', ?, 1, 0, ?, UTC_TIMESTAMP())",
        [id, `portal-${clientId}@clients.runhtec.local`, pw, c[0].company_name || 'Client', clientId, hash(token)]
      );
    }
    res.json({ token });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// POST /api/portal/access/disable {client} — the link stops working at once.
router.post('/access/disable', requireAuth, async (req, res) => {
  if (!GRANT.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  await pool.query("UPDATE users SET portal_token_hash = NULL, status = 'suspended', tokens_valid_after = UTC_TIMESTAMP() WHERE role = 'client' AND client = ?", [String(req.body?.client || '')]);
  res.json({ ok: true });
});

// POST /api/portal/enter {token, name} — public: opening the private link.
router.post('/enter', async (req, res) => {
  if (enterLimit.isBlocked(req.ip)) return res.status(429).json({ message: 'Too many attempts. Please wait a few minutes.' });
  enterLimit.hit(req.ip);
  const token = String(req.body?.token || '');
  const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!token || token.length < 20) return res.status(400).json({ message: 'This link is not valid.' });
  if (name.length < 2) return res.status(400).json({ message: 'Please enter your name.' });
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE role = 'client' AND status = 'active' AND portal_token_hash = ?", [hash(token)]);
    const u = rows[0];
    if (!u) return res.status(404).json({ message: 'This link has expired or was replaced. Please ask RUNHTec for a new one.' });
    enterLimit.reset(req.ip);
    await pool.query('UPDATE users SET name = ?, portal_last_used = UTC_TIMESTAMP() WHERE id = ?', [name, u.id]);
    const [after] = await pool.query('SELECT * FROM users WHERE id = ?', [u.id]);
    res.json({ token: signToken(after[0]), record: sanitizeUser(after[0]) });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
module.exports.TOPICS = TOPICS;
