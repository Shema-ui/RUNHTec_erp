// Direct port of apps/pocketbase/pb_hooks/website-intake.pb.js — same
// dedupe-by-email-then-company logic, same three request types, same
// client_activities logging — just against MySQL instead of PocketBase's
// record API. No auth required: this is the public form-submission
// endpoint the marketing site posts to.

const express = require('express');
const pool = require('../db');
const { genId } = require('../idGen');
const { createLimiter } = require('../rateLimit');
const { notifyRoles } = require('../notify');

const router = express.Router();

// This endpoint is public (the website posts to it), so it is limited to
// stop anyone flooding the ERP with fake requests.
const perIp = createLimiter({ windowMs: 10 * 60 * 1000, max: 5 });
const perDay = createLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 300 });

// Trim a value and cap its length so nothing oversized is stored.
const clip = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

router.post('/', async (req, res) => {
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  if (perIp.isBlocked(req.ip) || perDay.isBlocked('all')) {
    return res.status(429).json({ message: 'Too many requests. Please try again later or contact us on WhatsApp.' });
  }
  // Hidden "honeypot" field: real visitors leave it empty, spam bots fill it.
  if (payload._honey || payload.website_url) return res.status(200).json({ success: true, message: 'Submission received' });

  const source = clip(payload.source || 'website', 20).toLowerCase();
  const type = clip(payload.type || 'contact', 20).toLowerCase();
  const name = clip(payload.name, 120);
  const email = clip(payload.email, 160).toLowerCase();
  const phone = clip(payload.phone, 40);
  const company = clip(payload.company, 160);
  const message = clip(payload.message, 4000);
  const serviceType = clip(payload.serviceType || payload.service_type, 120);
  const urgencyRaw = clip(payload.urgency, 10).toLowerCase();
  const urgency = ['low', 'medium', 'high'].includes(urgencyRaw) ? urgencyRaw : '';
  const city = clip(payload.city, 80);
  const country = clip(payload.country, 80);
  const address = clip(payload.address, 255);

  if (!name || (!email && !phone) || !message) {
    return res.status(400).json({ message: 'Please give your name, a phone number or email, and a message.' });
  }
  if (email && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) {
    return res.status(400).json({ message: 'Please give a valid email address.' });
  }
  perIp.hit(req.ip);
  perDay.hit('all');

  try {
    let clientId = null;

    // Dedupe: existing contact with this email -> use its client. `clients`
    // has no `email` column of its own (contact emails live on
    // client_contacts), same as the schema this ports from.
    if (email) {
      const [contactRows] = await pool.query('SELECT client FROM client_contacts WHERE email = ? LIMIT 1', [email]);
      if (contactRows[0]) clientId = contactRows[0].client;
    }
    // Fallback: existing client with this company name.
    if (!clientId && company) {
      const [clientRows] = await pool.query('SELECT id FROM clients WHERE company_name = ? LIMIT 1', [company]);
      if (clientRows[0]) clientId = clientRows[0].id;
    }

    if (!clientId) {
      clientId = genId();
      await pool.query(
        'INSERT INTO clients (id, company_name, trading_name, status, industry, city, country, website, potential_value, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())',
        // Website is left empty: a link typed by the public is never stored as a clickable link.
        [clientId, company || name, company || name, 'lead', 'website', city, country, '']
      );
    }

    if (email) {
      const [existingContact] = await pool.query('SELECT id FROM client_contacts WHERE email = ? LIMIT 1', [email]);
      if (!existingContact[0]) {
        await pool.query(
          'INSERT INTO client_contacts (id, client, full_name, email, mobile, position, is_primary, created) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())',
          [genId(), clientId, name || company, email, phone, 'Website Inquiry']
        );
      }
    }

    let requestType = 'contact_enquiry';
    let defaultServiceType = 'General enquiry';
    let defaultDescription = 'Website enquiry';
    if (type === 'quote' || type === 'quotation' || payload.request_type === 'quote') {
      requestType = 'quote_request';
      defaultServiceType = 'General inquiry';
      defaultDescription = 'Website submission';
    } else if (type === 'service' || type === 'request' || payload.request_type === 'service') {
      requestType = 'service_request';
      defaultServiceType = 'Service request';
      defaultDescription = 'Service request from website';
    }

    await pool.query(
      `INSERT INTO rfqs (id, name, company, email, phone, service_type, urgency, budget, address, description, status, source, request_type, request_status, client, created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, 'new', ?, NOW())`,
      [
        genId(),
        name || company || 'Website request',
        company || name,
        email,
        phone,
        serviceType || defaultServiceType,
        urgency || (requestType === 'contact_enquiry' ? '' : 'medium'),
        clip(payload.budget, 60),
        address,
        message || defaultDescription,
        source === 'website' ? 'website' : 'manual',
        requestType,
        clientId,
      ]
    );

    await pool.query(
      'INSERT INTO client_activities (id, client, type, description, actor_name, created) VALUES (?, ?, ?, ?, ?, NOW())',
      [genId(), clientId, 'other', `Website ${type} submitted by ${name || email || company}`, 'Website']
    );

    await notifyRoles(['sales', 'super_admin'], 'rfq', `New website ${requestType === 'quote_request' ? 'quote request' : requestType === 'service_request' ? 'site-visit / service request' : 'enquiry'} from ${name}${company ? ` (${company})` : ''}`);
    res.status(200).json({ success: true, message: 'Submission received', type });
  } catch (err) {
    console.error('website-intake error:', err);
    res.status(500).json({ message: 'Something went wrong processing this submission.' });
  }
});

module.exports = router;
