const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        retry: {
            max: 3,
            timeout: 30000
        },
        dialectOptions: {
            ssl: process.env.NODE_ENV === 'production' ? {
                require: true,
                rejectUnauthorized: false
            } : false
        }
    }
);

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully.');
        
        // Sync all models
        // In production, you might want to remove this or use migrations instead
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true });
            console.log('Database models synchronized');
        }
    } catch (error) {
        console.error('Unable to connect to the database:', error.message);
        // Don't exit the process, let the application handle the error
        throw error;
    }
};

// Test the connection periodically
const healthCheck = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection is healthy.');
    } catch (error) {
        console.error('Database connection error:', error.message);
    }
};

// Run health check every minute
if (process.env.NODE_ENV === 'production') {
    setInterval(healthCheck, 60000);
}

module.exports = {
    sequelize,
    connectDB
};
