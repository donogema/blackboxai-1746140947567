const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Invoice = sequelize.define('Invoice', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    invoiceNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: { msg: 'Invoice number is required' }
        }
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    clientId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Clients',
            key: 'id'
        }
    },
    issueDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    dueDate: {
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
            isAfterIssueDate(value) {
                if (value <= this.issueDate) {
                    throw new Error('Due date must be after issue date');
                }
            }
        }
    },
    items: {
        type: DataTypes.JSONB,
        allowNull: false,
        validate: {
            isValidItems(value) {
                if (!Array.isArray(value) || value.length === 0) {
                    throw new Error('Items must be a non-empty array');
                }
                value.forEach(item => {
                    if (!item.description || !item.quantity || !item.price) {
                        throw new Error('Each item must have description, quantity, and price');
                    }
                });
            }
        }
    },
    subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    taxRate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0,
            max: 100
        }
    },
    taxAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    terms: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled'),
        defaultValue: 'draft'
    },
    paymentDue: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    paymentMethod: {
        type: DataTypes.STRING,
        allowNull: true
    },
    paidDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    emailSent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    lastEmailSentDate: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    hooks: {
        beforeValidate: (invoice) => {
            // Calculate totals
            if (invoice.items) {
                invoice.subtotal = invoice.items.reduce(
                    (sum, item) => sum + (item.quantity * item.price),
                    0
                );
                invoice.taxAmount = (invoice.subtotal * invoice.taxRate) / 100;
                invoice.total = invoice.subtotal + invoice.taxAmount;
                invoice.paymentDue = invoice.total;
            }
        }
    }
});

// Define associations
Invoice.associate = (models) => {
    Invoice.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
    });
    Invoice.belongsTo(models.Client, {
        foreignKey: 'clientId',
        as: 'client'
    });
};

module.exports = { Invoice };
