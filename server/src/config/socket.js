const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const BookingModel = require('../models/booking.model');

/**
 * Initialize Socket.io server with JWT authentication on handshake.
 * All authenticated users join the 'berthing_plan' room for realtime updates.
 *
 * @param {import('http').Server} httpServer - Node HTTP server instance
 * @returns {import('socket.io').Server} Configured Socket.io server
 */
function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT authentication middleware on handshake
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    // All authenticated users join the berthing_plan room
    socket.join('berthing_plan');

    // Send current booking state on connect for state synchronization
    try {
      const bookings = await BookingModel.findAll(null);
      socket.emit('sync_state', {
        bookings,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error sending sync state on connection:', err.message);
    }

    socket.on('disconnect', () => {
      // Client disconnected - cleanup handled by Socket.io
    });
  });

  return io;
}

module.exports = initSocket;
