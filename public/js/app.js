// FROMEX Main Application Coordinator
import { initLiveClock } from './utils/clock.js';
import { state } from './state.js';
import { initAuthModule } from './modules/auth.js';
import { initDashboardModule } from './modules/dashboard.js';
import { initEmployeesModule, openEmployeeModal } from './modules/employees.js';
import { initAttendanceModule, openAttendanceModal } from './modules/attendance.js';
import { initAccountingModule, openSalaryModal, openTransactionModal } from './modules/accounting.js';
import { initUsersModule } from './modules/users.js';
import { initSettingsModule } from './modules/settings.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Initializing FROMEX Company Management System...');

  // 1. Start live date and ticking clock with seconds
  initLiveClock();

  // 2. Setup navigation tabs
  setupNavigation();

  // 3. Setup Quick Action buttons on dashboard
  setupQuickActions();

  // 4. Initialize Auth & Active User session
  initAuthModule();

  // 5. Initialize Domain Modules
  initDashboardModule();
  initEmployeesModule();
  initAttendanceModule();
  initAccountingModule();
  initUsersModule();
  initSettingsModule();

  // 6. Connect State & User
  await state.initUser();

  console.log('✅ FROMEX System ready and connected.');
});

function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  const views = {
    dashboard: document.getElementById('view-dashboard'),
    employees: document.getElementById('view-employees'),
    attendance: document.getElementById('view-attendance'),
    accounting: document.getElementById('view-accounting'),
    settings: document.getElementById('view-settings'),
    users: document.getElementById('view-settings') // legacy redirect to settings
  };

  tabs.forEach(tab => {
    tab.onclick = () => {
      let target = tab.getAttribute('data-tab');
      if (!target) return;

      if (target === 'users') {
        target = 'settings';
        const subtabUsers = document.getElementById('subtab-settings-users');
        if (subtabUsers) subtabUsers.click();
      }

      // Update Tab CSS
      tabs.forEach(t => t.classList.remove('active'));
      const activeNavTab = document.getElementById(`nav-tab-${target}`) || tab;
      activeNavTab.classList.add('active');

      // Update View Sections
      Object.keys(views).forEach(key => {
        if (views[key]) {
          if (key === target) {
            views[key].classList.add('active');
          } else if (key !== 'users') {
            views[key].classList.remove('active');
          }
        }
      });

      // Notify state
      state.setActiveTab(target);
    };
  });
}

function setupQuickActions() {
  const btnQuickEmployee = document.getElementById('btn-quick-employee');
  if (btnQuickEmployee) {
    btnQuickEmployee.onclick = () => openEmployeeModal();
  }

  const btnQuickAttendance = document.getElementById('btn-quick-attendance');
  if (btnQuickAttendance) {
    btnQuickAttendance.onclick = () => openAttendanceModal();
  }

  const btnQuickSalary = document.getElementById('btn-quick-salary');
  if (btnQuickSalary) {
    btnQuickSalary.onclick = () => openSalaryModal();
  }

  const btnQuickTxn = document.getElementById('btn-quick-txn');
  if (btnQuickTxn) {
    btnQuickTxn.onclick = () => openTransactionModal();
  }
}
