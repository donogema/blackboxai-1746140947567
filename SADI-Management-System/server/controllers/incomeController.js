const { Income, Invoice, Receipt, User } = require('../models');
const ErrorResponse = require('../utils/errorResponse');
const PDFGenerator = require('../utils/pdfGenerator');
const ExcelGenerator = require('../utils/excelGenerator');

// @desc    Get all income entries
// @route   GET /api/income
// @access  Private
exports.getIncomes = async (req, res, next) => {
    try {
        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;

        // Filter options
        const filter = { userId: req.user.id };
        
        if (req.query.category) {
            filter.category = req.query.category;
        }

        if (req.query.source) {
            filter.source = req.query.source;
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
        const incomes = await Income.findAndCountAll({
            where: filter,
            limit,
            offset: startIndex,
            order: [['date', 'DESC']],
            include: [
                {
                    model: Invoice,
                    as: 'invoice',
                    attributes: ['id', 'invoiceNumber']
                },
                {
                    model: Receipt,
                    as: 'receipt',
                    attributes: ['id', 'receiptNumber']
                }
            ]
        });

        // Pagination result
        const pagination = {};

        if (startIndex > 0) {
            pagination.prev = page - 1;
        }

        if (startIndex + limit < incomes.count) {
            pagination.next = page + 1;
        }

        // Calculate totals
        const totals = {
            total: incomes.rows.reduce((sum, income) => sum + parseFloat(income.amount), 0),
            byCategory: {},
            bySource: {}
        };

        // Calculate category and source totals
        incomes.rows.forEach(income => {
            totals.byCategory[income.category] = (totals.byCategory[income.category] || 0) + parseFloat(income.amount);
            totals.bySource[income.source] = (totals.bySource[income.source] || 0) + parseFloat(income.amount);
        });

        res.status(200).json({
            success: true,
            count: incomes.count,
            pagination,
            totals,
            data: incomes.rows
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single income entry
// @route   GET /api/income/:id
// @access  Private
exports.getIncome = async (req, res, next) => {
    try {
        const income = await Income.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: [
                {
                    model: Invoice,
                    as: 'invoice',
                    attributes: ['id', 'invoiceNumber', 'total']
                },
                {
                    model: Receipt,
                    as: 'receipt',
                    attributes: ['id', 'receiptNumber', 'amount']
                }
            ]
        });

        if (!income) {
            return next(new ErrorResponse('Income entry not found', 404));
        }

        res.status(200).json({
            success: true,
            data: income
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new income entry
// @route   POST /api/income
// @access  Private
exports.createIncome = async (req, res, next) => {
    try {
        // Add user to req.body
        req.body.userId = req.user.id;

        // Verify invoice if provided
        if (req.body.invoiceId) {
            const invoice = await Invoice.findOne({
                where: {
                    id: req.body.invoiceId,
                    userId: req.user.id
                }
            });

            if (!invoice) {
                return next(new ErrorResponse('Invoice not found', 404));
            }
        }

        // Verify receipt if provided
        if (req.body.receiptId) {
            const receipt = await Receipt.findOne({
                where: {
                    id: req.body.receiptId,
                    userId: req.user.id
                }
            });

            if (!receipt) {
                return next(new ErrorResponse('Receipt not found', 404));
            }
        }

        const income = await Income.create(req.body);

        // If it's a recurring income, calculate next recurring date
        if (income.isRecurring) {
            income.calculateNextRecurringDate();
            await income.save();
        }

        res.status(201).json({
            success: true,
            data: income
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update income entry
// @route   PUT /api/income/:id
// @access  Private
exports.updateIncome = async (req, res, next) => {
    try {
        let income = await Income.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!income) {
            return next(new ErrorResponse('Income entry not found', 404));
        }

        // Verify invoice if being updated
        if (req.body.invoiceId) {
            const invoice = await Invoice.findOne({
                where: {
                    id: req.body.invoiceId,
                    userId: req.user.id
                }
            });

            if (!invoice) {
                return next(new ErrorResponse('Invoice not found', 404));
            }
        }

        // Verify receipt if being updated
        if (req.body.receiptId) {
            const receipt = await Receipt.findOne({
                where: {
                    id: req.body.receiptId,
                    userId: req.user.id
                }
            });

            if (!receipt) {
                return next(new ErrorResponse('Receipt not found', 404));
            }
        }

        income = await income.update(req.body);

        // Recalculate next recurring date if necessary
        if (income.isRecurring && (req.body.recurringFrequency || req.body.date)) {
            income.calculateNextRecurringDate();
            await income.save();
        }

        res.status(200).json({
            success: true,
            data: income
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete income entry
// @route   DELETE /api/income/:id
// @access  Private
exports.deleteIncome = async (req, res, next) => {
    try {
        const income = await Income.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!income) {
            return next(new ErrorResponse('Income entry not found', 404));
        }

        await income.destroy();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Generate income report
// @route   GET /api/income/report
// @access  Private
exports.generateReport = async (req, res, next) => {
    try {
        const { startDate, endDate, format = 'pdf' } = req.query;

        // Validate date range
        if (!startDate || !endDate) {
            return next(new ErrorResponse('Please provide start and end dates', 400));
        }

        // Get income entries for the period
        const incomes = await Income.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                }
            },
            order: [['date', 'ASC']],
            include: [
                {
                    model: Invoice,
                    as: 'invoice',
                    attributes: ['invoiceNumber']
                },
                {
                    model: Receipt,
                    as: 'receipt',
                    attributes: ['receiptNumber']
                }
            ]
        });

        // Calculate totals
        const totals = {
            total: incomes.reduce((sum, income) => sum + parseFloat(income.amount), 0),
            byCategory: {},
            bySource: {}
        };

        // Calculate category and source totals
        incomes.forEach(income => {
            totals.byCategory[income.category] = (totals.byCategory[income.category] || 0) + parseFloat(income.amount);
            totals.bySource[income.source] = (totals.bySource[income.source] || 0) + parseFloat(income.amount);
        });

        const reportData = {
            startDate,
            endDate,
            incomes,
            totals,
            user: req.user
        };

        let fileName;
        if (format === 'excel') {
            const excelGenerator = new ExcelGenerator('income_report', reportData);
            fileName = await excelGenerator.generate();
        } else {
            const pdfGenerator = new PDFGenerator('income_report', reportData);
            fileName = await pdfGenerator.generate();
        }

        res.status(200).json({
            success: true,
            data: {
                fileName,
                url: `${process.env.BASE_URL}/uploads/${fileName}`,
                totals
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get income statistics
// @route   GET /api/income/statistics
// @access  Private
exports.getStatistics = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const incomes = await Income.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                }
            }
        });

        // Calculate statistics
        const statistics = {
            total: incomes.reduce((sum, income) => sum + parseFloat(income.amount), 0),
            count: incomes.length,
            byCategory: {},
            byMonth: {},
            bySource: {}
        };

        incomes.forEach(income => {
            // Category statistics
            statistics.byCategory[income.category] = (statistics.byCategory[income.category] || 0) + parseFloat(income.amount);

            // Monthly statistics
            const monthYear = income.date.toISOString().substring(0, 7);
            statistics.byMonth[monthYear] = (statistics.byMonth[monthYear] || 0) + parseFloat(income.amount);

            // Source statistics
            statistics.bySource[income.source] = (statistics.bySource[income.source] || 0) + parseFloat(income.amount);
        });

        res.status(200).json({
            success: true,
            data: statistics
        });
    } catch (error) {
        next(error);
    }
};
