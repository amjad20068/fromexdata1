// Accounting & Payroll Management Module
import { api } from '../api.js';
import { state } from '../state.js';
import { toast } from '../components/toast.js';
import { showModal, hideModal } from '../components/modal.js';
import { showConfirmDialog } from '../components/confirm.js';
import {
  formatINR,
  calculateNetSalary,
  renderPaymentBadge,
  renderTxnTypeBadge
} from '../utils/formatters.js';
import {
  validateRequired,
  validatePositiveNumber
} from '../utils/validators.js';
import { exportTableToCSV } from '../utils/export.js';

let activeSubTab = 'salaries'; // 'salaries' | 'transactions'

let salaryFilters = {
  month: 'September 2026',
  status: 'All',
  search: '',
  sortField: 'id',
  sortOrder: 'ASC'
};

let txnFilters = {
  type: 'All',
  search: '',
  sortField: 'date',
  sortOrder: 'ASC'
};

let currentSalaries = [];
let currentTransactions = [];

export function initAccountingModule() {
  // Sub-tab toggling (Salaries vs Transactions)
  const salaryTabBtn = document.getElementById('btn-subtab-salaries');
  const txnTabBtn = document.getElementById('btn-subtab-transactions');

  if (salaryTabBtn && txnTabBtn) {
    salaryTabBtn.onclick = () => switchSubTab('salaries');
    txnTabBtn.onclick = () => switchSubTab('transactions');
  }

  // Salary Controls
  const addSalaryBtn = document.getElementById('btn-add-salary');
  if (addSalaryBtn) addSalaryBtn.onclick = () => openSalaryModal();

  const exportSalaryBtn = document.getElementById('btn-export-salaries');
  if (exportSalaryBtn) exportSalaryBtn.onclick = () => handleExportSalariesCSV();

  const salaryMonthSelect = document.getElementById('salary-month-filter');
  if (salaryMonthSelect) {
    salaryMonthSelect.onchange = (e) => {
      salaryFilters.month = e.target.value;
      loadSalariesData();
      loadAccountingSummary();
    };
  }

  const salaryStatusSelect = document.getElementById('salary-status-filter');
  if (salaryStatusSelect) {
    salaryStatusSelect.onchange = (e) => {
      salaryFilters.status = e.target.value;
      loadSalariesData();
    };
  }

  const salarySearchInput = document.getElementById('salary-search');
  if (salarySearchInput) {
    let timeout;
    salarySearchInput.oninput = (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        salaryFilters.search = e.target.value;
        loadSalariesData();
      }, 250);
    };
  }

  // Transaction Controls
  const addTxnBtn = document.getElementById('btn-add-transaction');
  if (addTxnBtn) addTxnBtn.onclick = () => openTransactionModal();

  const exportTxnBtn = document.getElementById('btn-export-transactions');
  if (exportTxnBtn) exportTxnBtn.onclick = () => handleExportTransactionsCSV();

  const txnTypeSelect = document.getElementById('txn-type-filter');
  if (txnTypeSelect) {
    txnTypeSelect.onchange = (e) => {
      txnFilters.type = e.target.value;
      loadTransactionsData();
    };
  }

  const txnSearchInput = document.getElementById('txn-search');
  if (txnSearchInput) {
    let timeout;
    txnSearchInput.oninput = (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        txnFilters.search = e.target.value;
        loadTransactionsData();
      }, 250);
    };
  }

  // Real-time synchronization
  state.on('accounting_data_changed', () => {
    loadAccountingSummary();
    if (activeSubTab === 'salaries') loadSalariesData();
    else loadTransactionsData();
  });

  state.on('tab_changed', (tabId) => {
    if (tabId === 'accounting') {
      loadAccountingSummary();
      loadSalariesData();
      loadTransactionsData();
    }
  });

  loadAccountingSummary();
  loadSalariesData();
  loadTransactionsData();
}

