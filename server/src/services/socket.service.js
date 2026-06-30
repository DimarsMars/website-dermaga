/**
 * Socket.io broadcast service for realtime state updates.
 * Provides functions to broadcast berthing plan changes and targeted notifications.
 */

/**
 * Broadcast a berthing plan update to all connected clients in the 'berthing_plan' room.
 *
 * @param {import('socket.io').Server} io - Socket.io server instance
 * @param {string} event - Event type: 'created' | 'approved' | 'rejected' | 'extended' | 'position_edited'
 * @param {object} booking - The booking data to broadcast
 */
function broadcastBerthingUpdate(io, event, booking) {
  io.to('berthing_plan').emit('update_berthing', {
    event,
    booking,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send a targeted notification to a specific user via their personal room.
 * Users are identified by a combination of userId and userType to handle
 * the separate agent/officer tables.
 *
 * @param {import('socket.io').Server} io - Socket.io server instance
 * @param {number} userId - Target user ID
 * @param {string} userType - Target user type: 'agen' | 'petugas' | 'admin'
 * @param {object} notification - Notification payload
 * @param {string} notification.title - Notification title
 * @param {string} notification.message - Notification message
 */
function broadcastNotification(io, userId, userType, notification) {
  // Emit to all sockets in the berthing_plan room, filtering by user identity
  const sockets = io.sockets.sockets;
  for (const [, socket] of sockets) {
    if (socket.user && socket.user.id === userId && socket.user.role === userType) {
      socket.emit('new_notification', {
        ...notification,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

module.exports = {
  broadcastBerthingUpdate,
  broadcastNotification,
};
