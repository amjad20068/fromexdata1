const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/', attendanceController.getAll);
router.get('/summary', attendanceController.getSummary);
router.get('/:id', attendanceController.getById);
router.post('/', authMiddleware, attendanceController.create);
router.put('/:id', authMiddleware, attendanceController.update);
router.delete('/:id', authMiddleware, attendanceController.remove);

module.exports = router;
