const bcrypt = require('bcryptjs');
const db = require('../../src/config/db');
const runMigrations = require('../migrations/migrate');

async function seed() {
  console.log('🌱 Checking database status & ensuring initial schema...');
  await runMigrations();

  // 1. Ensure Authorized Root Administrator ('fromex') exists
  const existingUsers = await db.query("SELECT COUNT(*) as count FROM users WHERE username = 'fromex'");
  const userCount = parseInt(existingUsers.rows[0].count, 10);

  if (userCount === 0) {
    const devPassword = 'fromex123';
    const passwordHash = await bcrypt.hash(devPassword, 10);

    await db.query(
      'INSERT INTO users (name, username, password_hash, role, status) VALUES ($1, $2, $3, $4, $5)',
      ['FROMEX', 'fromex', passwordHash, 'Admin', 'Active']
    );
    console.log('✅ Initialized root administrator account: "fromex" (Role: Admin).');
  }

  // Ready for fresh first start: Employees, Attendance, Salaries, and Transactions
  // are kept empty so the company starts fresh with only user-created records.
  console.log('✨ Fresh company database ready (Clean slate - no dummy demo data).');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}

module.exports = seed;
