/**
 * Global Error Handler Middleware - Production Ready
 * 
 * @version 2.0.0
 * @author Bugema University IT Support System
 */

// Import audit service with proper error handling
let auditService;

try {
    auditService = require('../services/auditService');
    console.log('✅ Audit service initialized');
} catch (error) {
    console.warn('⚠️ Audit service not available, using console logging only');
    auditService = null;
}

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    // Default error values
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let errors = null;
    let errorCode = err.errorCode || 'INTERNAL_ERROR';

    // Error classification
    if (err.name === 'ValidationError') {
        // Mongoose validation error
        statusCode = 400;
        message = 'Validation Error';
        errorCode = 'VALIDATION_ERROR';
        errors = Object.values(err.errors).map(e => ({
            field: e.path,
            message: e.message,
            value: e.value
        }));
    } else if (err.code === 11000) {
        // Mongoose duplicate key error
        statusCode = 409;
        message = 'Duplicate Entry';
        errorCode = 'DUPLICATE_ENTRY';
        const field = Object.keys(err.keyPattern)[0];
        errors = [{
            field,
            message: `${field} already exists`,
            value: err.keyValue[field]
        }];
    } else if (err.name === 'JsonWebTokenError') {
        // JWT token error
        statusCode = 401;
        message = 'Invalid authentication token';
        errorCode = 'INVALID_TOKEN';
    } else if (err.name === 'TokenExpiredError') {
        // JWT token expired
        statusCode = 401;
        message = 'Authentication token expired';
        errorCode = 'TOKEN_EXPIRED';
    } else if (err.name === 'CastError') {
        // Mongoose cast error (invalid ObjectId, etc.)
        statusCode = 400;
        message = 'Invalid resource identifier';
        errorCode = 'INVALID_ID';
    } else if (err.name === 'MulterError') {
        // File upload error
        statusCode = 400;
        message = err.message;
        errorCode = 'UPLOAD_ERROR';
    }

    // Log the error
    const errorDetails = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        statusCode,
        errorCode,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        userId: req.user ? req.user.id || req.user.userId : null,
        userRole: req.user ? req.user.role : null,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        query: req.query,
        body: req.body,
        params: req.params
    };

    // Console logging based on environment
    if (process.env.NODE_ENV === 'development') {
        console.error('🔴 ERROR DETAILS:', errorDetails);
    } else {
        console.error(`🔴 [${statusCode}] ${req.method} ${req.path} - ${message}`);
    }

    // Log to audit service if available
    if (auditService && auditService.logSystemEvent) {
        try {
            auditService.logSystemEvent('ERROR', {
                ...errorDetails,
                stack: undefined // Remove stack from audit logs
            });
        } catch (auditError) {
            console.error('❌ Failed to log to audit service:', auditError.message);
        }
    }

    // Determine response structure
    const response = {
        success: false,
        message,
        errorCode,
        timestamp: new Date().toISOString(),
        path: req.path,
        ...(errors && { errors }),
        ...(process.env.NODE_ENV === 'development' && { 
            stack: err.stack,
            details: errorDetails 
        })
    };

    // Security: Hide internal errors in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        response.message = 'Internal Server Error';
        response.errorCode = 'INTERNAL_SERVER_ERROR';
        
        // Log detailed error for internal tracking
        if (auditService && auditService.logSystemEvent) {
            auditService.logSystemEvent('INTERNAL_ERROR', {
                ...errorDetails,
                message: err.message,
                stack: err.stack
            });
        }
    }

    // Set response headers
    res.setHeader('X-Error-Code', errorCode);
    res.setHeader('X-Error-Message', encodeURIComponent(message));

    // Send response
    res.status(statusCode).json(response);
};

/**
 * Custom Error Classes for structured error handling
 */
class AppError extends Error {
    constructor(message, statusCode = 500, errorCode = 'APP_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = true;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
    }

    toJSON() {
        return {
            success: false,
            message: this.message,
            errorCode: this.errorCode,
            statusCode: this.statusCode,
            timestamp: this.timestamp
        };
    }
}

class ValidationError extends AppError {
    constructor(message = 'Validation failed', errors = []) {
        super(message, 400, 'VALIDATION_ERROR');
        this.errors = errors;
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_REQUIRED');
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'AUTHORIZATION_FAILED');
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'RESOURCE_NOT_FOUND');
    }
}

class DatabaseError extends AppError {
    constructor(message = 'Database operation failed') {
        super(message, 500, 'DATABASE_ERROR');
    }
}

class ServiceError extends AppError {
    constructor(message = 'Service unavailable', serviceName = 'unknown') {
        super(message, 503, 'SERVICE_UNAVAILABLE');
        this.serviceName = serviceName;
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

/**
 * Async handler wrapper to catch async errors
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 Not Found handler middleware
 */
const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`);
    next(error);
};

/**
 * Health check error simulation for testing
 */
const simulateError = (type = 'generic') => {
    const errors = {
        validation: new ValidationError('Test validation error', [
            { field: 'email', message: 'Invalid email format' },
            { field: 'password', message: 'Password must be at least 6 characters' }
        ]),
        auth: new AuthenticationError('Test authentication error'),
        notfound: new NotFoundError('Test resource not found'),
        database: new DatabaseError('Test database error'),
        generic: new AppError('Test application error', 500, 'TEST_ERROR')
    };
    
    return errors[type] || errors.generic;
};
// Export the main middleware function as default
module.exports = errorHandler;

// Also export other utilities as named exports
module.exports.errorHandler = errorHandler;
module.exports.notFoundHandler = notFoundHandler;
module.exports.asyncHandler = asyncHandler;
module.exports.AppError = AppError;
module.exports.ValidationError = ValidationError;
module.exports.AuthenticationError = AuthenticationError;
module.exports.AuthorizationError = AuthorizationError;
module.exports.NotFoundError = NotFoundError;
module.exports.DatabaseError = DatabaseError;
module.exports.ServiceError = ServiceError;
module.exports.RateLimitError = RateLimitError;
module.exports.simulateError = simulateError;