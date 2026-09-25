import http from 'http';

const BASE_URL = 'http://localhost:3000';

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
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
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

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Comprehensive FROMEX Next.js + MongoDB Production Verification Suite...\n');

  // 1. Health check
  console.log('--- 1. HEALTH CHECK & MONGODB CONNECTION ---');
  const health = await request('/api/health');
  assert(health.status === 200, 'Health endpoint returns HTTP 200');
  assert(health.body.status === 'online', 'Status is "online"');
  assert(health.body.database === 'MongoDB Atlas', 'Connected to MongoDB Atlas');
  assert(health.body.connectedDatabase === 'fromex', 'Active database is "fromex"');

  // 2. Authentication & Users
  console.log('\n--- 2. AUTHENTICATION & ROLE-BASED ACCESS ---');
  // Invalid login
  const badLogin = await request('/api/auth/login', { method: 'POST' }, {
    username: 'fromex',
    password: 'wrong_password_123'
  });
  assert(badLogin.status === 401, 'Bad credentials rejected with HTTP 401');

  // Root admin login
  const adminLogin = await request('/api/auth/login', { method: 'POST' }, {
    username: 'fromex',
    password: 'fromex123'
  });
  assert(adminLogin.status === 200, 'Root admin "fromex" logged in successfully');
  assert(!!adminLogin.body.data.token, 'Admin received valid JWT token');
  assert(adminLogin.body.data.user.password_hash === undefined, 'password_hash is NOT exposed');
  const adminToken = adminLogin.body.data.token;
  const adminAuth = { Authorization: `Bearer ${adminToken}` };

  // Secondary admin login (Vikram)
  const vikramLogin = await request('/api/auth/login', { method: 'POST' }, {
    username: 'admin',
    password: 'fromex123'
  });
  assert(vikramLogin.status === 200, 'Admin "admin" (Vikram Malhotra) logged in successfully');

  // Manager login (Pooja)
  const managerLogin = await request('/api/auth/login', { method: 'POST' }, {
    username: 'manager',
    password: 'fromex123'
  });
  assert(managerLogin.status === 200, 'Manager "manager" (Pooja Sharma) logged in successfully');
  const managerToken = managerLogin.body.data.token;
  const managerAuth = { Authorization: `Bearer ${managerToken}` };

  // Staff login (Rohan)
  const staffLogin = await request('/api/auth/login', { method: 'POST' }, {
    username: 'staff',
    password: 'fromex123'
  });
  assert(staffLogin.status === 200, 'Staff "staff" (Rohan Verma) logged in successfully');
  const staffToken = staffLogin.body.data.token;
  const staffAuth = { Authorization: `Bearer ${staffToken}` };

  // Verify /api/auth/me
  const meRes = await request('/api/auth/me', { headers: adminAuth });
  assert(meRes.status === 200, 'GET /api/auth/me returns HTTP 200');
  assert(meRes.body.data.user.username === 'fromex', 'GET /api/auth/me identifies correct user');

  // Verify public /api/auth/users
  const authUsers = await request('/api/auth/users');
  assert(authUsers.status === 200, 'GET /api/auth/users returns HTTP 200');
  assert(authUsers.body.data.users.length >= 4, 'All seeded users returned');

  // 3. User Management (Admin Only)
  console.log('\n--- 3. USER MANAGEMENT (ADMIN ONLY) ---');
  // Non-admin access check
  const nonAdminAccess = await request('/api/users', { headers: staffAuth });
  assert(nonAdminAccess.status === 403, 'Staff access to /api/users correctly forbidden with HTTP 403');

  const unauthAccess = await request('/api/users');
  assert(unauthAccess.status === 401, 'Unauthenticated access to /api/users rejected with HTTP 401');

  // Create temporary user
  const tempUser = `test_usr_${Date.now().toString().slice(-5)}`;
  const createUser = await request('/api/users', { method: 'POST', headers: adminAuth }, {
    name: 'Automation Tester',
    username: tempUser,
    password: 'password123',
    role: 'Staff',
    status: 'Active'
  });
  assert(createUser.status === 201, 'Admin created new user with HTTP 201');
  const createdUserId = createUser.body.data.user.id;

  // Duplicate user check
  const dupUser = await request('/api/users', { method: 'POST', headers: adminAuth }, {
    name: 'Duplicate Tester',
    username: tempUser,
    password: 'password123',
    role: 'Staff'
  });
  assert(dupUser.status === 409, 'Duplicate username correctly rejected with HTTP 409');

  // Toggle user status
  const toggleRes = await request(`/api/users/${createdUserId}/status`, { method: 'PATCH', headers: adminAuth }, {
    status: 'Disabled'
  });
  assert(toggleRes.status === 200, 'Admin disabled user account with HTTP 200');

  // Verify disabled user cannot log in
  const disabledLogin = await request('/api/auth/login', { method: 'POST' }, {
    username: tempUser,
    password: 'password123'
  });
  assert(disabledLogin.status === 403, 'Disabled user login rejected with HTTP 403');

  // Reset password
  const resetRes = await request(`/api/users/${createdUserId}/reset-password`, { method: 'POST', headers: adminAuth }, {
    newPassword: 'newpassword456'
  });
  assert(resetRes.status === 200, 'Admin reset user password with HTTP 200');

  // Re-enable user
  await request(`/api/users/${createdUserId}/status`, { method: 'PATCH', headers: adminAuth }, { status: 'Active' });

  // Login with new password
  const newPassLogin = await request('/api/auth/login', { method: 'POST' }, {
    username: tempUser,
    password: 'newpassword456'
  });
  assert(newPassLogin.status === 200, 'Re-enabled user logged in with new password');

  // Delete temporary user
  const delUser = await request(`/api/users/${createdUserId}`, { method: 'DELETE', headers: adminAuth });
  assert(delUser.status === 200, 'Admin deleted test user with HTTP 200');

  // Self deletion protection
  const selfDel = await request(`/api/users/${adminLogin.body.data.user.id}`, { method: 'DELETE', headers: adminAuth });
  assert(selfDel.status === 400, 'Admin self-deletion blocked with HTTP 400');

  // New Admin Creation & Login Verification (Phase 9 & 10 requirement)
  console.log('\n--- 3b. NEW ADMIN CREATION & AUTHENTICATION VERIFICATION ---');
  const newAdminUser = `admin_test_${Date.now().toString().slice(-4)}`;
  const createNewAdmin = await request('/api/users', { method: 'POST', headers: adminAuth }, {
    name: 'Executive Test Admin',
    username: newAdminUser,
    email: `${newAdminUser}@fromex.com`,
    password: 'secureAdminPass2026',
    role: 'Admin',
    status: 'Active'
  });
  assert(createNewAdmin.status === 201, 'Logged-in Admin successfully created a new Admin');
  assert(createNewAdmin.body.data.user.role === 'Admin', 'Newly created user assigned Admin role');
  const newAdminId = createNewAdmin.body.data.user.id;

  // Verify newly created Admin can log in via /api/auth/login
  const newAdminLogin = await request('/api/auth/login', { method: 'POST' }, {
    username: newAdminUser,
    password: 'secureAdminPass2026'
  });
  assert(newAdminLogin.status === 200, 'Newly created Admin successfully logged in via /api/auth/login');
  assert(newAdminLogin.body.data.user.role === 'Admin', 'Logged in user has Admin role');
  const newAdminToken = newAdminLogin.body.data.token;
  const newAdminAuth = { Authorization: `Bearer ${newAdminToken}` };

  // Verify newly created Admin has admin permissions (accessing database monitor and user list)
  const newAdminMonitor = await request('/api/settings/database-usage', { headers: newAdminAuth });
  assert(newAdminMonitor.status === 200, 'Newly created Admin has authorized access to database monitor');

  const newAdminUserList = await request('/api/users', { headers: newAdminAuth });
  assert(newAdminUserList.status === 200, 'Newly created Admin has authorized access to /api/users');

  // Clean up new test admin
  const cleanNewAdmin = await request(`/api/users/${newAdminId}`, { method: 'DELETE', headers: adminAuth });
  assert(cleanNewAdmin.status === 200, 'Test Admin successfully cleaned up');

  // 4. Employees CRUD
  console.log('\n--- 4. EMPLOYEES CRUD & RELATION PROTECTIONS ---');
  const empCode = `EMP-TEST-${Date.now().toString().slice(-4)}`;
  const createEmp = await request('/api/employees', { method: 'POST', headers: adminAuth }, {
    employee_code: empCode,
    name: 'Kavita Sundaram',
    phone: '+91 98765 43210',
    designation: 'Senior Architect',
    basic_salary: 85000,
    allowance: 12000,
    deduction: 5000,
    status: 'Active'
  });
  assert(createEmp.status === 201, 'Created new employee with HTTP 201');
  const empId = createEmp.body.data.employee.id;

  // Read employee
  const getEmp = await request(`/api/employees/${empId}`);
  assert(getEmp.status === 200, 'Retrieved employee details with HTTP 200');
  assert(getEmp.body.data.employee.name === 'Kavita Sundaram', 'Employee name matches');

  // Update employee
  const updateEmp = await request(`/api/employees/${empId}`, { method: 'PUT', headers: adminAuth }, {
    designation: 'Lead Architect',
    basic_salary: 95000
  });
  assert(updateEmp.status === 200, 'Updated employee details with HTTP 200');
  assert(updateEmp.body.data.employee.designation === 'Lead Architect', 'Designation updated');

  // 5. Attendance CRUD & Working Hours
  console.log('\n--- 5. ATTENDANCE CRUD & WORKING HOURS CALCULATION ---');
  const testDate = '2026-09-24';
  const createAtt = await request('/api/attendance', { method: 'POST', headers: managerAuth }, {
    employee_id: empId,
    emp_id: empCode,
    date: testDate,
    status: 'Present',
    check_in: '09:15',
    check_out: '18:45',
    remarks: 'Automated verification check'
  });
  assert(createAtt.status === 201, 'Created attendance record with HTTP 201');
  assert(createAtt.body.data.record.working_hours === 9.5, 'Auto-calculated working hours: 9.5 hrs (09:15 to 18:45)');
  const attId = createAtt.body.data.record.id;

  // Duplicate attendance check (unique employee + date constraint)
  const dupAtt = await request('/api/attendance', { method: 'POST', headers: managerAuth }, {
    employee_id: empId,
    emp_id: empCode,
    date: testDate,
    status: 'Present'
  });
  assert(dupAtt.status === 409, 'Duplicate attendance prevented with HTTP 409');

  // Attendance summary
  const attSummary = await request(`/api/attendance/summary?date=${testDate}`);
  assert(attSummary.status === 200, 'Attendance daily summary returned HTTP 200');
  assert(attSummary.body.data.present >= 1, 'Summary reflects present employee');

  // Try to delete employee while attendance exists (Foreign key protection)
  const delBlockedEmp = await request(`/api/employees/${empId}`, { method: 'DELETE', headers: adminAuth });
  assert(delBlockedEmp.status === 400, 'Employee deletion blocked when attendance history exists');

  // Update attendance
  const updateAtt = await request(`/api/attendance/${attId}`, { method: 'PUT', headers: managerAuth }, {
    check_out: '17:15'
  });
  assert(updateAtt.status === 200, 'Updated attendance with HTTP 200');
  assert(updateAtt.body.data.record.working_hours === 8.0, 'Working hours recalculated to 8.0 hrs');

  // 6. Salaries Management & Formula Verification
  console.log('\n--- 6. SALARIES MANAGEMENT & FORMULA (Net = Basic + Allowance - Deduction) ---');
  const basic = 95000;
  const allow = 15000;
  const deduct = 6000;
  const expectedNet = basic + allow - deduct; // 104000

  const createSal = await request('/api/salaries', { method: 'POST', headers: staffAuth }, {
    employee_id: empId,
    emp_id: empCode,
    month: 'September 2026',
    basic_salary: basic,
    allowance: allow,
    deduction: deduct,
    payment_status: 'Paid',
    payment_date: '2026-09-24',
    remarks: 'Formula verification salary'
  });
  assert(createSal.status === 201, 'Created salary record with HTTP 201');
  assert(createSal.body.data.salary.net_salary === expectedNet, `Net Salary auto-calculated: ₹${expectedNet} (95000 + 15000 - 6000)`);
  const salId = createSal.body.data.salary.id;

  // Accounting alias /api/accounting/salaries
  const aliasSal = await request('/api/accounting/salaries');
  assert(aliasSal.status === 200, 'GET /api/accounting/salaries alias works with HTTP 200');

  // 7. Accounting Ledger & Running Balance
  console.log('\n--- 7. ACCOUNTING LEDGER & DYNAMIC RUNNING BALANCE ---');
  // Record Income
  const createIncome = await request('/api/accounting', { method: 'POST', headers: staffAuth }, {
    transaction_date: '2026-09-24',
    transaction_type: 'Income',
    description: 'Enterprise Client Retainer',
    party: 'Apex Global Corp',
    income: 250000,
    expense: 0,
    remarks: 'Q3 Payment'
  });
  assert(createIncome.status === 201, 'Created Income transaction with HTTP 201');
  const incomeTxnId = createIncome.body.data.transaction.id;

  // Record Expense
  const createExpense = await request('/api/accounting/transactions', { method: 'POST', headers: staffAuth }, {
    transaction_date: '2026-09-24',
    transaction_type: 'Expense',
    description: 'Cloud Infrastructure Services',
    party: 'AWS Cloud',
    income: 0,
    expense: 45000,
    remarks: 'Server Hosting'
  });
  assert(createExpense.status === 201, 'Created Expense transaction via /transactions alias with HTTP 201');
  const expenseTxnId = createExpense.body.data.transaction.id;

  // Fetch ledger with running balance
  const ledger = await request('/api/accounting');
  assert(ledger.status === 200, 'GET /api/accounting returned HTTP 200');
  assert(ledger.body.data.transactions.length >= 2, 'Transactions returned in ledger');
  const sampleTxn = ledger.body.data.transactions[0];
  assert(typeof sampleTxn.balance === 'number', 'Running balance is dynamically computed');

  // Accounting summary
  const accSummary = await request('/api/accounting/summary');
  assert(accSummary.status === 200, 'Accounting financial summary returned HTTP 200');
  assert(accSummary.body.data.totalIncome >= 250000, 'Summary reflects income');
  assert(accSummary.body.data.totalExpense >= 45000, 'Summary reflects expense');

  // 8. Dashboard Metrics
  console.log('\n--- 8. DASHBOARD METRICS ---');
  const dash = await request(`/api/dashboard/metrics?date=${testDate}&month=September%202026`);
  assert(dash.status === 200, 'Dashboard metrics returned HTTP 200');
  assert(dash.body.data.kpis.totalEmployees >= 1, 'KPIs include active employee headcount');
  assert(dash.body.data.kpis.presentToday >= 1, 'KPIs include present count today');
  assert(Array.isArray(dash.body.data.weeklyTrend), 'Weekly attendance trends array returned');

  // 9. Database Monitor Feature (Admin Only)
  console.log('\n--- 9. DATABASE USAGE MONITOR (ADMIN ONLY FEATURE) ---');
  // Non-admin check
  const staffMonitor = await request('/api/settings/database-usage', { headers: staffAuth });
  assert(staffMonitor.status === 403, 'Staff access to database monitor blocked with HTTP 403');

  const unauthMonitor = await request('/api/settings/database-usage');
  assert(unauthMonitor.status === 401, 'Unauthenticated database monitor access blocked with HTTP 401');

  // Admin access
  const adminMonitor = await request('/api/settings/database-usage', { headers: adminAuth });
  assert(adminMonitor.status === 200, 'Admin access to database monitor succeeded with HTTP 200');
  const dbData = adminMonitor.body.data;
  assert(dbData.databaseName === 'fromex', 'Database name correctly identified as "fromex"');
  assert(['Healthy', 'Warning', 'High Usage', 'Critical'].includes(dbData.status), `Health status determined: "${dbData.status}"`);
  assert(typeof dbData.storageUsedMB === 'number', `Real storage used measured: ${dbData.storageUsedMB} MB`);
  assert(dbData.storageLimitMB === 512, 'Storage limit configured as 512 MB');
  assert(typeof dbData.usagePercentage === 'number', `Storage usage: ${dbData.usagePercentage}%`);
  assert(typeof dbData.remainingStorageMB === 'number', `Remaining storage: ${dbData.remainingStorageMB} MB`);
  assert(Array.isArray(dbData.collections) && dbData.collections.length > 0, `Collections breakdown returned: ${dbData.collections.length} collections`);
  const collNames = dbData.collections.map(c => c.name);
  console.log(`     Active MongoDB collections: ${collNames.join(', ')}`);
  assert(collNames.includes('users') || collNames.includes('employees'), 'Standard collections present');

  // 10. Settings Stats & Safe Clear / Undo
  console.log('\n--- 10. SETTINGS STATS, ONE-CLICK CLEAR & INSTANT UNDO ---');
  // Initial stats
  const stats1 = await request('/api/settings/stats', { headers: adminAuth });
  assert(stats1.status === 200, 'GET /api/settings/stats returned HTTP 200');
  const countBefore = stats1.body.data.totalOperationalRecords;
  assert(countBefore > 0, `Active operational records before clear: ${countBefore}`);

  // One-click clear data
  const clearRes = await request('/api/settings/clear-data', { method: 'POST', headers: adminAuth }, {
    scope: 'operational',
    note: 'Automated test suite snapshot'
  });
  assert(clearRes.status === 200, 'Clear data succeeded with HTTP 200');
  assert(clearRes.body.data.cleared === true, 'Clear operation confirmed');
  const backupId = clearRes.body.data.backupId;
  assert(!!backupId, `Backup snapshot created with ID: ${backupId}`);

  // Verify operational count is 0
  const statsAfterClear = await request('/api/settings/stats', { headers: adminAuth });
  assert(statsAfterClear.body.data.totalOperationalRecords === 0, 'Operational records successfully cleared to 0');
  assert(statsAfterClear.body.data.employees > 0, 'Employees roster preserved (NOT deleted)');
  assert(statsAfterClear.body.data.users > 0, 'Company users preserved (NOT deleted)');

  // Instant Undo Clear
  const undoRes = await request('/api/settings/undo-clear', { method: 'POST', headers: adminAuth }, { backupId });
  assert(undoRes.status === 200, 'Undo clear succeeded with HTTP 200');
  assert(undoRes.body.data.restored === true, 'Restoration confirmed');

  // Verify records restored
  const statsAfterUndo = await request('/api/settings/stats', { headers: adminAuth });
  assert(statsAfterUndo.body.data.totalOperationalRecords === countBefore, `All ${countBefore} operational records restored perfectly!`);

  // Clean up test employee
  // First clean test attendance, salary, transactions
  await request(`/api/attendance/${attId}`, { method: 'DELETE', headers: adminAuth });
  await request(`/api/salaries/${salId}`, { method: 'DELETE', headers: adminAuth });
  await request(`/api/accounting/${incomeTxnId}`, { method: 'DELETE', headers: adminAuth });
  await request(`/api/accounting/${expenseTxnId}`, { method: 'DELETE', headers: adminAuth });
  const delEmpClean = await request(`/api/employees/${empId}`, { method: 'DELETE', headers: adminAuth });
  assert(delEmpClean.status === 200, 'Test employee safely deleted after history cleared');

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
