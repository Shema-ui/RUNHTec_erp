// Who may open an uploaded file.
//
// A file is served only when the person signed in may see a record that uses
// it — the same rules as the record itself:
//  • staff: the collection's "view" rule (e.g. ID copies → the owner or HR/admin only;
//    CVs → HR and project managers);
//  • clients: only files on their own records that are shared with them;
//  • vendors: only the company logo/signature on documents.
// Files no record uses any more are for the Super Admin and Administrators only.
const pool = require('./db');
const { collections } = require('./collections');
const clientScope = require('./clientScope');

// Where files are kept: [collection, single-file columns, JSON-list columns]
const REFS = [
  ['company_settings', ['logo', 'signature', 'stamp'], []],
  ['clients', ['logo'], []],
  ['client_documents', ['file'], []],
  ['documents', ['file'], []],
  ['project_photos', ['photo'], []],
  ['rfqs', ['voice_note'], ['attachments']],
  ['equipment', [], ['photos']],
  ['contractors', ['cv', 'id_document', 'certificate_file'], []],
  ['job_applications', ['cv', 'certificate_file'], []],
  ['staff_profiles', ['photo', 'id_document'], []],
  ['staff_documents', ['file'], []],
];

// Every record that uses this file, as [collection, record].
async function recordsUsing(fileId) {
  const found = [];
  const like = `%"${String(fileId).replace(/[%_\\"]/g, '')}"%`;
  for (const [name, single, lists] of REFS) {
    const def = collections[name];
    if (!def) continue;
    const where = [...single.map((c) => `\`${c}\` = ?`), ...lists.map((c) => `\`${c}\` LIKE ?`)];
    const params = [...single.map(() => fileId), ...lists.map(() => like)];
    try {
      const [rows] = await pool.query(`SELECT * FROM \`${def.table}\` WHERE ${where.join(' OR ')} LIMIT 20`, params);
      rows.forEach((r) => found.push([name, r]));
    } catch (_) { /* a column that doesn't exist yet: skip */ }
  }
  return found;
}

// Pages show many photos at once: remember "yes" answers for 10 minutes.
const allowed = new Map();
const TTL = 10 * 60 * 1000;

async function canOpenFile(user, fileId) {
  if (!user || !fileId) return false;
  const key = `${user.id}:${user.role}:${fileId}`;
  const hit = allowed.get(key);
  if (hit && Date.now() - hit < TTL) return true;
  const ok = await decide(user, fileId);
  if (ok) {
    if (allowed.size > 5000) allowed.clear();
    allowed.set(key, Date.now());
  }
  return ok;
}

async function decide(user, fileId) {
  const uses = await recordsUsing(fileId);
  if (!uses.length) return ['super_admin', 'admin'].includes(user.role);

  if (user.role === 'client') {
    const ctx = await clientScope.clientContext(user);
    return uses.some(([name, r]) => {
      // Their own service requests (photos and voice notes they sent).
      if (name === 'rfqs') return r.client && r.client === user.client;
      if (name === 'equipment') return r.client && r.client === user.client;
      return clientScope.READABLE.has(name) && clientScope.visible(name, r, user, ctx);
    });
  }
  if (user.role === 'vendor') return uses.some(([name]) => name === 'company_settings');

  return uses.some(([name, r]) => {
    const view = collections[name]?.rules?.view;
    try { return typeof view === 'function' ? Boolean(view(user, r)) : false; } catch (_) { return false; }
  });
}

module.exports = { canOpenFile, recordsUsing, REFS };
