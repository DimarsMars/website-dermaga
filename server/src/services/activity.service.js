const ActivityModel = require('../models/activity.model');

/**
 * Activity types used throughout the system.
 */
const ACTIVITY_TYPES = {
  LOGIN: 'login',
  REGISTER: 'register',
  BOOKING_CREATED: 'booking_created',
  BOOKING_APPROVED: 'booking_approved',
  BOOKING_REJECTED: 'booking_rejected',
  BOOKING_EXTENDED: 'booking_extended',
  POSITION_EDITED: 'position_edited',
  SHIP_CREATED: 'ship_created',
  SHIP_UPDATED: 'ship_updated',
  SHIP_DELETED: 'ship_deleted',
  AGENT_CREATED: 'agent_created',
  AGENT_UPDATED: 'agent_updated',
  AGENT_DELETED: 'agent_deleted',
  OFFICER_CREATED: 'officer_created',
  OFFICER_UPDATED: 'officer_updated',
  OFFICER_DELETED: 'officer_deleted',
};

/**
 * Activity service for recording and retrieving activity logs.
 */
const ActivityService = {
  /**
   * Record an activity log entry.
   * @param {number} userId - The user's ID
   * @param {string} userType - The user's type ('agen' | 'petugas' | 'admin')
   * @param {string} activityType - The type of activity performed
   * @param {string} keterangan - Description of the activity
   * @returns {Promise<object>} The created log entry
   */
  async logActivity(userId, userType, activityType, keterangan, id_booking = null) {
    return ActivityModel.create({
      id_user: userId,
      user_type: userType,
      activity_type: activityType,
      keterangan,
      id_booking,
    });
  },

  /**
   * Get activity logs based on user role.
   * Agents see only their own logs; officers and admins see all.
   * @param {object} user - The authenticated user { id, role }
   * @param {object} filters - Optional filters { startDate, endDate, activityType }
   * @returns {Promise<object[]>} Array of log entries
   */
  async getActivityLogs(user, filters = {}) {
    const { startDate, endDate, activityType, bookingId } = filters;

    const queryFilters = {
      startDate,
      endDate,
      activityType,
      bookingId: bookingId || null
    };

    if (user.role === 'agen' && !bookingId) {
        queryFilters.userId = user.id;
        queryFilters.userType = 'agen';
      }

    return ActivityModel.findFiltered(queryFilters);
  }
};

module.exports = { ActivityService, ACTIVITY_TYPES };
