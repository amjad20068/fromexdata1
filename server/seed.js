const db = require('./db');

function seed() {
  console.log('🌱 Checking SQLite database status...');

  // Ensure 'fromex' root admin user exists
  const existingUser = db.prepare("SELECT COUNT(*) as count FROM users WHERE username = 'fromex'").get();
  if (existingUser.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (username, email, password, name, role, avatar, token)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      'fromex',
      'admin@fromex.com',
      'fromex123',
      'FROMEX',
      'Managing Director (Admin)',
      'FX',
      'token-fromex-admin'
    );
    console.log('✅ Initialized SQLite administrator account: "fromex"');
  }

  // Employees, attendance, salaries, and transactions are kept clean for user entries
  console.log('✨ SQLite clean slate setup complete.');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
