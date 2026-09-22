const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salaryController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/', salaryController.getAll);
router.get('/:id', salaryController.getById);
router.post('/', authMiddleware, salaryController.create);
router.put('/:id', authMiddleware, salaryController.update);
router.delete('/:id', authMiddleware, salaryController.remove);

module.exports = router;
