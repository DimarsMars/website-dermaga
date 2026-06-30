const BookingService = require('../services/booking.service');
const pool = require('../config/db');
const { broadcastBerthingUpdate } = require('../services/socket.service');
const { generateBookingPDF } = require('../utils/pdf');
const NotificationService = require('../services/notification.service');
const { ActivityService, ACTIVITY_TYPES } = require('../services/activity.service');

/**
 * Booking controller handling HTTP request/response for booking operations.
 */
const bookingController = {
  /**
   * POST /api/bookings
   * Submit a pre-booking (Agent only). Status is set to "Pending".
   */
  async submitBooking(req, res) {
    try {
      const { id_kapal, pos_start, eta_in, etd_out, pbm, keterangan } = req.body;
      const id_agen = req.user.id;

      const result = await BookingService.createBooking({
        id_kapal,
        id_agen,
        pos_start,
        eta_in,
        etd_out,
        pbm,
        keterangan,
        status_request: 'pending',
      });

      if (!result.success) {
        const { code, message, status, details } = result.error;
        return res.status(status).json({
          success: false,
          error: { code, message, ...(details && { details }) },
        });
      }

      // Broadcast the new booking to all connected clients
      const io = req.app.get('io');
      if (io) {
        broadcastBerthingUpdate(io, 'created', result.booking);
      }

      // Notify all petugas/admin about new booking
      const agentName = req.user.username || null;
      NotificationService.notifyNewBooking(req.app.get('io'), result.booking, agentName).catch(err => {
        console.error('Error sending new booking notification:', err);
      });

      // Log activity
      ActivityService.logActivity(req.user.id, req.user.role, ACTIVITY_TYPES.BOOKING_CREATED,
        `Booking baru dibuat untuk kapal ${result.booking.nama_kapal || '-'} oleh ${req.user.username}`
      ).catch(err => console.error('Error logging activity:', err));

      return res.status(201).json({
        success: true,
        data: result.booking,
      });
    } catch (err) {
      console.error('Error submitting booking:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * POST /api/bookings/manual
   * Manual booking entry (Officer/Admin). Status is set to "Approved".
   */
  async manualBooking(req, res) {
    try {
      const { id_kapal, id_agen, pos_start, eta_in, etd_out, pbm, keterangan } = req.body;

      const result = await BookingService.createBooking({
        id_kapal,
        id_agen,
        pos_start,
        eta_in,
        etd_out,
        pbm,
        keterangan,
        status_request: 'approved',
      });

      if (!result.success) {
        const { code, message, status, details } = result.error;
        return res.status(status).json({
          success: false,
          error: { code, message, ...(details && { details }) },
        });
      }

      // Broadcast the new approved booking to all connected clients
      const io = req.app.get('io');
      if (io) {
        broadcastBerthingUpdate(io, 'created', result.booking);
      }

      // Notify the agent that their booking has been approved (manual entry)
      NotificationService.notifyStatusChange(io, result.booking, 'approved').catch(err => {
        console.error('Error sending manual booking approval notification:', err);
      });

      // Log activity
      ActivityService.logActivity(req.user.id, req.user.role, ACTIVITY_TYPES.BOOKING_APPROVED,
        `Booking manual dibuat & disetujui untuk kapal ${result.booking.nama_kapal || '-'} (agen #${id_agen}) oleh ${req.user.username}`
      ).catch(err => console.error('Error logging activity:', err));

      return res.status(201).json({
        success: true,
        data: result.booking,
      });
    } catch (err) {
      console.error('Error creating manual booking:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * GET /api/bookings
   * List bookings. All authenticated users can see all bookings (for berthing plan view).
   */
  async getBookings(req, res) {
    try {
      const bookings = await BookingService.getBookings(null);

      return res.status(200).json({
        success: true,
        data: bookings,
      });
    } catch (err) {
      console.error('Error fetching bookings:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * GET /api/bookings/:id
   * Get a single booking by ID.
   */
  async getBookingById(req, res) {
    try {
      const { id } = req.params;
      const booking = await BookingService.getBookingById(parseInt(id, 10));

      if (!booking) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Booking not found' },
        });
      }

      // Agents can only view their own bookings
      if (req.user.role === 'agen' && booking.id_agen !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied. Insufficient permissions.' },
        });
      }

      return res.status(200).json({
        success: true,
        data: booking,
      });
    } catch (err) {
      console.error('Error fetching booking:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * PUT /api/bookings/:id/approve
   * Approve a pending booking (Officer/Admin only).
   */
  async approveBooking(req, res) {
    try {
      const { id } = req.params;
      const result = await BookingService.approveBooking(parseInt(id, 10));

      if (!result.success) {
        const { code, message, status } = result.error;
        return res.status(status).json({
          success: false,
          error: { code, message },
        });
      }

      // Broadcast the approval to all connected clients
      const io = req.app.get('io');
      if (io) {
        broadcastBerthingUpdate(io, 'approved', result.booking);
      }

      // Notify the agent that their booking was approved
      NotificationService.notifyStatusChange(req.app.get('io'), result.booking, 'approved').catch(err => {
        console.error('Error sending approval notification:', err);
      });

      // Log activity
      ActivityService.logActivity(req.user.id, req.user.role, ACTIVITY_TYPES.BOOKING_APPROVED,
        `Booking #${result.booking.id_booking} disetujui oleh ${req.user.username}`
      ).catch(err => console.error('Error logging activity:', err));

      return res.status(200).json({
        success: true,
        data: result.booking,
      });
    } catch (err) {
      console.error('Error approving booking:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * PUT /api/bookings/:id/reject
   * Reject a pending booking (Officer/Admin only).
   */
  async rejectBooking(req, res) {
    try {
      const { id } = req.params;
      const result = await BookingService.rejectBooking(parseInt(id, 10));

      if (!result.success) {
        const { code, message, status } = result.error;
        return res.status(status).json({
          success: false,
          error: { code, message },
        });
      }

      // Broadcast the rejection to all connected clients
      const io = req.app.get('io');
      if (io) {
        broadcastBerthingUpdate(io, 'rejected', result.booking);
      }

      // Notify the agent that their booking was rejected
      NotificationService.notifyStatusChange(req.app.get('io'), result.booking, 'rejected').catch(err => {
        console.error('Error sending rejection notification:', err);
      });

      // Log activity
      ActivityService.logActivity(req.user.id, req.user.role, ACTIVITY_TYPES.BOOKING_REJECTED,
        `Booking #${result.booking.id_booking} ditolak oleh ${req.user.username}`
      ).catch(err => console.error('Error logging activity:', err));

      return res.status(200).json({
        success: true,
        data: result.booking,
      });
    } catch (err) {
      console.error('Error rejecting booking:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * POST /api/bookings/:id/extend
   * Request extend time for an approved booking (Agent only).
   * Saves as pending extend for petugas/admin approval.
   */
  async extendBooking(req, res) {
    try {
      const { id } = req.params;
      const { new_etd_out } = req.body;

      // Ownership check: agents may only extend their own bookings
      const booking = await BookingService.getBookingById(parseInt(id, 10));
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Booking not found' },
        });
      }
      if (req.user.role === 'agen' && booking.id_agen !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only extend your own booking' },
        });
      }

      const result = await BookingService.extendBooking(parseInt(id, 10), new_etd_out);

      if (!result.success) {
        const { code, message, status, details } = result.error;

        // If conflict detected, notify affected agents about delay cascade
        if (code === 'VALIDATION_CONFLICT' && details?.conflicts?.length > 0) {
          NotificationService.notifyDelayCascade(req.app.get('io'), details.conflicts).catch(err => {
            console.error('Error sending delay cascade notification:', err);
          });
        }

        return res.status(status).json({
          success: false,
          error: { code, message, ...(details && { details }) },
        });
      }

      // Notify petugas/admin about the extend request
      const io = req.app.get('io');
      NotificationService.notifyExtendRequest(io, result.booking, req.user.username).catch(err => {
        console.error('Error sending extend request notification:', err);
      });

      // Broadcast the pending extend to all connected clients
      if (io) {
        broadcastBerthingUpdate(io, 'extend_requested', result.booking);
      }

      // Log activity
      ActivityService.logActivity(req.user.id, req.user.role, ACTIVITY_TYPES.BOOKING_EXTENDED,
        `Permintaan perpanjangan Booking #${result.booking.id_booking} oleh ${req.user.username}`
      ).catch(err => console.error('Error logging activity:', err));

      return res.status(200).json({
        success: true,
        data: result.booking,
      });
    } catch (err) {
      console.error('Error extending booking:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * PUT /api/bookings/:id/extend/approve
   * Approve an extend time request (Officer/Admin only).
   */
  async approveExtend(req, res) {
    try {
      const { id } = req.params;
      const result = await BookingService.approveExtend(parseInt(id, 10));

      if (!result.success) {
        const { code, message, status, details } = result.error;
        return res.status(status).json({
          success: false,
          error: { code, message, ...(details && { details }) },
        });
      }

      // Broadcast the approved extension to all connected clients
      const io = req.app.get('io');
      if (io) {
        broadcastBerthingUpdate(io, 'extended', result.booking);
      }

      // Notify the agent that their extend request was approved
      NotificationService.notifyExtendApproval(io, result.booking, 'approved').catch(err => {
        console.error('Error sending extend approval notification:', err);
      });

      // Log activity
      ActivityService.logActivity(req.user.id, req.user.role, ACTIVITY_TYPES.BOOKING_EXTENDED,
        `Perpanjangan Booking #${result.booking.id_booking} disetujui oleh ${req.user.username}`
      ).catch(err => console.error('Error logging activity:', err));

      return res.status(200).json({
        success: true,
        data: result.booking,
      });
    } catch (err) {
      console.error('Error approving extend:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * PUT /api/bookings/:id/extend/reject
   * Reject an extend time request (Officer/Admin only).
   */
  async rejectExtend(req, res) {
    try {
      const { id } = req.params;
      const result = await BookingService.rejectExtend(parseInt(id, 10));

      if (!result.success) {
        const { code, message, status, details } = result.error;
        return res.status(status).json({
          success: false,
          error: { code, message, ...(details && { details }) },
        });
      }

      // Broadcast the rejection to all connected clients
      const io = req.app.get('io');
      if (io) {
        broadcastBerthingUpdate(io, 'extend_rejected', result.booking);
      }

      // Notify the agent that their extend request was rejected
      NotificationService.notifyExtendApproval(io, result.booking, 'rejected').catch(err => {
        console.error('Error sending extend rejection notification:', err);
      });

      return res.status(200).json({
        success: true,
        data: result.booking,
      });
    } catch (err) {
      console.error('Error rejecting extend:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * PUT /api/bookings/:id/position
   * Edit position of a pending booking (Officer/Admin only).
   */
  async editPosition(req, res) {
    try {
      const { id } = req.params;
      const { pos_start } = req.body;
      const result = await BookingService.editPosition(parseInt(id, 10), pos_start);

      if (!result.success) {
        const { code, message, status, details } = result.error;
        return res.status(status).json({
          success: false,
          error: { code, message, ...(details && { details }) },
        });
      }

      // Broadcast the position edit to all connected clients
      const io = req.app.get('io');
      if (io) {
        broadcastBerthingUpdate(io, 'position_edited', result.booking);
      }

      // Notify the agent that their booking position was revised
      NotificationService.notifyRevision(req.app.get('io'), result.booking).catch(err => {
        console.error('Error sending position revision notification:', err);
      });

      // Log activity
      ActivityService.logActivity(req.user.id, req.user.role, ACTIVITY_TYPES.POSITION_EDITED,
        `Posisi Booking #${result.booking.id_booking} direvisi oleh ${req.user.username}`
      ).catch(err => console.error('Error logging activity:', err));

      return res.status(200).json({
        success: true,
        data: result.booking,
      });
    } catch (err) {
      console.error('Error editing booking position:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },
  /**
   * PUT /api/bookings/:id
   * Full update of a booking (Officer/Admin only).
   */
  async updateBooking(req, res) {
    try {
      const { id } = req.params;
      const { id_kapal, id_agen, pos_start, eta_in, etd_out, pbm, keterangan, status, status_request } = req.body;

      const oldBooking = await BookingService.getBookingById(parseInt(id, 10));
      if (!oldBooking) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Booking not found' },
        });
      }

      const result = await BookingService.updateBooking(parseInt(id, 10), {
        id_kapal,
        id_agen,
        pos_start,
        eta_in,
        etd_out,
        pbm,
        keterangan,
        status,
        status_request,
      });

      if (!result.success) {
        const { code, message, status, details } = result.error;
        return res.status(status).json({
          success: false,
          error: { code, message, ...(details && { details }) },
        });
      }

      const io = req.app.get('io');
      if (io) {
        broadcastBerthingUpdate(io, 'updated', result.booking);
      }

      const isStatusChanged = oldBooking.status_request !== result.booking.status_request;
      
      const isOperationalChanged = 
        parseFloat(oldBooking.pos_start) !== parseFloat(result.booking.pos_start) ||
        new Date(oldBooking.eta_in).getTime() !== new Date(result.booking.eta_in).getTime() ||
        new Date(oldBooking.etd_out).getTime() !== new Date(result.booking.etd_out).getTime() ||
        oldBooking.id_kapal !== result.booking.id_kapal;

      // logika penembakan notifikasi Socket.io secara spesifik
      if (io) {
        // Jika ada perubahan status request (Pending -> Approved / Rejected)
        if (isStatusChanged) {
          NotificationService.notifyStatusChange(io, result.booking, result.booking.status_request).catch(err => {
            console.error('Error sending status change notification:', err);
          });
        }

        // Jika ada perubahan data operasional/koordinat fisik kapal
        if (isOperationalChanged) {
          NotificationService.notifyRevision(io, result.booking).catch(err => {
            console.error('Error sending revision notification:', err);
          });
        }
      }

      // LOG ACTIVITY SECARA DINAMIS SESUAI AKSI
      let activityType = ACTIVITY_TYPES.POSITION_EDITED;
      let activityDesc = `Booking #${result.booking.id_booking} direvisi oleh ${req.user.username}`;

      if (isStatusChanged && !isOperationalChanged) {
        if (result.booking.status_request === 'approved') {
          activityType = ACTIVITY_TYPES.BOOKING_APPROVED;
          activityDesc = `Booking #${result.booking.id_booking} disetujui oleh ${req.user.username}`;
        } else if (result.booking.status_request === 'rejected') {
          activityType = ACTIVITY_TYPES.BOOKING_REJECTED;
          activityDesc = `Booking #${result.booking.id_booking} ditolak oleh ${req.user.username}`;
        }
      }

      ActivityService.logActivity(req.user.id, req.user.role, activityType, activityDesc).catch(err => 
        console.error('Error logging activity:', err)
      );

      return res.status(200).json({
        success: true,
        data: result.booking,
      });
    } catch (err) {
      console.error('Error updating booking:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * DELETE /api/bookings/:id
   * Delete a booking (Admin/Officer only).
   */
  async deleteBooking(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('DELETE FROM trx_booking WHERE id_booking = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Booking not found' },
        });
      }

      return res.status(200).json({ success: true, message: 'Booking deleted successfully' });
    } catch (err) {
      console.error('Error deleting booking:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },

  /**
   * GET /api/bookings/export/pdf
   * Export booking history as PDF with optional date filters.
   * Query params: startDate, endDate
   */
  async exportPDF(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const agentId = req.user.role === 'agen' ? req.user.id : null;

      // Build query with date filters
      let query = `
        SELECT tb.*, mk.nama_kapal, mk.loa, mk.gt, ma.agency_name
        FROM trx_booking tb
        JOIN master_kapal mk ON tb.id_kapal = mk.id_kapal
        LEFT JOIN master_agen ma ON tb.id_agen = ma.id_agen
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (agentId) {
        query += ` AND tb.id_agen = $${paramIndex}`;
        params.push(agentId);
        paramIndex++;
      }

      if (startDate) {
        query += ` AND tb.eta_in >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND tb.eta_in <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ' ORDER BY tb.eta_in DESC';

      const result = await pool.query(query, params);
      const bookings = result.rows;

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="booking-history.pdf"'
      );

      const pdfStream = generateBookingPDF(bookings, {
        title: 'Laporan Riwayat Booking - Dermaga Timur',
        startDate,
        endDate,
      });

      pdfStream.pipe(res);
    } catch (err) {
      console.error('Error exporting booking PDF:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      });
    }
  },
};

module.exports = bookingController;
