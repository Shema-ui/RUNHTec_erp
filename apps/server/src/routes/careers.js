// Public endpoint for the website's "Work with us" form. Applicants become
// job_applications in the ERP for HR to review. No login required, so it is
// rate limited, size limited and only accepts document/image uploads.

const express = require('express');
const multer = require('multer');
const pool = require('../db');
const { genId } = require('../idGen');
const { storeFile } = require('../files');
const { notifyRoles } = require('../notify');
const { sendEmail } = require('../mailer');
const { issueTempPassword, TEMP_HOURS } = require('../staffAccess');
const { requireAuth } = require('../auth');

const router = express.Router();

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2, fields: 40 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_TYPES.has(file.mimetype)),
});

const DEPARTMENTS = ['administration', 'finance', 'hr', 'sales', 'procurement', 'projects', 'technical', 'inspection', 'ict'];
const RATE_UNITS = ['per_day', 'per_hour', 'per_project', 'per_month'];

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const APP_URL = process.env.APP_URL || 'https://erp.runhteccontractors.si';

// Emails sent after a successful application. Never blocks or fails the request.
async function sendApplicationEmails({ ref, updated, data }) {
  const { renderEmail } = require('../emailLayout');
  const verb = updated ? 'updated' : 'received';
  try {
    if (data.email) {
      const m = renderEmail({
        greeting: `Dear ${data.full_name},`,
        paragraphs: [
          `Thank you for applying to work with RUNHTec Contractors Ltd. We have ${verb} your application. Your reference number is ${ref}.`,
          'RUNHTec engages technical professionals on a project and contract basis. Registering with us does not guarantee work. When a project matches your skills, our HR team will contact you on the phone number or email address you provided.',
          'Please keep your reference number for any follow-up.',
        ],
        closing: ['If you have a question, reply to this email or WhatsApp us on +250 793 229 790.'],
        signoff: 'Kind regards,\nHuman Resources, RUNHTec Contractors Ltd',
      });
      await sendEmail({ to: data.email, subject: `Your application to RUNHTec Contractors (ref ${ref})`, text: m.text, html: m.html });
    }
    const [hr] = await pool.query(
      "SELECT email FROM users WHERE status = 'active' AND role IN ('hr','super_admin','admin') AND email IS NOT NULL AND email <> ''"
    );
    const to = hr.map((u) => u.email);
    if (to.length) {
      const m = renderEmail({
        greeting: 'Hello HR team,',
        paragraphs: [`A ${verb === 'received' ? 'new' : 'updated'} contractor application has been submitted through the website.`],
        details: [
          ['Reference', ref],
          ['Name', data.full_name],
          ['Main skill', data.trade],
          ['Department', data.department],
          ['Country', data.country || '-'],
          ['Phone', data.phone || '-'],
          ['Email', data.email || '-'],
          ...(data.campaign ? [['Source', data.campaign]] : []),
        ],
        button: { label: 'Review in the ERP', url: APP_URL },
        signoff: 'RUNHTec ERP',
      });
      await sendEmail({ to, subject: `New application ${ref}: ${data.full_name} (${data.trade})`, text: m.text, html: m.html });
    }
  } catch (err) {
    console.error('career emails failed:', err.message);
  }
}

const clip = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const yes = (v) => ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());

