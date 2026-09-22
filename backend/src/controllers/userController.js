const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { success, error } = require('../utils/response');
const { broadcast } = require('../services/socketService');

// Allowed roles in the scalable user system
const VALID_ROLES = ['Admin', 'Manager', 'Staff'];
const VALID_STATUSES = ['Active', 'Disabled'];

// GET /api/users - List all users (safe fields only)
async function getAll(req, res, next) {
  try {
    const { search, role, status, sortField, sortOrder } = req.query;

    let query = `
      SELECT id, name, username, role, status, created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR username ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (role && role !== 'All') {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (status && status !== 'All') {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const validSortMap = {
      id: 'id',
      name: 'name',
      username: 'username',
      role: 'role',
      status: 'status',
      created_at: 'created_at'
    };

    const sortCol = validSortMap[sortField] || 'id';
    const order = (sortOrder && sortOrder.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';

    query += ` ORDER BY ${sortCol} ${order}`;

    const result = await db.query(query, params);
    return success(res, { users: result.rows, count: result.rowCount }, 'Users retrieved');
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id - Get single user
async function getById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.query(
      'SELECT id, name, username, role, status, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return error(res, 'User not found', 404);
    }

    return success(res, { user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/users - Create new company user (Admin only)
async function create(req, res, next) {
  try {
    const { name, username, password, role, status } = req.body;

    if (!name || !username || !password) {
      return error(res, 'Name, username, and password are required', 400);
    }

    if (password.length < 6) {
      return error(res, 'Password must be at least 6 characters long', 400);
    }

    const assignedRole = role && VALID_ROLES.includes(role) ? role : 'Staff';
    const assignedStatus = status && VALID_STATUSES.includes(status) ? status : 'Active';
    const cleanUsername = username.trim().toLowerCase().replace(/^@+/, '');

    // Validate username format
    if (!/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
      return error(res, 'Username must be 3-30 characters with letters, numbers, underscore, or dot', 400);
    }

    // Check unique username
    const existing = await db.query('SELECT id FROM users WHERE username = $1', [cleanUsername]);
    if (existing.rows.length > 0) {
      return error(res, `Username "@${cleanUsername}" is already taken. Please choose another.`, 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (name, username, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, username, role, status, created_at, updated_at`,
      [name.trim(), cleanUsername, passwordHash, assignedRole, assignedStatus]
    );

    const newUser = result.rows[0];

    broadcast('user:created', {
      user: newUser,
      author: req.user ? req.user.name : 'Admin'
    });

    return success(res, { user: newUser }, 'User created successfully', 201);
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/:id - Edit user profile/role/status/username (Admin only)
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, username, role, status } = req.body;

    const existingRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return error(res, 'User not found', 404);
    }

    const current = existingRes.rows[0];

    // Prevent Admin from disabling or demoting themselves
    if (req.user && req.user.id === id) {
      if (status && status === 'Disabled') {
        return error(res, 'You cannot disable your own administrator account', 400);
      }
      if (role && role !== 'Admin') {
        return error(res, 'You cannot remove your own administrator privileges', 400);
      }
    }

    // Handle username update if provided and changed
    let updatedUsername = current.username;
    if (username && username.trim() !== '') {
      let cleanUsername = username.trim().toLowerCase().replace(/^@+/, '');

      if (cleanUsername !== current.username) {
        // Prevent changing primary root admin username
        if ((current.username === 'fromex' || current.username === 'admin') && cleanUsername !== current.username) {
          return error(res, 'The primary system admin username cannot be changed', 400);
        }

        // Validate username format (alphanumeric, underscores, hyphens, 3-30 chars)
        if (!/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
          return error(res, 'Username must be 3-30 characters with alphanumeric, underscore or dash characters', 400);
        }

        // Check uniqueness excluding this user
        const duplicateCheck = await db.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [cleanUsername, id]
        );
        if (duplicateCheck.rows.length > 0) {
          return error(res, `Username "@${cleanUsername}" is already taken by another account`, 409);
        }

        updatedUsername = cleanUsername;
      }
    }

    const updatedName = name ? name.trim() : current.name;
    const updatedRole = (role && VALID_ROLES.includes(role)) ? role : current.role;
    const updatedStatus = (status && VALID_STATUSES.includes(status)) ? status : current.status;

    const result = await db.query(
      `UPDATE users
       SET name = $1, username = $2, role = $3, status = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, username, role, status, created_at, updated_at`,
      [updatedName, updatedUsername, updatedRole, updatedStatus, id]
    );

    const updatedUser = result.rows[0];

    broadcast('user:updated', {
      user: updatedUser,
      author: req.user ? req.user.name : 'Admin'
    });

    return success(res, { user: updatedUser }, `User "${updatedUser.name}" (@${updatedUser.username}) updated successfully`);
  } catch (err) {
    next(err);
  }
}

// POST /api/users/:id/reset-password - Reset user password (Admin only)
async function resetPassword(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return error(res, 'New password must be at least 6 characters long', 400);
    }

    const existingRes = await db.query('SELECT id, name, username FROM users WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return error(res, 'User not found', 404);
    }

    const user = existingRes.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, id]
    );

    broadcast('user:password_reset', {
      userId: id,
      username: user.username,
      author: req.user ? req.user.name : 'Admin'
    });

    return success(res, { id, username: user.username }, `Password for "${user.name}" reset successfully`);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/:id/status - Toggle Enable/Disable user (Admin only)
async function toggleStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    const existingRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return error(res, 'User not found', 404);
    }

    const current = existingRes.rows[0];

    if (req.user && req.user.id === id && status === 'Disabled') {
      return error(res, 'You cannot disable your own administrator account', 400);
    }

    const newStatus = status ? status : (current.status === 'Active' ? 'Disabled' : 'Active');

    const result = await db.query(
      `UPDATE users
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, username, role, status, updated_at`,
      [newStatus, id]
    );

    const updatedUser = result.rows[0];

    broadcast('user:updated', {
      user: updatedUser,
      author: req.user ? req.user.name : 'Admin'
    });

    return success(
      res,
      { user: updatedUser },
      `User ${updatedUser.name} is now ${newStatus}`
    );
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/:id - Delete company user permanently (Admin only)
async function deleteUser(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    const existingRes = await db.query('SELECT id, name, username, role FROM users WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return error(res, 'User not found', 404);
    }

    const targetUser = existingRes.rows[0];

    // Prevent deleting the primary admin or currently logged in user
    if (req.user && req.user.id === id) {
      return error(res, 'You cannot delete your own active administrator account', 400);
    }

    if (targetUser.username === 'fromex' || targetUser.username === 'admin') {
      return error(res, 'The primary system admin account cannot be deleted', 400);
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);

    broadcast('user:deleted', {
      userId: id,
      username: targetUser.username,
      author: req.user ? req.user.name : 'Admin'
    });

    return success(res, { id, user: targetUser }, `User "${targetUser.name}" (@${targetUser.username}) deleted successfully`);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  resetPassword,
  toggleStatus,
  deleteUser
};

