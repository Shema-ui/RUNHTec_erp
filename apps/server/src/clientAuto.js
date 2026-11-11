// Every client named on a quotation or invoice ends up in the CRM.
//
// findOrCreateClient looks for the client by company name, then by the
// contact's email, then by phone. Only when nobody matches is a new client
// added (with the contact person), numbered like the CRM form: RHT-2026-0001.
const pool = require('./db');
const { genId } = require('./idGen');

const clean = (v, n = 200) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, n);
const digits = (v) => String(v || '').replace(/\D/g, '');

async function nextClientNumber() {
  const [cnt] = await pool.query('SELECT COUNT(*) AS n FROM clients');
  const year = new Date().getFullYear();
  let n = Number(cnt[0].n) + 1;
  // never reuse a number that exists already
  for (;;) {
    const id = `RHT-${year}-${String(n).padStart(4, '0')}`;
    const [x] = await pool.query('SELECT id FROM clients WHERE client_id = ? LIMIT 1', [id]);
    if (!x[0]) return id;
    n += 1;
  }
}

// { company, name, email, phone, address, status } → { id, created }
async function findOrCreateClient({ company, name, email, phone, address, status = 'lead' }) {
  const title = clean(company) || clean(name);
  if (title.length < 2) return null;
  const [byName] = await pool.query('SELECT id FROM clients WHERE LOWER(TRIM(company_name)) = LOWER(?) OR LOWER(TRIM(trading_name)) = LOWER(?) LIMIT 1', [title, title]);
  if (byName[0]) return { id: byName[0].id, created: false };
  const mail = clean(email, 190).toLowerCase();
  if (mail && /@/.test(mail)) {
    const [byMail] = await pool.query('SELECT client FROM client_contacts WHERE LOWER(email) = ? AND client IS NOT NULL LIMIT 1', [mail]);
    if (byMail[0]) return { id: byMail[0].client, created: false };
  }
  const tel = digits(phone);
  if (tel.length >= 9) {
    const [contacts] = await pool.query('SELECT client, mobile, whatsapp FROM client_contacts WHERE client IS NOT NULL AND (mobile <> \'\' OR whatsapp <> \'\')');
    const hit = contacts.find((c) => [c.mobile, c.whatsapp].some((p) => digits(p) && digits(p).slice(-9) === tel.slice(-9)));
    if (hit) return { id: hit.client, created: false };
  }
  const id = genId();
  await pool.query(
    "INSERT INTO clients (id, client_id, company_name, status, street, country) VALUES (?, ?, ?, ?, ?, 'Rwanda')",
    [id, await nextClientNumber(), title, ['lead', 'active'].includes(status) ? status : 'lead', clean(address, 250)]
  );
  const person = clean(name) || title;
  if (person || mail || tel) {
    await pool.query('INSERT INTO client_contacts (id, client, full_name, mobile, whatsapp, email, is_primary) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [genId(), id, person, clean(phone, 40), clean(phone, 40), mail]);
  }
  return { id, created: true };
}

// After a quotation/invoice is saved without a CRM client: link (or add) one.
// Returns the client id it linked, or null.
async function linkDocumentClient(table, doc) {
  if (!doc || doc.client) return null;
  const r = await findOrCreateClient({
    company: doc.bill_to_company, name: doc.bill_to_name, email: doc.bill_to_email, phone: doc.bill_to_phone, address: doc.bill_to_address,
    status: table === 'invoices' || doc.status === 'accepted' ? 'active' : 'lead',
  });
  if (!r) return null;
  await pool.query(`UPDATE \`${table}\` SET client = ? WHERE id = ?`, [r.id, doc.id]);
  if (r.created) {
    try {
      await pool.query("INSERT INTO client_activities (id, client, type, description, actor_name, created) VALUES (?, ?, 'other', ?, 'RUNHTec ERP', NOW())",
        [genId(), r.id, `Added to the CRM automatically from ${table === 'invoices' ? `invoice ${doc.invoice_number || ''}` : `quotation ${doc.number || ''}`}`.trim()]);
    } catch (_) { /* activity log is optional */ }
  }
  return r.id;
}

module.exports = { findOrCreateClient, linkDocumentClient };
