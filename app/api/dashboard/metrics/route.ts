import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import Attendance from '@/models/Attendance';
import SalaryRecord from '@/models/SalaryRecord';
import AccountingTransaction from '@/models/AccountingTransaction';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const today = searchParams.get('date') || now.toISOString().split('T')[0];
    const defaultMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const month = searchParams.get('month') || defaultMonth;

    await connectToDatabase();

    // 1. Total Active Employees
    const totalEmployees = await Employee.countDocuments({ status: 'Active' });

    // 2. Attendance Today
    const attToday = await Attendance.find({ attendance_date: today });
    let presentToday = 0;
    let absentToday = 0;
    let halfDayToday = 0;
    let leaveToday = 0;

    for (const a of attToday) {
      if (a.status === 'Present') presentToday++;
      else if (a.status === 'Absent') absentToday++;
      else if (a.status === 'Half Day') halfDayToday++;
      else if (a.status === 'Leave') leaveToday++;
    }

    const attendanceRate = totalEmployees > 0
      ? Math.round(((presentToday + halfDayToday * 0.5) / totalEmployees) * 100)
      : 0;

    // 3. Monthly Payroll
    const salaryTotals = await SalaryRecord.aggregate([
      { $match: { month } },
      {
        $group: {
          _id: null,
          total_salary: { $sum: '$net_salary' },
          total_basic: { $sum: '$basic_salary' },
          salary_count: { $sum: 1 }
        }
      }
    ]);

    const totalSalary = salaryTotals[0]?.total_salary || 0;
    const salaryCount = salaryTotals[0]?.salary_count || 0;

    // 4. Accounting Entries & Net Cash Balance
    const txnTotals = await AccountingTransaction.aggregate([
      {
        $group: {
          _id: null,
          total_entries: { $sum: 1 },
          total_income: { $sum: '$income' },
          total_expense: { $sum: '$expense' }
        }
      }
    ]);

    const totalAccountingEntries = txnTotals[0]?.total_entries || 0;
    const totalIncome = txnTotals[0]?.total_income || 0;
    const totalExpense = txnTotals[0]?.total_expense || 0;
    const netCashBalance = Math.round((totalIncome - totalExpense) * 100) / 100;

    // 5. Weekly Attendance Trends (Last 7 distinct dates)
    const trendAgg = await Attendance.aggregate([
      {
        $group: {
          _id: '$attendance_date',
          present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          halfDay: { $sum: { $cond: [{ $eq: ['$status', 'Half Day'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
          leave: { $sum: { $cond: [{ $eq: ['$status', 'Leave'] }, 1, 0] } }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 7 }
    ]);

    const weeklyTrend = trendAgg.map(t => ({
      date: t._id,
      present: t.present,
      halfDay: t.halfDay,
      absent: t.absent,
      leave: t.leave
    })).reverse();

    // 6. Recent Attendance
    const recentAtt = await Attendance.find({})
      .sort({ attendance_date: -1, _id: -1 })
      .limit(5);

    // 7. Recent Transactions
    const recentTxns = await AccountingTransaction.find({})
      .sort({ transaction_date: -1, _id: -1 })
      .limit(5);

    return apiSuccess({
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
        totalAccountingEntries,
        totalIncome,
        totalExpense,
        netCashBalance
      },
      weeklyTrend,
      recentAttendance: recentAtt.map(a => ({
        id: a._id.toString(),
        emp_id: a.emp_id,
        emp_name: a.emp_name,
        date: a.attendance_date,
        status: a.status,
        working_hours: a.working_hours,
        updated_by: a.updated_by
      })),
      recentTransactions: recentTxns.map(t => ({
        id: t._id.toString(),
        date: t.transaction_date,
        type: t.transaction_type,
        description: t.description,
        party: t.party,
        income: t.income,
        expense: t.expense
      }))
    });
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
