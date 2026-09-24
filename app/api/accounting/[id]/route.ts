import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import AccountingTransaction from '@/models/AccountingTransaction';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();

    const transaction = await AccountingTransaction.findById(id);
    if (!transaction) {
      return apiError('Transaction not found', 404);
    }

    return apiSuccess({ transaction });
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, errorResponse } = await getAuthenticatedUser(req);
    if (!user) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }

    await connectToDatabase();
    const current = await AccountingTransaction.findById(id);
    if (!current) {
      return apiError('Transaction not found', 404);
    }

    const body = await req.json().catch(() => ({}));
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
    } = body;

    const targetDate = (transaction_date || date) || current.transaction_date;
    const targetType = (transaction_type || type) || current.transaction_type;
    const targetDesc = description ? String(description).trim() : current.description;
    const fullDesc = party && !targetDesc.includes(party) ? `${targetDesc} (${party})` : targetDesc;

    const inc = income !== undefined ? Math.max(0, parseFloat(String(income)) || 0) : current.income;
    const exp = expense !== undefined ? Math.max(0, parseFloat(String(expense)) || 0) : current.expense;

    current.transaction_date = targetDate;
    current.transaction_type = targetType;
    current.description = fullDesc;
    if (party) current.party = party;
    current.income = inc;
    current.expense = exp;
    if (remarks !== undefined) current.remarks = remarks;
    current.updated_by = user.name;
    current.updated_at = new Date();

    await current.save();

    const formattedTxn = {
      id: current._id.toString(),
      date: targetDate,
      type: targetType,
      description: fullDesc,
      party: current.party || 'Corporate Party',
      income: inc,
      expense: exp,
      remarks: current.remarks,
      updated_by: user.name
    };

    return apiSuccess({ transaction: formattedTxn }, 'Transaction updated successfully');
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, errorResponse } = await getAuthenticatedUser(req);
    if (!user) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }

    await connectToDatabase();
    const existing = await AccountingTransaction.findByIdAndDelete(id);
    if (!existing) {
      return apiError('Transaction not found', 404);
    }

    return apiSuccess({ id }, 'Transaction deleted successfully');
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
