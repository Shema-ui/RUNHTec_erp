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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024, files: 5 } });
const AUDIO = /^audio\/(webm|ogg|mp4|mpeg|aac|x-m4a|m4a|wav|x-wav)(;.*)?$/i;

const loginIpLimit = createLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const loginPhoneLimit = createLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const signupLimit = createLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
const requestLimit = createLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

const STAFF_GRANT = ['super_admin', 'admin', 'sales', 'project_manager'];
// Change this when the Terms of Use & Privacy Notice change (web: src/pages/TermsPage.jsx).
const TERMS_VERSION = '2026-11-10';
const accepted = (b) => b?.accept_terms === true || b?.accept_terms === 'true';
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
  if (!accepted(b)) return res.status(400).json({ message: 'Please accept the Terms of Use and Privacy Notice to create your account.' });
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
      "INSERT INTO users (id, email, password_hash, name, phone, role, status, client, profile_completed, can_upload_documents, pin_hash, signup_source, terms_accepted_at, terms_version) VALUES (?, ?, ?, ?, ?, 'client', 'active', ?, 1, 0, ?, 'app', UTC_TIMESTAMP(), ?)",
      [userId, `app-${userId}@clients.runhtec.local`, pw, name, phone, clientId, pinHash, TERMS_VERSION]
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
  const [rows] = await pool.query('SELECT phone, pin_hash, terms_accepted_at FROM users WHERE id = ?', [req.user.id]);
  res.json({ phone: rows[0]?.phone || '', has_pin: Boolean(rows[0]?.pin_hash), terms_accepted: Boolean(rows[0]?.terms_accepted_at) });
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
    if (!me.terms_accepted_at && !accepted(req.body)) return res.status(400).json({ message: 'Please accept the Terms of Use and Privacy Notice first.' });
    const pinHash = await bcrypt.hash(pin, 10);
    if (!me.phone || me.phone === phone) {
      if (await phoneTaken(phone, me.id)) return res.status(409).json({ message: 'This phone number is already used by another account.' });
      await pool.query('UPDATE users SET phone = ?, pin_hash = ?, terms_accepted_at = COALESCE(terms_accepted_at, UTC_TIMESTAMP()), terms_version = IF(terms_version = \'\' OR terms_version IS NULL, ?, terms_version) WHERE id = ?', [phone, pinHash, TERMS_VERSION, me.id]);
      return res.json({ ok: true });
    }
    // A different person on the same client account.
    const [existing] = await pool.query("SELECT id, client FROM users WHERE role = 'client' AND phone = ?", [phone]);
    if (existing[0] && existing[0].client !== me.client) return res.status(409).json({ message: 'This phone number is already used by another account.' });
    let id = existing[0]?.id;
    if (id) {
      await pool.query("UPDATE users SET pin_hash = ?, status = 'active', terms_accepted_at = COALESCE(terms_accepted_at, UTC_TIMESTAMP()), terms_version = ? WHERE id = ?", [pinHash, TERMS_VERSION, id]);
    } else {
      id = genId();
      const pw = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      await pool.query(
        "INSERT INTO users (id, email, password_hash, name, phone, role, status, client, profile_completed, can_upload_documents, pin_hash, signup_source, terms_accepted_at, terms_version) VALUES (?, ?, ?, ?, ?, 'client', 'active', ?, 1, 0, ?, 'link', UTC_TIMESTAMP(), ?)",
        [id, `app-${id}@clients.runhtec.local`, pw, me.name, phone, me.client, pinHash, TERMS_VERSION]
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
const REQUEST_FIELDS = 'id, service_type, kind, urgency, address, description, attachments, request_type, request_status, status, preferred_time, scheduled_for, technician_name, client_note, project, on_the_way_at, reschedule_request, reschedule_requested_at, latitude, longitude, voice_note, site, created, updated';

// A map position sent by a phone: both numbers, inside the valid range, else none.
function coords(lat, lng) {
  const a = Number(lat); const b = Number(lng);
  if (lat === '' || lng === '' || lat == null || lng == null) return [null, null];
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return [null, null];
  return [Number(a.toFixed(7)), Number(b.toFixed(7))];
}
async function ownSite(siteId, clientId) {
  if (!siteId) return null;
  const [rows] = await pool.query('SELECT id, name, address, latitude, longitude FROM client_sites WHERE id = ? AND client = ?', [String(siteId), clientId]);
  return rows[0] || null;
}

// POST /api/client/requests (multipart: kind, description, urgency, address, preferred_time, project,
// site, latitude, longitude, photos[], voice)
router.post('/requests', requireAuth, clientOnly, upload.fields([{ name: 'photos', maxCount: 4 }, { name: 'voice', maxCount: 1 }]), async (req, res) => {
  const b = req.body || {};
  const kind = KINDS[b.kind] ? b.kind : 'callout';
  const description = String(b.description || '').trim().slice(0, 4000);
  const voiceFile = (req.files?.voice || [])[0];
  const hasVoice = Boolean(voiceFile && AUDIO.test(voiceFile.mimetype || ''));
  if (description.length < 5 && !hasVoice) return res.status(400).json({ message: 'Please describe what you need, or record a voice note.' });
  if (requestLimit.isBlocked(req.user.id)) return res.status(429).json({ message: 'You have sent many requests in a short time. Please wait a little or call us.' });
  requestLimit.hit(req.user.id);
  try {
    const photos = [];
    for (const f of req.files?.photos || []) {
      if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.mimetype)) continue;
      photos.push(await storeFile(f));
    }
    const voice = hasVoice ? await storeFile({ ...voiceFile, originalname: voiceFile.originalname || 'voice-note' }) : null;
    const site = await ownSite(b.site, req.user.client);
    let [lat, lng] = coords(b.latitude, b.longitude);
    if (lat === null && site?.latitude != null) { lat = site.latitude; lng = site.longitude; }
    const address = String(b.address || '').trim().slice(0, 500) || (site ? [site.name, site.address].filter(Boolean).join(' · ') : '');
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
      `INSERT INTO rfqs (id, name, company, email, phone, service_type, kind, urgency, address, description, attachments, status, source, client, request_type, request_status, preferred_time, project, latitude, longitude, voice_note, site)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'app', ?, ?, 'new', ?, ?, ?, ?, ?, ?)`,
      [id, req.user.name || '', cl[0]?.company_name || '', String(me[0]?.email || '').endsWith('.runhtec.local') ? '' : (me[0]?.email || ''),
        me[0]?.phone ? `+${me[0].phone}` : '', KINDS[kind].label, kind, urgency, address, description || '(voice note)',
        JSON.stringify(photos), req.user.client, KINDS[kind].type, String(b.preferred_time || '').trim().slice(0, 120), project,
        lat, lng, voice, site?.id || null]
    );
    const who = cl[0]?.company_name || req.user.name || 'A client';
    const flag = urgency === 'emergency' ? '🚨 EMERGENCY ' : urgency === 'urgent' ? 'URGENT ' : '';
    await notifyRoles(TEAM, 'request', `${flag}${KINDS[kind].label} requested by ${who}: ${description ? description.slice(0, 120) : 'voice note'}${voice && description ? ' (+ voice note)' : ''}`, '/rfqs');
    const [rows] = await pool.query(`SELECT ${REQUEST_FIELDS} FROM rfqs WHERE id = ?`, [id]);
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// POST /api/client/requests/:id/reschedule {when, reason} — the client asks for another day.
router.post('/requests/:id/reschedule', requireAuth, clientOnly, async (req, res) => {
  const when = String(req.body?.when || '').trim().slice(0, 150);
  const reason = String(req.body?.reason || '').trim().slice(0, 300);
  if (when.length < 2) return res.status(400).json({ message: 'Tell us which day or time suits you better.' });
  try {
    const [rows] = await pool.query("SELECT id, service_type, request_status FROM rfqs WHERE id = ? AND client = ?", [req.params.id, req.user.client]);
    const r = rows[0];
    if (!r) return res.status(404).json({ message: 'Request not found.' });
    if (!['new', 'reviewing', 'scheduled'].includes(r.request_status || 'new')) return res.status(400).json({ message: 'This visit can no longer be moved in the app. Please call us.' });
    const text = reason ? `${when} — ${reason}` : when;
    await pool.query('UPDATE rfqs SET reschedule_request = ?, reschedule_requested_at = UTC_TIMESTAMP() WHERE id = ?', [text.slice(0, 500), r.id]);
    const [cl] = await pool.query('SELECT company_name FROM clients WHERE id = ?', [req.user.client]);
    await notifyRoles(TEAM, 'request', `${cl[0]?.company_name || req.user.name} asks to reschedule “${r.service_type}”: ${text.slice(0, 150)}`, '/rfqs');
    const [out] = await pool.query(`SELECT ${REQUEST_FIELDS} FROM rfqs WHERE id = ?`, [r.id]);
    res.json(out[0]);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// POST /api/client/requests/:id/on-the-way — staff: the technician has left for the site.
// The client gets a phone alert. Send {undo:true} to clear it.
router.post('/requests/:id/on-the-way', requireAuth, async (req, res) => {
  if (![...STAFF_GRANT, 'lead_technician'].includes(req.user?.role)) return res.status(403).json({ message: 'Not allowed.' });
  try {
    const [rows] = await pool.query('SELECT id, client, service_type, technician_name, request_status FROM rfqs WHERE id = ?', [req.params.id]);
    const r = rows[0];
    if (!r) return res.status(404).json({ message: 'Request not found.' });
    if (req.body?.undo) {
      await pool.query('UPDATE rfqs SET on_the_way_at = NULL WHERE id = ?', [r.id]);
    } else {
      const status = ['', 'new', 'reviewing'].includes(r.request_status || '') ? 'scheduled' : r.request_status;
      await pool.query('UPDATE rfqs SET on_the_way_at = UTC_TIMESTAMP(), request_status = ? WHERE id = ?', [status, r.id]);
      if (r.client) await notifyClient(r.client, 'request', `Your technician${r.technician_name ? `, ${r.technician_name},` : ''} is on the way for your ${r.service_type || 'request'}.`, '/portal/requests');
    }
    const [out] = await pool.query('SELECT * FROM rfqs WHERE id = ?', [r.id]);
    res.json(out[0]);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ── Quotations: the client accepts or declines in the app ────────────────────
// POST /api/client/quotes/:id/respond {decision: 'accept'|'decline', name, note}
router.post('/quotes/:id/respond', requireAuth, clientOnly, async (req, res) => {
  const decision = req.body?.decision === 'accept' ? 'accept' : req.body?.decision === 'decline' ? 'decline' : '';
  const name = String(req.body?.name || req.user.name || '').trim().slice(0, 150);
  const note = String(req.body?.note || '').trim().slice(0, 1000);
  if (!decision) return res.status(400).json({ message: 'Choose accept or decline.' });
  if (decision === 'accept' && name.length < 2) return res.status(400).json({ message: 'Type your full name to accept.' });
  try {
    const [rows] = await pool.query("SELECT id, number, client, status, valid_until, total, currency, source_invoice FROM quotations WHERE id = ? AND client = ?", [req.params.id, req.user.client]);
    const q = rows[0];
    if (!q || q.source_invoice) return res.status(404).json({ message: 'Quotation not found.' });
    if (q.status !== 'sent') return res.status(409).json({ message: q.status === 'accepted' ? 'This quotation is already accepted.' : 'This quotation can no longer be answered in the app. Please contact us.' });
    const today = new Date().toISOString().slice(0, 10);
    const until = String(q.valid_until || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(until) && until < today) return res.status(409).json({ message: 'This quotation has expired. Ask us for an updated one.' });
    if (decision === 'accept') {
      await pool.query("UPDATE quotations SET status = 'accepted', signed_at = UTC_TIMESTAMP(), signed_by_name = ?, client_response_note = ?, responded_at = UTC_TIMESTAMP() WHERE id = ?", [name, note, q.id]);
      await pool.query("UPDATE clients SET status = 'active' WHERE id = ? AND status = 'lead'", [q.client]);
    } else {
      await pool.query("UPDATE quotations SET status = 'declined', client_response_note = ?, responded_at = UTC_TIMESTAMP() WHERE id = ?", [note, q.id]);
    }
    const [cl] = await pool.query('SELECT company_name FROM clients WHERE id = ?', [q.client]);
    const who = cl[0]?.company_name || req.user.name;
    await notifyRoles(TEAM, 'quotation', decision === 'accept'
      ? `✅ ${who} ACCEPTED quotation ${q.number} in the app (signed by ${name}). Ready to start the project.${note ? ` Note: ${note.slice(0, 120)}` : ''}`
      : `${who} declined quotation ${q.number} in the app.${note ? ` Reason: ${note.slice(0, 150)}` : ''}`, `/quotations/${q.id}/view`);
    res.json({ ok: true, status: decision === 'accept' ? 'accepted' : 'declined' });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ── Sites: a client's places (home, office, branch…) ─────────────────────────
// POST /api/client/sites {name, address, latitude, longitude, contact_name, contact_phone}
router.post('/sites', requireAuth, clientOnly, async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 150);
  if (name.length < 2) return res.status(400).json({ message: 'Give the site a name, e.g. Home or Main office.' });
  try {
    const [cnt] = await pool.query('SELECT COUNT(*) AS n FROM client_sites WHERE client = ?', [req.user.client]);
    if (Number(cnt[0].n) >= 30) return res.status(400).json({ message: 'You have many sites already. Please ask us to add more.' });
    const [lat, lng] = coords(b.latitude, b.longitude);
    const id = genId();
    await pool.query('INSERT INTO client_sites (id, client, name, address, latitude, longitude, contact_name, contact_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.client, name, String(b.address || '').trim().slice(0, 500), lat, lng, String(b.contact_name || '').trim().slice(0, 150), String(b.contact_phone || '').trim().slice(0, 40)]);
    const [rows] = await pool.query('SELECT * FROM client_sites WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// DELETE /api/client/sites/:id — a site the client added (requests keep their address).
router.delete('/sites/:id', requireAuth, clientOnly, async (req, res) => {
  await pool.query('DELETE FROM client_sites WHERE id = ? AND client = ?', [req.params.id, req.user.client]);
  res.json({ ok: true });
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
    const [sites] = await pool.query('SELECT id, name, address, latitude, longitude, contact_name, contact_phone FROM client_sites WHERE client = ? ORDER BY name', [c]);
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
      sites,
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
module.exports.coords = coords;
module.exports.TERMS_VERSION = TERMS_VERSION;
