const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const pool = require('./db');

// Cloud MySQL services start with no application database. Create it if it
// doesn't exist yet, using the same credentials as the app.
async function ensureDatabase() {
  const name = process.env.DB_NAME;
  if (!name || !/^[A-Za-z0-9_]+$/.test(name)) return;
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: pool.sslOptions(),
  });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${name}\``);
  } finally {
    await conn.end();
  }
}

// Adds a column only if it is missing, so it is safe to run on every start.
async function ensureColumn(conn, table, column, definition) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  if (rows[0].n === 0) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`[migrate] added ${table}.${column}`);
  }
}

async function runMigrations() {
  await ensureDatabase();
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
    await ensureColumn(conn, 'users', 'tokens_valid_after', 'DATETIME NULL');
  } finally {
    conn.release();
  }
}

module.exports = { runMigrations };
