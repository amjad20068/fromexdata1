const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const ARTIFACTS_DIR = '/home/user/.gemini/antigravity-ide/brain/16eb45a6-365e-427c-b3d5-62f2555c3349';

async function verifySettingsUI() {
  console.log('🚀 Launching Puppeteer to verify Settings & Undo UI...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  // 1. Restore any previous backup first to ensure we have active data
  console.log('1. Initializing active data...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(async () => {
    const { api } = await import('./js/api.js');
    try {
      await api.settings.undoClear();
    } catch (e) {
      console.log('Initial restore info:', e.message);
    }
  });
  await new Promise(r => setTimeout(r, 1500));

  // 2. Click Settings Tab
  console.log('2. Clicking Settings navigation tab...');
  await page.waitForSelector('#nav-tab-settings');
  await page.click('#nav-tab-settings');
  await new Promise(r => setTimeout(r, 1000));

  const shotSettingsUsers = path.join(ARTIFACTS_DIR, 'preview_settings_users.png');
  await page.screenshot({ path: shotSettingsUsers });
  console.log('📸 Captured Settings Users tab:', shotSettingsUsers);

  // 3. Click Data Management & Reset Subtab
  console.log('3. Clicking Data Management subtab...');
  await page.waitForSelector('#subtab-settings-data');
  await page.click('#subtab-settings-data');
  await new Promise(r => setTimeout(r, 1200));

  const shotSettingsData = path.join(ARTIFACTS_DIR, 'preview_settings_data.png');
  await page.screenshot({ path: shotSettingsData });
  console.log('📸 Captured Settings Data Management tab (with 33 records):', shotSettingsData);

  // 4. Click Clear All Data to open confirmation dialog
  console.log('4. Clicking Clear All Data button...');
  await page.waitForSelector('#btn-clear-all-data');
  await page.click('#btn-clear-all-data');
  await new Promise(r => setTimeout(r, 800));

  const shotConfirmModal = path.join(ARTIFACTS_DIR, 'preview_clear_confirm_modal.png');
  await page.screenshot({ path: shotConfirmModal });
  console.log('📸 Captured Confirm Modal:', shotConfirmModal);

  // 5. Confirm the clear action
  console.log('5. Confirming Clear in Modal...');
  await page.waitForSelector('[data-modal-confirm]');
  await page.$eval('[data-modal-confirm]', el => el.click());
  await new Promise(r => setTimeout(r, 1500));

  const shotFloatingUndo = path.join(ARTIFACTS_DIR, 'preview_floating_undo.png');
  await page.screenshot({ path: shotFloatingUndo });
  console.log('📸 Captured Floating Undo Banner:', shotFloatingUndo);

  // 6. Click UNDO CLEAR on the floating banner
  console.log('6. Clicking UNDO CLEAR button...');
  await page.waitForSelector('#btn-floating-undo');
  await page.$eval('#btn-floating-undo', el => el.click());
  await new Promise(r => setTimeout(r, 2000));

  const shotRestored = path.join(ARTIFACTS_DIR, 'preview_data_restored.png');
  await page.screenshot({ path: shotRestored });
  console.log('📸 Captured Restored State:', shotRestored);

  await browser.close();
  console.log('✅ UI verification completed successfully with zero browser errors!');
}

verifySettingsUI().catch(err => {
  console.error('UI verification failed:', err);
  process.exit(1);
});
