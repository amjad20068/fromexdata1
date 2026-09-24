import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { status } = body;

    await connectToDatabase();

    const query = id === '1'
      ? { username: 'fromex' }
      : (mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { username: id });
    const target = await User.findOne(query);

    if (!target) {
      return apiError('User not found', 404);
    }

    if (authUser._id.toString() === target._id.toString() && status === 'Disabled') {
      return apiError('You cannot disable your own administrator account', 400);
    }

    const newStatus = status ? status : (target.status === 'Active' ? 'Disabled' : 'Active');
    target.status = newStatus;
    target.updated_at = new Date();
    await target.save();

    return apiSuccess({ user: target }, `User ${target.name} is now ${newStatus}`);
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
