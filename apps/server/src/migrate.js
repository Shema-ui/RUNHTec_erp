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

// Widens an ENUM column only when the new value is missing, so existing
// data is untouched and the statement doesn't run on every start.
async function ensureEnumValue(conn, table, column, value, definition) {
  const [rows] = await conn.query(
    'SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  if (rows[0] && !String(rows[0].t).includes(`'${value}'`)) {
    await conn.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${definition}`);
    console.log(`[migrate] widened ${table}.${column}`);
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
    await ensureColumn(conn, 'users', 'department', "VARCHAR(40) DEFAULT ''");
    await ensureEnumValue(conn, 'users', 'role', 'hr',
      "ENUM('super_admin','sales','project_manager','accountant','technician','hr') NOT NULL DEFAULT 'sales'");

    // Projects: full project record (manager, value, progress, priority…)
    for (const [col, def] of [
      ['description', 'TEXT'],
      ['project_manager', 'VARCHAR(20) DEFAULT NULL'],
      ['service_category', "VARCHAR(60) DEFAULT ''"],
      ['value', 'DECIMAL(14,2) DEFAULT 0'],
      ['currency', "VARCHAR(10) DEFAULT 'RWF'"],
      ['progress', 'INT DEFAULT 0'],
      ['priority', "VARCHAR(10) DEFAULT 'medium'"],
      ['completed_date', "VARCHAR(20) DEFAULT ''"],
      ['notes', 'TEXT'],
    ]) await ensureColumn(conn, 'projects', col, def);
    await ensureEnumValue(conn, 'projects', 'status', 'on_hold',
      "ENUM('planning','scheduled','in_progress','on_hold','done','cancelled') NOT NULL DEFAULT 'scheduled'");

    // Traceability: which quotation / project an invoice came from
    await ensureColumn(conn, 'invoices', 'quotation', 'VARCHAR(20) DEFAULT NULL');
    await ensureColumn(conn, 'invoices', 'project', 'VARCHAR(20) DEFAULT NULL');

    // Payments recorded against invoices
    for (const [col, def] of [
      ['invoice', 'VARCHAR(20) DEFAULT NULL'],
      ['method', "VARCHAR(30) DEFAULT ''"],
      ['paid_date', "VARCHAR(20) DEFAULT ''"],
      ['notes', "VARCHAR(1000) DEFAULT ''"],
      ['recorded_by_name', "VARCHAR(200) DEFAULT ''"],
    ]) await ensureColumn(conn, 'payments', col, def);

    // Maintenance contracts: value, period, contractor, notes
    for (const [col, def] of [
      ['contract_value', 'DECIMAL(14,2) DEFAULT 0'],
      ['currency', "VARCHAR(10) DEFAULT 'RWF'"],
      ['start_date', "VARCHAR(20) DEFAULT ''"],
      ['end_date', "VARCHAR(20) DEFAULT ''"],
      ['contractor', 'VARCHAR(20) DEFAULT NULL'],
      ['site', "VARCHAR(300) DEFAULT ''"],
      ['notes', "VARCHAR(2000) DEFAULT ''"],
    ]) await ensureColumn(conn, 'maintenance_contracts', col, def);

    // Documents can belong to a project too
    await ensureColumn(conn, 'documents', 'project', 'VARCHAR(20) DEFAULT NULL');
    await ensureColumn(conn, 'documents', 'notes', "VARCHAR(1000) DEFAULT ''");
    await ensureColumn(conn, 'documents', 'uploaded_by_name', "VARCHAR(200) DEFAULT ''");
  } finally {
    conn.release();
  }
}

module.exports = { runMigrations };
