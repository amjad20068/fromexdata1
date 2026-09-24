import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import AccountingTransaction from '@/models/AccountingTransaction';
import SalaryRecord from '@/models/SalaryRecord';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const defaultMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const month = searchParams.get('month') || defaultMonth;

    await connectToDatabase();

    const txnTotals = await AccountingTransaction.aggregate([
      {
        $group: {
          _id: null,
          total_income: { $sum: '$income' },
          total_expense: { $sum: '$expense' },
          total_entries: { $sum: 1 }
        }
      }
    ]);

    const totalIncome = txnTotals[0]?.total_income || 0;
    const totalExpense = txnTotals[0]?.total_expense || 0;
    const balance = Math.round((totalIncome - totalExpense) * 100) / 100;
    const totalEntries = txnTotals[0]?.total_entries || 0;

    const payrollTotals = await SalaryRecord.aggregate([
      { $match: { month } },
      {
        $group: {
          _id: null,
          total_net: { $sum: '$net_salary' },
          total_basic: { $sum: '$basic_salary' },
          total_allow: { $sum: '$allowance' },
          total_deduct: { $sum: '$deduction' },
          employee_count: { $sum: 1 }
        }
      }
    ]);

    const payroll = {
      totalNetSalary: payrollTotals[0]?.total_net || 0,
      totalBasicSalary: payrollTotals[0]?.total_basic || 0,
      totalAllowance: payrollTotals[0]?.total_allow || 0,
      totalDeduction: payrollTotals[0]?.total_deduct || 0,
      employeeCount: payrollTotals[0]?.employee_count || 0
    };

    return apiSuccess({
      totalIncome,
      totalExpense,
      balance,
      totalEntries,
      month,
      payroll
    });
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
