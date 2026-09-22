// Mathematical and Business Logic Utilities

/**
 * Calculate working hours between check_in and check_out in 24h format
 * @param {string} checkIn - "09:00"
 * @param {string} checkOut - "18:00"
 * @param {string} status - "Present" | "Absent" | "Half Day" | "Leave"
 * @returns {number} Decimal hours (e.g. 8.5)
 */
function calculateWorkingHours(checkIn, checkOut, status) {
  if (status === 'Absent' || status === 'Leave') {
    return 0.0;
  }

  if (!checkIn || !checkOut) {
    if (status === 'Half Day') return 4.0;
    if (status === 'Present') return 8.0;
    return 0.0;
  }

  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);

  if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) {
    return status === 'Half Day' ? 4.0 : 8.0;
  }

  let diffMin = (outH * 60 + outM) - (inH * 60 + inM);

  // Handle overnight shift wrap-around
  if (diffMin < 0) {
    diffMin += 24 * 60;
  }

  const hours = Math.round((diffMin / 60) * 10) / 10;
  return Math.max(0, hours);
}

/**
 * Calculate Net Salary using exact formula:
 * Net Salary = Basic Salary + Allowance - Deduction
 * @param {number|string} basic
 * @param {number|string} allowance
 * @param {number|string} deduction
 * @returns {number}
 */
function calculateNetSalary(basic, allowance, deduction) {
  const b = Math.max(0, parseFloat(basic) || 0);
  const a = Math.max(0, parseFloat(allowance) || 0);
  const d = Math.max(0, parseFloat(deduction) || 0);

  const net = b + a - d;
  return Math.max(0, Math.round(net * 100) / 100);
}

module.exports = {
  calculateWorkingHours,
  calculateNetSalary
};
