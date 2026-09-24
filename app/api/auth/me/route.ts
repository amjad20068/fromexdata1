import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const { user, errorResponse } = await getAuthenticatedUser(req);
    if (!user) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }

    return apiSuccess({ user }, 'User profile retrieved');
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
