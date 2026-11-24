// HR contact with applicants: email and WhatsApp messages, interview invitations and a history for each application.
const express = require('express');
const pool = require('../db');
const { genId } = require('../idGen');
const { requireAuth } = require('../auth');
const { sendEmail } = require('../mailer');
const { renderEmail } = require('../emailLayout');

const router = express.Router();
const HR = ['super_admin', 'admin', 'hr'];
const SIGN = 'Kind regards,\nHuman Resources, RUNHTec Contractors Ltd';
const PHONE = '+250 793 229 790';
const KIGALI = 'Africa/Kigali';

const TEMPLATES = {
  documents: {
    label: 'Request documents',
    subject: 'Documents needed for your RUNHTec application',
    body: 'Thank you for your application {ref}. To continue, please send clear copies of your national ID, your certificates and an updated CV. You can reply to this email or send them on WhatsApp to ' + PHONE + '.',
  },
  availability: {
    label: 'Confirm availability and rate',
    subject: 'Please confirm your availability',
    body: 'To match you with suitable projects, please confirm the days you are available, the earliest date you can start, and your expected day rate.',
  },
  call: {
    label: 'Ask to call us',
    subject: 'We would like to speak with you',
    body: 'We would like to speak with you about your application {ref}. Please call us on ' + PHONE + ' at your earliest convenience, or reply with a time that suits you.',
  },
  on_hold: {
    label: 'Application on hold',
    subject: 'An update on your application',
    body: 'Your application {ref} is on hold for now. We will keep your details on file and contact you when a suitable project comes up. No action is needed from you at the moment.',
  },
  custom: { label: 'Write my own message', subject: '', body: '' },
};

const fill = (text, app) => String(text || '').replace(/\{ref\}/g, app.ref || '').replace(/\{name\}/g, app.full_name || '');
const byName = (u) => u.name || u.email || 'HR';

async function loadApp(id) {
  const [rows] = await pool.query('SELECT id, ref, full_name, email, phone, whatsapp FROM job_applications WHERE id = ?', [id]);
  return rows[0] || null;
}

async function logEvent(app, user, data) {
  await pool.query(
    'INSERT INTO application_events (id, application, kind, subject, body, to_address, status, place, scheduled_for, created_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [genId(), app.id, data.kind, data.subject || '', data.body || '', data.to || '', data.status || 'sent', data.place || '', data.scheduled_for || null, byName(user)]
  );
}

// Interview times are typed in Kigali time (UTC+2, no daylight saving).
function parseKigali(value) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!m) return null;
  return new Date(`${m[1]}T${m[2]}:${m[3]}:00+02:00`);
}
const kigaliText = (d) => d.toLocaleString('en-GB', { timeZone: KIGALI, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' (Kigali time)';
const icsDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

function icsFor(app, when, place, notes) {
  const end = new Date(when.getTime() + 60 * 60 * 1000);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RUNHTec//Interview//EN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${app.ref}-${icsDate(when)}@runhteccontractors.si`, `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(when)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:RUNHTec interview (${app.ref})`,
    `LOCATION:${String(place || '').replace(/[,;]/g, ' ')}`,
    `DESCRIPTION:${String(notes || '').replace(/\n/g, ' ').replace(/[,;]/g, ' ')}`,
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64');
}

router.get('/templates', requireAuth, (req, res) => {
  if (!HR.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  res.json(Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label, subject: t.subject, body: t.body })));
});

