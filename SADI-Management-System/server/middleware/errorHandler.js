const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error for debugging
    console.error(err.stack);

    // Sequelize unique constraint error
    if (err.name === 'SequelizeUniqueConstraintError') {
        const message = 'Duplicate field value entered';
        error = new ErrorResponse(message, 400);
    }

    // Sequelize validation error
    if (err.name === 'SequelizeValidationError') {
        const message = Object.values(err.errors).map(val => val.message);
        error = new ErrorResponse(message, 400);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = new ErrorResponse(message, 401);
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = new ErrorResponse(message, 401);
    }

    // File upload size error
    if (err.code === 'LIMIT_FILE_SIZE') {
        const message = 'File size cannot be larger than 5MB';
        error = new ErrorResponse(message, 400);
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Server Error',
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack
        })
    });
};

module.exports = errorHandler;
