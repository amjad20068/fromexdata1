const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authMiddleware, requireRole } = require('../middleware/authMiddleware');

// Settings routes require authentication
router.use(authMiddleware);

// GET /api/settings/stats - Retrieve database operational statistics
router.get('/stats', settingsController.getStats);

// GET /api/settings/backups - List previous snapshots
router.get('/backups', requireRole('Admin'), settingsController.getBackups);

// POST /api/settings/clear-data - One-click clear data (Admin only, creates backup snapshot)
router.post('/clear-data', requireRole('Admin'), settingsController.clearData);

// POST /api/settings/undo-clear - Instant undo / restore cleared data (Admin only)
router.post('/undo-clear', requireRole('Admin'), settingsController.undoClear);

module.exports = router;