router.get('/:id/events', requireAuth, async (req, res) => {
  if (!HR.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const [rows] = await pool.query(
    'SELECT id, kind, subject, body, to_address, status, place, scheduled_for, reminder_sent, created_by_name, created FROM application_events WHERE application = ? ORDER BY created DESC LIMIT 200',
    [req.params.id]
  );
  res.json(rows);
});

router.post('/:id/email', requireAuth, async (req, res) => {
  if (!HR.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const app = await loadApp(req.params.id);
  if (!app) return res.status(404).json({ message: 'Application not found.' });
  if (!app.email) return res.status(400).json({ message: 'This applicant has no email address.' });
  const tpl = TEMPLATES[req.body?.template] || TEMPLATES.custom;
  const subject = fill(String(req.body?.subject || tpl.subject || '').trim().slice(0, 200), app);
  const bodyText = fill(String(req.body?.body || tpl.body || '').trim().slice(0, 4000), app);
  if (!subject || !bodyText) return res.status(400).json({ message: 'Write a subject and a message first.' });
  const m = renderEmail({ greeting: `Dear ${app.full_name || 'applicant'},`, paragraphs: bodyText.split(/\n{2,}|\n/).filter(Boolean), signoff: SIGN, details: [['Reference', app.ref]] });
  const ok = await sendEmail({ to: app.email, subject: `${subject} (${app.ref})`, text: m.text, html: m.html });
  await logEvent(app, req.user, { kind: 'email', subject, body: bodyText, to: app.email, status: ok ? 'sent' : 'failed' });
  if (!ok) return res.status(502).json({ message: 'The email could not be sent. Check the email settings, then try again.' });
  res.json({ ok: true });
});

router.post('/:id/whatsapp', requireAuth, async (req, res) => {
  if (!HR.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const app = await loadApp(req.params.id);
  if (!app) return res.status(404).json({ message: 'Application not found.' });
  const digits = String(app.whatsapp || app.phone || '').replace(/\D/g, '');
  if (!digits) return res.status(400).json({ message: 'This applicant has no WhatsApp number.' });
  const text = fill(String(req.body?.body || '').trim().slice(0, 1500), app);
  if (!text) return res.status(400).json({ message: 'Write the message first.' });
  await logEvent(app, req.user, { kind: 'whatsapp', body: text, to: digits, status: 'opened' });
  res.json({ url: `https://wa.me/${digits}?text=${encodeURIComponent(text)}` });
});

router.post('/:id/interview', requireAuth, async (req, res) => {
  if (!HR.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const app = await loadApp(req.params.id);
  if (!app) return res.status(404).json({ message: 'Application not found.' });
  const when = parseKigali(req.body?.when);
  if (!when || Number.isNaN(when.getTime())) return res.status(400).json({ message: 'Choose the interview date and time.' });
  if (when.getTime() < Date.now()) return res.status(400).json({ message: 'The interview time must be in the future.' });
  const place = String(req.body?.place || '').trim().slice(0, 255);
  const notes = String(req.body?.notes || '').trim().slice(0, 1500);
  if (!place) return res.status(400).json({ message: 'Enter where the interview will take place.' });
  const whenText = kigaliText(when);
  await pool.query(
    "INSERT INTO application_events (id, application, kind, subject, body, to_address, status, place, scheduled_for, created_by_name) VALUES (?, ?, 'interview', ?, ?, ?, 'scheduled', ?, ?, ?)",
    [genId(), app.id, whenText, notes, app.email || '', place, when.toISOString().slice(0, 19).replace('T', ' '), byName(req.user)]
  );
  if (app.email) {
    const paragraphs = [
      `We would like to invite you to an interview for your application ${app.ref}.`,
      `When: ${whenText}\nWhere: ${place}`,
      ...(notes ? [`Please bring or prepare: ${notes}`] : []),
      'Please reply to this email if you cannot attend, so we can arrange another time.',
    ];
    const m = renderEmail({ greeting: `Dear ${app.full_name || 'applicant'},`, paragraphs, signoff: SIGN });
    await sendEmail({
      to: app.email, subject: `Interview invitation (${app.ref})`, text: m.text, html: m.html,
      attachments: [{ name: 'RUNHTec-interview.ics', content: icsFor(app, when, place, notes) }],
    });
  }
  res.json({ ok: true, when: whenText });
});

// Reminder the day before each interview (called from the background jobs every 30 minutes).
async function sendInterviewReminders() {
  const [rows] = await pool.query(
    `SELECT e.id, e.place, DATE_FORMAT(e.scheduled_for, '%Y-%m-%dT%H:%i:%s') AS sched, a.ref, a.full_name, a.email FROM application_events e
     JOIN job_applications a ON a.id = e.application
     WHERE e.kind = 'interview' AND e.reminder_sent = 0 AND a.email <> ''
       AND e.scheduled_for BETWEEN UTC_TIMESTAMP() + INTERVAL 22 HOUR AND UTC_TIMESTAMP() + INTERVAL 26 HOUR`
  );
  for (const r of rows) {
    const when = new Date(`${r.sched}Z`); // stored as UTC
    const m = renderEmail({
      greeting: `Dear ${r.full_name || 'applicant'},`,
      paragraphs: [`This is a reminder of your interview for application ${r.ref} tomorrow.`, `When: ${kigaliText(when)}\nWhere: ${r.place}`, 'Please arrive a few minutes early. If you cannot attend, reply to this email as soon as possible.'],
      signoff: SIGN,
    });
    await sendEmail({ to: r.email, subject: `Reminder: your interview tomorrow (${r.ref})`, text: m.text, html: m.html }).catch(() => {});
    await pool.query('UPDATE application_events SET reminder_sent = 1 WHERE id = ?', [r.id]);
  }
}

module.exports = router;
module.exports.sendInterviewReminders = sendInterviewReminders;
