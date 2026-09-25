// Users Management Module (Admin Only)
import { api } from '../api.js';
import { state } from '../state.js';
import { toast } from '../components/toast.js';
import { showModal, hideModal } from '../components/modal.js';
import { showConfirmDialog } from '../components/confirm.js';
import { exportTableToCSV } from '../utils/export.js';
import { formatDate } from '../utils/formatters.js';

let usersList = [];
let sortField = 'id';
let sortDirection = 'asc';

export function initUsersModule() {
  const searchInput = document.getElementById('users-search-input');
  const roleFilter = document.getElementById('users-role-filter');
  const statusFilter = document.getElementById('users-status-filter');
  const btnAddUser = document.getElementById('btn-add-user');
  const btnExport = document.getElementById('btn-export-users');

  if (searchInput) searchInput.oninput = () => renderUsersTable();
  if (roleFilter) roleFilter.onchange = () => renderUsersTable();
  if (statusFilter) statusFilter.onchange = () => renderUsersTable();
  if (btnAddUser) btnAddUser.onclick = () => openAddUserModal();
  if (btnExport) btnExport.onclick = () => exportUsersCSV();

  // Sorting handlers
  document.querySelectorAll('#users-table th.sortable').forEach(th => {
    th.onclick = () => {
      const field = th.getAttribute('data-sort');
      if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortField = field;
        sortDirection = 'asc';
      }
      updateSortIndicators();
      renderUsersTable();
    };
  });

  // Listen for real-time user mutations from Socket.IO
  state.on('users_data_changed', () => {
    loadUsers();
  });

  // Listen for active tab change to load data when navigating to Users
  state.on('tab_changed', (tab) => {
    if (tab === 'users') {
      loadUsers();
    }
  });

  // When user signs in or changes
  state.on('user_changed', (user) => {
    if (user && user.role === 'Admin') {
      loadUsers();
    }
  });
}

export async function loadUsers() {
  try {
    const res = await api.users.getAll();
    if (res && res.users) {
      usersList = res.users;
      renderUsersTable();
    }
  } catch (err) {
    // If not admin, access forbidden is expected
    if (err.message && !err.message.includes('forbidden')) {
      console.error('Failed to load users:', err);
    }
  }
}

function updateSortIndicators() {
  document.querySelectorAll('#users-table th.sortable').forEach(th => {
    const field = th.getAttribute('data-sort');
    const indicator = th.querySelector('.sort-indicator');
    if (indicator) {
      if (field === sortField) {
        indicator.textContent = sortDirection === 'asc' ? '▲' : '▼';
        indicator.style.opacity = '1';
      } else {
        indicator.textContent = '⇅';
        indicator.style.opacity = '0.4';
      }
    }
  });
}

