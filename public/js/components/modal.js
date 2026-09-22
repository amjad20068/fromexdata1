// Modal Window Manager

export function showModal({ id = 'app-dynamic-modal', title, bodyHtml, footerHtml }) {
  let backdrop = document.getElementById(id);
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = id;
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
  }

  backdrop.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button type="button" class="modal-close-btn" data-modal-close aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        ${bodyHtml}
      </div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;

  // Attach close listeners
  const closeBtn = backdrop.querySelector('[data-modal-close]');
  if (closeBtn) {
    closeBtn.onclick = () => hideModal(id);
  }

  backdrop.onclick = (e) => {
    if (e.target === backdrop) {
      hideModal(id);
    }
  };

  // Open with transition
  requestAnimationFrame(() => {
    backdrop.classList.add('open');
  });

  return backdrop;
}

export function hideModal(id = 'app-dynamic-modal') {
  const backdrop = document.getElementById(id);
  if (backdrop) {
    backdrop.classList.remove('open');
    setTimeout(() => {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }, 200);
  }
}
