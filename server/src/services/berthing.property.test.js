const fc = require('fast-check');

/**
 * Property-Based Tests for BerthingCanvas Rendering Logic
 *
 * These tests validate the pure logic behind the BerthingCanvas visualization:
 * - Block positioning based on booking spatial/temporal data
 * - Status-to-color mapping consistency
 *
 * Validates: Requirements 3.3, 3.6
 */

// ============================================================
// Extracted rendering logic (mirrors BerthingCanvas.jsx logic)
// ============================================================

const MAX_LENGTH = 500;

const STATUS_COLORS = {
  pending: '#FCD34D',
  approved: '#34D399',
  rejected: '#F87171',
};

const VALID_STATUSES = Object.keys(STATUS_COLORS);

/**
 * Calculate the visual position of a ship block on the canvas.
 * This mirrors the positioning logic in BerthingCanvas.jsx.
 *
 * @param {object} booking - { pos_start, pos_end, eta_in, etd_out }
 * @param {number} dockLength - Total dock length (default 500)
 * @returns {object} { leftPercent, widthPercent, etaTimestamp, etdTimestamp }
 */
function getBlockPosition(booking, dockLength = MAX_LENGTH) {
  const posStart = Number(booking.pos_start);
  const posEnd = Number(booking.pos_end);
  const leftPercent = (((dockLength - Math.max(posStart, posEnd)) / dockLength) * 98) + 1;
  const widthPercent = (Math.abs(posEnd - posStart) / dockLength) * 98;

  return {
    leftPercent,
    widthPercent: Math.max(widthPercent, 1.5),
    etaTimestamp: new Date(booking.eta_in).getTime(),
    etdTimestamp: new Date(booking.etd_out).getTime(),
  };
}

/**
 * Get the color for a booking based on its status_request.
 * Uses Object.hasOwn to avoid prototype pollution issues.
 *
 * @param {string} status - The status_request value
 * @returns {string|null} The hex color or null if status is unknown
 */
function getBlockColor(status) {
  if (Object.prototype.hasOwnProperty.call(STATUS_COLORS, status)) {
    return STATUS_COLORS[status];
  }
  return null;
}

// ============================================================
// Generators
// ============================================================

/** Generate a valid meter position pair where pos_start < pos_end and both within [0, MAX_LENGTH] */
const validPositionArb = fc.integer({ min: 0, max: MAX_LENGTH - 1 }).chain((posStart) =>
  fc.integer({ min: posStart + 1, max: MAX_LENGTH }).map((posEnd) => ({
    pos_start: posStart,
    pos_end: posEnd,
  }))
);

/**
 * Generate a valid time window where eta_in < etd_out.
 * Uses integer timestamps to avoid invalid Date issues with fc.date chaining.
 */
const MIN_TIMESTAMP = new Date('2024-01-01T00:00:00Z').getTime();
const MAX_TIMESTAMP = new Date('2025-12-31T00:00:00Z').getTime();
const ONE_HOUR_MS = 3600000;

const validTimeWindowArb = fc.integer({ min: MIN_TIMESTAMP, max: MAX_TIMESTAMP - ONE_HOUR_MS })
  .chain((etaMs) =>
    fc.integer({ min: etaMs + ONE_HOUR_MS, max: MAX_TIMESTAMP }).map((etdMs) => ({
      eta_in: new Date(etaMs).toISOString(),
      etd_out: new Date(etdMs).toISOString(),
    }))
  );

/** Generate a valid booking with position and time data */
const validBookingArb = fc.tuple(validPositionArb, validTimeWindowArb).map(([pos, time]) => ({
  ...pos,
  ...time,
}));

/** Generate a valid status_request value */
const validStatusArb = fc.constantFrom('pending', 'approved', 'rejected');

// ============================================================
// Property 17: Booking Block Visual Positioning
// ============================================================

