const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { protect, authorize } = require('../middleware/auth');

const {
    getExpenses,
    getExpense,
    createExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
    generateReport,
    getStatistics
} = require('../controllers/expenseController');

// Configure multer for expense receipt uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadPath = 'uploads/receipts';
        const fs = require('fs');
        const fullPath = path.join(__dirname, '..', uploadPath);
        fs.mkdirSync(fullPath, { recursive: true });
        cb(null, fullPath);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        cb(null, `receipt-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Please upload only jpeg, png, or pdf files'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// All routes require authentication
router.use(protect);

// Base routes
router
    .route('/')
    .get(getExpenses)
    .post(upload.single('receiptImage'), createExpense);

// Individual expense routes
router
    .route('/:id')
    .get(getExpense)
    .put(upload.single('receiptImage'), updateExpense)
    .delete(deleteExpense);

// Approval route (super_user only)
router.put(
    '/:id/approve',
    authorize('super_user'),
    approveExpense
);

// Report routes
router.get('/report', generateReport);
router.get('/statistics', getStatistics);

module.exports = router;
