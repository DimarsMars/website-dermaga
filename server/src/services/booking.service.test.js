/**
 * Property-Based Tests for Booking Status Workflow
 *
 * Property 7: Status Transition Validity
 * Property 10: Pending-Only Position Editability
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.5
 */

jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));
jest.mock('../models/booking.model');
jest.mock('../models/ship.model');
jest.mock('./validation.service', () => ({
  validateCapacity: jest.fn(),
  validateBooking: jest.fn(),
  detectOverlap: jest.fn(),
}));

const pool = require('../config/db');
const BookingModel = require('../models/booking.model');
const { validateCapacity, validateBooking } = require('./validation.service');
const BookingService = require('./booking.service');

describe('Property 7: Status Transition Validity', () => {
  /**
   * **Validates: Requirements 6.1, 6.2, 6.3**
   *
   * For any booking, the only valid status transitions SHALL be:
   * Pending → Approved and Pending → Rejected.
   * For any booking not in "Pending" status, approve and reject operations SHALL be rejected.
   */

  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
  });

  describe('approveBooking', () => {
    it('should succeed when booking status is pending', async () => {
      const pendingBooking = {
        id_booking: 1,
        status_request: 'pending',
        pos_start: '10',
        pos_end: '50',
        eta_in: '2025-01-01T00:00:00Z',
        etd_out: '2025-01-02T00:00:00Z',
      };

      BookingModel.findById.mockResolvedValueOnce(pendingBooking);
      mockClient.query.mockResolvedValue({ rows: [] });
      validateBooking.mockResolvedValue({ valid: true, errors: [], conflicts: [] });
      BookingModel.updateStatus.mockResolvedValue({ ...pendingBooking, status_request: 'approved' });
      BookingModel.findById.mockResolvedValueOnce({ ...pendingBooking, status_request: 'approved' });

      const result = await BookingService.approveBooking(1);

      expect(result.success).toBe(true);
      expect(result.booking.status_request).toBe('approved');
    });

    it('should fail when booking status is approved', async () => {
      const approvedBooking = {
        id_booking: 2,
        status_request: 'approved',
        pos_start: '10',
        pos_end: '50',
        eta_in: '2025-01-01T00:00:00Z',
        etd_out: '2025-01-02T00:00:00Z',
      };

      BookingModel.findById.mockResolvedValue(approvedBooking);

      const result = await BookingService.approveBooking(2);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_STATUS');
      expect(result.error.status).toBe(422);
    });

    it('should fail when booking status is rejected', async () => {
      const rejectedBooking = {
        id_booking: 3,
        status_request: 'rejected',
        pos_start: '10',
        pos_end: '50',
        eta_in: '2025-01-01T00:00:00Z',
        etd_out: '2025-01-02T00:00:00Z',
      };

      BookingModel.findById.mockResolvedValue(rejectedBooking);

      const result = await BookingService.approveBooking(3);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_STATUS');
      expect(result.error.status).toBe(422);
    });
  });

  describe('rejectBooking', () => {
    it('should succeed when booking status is pending', async () => {
      const pendingBooking = {
        id_booking: 4,
        status_request: 'pending',
        pos_start: '10',
        pos_end: '50',
        eta_in: '2025-01-01T00:00:00Z',
        etd_out: '2025-01-02T00:00:00Z',
      };

      BookingModel.findById.mockResolvedValueOnce(pendingBooking);
      BookingModel.updateStatus.mockResolvedValue({ ...pendingBooking, status_request: 'rejected' });
      BookingModel.findById.mockResolvedValueOnce({ ...pendingBooking, status_request: 'rejected' });

      const result = await BookingService.rejectBooking(4);

      expect(result.success).toBe(true);
      expect(result.booking.status_request).toBe('rejected');
    });

    it('should fail when booking status is approved', async () => {
      const approvedBooking = {
        id_booking: 5,
        status_request: 'approved',
        pos_start: '10',
        pos_end: '50',
        eta_in: '2025-01-01T00:00:00Z',
        etd_out: '2025-01-02T00:00:00Z',
      };

      BookingModel.findById.mockResolvedValue(approvedBooking);

      const result = await BookingService.rejectBooking(5);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_STATUS');
      expect(result.error.status).toBe(422);
    });

    it('should fail when booking status is rejected', async () => {
      const rejectedBooking = {
        id_booking: 6,
        status_request: 'rejected',
        pos_start: '10',
        pos_end: '50',
        eta_in: '2025-01-01T00:00:00Z',
        etd_out: '2025-01-02T00:00:00Z',
      };

      BookingModel.findById.mockResolvedValue(rejectedBooking);

      const result = await BookingService.rejectBooking(6);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_STATUS');
      expect(result.error.status).toBe(422);
    });
  });

  describe('property: non-pending bookings always reject approve/reject', () => {
    const nonPendingStatuses = ['approved', 'rejected'];

    nonPendingStatuses.forEach((status) => {
      it(`approveBooking rejects booking with status "${status}"`, async () => {
        const booking = {
          id_booking: 10,
          status_request: status,
          pos_start: '20',
          pos_end: '80',
          eta_in: '2025-03-01T00:00:00Z',
          etd_out: '2025-03-02T00:00:00Z',
        };

        BookingModel.findById.mockResolvedValue(booking);

        const result = await BookingService.approveBooking(10);

        expect(result.success).toBe(false);
        expect(result.error.code).toBe('INVALID_STATUS');
      });

      it(`rejectBooking rejects booking with status "${status}"`, async () => {
        const booking = {
          id_booking: 11,
          status_request: status,
          pos_start: '20',
          pos_end: '80',
          eta_in: '2025-03-01T00:00:00Z',
          etd_out: '2025-03-02T00:00:00Z',
        };

        BookingModel.findById.mockResolvedValue(booking);

        const result = await BookingService.rejectBooking(11);

        expect(result.success).toBe(false);
        expect(result.error.code).toBe('INVALID_STATUS');
      });
    });
  });
});

