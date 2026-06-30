const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// JSON body parser
app.use(express.json());

// Rate limiting on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' } },
});
app.use('/api/auth', authLimiter);

// Health check
app.get('/', (req, res) => {
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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

module.exports = app;
