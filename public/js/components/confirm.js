// Confirmation Dialog Component
import { showModal, hideModal } from './modal.js';

export function showConfirmDialog({
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  note = 'This action will be recorded in the system audit log.',
  confirmText = 'Confirm',
  confirmClass = 'btn-danger',
  cancelText = 'Cancel',
  onConfirm
}) {
  const modalId = 'app-confirm-dialog';

  const bodyHtml = `
    <div style="display: flex; gap: 14px; align-items: flex-start; padding: 4px 0;">
      <div style="font-size: 28px; line-height: 1;">⚠️</div>
      <div>
        <p style="font-size: 14px; color: var(--text-main); font-weight: 500; margin-bottom: 6px;">${message}</p>
        <p style="font-size: 12px; color: var(--text-muted);">${note}</p>
      </div>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-outline" data-modal-cancel>${cancelText}</button>
    <button type="button" class="btn ${confirmClass}" data-modal-confirm>${confirmText}</button>
  `;

  const modal = showModal({ id: modalId, title, bodyHtml, footerHtml });

  const cancelBtn = modal.querySelector('[data-modal-cancel]');
  const confirmBtn = modal.querySelector('[data-modal-confirm]');

  cancelBtn.onclick = () => hideModal(modalId);
  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';
    try {
      if (onConfirm) await onConfirm();
    } finally {
      hideModal(modalId);
    }
  };
}
