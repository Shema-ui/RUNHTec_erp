const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { signToken, sanitizeUser, requireAuth, bcrypt } = require('../auth');

const router = express.Router();

router.post('/users/auth-with-password', async (req, res) => {
  const { identity, password } = req.body || {};
  if (!identity || !password) return res.status(400).json({ message: 'Email and password are required.' });

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [identity]);
  const user = rows[0];
  if (!user) return res.status(400).json({ message: 'Invalid credentials.' });
  if (user.status !== 'active') return res.status(400).json({ message: 'This account has been suspended.' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(400).json({ message: 'Invalid credentials.' });

  const token = signToken(user);
  res.json({ token, record: sanitizeUser(user) });
});

router.get('/users/auth-refresh', requireAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const user = rows[0];
  if (!user) return res.status(401).json({ message: 'Session no longer valid.' });
  const token = signToken(user);
  res.json({ token, record: sanitizeUser(user) });
});

router.post('/users/request-password-reset', async (req, res) => {
  const { email } = req.body || {};
  // Always respond success regardless of whether the email exists, so this
  // endpoint can't be used to enumerate registered accounts.
  if (!email) return res.status(200).json({});

  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (rows[0]) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query('UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?', [tokenHash, expires, rows[0].id]);

    // TODO: wire up outbound email (SMTP) before going live — see
    // apps/server/.env.example. Until then this logs the reset link so
    // development/testing can proceed; it must not ship to production
    // without real email delivery.
    const resetUrl = `${process.env.APP_URL || ''}/reset-password?token=${rawToken}`;
    console.log(`[password-reset] ${email} -> ${resetUrl}`);
  }
  res.status(200).json({});
});

router.post('/users/confirm-password-reset', async (req, res) => {
  const { token, password, passwordConfirm } = req.body || {};
  if (!token || !password || password !== passwordConfirm) {
    return res.status(400).json({ message: 'Invalid request.' });
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const [rows] = await pool.query('SELECT id FROM users WHERE reset_token_hash = ? AND reset_token_expires > NOW()', [tokenHash]);
  if (!rows[0]) return res.status(400).json({ message: 'This reset link is invalid or has expired.' });

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?', [passwordHash, rows[0].id]);
  res.status(200).json({});
});

module.exports = router;