function switchSubTab(subTab) {
  activeSubTab = subTab;
  const salaryTabBtn = document.getElementById('btn-subtab-salaries');
  const txnTabBtn = document.getElementById('btn-subtab-transactions');
  const salarySection = document.getElementById('accounting-salaries-section');
  const txnSection = document.getElementById('accounting-transactions-section');

  if (subTab === 'salaries') {
    salaryTabBtn.classList.add('btn-primary');
    salaryTabBtn.classList.remove('btn-outline');
    txnTabBtn.classList.remove('btn-primary');
    txnTabBtn.classList.add('btn-outline');

    if (salarySection) salarySection.style.display = 'flex';
    if (txnSection) txnSection.style.display = 'none';
    loadSalariesData();
  } else {
    txnTabBtn.classList.add('btn-primary');
    txnTabBtn.classList.remove('btn-outline');
    salaryTabBtn.classList.remove('btn-primary');
    salaryTabBtn.classList.add('btn-outline');

    if (salarySection) salarySection.style.display = 'none';
    if (txnSection) txnSection.style.display = 'flex';
    loadTransactionsData();
  }
}

export async function loadAccountingSummary() {
  try {
    const res = await api.accounting.getSummary({ month: salaryFilters.month });
    if (!res.success) return;

    // Update Summary Header Pills
    const incEl = document.getElementById('acc-summary-income');
    const expEl = document.getElementById('acc-summary-expense');
    const balEl = document.getElementById('acc-summary-balance');
    const payrollEl = document.getElementById('acc-summary-payroll');

    if (incEl) incEl.textContent = formatINR(res.totalIncome);
    if (expEl) expEl.textContent = formatINR(res.totalExpense);
    if (balEl) {
      balEl.textContent = formatINR(res.balance);
      balEl.style.color = res.balance >= 0 ? '#059669' : '#dc2626';
    }
    if (payrollEl && res.payroll) {
      payrollEl.textContent = formatINR(res.payroll.totalNetSalary);
    }
  } catch (err) {
    console.error('Failed to load accounting summary:', err);
  }
}

// ===================================================
// 1. SALARY SECTION
// ===================================================

export async function loadSalariesData() {
  try {
    const res = await api.accounting.getSalaries(salaryFilters);
    if (!res.success) return;

    currentSalaries = res.salaries || [];
    renderSalariesTable(currentSalaries);
  } catch (err) {
    console.error('Failed to load salaries:', err);
    toast.error('Failed to load salary payroll data');
  }
}

