const express = require('express');
const Joi = require('joi');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// ============================================================
// Joi Validation Schemas
// ============================================================

const bookingSchema = Joi.object({
  id_kapal: Joi.number().integer().positive().required(),
  pos_start: Joi.number().min(0).required(),
  eta_in: Joi.string().isoDate().required(),
  etd_out: Joi.string().isoDate().required(),
  pbm: Joi.string().allow('', null).optional(),
  keterangan: Joi.string().allow('', null).optional(),
});

const manualBookingSchema = Joi.object({
  id_kapal: Joi.number().integer().positive().required(),
  id_agen: Joi.number().integer().positive().required(),
  pos_start: Joi.number().min(0).required(),
  eta_in: Joi.string().isoDate().required(),
  etd_out: Joi.string().isoDate().required(),
  pbm: Joi.string().allow('', null).optional(),
  keterangan: Joi.string().allow('', null).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  status_request: Joi.string().valid('pending', 'approved', 'rejected', 'completed').optional(),
});

// ============================================================
// Joi Validation Middleware
// ============================================================

/**
 * Creates a validation middleware for the given Joi schema.
 * Returns 422 VALIDATION_FIELDS on invalid input.
 */
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_FIELDS',
          message: 'Missing or invalid fields',
          details,
        },
      });
    }
    next();
  };
}

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/bookings
 * List bookings (filtered by role).
 */
router.get(
  '/',
  authenticateToken,
  authorize('agen', 'petugas', 'admin'),
  bookingController.getBookings
);

/**
 * GET /api/bookings/export/pdf
 * Export booking history as PDF (filtered by date and role).
 */
router.get(
  '/export/pdf',
  authenticateToken,
  authorize('agen', 'petugas', 'admin'),
  bookingController.exportPDF
);

/**
 * GET /api/bookings/:id
 * Get a single booking.
 */
router.get(
  '/:id',
  authenticateToken,
  authorize('agen', 'petugas', 'admin'),
  bookingController.getBookingById
);

/**
 * POST /api/bookings
 * Submit pre-booking (Agent only) → status "Pending".
 */
router.post(
  '/',
  authenticateToken,
  authorize('agen'),
  validate(bookingSchema),
  bookingController.submitBooking
);

/**
 * POST /api/bookings/manual
 * Manual entry (Officer/Admin) → status "Approved".
 */
router.post(
  '/manual',
  authenticateToken,
  authorize('petugas', 'admin'),
  validate(manualBookingSchema),
  bookingController.manualBooking
);

/**
 * PUT /api/bookings/:id
 * Full update of a booking (Officer/Admin only).
 */
router.put(
  '/:id',
  authenticateToken,
  authorize('petugas', 'admin'),
  validate(manualBookingSchema),
  bookingController.updateBooking
);

/**
 * PUT /api/bookings/:id/approve
 * Approve a pending booking (Officer/Admin only).
 */
router.put(
  '/:id/approve',
  authenticateToken,
  authorize('petugas', 'admin'),
  bookingController.approveBooking
);

/**
 * PUT /api/bookings/:id/reject
 * Reject a pending booking (Officer/Admin only).
 */
router.put(
  '/:id/reject',
  authenticateToken,
  authorize('petugas', 'admin'),
  bookingController.rejectBooking
);

/**
 * PUT /api/bookings/:id/position
 * Edit position of a pending booking (Officer/Admin only).
 */
router.put(
  '/:id/position',
  authenticateToken,
  authorize('petugas', 'admin'),
  bookingController.editPosition
);

/**
 * POST /api/bookings/:id/extend
 * Request extend time (Agent only).
 */
router.post(
  '/:id/extend',
  authenticateToken,
  authorize('agen'),
  bookingController.extendBooking
);

/**
 * PUT /api/bookings/:id/extend/approve
 * Approve extend time request (Officer/Admin only).
 */
router.put(
  '/:id/extend/approve',
  authenticateToken,
  authorize('petugas', 'admin'),
  bookingController.approveExtend
);

/**
 * PUT /api/bookings/:id/extend/reject
 * Reject extend time request (Officer/Admin only).
 */
router.put(
  '/:id/extend/reject',
  authenticateToken,
  authorize('petugas', 'admin'),
  bookingController.rejectExtend
);

/**
 * DELETE /api/bookings/:id
 * Delete a booking (Admin/Officer only).
 */
router.delete(
  '/:id',
  authenticateToken,
  authorize('petugas', 'admin'),
  bookingController.deleteBooking
);

module.exports = router;
