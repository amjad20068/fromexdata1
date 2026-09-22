const db = require('../config/db');
const { success, error } = require('../utils/response');
const { broadcast } = require('../services/socketService');

async function getAll(req, res, next) {
  try {
    const { search, status, sortField, sortOrder } = req.query;

    let query = 'SELECT * FROM employees WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR employee_code ILIKE $${paramIndex} OR designation ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (status && status !== 'All') {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const validSortFields = ['id', 'employee_code', 'name', 'designation', 'basic_salary', 'status', 'created_at'];
    const field = validSortFields.includes(sortField) ? sortField : 'id';
    const order = (sortOrder && sortOrder.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';

    query += ` ORDER BY ${field} ${order}`;

    const result = await db.query(query, params);
    return success(res, { employees: result.rows, count: result.rowCount });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query('SELECT * FROM employees WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return error(res, 'Employee not found', 404);
    }

    return success(res, { employee: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { employee_code, name, phone, designation, basic_salary, allowance, deduction, status } = req.body;

    if (!name || !designation) {
      return error(res, 'Employee Name and Designation are required', 400);
    }

    let code = employee_code ? employee_code.trim() : null;
    if (!code) {
      const last = await db.query('SELECT employee_code FROM employees ORDER BY id DESC LIMIT 1');
      let nextNum = 101;
      if (last.rows.length > 0 && last.rows[0].employee_code.startsWith('FRX-')) {
        const parsed = parseInt(last.rows[0].employee_code.replace('FRX-', ''), 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
      code = `FRX-${nextNum}`;
    }

    const basic = Math.max(0, parseFloat(basic_salary) || 0);
    const allow = Math.max(0, parseFloat(allowance) || 0);
    const deduct = Math.max(0, parseFloat(deduction) || 0);

    const result = await db.query(
      `INSERT INTO employees (employee_code, name, phone, designation, basic_salary, allowance, deduction, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [code, name.trim(), phone ? phone.trim() : '', designation.trim(), basic, allow, deduct, status || 'Active']
    );

    const newEmp = result.rows[0];

    broadcast('employee:created', {
      employee: newEmp,
      author: req.user ? req.user.name : 'User'
    });

    return success(res, { employee: newEmp }, 'Employee created successfully', 201);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, phone, designation, basic_salary, allowance, deduction, status } = req.body;

    const existing = await db.query('SELECT * FROM employees WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return error(res, 'Employee not found', 404);
    }

    const emp = existing.rows[0];
    const updatedName = name ? name.trim() : emp.name;
    const updatedPhone = phone !== undefined ? phone.trim() : emp.phone;
    const updatedDesig = designation ? designation.trim() : emp.designation;
    const updatedBasic = basic_salary !== undefined ? Math.max(0, parseFloat(basic_salary) || 0) : emp.basic_salary;
    const updatedAllow = allowance !== undefined ? Math.max(0, parseFloat(allowance) || 0) : emp.allowance;
    const updatedDeduct = deduction !== undefined ? Math.max(0, parseFloat(deduction) || 0) : emp.deduction;
    const updatedStatus = status ? status.trim() : emp.status;

    const result = await db.query(
      `UPDATE employees
       SET name = $1, phone = $2, designation = $3, basic_salary = $4, allowance = $5, deduction = $6, status = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [updatedName, updatedPhone, updatedDesig, updatedBasic, updatedAllow, updatedDeduct, updatedStatus, id]
    );

    const updatedEmp = result.rows[0];

    broadcast('employee:updated', {
      employee: updatedEmp,
      author: req.user ? req.user.name : 'User'
    });

    return success(res, { employee: updatedEmp }, 'Employee updated successfully');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const existing = await db.query('SELECT * FROM employees WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return error(res, 'Employee not found', 404);
    }

    // Safety check: verify no dependent attendance or salary records exist
    const attCheck = await db.query('SELECT COUNT(*) as count FROM attendance WHERE employee_id = $1', [id]);
    const salCheck = await db.query('SELECT COUNT(*) as count FROM salary_records WHERE employee_id = $1', [id]);

    const attCount = parseInt(attCheck.rows[0].count, 10);
    const salCount = parseInt(salCheck.rows[0].count, 10);

    if (attCount > 0 || salCount > 0) {
      return error(
        res,
        `Cannot delete employee "${existing.rows[0].name}". This employee has ${attCount} attendance and ${salCount} salary records associated in history.`,
        400
      );
    }

    await db.query('DELETE FROM employees WHERE id = $1', [id]);

    broadcast('employee:deleted', {
      id,
      name: existing.rows[0].name,
      employee_code: existing.rows[0].employee_code,
      author: req.user ? req.user.name : 'User'
    });

    return success(res, { id }, `Employee ${existing.rows[0].name} deleted successfully`);
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
