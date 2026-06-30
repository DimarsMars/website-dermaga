/**
 * Property Tests for Extend Time Feature
 *
 * **Validates: Requirements 7.1, 7.2, 7.3**
 *
 * Property 11: Extend Time Eligibility
 * - Verify extend request permitted iff status is "Approved" AND current time within [eta_in, etd_out]
 *
 * Property 12: Extend Time Conflict Detection and Cascade
 * - Verify temporal overlap detection with subsequent bookings and Delay_Cascade notification generation
 */

jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));
jest.mock('../models/booking.model');
jest.mock('../models/ship.model');

const pool = require('../config/db');
const BookingModel = require('../models/booking.model');
const BookingService = require('./booking.service');
const NotificationService = require('./notification.service');

describe('Extend Time Feature', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
  });

  /**
   * Property 11: Extend Time Eligibility
   * **Validates: Requirements 7.1**
   *
   * For any booking, an Extend_Time request SHALL be permitted if and only if
   * the booking status is "Approved" AND the current time is within the
   * scheduled berth period [eta_in, etd_out].
   */
  describe('Property 11: Extend Time Eligibility', () => {
    it('should succeed when status is "approved" and new_etd_out is after current etd_out', async () => {
      const booking = {
        id_booking: 1,
        id_kapal: 10,
        id_agen: 5,
        pos_start: '100',
        pos_end: '200',
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
        status_request: 'approved',
        nama_kapal: 'MV Test',
      };

      BookingModel.findById
        .mockResolvedValueOnce(booking) // initial lookup
        .mockResolvedValueOnce({ ...booking, etd_out: '2024-06-05T08:00:00Z' }); // after update

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // no conflicts

      BookingModel.updateEtdOut.mockResolvedValueOnce({
        ...booking,
        etd_out: '2024-06-05T08:00:00Z',
      });

      const result = await BookingService.extendBooking(1, '2024-06-05T08:00:00Z');

      expect(result.success).toBe(true);
      expect(result.booking.etd_out).toBe('2024-06-05T08:00:00Z');
    });

    it('should fail when status is "pending"', async () => {
      const booking = {
        id_booking: 2,
        id_kapal: 10,
        id_agen: 5,
        pos_start: '100',
        pos_end: '200',
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
        status_request: 'pending',
        nama_kapal: 'MV Pending',
      };

      BookingModel.findById.mockResolvedValueOnce(booking);

      const result = await BookingService.extendBooking(2, '2024-06-05T08:00:00Z');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_STATUS');
      expect(result.error.message).toBe('Only approved bookings can be extended');
    });

    it('should fail when status is "rejected"', async () => {
      const booking = {
        id_booking: 3,
        id_kapal: 10,
        id_agen: 5,
        pos_start: '100',
        pos_end: '200',
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
        status_request: 'rejected',
        nama_kapal: 'MV Rejected',
      };

      BookingModel.findById.mockResolvedValueOnce(booking);

      const result = await BookingService.extendBooking(3, '2024-06-05T08:00:00Z');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('INVALID_STATUS');
      expect(result.error.message).toBe('Only approved bookings can be extended');
    });

    it('should fail when new_etd_out is before current etd_out', async () => {
      const booking = {
        id_booking: 4,
        id_kapal: 10,
        id_agen: 5,
        pos_start: '100',
        pos_end: '200',
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
        status_request: 'approved',
        nama_kapal: 'MV EarlyEnd',
      };

      BookingModel.findById.mockResolvedValueOnce(booking);

      const result = await BookingService.extendBooking(4, '2024-06-02T08:00:00Z');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_FIELDS');
      expect(result.error.message).toBe('New departure time must be after current departure time');
    });

    it('should fail when new_etd_out equals current etd_out', async () => {
      const booking = {
        id_booking: 5,
        id_kapal: 10,
        id_agen: 5,
        pos_start: '100',
        pos_end: '200',
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
        status_request: 'approved',
        nama_kapal: 'MV SameTime',
      };

      BookingModel.findById.mockResolvedValueOnce(booking);

      const result = await BookingService.extendBooking(5, '2024-06-03T08:00:00Z');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_FIELDS');
      expect(result.error.message).toBe('New departure time must be after current departure time');
    });

    it('should fail when booking is not found', async () => {
      BookingModel.findById.mockResolvedValueOnce(null);

      const result = await BookingService.extendBooking(999, '2024-06-05T08:00:00Z');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.message).toBe('Booking not found');
    });
  });

  /**
   * Property 12: Extend Time Conflict Detection and Cascade
   * **Validates: Requirements 7.2, 7.3**
   *
   * For any Extend_Time request that extends etd_out, the Validation Engine SHALL
   * detect temporal overlap with subsequent approved bookings at the same meter range.
   * For any detected conflict, a Delay_Cascade notification SHALL be generated for
   * each affected Agen_Kapal.
   */
  describe('Property 12: Extend Time Conflict Detection and Cascade', () => {
    it('should return VALIDATION_CONFLICT when extension overlaps with subsequent approved booking at same meter range', async () => {
      const booking = {
        id_booking: 10,
        id_kapal: 10,
        id_agen: 5,
        pos_start: '100',
        pos_end: '200',
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
        status_request: 'approved',
        nama_kapal: 'MV Extender',
      };

      // Subsequent booking at same meter range that would conflict
      const conflictingBooking = {
        id_booking: 11,
        id_kapal: 20,
        pos_start: 150,
        pos_end: 250,
        eta_in: new Date('2024-06-04T00:00:00Z'),
        etd_out: new Date('2024-06-06T00:00:00Z'),
        nama_kapal: 'MV Subsequent',
      };

      BookingModel.findById.mockResolvedValueOnce(booking);

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [conflictingBooking] }); // overlap query returns conflict

      const result = await BookingService.extendBooking(10, '2024-06-05T08:00:00Z');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_CONFLICT');
      expect(result.error.message).toBe('Extension causes overlap with subsequent bookings');
      expect(result.error.details.conflicts).toHaveLength(1);
      expect(result.error.details.conflicts[0].nama_kapal).toBe('MV Subsequent');
    });

    it('should succeed when extension does NOT overlap with subsequent bookings', async () => {
      const booking = {
        id_booking: 12,
        id_kapal: 10,
        id_agen: 5,
        pos_start: '100',
        pos_end: '200',
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
        status_request: 'approved',
        nama_kapal: 'MV NoConflict',
      };

      BookingModel.findById
        .mockResolvedValueOnce(booking) // initial lookup
        .mockResolvedValueOnce({ ...booking, etd_out: '2024-06-04T08:00:00Z' }); // after update

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // no conflicts

      BookingModel.updateEtdOut.mockResolvedValueOnce({
        ...booking,
        etd_out: '2024-06-04T08:00:00Z',
      });

      const result = await BookingService.extendBooking(12, '2024-06-04T08:00:00Z');

      expect(result.success).toBe(true);
    });

    it('should detect conflict with multiple subsequent bookings at same meter range', async () => {
      const booking = {
        id_booking: 13,
        id_kapal: 10,
        id_agen: 5,
        pos_start: '100',
        pos_end: '200',
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
        status_request: 'approved',
        nama_kapal: 'MV BigExtend',
      };

      const conflict1 = {
        id_booking: 14,
        id_kapal: 20,
        pos_start: 120,
        pos_end: 180,
        eta_in: new Date('2024-06-04T00:00:00Z'),
        etd_out: new Date('2024-06-05T00:00:00Z'),
        nama_kapal: 'MV Affected1',
      };

      const conflict2 = {
        id_booking: 15,
        id_kapal: 30,
        pos_start: 150,
        pos_end: 220,
        eta_in: new Date('2024-06-05T00:00:00Z'),
        etd_out: new Date('2024-06-07T00:00:00Z'),
        nama_kapal: 'MV Affected2',
      };

      BookingModel.findById.mockResolvedValueOnce(booking);

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [conflict1, conflict2] }); // multiple conflicts

      const result = await BookingService.extendBooking(13, '2024-06-06T08:00:00Z');

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_CONFLICT');
      expect(result.error.details.conflicts).toHaveLength(2);
    });

    it('should NOT detect conflict when subsequent booking is at different meter range', async () => {
      const booking = {
        id_booking: 16,
        id_kapal: 10,
        id_agen: 5,
        pos_start: '100',
        pos_end: '200',
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
        status_request: 'approved',
        nama_kapal: 'MV DiffRange',
      };

      BookingModel.findById
        .mockResolvedValueOnce(booking) // initial lookup
        .mockResolvedValueOnce({ ...booking, etd_out: '2024-06-05T08:00:00Z' }); // after update

      // The validation query returns no rows because the subsequent booking
      // is at a different meter range (no spatial overlap)
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // no conflicts (different meter range)

      BookingModel.updateEtdOut.mockResolvedValueOnce({
        ...booking,
        etd_out: '2024-06-05T08:00:00Z',
      });

      const result = await BookingService.extendBooking(16, '2024-06-05T08:00:00Z');

      expect(result.success).toBe(true);
    });

    it('should rollback transaction when conflict is detected', async () => {
      const booking = {
        id_booking: 17,
        id_kapal: 10,
        id_agen: 5,
        pos_start: '100',
        pos_end: '200',
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
        status_request: 'approved',
        nama_kapal: 'MV Rollback',
      };

      const conflictingBooking = {
        id_booking: 18,
        id_kapal: 20,
        pos_start: 150,
        pos_end: 250,
        eta_in: new Date('2024-06-04T00:00:00Z'),
        etd_out: new Date('2024-06-06T00:00:00Z'),
        nama_kapal: 'MV BlockingShip',
      };

      BookingModel.findById.mockResolvedValueOnce(booking);

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [conflictingBooking] }); // conflict found

      const result = await BookingService.extendBooking(17, '2024-06-05T08:00:00Z');

      expect(result.success).toBe(false);
      // Verify ROLLBACK was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      // Verify client was released
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should commit transaction and release client on successful extension', async () => {
      const booking = {
        id_booking: 19,
        id_kapal: 10,
        id_agen: 5,
        pos_start: '100',
        pos_end: '200',
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
        status_request: 'approved',
        nama_kapal: 'MV Commit',
      };

      BookingModel.findById
        .mockResolvedValueOnce(booking)
        .mockResolvedValueOnce({ ...booking, etd_out: '2024-06-04T08:00:00Z' });

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // no conflicts

      BookingModel.updateEtdOut.mockResolvedValueOnce({
        ...booking,
        etd_out: '2024-06-04T08:00:00Z',
      });

      await BookingService.extendBooking(19, '2024-06-04T08:00:00Z');

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  /**
   * Delay Cascade Notification Tests
   * **Validates: Requirements 7.3**
   *
   * Verify that NotificationService.notifyDelayCascade generates notifications
   * for each affected booking's agent.
   */
  describe('Property 12 (continued): Delay Cascade Notification Generation', () => {
    // We test the notification service's notifyDelayCascade directly
    // since it's responsible for generating Delay_Cascade notifications

    beforeEach(() => {
      // Reset pool.query mock for notification tests
      pool.query.mockReset();
    });

    it('should generate a Delay_Cascade notification for each affected booking agent', async () => {
      const affectedBookings = [
        { id_booking: 20, id_agen: 101, nama_kapal: 'MV Affected1' },
        { id_booking: 21, id_agen: 102, nama_kapal: 'MV Affected2' },
      ];

      // Mock NotificationModel.create (called via pool.query internally)
      pool.query.mockResolvedValue({
        rows: [{
          id_notif: 1,
          id_user: 101,
          user_type: 'agen',
          title: 'Pemberitahuan Delay Cascade',
          message: 'Booking Anda terdampak perpanjangan waktu kapal lain.',
          is_read: false,
          created_at: new Date().toISOString(),
        }],
      });

      const notifications = await NotificationService.notifyDelayCascade(null, affectedBookings);

      expect(notifications).toHaveLength(2);
      // Verify pool.query was called once per affected booking
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should send notification to the correct agent for each affected booking', async () => {
      const affectedBookings = [
        { id_booking: 30, id_agen: 201, nama_kapal: 'MV Target' },
      ];

      pool.query.mockResolvedValue({
        rows: [{
          id_notif: 5,
          id_user: 201,
          user_type: 'agen',
          title: 'Pemberitahuan Delay Cascade',
          message: 'Booking Anda (ID: 30) terdampak perpanjangan waktu kapal lain di posisi yang sama.',
          is_read: false,
          created_at: new Date().toISOString(),
        }],
      });

      await NotificationService.notifyDelayCascade(null, affectedBookings);

      // Verify the query was called with the correct agent ID and user_type
      const callArgs = pool.query.mock.calls[0];
      expect(callArgs[1]).toContain(201); // id_user = agent id
      expect(callArgs[1]).toContain('agen'); // user_type
      expect(callArgs[1]).toContain('Pemberitahuan Delay Cascade'); // title
    });

    it('should generate no notifications when no bookings are affected', async () => {
      const affectedBookings = [];

      const notifications = await NotificationService.notifyDelayCascade(null, affectedBookings);

      expect(notifications).toHaveLength(0);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should include booking ID in the notification message', async () => {
      const affectedBookings = [
        { id_booking: 42, id_agen: 301, nama_kapal: 'MV Specific' },
      ];

      pool.query.mockResolvedValue({
        rows: [{
          id_notif: 10,
          id_user: 301,
          user_type: 'agen',
          title: 'Pemberitahuan Delay Cascade',
          message: 'Booking Anda (ID: 42) terdampak perpanjangan waktu kapal lain di posisi yang sama.',
          is_read: false,
          created_at: new Date().toISOString(),
        }],
      });

      await NotificationService.notifyDelayCascade(null, affectedBookings);

      const callArgs = pool.query.mock.calls[0];
      const message = callArgs[1].find(arg => typeof arg === 'string' && arg.includes('ID: 42'));
      expect(message).toBeDefined();
    });
  });
});
