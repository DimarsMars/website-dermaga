const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://www.google.com', 'https://www.gstatic.com'],
        frameSrc: ["'self'", 'https://www.google.com', 'https://recaptcha.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://www.google.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'https://www.google.com'],
      },
    },
  })
);

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// JSON body parser
app.use(express.json({ limit: '1mb' }));

// Rate limiting on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' } },
});
app.use('/api/auth', authLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Dock Pre-Booking Monitoring API' });
});

// Routes
const authRoutes = require('./routes/auth.routes');
const masterRoutes = require('./routes/master.routes');
const bookingRoutes = require('./routes/booking.routes');
const notificationRoutes = require('./routes/notification.routes');
const activityRoutes = require('./routes/activity.routes');

app.use('/api/auth', authRoutes);
app.use('/api', masterRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity', activityRoutes);

// 404 handler for unmatched API routes (returns JSON, not HTML)
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` },
  });
});

// Serve static files in production (SPA catch-all)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// ============================================================
// Global Error Handler (must be the last middleware)
// ============================================================
app.use((err, req, res, next) => {
  // Joi validation errors thrown by middleware
  if (err && err.isJoi) {
    const details = (err.details || []).map((d) => ({
      field: d.path.join('.'),
      message: d.message,
    }));
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_FIELDS',
        message: 'Missing or invalid fields',
        details,
      },
    });
  }

  // JSON body parser syntax errors
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' },
    });
  }

  // JWT errors (most are caught in auth middleware, but catch stray ones)
  if (err && err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_INVALID', message: 'Invalid or missing authentication token' },
    });
  }

  // Rate limit errors
  if (err && err.name === 'RateLimitExceededError') {
    return res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' },
    });
  }

  // Log unexpected errors (don't leak stack trace to client in production)
  console.error('Unhandled error:', err && err.message ? err.message : err);
  if (!isProduction) {
    console.error(err && err.stack);
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL',
      message: isProduction ? 'Internal server error' : (err && err.message) || 'Internal server error',
    },
  });
});

module.exports = app;
