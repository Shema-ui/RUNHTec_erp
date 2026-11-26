// Staff registration after an application is approved:
//   1. profile complete (existing gate)
//   2. the worker reads the framework agreement, draws a signature and types their full name
//   3. HR, a project manager or an admin reviews it (approve, or ask for changes)
//   4. HR (or an admin) marks the registration complete, which opens the projects and clients
const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { requireAuth } = require('../auth');
const { genId } = require('../idGen');
const { writeAuditEntry } = require('../audit');
const { notifyRoles, notifyUsers } = require('../notify');
const { renderContract } = require('../contractTemplate');

const router = express.Router();
const REVIEWERS = ['super_admin', 'admin', 'project_manager', 'hr'];
const COMPLETERS = ['super_admin', 'admin', 'hr'];
const MAX_SIGNATURE = 300000; // characters of the signature image (PNG data URL)

const isReviewer = (u) => REVIEWERS.includes(u?.role);
const canComplete = (u) => COMPLETERS.includes(u?.role);
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const profileDone = (u) => Number(u?.profile_completed) === 1;

async function profileOf(userId) {
  const [rows] = await pool.query('SELECT full_name, national_id_number, phone FROM staff_profiles WHERE user = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

async function latestContract(userId) {
  const [rows] = await pool.query('SELECT * FROM staff_contracts WHERE user = ? ORDER BY created DESC LIMIT 1', [userId]);
  return rows[0] || null;
}

// Creates the agreement for a worker whose profile is complete and who has none yet.
async function issueContract(user) {
  const p = await profileOf(user.id);
  const c = renderContract({
    name: (p && p.full_name) || user.name || '',
    nationalId: p && p.national_id_number,
    phone: (p && p.phone) || user.phone,
    role: user.job_title || (user.role === 'lead_technician' ? 'Lead technician' : 'Technician'),
    date: new Date().toISOString().slice(0, 10),
  });
  const id = genId();
  await pool.query(
    "INSERT INTO staff_contracts (id, user, title, body, version, status) VALUES (?, ?, ?, ?, ?, 'issued')",
    [id, user.id, c.title, c.body, c.version]
  );
  return latestContract(user.id);
}

function publicContract(c) {
  if (!c) return null;
  const { signature, ...rest } = c;
  return { ...rest, has_signature: Boolean(signature) };
}

// GET /api/onboarding/me — where this person is in registration.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const u = req.user;
    const isStaff = !['super_admin', 'admin', 'client', 'vendor'].includes(u.role);
    if (!isStaff) return res.json({ registration_complete: true, profile_complete: true, contract: null });
    let contract = await latestContract(u.id);
    if (!contract && profileDone(u) && Number(u.registration_complete) === 0) contract = await issueContract(u);
    res.json({
      registration_complete: Number(u.registration_complete) !== 0,
      profile_complete: profileDone(u),
      contract: publicContract(contract),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/onboarding/contract — the full agreement (own, or any user for reviewers).
router.get('/contract', requireAuth, async (req, res) => {
  try {
    const userId = req.query.user && isReviewer(req.user) ? req.query.user : req.user.id;
    if (userId !== req.user.id && !isReviewer(req.user)) return res.status(403).json({ message: 'Not allowed.' });
    const c = await latestContract(userId);
    if (!c) return res.status(404).json({ message: 'No agreement yet.' });
    res.json({ ...c, signature: c.signature || null });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/onboarding/sign — { signed_name, signature, agree }
router.post('/sign', requireAuth, async (req, res) => {
  try {
    const u = req.user;
    if (Number(u.registration_complete) !== 0) return res.status(400).json({ message: 'Your registration is already complete.' });
    if (!profileDone(u)) return res.status(400).json({ message: 'Complete your profile first.' });
    const { signed_name, signature, agree } = req.body || {};
    if (agree !== true) return res.status(400).json({ message: 'Tick the box to confirm you have read and agree to the agreement.' });
    if (typeof signature !== 'string' || !signature.startsWith('data:image/png;base64,') || signature.length > MAX_SIGNATURE) {
      return res.status(400).json({ message: 'Draw your signature in the box first.' });
    }
    const p = await profileOf(u.id);
    const allowed = [norm(p && p.full_name), norm(u.name)].filter(Boolean);
    if (!allowed.includes(norm(signed_name))) {
      return res.status(400).json({ message: 'Type your full name exactly as it appears on your profile.' });
    }
    let c = await latestContract(u.id);
    if (!c) c = await issueContract(u);
    if (!['issued', 'changes_requested'].includes(c.status)) return res.status(400).json({ message: 'This agreement is already signed.' });
    const signedAt = new Date();
    const hash = crypto.createHash('sha256').update(`${c.body}|${String(signed_name).trim()}|${signedAt.toISOString()}`).digest('hex');
    await pool.query(
      "UPDATE staff_contracts SET status = 'signed', signed_name = ?, signature = ?, signed_at = ?, signed_ip = ?, document_hash = ? WHERE id = ?",
      [String(signed_name).trim().slice(0, 200), signature, signedAt, String(req.ip || '').slice(0, 64), hash, c.id]
    );
    await notifyRoles(['hr', 'project_manager', 'admin', 'super_admin'], 'onboarding',
      `${u.name || u.email} has signed the staff agreement. Review it under HR → Onboarding.`, '/hr/onboarding');
    await writeAuditEntry({ actor: u, action: 'Signed', collectionName: 'users', record: { id: u.id, name: u.name || u.email, email: u.email, role: u.role } });
    res.json({ ok: true, status: 'signed' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/onboarding/queue — everyone still registering, with their step (reviewers).
router.get('/queue', requireAuth, async (req, res) => {
  try {
    if (!isReviewer(req.user)) return res.status(403).json({ message: 'Not allowed.' });
    const [users] = await pool.query(
      "SELECT id, name, email, phone, role, profile_completed, registration_complete FROM users WHERE registration_complete = 0 AND role NOT IN ('super_admin','admin','client','vendor') ORDER BY created DESC"
    );
    const out = [];
    for (const u of users) {
      const c = await latestContract(u.id);
      out.push({ ...u, contract: publicContract(c) });
    }
    res.json({ items: out });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/onboarding/review — { user, decision: 'approve' | 'changes', notes }
router.post('/review', requireAuth, async (req, res) => {
  try {
    if (!isReviewer(req.user)) return res.status(403).json({ message: 'Not allowed.' });
    const { user, decision, notes } = req.body || {};
    const c = await latestContract(user);
    if (!c || c.status !== 'signed') return res.status(400).json({ message: 'There is no signed agreement waiting for review.' });
    const reviewer = req.user;
    if (decision === 'approve') {
      await pool.query(
        "UPDATE staff_contracts SET status = 'approved', review_notes = ?, reviewed_by = ?, reviewed_by_name = ?, reviewed_at = NOW() WHERE id = ?",
        [String(notes || '').slice(0, 2000), reviewer.id, reviewer.name || reviewer.email, c.id]
      );
      await notifyUsers([user], 'onboarding', 'Your agreement has been approved. HR will confirm your registration shortly.', '/onboarding');
    } else if (decision === 'changes') {
      if (String(notes || '').trim().length < 5) return res.status(400).json({ message: 'Write what needs to change so the person knows what to fix.' });
      await pool.query(
        "UPDATE staff_contracts SET status = 'changes_requested', review_notes = ?, reviewed_by = ?, reviewed_by_name = ?, reviewed_at = NOW() WHERE id = ?",
        [String(notes).slice(0, 2000), reviewer.id, reviewer.name || reviewer.email, c.id]
      );
      await notifyUsers([user], 'onboarding', `Your agreement needs changes: ${String(notes).slice(0, 160)}`, '/onboarding');
    } else {
      return res.status(400).json({ message: 'Choose approve or changes.' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/onboarding/complete — { user } (HR or admin): opens the projects and clients.
router.post('/complete', requireAuth, async (req, res) => {
  try {
    if (!canComplete(req.user)) return res.status(403).json({ message: 'Only HR or an admin can complete registration.' });
    const { user } = req.body || {};
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [user]);
    const target = rows[0];
    if (!target) return res.status(404).json({ message: 'Person not found.' });
    if (Number(target.profile_completed) !== 1) return res.status(400).json({ message: 'Their profile is not complete yet.' });
    const c = await latestContract(user);
    if (!c || c.status !== 'approved') return res.status(400).json({ message: 'Approve their signed agreement first.' });
    await pool.query('UPDATE users SET registration_complete = 1 WHERE id = ?', [user]);
    await notifyUsers([user], 'onboarding', 'Your registration is complete. Your projects and client pages are now open.', '/projects');
    await writeAuditEntry({ actor: req.user, action: 'Completed', collectionName: 'users', record: { id: target.id, name: target.name || target.email, email: target.email, role: target.role } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
