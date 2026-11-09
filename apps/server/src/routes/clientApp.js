// The RUNHTec client app: sign-in with phone + PIN, open sign-up, service
// requests, announcements, equipment & schedule, and job ratings.
//
// Clients never use the staff API to write; everything they can do is here
// (and in routes/portal.js for messages and handover).
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const pool = require('../db');
const { genId } = require('../idGen');
const { requireAuth, signToken, sanitizeUser, bcrypt } = require('../auth');
const { notifyRoles, notifyUsers, notifyClient } = require('../notify');
const { storeFile } = require('../files');
const { createLimiter } = require('../rateLimit');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024, files: 4 } });

const loginIpLimit = createLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const loginPhoneLimit = createLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const signupLimit = createLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
const requestLimit = createLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

const STAFF_GRANT = ['super_admin', 'admin', 'sales', 'project_manager'];
const TEAM = ['super_admin', 'admin', 'sales', 'project_manager'];

// ── Phone numbers ────────────────────────────────────────────────────────────
// Stored as digits with the country code: 0788 123 456 → 250788123456.
function normalizePhone(raw) {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (/^0\d{9}$/.test(d)) d = `250${d.slice(1)}`; // Rwandan local format
  else if (/^7\d{8}$/.test(d)) d = `250${d}`;
  d = d.replace(/\D/g, '');
  return d.length >= 9 && d.length <= 15 ? d : '';
}
const validPin = (p) => /^\d{4,6}$/.test(String(p || ''));
const WEAK = new Set(['0000', '1111', '1234', '12345', '123456', '000000', '111111', '4321', '2222', '9999']);

function clientOnly(req, res, next) {
  if (req.user?.role !== 'client' || !req.user.client) return res.status(403).json({ message: 'Client app only.' });
  next();
}
function staffOnly(req, res, next) {
  if (!STAFF_GRANT.includes(req.user?.role)) return res.status(403).json({ message: 'Not allowed.' });
  next();
}

async function phoneTaken(phone, exceptUserId = '') {
  const [rows] = await pool.query("SELECT id FROM users WHERE role = 'client' AND phone = ? AND id <> ?", [phone, exceptUserId]);
  return Boolean(rows[0]);
}

async function issue(userId) {
  await pool.query('UPDATE users SET portal_last_used = UTC_TIMESTAMP() WHERE id = ?', [userId]);
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  return { token: signToken(rows[0]), record: sanitizeUser(rows[0]) };
}

