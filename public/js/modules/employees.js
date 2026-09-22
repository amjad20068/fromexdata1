// Company Employee Management Module
import { api } from '../api.js';
import { state } from '../state.js';
import { toast } from '../components/toast.js';
import { showModal, hideModal } from '../components/modal.js';
import { showConfirmDialog } from '../components/confirm.js';
import { formatINR } from '../utils/formatters.js';
import { validateRequired } from '../utils/validators.js';
import { exportTableToCSV } from '../utils/export.js';

let employeesList = [];
let sortField = 'employee_code';
let sortOrder = 'ASC';
let filterStatus = 'All';
let searchQuery = '';

export function initEmployeesModule() {
  const addBtn = document.getElementById('btn-add-employee');
  if (addBtn) addBtn.onclick = () => openEmployeeModal();

  const exportBtn = document.getElementById('btn-export-employees');
  if (exportBtn) exportBtn.onclick = () => handleExportCSV();

  const searchInput = document.getElementById('employees-search-input');
  if (searchInput) {
    let timeout;
    searchInput.oninput = (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderEmployeesTable();
      }, 200);
    };
  }

  const statusFilter = document.getElementById('employees-status-filter');
  if (statusFilter) {
    statusFilter.onchange = (e) => {
      filterStatus = e.target.value;
      renderEmployeesTable();
    };
  }

  // Column sorting
  document.querySelectorAll('#employees-table th.sortable').forEach(th => {
    th.onclick = () => {
      const field = th.getAttribute('data-sort');
      if (sortField === field) {
        sortOrder = sortOrder === 'ASC' ? 'DESC' : 'ASC';
      } else {
        sortField = field;
        sortOrder = 'ASC';
      }
      renderEmployeesTable();
    };
  });

  // Listen for real-time events
  state.on('employee_data_changed', () => {
    loadEmployeesData();
  });

  state.on('tab_changed', (tabId) => {
    if (tabId === 'employees') {
      loadEmployeesData();
    }
  });

  // Make globally available for inline prompts
  window.FROMEX_OPEN_EMPLOYEE_MODAL = openEmployeeModal;

  // Initial load
  loadEmployeesData();
}

export async function loadEmployeesData() {
  try {
    const res = await api.employees.getAll();
    if (res && res.employees) {
      employeesList = res.employees;
      renderEmployeesTable();
    }
  } catch (err) {
    console.error('Failed to load employees:', err);
  }
}

