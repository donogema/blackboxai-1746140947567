const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

const {
    getInvoices,
    getInvoice,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    generatePDF,
    generateExcel,
    sendInvoice
} = require('../controllers/invoiceController');

// All routes require authentication
router.use(protect);

// Base routes
router
    .route('/')
    .get(getInvoices)
    .post(createInvoice);

// Individual invoice routes
router
    .route('/:id')
    .get(getInvoice)
    .put(updateInvoice)
    .delete(deleteInvoice);

// Document generation routes
router.get('/:id/pdf', generatePDF);
router.get('/:id/excel', generateExcel);

// Email route
router.post('/:id/send', sendInvoice);

module.exports = router;
