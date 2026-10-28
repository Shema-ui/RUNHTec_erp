const mysql = require('mysql2/promise');

// Cloud MySQL services (TiDB Cloud, Aiven, PlanetScale-style hosts) require
// an encrypted (TLS) connection. Set DB_SSL=true to turn it on. If the
// provider uses its own certificate authority, paste its CA certificate
// (PEM text) into DB_SSL_CA; otherwise the system's trusted CAs are used.
// Leave DB_SSL unset for a local MySQL or one on the same server.
function sslOptions() {
  if (String(process.env.DB_SSL || '').toLowerCase() !== 'true') return undefined;
  const ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  if (process.env.DB_SSL_CA) ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n');
  return ssl;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: sslOptions(),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  namedPlaceholders: true,
  dateStrings: true,
  enableKeepAlive: true,
});

module.exports = pool;
module.exports.sslOptions = sslOptions;
