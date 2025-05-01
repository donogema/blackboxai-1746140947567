const { Invoice, Client, User } = require('../models');
const ErrorResponse = require('../utils/errorResponse');
const PDFGenerator = require('../utils/pdfGenerator');
const ExcelGenerator = require('../utils/excelGenerator');
const emailService = require('../utils/emailService');

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
exports.getInvoices = async (req, res, next) => {
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

        // Date range filter
        if (req.query.startDate && req.query.endDate) {
            filter.issueDate = {
                [Op.between]: [
                    new Date(req.query.startDate),
                    new Date(req.query.endDate)
                ]
            };
        }

        // Execute query
        const invoices = await Invoice.findAndCountAll({
            where: filter,
            limit,
            offset: startIndex,
            order: [['issueDate', 'DESC']],
            include: [
                {
                    model: Client,
                    as: 'client',
                    attributes: ['id', 'name', 'email', 'companyName']
                }
            ]
        });

        // Pagination result
        const pagination = {};

        if (startIndex > 0) {
            pagination.prev = page - 1;
        }

        if (startIndex + limit < invoices.count) {
            pagination.next = page + 1;
        }

        res.status(200).json({
            success: true,
            count: invoices.count,
            pagination,
            data: invoices.rows
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
exports.getInvoice = async (req, res, next) => {
    try {
        const invoice = await Invoice.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: [
                {
                    model: Client,
                    as: 'client',
                    attributes: ['id', 'name', 'email', 'companyName', 'address', 'city', 'state', 'zipCode', 'country']
                }
            ]
        });

        if (!invoice) {
            return next(new ErrorResponse('Invoice not found', 404));
        }

        res.status(200).json({
            success: true,
            data: invoice
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new invoice
// @route   POST /api/invoices
// @access  Private
exports.createInvoice = async (req, res, next) => {
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

        // Generate invoice number
        const lastInvoice = await Invoice.findOne({
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC']]
        });

        const invoiceNumber = lastInvoice 
            ? `INV-${String(parseInt(lastInvoice.invoiceNumber.split('-')[1]) + 1).padStart(6, '0')}`
            : 'INV-000001';

        req.body.invoiceNumber = invoiceNumber;

        const invoice = await Invoice.create(req.body);

        // Fetch complete invoice with associations
        const completeInvoice = await Invoice.findByPk(invoice.id, {
            include: [
                {
                    model: Client,
                    as: 'client',
                    attributes: ['id', 'name', 'email', 'companyName', 'address', 'city', 'state', 'zipCode', 'country']
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
            data: completeInvoice
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private
exports.updateInvoice = async (req, res, next) => {
    try {
        let invoice = await Invoice.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!invoice) {
            return next(new ErrorResponse('Invoice not found', 404));
        }

        // Prevent updating if invoice is already paid
        if (invoice.status === 'paid' && req.body.status !== 'paid') {
            return next(new ErrorResponse('Cannot modify a paid invoice', 400));
        }

        invoice = await invoice.update(req.body);

        res.status(200).json({
            success: true,
            data: invoice
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private
exports.deleteInvoice = async (req, res, next) => {
    try {
        const invoice = await Invoice.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!invoice) {
            return next(new ErrorResponse('Invoice not found', 404));
        }

        // Prevent deleting paid invoices
        if (invoice.status === 'paid') {
            return next(new ErrorResponse('Cannot delete a paid invoice', 400));
        }

        await invoice.destroy();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Generate PDF invoice
// @route   GET /api/invoices/:id/pdf
// @access  Private
exports.generatePDF = async (req, res, next) => {
    try {
        const invoice = await Invoice.findOne({
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

        if (!invoice) {
            return next(new ErrorResponse('Invoice not found', 404));
        }

        const pdfGenerator = new PDFGenerator('invoice', invoice);
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

// @desc    Generate Excel invoice
// @route   GET /api/invoices/:id/excel
// @access  Private
exports.generateExcel = async (req, res, next) => {
    try {
        const invoice = await Invoice.findOne({
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
                    attributes: ['organization']
                }
            ]
        });

        if (!invoice) {
            return next(new ErrorResponse('Invoice not found', 404));
        }

        const excelGenerator = new ExcelGenerator('invoice', invoice);
        const fileName = await excelGenerator.generate();

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

// @desc    Send invoice email
// @route   POST /api/invoices/:id/send
// @access  Private
exports.sendInvoice = async (req, res, next) => {
    try {
        const invoice = await Invoice.findOne({
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

        if (!invoice) {
            return next(new ErrorResponse('Invoice not found', 404));
        }

        // Generate PDF
        const pdfGenerator = new PDFGenerator('invoice', invoice);
        const fileName = await pdfGenerator.generate();

        // Send email
        await emailService.sendInvoice(invoice, invoice.client, fileName);

        // Update invoice status and email sent date
        await invoice.update({
            status: 'sent',
            emailSent: true,
            lastEmailSentDate: new Date()
        });

        res.status(200).json({
            success: true,
            data: invoice
        });
    } catch (error) {
        next(error);
    }
};