function renderSalariesTable(salaries) {
  const tbody = document.getElementById('salaries-table-body');
  const countPill = document.getElementById('salaries-count-pill');
  if (!tbody) return;

  if (countPill) countPill.textContent = `${salaries.length} Records`;

  if (salaries.length === 0) {
    const table = document.getElementById('salaries-table');
    if (table) {
      const existingFoot = table.querySelector('tfoot');
      if (existingFoot) existingFoot.remove();
    }
    tbody.innerHTML = `
      <tr>
        <td colspan="11">
          <div class="table-empty-state">
            <div class="empty-state-icon">💼</div>
            <div class="empty-state-title">No Salary Slips Found</div>
            <div class="empty-state-desc">No salary entries recorded yet. Add your first employee and record a salary slip.</div>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.FROMEX_OPEN_SALARY_MODAL()">+ Add Salary Slip</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  let totalBasic = 0;
  let totalAllow = 0;
  let totalDeduct = 0;
  let totalNet = 0;

  const rowsHtml = salaries.map(s => {
    totalBasic += (s.basic_salary || 0);
    totalAllow += (s.allowance || 0);
    totalDeduct += (s.deduction || 0);
    totalNet += (s.net_salary || 0);

    return `
      <tr data-salary-id="${s.id}">
        <td class="cell-emp-id">${s.emp_id}</td>
        <td class="cell-name">${s.emp_name}</td>
        <td class="text-center cell-mono">${s.month}</td>
        <td class="cell-currency">${formatINR(s.basic_salary)}</td>
        <td class="cell-currency" style="color:#059669;">+${formatINR(s.allowance)}</td>
        <td class="cell-currency" style="color:#dc2626;">-${formatINR(s.deduction)}</td>
        <td class="cell-currency" style="font-weight:800; font-size:13.5px; color:var(--primary); background: #f8fafc;">
          ${formatINR(s.net_salary)}
        </td>
        <td class="text-center cell-mono">${s.payment_date || '-'}</td>
        <td class="text-center">${renderPaymentBadge(s.payment_status)}</td>
        <td style="max-width: 180px; text-overflow: ellipsis; overflow: hidden; color: var(--text-muted); font-size: 12px;">
          ${s.remarks || '-'}
        </td>
        <td class="text-center">
          <div class="row-actions">
            <button type="button" class="action-icon-btn btn-edit" title="Edit Salary" data-edit-sal="${s.id}">✏️</button>
            <button type="button" class="action-icon-btn btn-delete" title="Delete Salary" data-delete-sal="${s.id}">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Excel Total / Summary Footer Row
  const footerHtml = `
    <tfoot>
      <tr>
        <td colspan="3" style="font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Summary Total (${salaries.length} Employees)</td>
        <td class="cell-currency" style="font-weight:800;">${formatINR(totalBasic)}</td>
        <td class="cell-currency" style="font-weight:800; color:#059669;">+${formatINR(totalAllow)}</td>
        <td class="cell-currency" style="font-weight:800; color:#dc2626;">-${formatINR(totalDeduct)}</td>
        <td class="cell-currency" style="font-weight:900; font-size:14px; color:var(--primary); background:#e2e8f0;">${formatINR(totalNet)}</td>
        <td colspan="4"></td>
      </tr>
    </tfoot>
  `;

  tbody.innerHTML = rowsHtml;

  // Append or replace tfoot in table
  const table = document.getElementById('salaries-table');
  const existingFoot = table.querySelector('tfoot');
  if (existingFoot) existingFoot.remove();
  table.insertAdjacentHTML('beforeend', footerHtml);

  // Bind Actions
  tbody.querySelectorAll('[data-edit-sal]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-edit-sal'), 10);
      const s = salaries.find(item => item.id === id);
      if (s) openSalaryModal(s);
    };
  });

  tbody.querySelectorAll('[data-delete-sal]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-delete-sal'), 10);
      const s = salaries.find(item => item.id === id);
      if (s) handleDeleteSalary(s);
    };
  });

  // Sort headers
  document.querySelectorAll('#salaries-table th.sortable').forEach(th => {
    th.onclick = () => {
      const field = th.getAttribute('data-sort');
      if (salaryFilters.sortField === field) {
        salaryFilters.sortOrder = salaryFilters.sortOrder === 'ASC' ? 'DESC' : 'ASC';
      } else {
        salaryFilters.sortField = field;
        salaryFilters.sortOrder = 'ASC';
      }
      loadSalariesData();
    };
  });
}

window.FROMEX_OPEN_SALARY_MODAL = () => openSalaryModal();