router.post('/apply', (req, res, next) => {
  upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'certificate', maxCount: 1 }])(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 5 MB or smaller.' : 'The upload could not be read. Please try again.';
      return res.status(400).json({ message: msg });
    }
    next();
  });
}, async (req, res) => {
  const b = req.body || {};
  if (b._honey) return res.status(200).json({ success: true, ref: 'APP-RECEIVED' });

  const data = {
    full_name: clip(b.full_name, 200),
    email: clip(b.email, 190).toLowerCase(),
    phone: clip(b.phone, 40),
    whatsapp: clip(b.whatsapp, 40),
    country: clip(b.country, 80),
    city: clip(b.city, 80),
    department: DEPARTMENTS.includes(b.department) ? b.department : 'technical',
    trade: clip(b.trade, 60),
    other_skills: clip(b.other_skills, 1000),
    experience_years: Math.max(0, Math.min(60, parseInt(b.experience_years, 10) || 0)),
    qualifications: clip(b.qualifications, 1000),
    certifications: clip(b.certifications, 1000),
    previous_projects: clip(b.previous_projects, 3000),
    availability: clip(b.availability, 60),
    expected_rate: clip(b.expected_rate, 60),
    rate_unit: RATE_UNITS.includes(b.rate_unit) ? b.rate_unit : 'per_day',
    has_tools: yes(b.has_tools) ? 1 : 0,
    has_transport: yes(b.has_transport) ? 1 : 0,
    campaign: clip(b.campaign, 255),
  };

  if (!data.full_name || !data.phone || !data.trade) {
    return res.status(400).json({ message: 'Please give your full name, phone number and main skill.' });
  }
  if (data.email && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(data.email)) {
    return res.status(400).json({ message: 'Please give a valid email address.' });
  }
  if (!yes(b.consent)) {
    return res.status(400).json({ message: 'Please confirm you understand the per-project contract terms.' });
  }


  try {
    const cvFile = req.files?.cv?.[0];
    const certFile = req.files?.certificate?.[0];
    if (cvFile) data.cv = await storeFile(cvFile);
    if (certFile) data.certificate_file = await storeFile(certFile);

    // Someone re-applying while their earlier application is still open:
    // update that application instead of creating a duplicate.
    let existing = null;
    const match = data.email || data.phone;
    if (match) {
      const [rows] = await pool.query(
        `SELECT id, ref FROM job_applications WHERE (${data.email ? 'email = ?' : 'phone = ?'}) AND status IN ('new','shortlisted','interview','on_hold') ORDER BY created DESC LIMIT 1`,
        [match]
      );
      existing = rows[0] || null;
    }

    let ref;
    if (existing) {
      ref = existing.ref;
      const cols = Object.keys(data);
      await pool.query(
        `UPDATE job_applications SET ${cols.map((c) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
        [...cols.map((c) => data[c]), existing.id]
      );
    } else {
      const year = new Date().getFullYear();
      const [countRows] = await pool.query('SELECT COUNT(*) AS n FROM job_applications WHERE ref LIKE ?', [`APP-${year}-%`]);
      ref = `APP-${year}-${String(countRows[0].n + 1).padStart(4, '0')}`;
      const row = { id: genId(), ref, status: 'new', ...data };
      const cols = Object.keys(row);
      await pool.query(
        `INSERT INTO job_applications (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        cols.map((c) => row[c])
      );
    }

    await notifyRoles(['hr', 'super_admin', 'admin'], 'application',
      `${existing ? 'Updated' : 'New'} contractor application ${ref}: ${data.full_name} (${data.trade})`);

    sendApplicationEmails({ ref, updated: Boolean(existing), data });
    res.status(200).json({ success: true, ref, updated: Boolean(existing) });
  } catch (err) {
    console.error('careers apply error:', err);
    res.status(500).json({ message: 'Something went wrong. Please try again or contact us on WhatsApp.' });
  }
});

// Admin creates a new temporary password for an approved applicant and gets it back once,
// to send on WhatsApp. It is stored only in hashed form.
router.post('/applications/:id/staff-password', requireAuth, async (req, res) => {
  if (!['super_admin', 'admin', 'hr'].includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  try {
    const [rows] = await pool.query('SELECT id, ref, full_name, email, phone, status FROM job_applications WHERE id = ?', [req.params.id]);
    const app = rows[0];
    if (!app) return res.status(404).json({ message: 'Application not found.' });
    if (app.status !== 'approved') return res.status(400).json({ message: 'Approve the application first.' });
    if (!app.email) return res.status(400).json({ message: 'This applicant has no email address on the application.' });
    const issued = await issueTempPassword(app.email);
    if (!issued) return res.status(400).json({ message: 'No staff account exists for this applicant yet. Re-approve or contact the system administrator.' });
    const digits = String(app.phone || '').replace(/\D/g, '');
    res.json({
      email: app.email,
      password: issued.password,
      expires: issued.expires,
      hours: TEMP_HOURS,
      whatsapp: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(`RUNHTec staff sign-in. Email: ${app.email} Password: ${issued.password} (valid ${TEMP_HOURS} hours). Sign in through your private staff link, then change your password from Forgot password.`)}` : '',
    });
  } catch (err) {
    console.error('staff password error:', err);
    res.status(500).json({ message: 'Could not create the password. Please try again.' });
  }
});

module.exports = router;
