// Attendance Management Module (Excel-Like Grid)
import { api } from '../api.js';
import { state } from '../state.js';
import { CONFIG } from '../config.js';
import { toast } from '../components/toast.js';
import { showModal, hideModal } from '../components/modal.js';
import { showConfirmDialog } from '../components/confirm.js';
import {
  formatDate,
  calculateHours,
  renderAttendanceBadge
} from '../utils/formatters.js';
import {
  validateRequired,
  validateTimeFormat,
  validateTimeSequence
} from '../utils/validators.js';
import { exportTableToCSV } from '../utils/export.js';

let currentFilters = {
  viewMode: 'all', // 'all', 'daily', 'monthly'
  date: CONFIG.DEFAULT_DATE,
  month: '2026-09',
  status: 'All',
  emp_id: 'All',
  search: '',
  sortField: 'date',
  sortOrder: 'DESC'
};

let currentRecords = [];

export function initAttendanceModule() {
  // Bind UI buttons
  const addBtn = document.getElementById('btn-add-attendance');
  if (addBtn) addBtn.onclick = () => openAttendanceModal();

  const exportBtn = document.getElementById('btn-export-attendance');
  if (exportBtn) exportBtn.onclick = () => handleExportCSV();

  const searchInput = document.getElementById('attendance-search');
  if (searchInput) {
    let timeout;
    searchInput.oninput = (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        currentFilters.search = e.target.value;
        loadAttendanceData();
      }, 250);
    };
  }

  const statusFilter = document.getElementById('attendance-status-filter');
  if (statusFilter) {
    statusFilter.onchange = (e) => {
      currentFilters.status = e.target.value;
      loadAttendanceData();
    };
  }

  const employeeFilter = document.getElementById('attendance-employee-filter');
  if (employeeFilter) {
    employeeFilter.onchange = (e) => {
      currentFilters.emp_id = e.target.value;
      loadAttendanceData();
    };
  }

  const viewModeSelect = document.getElementById('attendance-view-mode');
  if (viewModeSelect) {
    viewModeSelect.onchange = (e) => {
      currentFilters.viewMode = e.target.value;
      updateViewModeControls();
      loadAttendanceData();
    };
  }

  const datePicker = document.getElementById('attendance-date-picker');
  if (datePicker) {
    datePicker.value = currentFilters.date;
    datePicker.onchange = (e) => {
      currentFilters.date = e.target.value;
      loadAttendanceData();
    };
  }

  const monthPicker = document.getElementById('attendance-month-picker');
  if (monthPicker) {
    monthPicker.value = currentFilters.month;
    monthPicker.onchange = (e) => {
      currentFilters.month = e.target.value;
      loadAttendanceData();
    };
  }

  // Populate employee filter dropdown on load
  state.on('employees_loaded', (emps) => {
    populateEmployeeFilter(emps);
  });

  // Real-time synchronization event
  state.on('attendance_data_changed', () => {
    loadAttendanceData();
  });

  state.on('tab_changed', (tabId) => {
    if (tabId === 'attendance') {
      loadAttendanceData();
      if (state.allEmployees.length > 0) {
        populateEmployeeFilter(state.allEmployees);
      }
    }
  });

  updateViewModeControls();
  loadAttendanceData();
}

function updateViewModeControls() {
  const datePickerGroup = document.getElementById('attendance-date-group');
  const monthPickerGroup = document.getElementById('attendance-month-group');

  if (currentFilters.viewMode === 'daily') {
    if (datePickerGroup) datePickerGroup.style.display = 'flex';
    if (monthPickerGroup) monthPickerGroup.style.display = 'none';
  } else if (currentFilters.viewMode === 'monthly') {
    if (datePickerGroup) datePickerGroup.style.display = 'none';
    if (monthPickerGroup) monthPickerGroup.style.display = 'flex';
  } else {
    // 'all'
    if (datePickerGroup) datePickerGroup.style.display = 'none';
    if (monthPickerGroup) monthPickerGroup.style.display = 'none';
  }
}

