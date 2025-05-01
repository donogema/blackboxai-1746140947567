const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

const {
    getReceipts,
    getReceipt,
    createReceipt,
    updateReceipt,
    deleteReceipt,
    generatePDF,
    sendReceipt
} = require('../controllers/receiptController');

// All routes require authentication
router.use(protect);

// Base routes
router
    .route('/')
    .get(getReceipts)
    .post(createReceipt);

// Individual receipt routes
router
    .route('/:id')
    .get(getReceipt)
    .put(updateReceipt)
    .delete(deleteReceipt);

// Document generation route
router.get('/:id/pdf', generatePDF);

// Email route
router.post('/:id/send', sendReceipt);

module.exports = router;
