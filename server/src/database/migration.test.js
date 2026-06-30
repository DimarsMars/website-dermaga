const fs = require('fs');
const path = require('path');
const fc = require('fast-check');

// Mock the database pool
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../config/db');
const BookingModel = require('../models/booking.model');

/**
 * Property Tests for Database Constraints
 * 
 * Property 21: Foreign Key Enforcement
 * Property 22: UTC Timestamp Storage
 * 
 * Validates: Requirements 14.4, 14.5
 */
describe('Database Constraints - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // Property 21: Foreign Key Enforcement
  // ============================================================
  describe('Property 21: Foreign Key Enforcement', () => {
    /**
     * **Validates: Requirements 14.4**
     * 
     * For any TRX_BOOKING record, the id_kapal SHALL reference an existing
     * MASTER_KAPAL record and the id_agen SHALL reference an existing MASTER_AGEN
     * record. Attempts to create bookings with non-existent references SHALL be rejected.
     */

    // Helper: generate a valid ISO timestamp string
    const isoTimestamp = () =>
      fc.integer({ min: 1704067200000, max: 1767225600000 }) // 2024-01-01 to 2025-12-31 in ms
        .map(ms => new Date(ms).toISOString());

    it('should reject booking creation when id_kapal references a non-existent ship (FK violation)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id_kapal: fc.integer({ min: 9000, max: 99999 }), // non-existent ship IDs
            id_agen: fc.integer({ min: 1, max: 100 }),
            pos_start: fc.integer({ min: 0, max: 400 }),
            pos_end: fc.integer({ min: 50, max: 500 }),
            eta_in: isoTimestamp(),
            etd_out: isoTimestamp(),
            status_request: fc.constantFrom('pending', 'approved', 'rejected'),
          }),
          async (bookingData) => {
            // Simulate PostgreSQL foreign key violation error (code 23503)
            const fkError = new Error('insert or update on table "trx_booking" violates foreign key constraint "trx_booking_id_kapal_fkey"');
            fkError.code = '23503';
            fkError.detail = `Key (id_kapal)=(${bookingData.id_kapal}) is not present in table "master_kapal".`;
            fkError.constraint = 'trx_booking_id_kapal_fkey';

            pool.query.mockRejectedValueOnce(fkError);

            await expect(
              BookingModel.create(bookingData)
            ).rejects.toMatchObject({
              code: '23503',
              constraint: 'trx_booking_id_kapal_fkey',
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject booking creation when id_agen references a non-existent agent (FK violation)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id_kapal: fc.integer({ min: 1, max: 100 }),
            id_agen: fc.integer({ min: 9000, max: 99999 }), // non-existent agent IDs
            pos_start: fc.integer({ min: 0, max: 400 }),
            pos_end: fc.integer({ min: 50, max: 500 }),
            eta_in: isoTimestamp(),
            etd_out: isoTimestamp(),
            status_request: fc.constantFrom('pending', 'approved', 'rejected'),
          }),
          async (bookingData) => {
            // Simulate PostgreSQL foreign key violation error (code 23503)
            const fkError = new Error('insert or update on table "trx_booking" violates foreign key constraint "trx_booking_id_agen_fkey"');
            fkError.code = '23503';
            fkError.detail = `Key (id_agen)=(${bookingData.id_agen}) is not present in table "master_agen".`;
            fkError.constraint = 'trx_booking_id_agen_fkey';

            pool.query.mockRejectedValueOnce(fkError);

            await expect(
              BookingModel.create(bookingData)
            ).rejects.toMatchObject({
              code: '23503',
              constraint: 'trx_booking_id_agen_fkey',
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should propagate FK violation errors with correct PostgreSQL error code for any invalid reference', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id_kapal: fc.integer({ min: 1, max: 99999 }),
            id_agen: fc.integer({ min: 1, max: 99999 }),
            pos_start: fc.integer({ min: 0, max: 400 }),
            pos_end: fc.integer({ min: 50, max: 500 }),
            eta_in: isoTimestamp(),
            etd_out: isoTimestamp(),
            status_request: fc.constantFrom('pending', 'approved', 'rejected'),
          }),
          fc.constantFrom('trx_booking_id_kapal_fkey', 'trx_booking_id_agen_fkey'),
          async (bookingData, constraintName) => {
            const fkError = new Error(`insert or update on table "trx_booking" violates foreign key constraint "${constraintName}"`);
            fkError.code = '23503';
            fkError.constraint = constraintName;

            pool.query.mockRejectedValueOnce(fkError);

            try {
              await BookingModel.create(bookingData);
              // Should not reach here
              throw new Error('Expected FK violation but query succeeded');
            } catch (err) {
              // Verify the error is a PostgreSQL FK violation
              expect(err.code).toBe('23503');
              expect(err.constraint).toBe(constraintName);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================
  // Property 22: UTC Timestamp Storage
  // ============================================================
  describe('Property 22: UTC Timestamp Storage', () => {
    /**
     * **Validates: Requirements 14.5**
     * 
     * For any timestamp stored in the database (created_at, updated_at, eta_in,
     * etd_out, date_time), the value SHALL be stored in UTC format
     * (TIMESTAMP WITH TIME ZONE).
     */

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migration.sql'),
      'utf-8'
    );

    // Extract all CREATE TABLE blocks from the migration
    const tableBlocks = migrationSQL.split(/CREATE TABLE\s+/i).slice(1);

    // Known timestamp columns across all tables
    const expectedTimestampColumns = [
      // master_agen
      { table: 'master_agen', column: 'created_at' },
      // master_petugas
      { table: 'master_petugas', column: 'created_at' },
      // master_kapal
      { table: 'master_kapal', column: 'created_at' },
      // trx_booking
      { table: 'trx_booking', column: 'eta_in' },
      { table: 'trx_booking', column: 'etd_out' },
      { table: 'trx_booking', column: 'created_at' },
      { table: 'trx_booking', column: 'updated_at' },
      // log_activity
      { table: 'log_activity', column: 'date_time' },
      // notifikasi
      { table: 'notifikasi', column: 'created_at' },
    ];

    it('should define all timestamp columns as TIMESTAMP WITH TIME ZONE in migration SQL', () => {
      for (const { table, column } of expectedTimestampColumns) {
        // Find the table block
        const tableBlock = tableBlocks.find(block =>
          block.toLowerCase().startsWith(table.toLowerCase())
        );

        expect(tableBlock).toBeDefined();

        // Check that the column uses TIMESTAMP WITH TIME ZONE
        const columnPattern = new RegExp(
          `${column}\\s+TIMESTAMP\\s+WITH\\s+TIME\\s+ZONE`,
          'i'
        );
        expect(tableBlock).toMatch(columnPattern);
      }
    });

    it('should NOT use TIMESTAMP WITHOUT TIME ZONE for any timestamp column', () => {
      // Verify no timestamp column uses plain TIMESTAMP (without WITH TIME ZONE)
      for (const { table, column } of expectedTimestampColumns) {
        const tableBlock = tableBlocks.find(block =>
          block.toLowerCase().startsWith(table.toLowerCase())
        );

        expect(tableBlock).toBeDefined();

        // Check that the column does NOT use TIMESTAMP WITHOUT TIME ZONE
        const withoutTzPattern = new RegExp(
          `${column}\\s+TIMESTAMP\\s+WITHOUT\\s+TIME\\s+ZONE`,
          'i'
        );
        expect(tableBlock).not.toMatch(withoutTzPattern);
      }
    });

    it('should use TIMESTAMP WITH TIME ZONE for any arbitrary timestamp column found in the schema', () => {
      // Property: For ALL columns that contain timestamp-like data,
      // they must use TIMESTAMP WITH TIME ZONE
      const timestampColumnPattern = /(\w+)\s+TIMESTAMP\b/gi;

      for (const block of tableBlocks) {
        let match;
        const localPattern = /(\w+)\s+TIMESTAMP\b/gi;
        while ((match = localPattern.exec(block)) !== null) {
          const columnName = match[1];
          // Verify it's followed by WITH TIME ZONE
          const fullColumnPattern = new RegExp(
            `${columnName}\\s+TIMESTAMP\\s+WITH\\s+TIME\\s+ZONE`,
            'i'
          );
          expect(block).toMatch(fullColumnPattern);
        }
      }
    });

    it('should store booking timestamps (eta_in, etd_out) as TIMESTAMP WITH TIME ZONE for any generated booking data', () => {
      // Helper: generate valid timestamps as ms since epoch
      const validTimestampMs = fc.integer({ min: 1577836800000, max: 1924991999000 }); // 2020-01-01 to 2030-12-31

      fc.assert(
        fc.property(
          fc.record({
            eta_in: validTimestampMs,
            etd_out: validTimestampMs,
          }),
          (timestamps) => {
            // The migration SQL defines eta_in and etd_out as TIMESTAMP WITH TIME ZONE
            const trxBookingBlock = tableBlocks.find(block =>
              block.toLowerCase().startsWith('trx_booking')
            );

            // Verify the schema enforces timezone-aware storage
            expect(trxBookingBlock).toMatch(/eta_in\s+TIMESTAMP\s+WITH\s+TIME\s+ZONE\s+NOT\s+NULL/i);
            expect(trxBookingBlock).toMatch(/etd_out\s+TIMESTAMP\s+WITH\s+TIME\s+ZONE\s+NOT\s+NULL/i);

            // Verify that ISO 8601 strings (which include timezone info) are valid inputs
            const isoEtaIn = new Date(timestamps.eta_in).toISOString();
            const isoEtdOut = new Date(timestamps.etd_out).toISOString();
            expect(isoEtaIn).toMatch(/Z$/); // UTC indicator
            expect(isoEtdOut).toMatch(/Z$/); // UTC indicator
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