function populateEmployeeFilter(employees) {
  const select = document.getElementById('attendance-employee-filter');
  if (!select) return;

  const currentVal = select.value || 'All';
  select.innerHTML = '<option value="All">All Employees</option>';

  employees.forEach(emp => {
    const opt = document.createElement('option');
    const code = emp.employee_code || emp.emp_id;
    opt.value = emp.id;
    opt.textContent = `${emp.name} (${code})`;
    select.appendChild(opt);
  });

  select.value = currentVal;
}

export async function loadAttendanceData() {
  try {
    const params = {
      status: currentFilters.status,
      emp_id: currentFilters.emp_id,
      search: currentFilters.search,
      sortField: currentFilters.sortField,
      sortOrder: currentFilters.sortOrder
    };

    if (currentFilters.viewMode === 'daily') {
      params.date = currentFilters.date;
    } else if (currentFilters.viewMode === 'monthly') {
      params.month = currentFilters.month;
    }

    const res = await api.attendance.getAll(params);
    if (!res.success) return;

    currentRecords = res.records || [];
    renderAttendanceTable(currentRecords);
  } catch (err) {
    console.error('Failed to load attendance:', err);
    toast.error('Failed to load attendance data');
  }
}

function renderAttendanceTable(records) {
  const tbody = document.getElementById('attendance-table-body');
  const countPill = document.getElementById('attendance-count-pill');
  if (!tbody) return;

  if (countPill) countPill.textContent = `${records.length} Records`;

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="table-empty-state">
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-title">No Attendance Records Found</div>
            <div class="empty-state-desc">Try adjusting your search criteria, date filter, or add a new attendance entry.</div>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.FROMEX_OPEN_ATTENDANCE_MODAL()">+ Add Attendance</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = records.map(r => `
    <tr data-record-id="${r.id}">
      <td class="cell-emp-id">${r.emp_id}</td>
      <td class="cell-name">${r.emp_name}</td>
      <td class="text-center cell-mono">${r.date}</td>
      <td class="text-center" style="font-weight:600; color:var(--text-muted);">${r.day || ''}</td>
      <td class="text-center cell-mono">${r.check_in || '-'}</td>
      <td class="text-center cell-mono">${r.check_out || '-'}</td>
      <td class="text-center">${renderAttendanceBadge(r.status)}</td>
      <td class="text-right cell-mono" style="font-weight:700;">
        ${Number(r.working_hours).toFixed(1)} hrs
      </td>
      <td style="max-width: 200px; text-overflow: ellipsis; overflow: hidden; color: var(--text-muted);">
        ${r.remarks || '-'}
      </td>
      <td class="text-center">
        <div class="row-actions">
          <button type="button" class="action-icon-btn btn-edit" title="Edit Record" data-edit-att="${r.id}">
            ✏️
          </button>
          <button type="button" class="action-icon-btn btn-delete" title="Delete Record" data-delete-att="${r.id}">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  // Attach row action listeners
  tbody.querySelectorAll('[data-edit-att]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-edit-att'), 10);
      const record = records.find(r => r.id === id);
      if (record) openAttendanceModal(record);
    };
  });

  tbody.querySelectorAll('[data-delete-att]').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-delete-att'), 10);
      const record = records.find(r => r.id === id);
      if (record) handleDeleteAttendance(record);
    };
  });

  // Attach sorting listeners on thead
  document.querySelectorAll('#attendance-table th.sortable').forEach(th => {
    th.onclick = () => {
      const field = th.getAttribute('data-sort');
      if (currentFilters.sortField === field) {
        currentFilters.sortOrder = currentFilters.sortOrder === 'ASC' ? 'DESC' : 'ASC';
      } else {
        currentFilters.sortField = field;
        currentFilters.sortOrder = 'ASC';
      }

      // Update indicator UI
      document.querySelectorAll('#attendance-table th.sortable').forEach(el => {
        el.classList.remove('sorted-asc', 'sorted-desc');
        const ind = el.querySelector('.sort-indicator');
        if (ind) ind.textContent = '⇅';
      });

      th.classList.add(currentFilters.sortOrder === 'ASC' ? 'sorted-asc' : 'sorted-desc');
      const ind = th.querySelector('.sort-indicator');
      if (ind) ind.textContent = currentFilters.sortOrder === 'ASC' ? '▲' : '▼';

      loadAttendanceData();
    };
  });
}

