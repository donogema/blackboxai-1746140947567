const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Income = sequelize.define('Income', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
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
    receiptId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Receipts',
            key: 'id'
        }
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    category: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Category is required' }
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Description is required' }
        }
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: {
                args: [0],
                msg: 'Amount must be greater than 0'
            }
        }
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USD'
    },
    paymentMethod: {
        type: DataTypes.ENUM('cash', 'credit_card', 'bank_transfer', 'check', 'other'),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
        defaultValue: 'pending'
    },
    isRecurring: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    recurringFrequency: {
        type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'yearly'),
        allowNull: true
    },
    nextRecurringDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    taxable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    taxRate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    taxAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    attachments: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    source: {
        type: DataTypes.STRING,
        allowNull: true
    },
    referenceNumber: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    indexes: [
        {
            fields: ['userId', 'date']
        },
        {
            fields: ['category']
        },
        {
            fields: ['status']
        },
        {
            fields: ['invoiceId']
        },
        {
            fields: ['receiptId']
        }
    ]
});

// Define associations
Income.associate = (models) => {
    Income.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
    });
    Income.belongsTo(models.Invoice, {
        foreignKey: 'invoiceId',
        as: 'invoice'
    });
    Income.belongsTo(models.Receipt, {
        foreignKey: 'receiptId',
        as: 'receipt'
    });
};

// Instance methods
Income.prototype.calculateTaxAmount = function() {
    if (this.taxable && this.amount && this.taxRate) {
        this.taxAmount = ((this.amount * this.taxRate) / 100).toFixed(2);
    }
};

// Hooks
Income.addHook('beforeSave', async (income) => {
    // Calculate tax amount if applicable
    if (income.taxable && income.changed('amount') || income.changed('taxRate')) {
        income.calculateTaxAmount();
    }

    // Set next recurring date if this is a recurring income
    if (income.isRecurring && income.recurringFrequency && !income.nextRecurringDate) {
        const date = new Date(income.date);
        switch (income.recurringFrequency) {
            case 'daily':
                date.setDate(date.getDate() + 1);
                break;
            case 'weekly':
                date.setDate(date.getDate() + 7);
                break;
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'yearly':
                date.setFullYear(date.getFullYear() + 1);
                break;
        }
        income.nextRecurringDate = date;
    }
});

module.exports = { Income };
