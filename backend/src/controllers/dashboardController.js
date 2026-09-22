const db = require('../config/db');
const { success } = require('../utils/response');

async function getMetrics(req, res, next) {
  try {
    const today = req.query.date || '2026-09-16';
    const month = req.query.month || 'September 2026';

    // 1. Total Employees
    const empRes = await db.query("SELECT COUNT(*) as count FROM employees WHERE status = 'Active'");
    const totalEmployees = parseInt(empRes.rows[0].count, 10);

    // 2. Attendance Today
    const attTodayRes = await db.query(
      'SELECT status, working_hours FROM attendance WHERE attendance_date = $1',
      [today]
    );

    let presentToday = 0;
    let absentToday = 0;
    let halfDayToday = 0;
    let leaveToday = 0;

    for (const a of attTodayRes.rows) {
      if (a.status === 'Present') presentToday++;
      else if (a.status === 'Absent') absentToday++;
      else if (a.status === 'Half Day') halfDayToday++;
      else if (a.status === 'Leave') leaveToday++;
    }

    // 3. Monthly Payroll
    const salaryRes = await db.query(
      `SELECT 
        COALESCE(SUM(net_salary), 0)::float as total_salary,
        COALESCE(SUM(basic_salary), 0)::float as total_basic,
        COUNT(*) as salary_count
       FROM salary_records
       WHERE month = $1`,
      [month]
    );

    const totalSalary = salaryRes.rows[0].total_salary;
    const salaryCount = parseInt(salaryRes.rows[0].salary_count, 10);

    // 4. Accounting Entries & Net Cash Balance
    const txnTotals = await db.query(
      `SELECT 
        COUNT(*) as total_entries,
        COALESCE(SUM(income), 0)::float as total_income,
        COALESCE(SUM(expense), 0)::float as total_expense
       FROM accounting_transactions`
    );

    const totalIncome = txnTotals.rows[0].total_income;
    const totalExpense = txnTotals.rows[0].total_expense;
    const netCashBalance = Math.round((totalIncome - totalExpense) * 100) / 100;

    // 5. Weekly Attendance Trends (Last 7 distinct dates)
    const trendRes = await db.query(
      `SELECT 
        TO_CHAR(attendance_date, 'YYYY-MM-DD') as date,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)::int as present,
        SUM(CASE WHEN status = 'Half Day' THEN 1 ELSE 0 END)::int as "halfDay",
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END)::int as absent,
        SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END)::int as leave
       FROM attendance
       GROUP BY attendance_date
       ORDER BY attendance_date DESC
       LIMIT 7`
    );

    const weeklyTrend = trendRes.rows.reverse();

    // 6. Recent Activities
    const recentTxns = await db.query(
      `SELECT 
        t.id,
        TO_CHAR(t.transaction_date, 'YYYY-MM-DD') as date,
        t.transaction_type as type,
        t.description,
        e.name as party,
        t.income::float as income,
        t.expense::float as expense
       FROM accounting_transactions t
       LEFT JOIN employees e ON t.employee_id = e.id
       ORDER BY t.transaction_date DESC, t.id DESC
       LIMIT 5`
    );

    const recentAtt = await db.query(
      `SELECT 
        a.id,
        e.employee_code as emp_id,
        e.name as emp_name,
        TO_CHAR(a.attendance_date, 'YYYY-MM-DD') as date,
        a.status,
        a.working_hours::float as working_hours,
        u.name as updated_by
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       LEFT JOIN users u ON a.updated_by = u.id
       ORDER BY a.attendance_date DESC, a.id DESC
       LIMIT 5`
    );

    const attendanceRate = totalEmployees > 0
      ? Math.round(((presentToday + halfDayToday * 0.5) / totalEmployees) * 100)
      : 0;

    return success(res, {
      today,
      currentMonth: month,
      kpis: {
        totalEmployees,
        presentToday,
        absentToday,
        halfDayToday,
        leaveToday,
        attendanceRate,
        totalSalary,
        salaryCount,
        totalAccountingEntries: parseInt(txnTotals.rows[0].total_entries, 10),
        totalIncome,
        totalExpense,
        netCashBalance
      },
      weeklyTrend,
      recentAttendance: recentAtt.rows,
      recentTransactions: recentTxns.rows.map(t => ({
        ...t,
        party: t.party || (t.description.includes('(') ? t.description.match(/\((.*?)\)/)?.[1] || 'Corporate Party' : 'Corporate Party')
      }))
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMetrics
};