export function openSalaryModal(record = null) {
  const isEdit = !!record;
  const modalId = 'modal-salary-form';

  const emps = state.allEmployees;
  if (!isEdit && emps.length === 0) {
    toast.info('No employees found in company records. Please add an employee first to record salary slips.');
    if (typeof window.FROMEX_OPEN_EMPLOYEE_MODAL === 'function') {
      window.FROMEX_OPEN_EMPLOYEE_MODAL();
    }
    return;
  }

  const defaultEmpId = record ? record.emp_id : (emps.length > 0 ? (emps[0].employee_code || emps[0].emp_id) : '');
  const defaultMonth = record ? record.month : salaryFilters.month;
  const defaultBasic = record ? record.basic_salary : (emps.length > 0 ? (Number(emps[0].basic_salary) || 0) : 0);
  const defaultAllow = record ? record.allowance : (emps.length > 0 ? (Number(emps[0].allowance) || 0) : 0);
  const defaultDeduct = record ? record.deduction : (emps.length > 0 ? (Number(emps[0].deduction) || 0) : 0);
  const defaultDate = record ? (record.payment_date || '') : '2026-09-30';
  const defaultStatus = record ? record.payment_status : 'Pending';
  const defaultRemarks = record ? (record.remarks || '') : '';

  const initialNet = calculateNetSalary(defaultBasic, defaultAllow, defaultDeduct);

  const bodyHtml = `
    <form id="salary-form" style="display: flex; flex-direction: column; gap: 14px;">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="sal-form-emp">Employee *</label>
          <select id="sal-form-emp" class="select-control" ${isEdit ? 'disabled' : ''} required>
            ${emps.map(e => {
              const code = e.employee_code || e.emp_id;
              const base = Number(e.basic_salary) || 0;
              return `
                <option value="${code}" data-name="${e.name}" data-base="${base}" ${code === defaultEmpId ? 'selected' : ''}>
                  ${e.name} (${code}) &bull; Base: ${formatINR(base)}
                </option>
              `;
            }).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="sal-form-month">Payroll Month *</label>
          <select id="sal-form-month" class="select-control" required>
            <option value="September 2026" ${defaultMonth === 'September 2026' ? 'selected' : ''}>September 2026</option>
            <option value="August 2026" ${defaultMonth === 'August 2026' ? 'selected' : ''}>August 2026</option>
            <option value="July 2026" ${defaultMonth === 'July 2026' ? 'selected' : ''}>July 2026</option>
            <option value="October 2026" ${defaultMonth === 'October 2026' ? 'selected' : ''}>October 2026</option>
          </select>
        </div>
      </div>

      <!-- Live Calculation Formula Card -->
      <div class="formula-box">
        <div class="formula-title">Live Formula: Net Salary = Basic Salary + Allowance - Deduction</div>
        <div class="formula-display" id="sal-formula-calc">
          ${formatINR(defaultBasic)} + ${formatINR(defaultAllow)} - ${formatINR(defaultDeduct)}
        </div>
        <div class="formula-result" id="sal-net-display">
          = ${formatINR(initialNet)}
        </div>
      </div>

      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label" for="sal-form-basic">Basic Salary (₹) *</label>
          <input type="number" id="sal-form-basic" class="input-control" value="${defaultBasic}" min="0" step="500" required />
        </div>

        <div class="form-group">
          <label class="form-label" for="sal-form-allow">Allowance (₹)</label>
          <input type="number" id="sal-form-allow" class="input-control" value="${defaultAllow}" min="0" step="500" />
        </div>

        <div class="form-group">
          <label class="form-label" for="sal-form-deduct">Deduction (₹)</label>
          <input type="number" id="sal-form-deduct" class="input-control" value="${defaultDeduct}" min="0" step="100" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="sal-form-status">Payment Status *</label>
          <select id="sal-form-status" class="select-control" required>
            <option value="Pending" ${defaultStatus === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Processing" ${defaultStatus === 'Processing' ? 'selected' : ''}>Processing</option>
            <option value="Paid" ${defaultStatus === 'Paid' ? 'selected' : ''}>Paid</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="sal-form-date">Payment Date</label>
          <input type="date" id="sal-form-date" class="input-control" value="${defaultDate}" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="sal-form-remarks">Remarks</label>
        <input type="text" id="sal-form-remarks" class="input-control" placeholder="e.g. Disbursed via Bank Transfer / Quarterly Bonus" value="${defaultRemarks}" />
      </div>

      <div id="sal-form-error" style="display:none; color: #dc2626; font-size: 12px; font-weight: 600;"></div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-outline" data-modal-close>Cancel</button>
    <button type="button" id="sal-form-save-btn" class="btn btn-primary">${isEdit ? 'Update Salary' : 'Add Salary Slip'}</button>
  `;

  const modal = showModal({
    id: modalId,
    title: isEdit ? `Edit Salary: ${record.emp_name} (${record.month})` : 'Add Employee Salary Record',
    bodyHtml,
    footerHtml
  });

  // Dynamic Live Formula Recalculation
  const basicEl = modal.querySelector('#sal-form-basic');
  const allowEl = modal.querySelector('#sal-form-allow');
  const deductEl = modal.querySelector('#sal-form-deduct');
  const formulaCalcEl = modal.querySelector('#sal-formula-calc');
  const netDisplayEl = modal.querySelector('#sal-net-display');
  const empSelectEl = modal.querySelector('#sal-form-emp');

  function updateLiveNetSalary() {
    const basic = Math.max(0, Number(basicEl.value) || 0);
    const allow = Math.max(0, Number(allowEl.value) || 0);
    const deduct = Math.max(0, Number(deductEl.value) || 0);
    const net = calculateNetSalary(basic, allow, deduct);

    formulaCalcEl.textContent = `${formatINR(basic)} + ${formatINR(allow)} - ${formatINR(deduct)}`;
    netDisplayEl.textContent = `= ${formatINR(net)}`;
  }

  // Auto-populate base salary on employee change
  if (!isEdit && empSelectEl) {
    empSelectEl.onchange = () => {
      const selected = empSelectEl.options[empSelectEl.selectedIndex];
      const baseVal = selected.getAttribute('data-base');
      if (baseVal && Number(baseVal) > 0) {
        basicEl.value = Number(baseVal);
        updateLiveNetSalary();
      }
    };
  }

  basicEl.oninput = updateLiveNetSalary;
  allowEl.oninput = updateLiveNetSalary;
  deductEl.oninput = updateLiveNetSalary;

  // Save handler
  const saveBtn = modal.querySelector('#sal-form-save-btn');
  const errorEl = modal.querySelector('#sal-form-error');

  saveBtn.onclick = async () => {
    errorEl.style.display = 'none';

    const empId = isEdit ? record.emp_id : empSelectEl.value;
    const selectedOption = empSelectEl.options[empSelectEl.selectedIndex];
    const empName = isEdit ? record.emp_name : (selectedOption ? selectedOption.getAttribute('data-name') : '');
    const month = modal.querySelector('#sal-form-month').value;
    const basic = Number(basicEl.value);
    const allow = Number(allowEl.value);
    const deduct = Number(deductEl.value);
    const payStatus = modal.querySelector('#sal-form-status').value;
    const payDate = modal.querySelector('#sal-form-date').value;
    const remarks = modal.querySelector('#sal-form-remarks').value;

    const errEmp = validateRequired(empId, 'Employee') || validateRequired(month, 'Month');
    const errNum = validatePositiveNumber(basic, 'Basic Salary');

    if (errEmp || errNum) {
      errorEl.textContent = errEmp || errNum;
      errorEl.style.display = 'block';
      return;
    }

    const payload = {
      emp_id: empId,
      emp_name: empName,
      month,
      basic_salary: basic,
      allowance: allow,
      deduction: deduct,
      payment_status: payStatus,
      payment_date: payDate,
      remarks
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (isEdit) {
        const res = await api.accounting.updateSalary(record.id, payload);
        if (res.success) {
          toast.success(`Updated salary for ${res.salary.emp_name}`);
          hideModal(modalId);
          loadSalariesData();
          loadAccountingSummary();
        }
      } else {
        const res = await api.accounting.createSalary(payload);
        if (res.success) {
          toast.success(`Added salary for ${res.salary.emp_name}`);
          hideModal(modalId);
          loadSalariesData();
          loadAccountingSummary();
        }
      }
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to save salary record';
      errorEl.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Update Salary' : 'Add Salary Slip';
    }
  };
}

