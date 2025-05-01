const { Expense, User } = require('../models');
const ErrorResponse = require('../utils/errorResponse');
const PDFGenerator = require('../utils/pdfGenerator');
const ExcelGenerator = require('../utils/excelGenerator');
const { fileUpload } = require('../utils/fileUpload');

// @desc    Get all expenses
// @route   GET /api/expenses
// @access  Private
exports.getExpenses = async (req, res, next) => {
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
        
        if (req.query.category) {
            filter.category = req.query.category;
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
        const expenses = await Expense.findAndCountAll({
            where: filter,
            limit,
            offset: startIndex,
            order: [['date', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'approver',
                    attributes: ['id', 'name']
                }
            ]
        });

        // Pagination result
        const pagination = {};

        if (startIndex > 0) {
            pagination.prev = page - 1;
        }

        if (startIndex + limit < expenses.count) {
            pagination.next = page + 1;
        }

        // Calculate totals
        const totals = {
            total: expenses.rows.reduce((sum, expense) => sum + parseFloat(expense.amount), 0),
            pending: expenses.rows.filter(e => e.status === 'pending')
                .reduce((sum, expense) => sum + parseFloat(expense.amount), 0),
            approved: expenses.rows.filter(e => e.status === 'approved')
                .reduce((sum, expense) => sum + parseFloat(expense.amount), 0),
            rejected: expenses.rows.filter(e => e.status === 'rejected')
                .reduce((sum, expense) => sum + parseFloat(expense.amount), 0)
        };

        res.status(200).json({
            success: true,
            count: expenses.count,
            pagination,
            totals,
            data: expenses.rows
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single expense
// @route   GET /api/expenses/:id
// @access  Private
exports.getExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            include: [
                {
                    model: User,
                    as: 'approver',
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!expense) {
            return next(new ErrorResponse('Expense not found', 404));
        }

        res.status(200).json({
            success: true,
            data: expense
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
exports.createExpense = async (req, res, next) => {
    try {
        // Add user to req.body
        req.body.userId = req.user.id;

        // Handle file upload if receipt image is provided
        if (req.file) {
            req.body.receiptImage = req.file.path;
        }

        // Create expense
        const expense = await Expense.create(req.body);

        // If it's a recurring expense, calculate next recurring date
        if (expense.isRecurring) {
            expense.calculateNextRecurringDate();
            await expense.save();
        }

        res.status(201).json({
            success: true,
            data: expense
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
exports.updateExpense = async (req, res, next) => {
    try {
        let expense = await Expense.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!expense) {
            return next(new ErrorResponse('Expense not found', 404));
        }

        // Handle file upload if new receipt image is provided
        if (req.file) {
            // Delete old receipt image if exists
            if (expense.receiptImage) {
                fileUpload.deleteFile(expense.receiptImage);
            }
            req.body.receiptImage = req.file.path;
        }

        expense = await expense.update(req.body);

        // Recalculate next recurring date if necessary
        if (expense.isRecurring && (req.body.recurringFrequency || req.body.date)) {
            expense.calculateNextRecurringDate();
            await expense.save();
        }

        res.status(200).json({
            success: true,
            data: expense
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
exports.deleteExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findOne({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });

        if (!expense) {
            return next(new ErrorResponse('Expense not found', 404));
        }

        // Delete receipt image if exists
        if (expense.receiptImage) {
            fileUpload.deleteFile(expense.receiptImage);
        }

        await expense.destroy();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve/Reject expense
// @route   PUT /api/expenses/:id/approve
// @access  Private/Super User
exports.approveExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findOne({
            where: {
                id: req.params.id
            }
        });

        if (!expense) {
            return next(new ErrorResponse('Expense not found', 404));
        }

        if (expense.status !== 'pending') {
            return next(new ErrorResponse('Expense has already been processed', 400));
        }

        await expense.update({
            status: req.body.status,
            approvedBy: req.user.id,
            approvalDate: new Date()
        });

        res.status(200).json({
            success: true,
            data: expense
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Generate expense report
// @route   GET /api/expenses/report
// @access  Private
exports.generateReport = async (req, res, next) => {
    try {
        const { startDate, endDate, format = 'pdf' } = req.query;

        // Validate date range
        if (!startDate || !endDate) {
            return next(new ErrorResponse('Please provide start and end dates', 400));
        }

        // Get expenses for the period
        const expenses = await Expense.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                }
            },
            order: [['date', 'ASC']],
            include: [
                {
                    model: User,
                    as: 'approver',
                    attributes: ['name']
                }
            ]
        });

        // Calculate totals
        const totals = {
            total: expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0),
            byCategory: {},
            byStatus: {
                pending: 0,
                approved: 0,
                rejected: 0
            }
        };

        // Calculate category totals
        expenses.forEach(expense => {
            totals.byCategory[expense.category] = (totals.byCategory[expense.category] || 0) + parseFloat(expense.amount);
            totals.byStatus[expense.status] += parseFloat(expense.amount);
        });

        const reportData = {
            startDate,
            endDate,
            expenses,
            totals,
            user: req.user
        };

        let fileName;
        if (format === 'excel') {
            const excelGenerator = new ExcelGenerator('expense_report', reportData);
            fileName = await excelGenerator.generate();
        } else {
            const pdfGenerator = new PDFGenerator('expense_report', reportData);
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

// @desc    Get expense statistics
// @route   GET /api/expenses/statistics
// @access  Private
exports.getStatistics = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const expenses = await Expense.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                }
            }
        });

        // Calculate statistics
        const statistics = {
            total: expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0),
            count: expenses.length,
            byCategory: {},
            byMonth: {},
            byStatus: {
                pending: 0,
                approved: 0,
                rejected: 0
            }
        };

        expenses.forEach(expense => {
            // Category statistics
            statistics.byCategory[expense.category] = (statistics.byCategory[expense.category] || 0) + parseFloat(expense.amount);

            // Monthly statistics
            const monthYear = expense.date.toISOString().substring(0, 7);
            statistics.byMonth[monthYear] = (statistics.byMonth[monthYear] || 0) + parseFloat(expense.amount);

            // Status statistics
            statistics.byStatus[expense.status] += parseFloat(expense.amount);
        });

        res.status(200).json({
            success: true,
            data: statistics
        });
    } catch (error) {
        next(error);
    }
};
