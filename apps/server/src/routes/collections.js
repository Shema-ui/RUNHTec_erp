const express = require('express');
const multer = require('multer');
const pool = require('./../db');
const { collections, COST_VIEW } = require('../collections');
const { parseFilter } = require('../filterParser');
const { genId } = require('../idGen');
const { requireAuth, bcrypt, MIN_PASSWORD_LENGTH } = require('../auth');
const { writeAuditEntry, summarizeChanges } = require('../audit');
const { storeFile } = require('../files');
const { ensureQuoteForInvoice, syncQuoteFromInvoice, removeQuoteForInvoice } = require('../invoiceQuote');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

const JSON_FIELDS = new Set(['categories', 'services', 'items', 'tasks', 'assigned_technicians', 'attachments', 'photos', 'skills', 'costing', 'labour_rates']);

function deserializeRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const key of Object.keys(out)) {
    if (JSON_FIELDS.has(key) && typeof out[key] === 'string') {
      try { out[key] = JSON.parse(out[key]); } catch (_) { /* leave as-is */ }
    }
    if (typeof out[key] === 'boolean') out[key] = out[key]; // already fine
  }
  return out;
}

function serializeValue(field, value) {
  if (JSON_FIELDS.has(field) && value !== undefined && value !== null && typeof value !== 'string') {
    return JSON.stringify(value);
  }
  return value;
}

// Fields that must never leave the server, keyed by collection. Kept
// separate from `deserializeRow` (which is also used internally for RBAC
// rule checks and audit diffing, where the full row is legitimately
// needed) so this only strips things right before they go out over HTTP.
const SENSITIVE_FIELDS = {
  users: ['password_hash', 'reset_token_hash', 'reset_token_expires', 'tokens_valid_after'],
};

// Internal costing (buying prices, job budgets) — only for staff allowed to
// see profit. Everyone else (technicians, HR) gets the record without it.
const COST_FIELDS = { quotations: ['costing'], invoices: ['costing'], projects: ['cost_budget'], catalog_items: ['buying_price', 'supplier'] };
const ITEM_COST_KEYS = ['cost'];

function stripCosts(collectionName, record) {
  const out = { ...record };
  (COST_FIELDS[collectionName] || []).forEach((f) => delete out[f]);
  if (Array.isArray(out.items) && (collectionName === 'quotations' || collectionName === 'invoices')) {
    out.items = out.items.map((it) => {
      if (!it || typeof it !== 'object') return it;
      const copy = { ...it };
      ITEM_COST_KEYS.forEach((k) => delete copy[k]);
      return copy;
    });
  }
  return out;
}

function toPublic(collectionName, record, user) {
  if (!record) return record;
  let out = record;
  const strip = SENSITIVE_FIELDS[collectionName];
  if (strip) {
    out = { ...out };
    strip.forEach((f) => delete out[f]);
  }
  if (!COST_VIEW(user)) {
    out = stripCosts(collectionName, out);
    if (out.expand) {
      out.expand = Object.fromEntries(Object.entries(out.expand).map(([k, v]) => {
        const rel = collections[collectionName]?.relations?.[k];
        return [k, rel ? stripCosts(rel, v) : v];
      }));
    }
  }
  return out;
}

// A user who can't see costs must not overwrite them either.
function dropCostInput(collectionName, body, user, before) {
  if (COST_VIEW(user)) return;
  (COST_FIELDS[collectionName] || []).forEach((f) => delete body[f]);
  if (Array.isArray(body.items) && before && Array.isArray(before.items)) {
    body.items = body.items.map((it, i) => (it && typeof it === 'object' && before.items[i] && before.items[i].cost !== undefined ? { ...it, cost: before.items[i].cost } : it));
  }
}

// Until a new staff member has completed their profile, they can only reach
// their own profile (and the few things the app shell needs).
const OPEN_BEFORE_PROFILE = new Set(['staff_profiles', 'staff_documents', 'company_settings', 'notifications', 'activity_logs']);
const LEAD_PROJECT_FIELDS = ['tasks', 'progress', 'status', 'completed_date', 'notes'];
const PM_ROLES = ['super_admin', 'admin', 'project_manager'];

function needsProfile(user) {
  return Boolean(user) && user.role !== 'super_admin' && Number(user.profile_completed) !== 1;
}

function collectionMiddleware(req, res, next) {
  const def = collections[req.params.name];
  if (!def) return res.status(404).json({ message: 'Unknown collection.' });
  if (needsProfile(req.user) && !OPEN_BEFORE_PROFILE.has(req.params.name)) {
    return res.status(403).json({ message: 'Please complete your profile first.', code: 'PROFILE_REQUIRED' });
  }
  req.collectionName = req.params.name;
  req.collectionDef = def;
  next();
}

