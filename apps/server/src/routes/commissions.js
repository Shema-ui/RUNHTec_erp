// Commissions. Staff see only their own amount and status. Finance sees profit and can mark payouts paid.
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../auth');
const { notifyUsers } = require('../notify');
const { COMMISSION_PERCENT } = require('../commissions');

const router = express.Router();
const FINANCE = ['super_admin', 'admin', 'accountant'];

// Staff: only their own commissions, without profit or cost figures.
router.get('/me', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.id, c.amount, c.status, c.owed_at, c.paid_at, p.title AS project_title, p.status AS project_status
     FROM commissions c LEFT JOIN projects p ON p.id = c.project
     WHERE c.staff_user = ? ORDER BY c.created DESC`,
    [req.user.id]
  );
  res.json({ percent: COMMISSION_PERCENT, commissions: rows });
});

// Finance: every commission with profit, for paying out.
router.get('/admin', requireAuth, async (req, res) => {
  if (!FINANCE.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const [rows] = await pool.query(
    `SELECT c.id, c.amount, c.status, c.profit, c.paid_total, c.cost_total, c.owed_at, c.paid_at, c.paid_by_name,
            p.title AS project_title, u.name AS staff_name, u.email AS staff_email
     FROM commissions c LEFT JOIN projects p ON p.id = c.project LEFT JOIN users u ON u.id = c.staff_user
     ORDER BY c.created DESC LIMIT 300`
  );
  res.json({ percent: COMMISSION_PERCENT, commissions: rows });
});

router.post('/:id/paid', requireAuth, async (req, res) => {
  if (!FINANCE.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const [rows] = await pool.query('SELECT * FROM commissions WHERE id = ?', [req.params.id]);
  const c = rows[0];
  if (!c) return res.status(404).json({ message: 'Commission not found.' });
  if (c.status !== 'owed') return res.status(400).json({ message: 'Only owed commissions can be marked paid.' });
  const by = req.user.name || req.user.email || 'Finance';
  await pool.query("UPDATE commissions SET status = 'paid', paid_at = NOW(), paid_by_name = ? WHERE id = ?", [by, c.id]);
  await notifyUsers([c.staff_user], 'commission', `Your commission of ${Number(c.amount).toLocaleString('en-US')} RWF has been paid in cash.`, '/referrals');
  res.json({ ok: true });
});

module.exports = router;
