const nodemailer = require('nodemailer');
const path = require('path');
const ErrorResponse = require('./errorResponse');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_PORT === '465',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    async sendEmail(options) {
        try {
            const message = {
                from: `${process.env.FROM_NAME} <${process.env.EMAIL_USER}>`,
                to: options.email,
                subject: options.subject,
                html: options.html,
                attachments: options.attachments || []
            };

            const info = await this.transporter.sendMail(message);
            return info;
        } catch (error) {
            throw new ErrorResponse('Email could not be sent', 500);
        }
    }

    async sendInvoice(invoice, client, attachmentPath) {
        const emailContent = this.getInvoiceEmailTemplate(invoice, client);
        
        return this.sendEmail({
            email: client.email,
            subject: `Invoice #${invoice.invoiceNumber} from ${invoice.user.organization}`,
            html: emailContent,
            attachments: [
                {
                    filename: `Invoice-${invoice.invoiceNumber}.pdf`,
                    path: path.join(__dirname, '../uploads', attachmentPath)
                }
            ]
        });
    }

    async sendReceipt(receipt, client, attachmentPath) {
        const emailContent = this.getReceiptEmailTemplate(receipt, client);
        
        return this.sendEmail({
            email: client.email,
            subject: `Receipt #${receipt.receiptNumber} from ${receipt.user.organization}`,
            html: emailContent,
            attachments: [
                {
                    filename: `Receipt-${receipt.receiptNumber}.pdf`,
                    path: path.join(__dirname, '../uploads', attachmentPath)
                }
            ]
        });
    }

    async sendReport(report, user, attachmentPath) {
        const emailContent = this.getReportEmailTemplate(report);
        
        return this.sendEmail({
            email: user.email,
            subject: `${report.type} Report - ${report.startDate} to ${report.endDate}`,
            html: emailContent,
            attachments: [
                {
                    filename: `${report.type}-Report-${Date.now()}.pdf`,
                    path: path.join(__dirname, '../uploads', attachmentPath)
                }
            ]
        });
    }

    getInvoiceEmailTemplate(invoice, client) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Invoice from ${invoice.user.organization}</h2>
                <p>Dear ${client.name},</p>
                <p>Please find attached invoice #${invoice.invoiceNumber} for your records.</p>
                <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
                    <p><strong>Invoice Details:</strong></p>
                    <ul style="list-style: none; padding: 0;">
                        <li>Invoice Number: ${invoice.invoiceNumber}</li>
                        <li>Date: ${new Date(invoice.issueDate).toLocaleDateString()}</li>
                        <li>Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</li>
                        <li>Amount Due: $${invoice.total.toFixed(2)}</li>
                    </ul>
                </div>
                <p>For any questions or concerns, please don't hesitate to contact us.</p>
                <p>Thank you for your business!</p>
                <p>Best regards,<br>${invoice.user.organization}</p>
            </div>
        `;
    }

    getReceiptEmailTemplate(receipt, client) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Receipt from ${receipt.user.organization}</h2>
                <p>Dear ${client.name},</p>
                <p>Please find attached receipt #${receipt.receiptNumber} for your records.</p>
                <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
                    <p><strong>Receipt Details:</strong></p>
                    <ul style="list-style: none; padding: 0;">
                        <li>Receipt Number: ${receipt.receiptNumber}</li>
                        <li>Date: ${new Date(receipt.date).toLocaleDateString()}</li>
                        <li>Amount: $${receipt.amount.toFixed(2)}</li>
                        <li>Payment Method: ${receipt.paymentMethod}</li>
                    </ul>
                </div>
                <p>Thank you for your business!</p>
                <p>Best regards,<br>${receipt.user.organization}</p>
            </div>
        `;
    }

    getReportEmailTemplate(report) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>${report.type} Report</h2>
                <p>Please find attached the ${report.type} report for the period:</p>
                <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
                    <p><strong>Report Details:</strong></p>
                    <ul style="list-style: none; padding: 0;">
                        <li>Period: ${new Date(report.startDate).toLocaleDateString()} - ${new Date(report.endDate).toLocaleDateString()}</li>
                        <li>Total Amount: $${report.total.toFixed(2)}</li>
                    </ul>
                </div>
                <p>For any questions or concerns, please don't hesitate to contact us.</p>
                <p>Best regards,<br>${report.organization}</p>
            </div>
        `;
    }

    async sendPasswordReset(options) {
        return this.sendEmail({
            email: options.email,
            subject: 'Password Reset Token',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Reset Your Password</h2>
                    <p>You are receiving this email because you (or someone else) has requested to reset your password.</p>
                    <p>Please click the link below to reset your password:</p>
                    <p>
                        <a href="${options.resetUrl}" style="
                            display: inline-block;
                            padding: 10px 20px;
                            background-color: #007bff;
                            color: white;
                            text-decoration: none;
                            border-radius: 5px;
                        ">Reset Password</a>
                    </p>
                    <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
                    <p>This link will expire in 10 minutes.</p>
                </div>
            `
        });
    }

    async sendWelcome(user) {
        return this.sendEmail({
            email: user.email,
            subject: 'Welcome to SADI Management System',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to SADI Management System!</h2>
                    <p>Dear ${user.name},</p>
                    <p>Thank you for registering with SADI Management System. We're excited to have you on board!</p>
                    <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
                        <p><strong>Your account details:</strong></p>
                        <ul style="list-style: none; padding: 0;">
                            <li>Name: ${user.name}</li>
                            <li>Email: ${user.email}</li>
                            <li>Organization: ${user.organization}</li>
                        </ul>
                    </div>
                    <p>You can now start managing your invoices, receipts, and financial reports.</p>
                    <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                    <p>Best regards,<br>SADI Management System Team</p>
                </div>
            `
        });
    }
}

module.exports = new EmailService();
