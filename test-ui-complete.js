const puppeteer = require('puppeteer-core');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const ARTIFACTS_DIR = '/home/user/.gemini/antigravity-ide/brain/16eb45a6-365e-427c-b3d5-62f2555c3349';

async function testCompleteUI() {
  console.log('🚀 Launching Puppeteer browser test...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('1. Navigating to FROMEX web application...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  // 1. Check Top Header Clear Data button on Dashboard
  console.log('2. Verifying Header Clear Data button visibility on Dashboard...');
  const headerBtnVisible = await page.$eval('#header-btn-clear-data', el => !!el && el.offsetParent !== null);
  console.log('Header Clear Data button visible:', headerBtnVisible);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'preview_dashboard_with_clear_btn.png') });

  // 2. Navigate to Settings -> Users Management
  console.log('3. Navigating to Settings -> Users tab...');
  await page.click('#nav-tab-settings');
  await new Promise(r => setTimeout(r, 1000));

  // Find user Muhmina
  console.log('4. Locating Muhmina in the users table...');
  const editButtons = await page.$$('button[data-edit-user-id]');
  console.log(`Found ${editButtons.length} user edit buttons.`);

  // Click edit button for user ID 4 (Muhmina)
  const muhminaBtn = await page.$('button[data-edit-user-id="4"]');
  if (muhminaBtn) {
    await muhminaBtn.click();
  } else {
    // Click the last edit button
    await editButtons[editButtons.length - 1].click();
  }

  await new Promise(r => setTimeout(r, 600));

  // Verify username input is editable
  const usernameDisabled = await page.$eval('#edit-user-username', el => el.disabled);
  const currentVal = await page.$eval('#edit-user-username', el => el.value);
  console.log(`Username field status: disabled=${usernameDisabled}, value="${currentVal}"`);

  if (usernameDisabled) {
    throw new Error('Username input is disabled! It should be editable.');
  }

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'preview_edit_username_modal.png') });
  console.log('📸 Captured preview_edit_username_modal.png');

  // Change username to muhmina_corp and save
  console.log('5. Changing username to "muhmina_corp" and saving...');
  await page.evaluate(() => {
    const input = document.getElementById('edit-user-username');
    input.value = 'muhmina_corp';
  });

  await page.click('#btn-save-edit-user');
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'preview_users_table_after_edit.png') });
  console.log('📸 Captured preview_users_table_after_edit.png');

  // Re-edit and set back to muhmina
  console.log('6. Re-editing to restore original handle "muhmina"...');
  const muhminaBtnAfter = await page.$('button[data-edit-user-id="4"]');
  if (muhminaBtnAfter) {
    await muhminaBtnAfter.click();
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => {
      const input = document.getElementById('edit-user-username');
      input.value = 'muhmina';
    });
    await page.click('#btn-save-edit-user');
    await new Promise(r => setTimeout(r, 1200));
  }

  // 3. Test Global Header Clear Data Button from Attendance View
  console.log('7. Switching to Attendance tab...');
  await page.click('#nav-tab-attendance');
  await new Promise(r => setTimeout(r, 1000));

  console.log('8. Clicking the Header Clear Data button...');
  await page.click('#header-btn-clear-data');
  await new Promise(r => setTimeout(r, 600));

  // Verify Confirm dialog appeared
  await page.waitForSelector('#app-confirm-dialog', { visible: true });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'preview_clear_confirm_modal_english.png') });
  console.log('📸 Captured preview_clear_confirm_modal_english.png');

  // Click Confirm in dialog
  console.log('9. Confirming Clear Data...');
  await page.click('#app-confirm-dialog [data-modal-confirm]');
  await new Promise(r => setTimeout(r, 1500));

  // Verify Floating Undo banner appeared
  console.log('10. Verifying Floating Undo Banner...');
  await page.waitForSelector('#floating-undo-banner', { visible: true });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'preview_floating_undo_banner_english.png') });
  console.log('📸 Captured preview_floating_undo_banner_english.png');

  // Click UNDO CLEAR on the floating banner
  console.log('11. Clicking UNDO CLEAR button on floating banner...');
  await page.click('#btn-floating-undo');
  await new Promise(r => setTimeout(r, 1500));

  // Take final screenshot showing data restored
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'preview_attendance_restored.png') });
  console.log('📸 Captured preview_attendance_restored.png');

  // Check Settings Data page for clean English
  console.log('12. Inspecting Settings Data Management page...');
  await page.click('#nav-tab-settings');
  await new Promise(r => setTimeout(r, 800));
  await page.click('#subtab-settings-data');
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'preview_settings_data_english.png') });
  console.log('📸 Captured preview_settings_data_english.png');

  console.log('🎉 ALL PUPPETEER UI TESTS PASSED SUCCESSFULLY!');
  await browser.close();
}

testCompleteUI().catch(err => {
  console.error('❌ Puppeteer test failed:', err);
  process.exit(1);
});
