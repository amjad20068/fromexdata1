// Authentication & User Switcher Module
import { api } from '../api.js';
import { state } from '../state.js';
import { showModal, hideModal } from '../components/modal.js';

export function initAuthModule() {
  const userProfileBtn = document.getElementById('user-profile-btn');
  if (userProfileBtn) {
    userProfileBtn.onclick = () => openUserSwitcherModal();
  }

  state.on('user_changed', (user) => {
    updateHeaderUser(user);
  });
}

function updateHeaderUser(user) {
  if (!user) return;
  const avatarEl = document.getElementById('header-user-avatar');
  const nameEl = document.getElementById('header-user-name');
  const roleEl = document.getElementById('header-user-role');

  if (avatarEl) avatarEl.textContent = user.avatar || (user.name.toUpperCase() === 'FROMEX' ? 'FX' : user.name.charAt(0));
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = user.role;
}

export async function openUserSwitcherModal() {
  try {
    const res = await api.auth.getUsers();
    if (!res.success) return;

    const users = res.users;
    const current = state.currentUser;

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <p style="font-size: 13px; color: var(--text-muted); margin: 0;">
          Switch active user to test multi-user concurrent workflows on the shared PostgreSQL database. All changes synchronize in real time.
        </p>

        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow-y: auto;">
          ${users.map(u => {
            const isCurrent = current && current.id === u.id;
            const isDisabled = u.status === 'Disabled';
            return `
            <div class="user-switch-card ${isCurrent ? 'active-user' : ''}"
                 data-switch-user-id="${u.id}"
                 data-user-disabled="${isDisabled ? 'true' : 'false'}"
                 style="
                   display: flex;
                   align-items: center;
                   justify-content: space-between;
                   padding: 12px 16px;
                   border: 1px solid ${isCurrent ? 'var(--accent)' : 'var(--border-color)'};
                   background: ${isCurrent ? 'var(--primary-light)' : (isDisabled ? '#f8fafc' : '#ffffff')};
                   border-radius: var(--radius-md);
                   cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
                   opacity: ${isDisabled ? '0.6' : '1'};
                   transition: all 0.15s ease;
                 ">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div class="user-avatar" style="width: 36px; height: 36px; font-size: 13px; background: ${u.role === 'Admin' ? '#7c3aed' : (u.role === 'Manager' ? '#0284c7' : '#0d9488')}; color: #fff;">
                  ${u.name.charAt(0)}
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 13.5px; color: var(--secondary);">
                    ${u.name}
                    ${isCurrent ? '<span class="badge" style="background:#e0e7ff; color:#3730a3; margin-left: 6px; font-size: 10px;">Current</span>' : ''}
                  </div>
                  <div style="font-size: 11.5px; color: var(--text-muted);">
                    <span style="font-weight: 600;">${u.role}</span> &bull; @${u.username}
                  </div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge ${u.status === 'Active' ? 'badge-paid' : 'badge-absent'}" style="font-size: 10px;">
                  ${u.status || 'Active'}
                </span>
                ${isCurrent
                  ? `<span style="font-size: 12px; font-weight: 700; color: var(--accent);">Active Session</span>`
                  : `<button type="button" class="btn btn-outline btn-sm" ${isDisabled ? 'disabled title="Account is disabled"' : ''}>Switch</button>`
                }
              </div>
            </div>
          `;
          }).join('')}
        </div>
      </div>
    `;

    const footerHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span style="font-size: 12px; color: var(--text-muted); font-family: var(--font-mono);">${users.length} Company Users</span>
        <button type="button" class="btn btn-outline" data-modal-close>Close</button>
      </div>
    `;

    const modal = showModal({
      id: 'modal-user-switcher',
      title: 'Company User Switcher (Shared DB Session)',
      bodyHtml,
      footerHtml
    });

    // Attach click handlers
    modal.querySelectorAll('[data-switch-user-id]').forEach(card => {
      card.onclick = async () => {
        if (card.getAttribute('data-user-disabled') === 'true') {
          return;
        }
        const userId = parseInt(card.getAttribute('data-switch-user-id'), 10);
        const selectedUser = users.find(u => u.id === userId);
        if (selectedUser) {
          try {
            const loginRes = await api.auth.login({ username: selectedUser.username, password: 'fromex123' });
            if (loginRes.success && loginRes.user) {
              state.setCurrentUser(loginRes.user, loginRes.token);
            } else {
              state.setCurrentUser(selectedUser);
            }
          } catch (e) {
            state.setCurrentUser(selectedUser);
          }
          hideModal('modal-user-switcher');
        }
      };
    });

  } catch (err) {
    console.error('Failed to open user switcher:', err);
  }
}
