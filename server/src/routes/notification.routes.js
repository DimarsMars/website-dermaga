const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/notifications
 * Get all notifications for the authenticated user.
 */
router.get(
  '/',
  authenticateToken,
  authorize('agen', 'petugas', 'admin'),
  notificationController.getNotifications
);

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read.
 */
router.put(
  '/:id/read',
  authenticateToken,
  authorize('agen', 'petugas', 'admin'),
  notificationController.markAsRead
);

/**
 * DELETE /api/notifications
 * Delete all notifications for the authenticated user.
 */
router.delete(
  '/',
  authenticateToken,
  authorize('agen', 'petugas', 'admin'),
  notificationController.deleteAllNotifications
);

/**
 * DELETE /api/notifications/:id
 * Delete a single notification.
 */
router.delete(
  '/:id',
  authenticateToken,
  authorize('agen', 'petugas', 'admin'),
  notificationController.deleteNotification
);

module.exports = router;
