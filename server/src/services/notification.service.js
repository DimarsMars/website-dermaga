const NotificationModel = require('../models/notification.model');
const pool = require('../config/db');
const { broadcastNotification } = require('./socket.service');

/**
 * Helper to get a readable ship reference for notification messages.
 * Falls back to ID if ship name is not available.
 */
function shipRef(booking) {
  return booking.nama_kapal ? `kapal ${booking.nama_kapal}` : `booking #${booking.id_booking}`;
}

/**
 * Notification service handling notification creation and routing logic.
 * Determines recipients by event type and emits realtime Socket.io events.
 */
const NotificationService = {
  /**
   * Notify all petugas and admin users about a new booking submission.
   * Called when an agent submits a pre-booking.
   *
   * @param {import('socket.io').Server|null} io - Socket.io server instance
   * @param {object} booking - The newly created booking
   * @param {string} [agentName] - Name of the submitting agent (for message)
   */
  async notifyNewBooking(io, booking, agentName) {
    // Get all officers and admins from master_petugas
    const result = await pool.query(
      `SELECT id_petugas, user_role FROM master_petugas`
    );
    const officers = result.rows;

    const title = 'Permintaan Booking Baru';
    const shipName = booking.nama_kapal || '';
    const message = agentName
      ? `Booking baru ${shipName ? `kapal ${shipName} ` : ''}dari ${agentName} menunggu persetujuan.`
      : `Booking baru ${shipRef(booking)} menunggu persetujuan.`;

    const notifications = [];
    for (const officer of officers) {
      const notification = await NotificationModel.create({
        id_user: officer.id_petugas,
        user_type: officer.user_role,
        title,
        message,
      });
      notifications.push(notification);

      // Emit realtime notification via Socket.io
      if (io) {
        broadcastNotification(io, officer.id_petugas, officer.user_role, notification);
      }
    }

    return notifications;
  },

  /**
   * Notify the submitting agent about a booking status change (approved/rejected).
   *
   * @param {import('socket.io').Server|null} io - Socket.io server instance
   * @param {object} booking - The booking that was approved/rejected
   * @param {string} newStatus - 'approved' or 'rejected'
   */
  async notifyStatusChange(io, booking, newStatus) {
    let title = 'Pembaruan Status Booking';
    let message = `Status booking Anda untuk ${shipRef(booking)} telah diperbarui.`;

    if (newStatus === 'approved') {
      title = 'Booking Disetujui';
      message = `Booking Anda untuk ${shipRef(booking)} telah disetujui.`;
    } else if (newStatus === 'rejected') {
      title = 'Booking Ditolak';
      message = `Booking Anda untuk ${shipRef(booking)} telah ditolak.`;
    } else if (newStatus === 'pending') {
      title = 'Booking Ditinjau Kembali';
      message = `Status booking Anda untuk ${shipRef(booking)} dikembalikan ke status pending (menunggu persetujuan).`;
    }
    
    const notification = await NotificationModel.create({
      id_user: booking.id_agen,
      user_type: 'agen',
      title,
      message,
    });

    // Emit realtime notification via Socket.io
    if (io) {
      broadcastNotification(io, booking.id_agen, 'agen', notification);
    }

    return notification;
  },

  /**
   * Notify affected agents about a delay cascade from an extend time operation.
   * Each affected booking's agent receives a notification.
   *
   * @param {import('socket.io').Server|null} io - Socket.io server instance
   * @param {object[]} affectedBookings - Array of bookings affected by the delay
   */
  async notifyDelayCascade(io, affectedBookings) {
    const title = 'Pemberitahuan Delay Cascade';
    const notifications = [];

    for (const booking of affectedBookings) {
      const message = `Booking Anda untuk ${shipRef(booking)} terdampak perpanjangan waktu kapal lain di posisi yang sama.`;

      const notification = await NotificationModel.create({
        id_user: booking.id_agen,
        user_type: 'agen',
        title,
        message,
      });
      notifications.push(notification);

      // Emit realtime notification via Socket.io
      if (io) {
        broadcastNotification(io, booking.id_agen, 'agen', notification);
      }
    }

    return notifications;
  },
  /**
   * Notify the submitting agent about a booking revision by officer/admin.
   *
   * @param {import('socket.io').Server|null} io - Socket.io server instance
   * @param {object} booking - The booking that was revised
   */
  async notifyRevision(io, booking) {
    const title = 'Booking Direvisi';
    const message = `Booking Anda untuk ${shipRef(booking)} telah direvisi oleh petugas. Silakan periksa perubahan data.`;

    const notification = await NotificationModel.create({
      id_user: booking.id_agen,
      user_type: 'agen',
      title,
      message,
    });

    if (io) {
      broadcastNotification(io, booking.id_agen, 'agen', notification);
    }

    return notification;
  },

  /**
   * Notify all petugas/admin about an extend time request from an agent.
   *
   * @param {import('socket.io').Server|null} io - Socket.io server instance
   * @param {object} booking - The booking requesting extension
   * @param {string} [agentName] - Name of the requesting agent
   */
  async notifyExtendRequest(io, booking, agentName) {
    const result = await pool.query(
      `SELECT id_petugas, user_role FROM master_petugas`
    );
    const officers = result.rows;

    const title = 'Permintaan Perpanjangan Waktu';
    const message = agentName
      ? `${agentName} mengajukan perpanjangan waktu untuk ${shipRef(booking)}.`
      : `Permintaan perpanjangan waktu untuk ${shipRef(booking)} menunggu persetujuan.`;

    const notifications = [];
    for (const officer of officers) {
      const notification = await NotificationModel.create({
        id_user: officer.id_petugas,
        user_type: officer.user_role,
        title,
        message,
      });
      notifications.push(notification);

      if (io) {
        broadcastNotification(io, officer.id_petugas, officer.user_role, {
          ...notification,
          type: 'extend_request',
          booking_id: booking.id_booking,
        });
      }
    }

    return notifications;
  },

  /**
   * Notify the agent about extend request approval/rejection.
   *
   * @param {import('socket.io').Server|null} io - Socket.io server instance
   * @param {object} booking - The booking
   * @param {string} status - 'approved' or 'rejected'
   */
  async notifyExtendApproval(io, booking, status) {
    const statusLabel = status === 'approved' ? 'Disetujui' : 'Ditolak';
    const title = `Perpanjangan Waktu ${statusLabel}`;
    const message = status === 'approved'
      ? `Permintaan perpanjangan waktu booking Anda untuk ${shipRef(booking)} telah disetujui. ETD baru telah diperbarui.`
      : `Permintaan perpanjangan waktu booking Anda untuk ${shipRef(booking)} telah ditolak.`;

    const notification = await NotificationModel.create({
      id_user: booking.id_agen,
      user_type: 'agen',
      title,
      message,
    });

    if (io) {
      broadcastNotification(io, booking.id_agen, 'agen', {
        ...notification,
        type: 'extend_result',
        extend_status: status,
        booking_id: booking.id_booking,
      });
    }

    return notification;
  },
};

module.exports = NotificationService;
