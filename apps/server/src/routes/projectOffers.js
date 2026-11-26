// Project offers. When a project is opened for offers, staff whose skills match are invited.
// They say they are interested (with dates and role) or not available. Managers see the offers,
// choose people, and choosing someone adds them to the project team.
// Cost privacy: this file never returns buying prices, project values, margins or pay rates.
const express = require('express');
const pool = require('../db');
const { genId } = require('../idGen');
const { requireAuth } = require('../auth');
const { notifyRoles, notifyUsers } = require('../notify');
const { emailEnabled, sendEmail } = require('../mailer');

const router = express.Router();
const MANAGERS = ['super_admin', 'admin', 'project_manager'];
const APP_URL = process.env.APP_URL || 'https://erp.runhteccontractors.si';
const isStaff = (u) => Boolean(u) && !['client', 'vendor'].includes(u.role);
const isManager = (u) => Boolean(u) && MANAGERS.includes(u.role);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dayText = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10));
const cleanDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error('Offers:', err.message);
  res.status(500).json({ message: 'Something went wrong. Try again.' });
});

// Skills are stored as text or JSON lists. Turn either into a plain list.
function partsOf(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); if (Array.isArray(j)) return j.map(String); } catch (_) { /* plain text */ }
    return [v];
  }
  return [String(v)];
}

// What each person has told us: skills listed on their profile, and the trade (domain) they
// chose when they applied. Used to decide who is invited to a project.
async function profileByUser() {
  const map = {};
  const entry = (user) => (map[user] || (map[user] = { skills: [], domain: [] }));
  const [sp] = await pool.query('SELECT user, skills FROM staff_profiles WHERE user IS NOT NULL');
  sp.forEach((r) => entry(r.user).skills.push(...partsOf(r.skills)));
  const [em] = await pool.query('SELECT user, skills FROM employees WHERE user IS NOT NULL');
  em.forEach((r) => entry(r.user).skills.push(...partsOf(r.skills)));
  // The domain is the trade chosen on the application (or on the contractor record).
  // The contractor department is not used: it defaults to "technical" for everyone.
  const [ct] = await pool.query(`SELECT c.user, c.skills, c.trade, a.trade AS app_trade
    FROM contractors c LEFT JOIN job_applications a ON a.id = c.application WHERE c.user IS NOT NULL`);
  ct.forEach((r) => {
    const e = entry(r.user);
    e.skills.push(...partsOf(r.skills));
    e.domain.push(...partsOf(r.trade), ...partsOf(r.app_trade));
  });
  const out = {};
  Object.keys(map).forEach((k) => {
    const skills = [...new Set(map[k].skills.filter(Boolean))];
    const domain = [...new Set(map[k].domain.filter(Boolean))];
    const all = [...skills, ...domain];
    out[k] = {
      label: all.join(', '),
      text: all.join(',').toLowerCase(),
      hasSkills: skills.length > 0,
      hasDomain: domain.length > 0,
    };
  });
  return out;
}

// A project with no skills wanted goes to everyone.
// If the person listed skills, one of them must match the project's skills.
// If they listed no skills but chose a trade when applying, they stay open to every project.
function matches(projectSkills, profile) {
  const need = String(projectSkills || '').toLowerCase().split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
  if (!need.length) return true;
  if (!profile) return false;
  if (profile.hasSkills) return need.some((n) => profile.text.includes(n));
  return profile.hasDomain;
}

async function staffUsers() {
  // Only field workers who have finished registration are invited to offer for jobs.
  const [rows] = await pool.query("SELECT id, name, email FROM users WHERE status = 'active' AND role IN ('technician', 'lead_technician') AND registration_complete <> 0");
  return rows;
}

async function recipientsFor(project) {
  const profiles = await profileByUser();
  return (await staffUsers()).filter((u) => matches(project.offer_skills, profiles[u.id]));
}

function openProjectEmail(p, name) {
  const { renderEmail } = require('../emailLayout');
  const details = [];
  if (p.offer_location) details.push(['Location', p.offer_location]);
  if (p.offer_deadline) details.push(['Offers close', dayText(p.offer_deadline)]);
  if (Number(p.positions_needed)) details.push(['People needed', String(Number(p.positions_needed))]);
  return renderEmail({
    greeting: `Dear ${name || 'colleague'},`,
    paragraphs: [
      `A new job has been posted: ${p.title}.`,
      'Please let us know whether you are interested and available. Your reply is recorded in the ERP under Project Offers.',
      ...(p.offer_summary ? [p.offer_summary] : []),
    ],
    details,
    button: { label: 'View project offers', url: `${APP_URL}/offers` },
    closing: ['Thank you.'],
    signoff: 'RUNHTec Contractors Ltd',
  });
}

