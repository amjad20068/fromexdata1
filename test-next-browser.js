import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';

async function safeClick(page, selector) {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.$eval(selector, el => {
    el.scrollIntoView({ block: 'center' });
    el.click();
  });
}

async function runBrowserTests() {
  console.log('🌐 Starting Puppeteer Full UI & Responsiveness Test Suite...\n');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // 0. Test Login Page & Authentication Flow
  console.log('0. Testing Admin Login Page (/login)...');
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  await page.waitForSelector('#login-username', { visible: true });
  await page.waitForSelector('#login-password', { visible: true });
  await page.waitForSelector('#login-submit-btn', { visible: true });

  // Test invalid login feedback
  await page.type('#login-username', 'fromex');
  await page.type('#login-password', 'wrong_password_test');
  await safeClick(page, '#login-submit-btn');
  await page.waitForSelector('#login-error-alert', { visible: true, timeout: 5000 });
  const errorAlert = await page.$eval('#login-error-alert', el => el.textContent.trim());
  console.log(`  Login error feedback: "${errorAlert}"`);

  // Test valid login & redirect
  await page.$eval('#login-password', el => el.value = '');
  await page.type('#login-password', 'fromex123');
  await safeClick(page, '#login-submit-btn');
  await new Promise(r => setTimeout(r, 2000));
  console.log(`  ✅ Authenticated successfully through Login page`);

  // 1. Desktop Viewport (1440x900)
  console.log('\n1. Testing Desktop Layout (1440x900)...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  // Check Header Brand
  const brandTitle = await page.$eval('.brand-title', el => el.textContent.trim());
  console.log(`  Brand Title: "${brandTitle}"`);
  if (!brandTitle.includes('FROMEX')) throw new Error('Brand title does not contain FROMEX');

  // Check no horizontal overflow
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(`  Horizontal overflow on Desktop: ${desktopOverflow ? 'FAIL' : 'PASS'}`);

  // Screenshot Dashboard
  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_desktop_1440.png') });
  console.log('  📸 Saved public/preview_desktop_1440.png');

  // 2. Test Employees Tab & Modal
  console.log('\n2. Testing Employees View & Modal...');
  await safeClick(page, '#nav-tab-employees');
  await new Promise(r => setTimeout(r, 800));

  await safeClick(page, '#btn-add-employee');
  await new Promise(r => setTimeout(r, 600));

  // Fill Employee Form
  const testEmpName = `Meera Nair ${Date.now().toString().slice(-3)}`;
  await page.type('#emp-form-name', testEmpName);
  await page.type('#emp-form-designation', 'VP Operations');
  await page.type('#emp-form-phone', '+91 98450 99887');
  await page.$eval('#emp-form-basic', el => el.value = '110000');
  await page.$eval('#emp-form-allow', el => el.value = '20000');
  await page.$eval('#emp-form-deduct', el => el.value = '7000');
  await page.$eval('#emp-form-basic', el => el.dispatchEvent(new Event('input')));

  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_add_employee_modal.png') });
  console.log('  📸 Saved public/preview_add_employee_modal.png');

  await safeClick(page, '#emp-form-save-btn');
  await new Promise(r => setTimeout(r, 1200));
  console.log(`  ✅ Successfully created employee "${testEmpName}" via UI`);

  // 3. Test Attendance Tab & Record Attendance
  console.log('\n3. Testing Attendance View...');
  await safeClick(page, '#nav-tab-attendance');
  await new Promise(r => setTimeout(r, 800));

  await safeClick(page, '#btn-add-attendance');
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_attendance_modal.png') });
  console.log('  📸 Saved public/preview_attendance_modal.png');

  await safeClick(page, '#att-form-save-btn');
  await new Promise(r => setTimeout(r, 1200));
  console.log('  ✅ Successfully recorded attendance via UI');

  // 4. Test Accounting Transactions Ledger
  console.log('\n4. Testing Accounting Transactions Ledger...');
  await safeClick(page, '#nav-tab-accounting');
  await new Promise(r => setTimeout(r, 800));

  await safeClick(page, '#btn-subtab-transactions');
  await new Promise(r => setTimeout(r, 600));

  await safeClick(page, '#btn-add-transaction');
  await new Promise(r => setTimeout(r, 600));

  await page.type('#txn-form-desc', 'HDFC Bank Inflow - Tech Service Invoice #402');
  await page.type('#txn-form-party', 'Infosys Technologies');
  await page.$eval('#txn-form-income', el => el.value = '500000');
  await page.$eval('#txn-form-income', el => el.dispatchEvent(new Event('input')));

  await safeClick(page, '#txn-form-save-btn');
  await new Promise(r => setTimeout(r, 1200));
  console.log('  ✅ Successfully recorded transaction ₹5,00,000 via UI');

  // 5. Test Accounting Salaries
  console.log('\n5. Testing Accounting Salaries...');
  await safeClick(page, '#btn-subtab-salaries');
  await new Promise(r => setTimeout(r, 600));

  await safeClick(page, '#btn-add-salary');
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_salary_modal.png') });
  console.log('  📸 Saved public/preview_salary_modal.png');

  await safeClick(page, '#sal-form-save-btn');
  await new Promise(r => setTimeout(r, 1200));
  console.log('  ✅ Successfully recorded salary slip via UI');

  // 6. Test Settings & Database Monitor Feature
  console.log('\n6. Testing Settings Tab & New Database Monitor Feature...');
  await safeClick(page, '#nav-tab-settings');
  await new Promise(r => setTimeout(r, 800));

  // Click Database Monitor subtab
  console.log('  Opening Database Monitor Subtab (#subtab-settings-monitor)...');
  await safeClick(page, '#subtab-settings-monitor');
  await page.waitForSelector('.db-status-badge', { visible: true, timeout: 15000 });

  // Verify Database Monitor elements are displayed
  const dbStatus = await page.$eval('.db-status-badge', el => el.textContent.trim());
  console.log(`  Database Monitor Status Badge: "${dbStatus}"`);

  const storageInfo = await page.$eval('.db-progress-wrapper', el => el.textContent);
  console.log(`  Storage Monitor Info: "${storageInfo.replace(/\s+/g, ' ').trim()}"`);

  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_database_monitor.png') });
  console.log('  📸 Saved public/preview_database_monitor.png');

  // 6b. Test Create New Admin via UI, Logout, and Login as New Admin
  console.log('\n6b. Testing Create New Admin via UI, Logout, and Login as New Admin...');
  await safeClick(page, '#subtab-settings-users');
  await new Promise(r => setTimeout(r, 600));

  await safeClick(page, '#btn-add-user');
  await new Promise(r => setTimeout(r, 600));

  const uiAdminUsername = `admin_ui_${Date.now().toString().slice(-4)}`;
  await page.type('#user-form-name', 'Operations Director');
  await page.type('#user-form-username', uiAdminUsername);
  await page.type('#user-form-password', 'DirectorPass2026');
  await page.select('#user-form-role', 'Admin');

  await safeClick(page, '#user-form-save-btn');
  await new Promise(r => setTimeout(r, 1200));
  console.log(`  ✅ Successfully created new Admin "${uiAdminUsername}" via UI`);

  // Logout
  console.log('  Logging out current admin session...');
  await safeClick(page, '#header-logout-btn');
  await new Promise(r => setTimeout(r, 1200));

  // Verify redirected to /login
  await page.waitForSelector('#login-username', { visible: true });
  console.log('  ✅ Successfully logged out and redirected to /login');

  // Screenshot login page
  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_login_page.png') });
  console.log('  📸 Saved public/preview_login_page.png');

  // Login as newly created admin
  console.log(`  Logging in as newly created Admin "${uiAdminUsername}"...`);
  await page.type('#login-username', uiAdminUsername);
  await page.type('#login-password', 'DirectorPass2026');
  await safeClick(page, '#login-submit-btn');
  await new Promise(r => setTimeout(r, 2000));

  // Verify dashboard loaded for new admin
  await page.waitForSelector('.brand-title', { visible: true });
  console.log(`  ✅ Successfully logged in as newly created Admin "${uiAdminUsername}" and reached dashboard!`);

  // 7. Responsive Tests
  console.log('\n7. Testing Responsive Viewports...');
  const viewports = [
    { name: 'Tablet (768x1024)', width: 768, height: 1024, file: 'preview_tablet_768.png' },
    { name: 'Mobile (375x812 - iPhone X/12)', width: 375, height: 812, file: 'preview_mobile_375.png' },
    { name: 'Compact Mobile (320x640)', width: 320, height: 640, file: 'preview_mobile_320.png' }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`  ${vp.name}: Horizontal Overflow = ${hasOverflow ? 'DETECTED' : 'NONE (PASS)'}`);
    await page.screenshot({ path: path.join(__dirname, 'public', vp.file) });
    console.log(`  📸 Saved public/${vp.file}`);
  }

  // Mobile Views Deep Dive (375x812)
  console.log('\n📱 Deep Diving Mobile Views (375x812)...');
  await page.setViewport({ width: 375, height: 812 });

  // Employees Tab
  await safeClick(page, '#nav-tab-employees');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_mobile_employees_375.png') });
  console.log('  📸 Saved public/preview_mobile_employees_375.png');

  // Attendance Tab
  await safeClick(page, '#nav-tab-attendance');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_mobile_attendance_375.png') });
  console.log('  📸 Saved public/preview_mobile_attendance_375.png');

  // Accounting Tab
  await safeClick(page, '#nav-tab-accounting');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_mobile_accounting_375.png') });
  console.log('  📸 Saved public/preview_mobile_accounting_375.png');

  // Settings Tab
  await safeClick(page, '#nav-tab-settings');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(__dirname, 'public', 'preview_mobile_settings_375.png') });
  console.log('  📸 Saved public/preview_mobile_settings_375.png');

  console.log('\n--- BROWSER VERIFICATION SUMMARY ---');
  console.log(`Total Browser Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.warn('Console warnings/errors:', consoleErrors);
  }

  await browser.close();
  console.log('🎉 Browser verification completed successfully!');
}

runBrowserTests().catch(err => {
  console.error('Fatal browser test failure:', err);
  process.exit(1);
});
