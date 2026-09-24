import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import SalaryRecord from '@/models/SalaryRecord';
import AccountingTransaction from '@/models/AccountingTransaction';
import DataBackup from '@/models/DataBackup';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await getAuthenticatedUser(req);
    if (!user) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }
    if (user.role !== 'Admin') {
      return apiError('Access forbidden. Required role: Admin', 403);
    }

    const body = await req.json().catch(() => ({}));
    const { scope = 'operational', note = 'Manual full clear' } = body;

    await connectToDatabase();

    // 1. Snapshot all current operational records
    const [attRows, salRows, txnRows] = await Promise.all([
      Attendance.find({}).lean(),
      SalaryRecord.find({}).lean(),
      AccountingTransaction.find({}).lean()
    ]);

    const totalCount = attRows.length + salRows.length + txnRows.length;

    if (totalCount === 0) {
      return apiSuccess(
        { cleared: false, totalCleared: 0, message: 'No operational data found to clear.' },
        'Database is already empty'
      );
    }

    const snapshot = {
      attendance: attRows,
      salary_records: salRows,
      accounting_transactions: txnRows,
      timestamp: new Date().toISOString(),
      clearedBy: user.name
    };

    // 2. Persist snapshot into DataBackup collection
    const backup = await DataBackup.create({
      backup_type: scope,
      description: note,
      cleared_by: user.name,
      records_count: totalCount,
      snapshot_data: snapshot,
      is_restored: false,
      created_at: new Date()
    });

    // 3. Clear operational collections
    await Promise.all([
      Attendance.deleteMany({}),
      SalaryRecord.deleteMany({}),
      AccountingTransaction.deleteMany({})
    ]);

    const result = {
      cleared: true,
      backupId: backup._id.toString(),
      totalCleared: totalCount,
      clearedCounts: {
        attendance: attRows.length,
        salaries: salRows.length,
        transactions: txnRows.length
      },
      createdAt: backup.created_at
    };

    return apiSuccess(result, `Cleared ${totalCount} records. Undo snapshot created.`);
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
