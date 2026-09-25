import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthenticatedUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

const VALID_ROLES = ['Admin', 'Manager', 'Staff'];
const VALID_STATUSES = ['Active', 'Disabled'];

export async function GET(req: NextRequest) {
  try {
    const { user, errorResponse } = await getAuthenticatedUser(req);
    if (!user) {
      return apiError(errorResponse?.message || 'Unauthorized', errorResponse?.status || 401);
    }
    if (user.role !== 'Admin') {
      return apiError('Access forbidden. Required role: Admin', 403);
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const sortField = searchParams.get('sortField') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    await connectToDatabase();

    const query: any = {};

    if (search) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { username: { $regex: term, $options: 'i' } }
      ];
    }

    if (role && role !== 'All') {
      query.role = role;
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    const validSortMap: Record<string, string> = {
      id: '_id',
      name: 'name',
      username: 'username',
      role: 'role',
      status: 'status',
      created_at: 'created_at'
    };

    const sortCol = validSortMap[sortField] || 'created_at';
    const sortDir = sortOrder.toLowerCase() === 'desc' ? -1 : 1;

    const users = await User.find(query, 'name username role status created_at updated_at')
      .sort({ [sortCol]: sortDir });

    return apiSuccess({ users, count: users.length }, 'Users retrieved');
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
    if (user.role !== 'Admin') {
      return apiError('Access forbidden. Required role: Admin', 403);
    }

    const body = await req.json().catch(() => ({}));
    const { name, username, email, password, role, status } = body;

    if (!name || !username || !password) {
      return apiError('Name, username, and password are required', 400);
    }

    if (String(password).length < 6) {
      return apiError('Password must be at least 6 characters long', 400);
    }

    const assignedRole = role && VALID_ROLES.includes(role) ? role : 'Staff';
    const assignedStatus = status && VALID_STATUSES.includes(status) ? status : 'Active';
    const cleanUsername = String(username).trim().toLowerCase().replace(/^@+/, '');

    if (!/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
      return apiError('Username must be 3-30 characters with letters, numbers, underscore, or dot', 400);
    }

    await connectToDatabase();

    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return apiError(`Username "@${cleanUsername}" is already taken. Please choose another.`, 409);
    }

    let cleanEmail: string | undefined = undefined;
    if (email && String(email).trim()) {
      cleanEmail = String(email).trim().toLowerCase();
      const existingEmail = await User.findOne({ email: cleanEmail });
      if (existingEmail) {
        return apiError(`Email "${cleanEmail}" is already registered.`, 409);
      }
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const newUser = await User.create({
      name: String(name).trim(),
      username: cleanUsername,
      email: cleanEmail,
      password_hash: passwordHash,
      role: assignedRole,
      status: assignedStatus
    });

    return apiSuccess({ user: newUser }, 'User created successfully', 201);
  } catch (err: any) {
    return apiError(err.message, 500);
  }
}
