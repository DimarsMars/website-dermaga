const NotificationModel = require('../models/notification.model');

/**
 * Notification controller handling HTTP request/response for notification operations.
 */
const notificationController = {
  /**
   * GET /api/notifications
   * Get all notifications for the authenticated user.
   */
  async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const userType = req.user.role;

      const notifications = await NotificationModel.findByUser(userId, userType);

      return res.status(200).json({
        success: true,
        data: notifications,
      });
    } catch (err) {
      console.error('Error fetching notifications:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * PUT /api/notifications/:id/read
   * Mark a notification as read.
   */
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const notifId = parseInt(id, 10);

      if (isNaN(notifId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_FIELDS', message: 'Invalid notification ID' },
        });
      }

      const notification = await NotificationModel.markAsRead(notifId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Notification not found' },
        });
      }

      // Ensure the notification belongs to the authenticated user
      if (notification.id_user !== req.user.id || notification.user_type !== req.user.role) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied. Insufficient permissions.' },
        });
      }

      return res.status(200).json({
        success: true,
        data: notification,
      });
    } catch (err) {
      console.error('Error marking notification as read:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * DELETE /api/notifications/:id
   * Delete a single notification.
   */
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const notifId = parseInt(id, 10);

      if (isNaN(notifId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_FIELDS', message: 'Invalid notification ID' },
        });
      }

      const notification = await NotificationModel.delete(notifId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Notification not found' },
        });
      }

      // Ensure the notification belongs to the authenticated user
      if (notification.id_user !== req.user.id || notification.user_type !== req.user.role) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied. Insufficient permissions.' },
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification deleted',
      });
    } catch (err) {
      console.error('Error deleting notification:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * DELETE /api/notifications
   * Delete all notifications for the authenticated user.
   */
  async deleteAllNotifications(req, res) {
    try {
      const userId = req.user.id;
      const userType = req.user.role;

      const count = await NotificationModel.deleteAllByUser(userId, userType);

      return res.status(200).json({
        success: true,
        message: `${count} notification(s) deleted`,
      });
    } catch (err) {
      console.error('Error deleting all notifications:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },
};

module.exports = notificationController;
