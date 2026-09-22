const db = require('../config/db');
const { success, error } = require('../utils/response');
const { calculateNetSalary } = require('../utils/calculations');
const { broadcast } = require('../services/socketService');

async function getAll(req, res, next) {
  try {
    const {
      employee_id,
      month,
      status,
      payment_status,
      search,
      sortField,
      sortOrder
    } = req.query;

    let query = `
      SELECT 
        s.id,
        s.employee_id,
        e.employee_code as emp_id,
        e.name as emp_name,
        s.month,
        s.basic_salary::float as basic_salary,
        s.allowance::float as allowance,
        s.deduction::float as deduction,
        s.net_salary::float as net_salary,
        TO_CHAR(s.payment_date, 'YYYY-MM-DD') as payment_date,
        s.payment_status,
        s.remarks,
        u.name as updated_by,
        s.created_at,
        s.updated_at
      FROM salary_records s
      JOIN employees e ON s.employee_id = e.id
      LEFT JOIN users u ON s.updated_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (employee_id && employee_id !== 'All') {
      if (!isNaN(employee_id)) {
        query += ` AND s.employee_id = $${paramIndex}`;
        params.push(parseInt(employee_id, 10));
      } else {
        query += ` AND e.employee_code = $${paramIndex}`;
        params.push(employee_id);
      }
      paramIndex++;
    }

    if (month && month !== 'All') {
      query += ` AND s.month = $${paramIndex}`;
      params.push(month);
      paramIndex++;
    }

    const targetStatus = payment_status || status;
    if (targetStatus && targetStatus !== 'All') {
      query += ` AND s.payment_status = $${paramIndex}`;
      params.push(targetStatus);
      paramIndex++;
    }

    if (search) {
      query += ` AND (e.name ILIKE $${paramIndex} OR e.employee_code ILIKE $${paramIndex} OR s.remarks ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const validSortMap = {
      id: 's.id',
      emp_id: 'e.employee_code',
      emp_name: 'e.name',
      month: 's.month',
      basic_salary: 's.basic_salary',
      allowance: 's.allowance',
      deduction: 's.deduction',
      net_salary: 's.net_salary',
      payment_date: 's.payment_date',
      payment_status: 's.payment_status'
    };

    const sortCol = validSortMap[sortField] || 's.id';
    const order = (sortOrder && sortOrder.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';

    query += ` ORDER BY ${sortCol} ${order}`;

    const result = await db.query(query, params);
    return success(res, { salaries: result.rows, count: result.rowCount });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(
      `SELECT 
        s.id,
        s.employee_id,
        e.employee_code as emp_id,
        e.name as emp_name,
        s.month,
        s.basic_salary::float as basic_salary,
        s.allowance::float as allowance,
        s.deduction::float as deduction,
        s.net_salary::float as net_salary,
        TO_CHAR(s.payment_date, 'YYYY-MM-DD') as payment_date,
        s.payment_status,
        s.remarks
       FROM salary_records s
       JOIN employees e ON s.employee_id = e.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return error(res, 'Salary record not found', 404);
    }

    return success(res, { salary: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      employee_id,
      emp_id,
      month,
      basic_salary,
      allowance,
      deduction,
      payment_date,
      payment_status,
      remarks
    } = req.body;

    if (!month) {
      return error(res, 'Payroll month is required (e.g. September 2026)', 400);
    }

    // Resolve employee_id
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

    const basic = Math.max(0, parseFloat(basic_salary) || 0);
    const allow = Math.max(0, parseFloat(allowance) || 0);
    const deduct = Math.max(0, parseFloat(deduction) || 0);

    // Strict Backend Formula Verification:
    // Net Salary = Basic Salary + Allowance - Deduction
    const netSalary = calculateNetSalary(basic, allow, deduct);

    const userId = req.user ? req.user.id : null;

    const insertRes = await db.query(
      `INSERT INTO salary_records (employee_id, month, basic_salary, allowance, deduction, net_salary, payment_date, payment_status, remarks, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING *`,
      [finalEmpId, month.trim(), basic, allow, deduct, netSalary, payment_date || null, payment_status || 'Pending', remarks || '', userId]
    );

    const inserted = insertRes.rows[0];

    const fullRes = await db.query(
      `SELECT 
        s.id,
        s.employee_id,
        e.employee_code as emp_id,
        e.name as emp_name,
        s.month,
        s.basic_salary::float as basic_salary,
        s.allowance::float as allowance,
        s.deduction::float as deduction,
        s.net_salary::float as net_salary,
        TO_CHAR(s.payment_date, 'YYYY-MM-DD') as payment_date,
        s.payment_status,
        s.remarks,
        u.name as updated_by
       FROM salary_records s
       JOIN employees e ON s.employee_id = e.id
       LEFT JOIN users u ON s.updated_by = u.id
       WHERE s.id = $1`,
      [inserted.id]
    );

    const fullSalary = fullRes.rows[0];

    broadcast('salary:created', {
      salary: fullSalary,
      author: req.user ? req.user.name : 'User'
    });

    return success(res, { salary: fullSalary }, 'Salary record created successfully', 201);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      month,
      basic_salary,
      allowance,
      deduction,
      payment_date,
      payment_status,
      remarks
    } = req.body;

    const existingRes = await db.query('SELECT * FROM salary_records WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return error(res, 'Salary record not found', 404);
    }

    const current = existingRes.rows[0];
    const basic = basic_salary !== undefined ? Math.max(0, parseFloat(basic_salary) || 0) : parseFloat(current.basic_salary);
    const allow = allowance !== undefined ? Math.max(0, parseFloat(allowance) || 0) : parseFloat(current.allowance);
    const deduct = deduction !== undefined ? Math.max(0, parseFloat(deduction) || 0) : parseFloat(current.deduction);

    // Recompute Net Salary on backend
    const netSalary = calculateNetSalary(basic, allow, deduct);

    const userId = req.user ? req.user.id : null;

    await db.query(
      `UPDATE salary_records
       SET month = $1, basic_salary = $2, allowance = $3, deduction = $4, net_salary = $5, payment_date = $6, payment_status = $7, remarks = $8, updated_by = $9, updated_at = NOW()
       WHERE id = $10`,
      [
        month ? month.trim() : current.month,
        basic,
        allow,
        deduct,
        netSalary,
        payment_date !== undefined ? payment_date || null : current.payment_date,
        payment_status || current.payment_status,
        remarks !== undefined ? remarks : current.remarks,
        userId,
        id
      ]
    );

    const fullRes = await db.query(
      `SELECT 
        s.id,
        s.employee_id,
        e.employee_code as emp_id,
        e.name as emp_name,
        s.month,
        s.basic_salary::float as basic_salary,
        s.allowance::float as allowance,
        s.deduction::float as deduction,
        s.net_salary::float as net_salary,
        TO_CHAR(s.payment_date, 'YYYY-MM-DD') as payment_date,
        s.payment_status,
        s.remarks,
        u.name as updated_by
       FROM salary_records s
       JOIN employees e ON s.employee_id = e.id
       LEFT JOIN users u ON s.updated_by = u.id
       WHERE s.id = $1`,
      [id]
    );

    const updatedSalary = fullRes.rows[0];

    broadcast('salary:updated', {
      salary: updatedSalary,
      author: req.user ? req.user.name : 'User'
    });

    return success(res, { salary: updatedSalary }, 'Salary record updated successfully');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const existingRes = await db.query(
      `SELECT s.id, s.month, e.name as emp_name
       FROM salary_records s
       JOIN employees e ON s.employee_id = e.id
       WHERE s.id = $1`,
      [id]
    );

    if (existingRes.rows.length === 0) {
      return error(res, 'Salary record not found', 404);
    }

    const info = existingRes.rows[0];
    await db.query('DELETE FROM salary_records WHERE id = $1', [id]);

    broadcast('salary:deleted', {
      id,
      employeeName: info.emp_name,
      month: info.month,
      author: req.user ? req.user.name : 'User'
    });

    return success(res, { id }, `Salary record for ${info.emp_name} (${info.month}) deleted`);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};
