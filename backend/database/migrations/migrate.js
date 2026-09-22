const fs = require('fs');
const path = require('path');
const db = require('../../src/config/db');

async function runMigrations() {
  console.log('🔄 Running PostgreSQL database migrations...');
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await db.exec(sql);
      console.log(`  ✅ Applied migration: ${file}`);
    } catch (err) {
      if (err.code === '23505' || (err.message && err.message.includes('already exists'))) {
        console.log(`  ℹ️ Migration already applied or objects exist: ${file}`);
      } else {
        console.error(`  ❌ Failed applying migration: ${file}`, err);
        throw err;
      }
    }
  }

  console.log('✅ All PostgreSQL schema migrations applied successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runMigrations;
