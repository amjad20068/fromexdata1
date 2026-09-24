import { NextRequest } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import DataBackup from '@/models/DataBackup';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const { user, errorResponse } = await getAuthenticatedUser(req);
    if (!user) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }
    if (user.role !== 'Admin') {
      return apiError('Access forbidden. Required role: Admin', 403);
    }

    await connectToDatabase();

    const backups = await DataBackup.find({}, 'backup_type description cleared_by records_count is_restored created_at restored_at')
      .sort({ created_at: -1 })
      .limit(20);

    return apiSuccess({ backups }, 'Backups retrieved');
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
