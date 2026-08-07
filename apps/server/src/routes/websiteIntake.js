// Direct port of apps/pocketbase/pb_hooks/website-intake.pb.js — same
// dedupe-by-email-then-company logic, same three request types, same
// client_activities logging — just against MySQL instead of PocketBase's
// record API. No auth required: this is the public form-submission
// endpoint the marketing site posts to.

const express = require('express');
const pool = require('../db');
const { genId } = require('../idGen');

const router = express.Router();

router.post('/', async (req, res) => {
  const payload = req.body || {};
  const source = String(payload.source || 'website').toLowerCase();
  const type = String(payload.type || 'contact').toLowerCase();
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const phone = String(payload.phone || '').trim();
  const company = String(payload.company || '').trim();
  const message = String(payload.message || '').trim();
  const serviceType = String(payload.serviceType || payload.service_type || '').trim();
  const urgency = String(payload.urgency || '').trim();

  if (!name && !email && !message) {
    return res.status(400).json({ message: 'Missing submission data' });
  }

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
        [clientId, company || name, company || name, 'lead', 'website', payload.city || '', payload.country || '', payload.website || '']
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
        serviceType || payload.service || defaultServiceType,
        urgency || payload.urgency || (requestType === 'contact_enquiry' ? '' : 'medium'),
        payload.budget || '',
        payload.address || '',
        message || payload.description || defaultDescription,
        source === 'website' ? 'website' : 'manual',
        requestType,
        clientId,
      ]
    );

    await pool.query(
      'INSERT INTO client_activities (id, client, type, description, actor_name, created) VALUES (?, ?, ?, ?, ?, NOW())',
      [genId(), clientId, 'other', `Website ${type} submitted by ${name || email || company}`, 'Website']
    );

    res.status(200).json({ success: true, message: 'Submission received', type });
  } catch (err) {
    console.error('website-intake error:', err);
    res.status(500).json({ message: 'Something went wrong processing this submission.' });
  }
});

module.exports = router;
