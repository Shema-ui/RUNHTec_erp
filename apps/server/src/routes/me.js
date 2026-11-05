const express = require('express');
const pool = require('../db');
const { requireAuth, sanitizeUser, signToken, bcrypt, MIN_PASSWORD_LENGTH } = require('../auth');
const { createLimiter } = require('../rateLimit');
const pwLimit = createLimiter({ windowMs: 15 * 60 * 1000, max: 8 });
const { writeAuditEntry } = require('../audit');

const router = express.Router();

// What a staff profile must contain before the ERP opens up for that person.
const REQUIRED = [
  ['full_name', 'Full name'],
  ['phone', 'Phone number'],
  ['national_id_number', 'National ID / passport number'],
  ['emergency_contact_name', 'Emergency contact name'],
  ['emergency_contact_phone', 'Emergency contact phone'],
  ['photo', 'Profile photo'],
  ['id_document', 'Copy of ID / passport'],
];

// POST /api/me/complete-profile — checks the profile is complete, then unlocks the account.
router.post('/complete-profile', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM staff_profiles WHERE user = ?', [req.user.id]);
    const profile = rows[0];
    const missing = REQUIRED.filter(([k]) => !profile || !String(profile[k] || '').trim()).map(([, label]) => label);
    if (missing.length) return res.status(400).json({ message: `Still missing: ${missing.join(', ')}.`, missing });
    await pool.query('UPDATE users SET profile_completed = 1 WHERE id = ?', [req.user.id]);
    const [urows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    await writeAuditEntry({ actor: req.user, action: 'Completed profile', collectionName: 'users', record: urows[0] }).catch(() => {});
    res.json({ record: sanitizeUser(urows[0]) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/me/backup — Super Admin downloads every record as one JSON file
// (uploaded files themselves are not included, only their references).
router.get('/backup', requireAuth, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ message: 'Only the Super Administrator can download a backup.' });
  try {
    const { collections } = require('../collections');
    const out = { app: 'RUNHTec ERP', created: new Date().toISOString(), tables: {} };
    for (const [name, def] of Object.entries(collections)) {
      const [rows] = await pool.query(`SELECT * FROM \`${def.table}\``);
      out.tables[name] = rows.map(({ password_hash, reset_token_hash, reset_token_expires, portal_token_hash, ...r }) => r);
    }
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="runhtec-erp-backup-${stamp}.json"`);
    res.send(JSON.stringify(out, null, 1));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/me/password {current, password} — change your own password.
// Every other session (other phones/computers, and any old password) stops working.
router.post('/password', requireAuth, async (req, res) => {
  if (['client', 'vendor'].includes(req.user.role)) return res.status(403).json({ message: 'Not available here.' });
  if (pwLimit.isBlocked(req.user.id)) return res.status(429).json({ message: 'Too many attempts. Please wait 15 minutes.' });
  const current = String(req.body?.current || '');
  const pw = String(req.body?.password || '');
  if (pw.length < MIN_PASSWORD_LENGTH || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return res.status(400).json({ message: `Use at least ${MIN_PASSWORD_LENGTH} characters with letters and numbers.` });
  }
  if (pw === current) return res.status(400).json({ message: 'Choose a password different from your current one.' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!rows[0] || !(await bcrypt.compare(current, rows[0].password_hash || ''))) {
      pwLimit.hit(req.user.id);
      return res.status(401).json({ message: 'Your current password is wrong.' });
    }
    pwLimit.reset(req.user.id);
    await pool.query('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL, tokens_valid_after = UTC_TIMESTAMP() WHERE id = ?',
      [await bcrypt.hash(pw, 10), req.user.id]);
    await writeAuditEntry({ actor: req.user, action: 'Changed password', collectionName: 'users', record: { id: req.user.id, name: req.user.name || req.user.email } }).catch(() => {});
    const [after] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ token: signToken(after[0]), record: sanitizeUser(after[0]) });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
module.exports.REQUIRED = REQUIRED;
