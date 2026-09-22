const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');
const salaryController = require('../controllers/salaryController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Accounting Summary
router.get('/summary', accountingController.getSummary);

// Transactions (supports both /api/accounting and /api/accounting/transactions)
router.get('/', accountingController.getAll);
router.get('/transactions', accountingController.getAll);
router.get('/transactions/:id', accountingController.getById);
router.post('/transactions', authMiddleware, accountingController.create);
router.put('/transactions/:id', authMiddleware, accountingController.update);
router.delete('/transactions/:id', authMiddleware, accountingController.remove);

// Salaries alias under /api/accounting/salaries for seamless frontend compatibility
router.get('/salaries', salaryController.getAll);
router.get('/salaries/:id', salaryController.getById);
router.post('/salaries', authMiddleware, salaryController.create);
router.put('/salaries/:id', authMiddleware, salaryController.update);
router.delete('/salaries/:id', authMiddleware, salaryController.remove);

// Direct CRUD on /api/accounting/:id for transactions
router.get('/:id', accountingController.getById);
router.post('/', authMiddleware, accountingController.create);
router.put('/:id', authMiddleware, accountingController.update);
router.delete('/:id', authMiddleware, accountingController.remove);

module.exports = router;
