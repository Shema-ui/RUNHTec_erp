// Phone / desktop notifications ("web push") for the installed ERP app.
//
// Free: it uses the push service already built into Chrome, Edge, Firefox and
// Safari — no paid service and no extra package. Every bell notification is
// also sent as a push to the person's devices that turned notifications on.
//
// How it works (standards RFC 8291 + RFC 8292):
//  - The server has one key pair ("VAPID keys"), created automatically the
//    first time and kept in the app_secrets table. Nothing to set up.
//  - A device that turns notifications on gives us a subscription (an address
//    at Google/Apple/Mozilla plus two keys). We keep it in push_subscriptions.
//  - To notify, we encrypt the message for that device and post it there.
const crypto = require('crypto');
const pool = require('./db');
const { genId } = require('./idGen');

const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// ── Server keys ──────────────────────────────────────────────────────────────
let keysPromise = null;
function getKeys() {
  if (!keysPromise) {
    keysPromise = (async () => {
      const [rows] = await pool.query("SELECT value FROM app_secrets WHERE name = 'vapid'");
      if (rows[0]) return JSON.parse(rows[0].value);
      const ecdh = crypto.createECDH('prime256v1');
      ecdh.generateKeys();
      const keys = { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
      // INSERT IGNORE: if two server starts race, the first one wins and we re-read it.
      await pool.query("INSERT IGNORE INTO app_secrets (name, value) VALUES ('vapid', ?)", [JSON.stringify(keys)]);
      const [again] = await pool.query("SELECT value FROM app_secrets WHERE name = 'vapid'");
      return JSON.parse(again[0].value);
    })().catch((err) => { keysPromise = null; throw err; });
  }
  return keysPromise;
}

function privateKeyObject(keys) {
  const pub = fromB64u(keys.publicKey);
  return crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: keys.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: 'jwk',
  });
}

// Signed token that proves the push came from us (RFC 8292).
function vapidHeader(endpoint, keys) {
  const aud = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: process.env.PUSH_CONTACT || process.env.APP_URL || 'https://erp.runhteccontractors.si',
  }));
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key: privateKeyObject(keys), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${keys.publicKey}`;
}

// Encrypt a message for one device (RFC 8291, "aes128gcm").
function encrypt(payload, p256dh, auth) {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  const ecdh = crypto.createECDH('prime256v1');
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const salt = crypto.randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

// Send one push. Returns 'ok', 'gone' (device unsubscribed) or 'error'.
async function sendOne(sub, message) {
  try {
    const keys = await getKeys();
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        TTL: '86400', // keep trying for a day if the phone is off
        Urgency: 'normal',
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        Authorization: vapidHeader(sub.endpoint, keys),
      },
      body: encrypt(JSON.stringify(message), sub.p256dh, sub.auth),
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    if (!res.ok) { console.error('push failed', res.status, (await res.text().catch(() => '')).slice(0, 200)); return 'error'; }
    return 'ok';
  } catch (err) {
    console.error('push failed:', err.message);
    return 'error';
  }
}

// Push a notification to every device of these users. Never throws, never
// slows down the request that triggered it (call without await).
async function pushToUsers(userIds, { title = 'RUNHTec', body = '', link = '' } = {}) {
  try {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return;
    const [subs] = await pool.query(
      `SELECT s.id, s.endpoint, s.p256dh, s.auth FROM push_subscriptions s JOIN users u ON u.id = s.user
       WHERE u.status = 'active' AND s.user IN (${ids.map(() => '?').join(', ')})`,
      ids
    );
    await Promise.all(subs.map(async (s) => {
      const r = await sendOne(s, { title, body: String(body).slice(0, 300), link: link || '/' });
      if (r === 'gone') await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [s.id]).catch(() => {});
    }));
  } catch (err) {
    console.error('push failed:', err.message);
  }
}

async function saveSubscription(userId, sub, userAgent = '') {
  const endpoint = String(sub?.endpoint || '');
  const p256dh = String(sub?.keys?.p256dh || '');
  const auth = String(sub?.keys?.auth || '');
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth) throw new Error('Invalid subscription.');
  // One row per device: re-subscribing (or another person signing in on the same phone) replaces it.
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
  await pool.query(
    'INSERT INTO push_subscriptions (id, user, endpoint, p256dh, auth, user_agent, created) VALUES (?, ?, ?, ?, ?, ?, NOW())',
    [genId(), userId, endpoint, p256dh, auth, String(userAgent).slice(0, 300)]
  );
}

async function removeSubscription(userId, endpoint) {
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ? AND user = ?', [String(endpoint || ''), userId]);
}

module.exports = { getKeys, pushToUsers, saveSubscription, removeSubscription, sendOne, encrypt, vapidHeader };
