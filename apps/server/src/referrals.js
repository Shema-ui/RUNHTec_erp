// Referral credits: people and companies who bring in a new client earn account credit.
// Credit is RWF, never expires, and is used by recording a payment with method "Referral credit".
const crypto = require('crypto');
const pool = require('./db');
const { genId } = require('./idGen');
const { notifyUsers } = require('./notify');

// Reward rules (change here to adjust):
const INDIVIDUAL_CREDIT = 10000;   // RWF, flat, for an individual's first completed payment
const COMPANY_PERCENT = 0.02;      // 2% of a company's first completed payment...
const COMPANY_CAP = 300000;        // ...capped at this amount
const CREDIT_METHOD = 'Referral credit';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const makeCode = () => Array.from(crypto.randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

async function codeFor(userId) {
  const [rows] = await pool.query('SELECT code FROM referral_codes WHERE owner_user = ?', [userId]);
  if (rows[0]) return rows[0].code;
  for (let i = 0; i < 5; i++) {
    try {
      const code = makeCode();
      await pool.query('INSERT INTO referral_codes (id, owner_user, code) VALUES (?, ?, ?)', [genId(), userId, code]);
      return code;
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      const [again] = await pool.query('SELECT code FROM referral_codes WHERE owner_user = ?', [userId]);
      if (again[0]) return again[0].code;
    }
  }
  throw new Error('Could not create a referral code');
}

async function balanceOf(userId) {
  const [rows] = await pool.query('SELECT COALESCE(SUM(amount), 0) AS s FROM credit_ledger WHERE owner_user = ?', [userId]);
  return Number(rows[0].s) || 0;
}

// Called when a new client signs up with a referral code.
async function attachReferral(code, clientId, name, isCompany, phone) {
  const [owners] = await pool.query(
    'SELECT rc.owner_user, u.phone FROM referral_codes rc JOIN users u ON u.id = rc.owner_user WHERE rc.code = ?',
    [String(code || '').trim().toUpperCase()]
  );
  const owner = owners[0];
  if (!owner) return false;
  if (owner.phone && phone && String(owner.phone) === String(phone)) return false; // no referring yourself
  await pool.query(
    "INSERT INTO referrals (id, owner_user, referred_name, referred_client, kind, status) VALUES (?, ?, ?, ?, ?, 'signed_up')",
    [genId(), owner.owner_user, String(name || '').slice(0, 200), clientId, isCompany ? 'company' : 'individual']
  );
  return true;
}

// Earn credit on the referred client's first completed payment.
async function rewardForPayment(payment) {
  if (!payment || payment.status !== 'completed' || payment.method === CREDIT_METHOD || !payment.client) return;
  const [refs] = await pool.query("SELECT * FROM referrals WHERE referred_client = ? AND status = 'signed_up' LIMIT 1", [payment.client]);
  const ref = refs[0];
  if (!ref) return;
  const [owner] = await pool.query('SELECT role FROM users WHERE id = ?', [ref.owner_user]);
  if (!owner[0] || owner[0].role !== 'client') return; // staff are paid commission in cash instead
  const [prior] = await pool.query(
    "SELECT COUNT(*) AS n FROM payments WHERE client = ? AND status = 'completed' AND method <> ? AND id <> ?",
    [payment.client, CREDIT_METHOD, payment.id]
  );
  if (Number(prior[0].n) > 0) return; // only the first completed payment counts
  const amount = ref.kind === 'company'
    ? Math.min(COMPANY_CAP, Math.round(Number(payment.amount || 0) * COMPANY_PERCENT))
    : INDIVIDUAL_CREDIT;
  if (amount <= 0) return;
  await pool.query(
    "INSERT INTO credit_ledger (id, owner_user, amount, kind, referral, note) VALUES (?, ?, ?, 'earned', ?, ?)",
    [genId(), ref.owner_user, amount, ref.id, `Referral reward: ${ref.referred_name || 'new client'}`]
  );
  await pool.query("UPDATE referrals SET status = 'rewarded', rewarded_credit = ?, rewarded_at = NOW() WHERE id = ?", [amount, ref.id]);
  await notifyUsers([ref.owner_user], 'referral', `You earned ${amount.toLocaleString('en-US')} RWF credit for bringing in ${ref.referred_name || 'a new client'}.`, '/referrals');
}

// Used when a payment is recorded with method "Referral credit". Returns an error message, or null.
async function spendForPayment(payment) {
  const [owners] = await pool.query("SELECT id FROM users WHERE client = ? AND role = 'client' LIMIT 1", [payment.client]);
  if (!owners[0]) return 'Referral credit can only be used by a client account.';
  const amount = Number(payment.amount || 0);
  const balance = await balanceOf(owners[0].id);
  if (amount <= 0) return 'Enter the amount of credit to use.';
  if (amount > balance) return `Not enough referral credit. Balance is ${balance.toLocaleString('en-US')} RWF.`;
  await pool.query(
    "INSERT INTO credit_ledger (id, owner_user, amount, kind, invoice, note) VALUES (?, ?, ?, 'used', ?, ?)",
    [genId(), owners[0].id, -amount, payment.invoice || null, 'Used on invoice']
  );
  return null;
}

module.exports = { codeFor, balanceOf, attachReferral, rewardForPayment, spendForPayment, CREDIT_METHOD, INDIVIDUAL_CREDIT, COMPANY_PERCENT, COMPANY_CAP };
