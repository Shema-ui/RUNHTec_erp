const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required — see .env.example');
}
const TOKEN_TTL = '7d';

function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function sanitizeUser(row) {
  if (!row) return null;
  const { password_hash, reset_token_hash, reset_token_expires, tokens_valid_after, ...rest } = row;
  return rest;
}

// Populates req.user (sanitized row) from a Bearer token if present.
// Does NOT reject the request if missing/invalid — routes decide whether
// auth is required via the `requireAuth` middleware below, matching how
// PocketBase's public routes (e.g. website-intake) work unauthenticated.
async function attachUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND status = "active"', [payload.sub]);
    const row = rows[0];
    // Tokens issued before the last password change are no longer accepted.
    const validAfter = row && row.tokens_valid_after ? new Date(String(row.tokens_valid_after).replace(' ', 'T') + 'Z').getTime() : 0;
    if (row && (!validAfter || payload.iat * 1000 >= validAfter - 1000)) req.user = sanitizeUser(row);
  } catch (_) {
    // invalid/expired token — leave req.user unset, requireAuth will reject if needed
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
  next();
}

const MIN_PASSWORD_LENGTH = 8;

module.exports = { signToken, sanitizeUser, attachUser, requireAuth, bcrypt, MIN_PASSWORD_LENGTH };