function renderEmployeesTable() {
  const tbody = document.getElementById('employees-table-body');
  const countPill = document.getElementById('employees-count-pill');
  if (!tbody) return;

  // Filter
  let filtered = employeesList.filter(emp => {
    if (filterStatus !== 'All' && emp.status !== filterStatus) return false;
    if (searchQuery) {
      const matchName = emp.name && emp.name.toLowerCase().includes(searchQuery);
      const matchCode = emp.employee_code && emp.employee_code.toLowerCase().includes(searchQuery);
      const matchDesig = emp.designation && emp.designation.toLowerCase().includes(searchQuery);
      const matchPhone = emp.phone && emp.phone.toLowerCase().includes(searchQuery);
      if (!matchName && !matchCode && !matchDesig && !matchPhone) return false;
    }
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (['basic_salary', 'allowance', 'deduction'].includes(sortField)) {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    } else {
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
    }

    if (valA < valB) return sortOrder === 'ASC' ? -1 : 1;
    if (valA > valB) return sortOrder === 'ASC' ? 1 : -1;
    return 0;
  });

  if (countPill) {
    countPill.textContent = `${filtered.length} Employee${filtered.length === 1 ? '' : 's'}`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="table-empty-state" style="padding: 40px 20px; text-align: center;">
            <div class="empty-state-icon" style="font-size: 38px; margin-bottom: 8px;">👥</div>
            <div class="empty-state-title" style="font-size: 16px; font-weight: 700; color: var(--secondary); margin-bottom: 4px;">
              ${employeesList.length === 0 ? 'No Company Employees Found' : 'No Matching Employees'}
            </div>
            <div class="empty-state-desc" style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
              ${employeesList.length === 0 
                ? 'Start fresh by adding your first company employee to begin managing attendance and payroll.' 
                : 'Try adjusting your search criteria or status filter.'}
            </div>
            <button type="button" class="btn btn-primary" onclick="window.FROMEX_OPEN_EMPLOYEE_MODAL()">
              <span>+</span> Add Employee
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(emp => {
    const basic = Number(emp.basic_salary) || 0;
    const allow = Number(emp.allowance) || 0;
    const deduct = Number(emp.deduction) || 0;
    const net = basic + allow - deduct;

    const statusClass = emp.status === 'Active' 
      ? 'badge-present' 
      : (emp.status === 'On Leave' ? 'badge-leave' : 'badge-absent');

    return `
      <tr data-emp-id="${emp.id}">
        <td class="text-center cell-mono font-bold" style="color: var(--accent);">${escapeHtml(emp.employee_code)}</td>
        <td class="cell-name font-bold">${escapeHtml(emp.name)}</td>
        <td style="color: var(--secondary);">${escapeHtml(emp.designation)}</td>
        <td class="cell-mono text-muted">${escapeHtml(emp.phone || '-')}</td>
        <td class="text-right cell-mono font-bold">${formatINR(basic)}</td>
        <td class="text-right cell-mono text-muted">${formatINR(allow)}</td>
        <td class="text-right cell-mono text-danger">${formatINR(deduct)}</td>
        <td class="text-right cell-mono font-bold" style="color: #059669;">${formatINR(net)}</td>
        <td class="text-center">
          <span class="badge ${statusClass}">${escapeHtml(emp.status || 'Active')}</span>
        </td>
        <td class="text-center">
          <div class="row-actions">
            <button type="button" class="action-icon-btn btn-edit" title="Edit Employee" data-edit-emp="${emp.id}">
              ✏️
            </button>
            <button type="button" class="action-icon-btn btn-delete" title="Delete Employee" data-delete-emp="${emp.id}">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Row actions
  tbody.querySelectorAll('[data-edit-emp]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-edit-emp'), 10);
      const emp = employeesList.find(e => e.id === id);
      if (emp) openEmployeeModal(emp);
    };
  });

  tbody.querySelectorAll('[data-delete-emp]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-delete-emp'), 10);
      const emp = employeesList.find(e => e.id === id);
      if (emp) handleDeleteEmployee(emp);
    };
  });
}

export function openEmployeeModal(record = null) {
  const isEdit = !!record;
  const modalId = 'modal-employee-form';

  // Compute default next employee code if creating new
  let defaultCode = 'FRX-101';
  if (!isEdit && employeesList.length > 0) {
    const codes = employeesList
      .map(e => e.employee_code)
      .filter(c => c && c.startsWith('FRX-'))
      .map(c => parseInt(c.replace('FRX-', ''), 10))
      .filter(n => !isNaN(n));
    if (codes.length > 0) {
      defaultCode = `FRX-${Math.max(...codes) + 1}`;
    }
  }

  const code = isEdit ? record.employee_code : defaultCode;
  const name = isEdit ? record.name : '';
  const designation = isEdit ? record.designation : '';
  const phone = isEdit ? (record.phone || '') : '';
  const basic = isEdit ? (Number(record.basic_salary) || 0) : 0;
  const allow = isEdit ? (Number(record.allowance) || 0) : 0;
  const deduct = isEdit ? (Number(record.deduction) || 0) : 0;
  const status = isEdit ? (record.status || 'Active') : 'Active';

  const bodyHtml = `
    <form id="emp-form" class="modal-form" onsubmit="return false;">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="emp-form-code">Employee Code *</label>
          <input type="text" id="emp-form-code" class="input-control font-mono" value="${escapeHtml(code)}" placeholder="e.g. FRX-101" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="emp-form-name">Full Name *</label>
          <input type="text" id="emp-form-name" class="input-control" value="${escapeHtml(name)}" placeholder="e.g. Mohammed Ali" required autofocus />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="emp-form-designation">Designation / Role *</label>
          <input type="text" id="emp-form-designation" class="input-control" value="${escapeHtml(designation)}" placeholder="e.g. Operations Manager, Accountant" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="emp-form-phone">Phone Number</label>
          <input type="tel" id="emp-form-phone" class="input-control" value="${escapeHtml(phone)}" placeholder="e.g. +91 98200 00000" />
        </div>
      </div>

      <div style="font-size: 13px; font-weight: 700; color: var(--secondary); margin-top: 10px; margin-bottom: 6px;">
        Monthly Salary Structure (₹)
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="emp-form-basic">Basic Salary</label>
          <input type="number" id="emp-form-basic" class="input-control font-mono" min="0" step="100" value="${basic}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="emp-form-allow">Monthly Allowance</label>
          <input type="number" id="emp-form-allow" class="input-control font-mono" min="0" step="100" value="${allow}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="emp-form-deduct">Monthly Deduction</label>
          <input type="number" id="emp-form-deduct" class="input-control font-mono" min="0" step="100" value="${deduct}" />
        </div>
      </div>

      <div class="formula-box" style="margin-top: 4px; margin-bottom: 12px;">
        <span class="formula-label">Calculated Net Monthly Package:</span>
        <div class="formula-result" id="emp-calc-net" style="font-size: 16px; color: #059669;">
          ${formatINR(basic + allow - deduct)}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="emp-form-status">Employment Status *</label>
        <select id="emp-form-status" class="select-control">
          <option value="Active" ${status === 'Active' ? 'selected' : ''}>Active</option>
          <option value="On Leave" ${status === 'On Leave' ? 'selected' : ''}>On Leave</option>
          <option value="Inactive" ${status === 'Inactive' ? 'selected' : ''}>Inactive</option>
        </select>
      </div>

      <div id="emp-form-error" style="display:none; color: #dc2626; font-size: 12px; font-weight: 600; margin-top: 8px;"></div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-outline" data-modal-close>Cancel</button>
    <button type="button" id="emp-form-save-btn" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Employee'}</button>
  `;

  const modal = showModal({
    id: modalId,
    title: isEdit ? `Edit Employee: ${record.name} (${record.employee_code})` : 'Add New Company Employee',
    bodyHtml,
    footerHtml
  });

  // Dynamic Net package preview calculation
  const basicEl = modal.querySelector('#emp-form-basic');
  const allowEl = modal.querySelector('#emp-form-allow');
  const deductEl = modal.querySelector('#emp-form-deduct');
  const netEl = modal.querySelector('#emp-calc-net');

  function updateNetPreview() {
    const b = Number(basicEl.value) || 0;
    const a = Number(allowEl.value) || 0;
    const d = Number(deductEl.value) || 0;
    netEl.textContent = formatINR(b + a - d);
  }

  basicEl.oninput = updateNetPreview;
  allowEl.oninput = updateNetPreview;
  deductEl.oninput = updateNetPreview;

  // Save handler
  const saveBtn = modal.querySelector('#emp-form-save-btn');
  const errorEl = modal.querySelector('#emp-form-error');

  saveBtn.onclick = async () => {
    errorEl.style.display = 'none';

    const empCode = modal.querySelector('#emp-form-code').value.trim();
    const empName = modal.querySelector('#emp-form-name').value.trim();
    const empDesig = modal.querySelector('#emp-form-designation').value.trim();
    const empPhone = modal.querySelector('#emp-form-phone').value.trim();
    const basicVal = Number(basicEl.value) || 0;
    const allowVal = Number(allowEl.value) || 0;
    const deductVal = Number(deductEl.value) || 0;
    const statusVal = modal.querySelector('#emp-form-status').value;

    const errName = validateRequired(empName, 'Employee Name');
    const errDesig = validateRequired(empDesig, 'Designation');
    if (errName || errDesig) {
      errorEl.textContent = errName || errDesig;
      errorEl.style.display = 'block';
      return;
    }

    const payload = {
      employee_code: empCode,
      name: empName,
      designation: empDesig,
      phone: empPhone,
      basic_salary: basicVal,
      allowance: allowVal,
      deduction: deductVal,
      status: statusVal
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (isEdit) {
        await api.employees.update(record.id, payload);
        toast.success(`Employee "${empName}" updated successfully`);
      } else {
        await api.employees.create(payload);
        toast.success(`Employee "${empName}" added to company records`);
      }

      hideModal(modalId);
      await state.loadEmployees();
      await loadEmployeesData();
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to save employee';
      errorEl.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Employee';
    }
  };
}

async function handleDeleteEmployee(emp) {
  const confirmed = await showConfirmDialog({
    title: `Delete Employee: ${emp.name}?`,
    message: `Are you sure you want to delete ${emp.name} (${emp.employee_code})? Any linked attendance or salary records will prevent deletion to preserve audit history.`,
    confirmText: 'Delete Employee',
    danger: true
  });

  if (!confirmed) return;

  try {
    await api.employees.delete(emp.id);
    toast.success(`Employee "${emp.name}" deleted`);
    await state.loadEmployees();
    await loadEmployeesData();
  } catch (err) {
    toast.error(err.message || 'Failed to delete employee');
  }
}

function handleExportCSV() {
  exportTableToCSV('employees-table', 'FROMEX_Employees_Roster.csv');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