describe('Property 17: Booking Block Visual Positioning', () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * For any booking with valid pos_start, pos_end, eta_in, etd_out,
   * the ShipBlock SHALL be positioned at horizontal coordinates
   * corresponding to [pos_start, pos_end] and vertical coordinates
   * corresponding to [eta_in, etd_out].
   */

  it('position is deterministic — same booking always produces same position', () => {
    fc.assert(
      fc.property(validBookingArb, (booking) => {
        const pos1 = getBlockPosition(booking);
        const pos2 = getBlockPosition(booking);

        expect(pos1.leftPercent).toBe(pos2.leftPercent);
        expect(pos1.widthPercent).toBe(pos2.widthPercent);
        expect(pos1.etaTimestamp).toBe(pos2.etaTimestamp);
        expect(pos1.etdTimestamp).toBe(pos2.etdTimestamp);
      }),
      { numRuns: 200 }
    );
  });

  it('pos_start < pos_end constraint produces positive width', () => {
    fc.assert(
      fc.property(validBookingArb, (booking) => {
        const pos = getBlockPosition(booking);
        // Width must be positive (minimum 1.5% enforced)
        expect(pos.widthPercent).toBeGreaterThanOrEqual(1.5);
      }),
      { numRuns: 200 }
    );
  });

  it('eta_in < etd_out constraint produces positive time span', () => {
    fc.assert(
      fc.property(validBookingArb, (booking) => {
        const pos = getBlockPosition(booking);
        // etd must be after eta
        expect(pos.etdTimestamp).toBeGreaterThan(pos.etaTimestamp);
      }),
      { numRuns: 200 }
    );
  });

  it('leftPercent is within valid canvas bounds [1%, 99%]', () => {
    fc.assert(
      fc.property(validBookingArb, (booking) => {
        const pos = getBlockPosition(booking);
        // leftPercent formula: ((dockLength - max(posStart, posEnd)) / dockLength) * 98 + 1
        // When max(posStart, posEnd) = 0 → leftPercent = 99
        // When max(posStart, posEnd) = dockLength → leftPercent = 1
        expect(pos.leftPercent).toBeGreaterThanOrEqual(1);
        expect(pos.leftPercent).toBeLessThanOrEqual(99);
      }),
      { numRuns: 200 }
    );
  });

  it('widthPercent is proportional to (pos_end - pos_start) / dockLength', () => {
    fc.assert(
      fc.property(validBookingArb, (booking) => {
        const pos = getBlockPosition(booking);
        const expectedRawWidth = (Math.abs(booking.pos_end - booking.pos_start) / MAX_LENGTH) * 98;
        const expectedWidth = Math.max(expectedRawWidth, 1.5);
        expect(pos.widthPercent).toBeCloseTo(expectedWidth, 10);
      }),
      { numRuns: 200 }
    );
  });

  it('larger ships (wider pos range) produce larger widthPercent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 10, max: 100 }),
        fc.integer({ min: 101, max: 299 }),
        validTimeWindowArb,
        (posStart, smallSpan, largeSpan, time) => {
          const smallBooking = { pos_start: posStart, pos_end: posStart + smallSpan, ...time };
          const largeBooking = { pos_start: posStart, pos_end: posStart + largeSpan, ...time };

          // Ensure both are within dock bounds
          if (smallBooking.pos_end > MAX_LENGTH || largeBooking.pos_end > MAX_LENGTH) return;

          const smallPos = getBlockPosition(smallBooking);
          const largePos = getBlockPosition(largeBooking);

          expect(largePos.widthPercent).toBeGreaterThan(smallPos.widthPercent);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('temporal coordinates map correctly from ISO strings to timestamps', () => {
    fc.assert(
      fc.property(validBookingArb, (booking) => {
        const pos = getBlockPosition(booking);
        expect(pos.etaTimestamp).toBe(new Date(booking.eta_in).getTime());
        expect(pos.etdTimestamp).toBe(new Date(booking.etd_out).getTime());
      }),
      { numRuns: 200 }
    );
  });
});

// ============================================================
// Property 18: Status-Color Mapping Consistency
// ============================================================

describe('Property 18: Status-Color Mapping Consistency', () => {
  /**
   * **Validates: Requirements 3.6**
   *
   * For any booking rendered on the BerthingCanvas, the ShipBlock color
   * SHALL be determined solely by its status_request value.
   * No two statuses SHALL share the same color.
   */

  it('color is determined solely by status_request — same status always yields same color', () => {
    fc.assert(
      fc.property(validStatusArb, (status) => {
        const color1 = getBlockColor(status);
        const color2 = getBlockColor(status);
        expect(color1).toBe(color2);
      }),
      { numRuns: 100 }
    );
  });

  it('no two different statuses share the same color', () => {
    const statuses = Object.keys(STATUS_COLORS);
    const colors = Object.values(STATUS_COLORS);
    const uniqueColors = new Set(colors);

    // Each status maps to a unique color
    expect(uniqueColors.size).toBe(statuses.length);
  });

  it('all valid statuses have a defined color (mapping is exhaustive)', () => {
    fc.assert(
      fc.property(validStatusArb, (status) => {
        const color = getBlockColor(status);
        expect(color).not.toBeNull();
        expect(typeof color).toBe('string');
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }),
      { numRuns: 100 }
    );
  });

  it('color mapping matches the design specification exactly', () => {
    expect(getBlockColor('pending')).toBe('#FCD34D');
    expect(getBlockColor('approved')).toBe('#34D399');
    expect(getBlockColor('rejected')).toBe('#F87171');
  });

  it('unknown statuses return null (no fallback to another status color)', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !['pending', 'approved', 'rejected'].includes(s)),
        (invalidStatus) => {
          const color = getBlockColor(invalidStatus);
          expect(color).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('color is independent of other booking properties (position, time)', () => {
    fc.assert(
      fc.property(
        validStatusArb,
        validPositionArb,
        validPositionArb,
        (status, pos1, pos2) => {
          // Two different bookings with the same status get the same color
          // regardless of their position data
          const color1 = getBlockColor(status);
          const color2 = getBlockColor(status);
          expect(color1).toBe(color2);

          // The color is purely a function of status
          expect(color1).toBe(STATUS_COLORS[status]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
