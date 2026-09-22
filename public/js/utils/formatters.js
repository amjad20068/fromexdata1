// Formatters and Mathematical Calculation Utilities

/**
 * Format numbers into Indian Rupee (₹) currency strings.
 * Example: 2057900 -> "₹20,57,900.00"
 */
export function formatINR(amount) {
  const num = Number(amount) || 0;
  const isNegative = num < 0;
  const absVal = Math.abs(num);

  const formatted = absVal.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return isNegative ? `-₹${formatted}` : `₹${formatted}`;
}

/**
 * Calculate Net Salary: Basic Salary + Allowance - Deduction
 */
export function calculateNetSalary(basic, allowance, deduction) {
  const b = Math.max(0, Number(basic) || 0);
  const a = Math.max(0, Number(allowance) || 0);
  const d = Math.max(0, Number(deduction) || 0);
  return Math.max(0, b + a - d);
}

/**
 * Calculate Working Hours between check-in and check-out
 */
export function calculateHours(checkIn, checkOut, status) {
  if (status === 'Absent' || status === 'Leave') {
    return 0.0;
  }
  if (!checkIn || !checkOut) {
    return status === 'Half Day' ? 4.0 : (status === 'Present' ? 8.0 : 0.0);
  }

  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);

  if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) {
    return status === 'Half Day' ? 4.0 : 8.0;
  }

  let diffMin = (outH * 60 + outM) - (inH * 60 + inM);
  if (diffMin < 0) diffMin += 24 * 60; // overnight wrap

  const hours = Math.round((diffMin / 60) * 10) / 10;
  return Math.max(0, hours);
}

/**
 * Format date string 'YYYY-MM-DD' into clean readable date
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }
  return dateStr;
}

/**
 * HTML Badge renderers
 */
export function renderAttendanceBadge(status) {
  const s = (status || '').toLowerCase().replace(/\s+/g, '');
  let badgeClass = 'badge-present';
  if (s === 'absent') badgeClass = 'badge-absent';
  else if (s === 'halfday') badgeClass = 'badge-halfday';
  else if (s === 'leave') badgeClass = 'badge-leave';

  return `<span class="badge ${badgeClass}">${status || 'Present'}</span>`;
}

export function renderPaymentBadge(status) {
  const s = (status || '').toLowerCase();
  let badgeClass = 'badge-pending';
  if (s === 'paid') badgeClass = 'badge-paid';
  else if (s === 'processing') badgeClass = 'badge-processing';

  return `<span class="badge ${badgeClass}">${status || 'Pending'}</span>`;
}

export function renderTxnTypeBadge(type) {
  const t = (type || '').toLowerCase();
  let badgeClass = 'badge-other';
  if (t === 'income') badgeClass = 'badge-income';
  else if (t === 'expense') badgeClass = 'badge-expense';
  else if (t === 'salary') badgeClass = 'badge-salary';

  return `<span class="badge ${badgeClass}">${type || 'Other'}</span>`;
}
