// backend/scripts/set_admin_super.js
// Idempotent script to set Admin.username='admin' role='superadmin' and show result
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Ensure DB credentials are strings (prevents pg SASL errors when values are undefined or non-strings)
if (typeof process.env.DB_PASSWORD !== 'undefined' && typeof process.env.DB_PASSWORD !== 'string') {
  process.env.DB_PASSWORD = String(process.env.DB_PASSWORD);
}

const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
  });

  try {
    console.log("Connecting to Postgres...");
    await pool.query("SELECT 1");

    // Ensure schema has required columns (idempotent)
    try {
      await pool.query(`ALTER TABLE admin ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin'`);
      await pool.query(`ALTER TABLE guru ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`);
      console.log('✅ Ensured admin.role and guru.is_admin columns exist (if supported by server)');
    } catch (alterErr) {
      console.warn('⚠️ Could not run ALTER TABLEs (ignored):', alterErr.message);
    }

    const updateRes = await pool.query("UPDATE admin SET role = 'superadmin' WHERE username = $1", ['admin']);
    console.log('UPDATE result rowCount =', updateRes.rowCount);

    const selectRes = await pool.query("SELECT id_admin, username, role FROM admin WHERE username = $1", ['admin']);
    console.log('Admin row:', selectRes.rows);
  } catch (err) {
    console.error('Error running update:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
