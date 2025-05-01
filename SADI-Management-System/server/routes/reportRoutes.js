const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

const {
    getFinancialReport,
    getProfitLossReport,
    getReceivablesReport,
    getDashboardStats
} = require('../controllers/reportController');

// All routes require authentication
router.use(protect);

// Dashboard statistics
router.get('/dashboard', getDashboardStats);

// Financial reports
router.get('/financial', getFinancialReport);
router.get('/profit-loss', getProfitLossReport);
router.get('/receivables', getReceivablesReport);

// Super user only reports (if needed)
// router.get('/advanced-analytics', authorize('super_user'), getAdvancedAnalytics);

module.exports = router;
