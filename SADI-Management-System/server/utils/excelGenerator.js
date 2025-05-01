const ExcelJS = require('exceljs');
const path = require('path');

class ExcelGenerator {
    constructor(type, data, options = {}) {
        this.type = type; // 'invoice', 'receipt', 'expense_report', 'income_report'
        this.data = data;
        this.options = options;
        this.workbook = new ExcelJS.Workbook();
    }

    async generate() {
        const fileName = `${this.type}-${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../uploads', fileName);

        try {
            switch (this.type) {
                case 'invoice':
                    await this.generateInvoice();
                    break;
                case 'receipt':
                    await this.generateReceipt();
                    break;
                case 'expense_report':
                    await this.generateExpenseReport();
                    break;
                case 'income_report':
                    await this.generateIncomeReport();
                    break;
                default:
                    throw new Error('Invalid document type');
            }

            await this.workbook.xlsx.writeFile(filePath);
            return fileName;
        } catch (error) {
            throw error;
        }
    }

    async generateInvoice() {
        const worksheet = this.workbook.addWorksheet('Invoice');

        // Set columns
        worksheet.columns = [
            { header: 'Item', key: 'item', width: 20 },
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Quantity', key: 'quantity', width: 10 },
            { header: 'Unit Price', key: 'unitPrice', width: 15 },
            { header: 'Total', key: 'total', width: 15 }
        ];

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add invoice information
        worksheet.insertRow(1, []);
        worksheet.insertRow(1, [`Invoice Number: ${this.data.invoiceNumber}`]);
        worksheet.insertRow(1, [`Date: ${this.formatDate(this.data.date)}`]);
        worksheet.insertRow(1, [`Due Date: ${this.formatDate(this.data.dueDate)}`]);
        worksheet.insertRow(1, [`Client: ${this.data.client.name}`]);
        worksheet.insertRow(1, ['']);

        // Add items
        this.data.items.forEach(item => {
            worksheet.addRow({
                item: item.item,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.amount,
                total: item.amount * item.quantity
            });
        });

        // Add totals
        const lastRow = worksheet.lastRow.number;
        worksheet.addRow([]);
        worksheet.addRow(['', '', '', 'Subtotal', this.data.subtotal]);
        worksheet.addRow(['', '', '', 'Tax', this.data.taxAmount]);
        worksheet.addRow(['', '', '', 'Total', this.data.total]);

        // Style currency columns
        worksheet.getColumn('unitPrice').numFmt = '"$"#,##0.00';
        worksheet.getColumn('total').numFmt = '"$"#,##0.00';

        // Add borders
        worksheet.eachRow({ includeEmpty: false }, row => {
            row.eachCell({ includeEmpty: false }, cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });
    }

    async generateReceipt() {
        const worksheet = this.workbook.addWorksheet('Receipt');

        // Set columns
        worksheet.columns = [
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Amount', key: 'amount', width: 15 }
        ];

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add receipt information
        worksheet.insertRow(1, []);
        worksheet.insertRow(1, [`Receipt Number: ${this.data.receiptNumber}`]);
        worksheet.insertRow(1, [`Date: ${this.formatDate(this.data.date)}`]);
        worksheet.insertRow(1, [`Payment Method: ${this.data.paymentMethod}`]);
        worksheet.insertRow(1, ['']);

        // Add items
        this.data.items.forEach(item => {
            worksheet.addRow({
                description: item.description,
                amount: item.amount
            });
        });

        // Style currency column
        worksheet.getColumn('amount').numFmt = '"$"#,##0.00';

        // Add borders
        worksheet.eachRow({ includeEmpty: false }, row => {
            row.eachCell({ includeEmpty: false }, cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });
    }

    async generateExpenseReport() {
        const worksheet = this.workbook.addWorksheet('Expense Report');

        // Set columns
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add report information
        worksheet.insertRow(1, []);
        worksheet.insertRow(1, [`Period: ${this.formatDate(this.data.startDate)} - ${this.formatDate(this.data.endDate)}`]);
        worksheet.insertRow(1, ['']);

        // Add expenses
        this.data.expenses.forEach(expense => {
            worksheet.addRow({
                date: this.formatDate(expense.date),
                category: expense.category,
                description: expense.description,
                amount: expense.amount,
                status: expense.status
            });
        });

        // Add total
        worksheet.addRow([]);
        worksheet.addRow(['', '', 'Total', this.data.total]);

        // Style currency column
        worksheet.getColumn('amount').numFmt = '"$"#,##0.00';

        // Add borders and alternating row colors
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            row.eachCell({ includeEmpty: false }, cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            if (rowNumber > 4 && rowNumber % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5F5F5' }
                };
            }
        });
    }

    async generateIncomeReport() {
        const worksheet = this.workbook.addWorksheet('Income Report');

        // Set columns
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Source', key: 'source', width: 20 }
        ];

        // Style the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add report information
        worksheet.insertRow(1, []);
        worksheet.insertRow(1, [`Period: ${this.formatDate(this.data.startDate)} - ${this.formatDate(this.data.endDate)}`]);
        worksheet.insertRow(1, ['']);

        // Add income entries
        this.data.incomes.forEach(income => {
            worksheet.addRow({
                date: this.formatDate(income.date),
                category: income.category,
                description: income.description,
                amount: income.amount,
                source: income.source
            });
        });

        // Add total
        worksheet.addRow([]);
        worksheet.addRow(['', '', 'Total Income', this.data.total]);

        // Style currency column
        worksheet.getColumn('amount').numFmt = '"$"#,##0.00';

        // Add borders and alternating row colors
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            row.eachCell({ includeEmpty: false }, cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            if (rowNumber > 4 && rowNumber % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5F5F5' }
                };
            }
        });
    }

    formatDate(date) {
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    }
}

module.exports = ExcelGenerator;