async function expandRecord(def, record, expandParam) {
  if (!expandParam || !record) return record;
  const fields = expandParam.split(',').map((f) => f.trim()).filter(Boolean);
  const expand = {};
  for (const field of fields) {
    const relatedCollection = def.relations?.[field];
    if (!relatedCollection || !record[field]) continue;
    const relatedDef = collections[relatedCollection];
    if (!relatedDef) continue;
    const [rows] = await pool.query(`SELECT * FROM \`${relatedDef.table}\` WHERE id = ?`, [record[field]]);
    if (rows[0]) expand[field] = toPublic(relatedCollection, deserializeRow(rows[0]), { role: 'super_admin' });
  }
  if (Object.keys(expand).length) record.expand = expand;
  return record;
}

// Extracts a plain field->value body from either a JSON request or a
// multipart/form-data request (multer populates req.body with string
// fields and req.files with uploads). Multipart values also come through
// as strings, so JSON-typed columns need re-parsing there too.
function extractBody(req, def) {
  const body = { ...req.body };
  for (const key of Object.keys(body)) {
    if (JSON_FIELDS.has(key) && typeof body[key] === 'string') {
      try { body[key] = JSON.parse(body[key]); } catch (_) { /* leave as string, will fail validation downstream if wrong */ }
    }
    if (body[key] === 'true') body[key] = true;
    if (body[key] === 'false') body[key] = false;
  }
  return body;
}

