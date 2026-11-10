// Turning phone/desktop notifications on and off for the signed-in person.
const express = require('express');
const { requireAuth } = require('../auth');
const { getKeys, saveSubscription, removeSubscription, pushToUsers } = require('../webpush');
const { createLimiter } = require('../rateLimit');

const router = express.Router();
const limiter = createLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
// Express middleware: at most 30 of these calls per person (or connection) per 15 minutes.
function limit(req, res, next) {
  const key = req.user?.id || req.ip;
  if (limiter.isBlocked(key)) return res.status(429).json({ message: 'Too many tries. Please wait a few minutes.' });
  limiter.hit(key);
  next();
}

// GET /api/push/key — the server's public key, needed by the browser to subscribe.
router.get('/key', async (req, res) => {
  try { res.json({ publicKey: (await getKeys()).publicKey }); } catch (err) { res.status(500).json({ message: 'Notifications are not available right now.' }); }
});

// POST /api/push/subscribe { subscription } — this device wants notifications.
router.post('/subscribe', requireAuth, limit, async (req, res) => {
  if (req.user.role === 'vendor') return res.status(403).json({ message: 'Not available here.' });
  try {
    await saveSubscription(req.user.id, req.body?.subscription, req.get('user-agent'));
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// POST /api/push/unsubscribe { endpoint } — this device no longer wants them (or the person signs out).
router.post('/unsubscribe', requireAuth, async (req, res) => {
  try { await removeSubscription(req.user.id, req.body?.endpoint); res.json({ ok: true }); } catch (err) { res.status(400).json({ message: err.message }); }
});

// POST /api/push/test — sends a test notification to the person's own devices.
router.post('/test', requireAuth, limit, async (req, res) => {
  await pushToUsers([req.user.id], { title: 'RUNHTec', body: 'Notifications are working on this device.', link: '/dashboard' });
  res.json({ ok: true });
});

module.exports = router;
