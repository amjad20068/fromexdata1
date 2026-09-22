const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { broadcast } = require('./sync');

// Helper to recalculate running balances for all transactions in chronological order
function recalculateAllBalances() {
  const transactions = db.prepare('SELECT id, income, expense FROM transactions ORDER BY date ASC, id ASC').all();
  let running = 0;
  const updateStmt = db.prepare('UPDATE transactions SET balance = ? WHERE id = ?');

  for (const t of transactions) {
    running = running + (t.income || 0) - (t.expense || 0);
    updateStmt.run(running, t.id);
  }
  return running;
}

// ==========================================
// 1. SALARY / PAYROLL MANAGEMENT
// ==========================================

// GET /api/accounting/salaries - List salaries with filtering and search
router.get('/salaries', (req, res) => {
  const { month, status, search, sortField, sortOrder } = req.query;

  let query = 'SELECT * FROM salaries WHERE 1=1';
  const params = [];

  if (month && month !== 'All') {
    query += ' AND month = ?';
    params.push(month);
  }

  if (status && status !== 'All') {
    query += ' AND payment_status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND (emp_name LIKE ? OR emp_id LIKE ? OR remarks LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  const validSortFields = ['id', 'emp_id', 'emp_name', 'month', 'basic_salary', 'allowance', 'deduction', 'net_salary', 'payment_date', 'payment_status'];
  const field = validSortFields.includes(sortField) ? sortField : 'id';
  const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

  query += ` ORDER BY ${field} ${order}`;

  const salaries = db.prepare(query).all(...params);
  res.json({ success: true, salaries, count: salaries.length });
});

// POST /api/accounting/salaries - Add employee salary
router.post('/salaries', authMiddleware, (req, res) => {
  const {
    emp_id,
    emp_name,
    month,
    basic_salary,
    allowance,
    deduction,
    payment_date,
    payment_status,
    remarks
  } = req.body;

  if (!emp_id || !month) {
    return res.status(400).json({ success: false, message: 'Employee ID and Month are required' });
  }

  let resolvedName = emp_name ? emp_name.trim() : '';
  if (!resolvedName) {
    const emp = db.prepare('SELECT name FROM employees WHERE emp_id = ?').get(emp_id.trim());
    if (emp) resolvedName = emp.name;
    else resolvedName = emp_id.trim();
  }

  const basic = Math.max(0, Number(basic_salary) || 0);
  const allow = Math.max(0, Number(allowance) || 0);
  const deduct = Math.max(0, Number(deduction) || 0);

  // Exact Formula: Net Salary = Basic Salary + Allowance - Deduction
  const netSalary = Math.max(0, basic + allow - deduct);

  // Check if salary for this employee and month already exists
  const existing = db.prepare('SELECT id FROM salaries WHERE emp_id = ? AND month = ?').get(emp_id.trim(), month.trim());
  if (existing) {
    return res.status(400).json({
      success: false,
      message: `Salary for ${resolvedName} for ${month} already exists. Please edit the existing entry.`
    });
  }

  const result = db.prepare(`
    INSERT INTO salaries (emp_id, emp_name, month, basic_salary, allowance, deduction, net_salary, payment_date, payment_status, remarks, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    emp_id.trim(),
    resolvedName,
    month.trim(),
    basic,
    allow,
    deduct,
    netSalary,
    payment_date ? payment_date.trim() : '',
    payment_status || 'Pending',
    remarks ? remarks.trim() : '',
    req.user.name
  );

  const newSalary = db.prepare('SELECT * FROM salaries WHERE id = ?').get(result.lastInsertRowid);

  broadcast('accounting_updated', {
    module: 'salaries',
    action: 'create',
    user: req.user.name,
    salary: newSalary,
    timestamp: new Date().toISOString()
  });

  res.status(201).json({ success: true, message: 'Salary recorded successfully', salary: newSalary });
});

// PUT /api/accounting/salaries/:id - Update salary
router.put('/salaries/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM salaries WHERE id = ?').get(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Salary record not found' });
  }

  const {
    emp_id,
    emp_name,
    month,
    basic_salary,
    allowance,
    deduction,
    payment_date,
    payment_status,
    remarks
  } = req.body;

  const basic = basic_salary !== undefined ? Math.max(0, Number(basic_salary) || 0) : existing.basic_salary;
  const allow = allowance !== undefined ? Math.max(0, Number(allowance) || 0) : existing.allowance;
  const deduct = deduction !== undefined ? Math.max(0, Number(deduction) || 0) : existing.deduction;

  // Exact formula: Net Salary = Basic + Allowance - Deduction
  const netSalary = Math.max(0, basic + allow - deduct);

  const finalEmpId = emp_id ? emp_id.trim() : existing.emp_id;
  let resolvedName = emp_name ? emp_name.trim() : existing.emp_name;
  if (!resolvedName || resolvedName !== existing.emp_name) {
    const emp = db.prepare('SELECT name FROM employees WHERE emp_id = ?').get(finalEmpId);
    if (emp) resolvedName = emp.name;
  }

  db.prepare(`
    UPDATE salaries
    SET emp_id = ?, emp_name = ?, month = ?, basic_salary = ?, allowance = ?, deduction = ?, net_salary = ?, payment_date = ?, payment_status = ?, remarks = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    finalEmpId,
    resolvedName,
    month ? month.trim() : existing.month,
    basic,
    allow,
    deduct,
    netSalary,
    payment_date !== undefined ? payment_date.trim() : existing.payment_date,
    payment_status || existing.payment_status,
    remarks !== undefined ? remarks.trim() : existing.remarks,
    req.user.name,
    id
  );

  const updatedSalary = db.prepare('SELECT * FROM salaries WHERE id = ?').get(id);

  broadcast('accounting_updated', {
    module: 'salaries',
    action: 'update',
    user: req.user.name,
    salary: updatedSalary,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: 'Salary updated successfully', salary: updatedSalary });
});

// DELETE /api/accounting/salaries/:id - Delete salary
router.delete('/salaries/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM salaries WHERE id = ?').get(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Salary record not found' });
  }

  db.prepare('DELETE FROM salaries WHERE id = ?').run(id);

  broadcast('accounting_updated', {
    module: 'salaries',
    action: 'delete',
    user: req.user.name,
    id,
    emp_name: existing.emp_name,
    month: existing.month,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: `Salary record for ${existing.emp_name} (${existing.month}) deleted` });
});

