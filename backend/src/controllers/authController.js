const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');

async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return error(res, 'Username and password are required', 400);
    }

    const result = await db.query(
      'SELECT id, name, username, password_hash, role, status FROM users WHERE username = $1',
      [username.trim()]
    );

    if (result.rows.length === 0) {
      return error(res, 'Invalid username or password', 401);
    }

    const user = result.rows[0];

    // Disallow disabled accounts from authenticating
    if (user.status === 'Disabled') {
      return error(res, 'Account is disabled. Please contact an administrator.', 403);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return error(res, 'Invalid username or password', 401);
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role
    });

    // Strip password_hash from response
    const safeUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      status: user.status
    };

    return success(res, { user: safeUser, token }, `Welcome back, ${user.name}`);
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    return success(res, { user: req.user }, 'User profile retrieved');
  } catch (err) {
    next(err);
  }
}

async function getUsers(req, res, next) {
  try {
    const result = await db.query(
      'SELECT id, name, username, role, status, created_at FROM users ORDER BY id ASC'
    );
    return success(res, { users: result.rows }, 'Authorized users retrieved');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  getMe,
  getUsers
};
