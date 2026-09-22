// Test Settings Stats, Clear, and Undo Endpoints
const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('🧪 Starting Settings & Clear/Undo Backend Test...');

  // 1. Login as Admin
  const loginRes = await request('/api/auth/login', { method: 'POST' }, {
    username: 'fromex',
    password: 'fromex123'
  });

  if (loginRes.status !== 200 || !loginRes.body.data || !loginRes.body.data.token) {
    console.error('❌ Failed to login as admin:', loginRes);
    process.exit(1);
  }

  const token = loginRes.body.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('✅ Logged in as Admin.');

  // 2. Fetch Stats
  const statsRes1 = await request('/api/settings/stats', { headers: authHeaders });
  console.log('📊 Initial Stats:', statsRes1.body.data);
  const initialAtt = statsRes1.body.data.attendance;
  const initialSal = statsRes1.body.data.salaries;
  const initialTxn = statsRes1.body.data.transactions;
  const initialTotal = statsRes1.body.data.totalOperationalRecords;
  console.log(`Initial operational records: ${initialTotal} (Attendance: ${initialAtt}, Salaries: ${initialSal}, Txns: ${initialTxn})`);

  // 3. Clear Data
  console.log('🗑️ Executing One-Click Clear Data...');
  const clearRes = await request('/api/settings/clear-data', {
    method: 'POST',
    headers: authHeaders
  }, { scope: 'operational', note: 'Automated test clear' });

  console.log('Clear Response:', clearRes.body);
  if (clearRes.status !== 200) {
    console.error('❌ Clear failed:', clearRes);
    process.exit(1);
  }

  const backupId = clearRes.body.data.backupId;
  console.log(`✅ Cleared data successfully! Backup snapshot ID: ${backupId}`);

  // 4. Verify Stats are 0
  const statsRes2 = await request('/api/settings/stats', { headers: authHeaders });
  console.log('📊 Stats after clear:', statsRes2.body.data);
  if (statsRes2.body.data.totalOperationalRecords !== 0) {
    console.error('❌ Expected totalOperationalRecords to be 0, got:', statsRes2.body.data.totalOperationalRecords);
    process.exit(1);
  }
  console.log('✅ Verification passed: all operational records cleared.');

  // 5. Test Undo Clear
  console.log(`↩️ Executing Undo Clear for backup ID: ${backupId}...`);
  const undoRes = await request('/api/settings/undo-clear', {
    method: 'POST',
    headers: authHeaders
  }, { backupId });

  console.log('Undo Response:', undoRes.body);
  if (undoRes.status !== 200) {
    console.error('❌ Undo failed:', undoRes);
    process.exit(1);
  }

  // 6. Verify Stats are restored
  const statsRes3 = await request('/api/settings/stats', { headers: authHeaders });
  console.log('📊 Stats after Undo:', statsRes3.body.data);
  if (statsRes3.body.data.totalOperationalRecords !== initialTotal) {
    console.error(`❌ Expected totalOperationalRecords to be ${initialTotal}, got:`, statsRes3.body.data.totalOperationalRecords);
    process.exit(1);
  }

  console.log('🎉 PERFECT! All operational records restored accurately with zero data loss!');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
