const { verifyToken } = require('../utils/jwt');
const { error } = require('../utils/response');
const db = require('../config/db');

async function authMiddleware(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return error(res, 'Authentication token required. Please log in.', 401);
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return error(res, 'Invalid or expired session token. Please log in again.', 401);
  }

  try {
    const result = await db.query(
      'SELECT id, name, username, role, status, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return error(res, 'User associated with this token no longer exists.', 401);
    }

    const user = result.rows[0];
    if (user.status === 'Disabled') {
      return error(res, 'User account is disabled. Please contact an administrator.', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return error(res, 'Authentication error', 500);
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Unauthorized', 401);
    }
    if (!allowedRoles.includes(req.user.role)) {
      return error(res, `Access forbidden. Required role: ${allowedRoles.join(' or ')}`, 403);
    }
    next();
  };
}

module.exports = {
  authMiddleware,
  requireRole
};
