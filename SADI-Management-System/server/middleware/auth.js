const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

// Protect routes
exports.protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next(new ErrorResponse('Not authorized to access this route', 401));
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findByPk(decoded.id);

            if (!req.user) {
                return next(new ErrorResponse('User not found', 404));
            }

            next();
        } catch (err) {
            return next(new ErrorResponse('Not authorized to access this route', 401));
        }
    } catch (error) {
        next(error);
    }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(
                new ErrorResponse(
                    `User role ${req.user.role} is not authorized to access this route`,
                    403
                )
            );
        }
        next();
    };
};

// Check if user is super user
exports.isSuperUser = (req, res, next) => {
    if (req.user.role !== 'super_user') {
        return next(
            new ErrorResponse(
                'Only super users are authorized to perform this action',
                403
            )
        );
    }
    next();
};

// Verify ownership of resource
exports.checkOwnership = (model) => async (req, res, next) => {
    try {
        const resource = await model.findByPk(req.params.id);

        if (!resource) {
            return next(
                new ErrorResponse('Resource not found', 404)
            );
        }

        // Check if user is super_user or resource owner
        if (req.user.role !== 'super_user' && resource.userId !== req.user.id) {
            return next(
                new ErrorResponse('Not authorized to access this resource', 403)
            );
        }

        req.resource = resource;
        next();
    } catch (error) {
        next(error);
    }
};
