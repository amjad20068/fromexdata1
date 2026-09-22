const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// All user management routes require valid JWT authentication and Admin role
router.use(authMiddleware);
router.use(requireRole('Admin'));

// GET /api/users - List users with optional search and filter
router.get('/', userController.getAll);

// GET /api/users/:id - Get specific user details
router.get('/:id', userController.getById);

// POST /api/users - Create new company user
router.post('/', userController.create);

// PUT /api/users/:id - Update user details (name, role, status)
router.put('/:id', userController.update);

// POST /api/users/:id/reset-password - Reset user password
router.post('/:id/reset-password', userController.resetPassword);

// PATCH /api/users/:id/status - Toggle or set user active/disabled status
router.patch('/:id/status', userController.toggleStatus);

// DELETE /api/users/:id - Delete user account (Admin only)
router.delete('/:id', userController.deleteUser);

module.exports = router;
