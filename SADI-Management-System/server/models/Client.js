const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Client = sequelize.define('Client', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Please add a client name' }
        }
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: { msg: 'Please add a valid email' }
        }
    },
    phone: {
        type: DataTypes.STRING,
        validate: {
            is: {
                args: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
                msg: 'Please add a valid phone number'
            }
        }
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Please add an address' }
        }
    },
    city: {
        type: DataTypes.STRING,
        allowNull: false
    },
    state: {
        type: DataTypes.STRING,
        allowNull: false
    },
    zipCode: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            is: {
                args: /^[0-9]{5}(?:-[0-9]{4})?$/,
                msg: 'Please add a valid ZIP code'
            }
        }
    },
    country: {
        type: DataTypes.STRING,
        allowNull: false
    },
    companyName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    taxNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active'
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['email', 'userId']
        }
    ]
});

// Define association with User model
Client.associate = (models) => {
    Client.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
    });
    Client.hasMany(models.Invoice, {
        foreignKey: 'clientId',
        as: 'invoices'
    });
    Client.hasMany(models.Receipt, {
        foreignKey: 'clientId',
        as: 'receipts'
    });
};

module.exports = { Client };
