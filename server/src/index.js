require('dotenv').config();

const http = require('http');
const app = require('./app');
const initSocket = require('./config/socket');
const { startScheduler, stopScheduler } = require('./services/scheduler.service');
const pool = require('./config/db');

const PORT = process.env.PORT || 5000;

/**
 * Validate required environment variables before starting the server.
 * Fail fast in production if secrets are missing or still placeholders.
 */
function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }

  if (isProduction) {
    const placeholders = ['change_me_in_production', 'your_secret', 'changeme', 'secret'];
    const isPlaceholder = (val) => !val || placeholders.some((p) => val.toLowerCase().includes(p));
    if (isPlaceholder(process.env.JWT_SECRET)) {
      throw new Error('JWT_SECRET must be set to a strong value in production (not a placeholder)');
    }
    if (isPlaceholder(process.env.JWT_REFRESH_SECRET)) {
      throw new Error('JWT_REFRESH_SECRET must be set to a strong value in production (not a placeholder)');
    }
    if (isPlaceholder(process.env.DB_PASSWORD)) {
      throw new Error('DB_PASSWORD must be set to a real password in production');
    }
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      console.warn('Warning: RECAPTCHA_SECRET_KEY not configured — reCAPTCHA verification will be rejected in production');
    }
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is required in production');
    }
    if (!process.env.EMAIL_FROM) {
      throw new Error('EMAIL_FROM environment variable is required in production');
    }
  }
}

validateEnvironment();

const server = http.createServer(app);

// Attach Socket.io to the HTTP server
const io = initSocket(server);

// Make io accessible to route handlers
app.set('io', io);

// Start the booking status scheduler (checks every 60s)
startScheduler(io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server attached`);
});

// ============================================================
// Graceful Shutdown
// ============================================================
let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) {
    console.log(`\nForce exiting (received ${signal} again)...`);
    process.exit(1);
  }
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully...`);

  // 1. Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed.');
  });

  // 2. Stop the scheduler (clears the interval)
  try {
    stopScheduler();
    console.log('Scheduler stopped.');
  } catch (err) {
    console.error('Error stopping scheduler:', err.message);
  }

  // 3. Close existing Socket.io connections
  try {
    io.close();
    console.log('Socket.io server closed.');
  } catch (err) {
    console.error('Error closing Socket.io:', err.message);
  }

  // 4. Close the database pool
  try {
    await pool.end();
    console.log('Database pool closed.');
  } catch (err) {
    console.error('Error closing database pool:', err.message);
  }

  console.log('Shutdown complete.');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled rejections and errors — log then attempt graceful shutdown
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

module.exports = { server, io };