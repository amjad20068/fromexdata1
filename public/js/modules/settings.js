// Settings Module: User Management Integration, Data Reset & Instant Undo
import { api } from '../api.js';
import { state } from '../state.js';
import { toast } from '../components/toast.js';
import { showConfirmDialog } from '../components/confirm.js';
import { formatDate } from '../utils/formatters.js';

let undoTimer = null;
let currentCountdown = 60;
let currentBackupId = null;

export function initSettingsModule() {
  console.log('⚙️ Initializing Settings Module...');

  // 1. Setup Subtab Switching
  setupSettingsSubtabs();

  // 2. Setup Data Management Action Buttons
  setupDataManagementActions();

  // 3. Setup Floating Undo Banner Listeners
  setupFloatingUndoListeners();

  // 4. Listen to State Events for real-time stats reload
  state.on('settings_data_changed', () => {
    loadSettingsStats();
    loadRecentBackups();
  });

  state.on('attendance_data_changed', () => {
    if (state.activeTab === 'settings') loadSettingsStats();
  });

  state.on('accounting_data_changed', () => {
    if (state.activeTab === 'settings') loadSettingsStats();
  });

  state.on('tab_changed', (tab) => {
    if (tab === 'settings') {
      loadSettingsStats();
      loadRecentBackups();
    }
  });

  // When active user changes
  state.on('user_changed', (user) => {
    updateSettingsUserView(user);
  });
}

function setupSettingsSubtabs() {
  const subtabs = document.querySelectorAll('.settings-subtab');
  const subviews = {
    users: document.getElementById('settings-subview-users'),
    data: document.getElementById('settings-subview-data'),
    info: document.getElementById('settings-subview-info')
  };

  subtabs.forEach(tab => {
    tab.onclick = () => {
      const target = tab.getAttribute('data-settings-subtab');
      if (!target) return;

      subtabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      Object.keys(subviews).forEach(key => {
        if (subviews[key]) {
          if (key === target) {
            subviews[key].style.display = 'block';
          } else {
            subviews[key].style.display = 'none';
          }
        }
      });

      if (target === 'data') {
        loadSettingsStats();
        loadRecentBackups();
      }
    };
  });
}

function updateSettingsUserView(user) {
  const infoActiveUser = document.getElementById('settings-info-user');
  const infoActiveRole = document.getElementById('settings-info-role');
  if (infoActiveUser && user) infoActiveUser.textContent = user.name;
  if (infoActiveRole && user) infoActiveRole.textContent = `${user.role} (@${user.username})`;
}

async function loadSettingsStats() {
  try {
    const res = await api.settings.getStats();
    if (!res || res.success === false) return;

    const s = res.data || res;
    const attEl = document.getElementById('stat-attendance-count');
    const salEl = document.getElementById('stat-salaries-count');
    const txnEl = document.getElementById('stat-transactions-count');
    const empEl = document.getElementById('stat-employees-count');
    const totEl = document.getElementById('stat-total-count');

    if (attEl) attEl.textContent = Number(s.attendance || 0).toLocaleString();
    if (salEl) salEl.textContent = Number(s.salaries || 0).toLocaleString();
    if (txnEl) txnEl.textContent = Number(s.transactions || 0).toLocaleString();
    if (empEl) empEl.textContent = Number(s.employees || 0).toLocaleString();
    if (totEl) totEl.textContent = Number(s.totalOperationalRecords || 0).toLocaleString();

    // Enable/disable Clear All button if there is data
    const btnClearAll = document.getElementById('btn-clear-all-data');
    if (btnClearAll) {
      if (!s.totalOperationalRecords || s.totalOperationalRecords === 0) {
        btnClearAll.classList.add('btn-disabled');
        btnClearAll.title = 'No records to clear (Database is empty)';
      } else {
        btnClearAll.classList.remove('btn-disabled');
        btnClearAll.title = 'Clear all operational records';
      }
    }
  } catch (err) {
    console.error('Failed to load settings stats:', err);
  }
}

