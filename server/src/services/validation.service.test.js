const { validateCapacity, detectOverlap, validateBooking } = require('./validation.service');

describe('Validation Service', () => {
  describe('validateCapacity', () => {
    it('should return valid with correct posEnd for a booking within capacity', () => {
      const result = validateCapacity(0, 100, 5);
      expect(result.valid).toBe(true);
      expect(result.posEnd).toBe(105);
    });

    it('should return valid when posEnd equals exactly MAX_LENGTH (500)', () => {
      // posStart=0, loa=495, clearance=5 → posEnd=500
      const result = validateCapacity(0, 495, 5);
      expect(result.valid).toBe(true);
      expect(result.posEnd).toBe(500);
    });

    it('should reject when posEnd exceeds MAX_LENGTH (500)', () => {
      // posStart=0, loa=496, clearance=5 → posEnd=501
      const result = validateCapacity(0, 496, 5);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('POS_END exceeds dock capacity (500m)');
    });

    it('should reject when posStart is negative', () => {
      const result = validateCapacity(-1, 50, 5);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('POS_START cannot be negative');
    });

    it('should handle posStart at 0 correctly', () => {
      const result = validateCapacity(0, 50, 5);
      expect(result.valid).toBe(true);
      expect(result.posEnd).toBe(55);
    });

    it('should calculate posEnd = posStart + loa + clearance exactly', () => {
      const result = validateCapacity(100, 150, 5);
      expect(result.posEnd).toBe(255);
    });

    it('should reject a large ship that starts mid-dock and exceeds capacity', () => {
      // posStart=300, loa=195, clearance=5 → posEnd=500 (exactly at limit)
      const result = validateCapacity(300, 195, 5);
      expect(result.valid).toBe(true);
      expect(result.posEnd).toBe(500);

      // posStart=300, loa=196, clearance=5 → posEnd=501 (exceeds)
      const result2 = validateCapacity(300, 196, 5);
      expect(result2.valid).toBe(false);
    });

    it('should handle zero LOA', () => {
      const result = validateCapacity(0, 0, 5);
      expect(result.valid).toBe(true);
      expect(result.posEnd).toBe(5);
    });

    it('should handle zero clearance', () => {
      const result = validateCapacity(100, 50, 0);
      expect(result.valid).toBe(true);
      expect(result.posEnd).toBe(150);
    });
  });

  describe('detectOverlap', () => {
    const baseBooking = {
      pos_start: 100,
      pos_end: 200,
      eta_in: '2024-06-01T08:00:00Z',
      etd_out: '2024-06-03T08:00:00Z',
    };

    it('should return empty array when no existing bookings', () => {
      const conflicts = detectOverlap(baseBooking, []);
      expect(conflicts).toEqual([]);
    });

    it('should detect conflict when both spatial and temporal overlap exist', () => {
      const existing = [{
        id_booking: 1,
        pos_start: 150,
        pos_end: 250,
        eta_in: '2024-06-02T00:00:00Z',
        etd_out: '2024-06-04T00:00:00Z',
        nama_kapal: 'MV Conflict',
      }];
      const conflicts = detectOverlap(baseBooking, existing);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id_booking).toBe(1);
    });

    it('should NOT detect conflict when only spatial overlap exists (no temporal)', () => {
      const existing = [{
        id_booking: 2,
        pos_start: 150,
        pos_end: 250,
        eta_in: '2024-06-05T00:00:00Z', // after new booking leaves
        etd_out: '2024-06-07T00:00:00Z',
        nama_kapal: 'MV NoTimeOverlap',
      }];
      const conflicts = detectOverlap(baseBooking, existing);
      expect(conflicts).toHaveLength(0);
    });

    it('should NOT detect conflict when only temporal overlap exists (no spatial)', () => {
      const existing = [{
        id_booking: 3,
        pos_start: 300,
        pos_end: 400,
        eta_in: '2024-06-02T00:00:00Z',
        etd_out: '2024-06-04T00:00:00Z',
        nama_kapal: 'MV NoSpaceOverlap',
      }];
      const conflicts = detectOverlap(baseBooking, existing);
      expect(conflicts).toHaveLength(0);
    });

    it('should NOT detect conflict when bookings are spatially adjacent (touching)', () => {
      // New booking: pos_start=100, pos_end=200
      // Existing: pos_start=200, pos_end=300 (starts exactly where new ends)
      const existing = [{
        id_booking: 4,
        pos_start: 200,
        pos_end: 300,
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
        nama_kapal: 'MV Adjacent',
      }];
      const conflicts = detectOverlap(baseBooking, existing);
      expect(conflicts).toHaveLength(0);
    });

    it('should NOT detect conflict when bookings are temporally adjacent (touching)', () => {
      // New booking: eta_in=June 1, etd_out=June 3
      // Existing: eta_in=June 3 (starts exactly when new ends)
      const existing = [{
        id_booking: 5,
        pos_start: 150,
        pos_end: 250,
        eta_in: '2024-06-03T08:00:00Z', // starts exactly when new ends
        etd_out: '2024-06-05T08:00:00Z',
        nama_kapal: 'MV TimeAdjacent',
      }];
      const conflicts = detectOverlap(baseBooking, existing);
      expect(conflicts).toHaveLength(0);
    });

    it('should detect multiple conflicts', () => {
      const existing = [
        {
          id_booking: 6,
          pos_start: 50,
          pos_end: 150,
          eta_in: '2024-06-01T00:00:00Z',
          etd_out: '2024-06-02T00:00:00Z',
          nama_kapal: 'MV Conflict1',
        },
        {
          id_booking: 7,
          pos_start: 180,
          pos_end: 280,
          eta_in: '2024-06-02T00:00:00Z',
          etd_out: '2024-06-04T00:00:00Z',
          nama_kapal: 'MV Conflict2',
        },
      ];
      const conflicts = detectOverlap(baseBooking, existing);
      expect(conflicts).toHaveLength(2);
    });

    it('should detect conflict when new booking is completely inside existing', () => {
      const existing = [{
        id_booking: 8,
        pos_start: 50,
        pos_end: 300,
        eta_in: '2024-05-30T00:00:00Z',
        etd_out: '2024-06-05T00:00:00Z',
        nama_kapal: 'MV BigShip',
      }];
      const conflicts = detectOverlap(baseBooking, existing);
      expect(conflicts).toHaveLength(1);
    });

    it('should detect conflict when existing booking is completely inside new', () => {
      const newBooking = {
        pos_start: 50,
        pos_end: 300,
        eta_in: '2024-05-30T00:00:00Z',
        etd_out: '2024-06-05T00:00:00Z',
      };
      const existing = [{
        id_booking: 9,
        pos_start: 100,
        pos_end: 200,
        eta_in: '2024-06-01T00:00:00Z',
        etd_out: '2024-06-03T00:00:00Z',
        nama_kapal: 'MV SmallShip',
      }];
      const conflicts = detectOverlap(newBooking, existing);
      expect(conflicts).toHaveLength(1);
    });
  });

  describe('validateBooking', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = {
        query: jest.fn(),
      };
    });

    it('should return invalid when pos_start is negative', async () => {
      const newBooking = {
        pos_start: -10,
        pos_end: 100,
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
      };

      const result = await validateBooking(mockClient, newBooking);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('pos_start');
      // Should not query DB if capacity check fails
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('should return invalid when pos_end exceeds 500', async () => {
      const newBooking = {
        pos_start: 100,
        pos_end: 501,
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
      };

      const result = await validateBooking(mockClient, newBooking);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('pos_end');
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('should return valid when no conflicts exist', async () => {
      const newBooking = {
        pos_start: 100,
        pos_end: 200,
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await validateBooking(mockClient, newBooking);

      expect(result.valid).toBe(true);
      expect(result.conflicts).toEqual([]);
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('should return conflicts when overlapping approved bookings exist', async () => {
      const newBooking = {
        pos_start: 100,
        pos_end: 200,
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id_booking: 10,
          id_kapal: 1,
          pos_start: 150,
          pos_end: 250,
          eta_in: new Date('2024-06-02T00:00:00Z'),
          etd_out: new Date('2024-06-04T00:00:00Z'),
          nama_kapal: 'MV Existing',
        }],
      });

      const result = await validateBooking(mockClient, newBooking);

      expect(result.valid).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].nama_kapal).toBe('MV Existing');
    });

    it('should exclude the specified booking ID from conflict check', async () => {
      const newBooking = {
        pos_start: 100,
        pos_end: 200,
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await validateBooking(mockClient, newBooking, 42);

      // Verify the excludeBookingId is passed as the 3rd parameter
      const queryArgs = mockClient.query.mock.calls[0][1];
      expect(queryArgs[2]).toBe(42);
    });

    it('should use 0 as default excludeBookingId when not provided', async () => {
      const newBooking = {
        pos_start: 100,
        pos_end: 200,
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await validateBooking(mockClient, newBooking);

      const queryArgs = mockClient.query.mock.calls[0][1];
      expect(queryArgs[2]).toBe(0);
    });

    it('should use SELECT FOR UPDATE in the query for row-level locking', async () => {
      const newBooking = {
        pos_start: 100,
        pos_end: 200,
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await validateBooking(mockClient, newBooking);

      const queryStr = mockClient.query.mock.calls[0][0];
      expect(queryStr).toContain('FOR UPDATE');
    });

    it('should only query approved bookings', async () => {
      const newBooking = {
        pos_start: 100,
        pos_end: 200,
        eta_in: '2024-06-01T08:00:00Z',
        etd_out: '2024-06-03T08:00:00Z',
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await validateBooking(mockClient, newBooking);

      const queryStr = mockClient.query.mock.calls[0][0];
      expect(queryStr).toContain("status_request = 'approved'");
    });
  });
});
