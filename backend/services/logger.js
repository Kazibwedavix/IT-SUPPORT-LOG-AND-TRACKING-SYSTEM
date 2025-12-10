/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * Enterprise Logger Service
 * 
 * @version 2.0.0
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const DailyRotateFile = require('winston-daily-rotate-file');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Custom colors for different environments
const customColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  audit: 'cyan',
  security: 'red bold'
};

winston.addColors(customColors);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true, colors: customColors }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (meta.userId) {
      log += ` | User: ${meta.userId}`;
    }
    
    if (meta.ip) {
      log += ` | IP: ${meta.ip}`;
    }
    
    if (meta.path) {
      log += ` | Path: ${meta.path}`;
    }
    
    if (meta.stack) {
      log += `\n${meta.stack}`;
    }
    
    return log;
  })
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: { 
    service: 'bugema-it-support',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error logs (rotated daily)
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    }),
    
    // Combined logs (rotated daily)
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    }),
    
    // Audit logs (separate file)
    new DailyRotateFile({
      filename: path.join(logsDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'audit',
      maxSize: '20m',
      maxFiles: '90d',
      zippedArchive: true
    }),
    
    // Security logs (separate file, kept longer)
    new DailyRotateFile({
      filename: path.join(logsDir, 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'security',
      maxSize: '20m',
      maxFiles: '180d',
      zippedArchive: true
    })
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    })
  ],
  exitOnError: false
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Also log to console in production (for platforms like Heroku)
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
    level: 'info'
  }));
}

// Custom log levels
logger.audit = (message, meta = {}) => {
  logger.log({
    level: 'audit',
    message,
    ...meta
  });
};

logger.security = (message, meta = {}) => {
  logger.log({
    level: 'security',
    message,
    ...meta
  });
};

// HTTP request logging middleware
logger.morganStream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Request logger middleware
logger.requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger.log(logLevel, 'Request completed', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user ? req.user.id : 'anonymous',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
};

// Error logger utility
logger.errorWithContext = (error, context = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context,
    errorType: error.constructor.name,
    timestamp: new Date().toISOString()
  });
};

// Performance logger
logger.performance = (operation, duration, meta = {}) => {
  const level = duration > 1000 ? 'warn' : 'info'; // Warn if > 1 second
  
  logger.log(level, `Performance: ${operation}`, {
    duration: `${duration}ms`,
    ...meta
  });
};

// Business event logger
logger.businessEvent = (event, data = {}) => {
  logger.info(`Business Event: ${event}`, {
    event,
    ...data,
    timestamp: new Date().toISOString()
  });
};

// Log rotation cleanup
logger.cleanupOldLogs = async (days = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // This would be implemented based on your storage strategy
    // For now, Winston's DailyRotateFile handles rotation automatically
    logger.info(`Log cleanup would remove logs older than ${days} days`);
  } catch (error) {
    logger.error('Failed to cleanup logs:', error);
  }
};

// Get log statistics
logger.getStats = async () => {
  try {
    const logsDir = path.join(__dirname, '../logs');
    const files = fs.readdirSync(logsDir);
    
    const stats = {
      totalFiles: files.length,
      files: [],
      totalSize: 0
    };
    
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      const fileStat = fs.statSync(filePath);
      
      stats.files.push({
        name: file,
        size: fileStat.size,
        modified: fileStat.mtime
      });
      
      stats.totalSize += fileStat.size;
    });
    
    return stats;
  } catch (error) {
    logger.error('Failed to get log stats:', error);
    return null;
  }
};

// Health check
logger.healthCheck = () => {
  return {
    status: 'healthy',
    level: logger.level,
    transports: logger.transports.map(t => t.name || t.constructor.name),
    timestamp: new Date().toISOString()
  };
};

// Export the logger
module.exports = logger;