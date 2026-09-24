import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import SalaryRecord from '@/models/SalaryRecord';
import AccountingTransaction from '@/models/AccountingTransaction';
import Employee from '@/models/Employee';
import User from '@/models/User';
import DataBackup from '@/models/DataBackup';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const { user, errorResponse } = await getAuthenticatedUser(req);
    if (!user) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }

    await connectToDatabase();

    const [attCount, salCount, txnCount, empCount, userCount, latestBackups] = await Promise.all([
      Attendance.countDocuments(),
      SalaryRecord.countDocuments(),
      AccountingTransaction.countDocuments(),
      Employee.countDocuments(),
      User.countDocuments(),
      DataBackup.find({}, 'backup_type description records_count is_restored created_at restored_at cleared_by')
        .sort({ created_at: -1 })
        .limit(5)
    ]);

    const stats = {
      attendance: attCount,
      salaries: salCount,
      transactions: txnCount,
      employees: empCount,
      users: userCount,
      totalOperationalRecords: attCount + salCount + txnCount,
      latestBackups
    };

    return apiSuccess(stats, 'System statistics retrieved successfully');
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
