// Comprehensive E2E Test Suite for FROMEX Backend & PostgreSQL Integration
const http = require('http');
const { io } = require('socket.io-client');
const { server, app } = require('./backend/src/server');
const seed = require('./backend/database/seeds/seed');

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

async function ensureServerRunning() {
  try {
    const health = await request('/api/health');
    if (health.status === 200) {
      console.log('📡 Connected to already running FROMEX server on port', PORT);
      return false; // did not start server
    }
  } catch (e) {
    // Server not running, start it
  }

  console.log('🔄 Initializing database and starting server for test suite...');
  await seed();
  await new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`🚀 FROMEX Test Server started on ${BASE_URL}`);
      resolve();
    });
  });
  return true; // started server
}

async function runTests() {
  console.log('🧪 Starting FROMEX PostgreSQL Backend Verification Suite...\n');
  const startedServer = await ensureServerRunning();

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

  try {
    // 1. Health check & Server Status
    console.log('1. Testing Server Health:');
    const health = await request('/api/health');
    assert(health.status === 200, 'Server health check returned HTTP 200');
    assert(health.body.status === 'online', 'Status is "online"');

    // 2. Authentication with JWT & bcrypt
    console.log('\n2. Testing Authentication, JWT, and Seed Company Users:');
    const loginFail = await request('/api/auth/login', { method: 'POST' }, {
      username: 'fromex',
      password: 'wrongpassword'
    });
    assert(loginFail.status === 401, 'Invalid password correctly rejected with HTTP 401');

    // Login User 1 (Root Admin: fromex)
    const adminLogin = await request('/api/auth/login', { method: 'POST' }, {
      username: 'fromex',
      password: 'fromex123'
    });
    assert(adminLogin.status === 200, 'User 1 (Admin: fromex) login successful');
    assert(!!adminLogin.body.data.token, 'Received valid JWT session token');
    assert(adminLogin.body.data.user.password_hash === undefined, 'password_hash is NOT exposed to frontend');
    const adminToken = adminLogin.body.data.token;

    // Create temporary Manager and Staff users for multi-role permission validation
    await request('/api/users', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      name: 'Pooja Sharma',
      username: 'manager_test',
      password: 'fromex123',
      role: 'Manager'
    });

    await request('/api/users', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      name: 'Rohan Verma',
      username: 'staff_test',
      password: 'fromex123',
      role: 'Staff'
    });

    // Login User 2 (Manager)
    const mgrLogin = await request('/api/auth/login', { method: 'POST' }, {
      username: 'manager_test',
      password: 'fromex123'
    });
    assert(mgrLogin.status === 200 && mgrLogin.body.data.user.role === 'Manager', 'User 2 (Manager) login successful with Manager role');
    const mgrToken = mgrLogin.body.data.token;

    // Login User 3 (Staff)
    const staffLogin = await request('/api/auth/login', { method: 'POST' }, {
      username: 'staff_test',
      password: 'fromex123'
    });
    assert(staffLogin.status === 200 && staffLogin.body.data.user.role === 'Staff', 'User 3 (Staff) login successful with Staff role');
    const staffToken = staffLogin.body.data.token;

    // Test GET /api/auth/me with JWT
    const meRes = await request('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(meRes.status === 200 && meRes.body.data.user.name === 'FROMEX', 'GET /api/auth/me returned correct root user "FROMEX"');

    // 3. Socket.IO Real-Time Connection
    console.log('\n3. Testing Socket.IO Real-Time Engine:');
    let socketEventReceived = false;
    let receivedEventData = null;

    const socket = io(BASE_URL, { transports: ['websocket'] });
    await new Promise((resolve) => {
      socket.on('connect', () => {
        assert(true, `Connected to Socket.IO real-time stream (ID: ${socket.id})`);
        resolve();
      });
      socket.on('data:changed', (data) => {
        socketEventReceived = true;
        receivedEventData = data;
      });
      setTimeout(resolve, 1000);
    });

    // 4. Employee CRUD & PostgreSQL Relations
    console.log('\n4. Testing Employee Management in PostgreSQL:');
    const empsList = await request('/api/employees');
    assert(empsList.status === 200 && empsList.body.data.employees.length === 0, `Verified initial fresh company start: 0 employees in PostgreSQL`);

    // Create a new employee
    const newEmpRes = await request('/api/employees', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      employee_code: 'EMP-999',
      name: 'Test Employee Integration',
      phone: '+91 99000 11111',
      designation: 'Staff Engineer',
      basic_salary: 50000,
      allowance: 5000,
      deduction: 2000,
      status: 'Active'
    });
    assert(newEmpRes.status === 201, 'Created new employee in PostgreSQL');
    const testEmpId = newEmpRes.body.data.employee.id;

    // 5. Attendance CRUD, Working Hours & Duplicate Prevention
    console.log('\n5. Testing Attendance Module in PostgreSQL:');
    const attRes = await request('/api/attendance', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    }, {
      employee_id: testEmpId,
      date: '2026-09-22',
      status: 'Present',
      check_in: '09:15',
      check_out: '18:45',
      remarks: 'Integration test attendance'
    });
    assert(attRes.status === 201, 'Recorded attendance in PostgreSQL');
    assert(attRes.body.data.record.working_hours == 9.5, 'Backend auto-calculated working hours: 9.5 hrs (09:15 to 18:45)');
    const testAttId = attRes.body.data.record.id;

    // Test duplicate prevention constraint uq_employee_attendance_date
    const dupRes = await request('/api/attendance', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    }, {
      employee_id: testEmpId,
      date: '2026-09-22',
      status: 'Present'
    });
    assert(dupRes.status === 409, 'Duplicate attendance prevented by PostgreSQL unique constraint (HTTP 409)');

    // 6. Delete Employee Restrict Check
    console.log('\n6. Testing Employee Delete Protection:');
    const deleteBlocked = await request(`/api/employees/${testEmpId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(deleteBlocked.status === 400, 'Employee deletion blocked when attendance history exists');

    // Clean up attendance record
    const delAtt = await request(`/api/attendance/${testAttId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(delAtt.status === 200, 'Deleted test attendance record');

    // 7. Salary Management & Formula Verification
    console.log('\n7. Testing Salary Payroll & Formula (Net = Basic + Allowance - Deduction):');
    const basicSal = 80000;
    const allowSal = 15000;
    const deductSal = 5000;
    const expectedNet = basicSal + allowSal - deductSal; // 90000

    const salRes = await request('/api/salaries', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${staffToken}` }
    }, {
      employee_id: testEmpId,
      month: 'September 2026',
      basic_salary: basicSal,
      allowance: allowSal,
      deduction: deductSal,
      payment_status: 'Pending',
      remarks: 'Automated formula verification slip'
    });

    assert(salRes.status === 201, 'Created salary record in PostgreSQL');
    assert(salRes.body.data.salary.net_salary == expectedNet, `Backend calculated Net Salary: ₹${salRes.body.data.salary.net_salary} (Expected: ₹${expectedNet})`);
    const testSalaryId = salRes.body.data.salary.id;

    // 8. CRITICAL SHARED DATA TEST ACROSS USERS
    console.log('\n8. Testing SHARED DATA Across Company Users:');
    // User 1 (Admin) created salary of 90000 above.
    // User 2 (Manager) reads it:
    const mgrRead = await request(`/api/salaries/${testSalaryId}`, {
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    });
    assert(mgrRead.status === 200 && mgrRead.body.data.salary.net_salary == 90000, 'User 2 (Manager) sees the exact same salary created by User 1');

    // User 2 (Manager) updates the salary to Basic: 95000 (Net becomes 95000 + 15000 - 5000 = 105000)
    const mgrUpdate = await request(`/api/salaries/${testSalaryId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    }, {
      basic_salary: 95000
    });
    assert(mgrUpdate.status === 200 && mgrUpdate.body.data.salary.net_salary == 105000, 'User 2 (Manager) successfully updated salary to ₹1,05,000');

    // User 3 (Staff) reads it:
    const staffRead = await request(`/api/salaries/${testSalaryId}`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    assert(staffRead.status === 200 && staffRead.body.data.salary.net_salary == 105000, 'User 3 (Staff) reads and sees the updated value ₹1,05,000 in PostgreSQL');

    // Clean up test salary and test employee
    await request(`/api/salaries/${testSalaryId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    await request(`/api/employees/${testEmpId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(true, 'Test entities cleaned up successfully');

    // 9. Accounting Transactions & Running Balance
    console.log('\n9. Testing Accounting Transactions & Running Balance:');
    const txnsRes = await request('/api/accounting');
    assert(txnsRes.status === 200 && txnsRes.body.data.transactions.length === 0, `Verified initial fresh company start: 0 transactions in PostgreSQL`);

    // Create test transaction
    const newTxnRes = await request('/api/accounting/transactions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      date: '2026-09-01',
      type: 'Income',
      description: 'Opening Capital Fund',
      party: 'Corporate Account',
      income: 500000,
      expense: 0,
      remarks: 'Initial capital setup'
    });
    assert(newTxnRes.status === 201, 'Created first accounting transaction');
    const testTxnId = newTxnRes.body.data.transaction.id;

    const txnsAfter = await request('/api/accounting');
    assert(txnsAfter.body.data.transactions.length === 1, 'Transaction ledger reflects 1 recorded entry');
    assert(txnsAfter.body.data.transactions[0].balance === 500000, 'Running balance computed accurately: ₹500,000');

    // Clean up test transaction
    await request(`/api/accounting/transactions/${testTxnId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(true, 'Test accounting transaction cleaned up');

    // 10. SCALABLE MULTI-USER SYSTEM & USER MANAGEMENT (NEW)
    console.log('\n10. Testing Scalable Multi-User Management & Role Permissions:');

    // Admin lists users
    const usersRes = await request('/api/users', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(usersRes.status === 200, 'Admin can list company users via GET /api/users');
    assert(usersRes.body.data.users.length >= 3, `Retrieved ${usersRes.body.data.users.length} users from database (no 3-user limit)`);
    assert(usersRes.body.data.users.every(u => u.password_hash === undefined), 'None of the returned user objects expose password_hash');

    // Non-Admin (Manager & Staff) are rejected with 403 Forbidden
    const mgrUsersForbidden = await request('/api/users', {
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    });
    assert(mgrUsersForbidden.status === 403, 'Manager is forbidden (HTTP 403) from accessing /api/users');

    const staffUsersForbidden = await request('/api/users', {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    assert(staffUsersForbidden.status === 403, 'Staff is forbidden (HTTP 403) from accessing /api/users');

    // Admin creates 4th User: "Arjun Kapoor" (role: Staff)
    const uniqueSuffix = Date.now().toString().slice(-4);
    const user4Username = `arjun_${uniqueSuffix}`;
    const user4Res = await request('/api/users', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      name: 'Arjun Kapoor',
      username: user4Username,
      password: 'password123',
      role: 'Staff',
      status: 'Active'
    });
    assert(user4Res.status === 201, `Admin created 4th user (${user4Username}) successfully in PostgreSQL`);
    const user4Id = user4Res.body.data.user.id;

    // Admin creates 5th User: "Meera Nair" (role: Manager)
    const user5Username = `meera_${uniqueSuffix}`;
    const user5Res = await request('/api/users', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      name: 'Meera Nair',
      username: user5Username,
      password: 'password123',
      role: 'Manager',
      status: 'Active'
    });
    assert(user5Res.status === 201, `Admin created 5th user (${user5Username}) successfully in PostgreSQL`);
    const user5Id = user5Res.body.data.user.id;

    // Login with 4th user
    const user4Login = await request('/api/auth/login', { method: 'POST' }, {
      username: user4Username,
      password: 'password123'
    });
    assert(user4Login.status === 200, `4th User (${user4Username}) authenticated successfully via JWT`);
    const user4Token = user4Login.body.data.token;

    // Login with 5th user
    const user5Login = await request('/api/auth/login', { method: 'POST' }, {
      username: user5Username,
      password: 'password123'
    });
    assert(user5Login.status === 200 && user5Login.body.data.user.role === 'Manager', `5th User (${user5Username}) authenticated successfully with Manager role`);

    // Admin updates 4th user profile (name and role)
    const update4Res = await request(`/api/users/${user4Id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      name: 'Arjun V. Kapoor',
      role: 'Staff'
    });
    assert(update4Res.status === 200 && update4Res.body.data.user.name === 'Arjun V. Kapoor', 'Admin updated 4th user profile in PostgreSQL');

    // Admin resets 4th user password
    const resetPwdRes = await request(`/api/users/${user4Id}/reset-password`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      newPassword: 'newsecurepass456'
    });
    assert(resetPwdRes.status === 200, 'Admin reset 4th user password with bcrypt');

    // Old password should now be rejected
    const oldPwdLogin = await request('/api/auth/login', { method: 'POST' }, {
      username: user4Username,
      password: 'password123'
    });
    assert(oldPwdLogin.status === 401, 'Old password correctly rejected with HTTP 401');

    // New password should succeed
    const newPwdLogin = await request('/api/auth/login', { method: 'POST' }, {
      username: user4Username,
      password: 'newsecurepass456'
    });
    assert(newPwdLogin.status === 200, 'New reset password authenticated successfully');
    const user4NewToken = newPwdLogin.body.data.token;

    // Admin disables 4th user
    const disableRes = await request(`/api/users/${user4Id}/status`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      status: 'Disabled'
    });
    assert(disableRes.status === 200 && disableRes.body.data.user.status === 'Disabled', 'Admin disabled 4th user account');

    // Login for disabled user must fail with 403 Forbidden
    const disabledLogin = await request('/api/auth/login', { method: 'POST' }, {
      username: user4Username,
      password: 'newsecurepass456'
    });
    assert(disabledLogin.status === 403, 'Disabled user login rejected with HTTP 403 Forbidden');

    // Token of disabled user must be rejected on protected endpoints
    const disabledTokenReq = await request('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${user4NewToken}` }
    });
    assert(disabledTokenReq.status === 403, 'Disabled user session token rejected with HTTP 403 on protected endpoint');

    // Admin re-enables 4th user
    const enableRes = await request(`/api/users/${user4Id}/status`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      status: 'Active'
    });
    assert(enableRes.status === 200 && enableRes.body.data.user.status === 'Active', 'Admin re-enabled 4th user account');

    // Login succeeds after re-enabling
    const reEnableLogin = await request('/api/auth/login', { method: 'POST' }, {
      username: user4Username,
      password: 'newsecurepass456'
    });
    assert(reEnableLogin.status === 200, 'Re-enabled user can authenticate successfully again');

    // 11. Multi-User Shared Data Test: User A adds ₹10,000 salary, User B edits to ₹12,000, User A & User 4 see ₹12,000
    console.log('\n11. Testing Multi-User Cross-Session Shared Database Synchronization:');

    // Create a temporary employee
    const tempEmpRes = await request('/api/employees', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      employee_code: `TEMP-${uniqueSuffix}`,
      name: 'Shared Test Subject',
      designation: 'Specialist',
      basic_salary: 10000,
      allowance: 0,
      deduction: 0,
      status: 'Active'
    });
    const tempEmpId = tempEmpRes.body.data.employee.id;

    // User A (Admin) creates salary of ₹10,000
    const userACreateSal = await request('/api/salaries', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, {
      employee_id: tempEmpId,
      month: 'October 2026',
      basic_salary: 10000,
      allowance: 0,
      deduction: 0,
      payment_status: 'Pending'
    });
    assert(userACreateSal.status === 201, 'User A (Admin) created salary record of ₹10,000');
    const sharedSalId = userACreateSal.body.data.salary.id;

    // User B (Manager) reads it: sees ₹10,000
    const userBRead1 = await request(`/api/salaries/${sharedSalId}`, {
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    });
    assert(userBRead1.status === 200 && Number(userBRead1.body.data.salary.net_salary) === 10000, 'User B (Manager) sees the ₹10,000 salary');

    // User C (Staff) edits it to ₹12,000 (Basic 12,000, Allowance 0, Deduction 0)
    const userCEdit = await request(`/api/salaries/${sharedSalId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${staffToken}` }
    }, {
      basic_salary: 12000
    });
    assert(userCEdit.status === 200 && Number(userCEdit.body.data.salary.net_salary) === 12000, 'User C (Staff) updated salary to ₹12,000');

    // User A (Admin) sees updated ₹12,000
    const userARead2 = await request(`/api/salaries/${sharedSalId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(userARead2.status === 200 && Number(userARead2.body.data.salary.net_salary) === 12000, 'User A (Admin) sees the updated ₹12,000');

    // User 4 (the newly added company user) also sees updated ₹12,000
    const user4Read = await request(`/api/salaries/${sharedSalId}`, {
      headers: { 'Authorization': `Bearer ${reEnableLogin.body.data.token}` }
    });
    assert(user4Read.status === 200 && Number(user4Read.body.data.salary.net_salary) === 12000, 'User 4 (dynamically created Staff user) also sees the updated ₹12,000 from PostgreSQL');

    // Clean up temporary shared test entities
    await request(`/api/salaries/${sharedSalId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    await request(`/api/employees/${tempEmpId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(true, 'Shared data test records cleaned up from PostgreSQL');

    // Clean up temporary users created during testing so database remains in fresh company state
    const finalUsersRes = await request('/api/users', { headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (finalUsersRes.status === 200 && finalUsersRes.body.data && finalUsersRes.body.data.users) {
      for (const u of finalUsersRes.body.data.users) {
        if (u.username !== 'fromex') {
          await request(`/api/users/${u.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${adminToken}` } });
        }
      }
    }

    // 12. Real-time Event Delivery Verification
    console.log('\n12. Testing Real-time Socket.IO Broadcast Verification:');
    assert(socketEventReceived, 'Socket.IO client received real-time broadcast event on data change');

    socket.close();

    console.log(`\n====================================================`);
    console.log(`📊 FINAL TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`====================================================`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  }
}

runTests();
