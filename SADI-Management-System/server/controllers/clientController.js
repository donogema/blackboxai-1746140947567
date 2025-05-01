const { Client, Invoice, Receipt } = require('../models');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private
exports.getClients = async (req, res, next) => {
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

        // Search functionality
        if (req.query.search) {
            filter[Op.or] = [
                { name: { [Op.iLike]: `%${req.query.search}%` } },
                { email: { [Op.iLike]: `%${req.query.search}%` } },
                { companyName: { [Op.iLike]: `%${req.query.search}%` } }
            ];
        }

        // Execute query with pagination
        const clients = await Client.findAndCountAll({
            where: filter,
            limit,
            offset: startIndex,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: Invoice,
                    as: 'invoices',
                    attributes: ['id', 'total', 'status']
                },
                {
                    model: Receipt,
                    as: 'receipts',
                    attributes: ['id', 'amount']
                }
            ]
        });

        // Pagination result
        const pagination = {};

        if (startIndex > 0) {
            pagination.prev = page - 1;
        }

        if (startIndex + limit < clients.count) {
            pagination.next = page + 1;
        }

        res.status(200).json({
            success: true,
            count: clients.count,
            pagination,
            data: clients.rows
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single client
// @route   GET /api/clients/:id
// @access  Private
exports.getClient = async (req, res, next) => {
    try {
        const client = await Client.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: [
                {
                    model: Invoice,
                    as: 'invoices',
                    attributes: ['id', 'invoiceNumber', 'total', 'status', 'dueDate', 'createdAt']
                },
                {
                    model: Receipt,
                    as: 'receipts',
                    attributes: ['id', 'receiptNumber', 'amount', 'date']
                }
            ]
        });

        if (!client) {
            return next(new ErrorResponse('Client not found', 404));
        }

        // Calculate client statistics
        const statistics = {
            totalInvoices: client.invoices.length,
            totalReceipts: client.receipts.length,
            totalBilled: client.invoices.reduce((sum, invoice) => sum + parseFloat(invoice.total), 0),
            totalPaid: client.receipts.reduce((sum, receipt) => sum + parseFloat(receipt.amount), 0),
            outstandingBalance: 0
        };

        statistics.outstandingBalance = statistics.totalBilled - statistics.totalPaid;

        res.status(200).json({
            success: true,
            data: {
                ...client.toJSON(),
                statistics
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new client
// @route   POST /api/clients
// @access  Private
exports.createClient = async (req, res, next) => {
    try {
        // Add user to req.body
        req.body.userId = req.user.id;

        // Check for existing client with same email for this user
        const existingClient = await Client.findOne({
            where: {
                email: req.body.email,
                userId: req.user.id
            }
        });

        if (existingClient) {
            return next(new ErrorResponse('Client with this email already exists', 400));
        }

        const client = await Client.create(req.body);

        res.status(201).json({
            success: true,
            data: client
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Private
exports.updateClient = async (req, res, next) => {
    try {
        let client = await Client.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!client) {
            return next(new ErrorResponse('Client not found', 404));
        }

        // Check if updating email and if it already exists
        if (req.body.email && req.body.email !== client.email) {
            const existingClient = await Client.findOne({
                where: {
                    email: req.body.email,
                    userId: req.user.id,
                    id: { [Op.ne]: req.params.id }
                }
            });

            if (existingClient) {
                return next(new ErrorResponse('Client with this email already exists', 400));
            }
        }

        client = await client.update(req.body);

        res.status(200).json({
            success: true,
            data: client
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Private
exports.deleteClient = async (req, res, next) => {
    try {
        const client = await Client.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: [
                {
                    model: Invoice,
                    as: 'invoices'
                },
                {
                    model: Receipt,
                    as: 'receipts'
                }
            ]
        });

        if (!client) {
            return next(new ErrorResponse('Client not found', 404));
        }

        // Check if client has any invoices or receipts
        if (client.invoices.length > 0 || client.receipts.length > 0) {
            return next(
                new ErrorResponse(
                    'Cannot delete client with associated invoices or receipts',
                    400
                )
            );
        }

        await client.destroy();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get client statistics
// @route   GET /api/clients/:id/statistics
// @access  Private
exports.getClientStatistics = async (req, res, next) => {
    try {
        const client = await Client.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: [
                {
                    model: Invoice,
                    as: 'invoices',
                    attributes: ['id', 'total', 'status', 'dueDate', 'createdAt']
                },
                {
                    model: Receipt,
                    as: 'receipts',
                    attributes: ['id', 'amount', 'date']
                }
            ]
        });

        if (!client) {
            return next(new ErrorResponse('Client not found', 404));
        }

        // Calculate statistics
        const statistics = {
            totalInvoices: client.invoices.length,
            totalReceipts: client.receipts.length,
            totalBilled: client.invoices.reduce((sum, invoice) => sum + parseFloat(invoice.total), 0),
            totalPaid: client.receipts.reduce((sum, receipt) => sum + parseFloat(receipt.amount), 0),
            outstandingBalance: 0,
            paymentHistory: [],
            invoiceHistory: []
        };

        statistics.outstandingBalance = statistics.totalBilled - statistics.totalPaid;

        // Get payment history
        statistics.paymentHistory = client.receipts.map(receipt => ({
            date: receipt.date,
            amount: receipt.amount,
            type: 'payment'
        }));

        // Get invoice history
        statistics.invoiceHistory = client.invoices.map(invoice => ({
            date: invoice.createdAt,
            amount: invoice.total,
            status: invoice.status,
            type: 'invoice'
        }));

        // Combine and sort histories
        statistics.history = [...statistics.paymentHistory, ...statistics.invoiceHistory]
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({
            success: true,
            data: statistics
        });
    } catch (error) {
        next(error);
    }
};