// ==========================================
// 2. ACCOUNTING TRANSACTIONS & CASH LEDGER
// ==========================================

// GET /api/accounting/transactions - List transactions with balance calculation
router.get('/transactions', (req, res) => {
  const { type, startDate, endDate, search, sortField, sortOrder } = req.query;

  // Ensure all running balances are fresh
  recalculateAllBalances();

  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params = [];

  if (type && type !== 'All') {
    query += ' AND type = ?';
    params.push(type);
  }

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  if (search) {
    query += ' AND (description LIKE ? OR party LIKE ? OR remarks LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  const validSortFields = ['id', 'date', 'type', 'description', 'party', 'income', 'expense', 'balance'];
  const field = validSortFields.includes(sortField) ? sortField : 'date';
  const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

  query += ` ORDER BY ${field} ${order}, id ${order}`;

  const transactions = db.prepare(query).all(...params);
  res.json({ success: true, transactions, count: transactions.length });
});

// POST /api/accounting/transactions - Add transaction
router.post('/transactions', authMiddleware, (req, res) => {
  const {
    date,
    type,
    description,
    party,
    income,
    expense,
    remarks
  } = req.body;

  if (!date || !type || !description || !party) {
    return res.status(400).json({ success: false, message: 'Date, Type, Description, and Party are required' });
  }

  const validTypes = ['Income', 'Expense', 'Salary', 'Other'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ success: false, message: `Invalid type. Allowed: ${validTypes.join(', ')}` });
  }

  const inc = Math.max(0, Number(income) || 0);
  const exp = Math.max(0, Number(expense) || 0);

  const result = db.prepare(`
    INSERT INTO transactions (date, type, description, party, income, expense, balance, remarks, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    date.trim(),
    type.trim(),
    description.trim(),
    party.trim(),
    inc,
    exp,
    remarks ? remarks.trim() : '',
    req.user.name
  );

  // Recalculate all chronological balances
  recalculateAllBalances();

  const newTxn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);

  broadcast('accounting_updated', {
    module: 'transactions',
    action: 'create',
    user: req.user.name,
    transaction: newTxn,
    timestamp: new Date().toISOString()
  });

  res.status(201).json({ success: true, message: 'Transaction recorded successfully', transaction: newTxn });
});

// PUT /api/accounting/transactions/:id - Update transaction
router.put('/transactions/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }

  const {
    date,
    type,
    description,
    party,
    income,
    expense,
    remarks
  } = req.body;

  const inc = income !== undefined ? Math.max(0, Number(income) || 0) : existing.income;
  const exp = expense !== undefined ? Math.max(0, Number(expense) || 0) : existing.expense;

  db.prepare(`
    UPDATE transactions
    SET date = ?, type = ?, description = ?, party = ?, income = ?, expense = ?, remarks = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    date ? date.trim() : existing.date,
    type ? type.trim() : existing.type,
    description ? description.trim() : existing.description,
    party ? party.trim() : existing.party,
    inc,
    exp,
    remarks !== undefined ? remarks.trim() : existing.remarks,
    req.user.name,
    id
  );

  recalculateAllBalances();

  const updatedTxn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);

  broadcast('accounting_updated', {
    module: 'transactions',
    action: 'update',
    user: req.user.name,
    transaction: updatedTxn,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: 'Transaction updated successfully', transaction: updatedTxn });
});