// Called when a project is opened for offers (or saved as open). Invites matching staff once each.
async function announceOpenProject(p) {
  const recipients = await recipientsFor(p);
  if (!recipients.length) return 0;
  const [existing] = await pool.query('SELECT user FROM project_offers WHERE project = ?', [p.id]);
  const seen = new Set(existing.map((r) => r.user));
  const fresh = recipients.filter((u) => !seen.has(u.id));
  for (const u of fresh) {
    await pool.query("INSERT IGNORE INTO project_offers (id, project, user, status) VALUES (?, ?, ?, 'invited')", [genId(), p.id, u.id]);
  }
  if (!fresh.length) return 0;
  // The in-app notice and the email say the same thing; the email carries the full job details.
  await notifyUsers(fresh.map((u) => u.id), 'project', `New job posted: “${p.title}”. Tap to tell us if you can offer your services.`, '/offers', {
    email: (u) => {
      const m = openProjectEmail(p, u.name);
      return { subject: `New job posted: ${p.title}`, text: m.text, html: m.html };
    },
  });
  return fresh.length;
}

// Reminder once, 24 hours after an invite, if the person still hasn't answered.
async function sendOfferReminders() {
  const [rows] = await pool.query(`SELECT o.id, o.user, p.title FROM project_offers o JOIN projects p ON p.id = o.project
    WHERE o.status = 'invited' AND o.reminded = 0 AND o.invited_at < UTC_TIMESTAMP() - INTERVAL 1 DAY
      AND p.offers_open = 1 AND p.status NOT IN ('done', 'cancelled')
      AND (p.offer_deadline IS NULL OR p.offer_deadline >= CURDATE())`);
  for (const r of rows) {
    await pool.query('UPDATE project_offers SET reminded = 1 WHERE id = ? AND reminded = 0', [r.id]);
    await notifyUsers([r.user], 'project', `Reminder: “${r.title}” is still open for offers. Tap to respond.`, '/offers');
  }
}
setInterval(() => { sendOfferReminders().catch((err) => console.error('Offer reminders failed:', err.message)); }, 30 * 60 * 1000);

// Projects open for offers that this person can see, with their own answer.
router.get('/open', requireAuth, wrap(async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Staff only.' });
  const [projects] = await pool.query(`SELECT id, title, offer_location, offer_summary, offer_deadline, positions_needed, offer_skills
    FROM projects WHERE offers_open = 1 AND status NOT IN ('done', 'cancelled')
      AND (offer_deadline IS NULL OR offer_deadline >= CURDATE()) ORDER BY created DESC`);
  const [mine] = await pool.query('SELECT project, status, interest, note, available_from, available_to, role_pref FROM project_offers WHERE user = ?', [req.user.id]);
  const byProject = {};
  mine.forEach((m) => { byProject[m.project] = m; });
  const profiles = await profileByUser();
  const profile = profiles[req.user.id];
  const list = projects
    .filter((p) => byProject[p.id] || matches(p.offer_skills, profile))
    .map((p) => ({
      id: p.id, title: p.title, offer_location: p.offer_location, offer_summary: p.offer_summary,
      offer_deadline: p.offer_deadline, positions_needed: p.positions_needed,
      my: byProject[p.id] || null,
    }));
  res.json(list);
}));

// My offers and what the office said back.
router.get('/mine', requireAuth, wrap(async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Staff only.' });
  const [rows] = await pool.query(`SELECT o.id, o.project, o.status, o.interest, o.note, o.available_from, o.available_to, o.role_pref, o.responded_at, o.decision_note, p.title
    FROM project_offers o JOIN projects p ON p.id = o.project
    WHERE o.user = ? AND o.status <> 'invited' ORDER BY o.responded_at DESC`, [req.user.id]);
  res.json(rows);
}));