// ── Sign-up (anyone) ─────────────────────────────────────────────────────────
// POST /api/client/signup {name, company, phone, email, location, pin}
router.post('/signup', async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // hidden field only bots fill in
  if (signupLimit.isBlocked(req.ip)) return res.status(429).json({ message: 'Too many sign-ups from this connection. Please try again later or call us.' });
  const name = String(b.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const company = String(b.company || '').trim().slice(0, 200);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 190);
  const location = String(b.location || '').trim().slice(0, 200);
  const phone = normalizePhone(b.phone);
  if (name.length < 2) return res.status(400).json({ message: 'Please enter your full name.' });
  if (!phone) return res.status(400).json({ message: 'Please enter a valid phone number, e.g. 0788 123 456.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'That email address doesn’t look right.' });
  if (!validPin(b.pin)) return res.status(400).json({ message: 'Choose a PIN of 4 to 6 digits.' });
  if (WEAK.has(String(b.pin))) return res.status(400).json({ message: 'That PIN is too easy to guess. Please choose another.' });
  signupLimit.hit(req.ip);
  try {
    if (await phoneTaken(phone)) return res.status(409).json({ message: 'This phone number already has an account. Sign in instead, or ask RUNHTec to reset your PIN.' });
    const clientId = genId();
    const [cnt] = await pool.query('SELECT COUNT(*) AS n FROM clients');
    await pool.query(
      "INSERT INTO clients (id, client_id, company_name, status, city, country) VALUES (?, ?, ?, 'lead', ?, 'Rwanda')",
      [clientId, `CL-${String(Number(cnt[0].n) + 1).padStart(4, '0')}`, company || name, location]
    );
    await pool.query(
      'INSERT INTO client_contacts (id, client, full_name, mobile, whatsapp, email, is_primary) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [genId(), clientId, name, `+${phone}`, `+${phone}`, email]
    );
    const userId = genId();
    const pw = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    const pinHash = await bcrypt.hash(String(b.pin), 10);
    await pool.query(
      "INSERT INTO users (id, email, password_hash, name, phone, role, status, client, profile_completed, can_upload_documents, pin_hash, signup_source) VALUES (?, ?, ?, ?, ?, 'client', 'active', ?, 1, 0, ?, 'app')",
      [userId, `app-${userId}@clients.runhtec.local`, pw, name, phone, clientId, pinHash]
    );
    await notifyRoles(TEAM, 'client', `New client signed up in the app: ${name}${company ? ` (${company})` : ''}, +${phone}${location ? `, ${location}` : ''}.`, `/crm/clients/${clientId}`);
    res.json(await issue(userId));
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ── Sign-in ──────────────────────────────────────────────────────────────────
// POST /api/client/login {phone, pin}
router.post('/login', async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const pin = String(req.body?.pin || '');
  if (!phone || !validPin(pin)) return res.status(400).json({ message: 'Enter your phone number and PIN.' });
  if (loginIpLimit.isBlocked(req.ip) || loginPhoneLimit.isBlocked(phone)) {
    return res.status(429).json({ message: `Too many wrong tries. Please wait ${Math.ceil(Math.max(loginIpLimit.retryAfterSeconds(req.ip), loginPhoneLimit.retryAfterSeconds(phone)) / 60)} minutes, or ask RUNHTec to reset your PIN.` });
  }
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE role = 'client' AND phone = ? AND pin_hash IS NOT NULL", [phone]);
    const u = rows[0];
    const ok = u && await bcrypt.compare(pin, u.pin_hash);
    if (!ok) {
      loginIpLimit.hit(req.ip); loginPhoneLimit.hit(phone);
      return res.status(400).json({ message: 'Wrong phone number or PIN.' });
    }
    if (u.status !== 'active') return res.status(403).json({ message: 'This account is turned off. Please contact RUNHTec.' });
    loginPhoneLimit.reset(phone);
    res.json(await issue(u.id));
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// GET /api/client/me — app sign-in status for the person signed in.
router.get('/me', requireAuth, clientOnly, async (req, res) => {
  const [rows] = await pool.query('SELECT phone, pin_hash FROM users WHERE id = ?', [req.user.id]);
  res.json({ phone: rows[0]?.phone || '', has_pin: Boolean(rows[0]?.pin_hash) });
});

// POST /api/client/pin {phone, pin} — set up or change app sign-in.
// Opened from the private link: if the link login already belongs to another
// phone, this person gets their own login for the same client.
router.post('/pin', requireAuth, clientOnly, async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const pin = String(req.body?.pin || '');
  if (!phone) return res.status(400).json({ message: 'Please enter a valid phone number, e.g. 0788 123 456.' });
  if (!validPin(pin)) return res.status(400).json({ message: 'Choose a PIN of 4 to 6 digits.' });
  if (WEAK.has(pin)) return res.status(400).json({ message: 'That PIN is too easy to guess. Please choose another.' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const me = rows[0];
    const pinHash = await bcrypt.hash(pin, 10);
    if (!me.phone || me.phone === phone) {
      if (await phoneTaken(phone, me.id)) return res.status(409).json({ message: 'This phone number is already used by another account.' });
      await pool.query('UPDATE users SET phone = ?, pin_hash = ? WHERE id = ?', [phone, pinHash, me.id]);
      return res.json({ ok: true });
    }
    // A different person on the same client account.
    const [existing] = await pool.query("SELECT id, client FROM users WHERE role = 'client' AND phone = ?", [phone]);
    if (existing[0] && existing[0].client !== me.client) return res.status(409).json({ message: 'This phone number is already used by another account.' });
    let id = existing[0]?.id;
    if (id) {
      await pool.query("UPDATE users SET pin_hash = ?, status = 'active' WHERE id = ?", [pinHash, id]);
    } else {
      id = genId();
      const pw = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      await pool.query(
        "INSERT INTO users (id, email, password_hash, name, phone, role, status, client, profile_completed, can_upload_documents, pin_hash, signup_source) VALUES (?, ?, ?, ?, ?, 'client', 'active', ?, 1, 0, ?, 'link')",
        [id, `app-${id}@clients.runhtec.local`, pw, me.name, phone, me.client, pinHash]
      );
    }
    res.json({ ok: true, ...(await issue(id)) });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ── Service requests ─────────────────────────────────────────────────────────
const KINDS = {
  maintenance: { label: 'Maintenance visit', type: 'service_request' },
  callout: { label: 'Technician call-out', type: 'service_request' },
  warranty: { label: 'Warranty / fault', type: 'service_request' },
  quote: { label: 'New quotation', type: 'quote_request' },
};
const URGENCY = ['normal', 'urgent', 'emergency'];
const REQUEST_FIELDS = 'id, service_type, kind, urgency, address, description, attachments, request_type, request_status, status, preferred_time, scheduled_for, technician_name, client_note, project, created, updated';

// POST /api/client/requests (multipart: kind, description, urgency, address, preferred_time, project, photos[])
router.post('/requests', requireAuth, clientOnly, upload.array('photos', 4), async (req, res) => {
  const b = req.body || {};
  const kind = KINDS[b.kind] ? b.kind : 'callout';
  const description = String(b.description || '').trim().slice(0, 4000);
  if (description.length < 5) return res.status(400).json({ message: 'Please describe what you need.' });
  if (requestLimit.isBlocked(req.user.id)) return res.status(429).json({ message: 'You have sent many requests in a short time. Please wait a little or call us.' });
  requestLimit.hit(req.user.id);
  try {
    const photos = [];
    for (const f of req.files || []) {
      if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.mimetype)) continue;
      photos.push(await storeFile(f));
    }
    let project = String(b.project || '') || null;
    if (project) {
      const [p] = await pool.query('SELECT id FROM projects WHERE id = ? AND client = ?', [project, req.user.client]);
      if (!p[0]) project = null;
    }
    const [cl] = await pool.query('SELECT company_name FROM clients WHERE id = ?', [req.user.client]);
    const [me] = await pool.query('SELECT phone, email FROM users WHERE id = ?', [req.user.id]);
    const urgency = URGENCY.includes(b.urgency) ? b.urgency : 'normal';
    const id = genId();
    await pool.query(
      `INSERT INTO rfqs (id, name, company, email, phone, service_type, kind, urgency, address, description, attachments, status, source, client, request_type, request_status, preferred_time, project)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'app', ?, ?, 'new', ?, ?)`,
      [id, req.user.name || '', cl[0]?.company_name || '', String(me[0]?.email || '').endsWith('.runhtec.local') ? '' : (me[0]?.email || ''),
        me[0]?.phone ? `+${me[0].phone}` : '', KINDS[kind].label, kind, urgency, String(b.address || '').trim().slice(0, 500), description,
        JSON.stringify(photos), req.user.client, KINDS[kind].type, String(b.preferred_time || '').trim().slice(0, 120), project]
    );
    const who = cl[0]?.company_name || req.user.name || 'A client';
    const flag = urgency === 'emergency' ? '🚨 EMERGENCY ' : urgency === 'urgent' ? 'URGENT ' : '';
    await notifyRoles(TEAM, 'request', `${flag}${KINDS[kind].label} requested by ${who}: ${description.slice(0, 120)}`, '/rfqs');
    const [rows] = await pool.query(`SELECT ${REQUEST_FIELDS} FROM rfqs WHERE id = ?`, [id]);
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ── Everything the app shows (one call) ──────────────────────────────────────
// GET /api/client/overview
// Staff can preview it for a client with ?client=ID.
router.get('/overview', requireAuth, async (req, res) => {
  const c = req.user.role === 'client' ? req.user.client : (STAFF_GRANT.includes(req.user.role) ? String(req.query.client || '') : '');
  if (!c) return res.status(403).json({ message: 'Client app only.' });
  try {
    const [requests] = await pool.query(`SELECT ${REQUEST_FIELDS} FROM rfqs WHERE client = ? AND request_type IN ('service_request','quote_request') ORDER BY created DESC LIMIT 50`, [c]);
    const [equipment] = await pool.query(
      'SELECT id, name, category, brand, model_number, capacity, asset_location, status, installation_date, warranty_expiry, service_interval, next_service_date FROM equipment WHERE client = ? AND status <> \'decommissioned\' ORDER BY name', [c]);
    const [contracts] = await pool.query(
      'SELECT id, service_type, frequency, next_due_date, site, start_date, end_date FROM maintenance_contracts WHERE client = ? AND active = 1 ORDER BY next_due_date', [c]);
    const [cl] = await pool.query('SELECT services, status FROM clients WHERE id = ?', [c]);
    const hasContract = contracts.length > 0;
    const services = parseList(cl[0]?.services);
    const [news] = await pool.query('SELECT id, title, body, link, audience, created FROM announcements ORDER BY created DESC LIMIT 30');
    const [ratings] = await pool.query('SELECT target_type, target_id, rating FROM ratings WHERE client = ?', [c]);
    const [done] = await pool.query("SELECT id, title, completed_date, updated FROM projects WHERE client = ? AND status = 'done' ORDER BY updated DESC LIMIT 10", [c]);
    const rated = new Set(ratings.map((r) => `${r.target_type}:${r.target_id}`));
    const toRate = [
      ...done.filter((p) => !rated.has(`project:${p.id}`)).map((p) => ({ type: 'project', id: p.id, title: p.title })),
      ...requests.filter((r) => r.request_status === 'completed' && !rated.has(`request:${r.id}`)).map((r) => ({ type: 'request', id: r.id, title: r.service_type })),
    ].slice(0, 3);
    res.json({
      requests: requests.map((r) => ({ ...r, attachments: parseList(r.attachments) })),
      equipment,
      contracts,
      news: news.filter((n) => audienceMatch(n.audience, services, hasContract)),
      toRate,
      ratings,
    });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

function parseList(v) {
  if (Array.isArray(v)) return v;
  try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch { return []; }
}
function audienceMatch(audience, services, hasContract) {
  const a = String(audience || 'all');
  if (a === 'all') return true;
  if (a === 'contract') return hasContract;
  if (a.startsWith('service:')) return services.includes(a.slice(8));
  return false;
}

// ── Ratings ──────────────────────────────────────────────────────────────────
// POST /api/client/ratings {type: 'project'|'request', id, rating 1-5, comment}
router.post('/ratings', requireAuth, clientOnly, async (req, res) => {
  const type = req.body?.type === 'request' ? 'request' : 'project';
  const id = String(req.body?.id || '');
  const rating = Math.round(Number(req.body?.rating));
  const comment = String(req.body?.comment || '').trim().slice(0, 1000);
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ message: 'Choose 1 to 5 stars.' });
  try {
    const [rows] = type === 'project'
      ? await pool.query("SELECT id, title FROM projects WHERE id = ? AND client = ? AND status = 'done'", [id, req.user.client])
      : await pool.query("SELECT id, service_type AS title FROM rfqs WHERE id = ? AND client = ? AND request_status = 'completed'", [id, req.user.client]);
    if (!rows[0]) return res.status(404).json({ message: 'Nothing to rate here yet.' });
    const [exists] = await pool.query('SELECT id FROM ratings WHERE target_type = ? AND target_id = ?', [type, id]);
    if (exists[0]) return res.status(409).json({ message: 'Thanks, this was already rated.' });
    await pool.query(
      'INSERT INTO ratings (id, client, user, user_name, target_type, target_id, target_title, rating, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [genId(), req.user.client, req.user.id, req.user.name || '', type, id, rows[0].title || '', rating, comment]
    );
    const [cl] = await pool.query('SELECT company_name FROM clients WHERE id = ?', [req.user.client]);
    await notifyRoles(TEAM, 'rating', `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} from ${cl[0]?.company_name || req.user.name} for “${rows[0].title}”${comment ? `: ${comment.slice(0, 120)}` : ''}`,
      type === 'project' ? `/projects/${id}` : '/rfqs');
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ── Staff: announcements ─────────────────────────────────────────────────────
// Who an audience reaches (client user ids).
async function audienceUsers(audience) {
  const [users] = await pool.query("SELECT u.id, u.client, c.services FROM users u JOIN clients c ON c.id = u.client WHERE u.role = 'client' AND u.status = 'active'");
  if (audience === 'all') return users.map((u) => u.id);
  if (audience === 'contract') {
    const [rows] = await pool.query('SELECT DISTINCT client FROM maintenance_contracts WHERE active = 1');
    const set = new Set(rows.map((r) => r.client));
    return users.filter((u) => set.has(u.client)).map((u) => u.id);
  }
  if (String(audience).startsWith('service:')) {
    const s = audience.slice(8);
    return users.filter((u) => parseList(u.services).includes(s)).map((u) => u.id);
  }
  return [];
}

// GET /api/client/announcements — staff list (with how many people each reached).
router.get('/announcements', requireAuth, staffOnly, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM announcements ORDER BY created DESC LIMIT 100');
  res.json(rows);
});

// GET /api/client/audience?audience=… — how many app users would receive it.
router.get('/audience', requireAuth, staffOnly, async (req, res) => {
  res.json({ count: (await audienceUsers(String(req.query.audience || 'all'))).length });
});

// POST /api/client/announcements {title, body, audience, link}
router.post('/announcements', requireAuth, staffOnly, async (req, res) => {
  const title = String(req.body?.title || '').trim().slice(0, 150);
  const body = String(req.body?.body || '').trim().slice(0, 3000);
  const audience = String(req.body?.audience || 'all').slice(0, 60);
  const link = String(req.body?.link || '').trim().slice(0, 300);
  if (title.length < 3 || body.length < 3) return res.status(400).json({ message: 'Add a title and a message.' });
  if (link && !/^https:\/\//.test(link)) return res.status(400).json({ message: 'The link must start with https://' });
  try {
    const ids = await audienceUsers(audience);
    const id = genId();
    await pool.query('INSERT INTO announcements (id, title, body, audience, link, sent_count, created_by, created_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, body, audience, link, ids.length, req.user.id, req.user.name || '']);
    await notifyUsers(ids, 'news', `${title}: ${body.slice(0, 200)}`, '/portal/news');
    res.json({ id, sent_count: ids.length });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// DELETE /api/client/announcements/:id — removes it from the clients' news list.
router.delete('/announcements/:id', requireAuth, staffOnly, async (req, res) => {
  await pool.query('DELETE FROM announcements WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ── Staff: app logins, PIN reset, ratings ────────────────────────────────────
// GET /api/client/logins?client=ID
router.get('/logins', requireAuth, staffOnly, async (req, res) => {
  const [rows] = await pool.query("SELECT id, name, phone, status, signup_source, portal_last_used, pin_hash IS NOT NULL AS has_pin FROM users WHERE role = 'client' AND client = ? ORDER BY created", [String(req.query.client || '')]);
  res.json(rows.map((r) => ({ ...r, has_pin: Boolean(Number(r.has_pin)) })));
});

// POST /api/client/pin-reset {user} — the person sets a new PIN from their private link
// (or signs up again). Their current sign-ins end at once.
router.post('/pin-reset', requireAuth, staffOnly, async (req, res) => {
  await pool.query("UPDATE users SET pin_hash = NULL, tokens_valid_after = UTC_TIMESTAMP() WHERE id = ? AND role = 'client'", [String(req.body?.user || '')]);
  res.json({ ok: true });
});

// GET /api/client/ratings?client=ID (optional) — staff view of client ratings.
router.get('/ratings', requireAuth, async (req, res) => {
  if (!['super_admin', 'admin', 'sales', 'project_manager', 'accountant'].includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const client = String(req.query.client || '');
  const [rows] = client
    ? await pool.query('SELECT r.*, c.company_name FROM ratings r LEFT JOIN clients c ON c.id = r.client WHERE r.client = ? ORDER BY r.created DESC', [client])
    : await pool.query('SELECT r.*, c.company_name FROM ratings r LEFT JOIN clients c ON c.id = r.client ORDER BY r.created DESC LIMIT 200');
  res.json(rows);
});

module.exports = router;
module.exports.normalizePhone = normalizePhone;
module.exports.audienceMatch = audienceMatch;
module.exports.KINDS = KINDS;
