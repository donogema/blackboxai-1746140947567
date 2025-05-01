const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Expense = sequelize.define('Expense', {
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
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending'
    },
    receiptImage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
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
    taxDeductible: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    taxAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    approvedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    approvalDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    attachments: {
        type: DataTypes.JSONB,
        defaultValue: []
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
        }
    ]
});

// Define associations
Expense.associate = (models) => {
    Expense.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
    });
    Expense.belongsTo(models.User, {
        foreignKey: 'approvedBy',
        as: 'approver'
    });
};

// Instance methods
Expense.prototype.calculateTaxAmount = function() {
    if (this.taxDeductible && this.amount) {
        // Example: Calculate tax amount based on a fixed rate (e.g., 20%)
        this.taxAmount = (this.amount * 0.20).toFixed(2);
    }
};

// Hooks
Expense.addHook('beforeSave', async (expense) => {
    if (expense.isRecurring && expense.recurringFrequency && !expense.nextRecurringDate) {
        // Set next recurring date based on frequency
        const date = new Date(expense.date);
        switch (expense.recurringFrequency) {
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
        expense.nextRecurringDate = date;
    }
});

module.exports = { Expense };
