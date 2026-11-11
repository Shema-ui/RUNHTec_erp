// Quick "+ New client" from the quotation and invoice forms.
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../auth');
const { findOrCreateClient } = require('../clientAuto');

const router = express.Router();
const ALLOWED = ['super_admin', 'admin', 'sales', 'accountant', 'project_manager'];

// POST /api/crm/quick-client {company, name, email, phone, address}
// Returns the client (an existing one when the name/email/phone already matches).
router.post('/quick-client', requireAuth, async (req, res) => {
  if (!ALLOWED.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const b = req.body || {};
  if (String(b.company || b.name || '').trim().length < 2) return res.status(400).json({ message: 'Type the client’s company or full name.' });
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email).trim())) return res.status(400).json({ message: 'That email address doesn’t look right.' });
  try {
    const r = await findOrCreateClient({ company: b.company, name: b.name, email: b.email, phone: b.phone, address: b.address });
    const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [r.id]);
    res.json({ ...rows[0], existed: !r.created });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
