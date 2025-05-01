const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

const {
    getIncomes,
    getIncome,
    createIncome,
    updateIncome,
    deleteIncome,
    generateReport,
    getStatistics
} = require('../controllers/incomeController');

// All routes require authentication
router.use(protect);

// Base routes
router
    .route('/')
    .get(getIncomes)
    .post(createIncome);

// Individual income routes
router
    .route('/:id')
    .get(getIncome)
    .put(updateIncome)
    .delete(deleteIncome);

// Report routes
router.get('/report', generateReport);
router.get('/statistics', getStatistics);

module.exports = router;
