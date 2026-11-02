const express = require('express');
const pool = require('../db');
const { requireAuth, sanitizeUser } = require('../auth');
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

module.exports = router;
module.exports.REQUIRED = REQUIRED;
