import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { generateToken } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawUser = body.username || body.usernameOrEmail;
    const password = body.password;

    if (!rawUser || !password) {
      return apiError('Username and password are required', 400);
    }

    await connectToDatabase();
    const rawInput = String(rawUser).trim().toLowerCase();
    const cleanUsername = rawInput.replace(/^@+/, '');
    const cleanUsernameNoDomain = rawInput.includes('@') ? rawInput.split('@')[0].replace(/^@+/, '') : cleanUsername;

    const user = await User.findOne({
      $or: [
        { username: cleanUsername },
        { username: cleanUsernameNoDomain },
        { email: rawInput }
      ]
    });
    if (!user) {
      return apiError('Invalid username or password', 401);
    }

    if (user.status === 'Disabled') {
      return apiError('Account is disabled. Please contact an administrator.', 403);
    }

    const isPasswordValid = await bcrypt.compare(String(password), user.password_hash);
    if (!isPasswordValid) {
      return apiError('Invalid username or password', 401);
    }

    const token = generateToken({
      userId: user._id.toString(),
      username: user.username,
      role: user.role
    });

    const safeUser = {
      id: user._id.toString(),
      name: user.name,
      username: user.username,
      role: user.role,
      status: user.status
    };

    const res = apiSuccess({ user: safeUser, token }, `Welcome back, ${user.name}`);
    res.cookies.set({
      name: 'fromex_token',
      value: token,
      path: '/',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60
    });
    return res;
  } catch (err: any) {
    console.error('Login route error:', err);
    return apiError(err.message || 'Internal server error', 500);
  }
}
