const db = require('../config/db');
const { success, error } = require('../utils/response');
const { broadcast } = require('../services/socketService');

async function getAll(req, res, next) {
  try {
    const {
      type,
      startDate,
      endDate,
      employee_id,
      search,
      sortField,
      sortOrder
    } = req.query;

    // First fetch all transactions in chronological order to compute exact running balance
    const allChronological = await db.query(
      `SELECT 
        t.id,
        TO_CHAR(t.transaction_date, 'YYYY-MM-DD') as date,
        t.transaction_type as type,
        t.description,
        e.name as employee_name,
        e.employee_code as emp_id,
        t.income::float as income,
        t.expense::float as expense,
        t.remarks,
        u.name as updated_by
       FROM accounting_transactions t
       LEFT JOIN employees e ON t.employee_id = e.id
       LEFT JOIN users u ON t.updated_by = u.id
       ORDER BY t.transaction_date ASC, t.id ASC`
    );

    let running = 0;
    const withRunningBalance = allChronological.rows.map(t => {
      running = running + (t.income || 0) - (t.expense || 0);
      return {
        ...t,
        party: t.employee_name ? `${t.employee_name} (${t.emp_id})` : (t.description.includes('(') ? t.description.match(/\((.*?)\)/)?.[1] || 'Corporate Party' : 'Corporate Party'),
        balance: Math.round(running * 100) / 100
      };
    });

    // Apply filtering in memory or filtered query with computed balance
    let filtered = withRunningBalance;

    if (type && type !== 'All') {
      filtered = filtered.filter(t => t.type.toLowerCase() === type.toLowerCase());
    }

    if (startDate) {
      filtered = filtered.filter(t => t.date >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(t => t.date <= endDate);
    }

    if (search) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(t =>
        (t.description && t.description.toLowerCase().includes(term)) ||
        (t.party && t.party.toLowerCase().includes(term)) ||
        (t.remarks && t.remarks.toLowerCase().includes(term))
      );
    }

    // Sort order
    const isAsc = (sortOrder && sortOrder.toUpperCase() === 'ASC');
    if (!isAsc) {
      // Default: show newest first or user specified
      if (sortField === 'date' || !sortField) {
        filtered = filtered.reverse();
      }
    }

    return success(res, { transactions: filtered, count: filtered.length });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(
      `SELECT 
        t.id,
        TO_CHAR(t.transaction_date, 'YYYY-MM-DD') as date,
        t.transaction_type as type,
        t.description,
        t.employee_id,
        t.income::float as income,
        t.expense::float as expense,
        t.remarks
       FROM accounting_transactions t
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return error(res, 'Transaction not found', 404);
    }

    return success(res, { transaction: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      date,
      transaction_date,
      type,
      transaction_type,
      description,
      party,
      employee_id,
      income,
      expense,
      remarks
    } = req.body;

    const targetDate = transaction_date || date;
    const targetType = transaction_type || type || 'Other';
    const finalDesc = description ? description.trim() : '';

    if (!targetDate || !finalDesc) {
      return error(res, 'Date and Description are required', 400);
    }

    const validTypes = ['Income', 'Expense', 'Salary', 'Other'];
    if (!validTypes.includes(targetType)) {
      return error(res, `Transaction type must be one of: ${validTypes.join(', ')}`, 400);
    }

    const inc = Math.max(0, parseFloat(income) || 0);
    const exp = Math.max(0, parseFloat(expense) || 0);

    if (inc === 0 && exp === 0) {
      return error(res, 'Please provide a non-zero Income or Expense amount', 400);
    }

    // Embed party into description if separate
    const fullDesc = (party && !finalDesc.includes(party)) ? `${finalDesc} (${party})` : finalDesc;

    const userId = req.user ? req.user.id : null;

    const insertRes = await db.query(
      `INSERT INTO accounting_transactions (transaction_date, transaction_type, description, employee_id, income, expense, remarks, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING *`,
      [targetDate, targetType, fullDesc, employee_id || null, inc, exp, remarks || '', userId]
    );

    const inserted = insertRes.rows[0];

    // Compute updated running balance
    const totals = await db.query(
      'SELECT COALESCE(SUM(income), 0)::float as total_income, COALESCE(SUM(expense), 0)::float as total_expense FROM accounting_transactions'
    );
    const balance = totals.rows[0].total_income - totals.rows[0].total_expense;

    const formattedTxn = {
      id: inserted.id,
      date: targetDate,
      type: targetType,
      description: fullDesc,
      party: party || 'Corporate Party',
      income: inc,
      expense: exp,
      balance,
      remarks: remarks || '',
      updated_by: req.user ? req.user.name : 'User'
    };

    broadcast('transaction:created', {
      transaction: formattedTxn,
      author: req.user ? req.user.name : 'User'
    });

    return success(res, { transaction: formattedTxn }, 'Transaction recorded successfully', 201);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      date,
      transaction_date,
      type,
      transaction_type,
      description,
      party,
      income,
      expense,
      remarks
    } = req.body;

    const existingRes = await db.query('SELECT * FROM accounting_transactions WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return error(res, 'Transaction not found', 404);
    }

    const current = existingRes.rows[0];
    const targetDate = (transaction_date || date) || current.transaction_date;
    const targetType = (transaction_type || type) || current.transaction_type;
    const targetDesc = description ? description.trim() : current.description;
    const fullDesc = (party && !targetDesc.includes(party)) ? `${targetDesc} (${party})` : targetDesc;

    const inc = income !== undefined ? Math.max(0, parseFloat(income) || 0) : parseFloat(current.income);
    const exp = expense !== undefined ? Math.max(0, parseFloat(expense) || 0) : parseFloat(current.expense);

    const userId = req.user ? req.user.id : null;

    const updateRes = await db.query(
      `UPDATE accounting_transactions
       SET transaction_date = $1, transaction_type = $2, description = $3, income = $4, expense = $5, remarks = $6, updated_by = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [targetDate, targetType, fullDesc, inc, exp, remarks !== undefined ? remarks : current.remarks, userId, id]
    );

    const updated = updateRes.rows[0];

    const formattedTxn = {
      id: updated.id,
      date: targetDate,
      type: targetType,
      description: fullDesc,
      party: party || 'Corporate Party',
      income: inc,
      expense: exp,
      remarks: updated.remarks,
      updated_by: req.user ? req.user.name : 'User'
    };

    broadcast('transaction:updated', {
      transaction: formattedTxn,
      author: req.user ? req.user.name : 'User'
    });

    return success(res, { transaction: formattedTxn }, 'Transaction updated successfully');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await db.query('SELECT * FROM accounting_transactions WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return error(res, 'Transaction not found', 404);
    }

    await db.query('DELETE FROM accounting_transactions WHERE id = $1', [id]);

    broadcast('transaction:deleted', {
      id,
      description: existing.rows[0].description,
      author: req.user ? req.user.name : 'User'
    });

    return success(res, { id }, 'Transaction deleted successfully');
  } catch (err) {
    next(err);
  }
}

async function getSummary(req, res, next) {
  try {
    const totals = await db.query(
      `SELECT 
        COALESCE(SUM(income), 0)::float as total_income,
        COALESCE(SUM(expense), 0)::float as total_expense,
        COUNT(*) as total_entries
       FROM accounting_transactions`
    );

    const totalIncome = totals.rows[0].total_income;
    const totalExpense = totals.rows[0].total_expense;
    const balance = Math.round((totalIncome - totalExpense) * 100) / 100;

    const month = req.query.month || 'September 2026';
    const payrollRes = await db.query(
      `SELECT 
        COALESCE(SUM(net_salary), 0)::float as total_net,
        COALESCE(SUM(basic_salary), 0)::float as total_basic,
        COALESCE(SUM(allowance), 0)::float as total_allow,
        COALESCE(SUM(deduction), 0)::float as total_deduct,
        COUNT(*) as employee_count
       FROM salary_records
       WHERE month = $1`,
      [month]
    );

    const payroll = payrollRes.rows[0];

    return success(res, {
      totalIncome,
      totalExpense,
      balance,
      totalEntries: parseInt(totals.rows[0].total_entries, 10),
      month,
      payroll: {
        totalNetSalary: payroll.total_net,
        totalBasicSalary: payroll.total_basic,
        totalAllowance: payroll.total_allow,
        totalDeduction: payroll.total_deduct,
        employeeCount: parseInt(payroll.employee_count, 10)
      }
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
