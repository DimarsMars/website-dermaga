const pool = require('../config/db');
const { broadcastBerthingUpdate, broadcastNotification } = require('./socket.service');
const NotificationModel = require('../models/notification.model');
const { ActivityService, ACTIVITY_TYPES } = require('./activity.service');

/**
 * Booking Status Scheduler
 * 
 * Runs every 1 minute to automatically update booking statuses:
 * 1. Approved bookings where current time >= eta_in → status = 'active'
 * 2. Active bookings where current time >= etd_out → status = 'inactive', status_request = 'completed'
 * 3. Pending bookings where current time >= eta_in → status_request = 'rejected' (Auto-expire/reject unhandled requests)
 * 4. Notify agents 1 hour before departure for active bookings (extend time offer)
 * 
 * Broadcasts changes via Socket.io so all clients update in realtime.
 */

let intervalId = null;

/**
 * Check and update booking statuses based on current time.
 * @param {import('socket.io').Server|null} io - Socket.io server instance for broadcasting
 */
async function checkAndUpdateStatuses(io) {
  const now = new Date().toISOString();

  try {
    // 1. Activate bookings: approved + eta_in has passed + still inactive
    const activateResult = await pool.query(
      `UPDATE trx_booking
       SET status = 'active', updated_at = NOW()
       WHERE status_request = 'approved'
         AND status = 'inactive'
         AND eta_in <= $1
         AND etd_out > $1
       RETURNING *`,
      [now]
    );

    // Broadcast each activated booking
    if (activateResult.rows.length > 0 && io) {
      for (const booking of activateResult.rows) {
        // Re-fetch with JOIN for complete data
        const fullResult = await pool.query(
          `SELECT tb.*, mk.nama_kapal, mk.loa, ma.agency_name
           FROM trx_booking tb
           JOIN master_kapal mk ON tb.id_kapal = mk.id_kapal
           LEFT JOIN master_agen ma ON tb.id_agen = ma.id_agen
           WHERE tb.id_booking = $1`,
          [booking.id_booking]
        );
        if (fullResult.rows[0]) {
          broadcastBerthingUpdate(io, 'status_updated', fullResult.rows[0]);
        }
      }
      console.log(`[Scheduler] Activated ${activateResult.rows.length} booking(s)`);
    }

    // 2. Complete bookings: etd_out has passed + currently active or approved
    const completeResult = await pool.query(
      `UPDATE trx_booking
       SET status = 'inactive', status_request = 'completed', updated_at = NOW()
       WHERE status_request IN ('approved')
         AND etd_out <= $1
       RETURNING *`,
      [now]
    );

    // Broadcast each completed booking
    if (completeResult.rows.length > 0 && io) {
      for (const booking of completeResult.rows) {
        const fullResult = await pool.query(
          `SELECT tb.*, mk.nama_kapal, mk.loa, ma.agency_name
           FROM trx_booking tb
           JOIN master_kapal mk ON tb.id_kapal = mk.id_kapal
           LEFT JOIN master_agen ma ON tb.id_agen = ma.id_agen
           WHERE tb.id_booking = $1`,
          [booking.id_booking]
        );
        if (fullResult.rows[0]) {
          broadcastBerthingUpdate(io, 'status_updated', fullResult.rows[0]);
        }
      }
      console.log(`[Scheduler] Completed ${completeResult.rows.length} booking(s)`);
    }

    // 3. Auto-reject/expire pending bookings: eta_in has passed but never approved/rejected
    const expireResult = await pool.query(
      `UPDATE trx_booking
       SET status_request = 'rejected', updated_at = NOW()
       WHERE status_request = 'pending'
         AND eta_in <= $1
       RETURNING *`,
      [now]
    );

    // Broadcast each expired booking
    if (expireResult.rows.length > 0 && io) {
      for (const booking of expireResult.rows) {
        const fullResult = await pool.query(
          `SELECT tb.*, mk.nama_kapal, mk.loa, ma.agency_name
           FROM trx_booking tb
           JOIN master_kapal mk ON tb.id_kapal = mk.id_kapal
           LEFT JOIN master_agen ma ON tb.id_agen = ma.id_agen
           WHERE tb.id_booking = $1`,
          [booking.id_booking]
        );
        if (fullResult.rows[0]) {
          const b = fullResult.rows[0];
          broadcastBerthingUpdate(io, 'rejected', b);

          // Notifikasi ke agen
          NotificationModel.create({
            id_user: b.id_agen,
            user_type: 'agen',
            title: 'Booking Ditolak Otomatis',
            message: `Booking Anda untuk kapal ${b.nama_kapal} ditolak secara otomatis karena jadwal kedatangan (ETA) sudah terlewat sebelum diproses.`,
            related_booking_id: b.id_booking,
          }).then(notification => {
            broadcastNotification(io, b.id_agen, 'agen', notification);
          }).catch(console.error);
        }
      }
      console.log(`[Scheduler] Auto-rejected ${expireResult.rows.length} expired pending booking(s)`);
    }

    // 3. Notify agents 1 hour before departure for active bookings (extend time offer)
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const warningResult = await pool.query(
      `SELECT tb.*, mk.nama_kapal, ma.agency_name
       FROM trx_booking tb
       JOIN master_kapal mk ON tb.id_kapal = mk.id_kapal
       LEFT JOIN master_agen ma ON tb.id_agen = ma.id_agen
       WHERE tb.status_request = 'approved'
         AND tb.status = 'active'
         AND tb.etd_out > $1
         AND tb.etd_out <= $2
         AND NOT EXISTS (
           SELECT 1 FROM notifikasi n
           WHERE n.title = 'Waktu Booking Hampir Habis'
             AND n.user_type = 'agen'
             AND n.id_user = tb.id_agen
             AND n.message LIKE '%' || mk.nama_kapal || '%'
             AND n.created_at > tb.eta_in
         )`,
      [now, oneHourFromNow]
    );

    if (warningResult.rows.length > 0) {
      for (const booking of warningResult.rows) {
        const title = 'Waktu Booking Hampir Habis';
        const message = `Waktu booking Anda untuk kapal ${booking.nama_kapal} akan habis dalam 1 jam. Apakah ingin memperpanjang?`;

        // Create notification in database
        const notification = await NotificationModel.create({
          id_user: booking.id_agen,
          user_type: 'agen',
          title,
          message,
          related_booking_id: booking.id_booking,
        });

        // Broadcast to the agent via socket with extend_offer type
        if (io) {
          broadcastNotification(io, booking.id_agen, 'agen', {
            ...notification,
            type: 'extend_offer',
            booking_id: booking.id_booking,
            nama_kapal: booking.nama_kapal,
            etd_out: booking.etd_out,
          });
        }
      }
      console.log(`[Scheduler] Sent ${warningResult.rows.length} extend time warning(s)`);
    }
  } catch (err) {
    console.error('[Scheduler] Error updating booking statuses:', err.message);
  }
}

/**
 * Start the booking status scheduler.
 * Runs checkAndUpdateStatuses every 60 seconds.
 * @param {import('socket.io').Server|null} io - Socket.io server instance
 */
function startScheduler(io) {
  // Run immediately on start
  checkAndUpdateStatuses(io);

  // Then run every 60 seconds
  intervalId = setInterval(() => {
    checkAndUpdateStatuses(io);
  }, 60 * 1000);

  console.log('[Scheduler] Booking status scheduler started (interval: 60s)');
}

/**
 * Stop the scheduler.
 */
function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Scheduler] Booking status scheduler stopped');
  }
}

module.exports = { startScheduler, stopScheduler, checkAndUpdateStatuses };
