const pool = require('../config/db');
const { CLEARANCE } = require('../utils/constants');
const { validateCapacity, validateBooking } = require('./validation.service');
const BookingModel = require('../models/booking.model');
const ShipModel = require('../models/ship.model');

/**
 * Booking service orchestrating validation and persistence.
 */
const BookingService = {
  /**
   * Submit a new booking (agent or manual entry).
   * Orchestrates: ship lookup → capacity check → overlap validation → insert.
   *
   * @param {object} data - Booking submission data
   * @param {number} data.id_kapal - Ship ID
   * @param {number} data.id_agen - Agent ID
   * @param {number} data.pos_start - Starting meter position
   * @param {string} data.eta_in - ISO 8601 arrival datetime
   * @param {string} data.etd_out - ISO 8601 departure datetime
   * @param {string} [data.pbm] - Optional PBM
   * @param {string} [data.keterangan] - Optional notes
   * @param {string} data.status_request - 'pending' or 'approved'
   * @returns {{ success: boolean, booking?: object, error?: object }}
   */
  async createBooking(data) {
    const { id_kapal, id_agen, pos_start, eta_in, etd_out, pbm, keterangan, status_request } = data;

    // Step 0: Validate that booking time is not in the past
    const now = new Date();
    if (new Date(eta_in) < now) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FIELDS',
          message: 'Waktu kedatangan (ETA/IN) tidak boleh di waktu yang sudah lewat',
          status: 422,
        },
      };
    }

    // Step 1: Look up ship to get LOA
    const ship = await ShipModel.findById(id_kapal);
    if (!ship) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ship not found',
          status: 404,
        },
      };
    }

    const loa = parseFloat(ship.loa);

    // Step 2: Calculate POS_END = POS_START + LOA + CLEARANCE
    const capacityResult = validateCapacity(pos_start, loa, CLEARANCE);
    if (!capacityResult.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_CAPACITY',
          message: capacityResult.error,
          status: 422,
        },
      };
    }

    const pos_end = capacityResult.posEnd;

    // Step 3: Run full validation within a transaction (capacity + overlap)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const newBooking = { pos_start, pos_end, eta_in, etd_out };
      const validationResult = await validateBooking(client, newBooking, null);

      if (!validationResult.valid) {
        await client.query('ROLLBACK');

        if (validationResult.conflicts && validationResult.conflicts.length > 0) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_CONFLICT',
              message: 'Spatial and temporal overlap detected',
              status: 409,
              details: { conflicts: validationResult.conflicts },
            },
          };
        }

        return {
          success: false,
          error: {
            code: 'VALIDATION_CAPACITY',
            message: validationResult.errors[0]?.message || 'Capacity validation failed',
            status: 422,
          },
        };
      }

      // Step 4: Insert booking
      const booking = await BookingModel.create(
        { id_kapal, id_agen, pos_start, pos_end, eta_in, etd_out, pbm, keterangan, status_request },
        client
      );

      await client.query('COMMIT');

      // Re-fetch with JOIN to get nama_kapal, loa, agency_name for broadcast
      const fullBooking = await BookingModel.findById(booking.id_booking);

      return { success: true, booking: fullBooking || booking };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Get all bookings, filtered by agent if applicable.
   * @param {number|null} agentId - Agent ID for filtering (null for all)
   * @returns {Array} List of bookings
   */
  async getBookings(agentId = null) {
    return BookingModel.findAll(agentId);
  },

  /**
   * Get a single booking by ID.
   * @param {number} id - Booking ID
   * @returns {object|null} Booking or null
   */
  async getBookingById(id) {
    return BookingModel.findById(id);
  },

  /**
   * Approve a pending booking.
   * Only bookings with status "pending" can be approved.
   *
   * @param {number} id - Booking ID
   * @returns {{ success: boolean, booking?: object, error?: object }}
   */
  async approveBooking(id) {
    const booking = await BookingModel.findById(id);
    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found', status: 404 },
      };
    }
    if (booking.status_request !== 'pending') {
      return {
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Only pending bookings can be approved', status: 422 },
      };
    }

    // Run overlap validation before approving
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const newBooking = {
        pos_start: parseFloat(booking.pos_start),
        pos_end: parseFloat(booking.pos_end),
        eta_in: booking.eta_in,
        etd_out: booking.etd_out,
      };
      const validationResult = await validateBooking(client, newBooking, id);

      if (!validationResult.valid) {
        await client.query('ROLLBACK');
        if (validationResult.conflicts && validationResult.conflicts.length > 0) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_CONFLICT',
              message: 'Spatial and temporal overlap detected with approved bookings',
              status: 409,
              details: { conflicts: validationResult.conflicts },
            },
          };
        }
        return {
          success: false,
          error: {
            code: 'VALIDATION_CAPACITY',
            message: validationResult.errors[0]?.message || 'Validation failed',
            status: 422,
          },
        };
      }

      const updated = await BookingModel.updateStatus(id, 'approved', client);
      await client.query('COMMIT');

      // Re-fetch with ship join for complete data
      const result = await BookingModel.findById(id);
      return { success: true, booking: result };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Reject a pending booking.
   * Only bookings with status "pending" can be rejected.
   *
   * @param {number} id - Booking ID
   * @returns {{ success: boolean, booking?: object, error?: object }}
   */
  async rejectBooking(id) {
    const booking = await BookingModel.findById(id);
    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found', status: 404 },
      };
    }
    if (booking.status_request !== 'pending') {
      return {
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Only pending bookings can be rejected', status: 422 },
      };
    }

    await BookingModel.updateStatus(id, 'rejected');
    const result = await BookingModel.findById(id);
    return { success: true, booking: result };
  },

  /**
   * Request extension of the departure time for an approved booking.
   * Saves as "pending_extend" for petugas/admin approval.
   *
   * @param {number} id - Booking ID
   * @param {string} newEtdOut - New departure datetime (ISO 8601)
   * @returns {{ success: boolean, booking?: object, error?: object }}
   */
  async extendBooking(id, newEtdOut) {
    const booking = await BookingModel.findById(id);
    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found', status: 404 },
      };
    }
    if (booking.status_request !== 'approved') {
      return {
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Only approved bookings can be extended', status: 422 },
      };
    }

    const newEtdDate = new Date(newEtdOut);
    const currentEtdDate = new Date(booking.etd_out);
    const now = new Date();

    // Validate that new ETD is not in the past
    if (newEtdDate < now) {
      return {
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'New departure time cannot be in the past', status: 422 },
      };
    }

    // Validate that new ETD is after current ETD
    if (newEtdDate <= currentEtdDate) {
      return {
        success: false,
        error: { code: 'VALIDATION_FIELDS', message: 'New departure time must be after current departure time', status: 422 },
      };
    }

    // Check for temporal overlap with the extended time
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const extendedBooking = {
        pos_start: parseFloat(booking.pos_start),
        pos_end: parseFloat(booking.pos_end),
        eta_in: booking.eta_in,
        etd_out: newEtdOut,
      };
      const validationResult = await validateBooking(client, extendedBooking, id);

      if (!validationResult.valid && validationResult.conflicts && validationResult.conflicts.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: {
            code: 'VALIDATION_CONFLICT',
            message: 'Extension causes overlap with subsequent bookings',
            status: 409,
            details: { conflicts: validationResult.conflicts },
          },
        };
      }

      // Save as pending extend (store requested new_etd_out in keterangan field as JSON metadata)
      await client.query(
        `UPDATE trx_booking
         SET extend_status = 'pending', extend_etd_out = $1, updated_at = NOW()
         WHERE id_booking = $2`,
        [newEtdOut, id]
      );
      await client.query('COMMIT');

      const result = await BookingModel.findById(id);
      return { success: true, booking: result };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Approve an extend time request (Officer/Admin).
   * Updates etd_out to the requested new time.
   *
   * @param {number} id - Booking ID
   * @returns {{ success: boolean, booking?: object, error?: object }}
   */
  async approveExtend(id) {
    const booking = await BookingModel.findById(id);
    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found', status: 404 },
      };
    }
    if (booking.extend_status !== 'pending') {
      return {
        success: false,
        error: { code: 'INVALID_STATUS', message: 'No pending extend request for this booking', status: 422 },
      };
    }

    const newEtdOut = booking.extend_etd_out;

    // Re-validate overlap before approving
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const extendedBooking = {
        pos_start: parseFloat(booking.pos_start),
        pos_end: parseFloat(booking.pos_end),
        eta_in: booking.eta_in,
        etd_out: newEtdOut,
      };
      const validationResult = await validateBooking(client, extendedBooking, id);

      if (!validationResult.valid && validationResult.conflicts && validationResult.conflicts.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: {
            code: 'VALIDATION_CONFLICT',
            message: 'Extension causes overlap with subsequent bookings',
            status: 409,
            details: { conflicts: validationResult.conflicts },
          },
        };
      }

      // Apply the extension: update etd_out and clear extend fields
      await client.query(
        `UPDATE trx_booking
         SET etd_out = $1, extend_status = 'approved', updated_at = NOW()
         WHERE id_booking = $2`,
        [newEtdOut, id]
      );
      await client.query('COMMIT');

      const result = await BookingModel.findById(id);
      return { success: true, booking: result };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Reject an extend time request (Officer/Admin).
   *
   * @param {number} id - Booking ID
   * @returns {{ success: boolean, booking?: object, error?: object }}
   */
  async rejectExtend(id) {
    const booking = await BookingModel.findById(id);
    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found', status: 404 },
      };
    }
    if (booking.extend_status !== 'pending') {
      return {
        success: false,
        error: { code: 'INVALID_STATUS', message: 'No pending extend request for this booking', status: 422 },
      };
    }

    await pool.query(
      `UPDATE trx_booking
       SET extend_status = 'rejected', extend_etd_out = NULL, updated_at = NOW()
       WHERE id_booking = $1`,
      [id]
    );

    const result = await BookingModel.findById(id);
    return { success: true, booking: result };
  },

  /**
   * Full update of a booking (Officer/Admin).
   * Validates capacity and overlap before updating.
   *
   * @param {number} id - Booking ID
   * @param {object} data - Updated booking data
   * @returns {{ success: boolean, booking?: object, error?: object }}
   */
  async updateBooking(id, data) {
    const { id_kapal, id_agen, pos_start, eta_in, etd_out, pbm, keterangan, status, status_request } = data;

    const booking = await BookingModel.findById(id);
    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found', status: 404 },
      };
    }

    // Look up ship to get LOA
    const ship = await ShipModel.findById(id_kapal);
    if (!ship) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Ship not found', status: 404 },
      };
    }

    const loa = parseFloat(ship.loa);

    // Validate capacity
    const capacityResult = validateCapacity(pos_start, loa, CLEARANCE);
    if (!capacityResult.valid) {
      return {
        success: false,
        error: { code: 'VALIDATION_CAPACITY', message: capacityResult.error, status: 422 },
      };
    }

    const pos_end = capacityResult.posEnd;

    // Validate overlap (excluding current booking)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updatedBooking = { pos_start, pos_end, eta_in, etd_out };
      const validationResult = await validateBooking(client, updatedBooking, id);

      if (!validationResult.valid) {
        await client.query('ROLLBACK');
        if (validationResult.conflicts && validationResult.conflicts.length > 0) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_CONFLICT',
              message: 'Spatial and temporal overlap detected',
              status: 409,
              details: { conflicts: validationResult.conflicts },
            },
          };
        }
        return {
          success: false,
          error: {
            code: 'VALIDATION_CAPACITY',
            message: validationResult.errors[0]?.message || 'Validation failed',
            status: 422,
          },
        };
      }

      await BookingModel.updateFull(id, { id_kapal, id_agen, pos_start, pos_end, eta_in, etd_out, pbm, keterangan, status, status_request }, client);
      await client.query('COMMIT');

      const result = await BookingModel.findById(id);
      return { success: true, booking: result };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Edit the position of a pending booking.
   * Only bookings with status "pending" can have their position edited.
   *
   * @param {number} id - Booking ID
   * @param {number} newPosStart - New starting meter position
   * @returns {{ success: boolean, booking?: object, error?: object }}
   */
  async editPosition(id, newPosStart) {
    const booking = await BookingModel.findById(id);
    if (!booking) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found', status: 404 },
      };
    }
    if (booking.status_request !== 'pending') {
      return {
        success: false,
        error: { code: 'INVALID_STATUS', message: 'Only pending bookings can have position edited', status: 422 },
      };
    }

    const loa = parseFloat(booking.loa);

    // Validate capacity with new position
    const capacityResult = validateCapacity(newPosStart, loa, CLEARANCE);
    if (!capacityResult.valid) {
      return {
        success: false,
        error: { code: 'VALIDATION_CAPACITY', message: capacityResult.error, status: 422 },
      };
    }

    const newPosEnd = capacityResult.posEnd;

    // Validate overlap with new position
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updatedBooking = {
        pos_start: newPosStart,
        pos_end: newPosEnd,
        eta_in: booking.eta_in,
        etd_out: booking.etd_out,
      };
      const validationResult = await validateBooking(client, updatedBooking, id);

      if (!validationResult.valid && validationResult.conflicts && validationResult.conflicts.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: {
            code: 'VALIDATION_CONFLICT',
            message: 'New position causes overlap with approved bookings',
            status: 409,
            details: { conflicts: validationResult.conflicts },
          },
        };
      }

      await BookingModel.updatePosition(id, newPosStart, newPosEnd, client);
      await client.query('COMMIT');

      const result = await BookingModel.findById(id);
      return { success: true, booking: result };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = BookingService;
