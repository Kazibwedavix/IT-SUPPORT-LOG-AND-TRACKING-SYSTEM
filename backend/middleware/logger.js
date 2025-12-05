/**
 * Request Logger Middleware
 * 
 * @version 1.0.0
 * @author Bugema University IT Support System
 */

const winston = require('winston');
const path = require('path');

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'bugema-it-support' },
  transports: [
    // Write to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}`
        )
      )
    }),
    // Write to file
    ...(process.env.LOG_TO_FILE === 'true' ? [
      new winston.transports.File({
        filename: path.join(process.env.LOG_DIR || './logs', 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: path.join(process.env.LOG_DIR || './logs', 'combined.log'),
        maxsize: 5242880,
        maxFiles: 5
      })
    ] : [])
  ]
});

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    const logLevel = statusCode >= 400 ? 'warn' : 'info';
    
    logger.log(logLevel, `${method} ${originalUrl} ${statusCode} - ${duration}ms - ${ip}`, {
      method,
      url: originalUrl,
      status: statusCode,
      duration,
      ip,
      userAgent: req.get('user-agent'),
      userId: req.user ? req.user.userId : null
    });
  });

  next();
};

module.exports = requestLogger;