async function loadRecentBackups() {
  const container = document.getElementById('settings-backups-list');
  if (!container) return;

  try {
    const res = await api.settings.getBackups();
    if (!res || res.success === false) return;

    const backups = (res.data && res.data.backups) || res.backups || [];
    if (backups.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
          ℹ️ No snapshots recorded yet. An automatic backup will be created whenever data is cleared.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="excel-table" style="font-size: 12.5px;">
        <thead>
          <tr>
            <th style="width: 70px;">ID</th>
            <th>Backup Timestamp</th>
            <th>Cleared By</th>
            <th class="text-center" style="width: 130px;">Records Count</th>
            <th class="text-center" style="width: 120px;">Status</th>
            <th class="text-center" style="width: 150px;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${backups.map(b => {
            const dateStr = b.created_at ? formatDate(b.created_at.split('T')[0]) + ' ' + (new Date(b.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
            return `
              <tr>
                <td style="font-weight: 700; color: var(--secondary);">#${b.id}</td>
                <td>
                  <div style="font-weight: 600; color: var(--text-main);">${dateStr}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">${b.description || 'Manual clear'}</div>
                </td>
                <td>${b.cleared_by_name || 'Administrator'}</td>
                <td class="text-center">
                  <span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 700;">
                    ${b.records_count} records
                  </span>
                </td>
                <td class="text-center">
                  ${b.is_restored
                    ? '<span class="badge badge-paid">Restored</span>'
                    : '<span class="badge" style="background: #fef3c7; color: #b45309;">Available for Undo</span>'
                  }
                </td>
                <td class="text-center">
                  <button type="button" class="btn btn-outline btn-sm btn-restore-backup" data-backup-id="${b.id}">
                    <span>↩️</span> Restore Snapshot
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // Attach click events to restore buttons
    container.querySelectorAll('.btn-restore-backup').forEach(btn => {
      btn.onclick = async () => {
        const id = parseInt(btn.getAttribute('data-backup-id'), 10);
        await handleRestore(id);
      };
    });

  } catch (err) {
    console.error('Failed to load backups:', err);
  }
}

export function triggerClearOperationalData() {
  showConfirmDialog({
    title: 'Confirm: Clear All Operational Data?',
    message: 'Are you sure you want to clear all active Attendance records, Payroll Salary slips, and Accounting transactions?',
    note: 'A full persistent recovery snapshot will be automatically preserved in PostgreSQL. Instant Undo protection is provided.',
    confirmText: 'Clear All Data',
    confirmClass: 'btn-danger',
    cancelText: 'Cancel',
    onConfirm: async () => {
      try {
        toast.info('Creating persistent snapshot and clearing operational records...');
        const res = await api.settings.clearData('operational');
        if (res && res.success !== false) {
          const data = res.data || res;
          toast.success(`Successfully cleared ${data.totalCleared || 0} records. Instant Undo is available.`);
          
          // Trigger Floating Undo Banner
          if (data.backupId) {
            showFloatingUndo(data.backupId, data.totalCleared, 60);
          }

          // Reload stats and tables
          loadSettingsStats();
          loadRecentBackups();
        } else {
          toast.error((res && res.message) || 'Failed to clear data');
        }
      } catch (err) {
        console.error('Clear error:', err);
        toast.error(err.message || 'Error occurred while clearing data');
      }
    }
  });
}

function setupDataManagementActions() {
  const btnClearAll = document.getElementById('btn-clear-all-data');
  if (btnClearAll) {
    btnClearAll.onclick = () => triggerClearOperationalData();
  }

  // Global event delegation for all Clear Data triggers anywhere in the app
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.btn-trigger-clear-data, #header-btn-clear-data');
    if (trigger) {
      e.preventDefault();
      triggerClearOperationalData();
    }
  });

  const btnQuickRestoreLast = document.getElementById('btn-quick-restore-last');
  if (btnQuickRestoreLast) {
    btnQuickRestoreLast.onclick = async () => {
      await handleRestore(null);
    };
  }
}

async function handleRestore(backupId = null) {
  try {
    toast.info('Restoring records from snapshot in PostgreSQL...');
    const res = await api.settings.undoClear(backupId);
    if (res && res.success !== false) {
      const data = res.data || res;
      toast.success(`🎉 Restored ${data.totalRestored || 0} records successfully! Zero data loss.`);
      hideFloatingUndo();
      loadSettingsStats();
      loadRecentBackups();
    } else {
      toast.error((res && res.message) || 'Failed to restore snapshot');
    }
  } catch (err) {
    console.error('Restore error:', err);
    toast.error(err.message || 'Failed to restore data from backup');
  }
}

function setupFloatingUndoListeners() {
  const btnUndo = document.getElementById('btn-floating-undo');
  const btnDismiss = document.getElementById('btn-floating-dismiss');

  if (btnUndo) {
    btnUndo.onclick = async () => {
      btnUndo.disabled = true;
      btnUndo.textContent = 'Restoring...';
      try {
        await handleRestore(currentBackupId);
      } finally {
        btnUndo.disabled = false;
      }
    };
  }

  if (btnDismiss) {
    btnDismiss.onclick = () => {
      hideFloatingUndo();
    };
  }
}

export function showFloatingUndo(backupId, totalCount, durationSeconds = 60) {
  currentBackupId = backupId;
  currentCountdown = durationSeconds;

  const banner = document.getElementById('floating-undo-banner');
  const timerSpan = document.getElementById('undo-countdown-timer');
  const progressEl = document.getElementById('floating-undo-progress');

  if (!banner) return;

  banner.style.display = 'flex';
  banner.classList.add('visible');

  if (timerSpan) timerSpan.textContent = currentCountdown;
  if (progressEl) {
    progressEl.style.transition = 'none';
    progressEl.style.width = '100%';
    setTimeout(() => {
      progressEl.style.transition = `width ${durationSeconds}s linear`;
      progressEl.style.width = '0%';
    }, 50);
  }

  if (undoTimer) clearInterval(undoTimer);

  undoTimer = setInterval(() => {
    currentCountdown--;
    if (timerSpan) timerSpan.textContent = currentCountdown;

    if (currentCountdown <= 0) {
      clearInterval(undoTimer);
      undoTimer = null;
      hideFloatingUndo();
    }
  }, 1000);
}

export function hideFloatingUndo() {
  if (undoTimer) {
    clearInterval(undoTimer);
    undoTimer = null;
  }
  const banner = document.getElementById('floating-undo-banner');
  if (banner) {
    banner.classList.remove('visible');
    setTimeout(() => {
      banner.style.display = 'none';
    }, 300);
  }
}
