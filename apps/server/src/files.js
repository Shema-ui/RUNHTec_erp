// Uploaded files (logo, signature, stamp, client/project documents) are
// stored as BLOBs in MySQL rather than on local disk. This is a deliberate
// choice for Hostinger shared hosting: MySQL databases are the one
// explicitly persistent, officially-supported storage layer there, while
// the Node app's own deploy directory may be replaced wholesale on each
// redeploy. Small business-document volumes make this a reasonable trade.

const pool = require('./db');
const { genId } = require('./idGen');

async function storeFile(uploadedFile) {
  const id = genId();
  await pool.query(
    'INSERT INTO files (id, filename, mimetype, size, data, created) VALUES (?, ?, ?, ?, ?, NOW())',
    [id, uploadedFile.originalname, uploadedFile.mimetype, uploadedFile.size, uploadedFile.buffer]
  );
  return id;
}

async function getFile(id) {
  const [rows] = await pool.query('SELECT filename, mimetype, size, data FROM files WHERE id = ?', [id]);
  return rows[0] || null;
}

module.exports = { storeFile, getFile };
