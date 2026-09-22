const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { broadcast } = require('./sync');

// Helper to compute day name from date string 'YYYY-MM-DD'
function getDayName(dateStr) {
  if (!dateStr) return '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d.getTime()) ? '' : days[d.getDay()];
}

// Helper to calculate working hours from check-in, check-out, and status
function calculateWorkingHours(checkIn, checkOut, status) {
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

  const inTotal = inH * 60 + inM;
  const outTotal = outH * 60 + outM;
  let diffMin = outTotal - inTotal;

  if (diffMin < 0) {
    // Overnight shift, wrap around
    diffMin += 24 * 60;
  }

  const hours = Math.round((diffMin / 60) * 10) / 10;
  return Math.max(0, hours);
}

// GET /api/attendance - List attendance records with filtering, searching, and sorting
router.get('/', (req, res) => {
  const {
    date,
    startDate,
    endDate,
    month,
    status,
    emp_id,
    search,
    sortField,
    sortOrder
  } = req.query;

  let query = 'SELECT * FROM attendance WHERE 1=1';
  const params = [];

  // Filter by single specific date (Daily view)
  if (date) {
    query += ' AND date = ?';
    params.push(date);
  }

  // Filter by date range
  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  // Filter by Month: e.g. '2026-09'
  if (month) {
    query += ' AND date LIKE ?';
    params.push(`${month}%`);
  }

  // Filter by Status: Present, Absent, Half Day, Leave
  if (status && status !== 'All') {
    query += ' AND status = ?';
    params.push(status);
  }

  // Filter by Employee ID
  if (emp_id && emp_id !== 'All') {
    query += ' AND emp_id = ?';
    params.push(emp_id);
  }

  // Search by Employee Name or ID
  if (search) {
    query += ' AND (emp_name LIKE ? OR emp_id LIKE ? OR remarks LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  // Sorting
  const validSortFields = ['id', 'emp_id', 'emp_name', 'date', 'day', 'check_in', 'check_out', 'status', 'working_hours'];
  const field = validSortFields.includes(sortField) ? sortField : 'date';
  const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

  query += ` ORDER BY ${field} ${order}, id DESC`;

  const records = db.prepare(query).all(...params);
  res.json({ success: true, records, count: records.length });
});

// GET /api/attendance/summary - Stats for a particular date or today
router.get('/summary', (req, res) => {
  const targetDate = req.query.date || new Date().toISOString().split('T')[0];

  const totalEmployees = db.prepare("SELECT COUNT(*) as count FROM employees WHERE status = 'Active'").get().count;

  const recordsToday = db.prepare('SELECT status, working_hours FROM attendance WHERE date = ?').all(targetDate);

  let present = 0;
  let absent = 0;
  let halfDay = 0;
  let leave = 0;
  let totalHours = 0;

  for (const r of recordsToday) {
    if (r.status === 'Present') present++;
    else if (r.status === 'Absent') absent++;
    else if (r.status === 'Half Day') halfDay++;
    else if (r.status === 'Leave') leave++;
    totalHours += (r.working_hours || 0);
  }

  // Attendance rate = (present + halfDay * 0.5) / totalEmployees
  const attendanceRate = totalEmployees > 0
    ? Math.round(((present + halfDay * 0.5) / totalEmployees) * 100)
    : 0;

  res.json({
    success: true,
    date: targetDate,
    totalEmployees,
    recordedCount: recordsToday.length,
    present,
    absent,
    halfDay,
    leave,
    totalHours: Math.round(totalHours * 10) / 10,
    attendanceRate
  });
});

// POST /api/attendance - Add attendance record
router.post('/', authMiddleware, (req, res) => {
  const {
    emp_id,
    emp_name,
    date,
    check_in,
    check_out,
    status,
    working_hours,
    remarks
  } = req.body;

  if (!emp_id || !date || !status) {
    return res.status(400).json({ success: false, message: 'Employee ID, date, and status are required' });
  }

  // Lookup employee name if missing
  let resolvedName = emp_name ? emp_name.trim() : '';
  if (!resolvedName) {
    const emp = db.prepare('SELECT name FROM employees WHERE emp_id = ?').get(emp_id.trim());
    if (emp) resolvedName = emp.name;
    else resolvedName = emp_id.trim();
  }

  const day = getDayName(date);
  const calculatedHours = (working_hours !== undefined && working_hours !== null && working_hours !== '')
    ? Number(working_hours)
    : calculateWorkingHours(check_in, check_out, status);

  // Check if an attendance record already exists for this employee on this date
  const existing = db.prepare('SELECT id FROM attendance WHERE emp_id = ? AND date = ?').get(emp_id.trim(), date.trim());
  if (existing) {
    return res.status(400).json({
      success: false,
      message: `Attendance for ${resolvedName} on ${date} already exists. Please edit the existing record instead.`
    });
  }

  const result = db.prepare(`
    INSERT INTO attendance (emp_id, emp_name, date, day, check_in, check_out, status, working_hours, remarks, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    emp_id.trim(),
    resolvedName,
    date.trim(),
    day,
    check_in ? check_in.trim() : '',
    check_out ? check_out.trim() : '',
    status.trim(),
    calculatedHours,
    remarks ? remarks.trim() : '',
    req.user.name
  );

  const newRecord = db.prepare('SELECT * FROM attendance WHERE id = ?').get(result.lastInsertRowid);

  broadcast('attendance_updated', {
    action: 'create',
    user: req.user.name,
    record: newRecord,
    timestamp: new Date().toISOString()
  });

  res.status(201).json({ success: true, message: 'Attendance recorded successfully', record: newRecord });
});

// PUT /api/attendance/:id - Edit attendance record
router.put('/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM attendance WHERE id = ?').get(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Attendance record not found' });
  }

  const {
    emp_id,
    emp_name,
    date,
    check_in,
    check_out,
    status,
    working_hours,
    remarks
  } = req.body;

  const finalEmpId = emp_id ? emp_id.trim() : existing.emp_id;
  const finalDate = date ? date.trim() : existing.date;
  const finalStatus = status ? status.trim() : existing.status;
  const finalCheckIn = check_in !== undefined ? check_in.trim() : existing.check_in;
  const finalCheckOut = check_out !== undefined ? check_out.trim() : existing.check_out;

  let resolvedName = emp_name ? emp_name.trim() : existing.emp_name;
  if (!resolvedName || resolvedName !== existing.emp_name) {
    const emp = db.prepare('SELECT name FROM employees WHERE emp_id = ?').get(finalEmpId);
    if (emp) resolvedName = emp.name;
  }

  const day = getDayName(finalDate);
  const calculatedHours = (working_hours !== undefined && working_hours !== null && working_hours !== '')
    ? Number(working_hours)
    : calculateWorkingHours(finalCheckIn, finalCheckOut, finalStatus);

  db.prepare(`
    UPDATE attendance
    SET emp_id = ?, emp_name = ?, date = ?, day = ?, check_in = ?, check_out = ?, status = ?, working_hours = ?, remarks = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    finalEmpId,
    resolvedName,
    finalDate,
    day,
    finalCheckIn,
    finalCheckOut,
    finalStatus,
    calculatedHours,
    remarks !== undefined ? remarks.trim() : existing.remarks,
    req.user.name,
    id
  );

  const updatedRecord = db.prepare('SELECT * FROM attendance WHERE id = ?').get(id);

  broadcast('attendance_updated', {
    action: 'update',
    user: req.user.name,
    record: updatedRecord,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: 'Attendance updated successfully', record: updatedRecord });
});

// DELETE /api/attendance/:id - Delete attendance record
router.delete('/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM attendance WHERE id = ?').get(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Attendance record not found' });
  }

  db.prepare('DELETE FROM attendance WHERE id = ?').run(id);

  broadcast('attendance_updated', {
    action: 'delete',
    user: req.user.name,
    id,
    emp_name: existing.emp_name,
    date: existing.date,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: `Attendance for ${existing.emp_name} on ${existing.date} deleted` });
});

module.exports = router;
