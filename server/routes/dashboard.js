const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/metrics', (req, res) => {
  const today = req.query.date || new Date().toISOString().split('T')[0];
  const currentMonth = req.query.month || 'September 2026';

  // 1. Total Employees
  const empStat = db.prepare("SELECT COUNT(*) as count FROM employees WHERE status = 'Active'").get();
  const totalEmployees = empStat ? empStat.count : 0;

  // 2. Attendance Today
  const attendanceToday = db.prepare('SELECT status, working_hours FROM attendance WHERE date = ?').all(today);
  let presentToday = 0;
  let absentToday = 0;
  let halfDayToday = 0;
  let leaveToday = 0;

  for (const a of attendanceToday) {
    if (a.status === 'Present') presentToday++;
    else if (a.status === 'Absent') absentToday++;
    else if (a.status === 'Half Day') halfDayToday++;
    else if (a.status === 'Leave') leaveToday++;
  }

  // 3. Total Salary (for current month)
  const salaryStat = db.prepare(`
    SELECT
      COALESCE(SUM(net_salary), 0) as totalSalary,
      COALESCE(SUM(basic_salary), 0) as totalBasic,
      COUNT(*) as salaryCount
    FROM salaries
    WHERE month = ?
  `).get(currentMonth);

  // 4. Accounting Entries & Net Cash Balance
  const txnStat = db.prepare(`
    SELECT
      COUNT(*) as totalEntries,
      COALESCE(SUM(income), 0) as totalIncome,
      COALESCE(SUM(expense), 0) as totalExpense
    FROM transactions
  `).get();

  const netCashBalance = (txnStat.totalIncome || 0) - (txnStat.totalExpense || 0);

  // 5. Weekly Attendance Trend (Last 7 days or sample days)
  const recentDays = db.prepare(`
    SELECT
      date,
      SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN status = 'Half Day' THEN 1 ELSE 0 END) as halfDay,
      SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) as leave
    FROM attendance
    GROUP BY date
    ORDER BY date DESC
    LIMIT 7
  `).all().reverse();

  // 6. Recent Activities
  const recentTransactions = db.prepare(`
    SELECT id, date, type, description, party, income, expense, balance
    FROM transactions
    ORDER BY date DESC, id DESC
    LIMIT 5
  `).all();

  const recentAttendance = db.prepare(`
    SELECT id, emp_id, emp_name, date, status, check_in, check_out, working_hours, updated_by
    FROM attendance
    ORDER BY date DESC, id DESC
    LIMIT 5
  `).all();

  res.json({
    success: true,
    today,
    currentMonth,
    kpis: {
      totalEmployees,
      presentToday,
      absentToday,
      halfDayToday,
      leaveToday,
      attendanceRate: totalEmployees > 0 ? Math.round(((presentToday + halfDayToday * 0.5) / totalEmployees) * 100) : 0,
      totalSalary: salaryStat.totalSalary,
      salaryCount: salaryStat.salaryCount,
      totalAccountingEntries: txnStat.totalEntries,
      totalIncome: txnStat.totalIncome,
      totalExpense: txnStat.totalExpense,
      netCashBalance
    },
    weeklyTrend: recentDays,
    recentTransactions,
    recentAttendance
  });
});

module.exports = router;
