import jwt from 'jsonwebtoken';
import connectToDatabase from './mongodb';
import User, { IUser } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fromex_jwt_secret_development_key_2026_secure';
const JWT_EXPIRES_IN = '7d';

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (err) {
    return null;
  }
}

export async function getAuthenticatedUser(req: Request): Promise<{
  user: IUser | null;
  errorResponse?: { message: string; status: number };
}> {
  let token: string | null = null;

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers.get('x-auth-token')) {
    token = req.headers.get('x-auth-token');
  } else if (req.headers.get('x-user-token')) {
    token = req.headers.get('x-user-token');
  }

  if (!token) {
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)fromex_token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
  }

  if (!token) {
    const url = new URL(req.url);
    token = url.searchParams.get('token');
  }

  if (!token) {
    return {
      user: null,
      errorResponse: { message: 'Authentication token required. Please log in.', status: 401 }
    };
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return {
      user: null,
      errorResponse: { message: 'Invalid or expired session token. Please log in again.', status: 401 }
    };
  }

  await connectToDatabase();
  const user = await User.findById(decoded.userId);

  if (!user) {
    return {
      user: null,
      errorResponse: { message: 'User associated with this token no longer exists.', status: 401 }
    };
  }

  if (user.status === 'Disabled') {
    return {
      user: null,
      errorResponse: { message: 'User account is disabled. Please contact an administrator.', status: 403 }
    };
  }

  return { user };
}
