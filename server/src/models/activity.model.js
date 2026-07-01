const pool = require('../config/db');

/**
 * Activity Log (log_activity) model with parameterized queries.
 */
const ActivityModel = {
  /**
   * Create a new activity log entry.
   * @param {{ id_user: number, user_type: string, activity_type: string, keterangan: string, id_booking: number }} data
   * @returns {Promise<object>} The created log entry
   */
  async create({ id_user, user_type, activity_type, keterangan, id_booking }) {
    const result = await pool.query(
      `INSERT INTO log_activity (id_user, user_type, activity_type, keterangan, id_booking)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id_user, user_type, activity_type, keterangan, id_booking || null]
    );
    return result.rows[0];
  },

  /**
   * Find all activity logs, ordered by most recent first.
   * @returns {Promise<object[]>} Array of log entries
   */
  async findAll() {
    const result = await pool.query(
      `SELECT id_log, id_user, user_type, date_time, activity_type, keterangan
       FROM log_activity
       ORDER BY date_time DESC`
    );
    return result.rows;
  },

  /**
   * Find activity logs for a specific user, ordered by most recent first.
   * @param {number} userId - The user's ID
   * @param {string} userType - The user's type ('agen' | 'petugas' | 'admin')
   * @returns {Promise<object[]>} Array of log entries
   */
  async findByUser(userId, userType) {
    const result = await pool.query(
      `SELECT id_log, id_user, user_type, date_time, activity_type, keterangan
       FROM log_activity
       WHERE id_user = $1 AND user_type = $2
       ORDER BY date_time DESC`,
      [userId, userType]
    );
    return result.rows;
  },

  /**
   * Find activity logs with optional filters.
   * @param {{ startDate?: string, endDate?: string, activityType?: string, userId?: number, userType?: string, bookingId?: number }} filters
   * @returns {Promise<object[]>} Array of filtered log entries
   */
  async findFiltered({ startDate, endDate, activityType, userId, userType, bookingId }) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`date_time >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`date_time <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    if (activityType) {
      conditions.push(`activity_type = $${paramIndex}`);
      params.push(activityType);
      paramIndex++;
    }

    if (userId) {
      conditions.push(`id_user = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    if (userType) {
      conditions.push(`user_type = $${paramIndex}`);
      params.push(userType);
      paramIndex++;
    }

    if (bookingId) {
      conditions.push(`id_booking = $${paramIndex}`);
      params.push(bookingId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await pool.query(
      `SELECT id_log, id_user, user_type, date_time, activity_type, keterangan, id_booking
       FROM log_activity
       ${whereClause}
       ORDER BY date_time DESC`,
      params
    );
    return result.rows;
  },
};

module.exports = ActivityModel;