function handleDeleteSalary(record) {
  showConfirmDialog({
    title: 'Delete Salary Slip',
    message: `Are you sure you want to delete the salary record for "${record.emp_name}" (${record.month})?`,
    confirmText: 'Yes, Delete Slip',
    onConfirm: async () => {
      try {
        const res = await api.accounting.deleteSalary(record.id);
        if (res.success) {
          toast.success(res.message || 'Salary record deleted');
          loadSalariesData();
          loadAccountingSummary();
        }
      } catch (err) {
        toast.error(err.message || 'Failed to delete salary record');
      }
    }
  });
}

function handleExportSalariesCSV() {
  if (currentSalaries.length === 0) {
    toast.info('No salary records to export');
    return;
  }

  const headers = ['Employee ID', 'Employee Name', 'Month', 'Basic Salary', 'Allowance', 'Deduction', 'Net Salary', 'Payment Date', 'Payment Status', 'Remarks'];
  const rows = currentSalaries.map(s => [
    s.emp_id,
    s.emp_name,
    s.month,
    s.basic_salary,
    s.allowance,
    s.deduction,
    s.net_salary,
    s.payment_date,
    s.payment_status,
    s.remarks
  ]);

  exportTableToCSV(`FROMEX_Salaries_${salaryFilters.month.replace(/\s+/g, '_')}`, headers, rows);
  toast.success(`Exported ${currentSalaries.length} salary records to CSV`);
}

