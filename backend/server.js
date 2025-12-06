/**
 * Bugema University IT Support System - Server
 * 
 * @version 1.0.0
 * @author Bugema University IT Department
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('express-xss-sanitizer');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const ticketRoutes = require('./routes/tickets');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');

// Import services
const auditService = require('./services/auditService');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], 
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"], 
      connectSrc: ["'self'", "http://localhost:5002", "ws://localhost:5002"], 
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',') 
    : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Data sanitization
app.use(mongoSanitize());
app.use(xss.xss());
app.use(hpp());

// Compression
app.use(compression());

// Request logging
app.use(logger);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Bugema IT Support API',
    version: '1.0.0',
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API docs endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    message: 'Bugema University IT Support System API',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh',
        verify: 'GET /api/auth/verify/:token',
        forgotPassword: 'POST /api/auth/forgot-password',
        resetPassword: 'POST /api/auth/reset-password/:token'
      },
      users: {
        profile: 'GET /api/users/profile',
        updateProfile: 'PUT /api/users/profile',
        changePassword: 'PUT /api/users/change-password',
        list: 'GET /api/users (admin only)',
        update: 'PUT /api/users/:id (admin only)'
      },
      tickets: {
        create: 'POST /api/tickets',
        list: 'GET /api/tickets',
        get: 'GET /api/tickets/:id',
        update: 'PUT /api/tickets/:id',
        addComment: 'POST /api/tickets/:id/comments',
        assign: 'PUT /api/tickets/:id/assign',
        close: 'PUT /api/tickets/:id/close',
        escalate: 'PUT /api/tickets/:id/escalate',
        attachments: {
          upload: 'POST /api/tickets/:id/attachments',
          download: 'GET /api/tickets/:id/attachments/:fileId'
        }
      }
    }
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// Error handling
app.use(errorHandler);

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || process.env.MONGO_ATLAS_URI
    );

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    if (auditService && auditService.logSystemEvent) {
      auditService.logSystemEvent('DATABASE_CONNECTED', {
        host: conn.connection.host,
        database: conn.connection.name
      });
    }

  } catch (error) {
    console.error(`❌ Database connection failed: ${error.message}`);
    
    if (auditService && auditService.logSystemEvent) {
      auditService.logSystemEvent('DATABASE_CONNECTION_FAILED', {
        error: error.message
      });
    }

    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`
🚀 Bugema University IT Support System
📡 Environment: ${process.env.NODE_ENV || 'development'}
🌐 Server: http://localhost:${PORT}
📚 API Docs: http://localhost:${PORT}/api/docs
❤️  Health: http://localhost:${PORT}/api/health
      `);

      if (auditService && auditService.logSystemEvent) {
        auditService.logSystemEvent('SERVER_STARTED', {
          port: PORT,
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        });
      }
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
          console.log('Database connection closed');
          process.exit(0);
        });
      });
    });

    return server;

  } catch (error) {
    console.error('❌ Failed to start server:', error);

    if (auditService && auditService.logSystemEvent) {
      auditService.logSystemEvent('SERVER_START_FAILED', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    process.exit(1);
  }
};

// Only start server if run directly
if (require.main === module) {
  startServer();
}

module.exports = app;
