// Vendor (supplier) portal: a vendor opens a private link, types their name,
// and can add and update ONLY their own items and prices. They never see our
// selling prices, other vendors, clients or anything else in the ERP.
const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { genId } = require('../idGen');
const { requireAuth, signToken, sanitizeUser, bcrypt } = require('../auth');
const { notifyRoles } = require('../notify');
const { createLimiter } = require('../rateLimit');

const router = express.Router();
const writeLimit = createLimiter({ windowMs: 60 * 60 * 1000, max: 400 });
const enterLimit = createLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
// Staff who may create / replace / turn off a vendor's link (same as who may see buying prices).
const GRANT = ['super_admin', 'admin', 'sales', 'accountant', 'project_manager'];
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const AVAILABILITY = ['in_stock', 'on_order', 'out_of_stock'];
const ITEM_FIELDS = ['name', 'brand', 'code', 'category', 'unit', 'price', 'currency', 'availability', 'lead_time', 'notes'];
const DETAIL_FIELDS = ['contact_name', 'phone', 'email', 'address', 'supplies'];

function vendorOnly(req, res, next) {
  if (req.user?.role !== 'vendor' || !req.user.vendor) return res.status(403).json({ message: 'Vendor portal only.' });
  next();
}

// Clean what a vendor sends for one item. Returns [data, error].
function cleanItem(input, partial) {
  const out = {};
  for (const k of ITEM_FIELDS) {
    if (input?.[k] === undefined) continue;
    out[k] = typeof input[k] === 'string' ? input[k].trim() : input[k];
  }
  if (!partial || out.name !== undefined) {
    out.name = String(out.name || '').slice(0, 200);
    if (out.name.length < 2) return [null, 'Write the item name.'];
  }
  if (!partial || out.price !== undefined) {
    const price = Number(String(out.price ?? '').replace(/[ ,]/g, ''));
    if (!Number.isFinite(price) || price < 0 || price > 1e12) return [null, `Check the price of “${out.name || 'this item'}”.`];
    out.price = Math.round(price * 100) / 100;
  }
  if (out.availability !== undefined && !AVAILABILITY.includes(out.availability)) out.availability = 'in_stock';
  for (const [k, max] of [['brand', 120], ['code', 80], ['category', 60], ['unit', 30], ['currency', 10], ['lead_time', 60], ['notes', 1000]]) {
    if (out[k] !== undefined) out[k] = String(out[k] || '').slice(0, max);
  }
  if (out.currency !== undefined) out.currency = out.currency.toUpperCase() || 'RWF';
  return [out, null];
}

// Tell the team a vendor changed their price list (at most once an hour per vendor).
const lastAlert = new Map();
async function alertTeam(vendorId, text) {
  const t = lastAlert.get(vendorId) || 0;
  if (Date.now() - t < 60 * 60 * 1000) return;
  lastAlert.set(vendorId, Date.now());
  try { await notifyRoles(['super_admin', 'admin', 'sales', 'accountant'], 'vendor', text, `/vendors/${vendorId}`); } catch (_) { /* best effort */ }
}
async function vendorName(id) {
  const [v] = await pool.query('SELECT name FROM vendors WHERE id = ?', [id]);
  return v[0]?.name || 'A vendor';
}

// GET /api/vendor/me — the vendor's own details and items.
router.get('/me', requireAuth, vendorOnly, async (req, res) => {
  const [v] = await pool.query('SELECT id, name, contact_name, phone, email, address, supplies, currency FROM vendors WHERE id = ?', [req.user.vendor]);
  if (!v[0]) return res.status(404).json({ message: 'Your vendor account was removed. Please contact RUNHTec.' });
  const [items] = await pool.query('SELECT id, name, brand, code, category, unit, price, currency, availability, lead_time, notes, created, updated FROM vendor_items WHERE vendor = ? ORDER BY name', [req.user.vendor]);
  res.json({ vendor: v[0], items });
});

