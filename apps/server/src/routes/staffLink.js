// Checking and managing the private staff sign-in link (see staffKey.js).
const express = require('express');
const { requireAuth } = require('../auth');
const { getStaffKey, rotateStaffKey, isStaffKey, staffLink } = require('../staffKey');
const { createLimiter } = require('../rateLimit');

const router = express.Router();
const checkLimit = createLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

// GET /api/staff-link/check?key=… — public: is this staff link valid? (rate limited)
router.get('/check', async (req, res) => {
  if (checkLimit.isBlocked(req.ip)) return res.status(429).json({ message: 'Too many attempts. Please wait 15 minutes.' });
  const ok = await isStaffKey(req.query.key);
  if (!ok) checkLimit.hit(req.ip);
  res.status(ok ? 200 : 404).json(ok ? { ok: true } : { message: 'This link is not valid.' });
});

const superOnly = (req, res, next) => (req.user?.role === 'super_admin' ? next() : res.status(403).json({ message: 'Only the Super Admin can see the staff link.' }));

// GET /api/staff-link — the current staff link (Super Admin).
router.get('/', requireAuth, superOnly, async (req, res) => {
  res.json({ link: staffLink(await getStaffKey()) });
});

// POST /api/staff-link/rotate — a new link; the old one stops working at once (Super Admin).
// People already signed in stay signed in.
router.post('/rotate', requireAuth, superOnly, async (req, res) => {
  res.json({ link: staffLink(await rotateStaffKey()) });
});

module.exports = router;