describe('Property 10: Pending-Only Position Editability', () => {
  /**
   * **Validates: Requirements 6.5**
   *
   * For any booking with status "Pending", Petugas_Operasional SHALL be able to edit the POS_START value.
   * For any booking with status other than "Pending", position editing SHALL be rejected.
   */

  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
  });

  it('should allow position edit when booking status is pending', async () => {
    const pendingBooking = {
      id_booking: 20,
      status_request: 'pending',
      pos_start: '10',
      pos_end: '60',
      loa: '45',
      eta_in: '2025-02-01T00:00:00Z',
      etd_out: '2025-02-02T00:00:00Z',
    };

    BookingModel.findById.mockResolvedValueOnce(pendingBooking);
    validateCapacity.mockReturnValue({ valid: true, posEnd: 80 });
    mockClient.query.mockResolvedValue({ rows: [] });
    validateBooking.mockResolvedValue({ valid: true, errors: [], conflicts: [] });
    BookingModel.updatePosition.mockResolvedValue({ ...pendingBooking, pos_start: '30', pos_end: '80' });
    BookingModel.findById.mockResolvedValueOnce({ ...pendingBooking, pos_start: '30', pos_end: '80' });

    const result = await BookingService.editPosition(20, 30);

    expect(result.success).toBe(true);
    expect(result.booking.pos_start).toBe('30');
    expect(result.booking.pos_end).toBe('80');
  });

  it('should reject position edit when booking status is approved', async () => {
    const approvedBooking = {
      id_booking: 21,
      status_request: 'approved',
      pos_start: '10',
      pos_end: '60',
      loa: '45',
      eta_in: '2025-02-01T00:00:00Z',
      etd_out: '2025-02-02T00:00:00Z',
    };

    BookingModel.findById.mockResolvedValue(approvedBooking);

    const result = await BookingService.editPosition(21, 30);

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_STATUS');
    expect(result.error.status).toBe(422);
  });

  it('should reject position edit when booking status is rejected', async () => {
    const rejectedBooking = {
      id_booking: 22,
      status_request: 'rejected',
      pos_start: '10',
      pos_end: '60',
      loa: '45',
      eta_in: '2025-02-01T00:00:00Z',
      etd_out: '2025-02-02T00:00:00Z',
    };

    BookingModel.findById.mockResolvedValue(rejectedBooking);

    const result = await BookingService.editPosition(22, 30);

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_STATUS');
    expect(result.error.status).toBe(422);
  });

  describe('property: only pending status allows position edit', () => {
    const allStatuses = ['pending', 'approved', 'rejected'];

    allStatuses.forEach((status) => {
      it(`editPosition ${status === 'pending' ? 'succeeds' : 'fails'} for status "${status}"`, async () => {
        const booking = {
          id_booking: 30,
          status_request: status,
          pos_start: '50',
          pos_end: '100',
          loa: '45',
          eta_in: '2025-04-01T00:00:00Z',
          etd_out: '2025-04-02T00:00:00Z',
        };

        BookingModel.findById.mockResolvedValueOnce(booking);

        if (status === 'pending') {
          validateCapacity.mockReturnValue({ valid: true, posEnd: 120 });
          mockClient.query.mockResolvedValue({ rows: [] });
          validateBooking.mockResolvedValue({ valid: true, errors: [], conflicts: [] });
          BookingModel.updatePosition.mockResolvedValue({ ...booking, pos_start: '70', pos_end: '120' });
          BookingModel.findById.mockResolvedValueOnce({ ...booking, pos_start: '70', pos_end: '120' });
        }

        const result = await BookingService.editPosition(30, 70);

        if (status === 'pending') {
          expect(result.success).toBe(true);
        } else {
          expect(result.success).toBe(false);
          expect(result.error.code).toBe('INVALID_STATUS');
        }
      });
    });
  });
});
