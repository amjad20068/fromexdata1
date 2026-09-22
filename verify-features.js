const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('🧪 1. Logging in as admin...');
  const loginRes = await request('/api/auth/login', 'POST', { username: 'admin', password: 'fromex123' });
  if (loginRes.status !== 200 || !loginRes.data.success) {
    throw new Error('Login failed: ' + JSON.stringify(loginRes.data));
  }
  const token = loginRes.data.data.token;
  console.log('✅ Admin logged in successfully.');

  console.log('\n👥 2. Fetching user list...');
  const usersRes = await request('/api/users', 'GET', null, token);
  const users = usersRes.data.data.users;
  console.log(`Found ${users.length} users:`, users.map(u => ({ id: u.id, username: u.username, name: u.name })));

  const muhmina = users.find(u => u.username === 'muhmina' || u.username === 'muhmina_test');
  if (!muhmina) throw new Error('Muhmina user not found!');

  console.log(`\n✏️ 3. Testing Username Edit on user ID ${muhmina.id}...`);
  const updateRes1 = await request(`/api/users/${muhmina.id}`, 'PUT', {
    name: 'Muhmina Senior',
    username: 'muhmina_pro'
  }, token);

  console.log('Update result 1:', updateRes1.data);
  if (updateRes1.status !== 200 || updateRes1.data.data.user.username !== 'muhmina_pro') {
    throw new Error('Failed to update username to muhmina_pro');
  }
  console.log('✅ Successfully edited username to "muhmina_pro"!');

  // Change it back to muhmina
  const updateRes2 = await request(`/api/users/${muhmina.id}`, 'PUT', {
    name: 'Muhmina',
    username: 'muhmina'
  }, token);
  if (updateRes2.status !== 200 || updateRes2.data.data.user.username !== 'muhmina') {
    throw new Error('Failed to revert username back to muhmina');
  }
  console.log('✅ Successfully updated username back to "muhmina"!');

  console.log('\n📊 4. Checking initial operational stats...');
  const statsRes1 = await request('/api/settings/stats', 'GET', null, token);
  console.log('Initial stats:', statsRes1.data.data);
  const totalBefore = statsRes1.data.data.totalOperationalRecords;
  if (totalBefore <= 0) throw new Error('Expected operational records > 0');

  console.log('\n🗑️ 5. Clearing operational data with snapshot...');
  const clearRes = await request('/api/settings/clear-data', 'POST', { type: 'operational' }, token);
  console.log('Clear response:', clearRes.data);
  if (clearRes.status !== 200 || !clearRes.data.success) {
    throw new Error('Clear data failed: ' + JSON.stringify(clearRes.data));
  }
  const backupId = clearRes.data.data.backupId;
  console.log(`✅ Cleared ${clearRes.data.data.totalCleared} records. Backup ID: ${backupId}`);

  console.log('\n📊 6. Verifying database stats after clear...');
  const statsRes2 = await request('/api/settings/stats', 'GET', null, token);
  console.log('Post-clear stats:', statsRes2.data.data);
  if (statsRes2.data.data.totalOperationalRecords !== 0) {
    throw new Error('Operational records should be 0 after clear!');
  }
  console.log('✅ All operational records cleared to 0!');

  console.log(`\n↩️ 7. Testing Undo/Restore from Backup ID ${backupId}...`);
  const undoRes = await request('/api/settings/undo-clear', 'POST', { backupId }, token);
  console.log('Undo response:', undoRes.data);
  if (undoRes.status !== 200 || !undoRes.data.success) {
    throw new Error('Undo clear failed: ' + JSON.stringify(undoRes.data));
  }
  console.log(`✅ Restored ${undoRes.data.data.totalRestored} records!`);

  console.log('\n📊 8. Verifying database stats after restore...');
  const statsRes3 = await request('/api/settings/stats', 'GET', null, token);
  console.log('Post-restore stats:', statsRes3.data.data);
  if (statsRes3.data.data.totalOperationalRecords !== totalBefore) {
    throw new Error(`Expected ${totalBefore} records restored, found ${statsRes3.data.data.totalOperationalRecords}`);
  }
  console.log('✅ Full snapshot restored with zero data loss!');

  console.log('\n🎉 ALL BACKEND FEATURES VERIFIED 100% WORKING!');
}

run().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
