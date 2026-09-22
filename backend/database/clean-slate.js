const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

async function cleanSlate() {
  console.log('🧹 Purging all demo data from PostgreSQL...');
  await db.query('DELETE FROM attendance');
  await db.query('DELETE FROM salary_records');
  await db.query('DELETE FROM accounting_transactions');
  await db.query('DELETE FROM data_backups');
  await db.query('DELETE FROM employees');
  await db.query('DELETE FROM users');

  console.log('🔄 Resetting sequence counters...');
  try {
    await db.query("SELECT setval(pg_get_serial_sequence('employees', 'id'), 1, false)");
    await db.query("SELECT setval(pg_get_serial_sequence('attendance', 'id'), 1, false)");
    await db.query("SELECT setval(pg_get_serial_sequence('salary_records', 'id'), 1, false)");
    await db.query("SELECT setval(pg_get_serial_sequence('accounting_transactions', 'id'), 1, false)");
    await db.query("SELECT setval(pg_get_serial_sequence('data_backups', 'id'), 1, false)");
    await db.query("SELECT setval(pg_get_serial_sequence('users', 'id'), 1, false)");
  } catch (e) {
    console.warn('Sequence reset notification:', e.message);
  }

  console.log('👤 Creating root administrator user "fromex"...');
  const hash = await bcrypt.hash('fromex123', 10);
  const userRes = await db.query(
    'INSERT INTO users (name, username, password_hash, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, name, role, status',
    ['FROMEX', 'fromex', hash, 'Admin', 'Active']
  );
  console.log('✅ Created root administrator user:', userRes.rows[0]);

  const stats = {
    users: parseInt((await db.query('SELECT count(*) FROM users')).rows[0].count, 10),
    employees: parseInt((await db.query('SELECT count(*) FROM employees')).rows[0].count, 10),
    attendance: parseInt((await db.query('SELECT count(*) FROM attendance')).rows[0].count, 10),
    salaries: parseInt((await db.query('SELECT count(*) FROM salary_records')).rows[0].count, 10),
    transactions: parseInt((await db.query('SELECT count(*) FROM accounting_transactions')).rows[0].count, 10),
    backups: parseInt((await db.query('SELECT count(*) FROM data_backups')).rows[0].count, 10)
  };
  console.log('📊 Current PostgreSQL Database Status:', stats);
  await db.close();

  console.log('\n🧹 Purging SQLite database...');
  try {
    const sdb = require('../../server/db');
    sdb.exec('DELETE FROM attendance');
    sdb.exec('DELETE FROM salaries');
    sdb.exec('DELETE FROM transactions');
    sdb.exec('DELETE FROM employees');
    sdb.exec('DELETE FROM users');
    sdb.prepare('INSERT INTO users (username, email, password, name, role, avatar, token) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'fromex', 'admin@fromex.com', 'fromex123', 'FROMEX', 'Managing Director (Admin)', 'FX', 'token-fromex-admin'
    );
    console.log('✅ SQLite clean slate completed successfully.');
  } catch (se) {
    console.warn('SQLite cleanup notice:', se.message);
  }
}

cleanSlate()
  .then(() => {
    console.log('🎉 Clean slate successfully established!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error applying clean slate:', err);
    process.exit(1);
  });