// Global modal launcher helper
window.FROMEX_OPEN_ATTENDANCE_MODAL = () => openAttendanceModal();

export function openAttendanceModal(record = null) {
  const isEdit = !!record;
  const modalId = 'modal-attendance-form';

  const emps = state.allEmployees;
  if (!isEdit && emps.length === 0) {
    toast.info('No employees found in company records. Please add an employee first.');
    if (typeof window.FROMEX_OPEN_EMPLOYEE_MODAL === 'function') {
      window.FROMEX_OPEN_EMPLOYEE_MODAL();
    }
    return;
  }

  const defaultEmpId = record ? record.emp_id : (emps.length > 0 ? (emps[0].employee_code || emps[0].emp_id) : '');
  const defaultDate = record ? record.date : (currentFilters.date || new Date().toISOString().split('T')[0]);
  const defaultIn = record ? (record.check_in || '09:00') : '09:00';
  const defaultOut = record ? (record.check_out || '18:00') : '18:00';
  const defaultStatus = record ? record.status : 'Present';
  const defaultRemarks = record ? (record.remarks || '') : '';
  const initialHours = record ? record.working_hours : calculateHours(defaultIn, defaultOut, defaultStatus);

  const bodyHtml = `
    <form id="attendance-form" style="display: flex; flex-direction: column; gap: 14px;">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="att-form-emp">Employee *</label>
          <select id="att-form-emp" class="select-control" ${isEdit ? 'disabled' : ''} required>
            ${emps.map(e => {
              const code = e.employee_code || e.emp_id;
              const title = `${e.name} (${code}) &bull; ${e.designation || e.department || 'Staff'}`;
              return `
                <option value="${code}" data-name="${e.name}" ${code === defaultEmpId ? 'selected' : ''}>
                  ${title}
                </option>
              `;
            }).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="att-form-date">Date *</label>
          <input type="date" id="att-form-date" class="input-control" value="${defaultDate}" ${isEdit ? 'readonly' : ''} required />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="att-form-status">Attendance Status *</label>
          <select id="att-form-status" class="select-control" required>
            <option value="Present" ${defaultStatus === 'Present' ? 'selected' : ''}>Present</option>
            <option value="Half Day" ${defaultStatus === 'Half Day' ? 'selected' : ''}>Half Day</option>
            <option value="Leave" ${defaultStatus === 'Leave' ? 'selected' : ''}>Leave</option>
            <option value="Absent" ${defaultStatus === 'Absent' ? 'selected' : ''}>Absent</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Calculated Hours</label>
          <div id="att-hours-display" class="formula-box" style="padding: 6px 12px;">
            <div class="formula-result" id="att-hours-val" style="font-size: 16px;">${Number(initialHours).toFixed(1)} hrs</div>
          </div>
        </div>
      </div>

      <div class="form-row" id="att-time-row">
        <div class="form-group">
          <label class="form-label" for="att-form-in">Check-in Time (24h)</label>
          <input type="time" id="att-form-in" class="input-control" value="${defaultIn}" />
        </div>

        <div class="form-group">
          <label class="form-label" for="att-form-out">Check-out Time (24h)</label>
          <input type="time" id="att-form-out" class="input-control" value="${defaultOut}" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="att-form-remarks">Remarks</label>
        <input type="text" id="att-form-remarks" class="input-control" placeholder="e.g. Regular shift, project deployment, client site" value="${defaultRemarks}" />
      </div>

      <div id="att-form-error" style="display:none; color: #dc2626; font-size: 12px; font-weight: 600;"></div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-outline" data-modal-close>Cancel</button>
    <button type="button" id="att-form-save-btn" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Record Attendance'}</button>
  `;

  const modal = showModal({
    id: modalId,
    title: isEdit ? `Edit Attendance: ${record.emp_name} (${record.date})` : 'Add Attendance Record',
    bodyHtml,
    footerHtml
  });

  // Dynamic live calculation of working hours
  const statusEl = modal.querySelector('#att-form-status');
  const inEl = modal.querySelector('#att-form-in');
  const outEl = modal.querySelector('#att-form-out');
  const hoursValEl = modal.querySelector('#att-hours-val');
  const timeRowEl = modal.querySelector('#att-time-row');

  function updateLiveHours() {
    const status = statusEl.value;
    if (status === 'Absent' || status === 'Leave') {
      timeRowEl.style.opacity = '0.5';
      hoursValEl.textContent = '0.0 hrs';
    } else {
      timeRowEl.style.opacity = '1';
      const hours = calculateHours(inEl.value, outEl.value, status);
      hoursValEl.textContent = `${Number(hours).toFixed(1)} hrs`;
    }
  }

  statusEl.onchange = updateLiveHours;
  inEl.oninput = updateLiveHours;
  outEl.oninput = updateLiveHours;
  updateLiveHours();

  // Save handler
  const saveBtn = modal.querySelector('#att-form-save-btn');
  const errorEl = modal.querySelector('#att-form-error');

  saveBtn.onclick = async () => {
    errorEl.style.display = 'none';

    const empSelect = modal.querySelector('#att-form-emp');
    const empId = isEdit ? record.emp_id : empSelect.value;
    const selectedOption = empSelect.options[empSelect.selectedIndex];
    const empName = isEdit ? record.emp_name : (selectedOption ? selectedOption.getAttribute('data-name') : '');
    const date = modal.querySelector('#att-form-date').value;
    const status = statusEl.value;
    const checkIn = inEl.value;
    const checkOut = outEl.value;
    const remarks = modal.querySelector('#att-form-remarks').value;

    // Validation
    const errReq = validateRequired(empId, 'Employee') || validateRequired(date, 'Date');
    if (errReq) {
      errorEl.textContent = errReq;
      errorEl.style.display = 'block';
      return;
    }

    if (status === 'Present' || status === 'Half Day') {
      const errSeq = validateTimeSequence(checkIn, checkOut);
      if (errSeq) {
        errorEl.textContent = errSeq;
        errorEl.style.display = 'block';
        return;
      }
    }

    const workingHours = calculateHours(checkIn, checkOut, status);

    const payload = {
      emp_id: empId,
      emp_name: empName,
      date,
      status,
      check_in: checkIn,
      check_out: checkOut,
      working_hours: workingHours,
      remarks
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (isEdit) {
        const res = await api.attendance.update(record.id, payload);
        if (res.success) {
          toast.success(`Updated attendance for ${res.record.emp_name}`);
          hideModal(modalId);
          loadAttendanceData();
        }
      } else {
        const res = await api.attendance.create(payload);
        if (res.success) {
          toast.success(`Recorded attendance for ${res.record.emp_name}`);
          hideModal(modalId);
          loadAttendanceData();
        }
      }
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to save attendance record';
      errorEl.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Save Changes' : 'Record Attendance';
    }
  };
}

