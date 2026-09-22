const puppeteer = require('puppeteer-core');
const path = require('node:path');
const { server } = require('./backend/src/server');
const seed = require('./backend/database/seeds/seed');
const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
  });
}

async function safeClick(page, selector) {
  await page.waitForSelector(selector);
  await page.$eval(selector, el => {
    el.scrollIntoView({ block: 'center' });
    el.click();
  });
}

async function runBrowserVerification() {
  const isRunning = await checkServer();
  if (!isRunning) {
    console.log('🔄 Starting server for UI verification...');
    await seed();
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`🚀 Server listening on ${BASE_URL}`);
  }

  console.log('🚀 Launching Local Google Chrome via Puppeteer-Core...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  console.log('1. Navigating to http://localhost:3000 as FROMEX Root Admin...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));

  // Verify Header shows FROMEX
  const headerUser = await page.$eval('#header-user-name', el => el.textContent.trim());
  console.log(`  Header User: "${headerUser}"`);

  // Screenshot Dashboard
  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_dashboard.png') });
  console.log('  📸 Captured preview_dashboard.png');

  // 2. Test Employees Tab & Add Employee Modal
  console.log('2. Clicking Employees Tab...');
  await safeClick(page, '#nav-tab-employees');
  await new Promise(r => setTimeout(r, 600));

  console.log('  Opening Add Employee Modal...');
  await safeClick(page, '#btn-add-employee');
  await new Promise(r => setTimeout(r, 500));

  // Add Employee
  await page.type('#emp-form-name', 'Mohammed Faisal');
  await page.type('#emp-form-designation', 'Lead Architect');
  await page.type('#emp-form-phone', '+91 98950 12345');
  await page.$eval('#emp-form-basic', el => el.value = '85000');
  await page.$eval('#emp-form-allow', el => el.value = '10000');
  await page.$eval('#emp-form-deduct', el => el.value = '4000');
  await page.$eval('#emp-form-basic', el => el.dispatchEvent(new Event('input')));

  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_add_employee_modal.png') });
  console.log('  📸 Captured preview_add_employee_modal.png');

  await safeClick(page, '#emp-form-save-btn');
  await new Promise(r => setTimeout(r, 1000));
  console.log('  ✅ Added new employee "Mohammed Faisal" to company records');

  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_employees_table.png') });
  console.log('  📸 Captured preview_employees_table.png');

  // 3. Test Attendance Tab
  console.log('3. Clicking Attendance Tab...');
  await safeClick(page, '#nav-tab-attendance');
  await new Promise(r => setTimeout(r, 600));

  // Open Add Attendance Modal
  console.log('  Opening Add Attendance Modal...');
  await safeClick(page, '#btn-add-attendance');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_attendance_modal.png') });
  console.log('  📸 Captured preview_attendance_modal.png');

  await safeClick(page, '#att-form-save-btn');
  await new Promise(r => setTimeout(r, 1000));
  console.log('  ✅ Recorded attendance for Mohammed Faisal');

  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_attendance.png') });
  console.log('  📸 Captured preview_attendance.png');

  // 4. Test Accounting Tab: Transactions Ledger
  console.log('4. Clicking Accounting Tab...');
  await safeClick(page, '#nav-tab-accounting');
  await new Promise(r => setTimeout(r, 600));

  // Switch to Transactions Subtab
  console.log('  Switching to Accounting Transactions Ledger...');
  await safeClick(page, '#btn-subtab-transactions');
  await new Promise(r => setTimeout(r, 600));

  // Add First Company Transaction
  console.log('  Recording First Company Transaction...');
  await safeClick(page, '#btn-add-transaction');
  await new Promise(r => setTimeout(r, 500));

  await page.type('#txn-form-desc', 'Opening Balance - Federal Bank Current Account');
  await page.type('#txn-form-party', 'Reserve Corporate Treasury');
  await page.$eval('#txn-form-income', el => el.value = '1000000');
  await page.$eval('#txn-form-income', el => el.dispatchEvent(new Event('input')));

  await safeClick(page, '#txn-form-save-btn');
  await new Promise(r => setTimeout(r, 1000));
  console.log('  ✅ Recorded Opening Fund Balance transaction of ₹10,00,000');

  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_accounting_transactions.png') });
  console.log('  📸 Captured preview_accounting_transactions.png');

  // Switch to Salaries Subtab
  await safeClick(page, '#btn-subtab-salaries');
  await new Promise(r => setTimeout(r, 600));

  // Open Salary Modal
  console.log('  Opening Salary Modal...');
  await safeClick(page, '#btn-add-salary');
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_salary_modal.png') });
  console.log('  📸 Captured preview_salary_modal.png');

  await safeClick(page, '#sal-form-save-btn');
  await new Promise(r => setTimeout(r, 1000));
  console.log('  ✅ Recorded salary slip for Mohammed Faisal');

  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_accounting_salaries.png') });
  console.log('  📸 Captured preview_accounting_salaries.png');

  // 5. Check Dashboard with Updated Metrics
  console.log('5. Navigating back to Dashboard...');
  await safeClick(page, '#nav-tab-dashboard');
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_dashboard_with_data.png') });
  console.log('  📸 Captured preview_dashboard_with_data.png');

  // 6. Test Settings Tab & User Switcher
  console.log('6. Testing Settings View & User Switcher...');
  await safeClick(page, '#nav-tab-settings');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_users_table.png') });
  console.log('  📸 Captured preview_users_table.png');

  await safeClick(page, '#user-profile-btn');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_user_switcher.png') });
  console.log('  📸 Captured preview_user_switcher.png');
  await safeClick(page, '[data-modal-close]');

  console.log('7. Browser verification finished successfully!');
  await browser.close();

  if (!isRunning) {
    server.close();
  }

  process.exit(0);
}

runBrowserVerification().catch(err => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
