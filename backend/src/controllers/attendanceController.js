const db = require('../config/db');
const { success, error } = require('../utils/response');
const { calculateWorkingHours } = require('../utils/calculations');
const { broadcast } = require('../services/socketService');

async function getAll(req, res, next) {
  try {
    const {
      employee_id,
      emp_id,
      date,
      month,
      startDate,
      endDate,
      status,
      search,
      sortField,
      sortOrder
    } = req.query;

    const targetEmployee = employee_id || emp_id;

    let query = `
      SELECT 
        a.id,
        a.employee_id,
        e.employee_code as emp_id,
        e.name as emp_name,
        TO_CHAR(a.attendance_date, 'YYYY-MM-DD') as date,
        TO_CHAR(a.attendance_date, 'Dy') as day,
        a.check_in,
        a.check_out,
        a.status,
        a.working_hours,
        a.remarks,
        u1.name as created_by_name,
        u2.name as updated_by,
        a.created_at,
        a.updated_at
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN users u1 ON a.created_by = u1.id
      LEFT JOIN users u2 ON a.updated_by = u2.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (targetEmployee && targetEmployee !== 'All') {
      // Can be employee id or employee_code
      if (!isNaN(targetEmployee)) {
        query += ` AND (a.employee_id = $${paramIndex} OR e.employee_code = $${paramIndex}::text)`;
        params.push(targetEmployee);
      } else {
        query += ` AND e.employee_code = $${paramIndex}`;
        params.push(targetEmployee);
      }
      paramIndex++;
    }

    if (date) {
      query += ` AND a.attendance_date = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND a.attendance_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND a.attendance_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (month) {
      // Month format: 'YYYY-MM'
      query += ` AND TO_CHAR(a.attendance_date, 'YYYY-MM') = $${paramIndex}`;
      params.push(month);
      paramIndex++;
    }

    if (status && status !== 'All') {
      query += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (e.name ILIKE $${paramIndex} OR e.employee_code ILIKE $${paramIndex} OR a.remarks ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const validSortMap = {
      id: 'a.id',
      emp_id: 'e.employee_code',
      emp_name: 'e.name',
      date: 'a.attendance_date',
      status: 'a.status',
      working_hours: 'a.working_hours'
    };

    const sortCol = validSortMap[sortField] || 'a.attendance_date';
    const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortCol} ${order}, a.id DESC`;

    const result = await db.query(query, params);
    return success(res, { records: result.rows, count: result.rowCount });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(
      `SELECT 
        a.id,
        a.employee_id,
        e.employee_code as emp_id,
        e.name as emp_name,
        TO_CHAR(a.attendance_date, 'YYYY-MM-DD') as date,
        a.check_in,
        a.check_out,
        a.status,
        a.working_hours,
        a.remarks
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return error(res, 'Attendance record not found', 404);
    }

    return success(res, { record: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      employee_id,
      emp_id,
      date,
      attendance_date,
      check_in,
      check_out,
      status,
      working_hours,
      remarks
    } = req.body;

    const targetDate = attendance_date || date;
    const targetStatus = status || 'Present';

    if (!targetDate) {
      return error(res, 'Attendance date is required', 400);
    }

    // Resolve employee_id from employee_code if needed
    let finalEmpId = employee_id ? parseInt(employee_id, 10) : null;
    if (!finalEmpId && emp_id) {
      const empRes = await db.query('SELECT id FROM employees WHERE employee_code = $1', [emp_id.trim()]);
      if (empRes.rows.length > 0) {
        finalEmpId = empRes.rows[0].id;
      }
    }

    if (!finalEmpId) {
      return error(res, 'Valid Employee ID or Employee Code is required', 400);
    }

    // Check duplicate record
    const dupCheck = await db.query(
      'SELECT id FROM attendance WHERE employee_id = $1 AND attendance_date = $2',
      [finalEmpId, targetDate]
    );

    if (dupCheck.rows.length > 0) {
      return error(res, 'Attendance record for this employee and date already exists.', 409);
    }

    // Calculate working hours automatically
    const hours = (working_hours !== undefined && working_hours !== null && working_hours !== '')
      ? parseFloat(working_hours)
      : calculateWorkingHours(check_in, check_out, targetStatus);

    const userId = req.user ? req.user.id : null;

    const insertResult = await db.query(
      `INSERT INTO attendance (employee_id, attendance_date, check_in, check_out, status, working_hours, remarks, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING *`,
      [finalEmpId, targetDate, check_in || null, check_out || null, targetStatus, hours, remarks || '', userId]
    );

    const inserted = insertResult.rows[0];

    // Fetch formatted record with employee info
    const fullRes = await db.query(
      `SELECT 
        a.id,
        a.employee_id,
        e.employee_code as emp_id,
        e.name as emp_name,
        TO_CHAR(a.attendance_date, 'YYYY-MM-DD') as date,
        TO_CHAR(a.attendance_date, 'Dy') as day,
        a.check_in,
        a.check_out,
        a.status,
        a.working_hours,
        a.remarks,
        u.name as updated_by
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       LEFT JOIN users u ON a.updated_by = u.id
       WHERE a.id = $1`,
      [inserted.id]
    );

    const fullRecord = fullRes.rows[0];

    broadcast('attendance:created', {
      record: fullRecord,
      author: req.user ? req.user.name : 'User'
    });

    return success(res, { record: fullRecord }, 'Attendance recorded successfully', 201);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      check_in,
      check_out,
      status,
      working_hours,
      remarks,
      date,
      attendance_date
    } = req.body;

    const existingRes = await db.query('SELECT * FROM attendance WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return error(res, 'Attendance record not found', 404);
    }

    const current = existingRes.rows[0];
    const targetStatus = status !== undefined ? status : current.status;
    const targetCheckIn = check_in !== undefined ? check_in : current.check_in;
    const targetCheckOut = check_out !== undefined ? check_out : current.check_out;
    const targetDate = (attendance_date || date) || current.attendance_date;

    const hours = (working_hours !== undefined && working_hours !== null && working_hours !== '')
      ? parseFloat(working_hours)
      : calculateWorkingHours(targetCheckIn, targetCheckOut, targetStatus);

    const userId = req.user ? req.user.id : null;

    await db.query(
      `UPDATE attendance
       SET attendance_date = $1, check_in = $2, check_out = $3, status = $4, working_hours = $5, remarks = $6, updated_by = $7, updated_at = NOW()
       WHERE id = $8`,
      [targetDate, targetCheckIn, targetCheckOut, targetStatus, hours, remarks !== undefined ? remarks : current.remarks, userId, id]
    );

    const fullRes = await db.query(
      `SELECT 
        a.id,
        a.employee_id,
        e.employee_code as emp_id,
        e.name as emp_name,
        TO_CHAR(a.attendance_date, 'YYYY-MM-DD') as date,
        TO_CHAR(a.attendance_date, 'Dy') as day,
        a.check_in,
        a.check_out,
        a.status,
        a.working_hours,
        a.remarks,
        u.name as updated_by
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       LEFT JOIN users u ON a.updated_by = u.id
       WHERE a.id = $1`,
      [id]
    );

    const updatedRecord = fullRes.rows[0];

    broadcast('attendance:updated', {
      record: updatedRecord,
      author: req.user ? req.user.name : 'User'
    });

    return success(res, { record: updatedRecord }, 'Attendance updated successfully');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const existingRes = await db.query(
      `SELECT a.id, a.attendance_date, e.name as emp_name
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.id = $1`,
      [id]
    );

    if (existingRes.rows.length === 0) {
      return error(res, 'Attendance record not found', 404);
    }

    const info = existingRes.rows[0];
    await db.query('DELETE FROM attendance WHERE id = $1', [id]);

    broadcast('attendance:deleted', {
      id,
      employeeName: info.emp_name,
      date: info.attendance_date,
      author: req.user ? req.user.name : 'User'
    });

    return success(res, { id }, 'Attendance entry deleted successfully');
  } catch (err) {
    next(err);
  }
}

async function getSummary(req, res, next) {
  try {
    const targetDate = req.query.date || '2026-09-16';

    const empCountRes = await db.query("SELECT COUNT(*) as count FROM employees WHERE status = 'Active'");
    const totalEmployees = parseInt(empCountRes.rows[0].count, 10);

    const recordsToday = await db.query(
      'SELECT status, working_hours FROM attendance WHERE attendance_date = $1',
      [targetDate]
    );

    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    let totalHours = 0;

    for (const r of recordsToday.rows) {
      if (r.status === 'Present') present++;
      else if (r.status === 'Absent') absent++;
      else if (r.status === 'Half Day') halfDay++;
      else if (r.status === 'Leave') leave++;
      totalHours += parseFloat(r.working_hours || 0);
    }

    const attendanceRate = totalEmployees > 0
      ? Math.round(((present + halfDay * 0.5) / totalEmployees) * 100)
      : 0;

    return success(res, {
      date: targetDate,
      totalEmployees,
      recordedCount: recordsToday.rowCount,
      present,
      absent,
      halfDay,
      leave,
      totalHours: Math.round(totalHours * 10) / 10,
      attendanceRate
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  getSummary
};