// Links typed into the ERP are shown as clickable links, so only plain web
// addresses are accepted (a "javascript:" link could run code in a
// colleague's browser when clicked).
function validateBody(body) {
  if (body.website !== undefined && body.website !== null && body.website !== '') {
    const site = String(body.website).trim();
    if (!/^https?:\/\/[^\s<>"']+$/i.test(site)) {
      return 'Website must be a web address starting with http:// or https://';
    }
    body.website = site;
  }
  return null;
}

// GET /api/collections/:name/records
router.get('/:name/records', collectionMiddleware, requireAuth, async (req, res) => {
  const def = req.collectionDef;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(500, Math.max(1, parseInt(req.query.perPage, 10) || 30));

  try {
    let whereSql = '1=1';
    let params = [];
    if (req.query.filter) {
      const parsed = parseFilter(req.query.filter, def.fields);
      whereSql = parsed.sql;
      params = parsed.params;
    }

    let sortSql = '';
    if (req.query.sort) {
      const parts = req.query.sort.split(',').map((s) => s.trim()).filter(Boolean);
      const clauses = parts.map((s) => {
        const desc = s.startsWith('-');
        const field = desc ? s.slice(1) : s;
        if (!def.fields.includes(field)) throw new Error(`Cannot sort by unknown field: ${field}`);
        return `\`${field}\` ${desc ? 'DESC' : 'ASC'}`;
      });
      if (clauses.length) sortSql = `ORDER BY ${clauses.join(', ')}`;
    } else {
      sortSql = 'ORDER BY created DESC';
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM \`${def.table}\` WHERE ${whereSql}`, params);
    const totalItems = countRows[0].total;

    const isFullList = req.query.__fullList === '1';
    const limitSql = isFullList ? '' : `LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`;
    const [rows] = await pool.query(`SELECT * FROM \`${def.table}\` WHERE ${whereSql} ${sortSql} ${limitSql}`, params);

    let items = rows.map(deserializeRow).filter((record) => def.rules.list(req.user, record));

    if (req.query.expand) {
      items = await Promise.all(items.map((item) => expandRecord(def, item, req.query.expand)));
    }

    res.json({
      items: items.map((item) => toPublic(req.collectionName, item, req.user)),
      page,
      perPage,
      totalItems: items.length === rows.length ? totalItems : items.length,
      totalPages: Math.max(1, Math.ceil(totalItems / perPage)),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/collections/:name/records/:id
router.get('/:name/records/:id', collectionMiddleware, requireAuth, async (req, res) => {
  const def = req.collectionDef;
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${def.table}\` WHERE id = ?`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found.' });
    let record = deserializeRow(rows[0]);
    if (!def.rules.view(req.user, record)) return res.status(404).json({ message: 'Not found.' });
    if (req.query.expand) record = await expandRecord(def, record, req.query.expand);
    res.json(toPublic(req.collectionName, record, req.user));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/collections/:name/records
router.post('/:name/records', collectionMiddleware, requireAuth, upload.any(), async (req, res) => {
  const def = req.collectionDef;
  if (!def.rules.create(req.user)) return res.status(403).json({ message: 'Not allowed to create records in this collection.' });

  try {
    const body = extractBody(req, def);
    dropCostInput(req.collectionName, body, req.user, null);
    // Records owned by a person (staff profiles): staff can only create their own.
    if (def.ownerField && !def.ownerAdmin(req.user)) body[def.ownerField] = req.user.id;
    if (req.collectionName === 'catalog_items') body.updated_by_name = req.user.name || req.user.email || '';
    if (req.collectionName === 'project_photos') {
      body.uploaded_by = req.user.id;
      body.uploaded_by_name = req.user.name || req.user.email || '';
      if (['technician', 'lead_technician'].includes(req.user.role)) {
        const [pr] = await pool.query('SELECT assigned_technicians, lead_technician FROM projects WHERE id = ?', [body.project || '']);
        let team = [];
        const raw = pr[0]?.assigned_technicians;
        try { team = Array.isArray(raw) ? raw : (JSON.parse(raw || '[]') || []); } catch (_) { team = []; }
        if (!pr[0] || !(team.includes(req.user.id) || pr[0].lead_technician === req.user.id)) {
          return res.status(403).json({ message: 'You can only add photos to projects you are assigned to.' });
        }
      }
    }
    if (req.collectionName === 'project_costs') {
      body.recorded_by = req.user.id;
      if (req.user.role === 'lead_technician') {
        const [pr] = await pool.query('SELECT lead_technician FROM projects WHERE id = ?', [body.project || '']);
        if (!pr[0] || pr[0].lead_technician !== req.user.id) return res.status(403).json({ message: 'You can only log work on projects you lead.' });
        delete body.paid; // paying people is for the office
      }
    }
    const invalid = validateBody(body);
    if (invalid) return res.status(400).json({ message: invalid });
    const id = genId();
    const columns = ['id'];
    const values = [id];

    if (req.collectionName === 'users' && body.role === 'super_admin') {
      return res.status(400).json({ message: 'There is only one Super Administrator. Give this person the Administrator role instead.' });
    }
    if (req.collectionName === 'users') {
      // Users go through a dedicated path: password hashing, no raw
      // password_hash from the client.
      const { password, passwordConfirm, ...rest } = body;
      if (!password || password !== passwordConfirm) {
        return res.status(400).json({ message: 'Password and confirmation must match.' });
      }
      if (String(password).length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      columns.push('password_hash');
      values.push(passwordHash);
      for (const field of def.fields) {
        if (field === 'id') continue;
        if (rest[field] !== undefined) {
          columns.push(field);
          values.push(serializeValue(field, rest[field]));
        }
      }
    } else {
      for (const field of def.fields) {
        if (field === 'id' || field === 'created' || field === 'updated') continue;
        if (body[field] !== undefined) {
          columns.push(field);
          values.push(serializeValue(field, body[field]));
        }
      }
      if (def.fileFields) {
        for (const field of def.fileFields) {
          const uploaded = (req.files || []).find((f) => f.fieldname === field);
          if (uploaded) {
            const fileId = await storeFile(uploaded);
            columns.push(field);
            values.push(fileId);
          }
        }
      }
    }

    // Contractors get a readable code (CTR-0001…) when none is given.
    if (req.collectionName === 'contractors' && !columns.includes('code')) {
      const [codeRows] = await pool.query("SELECT code FROM contractors WHERE code LIKE 'CTR-%'");
      const max = codeRows.reduce((m, r) => Math.max(m, parseInt(String(r.code).slice(4), 10) || 0), 0);
      columns.push('code');
      values.push(`CTR-${String(max + 1).padStart(4, '0')}`);
    }

    const placeholders = columns.map(() => '?').join(', ');
    await pool.query(`INSERT INTO \`${def.table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`, values);

    let [rows] = await pool.query(`SELECT * FROM \`${def.table}\` WHERE id = ?`, [id]);
    // A new invoice without a quotation also gets one, so it shows on the Quotations page.
    if (req.collectionName === 'invoices' && !rows[0].quotation) {
      await ensureQuoteForInvoice(rows[0]);
      [rows] = await pool.query('SELECT * FROM invoices WHERE id = ?', [id]);
    }
    const record = deserializeRow(rows[0]);
    await writeAuditEntry({ actor: req.user, action: 'Created', collectionName: req.collectionName, record });
    res.status(200).json(toPublic(req.collectionName, record, req.user));
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'A record with that unique value already exists.' });
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/collections/:name/records/:id
router.patch('/:name/records/:id', collectionMiddleware, requireAuth, upload.any(), async (req, res) => {
  const def = req.collectionDef;
  try {
    const [existingRows] = await pool.query(`SELECT * FROM \`${def.table}\` WHERE id = ?`, [req.params.id]);
    if (!existingRows[0]) return res.status(404).json({ message: 'Not found.' });
    const before = deserializeRow(existingRows[0]);

    if (!def.rules.update(req.user, before)) return res.status(403).json({ message: 'Not allowed to update this record.' });

    const body = extractBody(req, def);
    dropCostInput(req.collectionName, body, req.user, before);
    if (req.collectionName === 'users' && body.role === 'super_admin' && before.role !== 'super_admin') {
      return res.status(400).json({ message: 'There is only one Super Administrator. Give this person the Administrator role instead.' });
    }
    if (def.ownerField && !def.ownerAdmin(req.user)) delete body[def.ownerField];
    if (req.collectionName === 'catalog_items') body.updated_by_name = req.user.name || req.user.email || '';
    if (req.collectionName === 'project_photos') { delete body.project; delete body.uploaded_by; delete body.uploaded_by_name; }
    if (req.user.role === 'lead_technician') {
      // A lead technician may only move a project forward on site, not change its money or client.
      if (req.collectionName === 'projects' && !PM_ROLES.includes(req.user.role)) {
        for (const k of Object.keys(body)) if (!LEAD_PROJECT_FIELDS.includes(k)) delete body[k];
      }
      if (req.collectionName === 'project_costs') { delete body.project; delete body.recorded_by; delete body.paid; }
    }
    const invalid = validateBody(body);
    if (invalid) return res.status(400).json({ message: invalid });
    const setClauses = [];
    const values = [];

    if (req.collectionName === 'users' && body.password) {
      if (String(body.password).length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      }
      const passwordHash = await bcrypt.hash(String(body.password), 10);
      setClauses.push('password_hash = ?');
      values.push(passwordHash);
      // A new password signs that user out of every existing session.
      setClauses.push('tokens_valid_after = UTC_TIMESTAMP()');
    }

    for (const field of def.fields) {
      if (['id', 'created', 'updated'].includes(field)) continue;
      if (field === 'password') continue;
      if (body[field] !== undefined) {
        setClauses.push(`\`${field}\` = ?`);
        values.push(serializeValue(field, body[field]));
      }
    }

    if (def.fileFields) {
      for (const field of def.fileFields) {
        const uploaded = (req.files || []).find((f) => f.fieldname === field);
        if (uploaded) {
          const fileId = await storeFile(uploaded);
          setClauses.push(`\`${field}\` = ?`);
          values.push(fileId);
        } else if (body[field] === '') {
          // Explicit removal, matching the frontend's "remove" flow which
          // sends an empty string for the field to clear it.
          setClauses.push(`\`${field}\` = NULL`);
        }
      }
    }

    if (setClauses.length === 0) {
      return res.json(toPublic(req.collectionName, before, req.user));
    }

    values.push(req.params.id);
    await pool.query(`UPDATE \`${def.table}\` SET ${setClauses.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.query(`SELECT * FROM \`${def.table}\` WHERE id = ?`, [req.params.id]);
    if (req.collectionName === 'invoices') await syncQuoteFromInvoice(rows[0]);
    const after = deserializeRow(rows[0]);
    const changes = summarizeChanges(def.watchedFields, before, after);
    await writeAuditEntry({ actor: req.user, action: 'Updated', collectionName: req.collectionName, record: after, changes });
    res.json(toPublic(req.collectionName, after, req.user));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/collections/:name/records/:id
router.delete('/:name/records/:id', collectionMiddleware, requireAuth, async (req, res) => {
  const def = req.collectionDef;
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${def.table}\` WHERE id = ?`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Not found.' });
    const record = deserializeRow(rows[0]);
    if (!def.rules.delete(req.user, record)) return res.status(403).json({ message: 'Not allowed to delete this record.' });

    await pool.query(`DELETE FROM \`${def.table}\` WHERE id = ?`, [req.params.id]);
    // Its automatic quotation goes too (quotations the client actually received stay).
    if (req.collectionName === 'invoices') await removeQuoteForInvoice(req.params.id);
    await writeAuditEntry({ actor: req.user, action: 'Deleted', collectionName: req.collectionName, record });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
