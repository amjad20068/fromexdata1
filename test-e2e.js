// Comprehensive End-to-End Test Suite for FROMEX System
const http = require('http');

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

async function runTests() {
  console.log('🧪 Starting FROMEX Comprehensive End-to-End Test Suite...\n');
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
    // 1. Static Assets & HTML Delivery
    console.log('1. Testing Static Assets & Single Page Application Serving:');
    const htmlRes = await request('/');
    assert(htmlRes.status === 200, 'index.html served with HTTP 200');
    assert(htmlRes.raw.includes('FROMEX'), 'index.html contains FROMEX brand');
    assert(htmlRes.raw.includes('data-live-clock'), 'index.html includes live clock component');
    assert(htmlRes.raw.includes('attendance-table'), 'index.html includes Excel-like attendance table');
    assert(htmlRes.raw.includes('salaries-table'), 'index.html includes Accounting salaries table');
    assert(htmlRes.raw.includes('transactions-table'), 'index.html includes Accounting transactions table');

    const cssRes = await request('/css/excel-table.css');
    assert(cssRes.status === 200 && cssRes.raw.includes('position: sticky'), 'excel-table.css served with sticky table headers');

    // 2. Authentication for all 3 authorized users
    console.log('\n2. Testing Authentication & 3 Authorized Company Users:');
    const usersRes = await request('/api/auth/users');
    assert(usersRes.status === 200 && usersRes.body.users.length === 3, 'All 3 authorized company users exist');
    const userNames = usersRes.body.users.map(u => u.name);
    assert(userNames.includes('Vikram Malhotra'), 'User 1: Vikram Malhotra (Managing Director)');
    assert(userNames.includes('Pooja Sharma'), 'User 2: Pooja Sharma (HR & Operations Manager)');
    assert(userNames.includes('Rohan Verma'), 'User 3: Rohan Verma (Finance & Accounts Lead)');

    const loginRes = await request('/api/auth/login', { method: 'POST' }, {
      usernameOrEmail: 'admin@fromex.com',
      password: 'fromex123'
    });
    assert(loginRes.status === 200 && loginRes.body.token === 'token-admin-12345', 'Admin login successful with valid session token');

    // 3. Employees Roster CRUD
    console.log('\n3. Testing Employee Roster Management:');
    const empsRes = await request('/api/employees');
    assert(empsRes.status === 200 && empsRes.body.employees.length >= 10, `Loaded ${empsRes.body.employees.length} active company employees`);

    // 4. Attendance Module CRUD & Working Hours Calculation
    console.log('\n4. Testing Attendance Module & Auto Calculations:');
    const attListRes = await request('/api/attendance');
    assert(attListRes.status === 200 && attListRes.body.records.length > 0, `Loaded ${attListRes.body.records.length} existing attendance records`);

    // Add Attendance with check-in 09:15 and check-out 18:45 (9.5 hours)
    const newAttRes = await request('/api/attendance', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token-hr-23456' }
    }, {
      emp_id: 'FRX-102',
      emp_name: 'Ananya Gupta',
      date: '2026-09-25',
      status: 'Present',
      check_in: '09:15',
      check_out: '18:45',
      remarks: 'Product release sprint deployment'
    });

    assert(newAttRes.status === 201, 'Created new attendance entry via API');
    assert(newAttRes.body.record.day === 'Fri', 'Day automatically computed as Fri from 2026-09-25');
    assert(newAttRes.body.record.working_hours === 9.5, 'Working hours automatically calculated: 9.5 hrs (09:15 to 18:45)');
    assert(newAttRes.body.record.updated_by === 'Pooja Sharma', 'Audit trail accurately records active user: Pooja Sharma');

    // Edit Attendance
    const editAttRes = await request(`/api/attendance/${newAttRes.body.record.id}`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer token-admin-12345' }
    }, {
      check_out: '17:15', // changed to 8.0 hours
      remarks: 'Updated early departure'
    });
    assert(editAttRes.status === 200 && editAttRes.body.record.working_hours === 8.0, 'Edited attendance working hours recalculated to 8.0 hrs');

    // Delete Attendance
    const delAttRes = await request(`/api/attendance/${newAttRes.body.record.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer token-admin-12345' }
    });
    assert(delAttRes.status === 200, 'Deleted attendance record successfully');

    // Attendance Summary
    const attSummaryRes = await request('/api/attendance/summary?date=2026-09-16');
    assert(attSummaryRes.status === 200 && attSummaryRes.body.attendanceRate > 0, `Attendance rate computed: ${attSummaryRes.body.attendanceRate}%`);

    // 5. Accounting Module: Salary Calculation (Net = Basic + Allowance - Deduction)
    console.log('\n5. Testing Accounting Module: Salaries & Net Salary Formula:');
    const salariesRes = await request('/api/accounting/salaries?month=September 2026');
    assert(salariesRes.status === 200 && salariesRes.body.salaries.length >= 10, `Loaded ${salariesRes.body.salaries.length} salary records for September 2026`);

    // Verify Formula for all seeded records: Net = Basic + Allow - Deduct
    let allFormulasValid = true;
    for (const s of salariesRes.body.salaries) {
      const expected = s.basic_salary + s.allowance - s.deduction;
      if (Math.abs(s.net_salary - expected) > 0.01) {
        allFormulasValid = false;
        console.error(`Mismatch for ${s.emp_name}: basic ${s.basic_salary} + allow ${s.allowance} - deduct ${s.deduction} != net ${s.net_salary}`);
      }
    }
    assert(allFormulasValid, 'All salary records strictly satisfy: Net Salary = Basic Salary + Allowance - Deduction');

    // Add new salary entry with custom amounts
    const basic = 90000;
    const allow = 18000;
    const deduct = 6500;
    const expectedNet = basic + allow - deduct; // 101500

    const newSalaryRes = await request('/api/accounting/salaries', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token-accounts-34567' }
    }, {
      emp_id: 'FRX-103',
      emp_name: 'Rajesh Iyer',
      month: 'November 2026',
      basic_salary: basic,
      allowance: allow,
      deduction: deduct,
      payment_status: 'Pending',
      remarks: 'Quarterly cloud performance bonus'
    });

    assert(newSalaryRes.status === 201, 'Created salary record via API');
    assert(newSalaryRes.body.salary.net_salary === expectedNet, `Net Salary auto-calculated correctly: ₹${newSalaryRes.body.salary.net_salary} (Expected: ₹${expectedNet})`);
    assert(newSalaryRes.body.salary.updated_by === 'Rohan Verma', 'Audit trail accurately records active user: Rohan Verma');

    // Clean up created salary entry
    await request(`/api/accounting/salaries/${newSalaryRes.body.salary.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer token-accounts-34567' }
    });

    // 6. Accounting Transactions & Running Balance Calculation
    console.log('\n6. Testing Accounting Transactions & Running Balance Calculation:');
    const txnsRes = await request('/api/accounting/transactions?sortOrder=ASC');
    assert(txnsRes.status === 200 && txnsRes.body.transactions.length >= 10, `Loaded ${txnsRes.body.transactions.length} transactions`);

    // Verify running balances are mathematically sound
    let currentBal = 0;
    let balanceMathValid = true;
    for (const t of txnsRes.body.transactions) {
      currentBal = currentBal + (t.income || 0) - (t.expense || 0);
      if (Math.abs(t.balance - currentBal) > 0.01) {
        balanceMathValid = false;
        console.error(`Ledger balance mismatch at txn ${t.id}: computed ${currentBal} vs recorded ${t.balance}`);
      }
    }
    assert(balanceMathValid, `All transactions satisfy running balance: Balance = Previous + Income - Expense (Final: ₹${currentBal.toLocaleString('en-IN')})`);

    // Add new transaction and test running balance update
    const newTxnRes = await request('/api/accounting/transactions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token-accounts-34567' }
    }, {
      date: '2026-09-17',
      type: 'Income',
      description: 'Enterprise Annual Cloud Maintenance Retainer',
      party: 'Adani Digital Labs',
      income: 500000,
      expense: 0,
      remarks: 'Invoice #FRX-INV-2026-094'
    });
    assert(newTxnRes.status === 201, 'Created transaction entry via API');
    assert(newTxnRes.body.transaction.balance === currentBal + 500000, `Running balance accurately incremented to ₹${(currentBal + 500000).toLocaleString('en-IN')}`);

    // Clean up test transaction
    await request(`/api/accounting/transactions/${newTxnRes.body.transaction.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer token-accounts-34567' }
    });

    // 7. Multi-User Shared SQLite Database Verification
    console.log('\n7. Testing Multi-User Shared Database Access:');
    // User 1 (Pooja / HR) adds attendance
    const multiAttRes = await request('/api/attendance', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token-hr-23456' }
    }, {
      emp_id: 'FRX-104',
      emp_name: 'Sneha Kulkarni',
      date: '2026-09-28',
      status: 'Present',
      check_in: '09:00',
      check_out: '18:00',
      remarks: 'Shared multi-user test'
    });
    const multiAttId = multiAttRes.body.record.id;

    // User 2 (Rohan / Accounts) reads attendance list and sees it
    const readByAccounts = await request('/api/attendance', {
      headers: { 'Authorization': 'Bearer token-accounts-34567' }
    });
    const foundByAccounts = readByAccounts.body.records.some(r => r.id === multiAttId);
    assert(foundByAccounts, 'User 2 (Accounts) reads and sees record created by User 1 (HR)');

    // User 3 (Vikram / Director) edits the record
    const editedByAdmin = await request(`/api/attendance/${multiAttId}`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer token-admin-12345' }
    }, {
      remarks: 'Approved by Managing Director Vikram Malhotra'
    });
    assert(editedByAdmin.body.record.updated_by === 'Vikram Malhotra', 'User 3 (Director) successfully edits the record');

    // Clean up
    await request(`/api/attendance/${multiAttId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer token-admin-12345' }
    });

    // 8. Financial Summary Verification
    console.log('\n8. Testing Financial Summary:');
    const summaryRes = await request('/api/accounting/summary');
    assert(summaryRes.status === 200, 'Accounting summary generated');
    assert(summaryRes.body.totalIncome > 0, `Total Inflow: ₹${summaryRes.body.totalIncome.toLocaleString('en-IN')}`);
    assert(summaryRes.body.totalExpense > 0, `Total Outflow: ₹${summaryRes.body.totalExpense.toLocaleString('en-IN')}`);
    assert(summaryRes.body.balance === summaryRes.body.totalIncome - summaryRes.body.totalExpense, 'Net Cash Balance = Total Inflow - Total Outflow');

    console.log(`\n====================================================`);
    console.log(`📊 FINAL TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`====================================================`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  }
}

runTests();
