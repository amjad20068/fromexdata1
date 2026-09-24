import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import AccountingTransaction from '@/models/AccountingTransaction';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    await connectToDatabase();

    // Fetch all transactions in chronological order to compute exact running balance
    const allChronological = await AccountingTransaction.find({}).sort({ transaction_date: 1, _id: 1 });

    let running = 0;
    const withRunningBalance = allChronological.map((t) => {
      const inc = t.income || 0;
      const exp = t.expense || 0;
      running = running + inc - exp;
      return {
        id: t._id.toString(),
        date: t.transaction_date,
        type: t.transaction_type,
        description: t.description,
        party: t.party || 'Corporate Party',
        income: inc,
        expense: exp,
        balance: Math.round(running * 100) / 100,
        remarks: t.remarks || '',
        updated_by: t.updated_by || 'User',
        created_at: t.created_at
      };
    });

    let filtered = withRunningBalance;

    if (type && type !== 'All') {
      filtered = filtered.filter((t) => t.type.toLowerCase() === type.toLowerCase());
    }

    if (startDate) {
      filtered = filtered.filter((t) => t.date >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter((t) => t.date <= endDate);
    }

    if (search) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(
        (t) =>
          (t.description && t.description.toLowerCase().includes(term)) ||
          (t.party && t.party.toLowerCase().includes(term)) ||
          (t.remarks && t.remarks.toLowerCase().includes(term))
      );
    }

    const isAsc = sortOrder.toUpperCase() === 'ASC';
    if (!isAsc) {
      filtered = filtered.reverse();
    }

    return apiSuccess({ transactions: filtered, count: filtered.length });
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await getAuthenticatedUser(req);
    if (!user) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }

    const body = await req.json().catch(() => ({}));
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
    } = body;

    const targetDate = transaction_date || date;
    const targetType = transaction_type || type || 'Other';
    const finalDesc = description ? String(description).trim() : '';

    if (!targetDate || !finalDesc) {
      return apiError('Date and Description are required', 400);
    }

    const validTypes = ['Income', 'Expense', 'Salary', 'Other'];
    if (!validTypes.includes(targetType)) {
      return apiError(`Transaction type must be one of: ${validTypes.join(', ')}`, 400);
    }

    const inc = Math.max(0, parseFloat(String(income)) || 0);
    const exp = Math.max(0, parseFloat(String(expense)) || 0);

    if (inc === 0 && exp === 0) {
      return apiError('Please provide a non-zero Income or Expense amount', 400);
    }

    const fullDesc = party && !finalDesc.includes(party) ? `${finalDesc} (${party})` : finalDesc;

    await connectToDatabase();

    const inserted = await AccountingTransaction.create({
      transaction_date: targetDate,
      transaction_type: targetType,
      description: fullDesc,
      party: party || 'Corporate Party',
      employee_id: employee_id || null,
      income: inc,
      expense: exp,
      remarks: remarks || '',
      created_by: user._id,
      updated_by: user.name
    });

    // Compute updated running balance
    const totals = await AccountingTransaction.aggregate([
      {
        $group: {
          _id: null,
          total_income: { $sum: '$income' },
          total_expense: { $sum: '$expense' }
        }
      }
    ]);

    const totalIncome = totals[0]?.total_income || 0;
    const totalExpense = totals[0]?.total_expense || 0;
    const balance = Math.round((totalIncome - totalExpense) * 100) / 100;

    const formattedTxn = {
      id: inserted._id.toString(),
      date: targetDate,
      type: targetType,
      description: fullDesc,
      party: party || 'Corporate Party',
      income: inc,
      expense: exp,
      balance,
      remarks: remarks || '',
      updated_by: user.name
    };

    return apiSuccess({ transaction: formattedTxn }, 'Transaction recorded successfully', 201);
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