function getFilteredUsers() {
  const query = (document.getElementById('users-search-input')?.value || '').trim().toLowerCase();
  const role = document.getElementById('users-role-filter')?.value || 'All';
  const status = document.getElementById('users-status-filter')?.value || 'All';

  return usersList.filter(u => {
    const matchQuery = !query ||
      u.name.toLowerCase().includes(query) ||
      u.username.toLowerCase().includes(query) ||
      String(u.id).includes(query);

    const matchRole = role === 'All' || u.role === role;
    const matchStatus = status === 'All' || u.status === status;

    return matchQuery && matchRole && matchStatus;
  }).sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

export function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  const countPill = document.getElementById('users-count-pill');
  if (!tbody) return;

  const filtered = getFilteredUsers();

  if (countPill) {
    countPill.textContent = `${filtered.length} Users`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 36px 16px; color: var(--text-muted);">
          <div style="font-size: 26px; margin-bottom: 8px;">👥</div>
          <div style="font-weight: 600; font-size: 14px;">No Company Users Found</div>
          <div style="font-size: 12px; margin-top: 4px;">Adjust search criteria or click "+ Add User" to register a new user.</div>
        </td>
      </tr>
    `;
    return;
  }

  const roleBadgeStyle = (role) => {
    if (role === 'Admin') return 'background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe;';
    if (role === 'Manager') return 'background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;';
    return 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
  };

  const statusBadgeClass = (status) => {
    return status === 'Active' ? 'badge-paid' : 'badge-absent';
  };

  tbody.innerHTML = filtered.map(u => {
    const isSelf = state.currentUser && state.currentUser.id === u.id;
    return `
      <tr>
        <td class="text-center font-mono" style="font-weight: 700; color: var(--secondary);">#${u.id}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 9px;">
            <div class="user-avatar" style="width: 28px; height: 28px; font-size: 11px; flex-shrink: 0;">
              ${u.name.charAt(0)}
            </div>
            <div>
              <span style="font-weight: 600; color: var(--secondary);">${escapeHtml(u.name)}</span>
              ${isSelf ? '<span class="badge" style="background:#e0e7ff; color:#3730a3; margin-left: 6px; font-size: 10px; padding: 1px 6px;">You</span>' : ''}
            </div>
          </div>
        </td>
        <td class="font-mono font-semibold" style="color: #2563eb;">@${escapeHtml(u.username)}</td>
        <td>
          <span class="badge" style="${roleBadgeStyle(u.role)} font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">
            ${u.role}
          </span>
        </td>
        <td class="text-center">
          <span class="badge ${statusBadgeClass(u.status)}" style="font-size: 11px; font-weight: 700;">
            ${u.status}
          </span>
        </td>
        <td class="font-mono text-center" style="font-size: 12px; color: var(--text-muted);">
          ${u.created_at ? formatDate(u.created_at) : '—'}
        </td>
        <td class="text-center">
          <div style="display: inline-flex; gap: 5px; align-items: center;">
            <button type="button" class="btn btn-outline btn-xs" data-edit-user-id="${u.id}" title="Edit User">
              ✏️ Edit
            </button>
            <button type="button" class="btn btn-outline btn-xs" data-reset-pwd-id="${u.id}" title="Reset Password">
              🔑 Key
            </button>
            ${!isSelf ? `
              <button type="button" class="btn ${u.status === 'Active' ? 'btn-outline' : 'btn-primary'} btn-xs"
                      data-toggle-status-id="${u.id}"
                      data-current-status="${u.status}"
                      title="${u.status === 'Active' ? 'Disable Account' : 'Enable Account'}"
                      style="${u.status === 'Active' ? 'color: #dc2626; border-color: #fca5a5;' : ''}">
                ${u.status === 'Active' ? '🚫 Disable' : '✓ Enable'}
              </button>
              <button type="button" class="btn btn-outline btn-xs btn-delete-user"
                      data-delete-user-id="${u.id}"
                      title="Delete User Permanently"
                      style="color: #b91c1c; border-color: #fca5a5; background: #fff1f2;">
                🗑️ Delete
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach action button events
  tbody.querySelectorAll('[data-edit-user-id]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-edit-user-id'), 10);
      const user = usersList.find(u => u.id === id);
      if (user) openEditUserModal(user);
    };
  });

  tbody.querySelectorAll('[data-reset-pwd-id]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-reset-pwd-id'), 10);
      const user = usersList.find(u => u.id === id);
      if (user) openResetPasswordModal(user);
    };
  });

  tbody.querySelectorAll('[data-toggle-status-id]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-toggle-status-id'), 10);
      const current = btn.getAttribute('data-current-status');
      const target = current === 'Active' ? 'Disabled' : 'Active';
      const user = usersList.find(u => u.id === id);
      if (user) toggleUserStatus(user, target);
    };
  });

  tbody.querySelectorAll('[data-delete-user-id]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-delete-user-id'), 10);
      const user = usersList.find(u => u.id === id);
      if (user) promptDeleteUser(user);
    };
  });
}

function promptDeleteUser(user) {
  showConfirmDialog({
    title: `Delete User "${user.name}"?`,
    message: `Are you sure you want to permanently delete user "${user.name}" (@${user.username})? This account and login credentials will be removed from the system.`,
    confirmText: 'Yes, Delete User',
    confirmClass: 'btn-danger',
    cancelText: 'Cancel',
    onConfirm: async () => {
      try {
        await api.users.delete(user.id);
        toast.success(`User "${user.name}" (@${user.username}) deleted successfully.`);
        await loadUsers();
      } catch (err) {
        console.error('Failed to delete user:', err);
        toast.error(err.message || 'Failed to delete user');
      }
    }
  });
}

export function openAddUserModal() {
  const bodyHtml = `
    <form id="form-add-user" style="display: flex; flex-direction: column; gap: 14px;">
      <div>
        <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--secondary);">
          Full Name <span style="color: var(--danger);">*</span>
        </label>
        <input type="text" id="user-name-input" class="search-input" style="width: 100%;" placeholder="e.g. Anand Kumar" required />
      </div>

      <div>
        <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--secondary);">
          Username <span style="color: var(--danger);">*</span> (Used for Login)
        </label>
        <input type="text" id="user-username-input" class="search-input font-mono" style="width: 100%;" placeholder="e.g. anandk" required autocomplete="off" />
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">Lowercase letters and numbers only. Must be unique.</div>
      </div>

      <div>
        <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--secondary);">
          Initial Password <span style="color: var(--danger);">*</span>
        </label>
        <input type="password" id="user-password-input" class="search-input" style="width: 100%;" placeholder="Minimum 6 characters" required autocomplete="new-password" />
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">Hashed with bcrypt. Passwords are never stored in plain text.</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--secondary);">
            Role <span style="color: var(--danger);">*</span>
          </label>
          <select id="user-role-input" class="select-control" style="width: 100%;">
            <option value="Staff">Staff</option>
            <option value="Manager">Manager</option>
            <option value="Admin">Admin</option>
          </select>
        </div>

        <div>
          <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--secondary);">
            Account Status <span style="color: var(--danger);">*</span>
          </label>
          <select id="user-status-input" class="select-control" style="width: 100%;">
            <option value="Active">Active</option>
            <option value="Disabled">Disabled</option>
          </select>
        </div>
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-outline" data-modal-close>Cancel</button>
    <button type="button" class="btn btn-primary" id="btn-save-new-user">Create User</button>
  `;

  const modal = showModal({
    id: 'modal-add-user',
    title: 'Add New Company User',
    bodyHtml,
    footerHtml
  });

  const btnSave = modal.querySelector('#btn-save-new-user');
  btnSave.onclick = async () => {
    const name = modal.querySelector('#user-name-input').value.trim();
    const rawUsername = modal.querySelector('#user-username-input').value.trim().toLowerCase();
    const username = rawUsername.replace(/^@+/, '');
    const password = modal.querySelector('#user-password-input').value;
    const role = modal.querySelector('#user-role-input').value;
    const status = modal.querySelector('#user-status-input').value;

    if (!name || !username || !password) {
      toast.error('Name, username, and password are required.');
      return;
    }

    const isEmail = /^[a-z0-9_.+-]+@[a-z0-9-]+\.[a-z0-9-.]+$/i.test(username);
    const isStandardUsername = /^[a-z0-9_.-]{3,50}$/i.test(username);
    if (!isEmail && !isStandardUsername) {
      toast.error('Username must be 3-50 characters (letters, numbers, underscore, dot) or a valid email address.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    btnSave.disabled = true;
    btnSave.textContent = 'Saving...';

    try {
      const res = await api.users.create({ name, username, password, role, status });
      if (res && res.success) {
        toast.success(`User "${name}" created successfully!`);
        hideModal('modal-add-user');
        await loadUsers();
      } else {
        toast.error(res?.message || 'Failed to create user.');
      }
    } catch (err) {
      toast.error(err.message || 'Error creating user');
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = 'Create User';
    }
  };
}

export function openEditUserModal(user) {
  const isSelf = state.currentUser && state.currentUser.id === user.id;
  const cleanUsername = (user.username || '').replace(/^@+/, '');
  const isRootAdmin = user.id === 1 || cleanUsername === 'admin';

  const bodyHtml = `
    <form id="form-edit-user" style="display: flex; flex-direction: column; gap: 14px;">
      <div>
        <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--secondary);">
          Username <span style="color: var(--danger);">*</span>
        </label>
        <input type="text" id="edit-user-username" class="search-input font-mono" style="width: 100%;" value="${escapeHtml(cleanUsername)}" ${isRootAdmin ? 'disabled title="Primary root administrator username cannot be changed"' : ''} required />
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">Unique login handle (e.g. jsmith, alex)</div>
      </div>

      <div>
        <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--secondary);">
          Full Name <span style="color: var(--danger);">*</span>
        </label>
        <input type="text" id="edit-user-name" class="search-input" style="width: 100%;" value="${escapeHtml(user.name)}" required />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--secondary);">
            Role <span style="color: var(--danger);">*</span>
          </label>
          <select id="edit-user-role" class="select-control" style="width: 100%;" ${isSelf ? 'disabled title="You cannot demote your own account"' : ''}>
            <option value="Staff" ${user.role === 'Staff' ? 'selected' : ''}>Staff</option>
            <option value="Manager" ${user.role === 'Manager' ? 'selected' : ''}>Manager</option>
            <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>

        <div>
          <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--secondary);">
            Account Status <span style="color: var(--danger);">*</span>
          </label>
          <select id="edit-user-status" class="select-control" style="width: 100%;" ${isSelf ? 'disabled title="You cannot disable your own account"' : ''}>
            <option value="Active" ${user.status === 'Active' ? 'selected' : ''}>Active</option>
            <option value="Disabled" ${user.status === 'Disabled' ? 'selected' : ''}>Disabled</option>
          </select>
        </div>
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-outline" data-modal-close>Cancel</button>
    <button type="button" class="btn btn-primary" id="btn-save-edit-user">Save Changes</button>
  `;

  const modal = showModal({
    id: 'modal-edit-user',
    title: `Edit User: ${user.name}`,
    bodyHtml,
    footerHtml
  });

  const btnSave = modal.querySelector('#btn-save-edit-user');
  btnSave.onclick = async () => {
    const name = modal.querySelector('#edit-user-name').value.trim();
    const usernameInput = modal.querySelector('#edit-user-username');
    const username = usernameInput ? usernameInput.value.trim().toLowerCase().replace(/^@+/, '') : user.username;
    const role = modal.querySelector('#edit-user-role').value;
    const status = modal.querySelector('#edit-user-status').value;

    if (!name) {
      toast.error('Name is required.');
      return;
    }

    if (!username) {
      toast.error('Username is required.');
      return;
    }

    const isEmail = /^[a-z0-9_.+-]+@[a-z0-9-]+\.[a-z0-9-.]+$/i.test(username);
    const isStandardUsername = /^[a-z0-9_.-]{3,50}$/i.test(username);
    if (!isEmail && !isStandardUsername) {
      toast.error('Username must be 3-50 characters (letters, numbers, underscore, dot) or a valid email address.');
      return;
    }

    btnSave.disabled = true;
    btnSave.textContent = 'Saving...';

    try {
      const payload = { name, username };
      if (!isSelf) {
        payload.role = role;
        payload.status = status;
      }

      const res = await api.users.update(user.id, payload);
      if (res && res.success) {
        toast.success(`User "${name}" updated successfully!`);
        hideModal('modal-edit-user');
        await loadUsers();
      } else {
        toast.error(res?.message || 'Failed to update user.');
      }
    } catch (err) {
      toast.error(err.message || 'Error updating user');
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = 'Save Changes';
    }
  };
}

export function openResetPasswordModal(user) {
  const bodyHtml = `
    <form id="form-reset-password" style="display: flex; flex-direction: column; gap: 14px;">
      <p style="font-size: 13px; color: var(--text-muted); margin: 0;">
        Reset password for <strong>${escapeHtml(user.name)}</strong> (<code>@${escapeHtml(user.username)}</code>).
      </p>

      <div>
        <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--secondary);">
          New Password <span style="color: var(--danger);">*</span>
        </label>
        <input type="password" id="reset-pwd-input" class="search-input" style="width: 100%;" placeholder="Minimum 6 characters" required autocomplete="new-password" />
      </div>

      <div>
        <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--secondary);">
          Confirm New Password <span style="color: var(--danger);">*</span>
        </label>
        <input type="password" id="reset-pwd-confirm" class="search-input" style="width: 100%;" placeholder="Re-enter new password" required autocomplete="new-password" />
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-outline" data-modal-close>Cancel</button>
    <button type="button" class="btn btn-primary" id="btn-submit-reset-pwd">Reset Password</button>
  `;

  const modal = showModal({
    id: 'modal-reset-password',
    title: 'Reset User Password',
    bodyHtml,
    footerHtml
  });

  const btnSubmit = modal.querySelector('#btn-submit-reset-pwd');
  btnSubmit.onclick = async () => {
    const pwd = modal.querySelector('#reset-pwd-input').value;
    const confirm = modal.querySelector('#reset-pwd-confirm').value;

    if (!pwd || pwd.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    if (pwd !== confirm) {
      toast.error('Passwords do not match. Please re-enter.');
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Resetting...';

    try {
      const res = await api.users.resetPassword(user.id, { newPassword: pwd });
      if (res && res.success) {
        toast.success(`Password for "${user.name}" reset successfully.`);
        hideModal('modal-reset-password');
      } else {
        toast.error(res?.message || 'Failed to reset password.');
      }
    } catch (err) {
      toast.error(err.message || 'Error resetting password');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Reset Password';
    }
  };
}

async function toggleUserStatus(user, targetStatus) {
  showConfirmDialog({
    title: `${targetStatus === 'Disabled' ? 'Disable' : 'Enable'} Account`,
    message: `Are you sure you want to ${targetStatus === 'Disabled' ? 'disable' : 'enable'} login access for "${user.name}" (@${user.username})?`,
    confirmText: targetStatus === 'Disabled' ? 'Disable Account' : 'Enable Account',
    isDanger: targetStatus === 'Disabled',
    onConfirm: async () => {
      try {
        const res = await api.users.toggleStatus(user.id, { status: targetStatus });
        if (res && res.success) {
          toast.success(`User "${user.name}" is now ${targetStatus}.`);
          await loadUsers();
        } else {
          toast.error(res?.message || 'Failed to update account status.');
        }
      } catch (err) {
        toast.error(err.message || 'Error toggling account status');
      }
    }
  });
}

function exportUsersCSV() {
  const filtered = getFilteredUsers();
  if (filtered.length === 0) {
    toast.warning('No users to export.');
    return;
  }

  const headers = ['User ID', 'Full Name', 'Username', 'Role', 'Status', 'Created Date'];
  const rows = filtered.map(u => [
    `#${u.id}`,
    u.name,
    u.username,
    u.role,
    u.status,
    u.created_at ? formatDate(u.created_at) : ''
  ]);

  exportTableToCSV('FROMEX_Company_Users', headers, rows);
  toast.success('Company users roster exported to CSV.');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
