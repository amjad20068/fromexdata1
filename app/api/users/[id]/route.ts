import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

const VALID_ROLES = ['Admin', 'Manager', 'Staff'];
const VALID_STATUSES = ['Active', 'Disabled'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user: authUser, errorResponse } = await getAuthenticatedUser(req);
    if (!authUser) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }

    await connectToDatabase();

    const query = id === '1'
      ? { username: 'fromex' }
      : (mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { username: id });
    const user = await User.findOne(query, 'name username role status created_at updated_at');

    if (!user) {
      return apiError('User not found', 404);
    }

    return apiSuccess({ user });
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user: authUser, errorResponse } = await getAuthenticatedUser(req);
    if (!authUser) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }
    if (authUser.role !== 'Admin') {
      return apiError('Access forbidden. Required role: Admin', 403);
    }

    await connectToDatabase();

    const query = id === '1'
      ? { username: 'fromex' }
      : (mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { username: id });
    const target = await User.findOne(query);

    if (!target) {
      return apiError('User not found', 404);
    }

    const body = await req.json().catch(() => ({}));
    const { name, username, role, status } = body;

    // Prevent Admin from disabling or demoting themselves
    if (authUser._id.toString() === target._id.toString()) {
      if (status && status === 'Disabled') {
        return apiError('You cannot disable your own administrator account', 400);
      }
      if (role && role !== 'Admin') {
        return apiError('You cannot remove your own administrator privileges', 400);
      }
    }

    if (username && String(username).trim() !== '') {
      const cleanUsername = String(username).trim().toLowerCase().replace(/^@+/, '');

      if (cleanUsername !== target.username) {
        if ((target.username === 'fromex' || target.username === 'admin') && cleanUsername !== target.username) {
          return apiError('The primary system admin username cannot be changed', 400);
        }

        if (!/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
          return apiError('Username must be 3-30 characters with alphanumeric, underscore or dash characters', 400);
        }

        const duplicateCheck = await User.findOne({ username: cleanUsername, _id: { $ne: target._id } });
        if (duplicateCheck) {
          return apiError(`Username "@${cleanUsername}" is already taken by another account`, 409);
        }

        target.username = cleanUsername;
      }
    }

    if (name) target.name = String(name).trim();
    if (role && VALID_ROLES.includes(role)) target.role = role;
    if (status && VALID_STATUSES.includes(status)) target.status = status;
    target.updated_at = new Date();

    await target.save();

    return apiSuccess({ user: target }, `User "${target.name}" (@${target.username}) updated successfully`);
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user: authUser, errorResponse } = await getAuthenticatedUser(req);
    if (!authUser) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }
    if (authUser.role !== 'Admin') {
      return apiError('Access forbidden. Required role: Admin', 403);
    }

    await connectToDatabase();

    const query = id === '1'
      ? { username: 'fromex' }
      : (mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { username: id });
    const target = await User.findOne(query);

    if (!target) {
      return apiError('User not found', 404);
    }

    if (authUser._id.toString() === target._id.toString()) {
      return apiError('You cannot delete your own active administrator account', 400);
    }

    if (target.username === 'fromex' || target.username === 'admin') {
      return apiError('The primary system admin account cannot be deleted', 400);
    }

    await User.findByIdAndDelete(target._id);

    return apiSuccess({ id: target._id.toString(), user: target }, `User "${target.name}" (@${target.username}) deleted successfully`);
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
