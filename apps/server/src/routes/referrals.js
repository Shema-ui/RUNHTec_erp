// GET /api/referrals/me: the signed-in person's referral link, credit balance and history.
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../auth');
const { codeFor, balanceOf, INDIVIDUAL_CREDIT, COMPANY_PERCENT, COMPANY_CAP } = require('../referrals');

const router = express.Router();
const APP_URL = process.env.APP_URL || 'https://erp.runhteccontractors.si';

router.get('/me', requireAuth, async (req, res) => {
  try {
    const code = await codeFor(req.user.id);
    const [referrals] = await pool.query(
      'SELECT referred_name, kind, status, rewarded_credit, created FROM referrals WHERE owner_user = ? ORDER BY created DESC LIMIT 100',
      [req.user.id]
    );
    const [ledger] = await pool.query(
      'SELECT amount, kind, note, created FROM credit_ledger WHERE owner_user = ? ORDER BY created DESC LIMIT 50',
      [req.user.id]
    );
    res.json({
      code,
      link: `${APP_URL}/join?ref=${code}`,
      balance: await balanceOf(req.user.id),
      rules: { individual: INDIVIDUAL_CREDIT, companyPercent: COMPANY_PERCENT * 100, companyCap: COMPANY_CAP },
      referrals,
      ledger,
    });
  } catch (err) {
    console.error('referrals error:', err);
    res.status(500).json({ message: 'Could not load your referrals. Please try again.' });
  }
});

module.exports = router;