function handleDeleteAttendance(record) {
  showConfirmDialog({
    title: 'Delete Attendance Entry',
    message: `Are you sure you want to delete the attendance entry for "${record.emp_name}" on ${record.date}?`,
    confirmText: 'Yes, Delete Entry',
    onConfirm: async () => {
      try {
        const res = await api.attendance.delete(record.id);
        if (res.success) {
          toast.success(res.message || 'Attendance deleted');
          loadAttendanceData();
        }
      } catch (err) {
        toast.error(err.message || 'Failed to delete attendance record');
      }
    }
  });
}

function handleExportCSV() {
  if (currentRecords.length === 0) {
    toast.info('No attendance records to export');
    return;
  }

  const headers = ['Employee ID', 'Employee Name', 'Date', 'Day', 'Check In', 'Check Out', 'Status', 'Working Hours', 'Remarks', 'Recorded By'];
  const rows = currentRecords.map(r => [
    r.emp_id,
    r.emp_name,
    r.date,
    r.day,
    r.check_in,
    r.check_out,
    r.status,
    r.working_hours,
    r.remarks,
    r.updated_by
  ]);

  exportTableToCSV('FROMEX_Attendance', headers, rows);
  toast.success(`Exported ${currentRecords.length} attendance records to CSV`);
}
