const pool = require('../config/db');

/**
 * Notification (notifikasi) model with parameterized queries.
 */
const NotificationModel = {
  /**
   * Create a new notification.
   * @param {{ id_user: number, user_type: string, title: string, message: string }} data
   * @returns {Promise<object>} The created notification row
   */
  async create({ id_user, user_type, title, message, related_booking_id = null }) {
    const result = await pool.query(
      `INSERT INTO notifikasi (id_user, user_type, title, message, related_booking_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_notif, id_user, user_type, title, message, is_read, related_booking_id, created_at`,
      [id_user, user_type, title, message, related_booking_id]
    );
    return result.rows[0];
  },

  /**
   * Find all notifications for a specific user, ordered by most recent first.
   * @param {number} userId - The user's ID
   * @param {string} userType - The user's type ('agen' | 'petugas' | 'admin')
   * @returns {Promise<object[]>} Array of notification rows
   */
  async findByUser(userId, userType) {
    const result = await pool.query(
      `SELECT id_notif, id_user, user_type, title, message, is_read, related_booking_id, created_at
       FROM notifikasi
       WHERE id_user = $1 AND user_type = $2
       ORDER BY created_at DESC`,
      [userId, userType]
    );
    return result.rows;
  },

  /**
   * Mark a notification as read.
   * @param {number} id - The notification ID
   * @returns {Promise<object|null>} The updated notification row, or null if not found
   */
  async markAsRead(id) {
    const result = await pool.query(
      `UPDATE notifikasi
       SET is_read = TRUE
       WHERE id_notif = $1
       RETURNING id_notif, id_user, user_type, title, message, is_read, created_at`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete a single notification by ID.
   * @param {number} id - The notification ID
   * @returns {Promise<object|null>} The deleted row, or null if not found
   */
  async delete(id) {
    const result = await pool.query(
      `DELETE FROM notifikasi WHERE id_notif = $1
       RETURNING id_notif, id_user, user_type`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete all notifications for a specific user.
   * @param {number} userId - The user's ID
   * @param {string} userType - The user's type
   * @returns {Promise<number>} Count of deleted notifications
   */
  async deleteAllByUser(userId, userType) {
    const result = await pool.query(
      `DELETE FROM notifikasi WHERE id_user = $1 AND user_type = $2`,
      [userId, userType]
    );
    return result.rowCount;
  },
};

module.exports = NotificationModel;