// ===================================================
// 2. TRANSACTIONS SECTION
// ===================================================

export async function loadTransactionsData() {
  try {
    const res = await api.accounting.getTransactions(txnFilters);
    if (!res.success) return;

    currentTransactions = res.transactions || [];
    renderTransactionsTable(currentTransactions);
  } catch (err) {
    console.error('Failed to load transactions:', err);
    toast.error('Failed to load transaction ledger');
  }
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('transactions-table-body');
  const countPill = document.getElementById('transactions-count-pill');
  if (!tbody) return;

  if (countPill) countPill.textContent = `${transactions.length} Entries`;

  if (transactions.length === 0) {
    const table = document.getElementById('transactions-table');
    if (table) {
      const existingFoot = table.querySelector('tfoot');
      if (existingFoot) existingFoot.remove();
    }
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="table-empty-state">
            <div class="empty-state-icon">🏦</div>
            <div class="empty-state-title">No Accounting Entries Found</div>
            <div class="empty-state-desc">No company transactions recorded yet. Click below to record your opening balance or first transaction.</div>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.FROMEX_OPEN_TRANSACTION_MODAL()">+ Record Transaction</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  let totalIncome = 0;
  let totalExpense = 0;

  const rowsHtml = transactions.map(t => {
    totalIncome += (t.income || 0);
    totalExpense += (t.expense || 0);

    return `
      <tr data-txn-id="${t.id}">
        <td class="text-center cell-mono">${t.date}</td>
        <td class="text-center">${renderTxnTypeBadge(t.type)}</td>
        <td class="cell-name">${t.description}</td>
        <td style="color: var(--secondary); font-weight: 500;">${t.party}</td>
        <td class="cell-currency cell-income">${t.income > 0 ? formatINR(t.income) : '-'}</td>
        <td class="cell-currency cell-expense">${t.expense > 0 ? formatINR(t.expense) : '-'}</td>
        <td class="cell-currency cell-balance" style="background: #f8fafc;">${formatINR(t.balance)}</td>
        <td style="max-width: 180px; text-overflow: ellipsis; overflow: hidden; color: var(--text-muted); font-size: 12px;">
          ${t.remarks || '-'}
        </td>
        <td class="text-center">
          <div class="row-actions">
            <button type="button" class="action-icon-btn btn-edit" title="Edit Transaction" data-edit-txn="${t.id}">✏️</button>
            <button type="button" class="action-icon-btn btn-delete" title="Delete Transaction" data-delete-txn="${t.id}">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Running Ledger Total Footer
  const netEndingBalance = totalIncome - totalExpense;
  const footerHtml = `
    <tfoot>
      <tr>
        <td colspan="4" style="font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Ledger Totals (${transactions.length} Transactions)</td>
        <td class="cell-currency cell-income" style="font-weight:800;">${formatINR(totalIncome)}</td>
        <td class="cell-currency cell-expense" style="font-weight:800;">${formatINR(totalExpense)}</td>
        <td class="cell-currency cell-balance" style="font-weight:900; font-size:14px; background:#e2e8f0;">${formatINR(netEndingBalance)}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  `;

  tbody.innerHTML = rowsHtml;

  const table = document.getElementById('transactions-table');
  const existingFoot = table.querySelector('tfoot');
  if (existingFoot) existingFoot.remove();
  table.insertAdjacentHTML('beforeend', footerHtml);

  // Bind Actions
  tbody.querySelectorAll('[data-edit-txn]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-edit-txn'), 10);
      const t = transactions.find(item => item.id === id);
      if (t) openTransactionModal(t);
    };
  });

  tbody.querySelectorAll('[data-delete-txn]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-delete-txn'), 10);
      const t = transactions.find(item => item.id === id);
      if (t) handleDeleteTransaction(t);
    };
  });

  // Sort headers
  document.querySelectorAll('#transactions-table th.sortable').forEach(th => {
    th.onclick = () => {
      const field = th.getAttribute('data-sort');
      if (txnFilters.sortField === field) {
        txnFilters.sortOrder = txnFilters.sortOrder === 'ASC' ? 'DESC' : 'ASC';
      } else {
        txnFilters.sortField = field;
        txnFilters.sortOrder = 'ASC';
      }
      loadTransactionsData();
    };
  });
}

window.FROMEX_OPEN_TRANSACTION_MODAL = () => openTransactionModal();

export function openTransactionModal(record = null) {
  const isEdit = !!record;
  const modalId = 'modal-txn-form';

  const defaultDate = record ? record.date : new Date().toISOString().split('T')[0];
  const defaultType = record ? record.type : 'Income';
  const defaultDesc = record ? record.description : '';
  const defaultParty = record ? record.party : '';
  const defaultIncome = record ? record.income : 0;
  const defaultExpense = record ? record.expense : 0;
  const defaultRemarks = record ? (record.remarks || '') : '';

  const bodyHtml = `
    <form id="txn-form" style="display: flex; flex-direction: column; gap: 14px;">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="txn-form-date">Transaction Date *</label>
          <input type="date" id="txn-form-date" class="input-control" value="${defaultDate}" required />
        </div>

        <div class="form-group">
          <label class="form-label" for="txn-form-type">Transaction Type *</label>
          <select id="txn-form-type" class="select-control" required>
            <option value="Income" ${defaultType === 'Income' ? 'selected' : ''}>Income (Revenue / Retainer)</option>
            <option value="Expense" ${defaultType === 'Expense' ? 'selected' : ''}>Expense (Operating / Vendor)</option>
            <option value="Salary" ${defaultType === 'Salary' ? 'selected' : ''}>Salary (Payroll / Contractors)</option>
            <option value="Other" ${defaultType === 'Other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="txn-form-desc">Description *</label>
        <input type="text" id="txn-form-desc" class="input-control" placeholder="e.g. Enterprise Client Milestone Retainer, Cloud Hosting Bill" value="${defaultDesc}" required />
      </div>

      <div class="form-group">
        <label class="form-label" for="txn-form-party">Employee / Party / Client *</label>
        <input type="text" id="txn-form-party" class="input-control" placeholder="e.g. Tata Consultancy Services, Amazon Web Services" value="${defaultParty}" required />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="txn-form-income">Income (₹)</label>
          <input type="number" id="txn-form-income" class="input-control" value="${defaultIncome}" min="0" step="500" />
        </div>

        <div class="form-group">
          <label class="form-label" for="txn-form-expense">Expense (₹)</label>
          <input type="number" id="txn-form-expense" class="input-control" value="${defaultExpense}" min="0" step="500" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="txn-form-remarks">Remarks</label>
        <input type="text" id="txn-form-remarks" class="input-control" placeholder="e.g. Invoice #FRX-2026-091, Approved by Director" value="${defaultRemarks}" />
      </div>

      <div id="txn-form-error" style="display:none; color: #dc2626; font-size: 12px; font-weight: 600;"></div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-outline" data-modal-close>Cancel</button>
    <button type="button" id="txn-form-save-btn" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Record Transaction'}</button>
  `;

  const modal = showModal({
    id: modalId,
    title: isEdit ? `Edit Transaction: ${record.description}` : 'Record Accounting Transaction',
    bodyHtml,
    footerHtml
  });

  // Type auto-selection helper
  const typeEl = modal.querySelector('#txn-form-type');
  const incEl = modal.querySelector('#txn-form-income');
  const expEl = modal.querySelector('#txn-form-expense');

  typeEl.onchange = () => {
    if (typeEl.value === 'Income') {
      expEl.value = 0;
    } else if (typeEl.value === 'Expense' || typeEl.value === 'Salary') {
      incEl.value = 0;
    }
  };

  // Save handler
  const saveBtn = modal.querySelector('#txn-form-save-btn');
  const errorEl = modal.querySelector('#txn-form-error');

  saveBtn.onclick = async () => {
    errorEl.style.display = 'none';

    const date = modal.querySelector('#txn-form-date').value;
    const type = typeEl.value;
    const desc = modal.querySelector('#txn-form-desc').value;
    const party = modal.querySelector('#txn-form-party').value;
    const income = Number(incEl.value) || 0;
    const expense = Number(expEl.value) || 0;
    const remarks = modal.querySelector('#txn-form-remarks').value;

    const errReq = validateRequired(date, 'Date') ||
                   validateRequired(desc, 'Description') ||
                   validateRequired(party, 'Employee/Party');

    if (errReq) {
      errorEl.textContent = errReq;
      errorEl.style.display = 'block';
      return;
    }

    if (income === 0 && expense === 0) {
      errorEl.textContent = 'Please enter either an Income or Expense amount';
      errorEl.style.display = 'block';
      return;
    }

    const payload = {
      date,
      type,
      description: desc,
      party,
      income,
      expense,
      remarks
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Recording...';

    try {
      if (isEdit) {
        const res = await api.accounting.updateTransaction(record.id, payload);
        if (res.success) {
          toast.success(`Updated transaction "${res.transaction.description}"`);
          hideModal(modalId);
          loadTransactionsData();
          loadAccountingSummary();
        }
      } else {
        const res = await api.accounting.createTransaction(payload);
        if (res.success) {
          toast.success(`Recorded transaction "${res.transaction.description}"`);
          hideModal(modalId);
          loadTransactionsData();
          loadAccountingSummary();
        }
      }
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to save transaction';
      errorEl.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Save Changes' : 'Record Transaction';
    }
  };
}

function handleDeleteTransaction(record) {
  showConfirmDialog({
    title: 'Delete Ledger Transaction',
    message: `Are you sure you want to delete the transaction "${record.description}"? Ledger balances will automatically recalculate.`,
    confirmText: 'Yes, Delete Entry',
    onConfirm: async () => {
      try {
        const res = await api.accounting.deleteTransaction(record.id);
        if (res.success) {
          toast.success(res.message || 'Transaction deleted');
          loadTransactionsData();
          loadAccountingSummary();
        }
      } catch (err) {
        toast.error(err.message || 'Failed to delete transaction');
      }
    }
  });
}

function handleExportTransactionsCSV() {
  if (currentTransactions.length === 0) {
    toast.info('No transactions to export');
    return;
  }

  const headers = ['Date', 'Type', 'Description', 'Employee/Party', 'Income', 'Expense', 'Running Balance', 'Remarks', 'Recorded By'];
  const rows = currentTransactions.map(t => [
    t.date,
    t.type,
    t.description,
    t.party,
    t.income,
    t.expense,
    t.balance,
    t.remarks,
    t.updated_by
  ]);

  exportTableToCSV('FROMEX_Accounting_Ledger', headers, rows);
  toast.success(`Exported ${currentTransactions.length} transactions to CSV`);
}
