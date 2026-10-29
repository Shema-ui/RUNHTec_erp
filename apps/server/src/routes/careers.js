// Public endpoint for the website's "Work with us" form. Applicants become
// job_applications in the ERP for HR to review. No login required, so it is
// rate limited, size limited and only accepts document/image uploads.

const express = require('express');
const multer = require('multer');
const pool = require('../db');
const { genId } = require('../idGen');
const { storeFile } = require('../files');
const { createLimiter } = require('../rateLimit');
const { notifyRoles } = require('../notify');

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

const perIp = createLimiter({ windowMs: 60 * 60 * 1000, max: 4 });
const perDay = createLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 150 });

const DEPARTMENTS = ['administration', 'finance', 'hr', 'sales', 'procurement', 'projects', 'technical', 'inspection', 'ict'];
const RATE_UNITS = ['per_day', 'per_hour', 'per_project', 'per_month'];

const clip = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const yes = (v) => ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());

router.post('/apply', (req, res, next) => {
  if (perIp.isBlocked(req.ip) || perDay.isBlocked('all')) {
    return res.status(429).json({ message: 'Too many applications from this connection. Please try again later.' });
  }
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

  perIp.hit(req.ip);
  perDay.hit('all');

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

    await notifyRoles(['hr', 'super_admin'], 'application',
      `${existing ? 'Updated' : 'New'} contractor application ${ref}: ${data.full_name} (${data.trade})`);

    res.status(200).json({ success: true, ref, updated: Boolean(existing) });
  } catch (err) {
    console.error('careers apply error:', err);
    res.status(500).json({ message: 'Something went wrong. Please try again or contact us on WhatsApp.' });
  }
});

module.exports = router;
