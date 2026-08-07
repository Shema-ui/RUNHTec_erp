const express = require('express');
const multer = require('multer');
const pool = require('./../db');
const { collections } = require('../collections');
const { parseFilter } = require('../filterParser');
const { genId } = require('../idGen');
const { requireAuth, bcrypt } = require('../auth');
const { writeAuditEntry, summarizeChanges } = require('../audit');
const { storeFile } = require('../files');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

const JSON_FIELDS = new Set(['categories', 'services', 'items', 'tasks', 'assigned_technicians', 'attachments', 'photos', 'skills']);

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

function collectionMiddleware(req, res, next) {
  const def = collections[req.params.name];
  if (!def) return res.status(404).json({ message: 'Unknown collection.' });
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
    if (rows[0]) expand[field] = deserializeRow(rows[0]);
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
      items,
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
    res.json(record);
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
    const id = genId();
    const columns = ['id'];
    const values = [id];

    if (req.collectionName === 'users') {
      // Users go through a dedicated path: password hashing, no raw
      // password_hash from the client.
      const { password, passwordConfirm, ...rest } = body;
      if (!password || password !== passwordConfirm) {
        return res.status(400).json({ message: 'Password and confirmation must match.' });
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

    const placeholders = columns.map(() => '?').join(', ');
    await pool.query(`INSERT INTO \`${def.table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`, values);

    const [rows] = await pool.query(`SELECT * FROM \`${def.table}\` WHERE id = ?`, [id]);
    const record = deserializeRow(rows[0]);
    await writeAuditEntry({ actor: req.user, action: 'Created', collectionName: req.collectionName, record });
    res.status(200).json(record);
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
    const setClauses = [];
    const values = [];

    if (req.collectionName === 'users' && body.password) {
      const passwordHash = await bcrypt.hash(body.password, 10);
      setClauses.push('password_hash = ?');
      values.push(passwordHash);
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
      return res.json(before);
    }

    values.push(req.params.id);
    await pool.query(`UPDATE \`${def.table}\` SET ${setClauses.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.query(`SELECT * FROM \`${def.table}\` WHERE id = ?`, [req.params.id]);
    const after = deserializeRow(rows[0]);
    const changes = summarizeChanges(def.watchedFields, before, after);
    await writeAuditEntry({ actor: req.user, action: 'Updated', collectionName: req.collectionName, record: after, changes });
    res.json(after);
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
    await writeAuditEntry({ actor: req.user, action: 'Deleted', collectionName: req.collectionName, record });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