// Say interested (with dates and role) or not available.
router.post('/:project/respond', requireAuth, wrap(async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Staff only.' });
  const [rows] = await pool.query(`SELECT id, title, offers_open, status,
    (offer_deadline IS NOT NULL AND offer_deadline < CURDATE()) AS closed FROM projects WHERE id = ?`, [req.params.project]);
  const p = rows[0];
  if (!p || !Number(p.offers_open) || Number(p.closed) || ['done', 'cancelled'].includes(p.status)) {
    return res.status(400).json({ message: 'This project is no longer taking offers.' });
  }
  const interest = req.body?.interest === 'not_available' ? 'not_available' : 'interested';
  const status = interest === 'interested' ? 'offered' : 'declined';
  const from = cleanDate(req.body?.available_from);
  const to = cleanDate(req.body?.available_to);
  const roleRaw = String(req.body?.role_pref || '');
  const role = ['lead', 'support', 'either'].includes(roleRaw) ? roleRaw : 'either';
  const note = String(req.body?.note || '').trim().slice(0, 1000);
  await pool.query(`INSERT INTO project_offers (id, project, user, status, interest, available_from, available_to, role_pref, note, responded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
    ON DUPLICATE KEY UPDATE status = IF(status = 'accepted', status, VALUES(status)), interest = VALUES(interest),
      available_from = VALUES(available_from), available_to = VALUES(available_to), role_pref = VALUES(role_pref),
      note = VALUES(note), responded_at = VALUES(responded_at)`,
    [genId(), p.id, req.user.id, status, interest, from, to, role, note]);
  await notifyRoles(MANAGERS, 'project', `${req.user.name || 'A team member'} ${interest === 'interested' ? 'is interested in' : 'is not available for'} “${p.title}”.`, '/offers');
  res.json({ ok: true, status });
}));

// Withdraw an offer that is still open.
router.post('/:project/withdraw', requireAuth, wrap(async (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ message: 'Staff only.' });
  const [result] = await pool.query(`UPDATE project_offers SET status = 'withdrawn', responded_at = UTC_TIMESTAMP()
    WHERE project = ? AND user = ? AND status IN ('invited', 'offered', 'declined')`, [req.params.project, req.user.id]);
  if (!result.affectedRows) return res.status(400).json({ message: 'Nothing to withdraw.' });
  res.json({ ok: true });
}));

// Managers: everyone invited to a project and how they answered. Profile skills only, no pay.
router.get('/project/:project', requireAuth, wrap(async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: 'Managers only.' });
  const [rows] = await pool.query(`SELECT o.id, o.user, o.status, o.interest, o.note, o.available_from, o.available_to, o.role_pref,
    o.responded_at, o.decision_note, u.name FROM project_offers o JOIN users u ON u.id = o.user
    WHERE o.project = ? ORDER BY FIELD(o.status, 'offered', 'accepted', 'invited', 'declined', 'withdrawn', 'not_chosen'), o.responded_at DESC`, [req.params.project]);
  const profiles = await profileByUser();
  res.json(rows.map((r) => ({ ...r, skills: profiles[r.user]?.label || '' })));
}));

// Managers: choose someone (adds them to the project team) or send a "not chosen" note.
router.post('/decide/:id', requireAuth, wrap(async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: 'Managers only.' });
  const decision = req.body?.decision === 'accept' ? 'accept' : (req.body?.decision === 'not_chosen' ? 'not_chosen' : null);
  if (!decision) return res.status(400).json({ message: 'Choose accept or not chosen.' });
  const [rows] = await pool.query(`SELECT o.id, o.user, o.project, o.status, p.title, p.assigned_technicians
    FROM project_offers o JOIN projects p ON p.id = o.project WHERE o.id = ?`, [req.params.id]);
  const o = rows[0];
  if (!o) return res.status(404).json({ message: 'Offer not found.' });
  if (o.status !== 'offered') return res.status(400).json({ message: 'Only offers that are still open can be decided.' });
  const note = String(req.body?.message || '').trim().slice(0, 500);
  await pool.query('UPDATE project_offers SET status = ?, decided_at = UTC_TIMESTAMP(), decided_by = ?, decision_note = ? WHERE id = ?',
    [decision === 'accept' ? 'accepted' : 'not_chosen', req.user.id, note, o.id]);
  if (decision === 'accept') {
    let team = [];
    try { team = typeof o.assigned_technicians === 'string' ? JSON.parse(o.assigned_technicians || '[]') : (o.assigned_technicians || []); } catch (_) { team = []; }
    if (!Array.isArray(team)) team = [];
    if (!team.includes(o.user)) team.push(o.user);
    await pool.query('UPDATE projects SET assigned_technicians = ? WHERE id = ?', [JSON.stringify(team), o.project]);
    await notifyUsers([o.user], 'project', `You have been chosen for “${o.title}”. Open Projects to see the details. The office will confirm pay with you.`, '/projects');
  } else {
    await notifyUsers([o.user], 'project', `Thank you for offering for “${o.title}”. This time another team member was chosen.${note ? ' ' + note : ''}`, '/offers');
  }
  res.json({ ok: true });
}));

module.exports = router;
module.exports.announceOpenProject = announceOpenProject;
module.exports.recipientsFor = recipientsFor;
