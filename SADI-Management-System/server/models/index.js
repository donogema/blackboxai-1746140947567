const { User } = require('./User');
const { Client } = require('./Client');
const { Invoice } = require('./Invoice');
const { Receipt } = require('./Receipt');
const { Expense } = require('./Expense');
const { Income } = require('./Income');

// Define associations
User.hasMany(Client, {
    foreignKey: 'userId',
    as: 'clients'
});

User.hasMany(Invoice, {
    foreignKey: 'userId',
    as: 'invoices'
});

User.hasMany(Receipt, {
    foreignKey: 'userId',
    as: 'receipts'
});

User.hasMany(Expense, {
    foreignKey: 'userId',
    as: 'expenses'
});

User.hasMany(Income, {
    foreignKey: 'userId',
    as: 'incomes'
});

User.hasMany(Expense, {
    foreignKey: 'approvedBy',
    as: 'approvedExpenses'
});

Client.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});

Client.hasMany(Invoice, {
    foreignKey: 'clientId',
    as: 'invoices'
});

Client.hasMany(Receipt, {
    foreignKey: 'clientId',
    as: 'receipts'
});

Invoice.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});

Invoice.belongsTo(Client, {
    foreignKey: 'clientId',
    as: 'client'
});

Invoice.hasMany(Receipt, {
    foreignKey: 'invoiceId',
    as: 'receipts'
});

Invoice.hasMany(Income, {
    foreignKey: 'invoiceId',
    as: 'incomes'
});

Receipt.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});

Receipt.belongsTo(Client, {
    foreignKey: 'clientId',
    as: 'client'
});

Receipt.belongsTo(Invoice, {
    foreignKey: 'invoiceId',
    as: 'invoice'
});

Receipt.hasMany(Income, {
    foreignKey: 'receiptId',
    as: 'incomes'
});

Expense.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});

Expense.belongsTo(User, {
    foreignKey: 'approvedBy',
    as: 'approver'
});

Income.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
});

Income.belongsTo(Invoice, {
    foreignKey: 'invoiceId',
    as: 'invoice'
});

Income.belongsTo(Receipt, {
    foreignKey: 'receiptId',
    as: 'receipt'
});

module.exports = {
    User,
    Client,
    Invoice,
    Receipt,
    Expense,
    Income
};
