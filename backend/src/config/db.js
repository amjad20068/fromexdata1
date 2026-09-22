const { Pool } = require('pg');
const { PGlite } = require('@electric-sql/pglite');
const path = require('path');
const fs = require('fs');
const config = require('./env');

let pool = null;
let pgliteInstance = null;
let isEmbedded = false;

async function initDb() {
  // First attempt: try connecting to external PostgreSQL if DATABASE_URL is configured
  if (config.databaseUrl) {
    try {
      const testPool = new Pool({
        connectionString: config.databaseUrl,
        connectionTimeoutMillis: 1500
      });
      // Test quick query
      await testPool.query('SELECT 1');
      console.log('✅ Connected to external PostgreSQL database at:', config.databaseUrl.replace(/:[^:@]+@/, ':****@'));
      pool = testPool;
      return;
    } catch (err) {
      console.log('ℹ️ External PostgreSQL not available at DATABASE_URL (' + err.message + ').');
      console.log('⚡ Initializing embedded persistent PostgreSQL (PGlite) engine...');
    }
  }

  // Fallback: embedded real PostgreSQL engine with persistent disk storage
  const storageDir = path.join(__dirname, '..', '..', '..', 'data', 'postgres');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  } else {
    // Clean up stale postmaster.pid from unexpected process crashes
    const pidFile = path.join(storageDir, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      try {
        fs.unlinkSync(pidFile);
        console.log('🧹 Cleaned up stale PostgreSQL postmaster.pid file.');
      } catch (e) {}
    }
  }

  pgliteInstance = new PGlite(storageDir);
  isEmbedded = true;
  console.log('✅ Connected to embedded persistent PostgreSQL database in:', storageDir);
}

const db = {
  isEmbedded: () => isEmbedded,

  async query(text, params = []) {
    if (!pool && !pgliteInstance) {
      await initDb();
    }

    if (pool) {
      const res = await pool.query(text, params);
      return res;
    } else {
      const res = await pgliteInstance.query(text, params);
      return {
        rows: res.rows,
        rowCount: res.rows.length,
        fields: res.fields
      };
    }
  },

  async exec(sql) {
    if (!pool && !pgliteInstance) {
      await initDb();
    }

    if (pool) {
      return pool.query(sql);
    } else {
      return pgliteInstance.exec(sql);
    }
  },

  async close() {
    if (pool) {
      await pool.end();
    }
    if (pgliteInstance) {
      await pgliteInstance.close();
    }
  }
};

module.exports = db;
