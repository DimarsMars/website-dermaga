const { MAX_LENGTH, CLEARANCE } = require('../utils/constants');

/**
 * Layer 1: Capacity Validation
 * Checks that the booking fits within the dock's physical constraints.
 *
 * @param {number} posStart - Starting position in meters (>= 0)
 * @param {number} loa - Length Overall of the ship in meters
 * @param {number} clearance - Safety buffer distance in meters
 * @returns {{ valid: boolean, posEnd?: number, error?: string }}
 */
function validateCapacity(posStart, loa, clearance) {
  if (posStart < 0) {
    return { valid: false, error: 'POS_START cannot be negative' };
  }
  const posEnd = posStart + loa + clearance;
  if (posEnd > MAX_LENGTH) {
    return { valid: false, error: 'POS_END exceeds dock capacity (500m)' };
  }
  return { valid: true, posEnd };
}

/**
 * Layer 2: Spatial + Temporal Overlap Detection
 * Detects conflicts between a new booking and existing approved bookings.
 * A conflict exists when both spatial AND temporal overlap occur simultaneously.
 *
 * @param {{ pos_start: number, pos_end: number, eta_in: Date|string, etd_out: Date|string }} newBooking
 * @param {Array<{ id_booking: number, pos_start: number, pos_end: number, eta_in: Date|string, etd_out: Date|string, nama_kapal?: string }>} existingApprovedBookings
 * @returns {Array} List of conflicting bookings
 */
function detectOverlap(newBooking, existingApprovedBookings) {
  const conflicts = [];
  for (const existing of existingApprovedBookings) {
    const spatialOverlap = newBooking.pos_start < existing.pos_end
                        && newBooking.pos_end > existing.pos_start;
    const temporalOverlap = new Date(newBooking.eta_in) < new Date(existing.etd_out)
                         && new Date(newBooking.etd_out) > new Date(existing.eta_in);
    if (spatialOverlap && temporalOverlap) {
      conflicts.push(existing);
    }
  }
  return conflicts;
}

/**
 * Full booking validation with database query and row-level locking.
 * Runs both Layer 1 (capacity) and Layer 2 (overlap) checks.
 *
 * @param {object} client - pg pool client (for transaction support)
 * @param {{ pos_start: number, pos_end: number, eta_in: Date|string, etd_out: Date|string }} newBooking
 * @param {number|null} excludeBookingId - Booking ID to exclude from conflict check (for edits)
 * @returns {{ valid: boolean, errors?: Array<{ field: string, message: string }>, conflicts?: Array }}
 */
async function validateBooking(client, newBooking, excludeBookingId = null) {
  const errors = [];

  // Layer 1: Capacity check (pos_start and pos_end are already calculated)
  if (newBooking.pos_start < 0) {
    errors.push({ field: 'pos_start', message: 'POS_START cannot be negative' });
  }
  if (newBooking.pos_end > MAX_LENGTH) {
    errors.push({ field: 'pos_end', message: 'POS_END exceeds dock capacity (500m)' });
  }

  if (errors.length > 0) {
    return { valid: false, errors, conflicts: [] };
  }

  // Layer 2: Spatial + Temporal overlap detection with row-level locking
  const excludeId = excludeBookingId || 0;
  const query = `
    SELECT tb.id_booking, tb.id_kapal, tb.pos_start, tb.pos_end, tb.eta_in, tb.etd_out, mk.nama_kapal
    FROM trx_booking tb
    JOIN master_kapal mk ON tb.id_kapal = mk.id_kapal
    WHERE tb.status_request = 'approved'
      AND tb.eta_in < $1
      AND tb.etd_out > $2
      AND tb.id_booking != $3
    FOR UPDATE
  `;

  const result = await client.query(query, [
    newBooking.etd_out,
    newBooking.eta_in,
    excludeId,
  ]);

  const approvedBookings = result.rows;
  const conflicts = detectOverlap(newBooking, approvedBookings);

  if (conflicts.length > 0) {
    return { valid: false, errors: [], conflicts };
  }

  return { valid: true, errors: [], conflicts: [] };
}

module.exports = {
  validateCapacity,
  detectOverlap,
  validateBooking,
};
