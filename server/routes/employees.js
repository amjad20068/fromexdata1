const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { broadcast } = require('./sync');

// Get all employees
router.get('/', (req, res) => {
  const { search, department, status, sortField, sortOrder } = req.query;

  let query = 'SELECT * FROM employees WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR emp_id LIKE ? OR designation LIKE ? OR department LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (department && department !== 'All') {
    query += ' AND department = ?';
    params.push(department);
  }

  if (status && status !== 'All') {
    query += ' AND status = ?';
    params.push(status);
  }

  // Safe sorting
  const validSortFields = ['id', 'emp_id', 'name', 'department', 'designation', 'basic_salary', 'status', 'created_at'];
  const field = validSortFields.includes(sortField) ? sortField : 'emp_id';
  const order = (sortOrder && sortOrder.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';

  query += ` ORDER BY ${field} ${order}`;

  const employees = db.prepare(query).all(...params);
  res.json({ success: true, employees });
});

// Create new employee
router.post('/', authMiddleware, (req, res) => {
  const { emp_id, name, department, designation, email, phone, basic_salary, status } = req.body;

  if (!name || !department || !designation) {
    return res.status(400).json({ success: false, message: 'Name, department, and designation are required' });
  }

  // Auto-generate employee ID if not provided
  let finalEmpId = emp_id ? emp_id.trim() : null;
  if (!finalEmpId) {
    const lastEmp = db.prepare('SELECT emp_id FROM employees ORDER BY id DESC LIMIT 1').get();
    let nextNum = 101;
    if (lastEmp && lastEmp.emp_id.startsWith('FRX-')) {
      const parsed = parseInt(lastEmp.emp_id.replace('FRX-', ''), 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    finalEmpId = `FRX-${nextNum}`;
  }

  // Check unique emp_id
  const existing = db.prepare('SELECT id FROM employees WHERE emp_id = ?').get(finalEmpId);
  if (existing) {
    return res.status(400).json({ success: false, message: `Employee ID ${finalEmpId} already exists` });
  }

  const result = db.prepare(`
    INSERT INTO employees (emp_id, name, department, designation, email, phone, basic_salary, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    finalEmpId,
    name.trim(),
    department.trim(),
    designation.trim(),
    email ? email.trim() : '',
    phone ? phone.trim() : '',
    Number(basic_salary) || 0,
    status || 'Active'
  );

  const newEmp = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);

  broadcast('employee_updated', {
    action: 'create',
    user: req.user.name,
    employee: newEmp,
    timestamp: new Date().toISOString()
  });

  res.status(201).json({ success: true, message: 'Employee added successfully', employee: newEmp });
});

// Update employee
router.put('/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, department, designation, email, phone, basic_salary, status } = req.body;

  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  db.prepare(`
    UPDATE employees
    SET name = ?, department = ?, designation = ?, email = ?, phone = ?, basic_salary = ?, status = ?
    WHERE id = ?
  `).run(
    name ? name.trim() : existing.name,
    department ? department.trim() : existing.department,
    designation ? designation.trim() : existing.designation,
    email !== undefined ? email.trim() : existing.email,
    phone !== undefined ? phone.trim() : existing.phone,
    basic_salary !== undefined ? Number(basic_salary) : existing.basic_salary,
    status ? status.trim() : existing.status,
    id
  );

  const updatedEmp = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);

  broadcast('employee_updated', {
    action: 'update',
    user: req.user.name,
    employee: updatedEmp,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: 'Employee updated successfully', employee: updatedEmp });
});

// Delete employee
router.delete('/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  db.prepare('DELETE FROM employees WHERE id = ?').run(id);

  broadcast('employee_updated', {
    action: 'delete',
    user: req.user.name,
    id,
    emp_id: existing.emp_id,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: `Employee ${existing.name} (${existing.emp_id}) deleted successfully` });
});

module.exports = router;
