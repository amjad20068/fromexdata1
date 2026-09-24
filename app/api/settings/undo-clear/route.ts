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
    const { backupId } = body;

    await connectToDatabase();

    let backupDoc;
    if (backupId) {
      backupDoc = await DataBackup.findById(backupId);
    } else {
      backupDoc = await DataBackup.findOne({ is_restored: false }).sort({ created_at: -1 });
      if (!backupDoc) {
        backupDoc = await DataBackup.findOne({}).sort({ created_at: -1 });
      }
    }

    if (!backupDoc) {
      return apiError('No backup snapshot found to restore.', 404);
    }

    let snapshot = backupDoc.snapshot_data;
    if (typeof snapshot === 'string') {
      try {
        snapshot = JSON.parse(snapshot);
      } catch (e) {
        return apiError('Invalid or corrupted snapshot data.', 500);
      }
    }

    // Clear existing operational data before restoring
    await Promise.all([
      Attendance.deleteMany({}),
      SalaryRecord.deleteMany({}),
      AccountingTransaction.deleteMany({})
    ]);

    let restoredAttendance = 0;
    let restoredSalaries = 0;
    let restoredTransactions = 0;

    // Restore Attendance
    if (Array.isArray(snapshot.attendance) && snapshot.attendance.length > 0) {
      const docs = snapshot.attendance.map((a: any) => {
        const { _id, id, ...rest } = a;
        return {
          ...rest,
          _id: _id || id
        };
      });
      await Attendance.insertMany(docs, { ordered: false });
      restoredAttendance = docs.length;
    }

    // Restore Salaries
    if (Array.isArray(snapshot.salary_records) && snapshot.salary_records.length > 0) {
      const docs = snapshot.salary_records.map((s: any) => {
        const { _id, id, ...rest } = s;
        return {
          ...rest,
          _id: _id || id
        };
      });
      await SalaryRecord.insertMany(docs, { ordered: false });
      restoredSalaries = docs.length;
    }

    // Restore Transactions
    if (Array.isArray(snapshot.accounting_transactions) && snapshot.accounting_transactions.length > 0) {
      const docs = snapshot.accounting_transactions.map((t: any) => {
        const { _id, id, ...rest } = t;
        return {
          ...rest,
          _id: _id || id
        };
      });
      await AccountingTransaction.insertMany(docs, { ordered: false });
      restoredTransactions = docs.length;
    }

    backupDoc.is_restored = true;
    backupDoc.restored_at = new Date();
    await backupDoc.save();

    const totalRestored = restoredAttendance + restoredSalaries + restoredTransactions;

    return apiSuccess(
      {
        restored: true,
        backupId: backupDoc._id.toString(),
        totalRestored,
        restoredCounts: {
          attendance: restoredAttendance,
          salaries: restoredSalaries,
          transactions: restoredTransactions
        }
      },
      `Successfully restored ${totalRestored} records!`
    );
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
