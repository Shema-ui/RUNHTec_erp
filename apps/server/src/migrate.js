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
    return true;
  }
  return false;
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
    await ensureEnumValue(conn, 'users', 'role', 'lead_technician',
      "ENUM('super_admin','sales','project_manager','accountant','technician','lead_technician','hr') NOT NULL DEFAULT 'sales'");
    await ensureEnumValue(conn, 'users', 'role', 'admin',
      "ENUM('super_admin','admin','sales','project_manager','accountant','technician','lead_technician','hr') NOT NULL DEFAULT 'sales'");
    await ensureEnumValue(conn, 'users', 'role', 'client',
      "ENUM('super_admin','admin','sales','project_manager','accountant','technician','lead_technician','hr','client') NOT NULL DEFAULT 'sales'");
    await ensureEnumValue(conn, 'users', 'role', 'vendor',
      "ENUM('super_admin','admin','sales','project_manager','accountant','technician','lead_technician','hr','client','vendor') NOT NULL DEFAULT 'sales'");
    // Vendor portal: which supplier a vendor login belongs to
    await ensureColumn(conn, 'users', 'vendor', 'VARCHAR(20) DEFAULT NULL');

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

    // Internal costing (buying prices, labour/transport estimate) — staff only
    await ensureColumn(conn, 'quotations', 'costing', 'JSON DEFAULT NULL');
    await ensureColumn(conn, 'invoices', 'costing', 'JSON DEFAULT NULL');
    await ensureColumn(conn, 'projects', 'cost_budget', 'DECIMAL(14,2) DEFAULT 0');
    // Daily wage rates per role and the default safety margin, editable in Settings
    await ensureColumn(conn, 'company_settings', 'labour_rates', 'JSON DEFAULT NULL');
    await ensureColumn(conn, 'company_settings', 'default_contingency', 'DECIMAL(5,2) DEFAULT 10');

    // Lead technician of a project (a user account), who logs the crew's days on site
    await ensureColumn(conn, 'projects', 'lead_technician', 'VARCHAR(20) DEFAULT NULL');
    await ensureColumn(conn, 'project_costs', 'recorded_by', 'VARCHAR(20) DEFAULT NULL');

    // Client portal: which client a login belongs to, what is shared, handover sign-off
    await ensureColumn(conn, 'users', 'client', 'VARCHAR(20) DEFAULT NULL');
    // Clients open the portal with a private link (no password): only its hash is stored.
    await ensureColumn(conn, 'users', 'portal_token_hash', 'VARCHAR(64) DEFAULT NULL');
    await ensureColumn(conn, 'users', 'portal_link_at', 'DATETIME NULL');
    await ensureColumn(conn, 'users', 'portal_last_used', 'DATETIME NULL');
    await ensureColumn(conn, 'project_photos', 'shared', 'TINYINT(1) NOT NULL DEFAULT 0');
    await ensureColumn(conn, 'documents', 'share_with_client', 'TINYINT(1) NOT NULL DEFAULT 0');
    await ensureColumn(conn, 'projects', 'handover_confirmed_at', 'DATETIME NULL');
    await ensureColumn(conn, 'projects', 'handover_confirmed_by', "VARCHAR(200) DEFAULT ''");
    await ensureColumn(conn, 'projects', 'handover_note', "VARCHAR(1000) DEFAULT ''");
    await ensureColumn(conn, 'notifications', 'link', "VARCHAR(300) DEFAULT ''");
    await ensureColumn(conn, 'company_settings', 'whatsapp_number', "VARCHAR(40) DEFAULT ''");

    // Invoices also appear as quotations (see invoiceQuote.js)
    await ensureColumn(conn, 'quotations', 'source_invoice', 'VARCHAR(20) DEFAULT NULL');
    const { ensureQuoteForInvoice } = require('./invoiceQuote');
    const [orphans] = await conn.query("SELECT * FROM invoices WHERE quotation IS NULL OR quotation = '' OR quotation NOT IN (SELECT id FROM quotations)");
    for (const inv of orphans) await ensureQuoteForInvoice(inv, conn);
    if (orphans.length) console.log(`[migrate] linked ${orphans.length} invoice(s) to quotations`);

    // Staff profiles: new accounts must complete their profile before using
    // the ERP. Accounts that already existed are not locked out.
    if (await ensureColumn(conn, 'users', 'profile_completed', 'TINYINT(1) NOT NULL DEFAULT 0')) {
      await conn.query('UPDATE users SET profile_completed = 1');
    }
    // Who may upload documents — assigned by the Super Admin. Office staff who
    // could already upload keep that right; technicians start without it.
    if (await ensureColumn(conn, 'users', 'can_upload_documents', 'TINYINT(1) NOT NULL DEFAULT 0')) {
      await conn.query("UPDATE users SET can_upload_documents = 1 WHERE role IN ('project_manager','hr','sales','accountant')");
    }
  } finally {
    conn.release();
  }
}

module.exports = { runMigrations };
