const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Receipt = sequelize.define('Receipt', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    receiptNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: { msg: 'Receipt number is required' }
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
    invoiceId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Invoices',
            key: 'id'
        }
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    paymentMethod: {
        type: DataTypes.ENUM('cash', 'credit_card', 'bank_transfer', 'check', 'other'),
        allowNull: false
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USD'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
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
                    if (!item.description || !item.amount) {
                        throw new Error('Each item must have description and amount');
                    }
                });
            }
        }
    },
    taxAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    status: {
        type: DataTypes.ENUM('draft', 'final', 'void'),
        defaultValue: 'draft'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    emailSent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    lastEmailSentDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    attachments: {
        type: DataTypes.JSONB,
        allowNull: true
    }
}, {
    hooks: {
        beforeValidate: (receipt) => {
            // Calculate total amount
            if (receipt.items) {
                const subtotal = receipt.items.reduce(
                    (sum, item) => sum + parseFloat(item.amount),
                    0
                );
                receipt.totalAmount = subtotal + parseFloat(receipt.taxAmount);
            }
        }
    }
});

// Define associations
Receipt.associate = (models) => {
    Receipt.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
    });
    Receipt.belongsTo(models.Client, {
        foreignKey: 'clientId',
        as: 'client'
    });
    Receipt.belongsTo(models.Invoice, {
        foreignKey: 'invoiceId',
        as: 'invoice'
    });
};

module.exports = { Receipt };
