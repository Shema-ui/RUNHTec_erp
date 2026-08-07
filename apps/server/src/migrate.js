const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function runMigrations() {
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const conn = await pool.getConnection();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
      // Split on semicolons that end a statement. Simple and safe here
      // because these migration files contain plain CREATE TABLE
      // statements with no semicolons inside string literals.
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const statement of statements) {
        await conn.query(statement);
      }
      console.log(`[migrate] applied ${file}`);
    }
  } finally {
    conn.release();
  }
}

module.exports = { runMigrations };
