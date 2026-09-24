import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user: authUser, errorResponse } = await getAuthenticatedUser(req);
    if (!authUser) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }
    if (authUser.role !== 'Admin') {
      return apiError('Access forbidden. Required role: Admin', 403);
    }

    const body = await req.json().catch(() => ({}));
    const { newPassword } = body;

    if (!newPassword || String(newPassword).length < 6) {
      return apiError('New password must be at least 6 characters long', 400);
    }

    await connectToDatabase();

    const query = id === '1'
      ? { username: 'fromex' }
      : (mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { username: id });
    const target = await User.findOne(query);

    if (!target) {
      return apiError('User not found', 404);
    }

    target.password_hash = await bcrypt.hash(String(newPassword), 10);
    target.updated_at = new Date();
    await target.save();

    return apiSuccess({ id: target._id.toString(), username: target.username }, `Password for "${target.name}" reset successfully`);
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
