const { Invoice, Receipt, Expense, Income, Client } = require('../models');
const ErrorResponse = require('../utils/errorResponse');
const PDFGenerator = require('../utils/pdfGenerator');
const ExcelGenerator = require('../utils/excelGenerator');
const { Op } = require('sequelize');

// @desc    Generate comprehensive financial report
// @route   GET /api/reports/financial
// @access  Private
exports.getFinancialReport = async (req, res, next) => {
    try {
        const { startDate, endDate, format = 'pdf' } = req.query;

        // Validate date range
        if (!startDate || !endDate) {
            return next(new ErrorResponse('Please provide start and end dates', 400));
        }

        const dateRange = {
            [Op.between]: [new Date(startDate), new Date(endDate)]
        };

        // Fetch all financial data
        const [invoices, receipts, expenses, incomes] = await Promise.all([
            Invoice.findAll({
                where: { 
                    userId: req.user.id,
                    issueDate: dateRange
                },
                include: [{ model: Client, as: 'client' }]
            }),
            Receipt.findAll({
                where: { 
                    userId: req.user.id,
                    date: dateRange
                }
            }),
            Expense.findAll({
                where: { 
                    userId: req.user.id,
                    date: dateRange
                }
            }),
            Income.findAll({
                where: { 
                    userId: req.user.id,
                    date: dateRange
                }
            })
        ]);

        // Calculate financial summaries
        const financialSummary = {
            totalInvoiced: invoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0),
            totalReceived: receipts.reduce((sum, rec) => sum + parseFloat(rec.amount), 0),
            totalExpenses: expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0),
            totalIncome: incomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0),
            netIncome: 0,
            accountsReceivable: 0
        };

        financialSummary.netIncome = financialSummary.totalIncome - financialSummary.totalExpenses;
        financialSummary.accountsReceivable = financialSummary.totalInvoiced - financialSummary.totalReceived;

        // Monthly breakdown
        const monthlyData = {};
        const addToMonthly = (date, amount, type) => {
            const monthYear = date.toISOString().substring(0, 7);
            if (!monthlyData[monthYear]) {
                monthlyData[monthYear] = {
                    invoiced: 0,
                    received: 0,
                    expenses: 0,
                    income: 0
                };
            }
            monthlyData[monthYear][type] += parseFloat(amount);
        };

        invoices.forEach(inv => addToMonthly(inv.issueDate, inv.total, 'invoiced'));
        receipts.forEach(rec => addToMonthly(rec.date, rec.amount, 'received'));
        expenses.forEach(exp => addToMonthly(exp.date, exp.amount, 'expenses'));
        incomes.forEach(inc => addToMonthly(inc.date, inc.amount, 'income'));

        // Category breakdowns
        const expensesByCategory = {};
        const incomeByCategory = {};

        expenses.forEach(exp => {
            expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + parseFloat(exp.amount);
        });

        incomes.forEach(inc => {
            incomeByCategory[inc.category] = (incomeByCategory[inc.category] || 0) + parseFloat(inc.amount);
        });

        const reportData = {
            startDate,
            endDate,
            financialSummary,
            monthlyData,
            expensesByCategory,
            incomeByCategory,
            details: {
                invoices,
                receipts,
                expenses,
                incomes
            },
            user: req.user
        };

        // Generate report in requested format
        let fileName;
        if (format === 'excel') {
            const excelGenerator = new ExcelGenerator('financial_report', reportData);
            fileName = await excelGenerator.generate();
        } else {
            const pdfGenerator = new PDFGenerator('financial_report', reportData);
            fileName = await pdfGenerator.generate();
        }

        res.status(200).json({
            success: true,
            data: {
                fileName,
                url: `${process.env.BASE_URL}/uploads/${fileName}`,
                summary: financialSummary,
                monthlyData,
                expensesByCategory,
                incomeByCategory
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Generate profit and loss report
// @route   GET /api/reports/profit-loss
// @access  Private
exports.getProfitLossReport = async (req, res, next) => {
    try {
        const { startDate, endDate, format = 'pdf' } = req.query;

        // Validate date range
        if (!startDate || !endDate) {
            return next(new ErrorResponse('Please provide start and end dates', 400));
        }

        const dateRange = {
            [Op.between]: [new Date(startDate), new Date(endDate)]
        };

        // Fetch income and expenses
        const [incomes, expenses] = await Promise.all([
            Income.findAll({
                where: { 
                    userId: req.user.id,
                    date: dateRange
                }
            }),
            Expense.findAll({
                where: { 
                    userId: req.user.id,
                    date: dateRange
                }
            })
        ]);

        // Calculate summaries
        const summary = {
            totalIncome: incomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0),
            totalExpenses: expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0),
            netProfit: 0
        };

        summary.netProfit = summary.totalIncome - summary.totalExpenses;

        // Category breakdowns
        const incomeByCategory = {};
        const expensesByCategory = {};

        incomes.forEach(inc => {
            incomeByCategory[inc.category] = (incomeByCategory[inc.category] || 0) + parseFloat(inc.amount);
        });

        expenses.forEach(exp => {
            expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + parseFloat(exp.amount);
        });

        const reportData = {
            startDate,
            endDate,
            summary,
            incomeByCategory,
            expensesByCategory,
            details: {
                incomes,
                expenses
            },
            user: req.user
        };

        // Generate report in requested format
        let fileName;
        if (format === 'excel') {
            const excelGenerator = new ExcelGenerator('profit_loss_report', reportData);
            fileName = await excelGenerator.generate();
        } else {
            const pdfGenerator = new PDFGenerator('profit_loss_report', reportData);
            fileName = await pdfGenerator.generate();
        }

        res.status(200).json({
            success: true,
            data: {
                fileName,
                url: `${process.env.BASE_URL}/uploads/${fileName}`,
                summary,
                incomeByCategory,
                expensesByCategory
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Generate accounts receivable report
// @route   GET /api/reports/receivables
// @access  Private
exports.getReceivablesReport = async (req, res, next) => {
    try {
        const { format = 'pdf' } = req.query;

        // Get all unpaid invoices
        const invoices = await Invoice.findAll({
            where: {
                userId: req.user.id,
                status: {
                    [Op.in]: ['draft', 'sent', 'overdue']
                }
            },
            include: [
                {
                    model: Client,
                    as: 'client',
                    attributes: ['id', 'name', 'email', 'companyName']
                },
                {
                    model: Receipt,
                    as: 'receipts',
                    attributes: ['id', 'amount', 'date']
                }
            ]
        });

        // Calculate receivables data
        const receivables = invoices.map(invoice => {
            const totalPaid = invoice.receipts.reduce((sum, receipt) => sum + parseFloat(receipt.amount), 0);
            const remaining = parseFloat(invoice.total) - totalPaid;
            const daysOverdue = invoice.dueDate < new Date() ? 
                Math.floor((new Date() - invoice.dueDate) / (1000 * 60 * 60 * 24)) : 0;

            return {
                invoiceNumber: invoice.invoiceNumber,
                client: invoice.client.name,
                total: invoice.total,
                paid: totalPaid,
                remaining,
                dueDate: invoice.dueDate,
                daysOverdue,
                status: invoice.status
            };
        });

        // Calculate aging summary
        const agingSummary = {
            current: 0,
            '1-30': 0,
            '31-60': 0,
            '61-90': 0,
            '90+': 0
        };

        receivables.forEach(rec => {
            const amount = rec.remaining;
            if (rec.daysOverdue <= 0) agingSummary.current += amount;
            else if (rec.daysOverdue <= 30) agingSummary['1-30'] += amount;
            else if (rec.daysOverdue <= 60) agingSummary['31-60'] += amount;
            else if (rec.daysOverdue <= 90) agingSummary['61-90'] += amount;
            else agingSummary['90+'] += amount;
        });

        const reportData = {
            receivables,
            agingSummary,
            totalReceivables: receivables.reduce((sum, rec) => sum + rec.remaining, 0),
            user: req.user
        };

        // Generate report in requested format
        let fileName;
        if (format === 'excel') {
            const excelGenerator = new ExcelGenerator('receivables_report', reportData);
            fileName = await excelGenerator.generate();
        } else {
            const pdfGenerator = new PDFGenerator('receivables_report', reportData);
            fileName = await pdfGenerator.generate();
        }

        res.status(200).json({
            success: true,
            data: {
                fileName,
                url: `${process.env.BASE_URL}/uploads/${fileName}`,
                receivables,
                agingSummary,
                totalReceivables: reportData.totalReceivables
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get dashboard statistics
// @route   GET /api/reports/dashboard
// @access  Private
exports.getDashboardStats = async (req, res, next) => {
    try {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        // Get current month's data
        const [monthlyInvoices, monthlyReceipts, monthlyExpenses, monthlyIncomes] = await Promise.all([
            Invoice.findAll({
                where: {
                    userId: req.user.id,
                    issueDate: {
                        [Op.between]: [firstDayOfMonth, lastDayOfMonth]
                    }
                }
            }),
            Receipt.findAll({
                where: {
                    userId: req.user.id,
                    date: {
                        [Op.between]: [firstDayOfMonth, lastDayOfMonth]
                    }
                }
            }),
            Expense.findAll({
                where: {
                    userId: req.user.id,
                    date: {
                        [Op.between]: [firstDayOfMonth, lastDayOfMonth]
                    }
                }
            }),
            Income.findAll({
                where: {
                    userId: req.user.id,
                    date: {
                        [Op.between]: [firstDayOfMonth, lastDayOfMonth]
                    }
                }
            })
        ]);

        // Calculate monthly statistics
        const monthlyStats = {
            invoiced: monthlyInvoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0),
            received: monthlyReceipts.reduce((sum, rec) => sum + parseFloat(rec.amount), 0),
            expenses: monthlyExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0),
            income: monthlyIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0),
            netIncome: 0
        };

        monthlyStats.netIncome = monthlyStats.income - monthlyStats.expenses;

        // Get overdue invoices
        const overdueInvoices = await Invoice.findAll({
            where: {
                userId: req.user.id,
                dueDate: {
                    [Op.lt]: today
                },
                status: {
                    [Op.in]: ['sent', 'overdue']
                }
            },
            include: [{
                model: Client,
                as: 'client',
                attributes: ['name', 'email']
            }]
        });

        // Get upcoming expenses
        const upcomingExpenses = await Expense.findAll({
            where: {
                userId: req.user.id,
                date: {
                    [Op.gt]: today
                },
                isRecurring: true
            },
            limit: 5,
            order: [['date', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: {
                monthlyStats,
                overdueInvoices,
                upcomingExpenses
            }
        });
    } catch (error) {
        next(error);
    }
};
