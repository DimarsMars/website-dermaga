const fc = require('fast-check');
const { validateCapacity, detectOverlap } = require('./validation.service');
const { MAX_LENGTH } = require('../utils/constants');

/**
 * Property-Based Tests for Validation Engine
 * 
 * These tests verify universal correctness properties that must hold
 * across ALL valid inputs, not just specific examples.
 * 
 * Testing framework: Jest + fast-check
 */

describe('Validation Engine - Property-Based Tests', () => {

  /**
   * Property 4: POS_END Calculation Correctness
   * 
   * For any valid POS_START, LOA, CLEARANCE, verify POS_END = POS_START + LOA + CLEARANCE exactly.
   * 
   * **Validates: Requirements 4.2**
   */
  describe('Property 4: POS_END Calculation Correctness', () => {
    it('POS_END equals POS_START + LOA + CLEARANCE exactly for any valid inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 400 }),   // posStart: non-negative, within dock
          fc.integer({ min: 0, max: 200 }),   // loa: non-negative ship length
          fc.integer({ min: 0, max: 50 }),    // clearance: non-negative buffer
          (posStart, loa, clearance) => {
            const result = validateCapacity(posStart, loa, clearance);
            // When the booking is valid (fits within dock), posEnd must be exact sum
            if (result.valid) {
              expect(result.posEnd).toBe(posStart + loa + clearance);
            }
            // Even when invalid due to exceeding capacity, the calculation logic
            // should still follow the formula (posEnd is not returned on invalid)
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('POS_END calculation is exact (no floating point drift) for integer inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 200 }),
          fc.integer({ min: 0, max: 200 }),
          fc.integer({ min: 0, max: 50 }),
          (posStart, loa, clearance) => {
            // Constrain to valid range so we always get posEnd back
            fc.pre(posStart + loa + clearance <= MAX_LENGTH);
            const result = validateCapacity(posStart, loa, clearance);
            expect(result.valid).toBe(true);
            expect(result.posEnd).toStrictEqual(posStart + loa + clearance);
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  /**
   * Property 5: Dock Capacity Boundary Enforcement
   * 
   * For any booking where POS_START + LOA + CLEARANCE > 500, verify rejection.
   * For any booking where POS_START + LOA + CLEARANCE <= 500 and POS_START >= 0, verify pass.
   * For any POS_START < 0, verify rejection.
   * 
   * **Validates: Requirements 4.3**
   */
  describe('Property 5: Dock Capacity Boundary Enforcement', () => {
    it('rejects any booking where POS_START + LOA + CLEARANCE > 500', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 600 }),   // posStart
          fc.integer({ min: 0, max: 600 }),   // loa
          fc.integer({ min: 0, max: 100 }),   // clearance
          (posStart, loa, clearance) => {
            fc.pre(posStart + loa + clearance > MAX_LENGTH);
            const result = validateCapacity(posStart, loa, clearance);
            expect(result.valid).toBe(false);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('accepts any booking where POS_START >= 0 and POS_START + LOA + CLEARANCE <= 500', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 500 }),   // posStart: non-negative
          fc.integer({ min: 0, max: 500 }),   // loa: non-negative
          fc.integer({ min: 0, max: 100 }),   // clearance: non-negative
          (posStart, loa, clearance) => {
            fc.pre(posStart + loa + clearance <= MAX_LENGTH);
            fc.pre(posStart >= 0);
            const result = validateCapacity(posStart, loa, clearance);
            expect(result.valid).toBe(true);
            expect(result.posEnd).toBe(posStart + loa + clearance);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('rejects any booking where POS_START < 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: -1 }),  // posStart: negative
          fc.integer({ min: 0, max: 200 }),     // loa
          fc.integer({ min: 0, max: 50 }),      // clearance
          (posStart, loa, clearance) => {
            const result = validateCapacity(posStart, loa, clearance);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('POS_START cannot be negative');
          }
        ),
        { numRuns: 500 }
      );
    });

    it('boundary: POS_START + LOA + CLEARANCE = 500 is accepted', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 499 }),
          (posStart) => {
            // Choose loa and clearance such that sum is exactly 500
            const remaining = MAX_LENGTH - posStart;
            fc.pre(remaining >= 0);
            const loa = Math.max(0, remaining - 5);
            const clearance = remaining - loa;
            const result = validateCapacity(posStart, loa, clearance);
            expect(result.valid).toBe(true);
            expect(result.posEnd).toBe(MAX_LENGTH);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('boundary: POS_START + LOA + CLEARANCE = 501 is rejected', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 499 }),
          (posStart) => {
            // Choose loa and clearance such that sum is exactly 501
            const target = MAX_LENGTH + 1;
            const remaining = target - posStart;
            fc.pre(remaining > 0);
            const clearance = 5;
            const loa = remaining - clearance;
            fc.pre(loa >= 0);
            const result = validateCapacity(posStart, loa, clearance);
            expect(result.valid).toBe(false);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  /**
   * Property 6: Spatial-Temporal Overlap Detection
   * 
   * For any two bookings A and B, verify conflict detected iff both spatial AND temporal
   * overlap exist. Only approved bookings should be checked.
   * 
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.5**
   */
  describe('Property 6: Spatial-Temporal Overlap Detection', () => {

    // Generator for a booking with valid spatial and temporal ranges
    const bookingArb = fc.record({
      pos_start: fc.integer({ min: 0, max: 400 }),
      pos_length: fc.integer({ min: 10, max: 200 }),
      eta_in_offset: fc.integer({ min: 0, max: 100 }),   // hours from base
      duration: fc.integer({ min: 1, max: 72 }),          // hours
    }).map(({ pos_start, pos_length, eta_in_offset, duration }) => {
      const baseTime = new Date('2024-01-01T00:00:00Z').getTime();
      return {
        pos_start,
        pos_end: pos_start + pos_length,
        eta_in: new Date(baseTime + eta_in_offset * 3600000).toISOString(),
        etd_out: new Date(baseTime + (eta_in_offset + duration) * 3600000).toISOString(),
      };
    });

    // Helper: check if two intervals overlap (strict, not touching)
    function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
      return aStart < bEnd && aEnd > bStart;
    }

    it('detects conflict iff both spatial AND temporal overlap exist', () => {
      fc.assert(
        fc.property(
          bookingArb,
          bookingArb,
          (newBooking, existingBookingBase) => {
            const existingBooking = {
              ...existingBookingBase,
              id_booking: 1,
              nama_kapal: 'MV Test',
            };

            const spatialOverlap = intervalsOverlap(
              newBooking.pos_start, newBooking.pos_end,
              existingBooking.pos_start, existingBooking.pos_end
            );
            const temporalOverlap = intervalsOverlap(
              new Date(newBooking.eta_in).getTime(), new Date(newBooking.etd_out).getTime(),
              new Date(existingBooking.eta_in).getTime(), new Date(existingBooking.etd_out).getTime()
            );

            const expectedConflict = spatialOverlap && temporalOverlap;
            const conflicts = detectOverlap(newBooking, [existingBooking]);

            if (expectedConflict) {
              expect(conflicts.length).toBe(1);
            } else {
              expect(conflicts.length).toBe(0);
            }
          }
        ),
        { numRuns: 2000 }
      );
    });

    it('no conflict when spatial ranges do not overlap (regardless of time)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 200 }),   // newStart
          fc.integer({ min: 10, max: 100 }),  // newLength
          fc.integer({ min: 10, max: 100 }),  // existingLength
          fc.integer({ min: 0, max: 100 }),   // time offset for new
          fc.integer({ min: 0, max: 100 }),   // time offset for existing
          (newStart, newLength, existingLength, newTimeOffset, existingTimeOffset) => {
            // Place existing AFTER new ends (no spatial overlap)
            const existingStart = newStart + newLength; // starts exactly where new ends (touching = no overlap)
            const baseTime = new Date('2024-01-01T00:00:00Z').getTime();

            const newBooking = {
              pos_start: newStart,
              pos_end: newStart + newLength,
              eta_in: new Date(baseTime + newTimeOffset * 3600000).toISOString(),
              etd_out: new Date(baseTime + (newTimeOffset + 24) * 3600000).toISOString(),
            };

            const existingBooking = {
              id_booking: 1,
              pos_start: existingStart,
              pos_end: existingStart + existingLength,
              eta_in: new Date(baseTime + existingTimeOffset * 3600000).toISOString(),
              etd_out: new Date(baseTime + (existingTimeOffset + 24) * 3600000).toISOString(),
              nama_kapal: 'MV NoSpatial',
            };

            const conflicts = detectOverlap(newBooking, [existingBooking]);
            expect(conflicts.length).toBe(0);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('no conflict when temporal ranges do not overlap (regardless of space)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 200 }),   // shared position start
          fc.integer({ min: 10, max: 100 }),  // shared position length
          fc.integer({ min: 1, max: 48 }),    // new duration hours
          fc.integer({ min: 1, max: 48 }),    // existing duration hours
          (posStart, posLength, newDuration, existingDuration) => {
            const baseTime = new Date('2024-01-01T00:00:00Z').getTime();

            // New booking: starts at base time
            const newBooking = {
              pos_start: posStart,
              pos_end: posStart + posLength,
              eta_in: new Date(baseTime).toISOString(),
              etd_out: new Date(baseTime + newDuration * 3600000).toISOString(),
            };

            // Existing booking: starts exactly when new ends (touching = no overlap)
            const existingBooking = {
              id_booking: 1,
              pos_start: posStart,  // same spatial range (full overlap)
              pos_end: posStart + posLength,
              eta_in: new Date(baseTime + newDuration * 3600000).toISOString(),
              etd_out: new Date(baseTime + (newDuration + existingDuration) * 3600000).toISOString(),
              nama_kapal: 'MV NoTemporal',
            };

            const conflicts = detectOverlap(newBooking, [existingBooking]);
            expect(conflicts.length).toBe(0);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('only checks against provided approved bookings list (empty list = no conflicts)', () => {
      fc.assert(
        fc.property(
          bookingArb,
          (newBooking) => {
            // With no existing approved bookings, there can never be a conflict
            const conflicts = detectOverlap(newBooking, []);
            expect(conflicts.length).toBe(0);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('detects all conflicts in a list of multiple overlapping bookings', () => {
      fc.assert(
        fc.property(
          bookingArb,
          fc.array(bookingArb, { minLength: 1, maxLength: 10 }),
          (newBooking, existingBookingsBase) => {
            const existingBookings = existingBookingsBase.map((b, i) => ({
              ...b,
              id_booking: i + 1,
              nama_kapal: `MV Ship${i}`,
            }));

            const conflicts = detectOverlap(newBooking, existingBookings);

            // Manually compute expected conflicts
            const expectedConflicts = existingBookings.filter(existing => {
              const spatialOverlap = newBooking.pos_start < existing.pos_end
                                  && newBooking.pos_end > existing.pos_start;
              const temporalOverlap = new Date(newBooking.eta_in) < new Date(existing.etd_out)
                                  && new Date(newBooking.etd_out) > new Date(existing.eta_in);
              return spatialOverlap && temporalOverlap;
            });

            expect(conflicts.length).toBe(expectedConflicts.length);
            // Verify the same bookings are identified as conflicts
            const conflictIds = conflicts.map(c => c.id_booking).sort();
            const expectedIds = expectedConflicts.map(c => c.id_booking).sort();
            expect(conflictIds).toEqual(expectedIds);
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
});
