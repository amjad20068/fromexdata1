const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/', employeeController.getAll);
router.get('/:id', employeeController.getById);
router.post('/', authMiddleware, employeeController.create);
router.put('/:id', authMiddleware, employeeController.update);
router.delete('/:id', authMiddleware, employeeController.remove);

module.exports = router;
