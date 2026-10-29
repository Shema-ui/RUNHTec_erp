const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { signToken, sanitizeUser, requireAuth, bcrypt, MIN_PASSWORD_LENGTH } = require('../auth');
const { createLimiter } = require('../rateLimit');

const router = express.Router();

// Brute-force protection: failed logins are counted per IP address and per
// account; after too many, further attempts are refused for 15 minutes.
const loginByIp = createLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const loginByAccount = createLimiter({ windowMs: 15 * 60 * 1000, max: 8 });
const resetByIp = createLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function tooMany(res, seconds) {
  res.setHeader('Retry-After', String(seconds));
  return res.status(429).json({ message: 'Too many attempts. Please wait 15 minutes and try again.' });
}

router.post('/users/auth-with-password', async (req, res) => {
  const { identity, password } = req.body || {};
  if (typeof identity !== 'string' || typeof password !== 'string' || !identity || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  const ipKey = req.ip;
  const accountKey = identity.trim().toLowerCase();
  if (loginByIp.isBlocked(ipKey)) return tooMany(res, loginByIp.retryAfterSeconds(ipKey));
  if (loginByAccount.isBlocked(accountKey)) return tooMany(res, loginByAccount.retryAfterSeconds(accountKey));

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [identity.trim()]);
  const user = rows[0];
  // Always run bcrypt so a wrong email and a wrong password take the same time.
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !valid) {
    loginByIp.hit(ipKey);
    loginByAccount.hit(accountKey);
    return res.status(400).json({ message: 'Invalid credentials.' });
  }
  if (user.status !== 'active') return res.status(400).json({ message: 'This account has been suspended.' });
  loginByAccount.reset(accountKey);

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
  if (!email || typeof email !== 'string') return res.status(200).json({});
  if (resetByIp.isBlocked(req.ip)) return res.status(200).json({});
  resetByIp.hit(req.ip);

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
  if (typeof token !== 'string' || typeof password !== 'string' || !token || password !== passwordConfirm) {
    return res.status(400).json({ message: 'Invalid request.' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const [rows] = await pool.query('SELECT id FROM users WHERE reset_token_hash = ? AND reset_token_expires > NOW()', [tokenHash]);
  if (!rows[0]) return res.status(400).json({ message: 'This reset link is invalid or has expired.' });

  const passwordHash = await bcrypt.hash(password, 10);
  // Changing the password also signs the account out everywhere else.
  await pool.query('UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL, tokens_valid_after = UTC_TIMESTAMP() WHERE id = ?', [passwordHash, rows[0].id]);
  res.status(200).json({});
});

module.exports = router;
