// Test User Deletion Backend Endpoint and Safety Constraints
import http from 'http';

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
  console.log('🧪 Starting Delete User Endpoint Test...');

  // 1. Login as Admin
  const adminLogin = await request('/api/auth/login', { method: 'POST' }, {
    username: 'fromex',
    password: 'fromex123'
  });

  const adminToken = adminLogin.body.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log('✅ Logged in as Admin.');

  // 2. Create a temporary user
  const tempUsername = `temp_del_${Date.now().toString().slice(-4)}`;
  const createRes = await request('/api/users', {
    method: 'POST',
    headers: adminHeaders
  }, {
    name: 'Temporary User To Delete',
    username: tempUsername,
    password: 'Password123',
    role: 'Staff'
  });

  if (createRes.status !== 201 && createRes.status !== 200) {
    console.error('❌ Failed to create temporary user:', createRes);
    process.exit(1);
  }

  const tempUser = createRes.body.data.user;
  console.log(`✅ Created test user: ${tempUser.name} (ID: ${tempUser.id}, @${tempUser.username})`);

  // 3. Test Safety Constraint: Deleting self must fail (400)
  const selfDelRes = await request(`/api/users/1`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  if (selfDelRes.status === 400) {
    console.log('✅ Safety Check PASSED: Self/Admin deletion rejected with HTTP 400.');
  } else {
    console.error('❌ Expected 400 on self deletion, got:', selfDelRes.status);
    process.exit(1);
  }

  // 4. Test Safety Constraint: Non-admin cannot delete user (403)
  const staffLogin = await request('/api/auth/login', { method: 'POST' }, {
    username: 'staff',
    password: 'fromex123'
  });
  if (staffLogin.status === 200 && staffLogin.body.data) {
    const staffHeaders = { Authorization: `Bearer ${staffLogin.body.data.token}` };
    const staffDelRes = await request(`/api/users/${tempUser.id}`, {
      method: 'DELETE',
      headers: staffHeaders
    });
    if (staffDelRes.status === 403) {
      console.log('✅ Permission Check PASSED: Non-admin delete forbidden with HTTP 403.');
    } else {
      console.error('❌ Expected 403 on staff delete, got:', staffDelRes.status);
      process.exit(1);
    }
  }

  // 5. Delete temporary user as Admin
  const delRes = await request(`/api/users/${tempUser.id}`, {
    method: 'DELETE',
    headers: adminHeaders
  });

  if (delRes.status === 200) {
    console.log(`✅ User ${tempUser.id} successfully deleted! Message:`, delRes.body.message);
  } else {
    console.error('❌ Delete failed with status:', delRes.status, delRes.body);
    process.exit(1);
  }

  // 6. Verify user no longer exists
  const getRes = await request(`/api/users/${tempUser.id}`, {
    method: 'GET',
    headers: adminHeaders
  });

  if (getRes.status === 404) {
    console.log('✅ Verification PASSED: Deleted user confirmed non-existent (HTTP 404).');
  } else {
    console.error('❌ Expected 404 for deleted user, got:', getRes.status);
    process.exit(1);
  }

  console.log('🎉 PERFECT! User deletion and safety guards verified 100% successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error in test:', err);
  process.exit(1);
});