// DELETE /api/accounting/transactions/:id - Delete transaction
router.delete('/transactions/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }

  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);

  recalculateAllBalances();

  broadcast('accounting_updated', {
    module: 'transactions',
    action: 'delete',
    user: req.user.name,
    id,
    description: existing.description,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: `Transaction "${existing.description}" deleted` });
});

// ==========================================
// 3. ACCOUNTING FINANCIAL SUMMARY
// ==========================================

router.get('/summary', (req, res) => {
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(income), 0) as totalIncome,
      COALESCE(SUM(expense), 0) as totalExpense,
      COUNT(*) as totalEntries
    FROM transactions
  `).get();

  const currentBalance = totals.totalIncome - totals.totalExpense;

  // Monthly payroll summary
  const currentMonth = req.query.month || 'September 2026';
  const payroll = db.prepare(`
    SELECT
      COALESCE(SUM(net_salary), 0) as totalNetSalary,
      COALESCE(SUM(basic_salary), 0) as totalBasicSalary,
      COALESCE(SUM(allowance), 0) as totalAllowance,
      COALESCE(SUM(deduction), 0) as totalDeduction,
      COUNT(*) as employeeCount
    FROM salaries
    WHERE month = ?
  `).get(currentMonth);

  const paidPayroll = db.prepare(`
    SELECT COALESCE(SUM(net_salary), 0) as paid
    FROM salaries
    WHERE month = ? AND payment_status = 'Paid'
  `).get(currentMonth).paid;

  res.json({
    success: true,
    totalIncome: totals.totalIncome,
    totalExpense: totals.totalExpense,
    balance: currentBalance,
    totalEntries: totals.totalEntries,
    month: currentMonth,
    payroll: {
      totalNetSalary: payroll.totalNetSalary,
      totalBasicSalary: payroll.totalBasicSalary,
      totalAllowance: payroll.totalAllowance,
      totalDeduction: payroll.totalDeduction,
      employeeCount: payroll.employeeCount,
      paid: paidPayroll,
      pending: payroll.totalNetSalary - paidPayroll
    }
  });
});

module.exports = router;
