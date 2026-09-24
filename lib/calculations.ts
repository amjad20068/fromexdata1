/**
 * Calculate working hours between check_in and check_out in 24h format (HH:MM)
 * @param checkIn - "09:00"
 * @param checkOut - "18:00"
 * @param status - "Present" | "Absent" | "Half Day" | "Leave"
 * @returns Decimal hours (e.g. 8.5)
 */
export function calculateWorkingHours(
  checkIn?: string | null,
  checkOut?: string | null,
  status: string = 'Present'
): number {
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
 */
export function calculateNetSalary(
  basic: number | string = 0,
  allowance: number | string = 0,
  deduction: number | string = 0
): number {
  const b = Math.max(0, parseFloat(String(basic)) || 0);
  const a = Math.max(0, parseFloat(String(allowance)) || 0);
  const d = Math.max(0, parseFloat(String(deduction)) || 0);

  const net = b + a - d;
  return Math.max(0, Math.round(net * 100) / 100);
}