// PATCH /api/vendor/me — the vendor updates their contact details.
router.patch('/me', requireAuth, vendorOnly, async (req, res) => {
  const sets = []; const vals = [];
  for (const k of DETAIL_FIELDS) {
    if (req.body?.[k] === undefined) continue;
    sets.push(`${k} = ?`); vals.push(String(req.body[k] || '').trim().slice(0, k === 'address' || k === 'supplies' ? 500 : 200));
  }
  if (sets.length) await pool.query(`UPDATE vendors SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.user.vendor]);
  res.json({ ok: true });
});

// POST /api/vendor/items — add one item, or several with {items: [...]}.
router.post('/items', requireAuth, vendorOnly, async (req, res) => {
  const list = Array.isArray(req.body?.items) ? req.body.items.slice(0, 200) : [req.body];
  if (writeLimit.isBlocked(req.user.id)) return res.status(429).json({ message: 'Too many changes at once, please wait a little.' });
  const clean = [];
  for (const it of list) {
    const [data, err] = cleanItem(it, false);
    if (err) return res.status(400).json({ message: err });
    clean.push(data);
  }
  try {
    const ids = [];
    for (const d of clean) {
      writeLimit.hit(req.user.id);
      const id = genId(); ids.push(id);
      await pool.query(
        'INSERT INTO vendor_items (id, vendor, name, brand, code, category, unit, price, currency, availability, lead_time, notes, updated_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, req.user.vendor, d.name, d.brand || '', d.code || '', d.category || '', d.unit || 'pcs', d.price, d.currency || 'RWF', d.availability || 'in_stock', d.lead_time || '', d.notes || '', req.user.name || '']
      );
    }
    alertTeam(req.user.vendor, `${await vendorName(req.user.vendor)} added ${clean.length} item${clean.length === 1 ? '' : 's'} to their price list.`);
    const [rows] = await pool.query(`SELECT * FROM vendor_items WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    res.json({ items: rows });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// PATCH /api/vendor/items/:id — change one of their own items.
router.patch('/items/:id', requireAuth, vendorOnly, async (req, res) => {
  if (writeLimit.isBlocked(req.user.id)) return res.status(429).json({ message: 'Too many changes at once, please wait a little.' });
  writeLimit.hit(req.user.id);
  const [rows] = await pool.query('SELECT * FROM vendor_items WHERE id = ? AND vendor = ?', [req.params.id, req.user.vendor]);
  const before = rows[0];
  if (!before) return res.status(404).json({ message: 'Item not found.' });
  const [data, err] = cleanItem(req.body, true);
  if (err) return res.status(400).json({ message: err });
  if (data.price !== undefined && Number(data.price) !== Number(before.price)) {
    data.previous_price = before.price;
    data.price_changed_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
  data.updated_by_name = req.user.name || '';
  const keys = Object.keys(data);
  try {
    if (keys.length) await pool.query(`UPDATE vendor_items SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => data[k]), before.id]);
    if (data.previous_price !== undefined) alertTeam(req.user.vendor, `${await vendorName(req.user.vendor)} updated prices on their price list.`);
    const [after] = await pool.query('SELECT * FROM vendor_items WHERE id = ?', [before.id]);
    res.json(after[0]);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// DELETE /api/vendor/items/:id — remove one of their own items.
router.delete('/items/:id', requireAuth, vendorOnly, async (req, res) => {
  await pool.query('DELETE FROM vendor_items WHERE id = ? AND vendor = ?', [req.params.id, req.user.vendor]);
  res.json({ ok: true });
});

// ---------- Access by private link (no password) ----------

async function vendorUserFor(vendorId) {
  const [rows] = await pool.query("SELECT * FROM users WHERE role = 'vendor' AND vendor = ? ORDER BY created LIMIT 1", [vendorId]);
  return rows[0] || null;
}

// GET /api/vendor/access?vendor=ID
router.get('/access', requireAuth, async (req, res) => {
  if (!GRANT.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const u = await vendorUserFor(String(req.query.vendor || ''));
  res.json(u ? { exists: true, active: u.status === 'active' && Boolean(u.portal_token_hash), link_at: u.portal_link_at, last_used: u.portal_last_used, last_name: u.name } : { exists: false, active: false });
});

// POST /api/vendor/access {vendor} — create or replace the vendor's private link (shown once).
router.post('/access', requireAuth, async (req, res) => {
  if (!GRANT.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const vendorId = String(req.body?.vendor || '');
  try {
    const [v] = await pool.query('SELECT id, name FROM vendors WHERE id = ?', [vendorId]);
    if (!v[0]) return res.status(404).json({ message: 'Vendor not found.' });
    const token = crypto.randomBytes(24).toString('base64url');
    const u = await vendorUserFor(vendorId);
    if (u) {
      await pool.query("UPDATE users SET portal_token_hash = ?, portal_link_at = UTC_TIMESTAMP(), status = 'active', tokens_valid_after = UTC_TIMESTAMP() WHERE id = ?", [hash(token), u.id]);
    } else {
      const pw = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      await pool.query(
        "INSERT INTO users (id, email, password_hash, name, role, status, vendor, profile_completed, can_upload_documents, portal_token_hash, portal_link_at) VALUES (?, ?, ?, ?, 'vendor', 'active', ?, 1, 0, ?, UTC_TIMESTAMP())",
        [genId(), `vendor-${vendorId}@vendors.runhtec.local`, pw, v[0].name || 'Vendor', vendorId, hash(token)]
      );
    }
    res.json({ token });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// POST /api/vendor/access/disable {vendor} — the link stops working at once.
router.post('/access/disable', requireAuth, async (req, res) => {
  if (!GRANT.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  await pool.query("UPDATE users SET portal_token_hash = NULL, status = 'suspended', tokens_valid_after = UTC_TIMESTAMP() WHERE role = 'vendor' AND vendor = ?", [String(req.body?.vendor || '')]);
  res.json({ ok: true });
});

// POST /api/vendor/enter {token, name} — public: opening the private link.
router.post('/enter', async (req, res) => {
  if (enterLimit.isBlocked(req.ip)) return res.status(429).json({ message: 'Too many attempts. Please wait a few minutes.' });
  enterLimit.hit(req.ip);
  const token = String(req.body?.token || '');
  const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!token || token.length < 20) return res.status(400).json({ message: 'This link is not valid.' });
  if (name.length < 2) return res.status(400).json({ message: 'Please enter your name.' });
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE role = 'vendor' AND status = 'active' AND portal_token_hash = ?", [hash(token)]);
    const u = rows[0];
    if (!u) return res.status(404).json({ message: 'This link has expired or was replaced. Please ask RUNHTec for a new one.' });
    enterLimit.reset(req.ip);
    await pool.query('UPDATE users SET name = ?, portal_last_used = UTC_TIMESTAMP() WHERE id = ?', [name, u.id]);
    const [after] = await pool.query('SELECT * FROM users WHERE id = ?', [u.id]);
    res.json({ token: signToken(after[0]), record: sanitizeUser(after[0]) });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
