const { Receipt, Client, Invoice, User } = require('../models');
const ErrorResponse = require('../utils/errorResponse');
const PDFGenerator = require('../utils/pdfGenerator');
const ExcelGenerator = require('../utils/excelGenerator');
const emailService = require('../utils/emailService');

// @desc    Get all receipts
// @route   GET /api/receipts
// @access  Private
exports.getReceipts = async (req, res, next) => {
    try {
        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;

        // Filter options
        const filter = { userId: req.user.id };
        
        if (req.query.status) {
            filter.status = req.query.status;
        }
        
        if (req.query.clientId) {
            filter.clientId = req.query.clientId;
        }

        if (req.query.invoiceId) {
            filter.invoiceId = req.query.invoiceId;
        }

        // Date range filter
        if (req.query.startDate && req.query.endDate) {
            filter.date = {
                [Op.between]: [
                    new Date(req.query.startDate),
                    new Date(req.query.endDate)
                ]
            };
        }

        // Execute query
        const receipts = await Receipt.findAndCountAll({
            where: filter,
            limit,
            offset: startIndex,
            order: [['date', 'DESC']],
            include: [
                {
                    model: Client,
                    as: 'client',
                    attributes: ['id', 'name', 'email', 'companyName']
                },
                {
                    model: Invoice,
                    as: 'invoice',
                    attributes: ['id', 'invoiceNumber']
                }
            ]
        });

        // Pagination result
        const pagination = {};

        if (startIndex > 0) {
            pagination.prev = page - 1;
        }

        if (startIndex + limit < receipts.count) {
            pagination.next = page + 1;
        }

        res.status(200).json({
            success: true,
            count: receipts.count,
            pagination,
            data: receipts.rows
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single receipt
// @route   GET /api/receipts/:id
// @access  Private
exports.getReceipt = async (req, res, next) => {
    try {
        const receipt = await Receipt.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: [
                {
                    model: Client,
                    as: 'client',
                    attributes: ['id', 'name', 'email', 'companyName', 'address', 'city', 'state', 'zipCode', 'country']
                },
                {
                    model: Invoice,
                    as: 'invoice',
                    attributes: ['id', 'invoiceNumber', 'total']
                }
            ]
        });

        if (!receipt) {
            return next(new ErrorResponse('Receipt not found', 404));
        }

        res.status(200).json({
            success: true,
            data: receipt
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new receipt
// @route   POST /api/receipts
// @access  Private
exports.createReceipt = async (req, res, next) => {
    try {
        // Add user to req.body
        req.body.userId = req.user.id;

        // Verify client exists and belongs to user
        const client = await Client.findOne({
            where: {
                id: req.body.clientId,
                userId: req.user.id
            }
        });

        if (!client) {
            return next(new ErrorResponse('Client not found', 404));
        }

        // If invoice ID is provided, verify it exists and belongs to the client
        if (req.body.invoiceId) {
            const invoice = await Invoice.findOne({
                where: {
                    id: req.body.invoiceId,
                    clientId: req.body.clientId,
                    userId: req.user.id
                }
            });

            if (!invoice) {
                return next(new ErrorResponse('Invoice not found', 404));
            }
        }

        // Generate receipt number
        const lastReceipt = await Receipt.findOne({
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC']]
        });

        const receiptNumber = lastReceipt 
            ? `RCP-${String(parseInt(lastReceipt.receiptNumber.split('-')[1]) + 1).padStart(6, '0')}`
            : 'RCP-000001';

        req.body.receiptNumber = receiptNumber;

        const receipt = await Receipt.create(req.body);

        // If this receipt is linked to an invoice, update the invoice status if fully paid
        if (receipt.invoiceId) {
            const invoice = await Invoice.findByPk(receipt.invoiceId);
            const totalPaid = await Receipt.sum('amount', {
                where: { invoiceId: receipt.invoiceId }
            });

            if (totalPaid >= invoice.total) {
                await invoice.update({ status: 'paid', paidDate: new Date() });
            }
        }

        // Fetch complete receipt with associations
        const completeReceipt = await Receipt.findByPk(receipt.id, {
            include: [
                {
                    model: Client,
                    as: 'client',
                    attributes: ['id', 'name', 'email', 'companyName', 'address', 'city', 'state', 'zipCode', 'country']
                },
                {
                    model: Invoice,
                    as: 'invoice',
                    attributes: ['id', 'invoiceNumber', 'total']
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'organization', 'organizationLogo']
                }
            ]
        });

        res.status(201).json({
            success: true,
            data: completeReceipt
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update receipt
// @route   PUT /api/receipts/:id
// @access  Private
exports.updateReceipt = async (req, res, next) => {
    try {
        let receipt = await Receipt.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!receipt) {
            return next(new ErrorResponse('Receipt not found', 404));
        }

        // Prevent updating if receipt is finalized
        if (receipt.status === 'final') {
            return next(new ErrorResponse('Cannot modify a finalized receipt', 400));
        }

        receipt = await receipt.update(req.body);

        res.status(200).json({
            success: true,
            data: receipt
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete receipt
// @route   DELETE /api/receipts/:id
// @access  Private
exports.deleteReceipt = async (req, res, next) => {
    try {
        const receipt = await Receipt.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!receipt) {
            return next(new ErrorResponse('Receipt not found', 404));
        }

        // Prevent deleting finalized receipts
        if (receipt.status === 'final') {
            return next(new ErrorResponse('Cannot delete a finalized receipt', 400));
        }

        await receipt.destroy();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Generate PDF receipt
// @route   GET /api/receipts/:id/pdf
// @access  Private
exports.generatePDF = async (req, res, next) => {
    try {
        const receipt = await Receipt.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: [
                {
                    model: Client,
                    as: 'client'
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['organization', 'organizationLogo']
                }
            ]
        });

        if (!receipt) {
            return next(new ErrorResponse('Receipt not found', 404));
        }

        const pdfGenerator = new PDFGenerator('receipt', receipt);
        const fileName = await pdfGenerator.generate();

        res.status(200).json({
            success: true,
            data: {
                fileName,
                url: `${process.env.BASE_URL}/uploads/${fileName}`
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Send receipt email
// @route   POST /api/receipts/:id/send
// @access  Private
exports.sendReceipt = async (req, res, next) => {
    try {
        const receipt = await Receipt.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: [
                {
                    model: Client,
                    as: 'client'
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['organization', 'organizationLogo']
                }
            ]
        });

        if (!receipt) {
            return next(new ErrorResponse('Receipt not found', 404));
        }

        // Generate PDF
        const pdfGenerator = new PDFGenerator('receipt', receipt);
        const fileName = await pdfGenerator.generate();

        // Send email
        await emailService.sendReceipt(receipt, receipt.client, fileName);

        // Update receipt email sent status
        await receipt.update({
            emailSent: true,
            lastEmailSentDate: new Date()
        });

        res.status(200).json({
            success: true,
            data: receipt
        });
    } catch (error) {
        next(error);
    }
};
