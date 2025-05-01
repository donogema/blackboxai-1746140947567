const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFGenerator {
    constructor(type, data, options = {}) {
        this.type = type; // 'invoice', 'receipt', or 'report'
        this.data = data;
        this.options = options;
        this.doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            ...options
        });
    }

    async generate() {
        const fileName = `${this.type}-${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../uploads', fileName);

        return new Promise((resolve, reject) => {
            const stream = fs.createWriteStream(filePath);
            this.doc.pipe(stream);

            try {
                switch (this.type) {
                    case 'invoice':
                        this.generateInvoice();
                        break;
                    case 'receipt':
                        this.generateReceipt();
                        break;
                    case 'report':
                        this.generateReport();
                        break;
                    default:
                        throw new Error('Invalid document type');
                }

                this.doc.end();

                stream.on('finish', () => {
                    resolve(fileName);
                });

                stream.on('error', reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    generateHeader() {
        const { organizationLogo, organizationName } = this.data;
        
        if (organizationLogo) {
            this.doc.image(organizationLogo, 50, 45, { width: 50 });
        }
        
        this.doc
            .fillColor('#444444')
            .fontSize(20)
            .text(organizationName, 110, 57)
            .fontSize(10)
            .text(this.data.address, 200, 65, { align: 'right' })
            .text(this.data.email, 200, 80, { align: 'right' })
            .moveDown();
    }

    generateFooter() {
        this.doc
            .fontSize(10)
            .text(
                'Payment is due within 30 days. Thank you for your business.',
                50,
                780,
                { align: 'center', width: 500 }
            );
    }

    generateInvoice() {
        this.generateHeader();

        // Invoice details
        this.doc
            .fillColor('#444444')
            .fontSize(20)
            .text('Invoice', 50, 160);

        this.generateHr(185);

        const customerInformationTop = 200;

        this.doc
            .fontSize(10)
            .text('Invoice Number:', 50, customerInformationTop)
            .font('Helvetica-Bold')
            .text(this.data.invoiceNumber, 150, customerInformationTop)
            .font('Helvetica')
            .text('Invoice Date:', 50, customerInformationTop + 15)
            .text(this.formatDate(this.data.date), 150, customerInformationTop + 15)
            .text('Due Date:', 50, customerInformationTop + 30)
            .text(this.formatDate(this.data.dueDate), 150, customerInformationTop + 30)

            .font('Helvetica-Bold')
            .text(this.data.client.name, 300, customerInformationTop)
            .font('Helvetica')
            .text(this.data.client.address, 300, customerInformationTop + 15)
            .text(
                this.data.client.city +
                ', ' +
                this.data.client.state +
                ', ' +
                this.data.client.zipCode,
                300,
                customerInformationTop + 30
            )
            .moveDown();

        this.generateHr(252);

        // Items table
        let i,
            invoiceTableTop = 330;

        this.doc.font('Helvetica-Bold');
        this.generateTableRow(
            invoiceTableTop,
            'Item',
            'Description',
            'Unit Cost',
            'Quantity',
            'Line Total'
        );
        this.generateHr(invoiceTableTop + 20);
        this.doc.font('Helvetica');

        for (i = 0; i < this.data.items.length; i++) {
            const item = this.data.items[i];
            const position = invoiceTableTop + (i + 1) * 30;
            this.generateTableRow(
                position,
                item.item,
                item.description,
                this.formatCurrency(item.amount),
                item.quantity,
                this.formatCurrency(item.amount * item.quantity)
            );
            this.generateHr(position + 20);
        }

        const subtotalPosition = invoiceTableTop + (i + 1) * 30;
        this.doc.font('Helvetica-Bold');
        this.generateTableRow(
            subtotalPosition,
            '',
            '',
            'Subtotal',
            '',
            this.formatCurrency(this.data.subtotal)
        );

        const taxPosition = subtotalPosition + 20;
        this.generateTableRow(
            taxPosition,
            '',
            '',
            'Tax',
            `${this.data.taxRate}%`,
            this.formatCurrency(this.data.taxAmount)
        );

        const totalPosition = taxPosition + 25;
        this.doc.font('Helvetica-Bold');
        this.generateTableRow(
            totalPosition,
            '',
            '',
            'Total',
            '',
            this.formatCurrency(this.data.total)
        );

        this.generateFooter();
    }

    generateReceipt() {
        this.generateHeader();

        // Receipt details
        this.doc
            .fillColor('#444444')
            .fontSize(20)
            .text('Receipt', 50, 160);

        this.generateHr(185);

        const receiptInformationTop = 200;

        this.doc
            .fontSize(10)
            .text('Receipt Number:', 50, receiptInformationTop)
            .font('Helvetica-Bold')
            .text(this.data.receiptNumber, 150, receiptInformationTop)
            .font('Helvetica')
            .text('Date:', 50, receiptInformationTop + 15)
            .text(this.formatDate(this.data.date), 150, receiptInformationTop + 15)
            .text('Payment Method:', 50, receiptInformationTop + 30)
            .text(this.data.paymentMethod, 150, receiptInformationTop + 30)

            .moveDown();

        this.generateHr(252);

        // Amount details
        const amountPosition = 300;
        this.doc
            .fontSize(12)
            .text('Amount Received:', 50, amountPosition)
            .font('Helvetica-Bold')
            .text(this.formatCurrency(this.data.amount), 150, amountPosition)
            .moveDown();

        if (this.data.description) {
            this.doc
                .font('Helvetica')
                .fontSize(10)
                .text('Description:', 50, amountPosition + 30)
                .text(this.data.description, 150, amountPosition + 30);
        }

        this.generateFooter();
    }

    generateReport() {
        this.generateHeader();

        // Report details
        this.doc
            .fillColor('#444444')
            .fontSize(20)
            .text(`${this.data.reportType} Report`, 50, 160);

        this.generateHr(185);

        const reportInformationTop = 200;

        this.doc
            .fontSize(10)
            .text('Period:', 50, reportInformationTop)
            .font('Helvetica-Bold')
            .text(
                `${this.formatDate(this.data.startDate)} - ${this.formatDate(this.data.endDate)}`,
                150,
                reportInformationTop
            )
            .moveDown();

        this.generateHr(252);

        // Report data
        let yPosition = 280;

        this.data.items.forEach(item => {
            this.doc
                .fontSize(10)
                .font('Helvetica')
                .text(item.date, 50, yPosition)
                .text(item.description, 150, yPosition)
                .text(this.formatCurrency(item.amount), 400, yPosition);

            yPosition += 20;
        });

        // Totals
        yPosition += 20;
        this.doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Total:', 50, yPosition)
            .text(this.formatCurrency(this.data.total), 400, yPosition);

        this.generateFooter();
    }

    generateHr(y) {
        this.doc
            .strokeColor('#aaaaaa')
            .lineWidth(1)
            .moveTo(50, y)
            .lineTo(550, y)
            .stroke();
    }

    generateTableRow(y, item, description, unitCost, quantity, lineTotal) {
        this.doc
            .fontSize(10)
            .text(item, 50, y)
            .text(description, 150, y)
            .text(unitCost, 280, y, { width: 90, align: 'right' })
            .text(quantity, 370, y, { width: 90, align: 'right' })
            .text(lineTotal, 0, y, { align: 'right' });
    }

    formatCurrency(amount) {
        return '$' + amount.toFixed(2);
    }

    formatDate(date) {
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    }
}

module.exports = PDFGenerator;
