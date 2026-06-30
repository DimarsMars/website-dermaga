/**
 * Property-Based Tests for Master Data Controller
 *
 * Validates: Requirements 11.4, 11.5, 4.6
 *
 * Property 19: Referential Integrity on Ship Deletion
 * Property 20: Ship Creation Required Fields
 * Property 9: Ship Ownership Filtering
 */

const fc = require('fast-check');

// Mock the models
jest.mock('../models/ship.model');
jest.mock('../models/agent.model');
jest.mock('../models/officer.model');

const ShipModel = require('../models/ship.model');
const AgentModel = require('../models/agent.model');
const { getShips, createShip, deleteShip } = require('./master.controller');

// Helper to create mock req/res
function mockReqRes(body = {}, user = null, params = {}) {
  const req = { body, user, params };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

describe('Master Data Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // Property 19: Referential Integrity on Ship Deletion
  // **Validates: Requirements 11.5**
  // ============================================================
  describe('Property 19: Referential Integrity on Ship Deletion', () => {
    it('For ANY ship with associated bookings, deleteShip returns 409 INTEGRITY_CONSTRAINT', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 10000 }),
          async (shipId, bookingCount) => {
            // Ship exists
            ShipModel.findById.mockResolvedValue({
              id_kapal: shipId,
              nama_kapal: 'Test Ship',
              loa: 100,
              id_agen: 1,
              agency_name: 'Agency',
            });
            // Ship has bookings (count > 0 means hasBookings returns true)
            ShipModel.hasBookings.mockResolvedValue(true);

            const { req, res } = mockReqRes({}, { id: 1, role: 'admin' }, { id: String(shipId) });

            await deleteShip(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
              success: false,
              error: {
                code: 'INTEGRITY_CONSTRAINT',
                message: 'Cannot delete ship with existing bookings',
              },
            });

            jest.clearAllMocks();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('For ANY ship with zero bookings, deleteShip succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          async (shipId) => {
            // Ship exists
            ShipModel.findById.mockResolvedValue({
              id_kapal: shipId,
              nama_kapal: 'Test Ship',
              loa: 100,
              id_agen: 1,
              agency_name: 'Agency',
            });
            // Ship has no bookings
            ShipModel.hasBookings.mockResolvedValue(false);
            // Delete succeeds
            ShipModel.delete.mockResolvedValue({ id_kapal: shipId });

            const { req, res } = mockReqRes({}, { id: 1, role: 'admin' }, { id: String(shipId) });

            await deleteShip(req, res);

            expect(res.json).toHaveBeenCalledWith({
              success: true,
              message: 'Ship deleted successfully',
            });
            // Should NOT have returned 409
            expect(res.status).not.toHaveBeenCalledWith(409);

            jest.clearAllMocks();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================
  // Property 20: Ship Creation Required Fields
  // **Validates: Requirements 11.4**
  // ============================================================
  describe('Property 20: Ship Creation Required Fields', () => {
    it('For ANY ship creation request missing nama_kapal, createShip returns 422', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 1, max: 500, noNaN: true }),
          fc.integer({ min: 1, max: 1000 }),
          async (loa, id_agen) => {
            const { req, res } = mockReqRes(
              { loa, id_agen }, // missing nama_kapal
              { id: 1, role: 'admin' }
            );

            await createShip(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                success: false,
                error: expect.objectContaining({ code: 'VALIDATION_FIELDS' }),
              })
            );

            jest.clearAllMocks();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('For ANY ship creation request missing loa, createShip returns 422', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 1000 }),
          async (nama_kapal, id_agen) => {
            const { req, res } = mockReqRes(
              { nama_kapal, id_agen }, // missing loa
              { id: 1, role: 'admin' }
            );

            await createShip(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                success: false,
                error: expect.objectContaining({ code: 'VALIDATION_FIELDS' }),
              })
            );

            jest.clearAllMocks();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('For ANY ship creation request missing id_agen, createShip returns 422', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.double({ min: 1, max: 500, noNaN: true }),
          async (nama_kapal, loa) => {
            const { req, res } = mockReqRes(
              { nama_kapal, loa }, // missing id_agen
              { id: 1, role: 'admin' }
            );

            await createShip(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                success: false,
                error: expect.objectContaining({ code: 'VALIDATION_FIELDS' }),
              })
            );

            jest.clearAllMocks();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('For ANY valid ship creation request with all required fields, validation passes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.double({ min: 0.01, max: 500, noNaN: true }),
          fc.integer({ min: 1, max: 1000 }),
          async (nama_kapal, loa, id_agen) => {
            // Agent exists
            AgentModel.findById.mockResolvedValue({
              id_agen,
              username: 'agent1',
              agency_name: 'Agency',
            });
            // Ship creation succeeds
            ShipModel.create.mockResolvedValue({
              id_kapal: 1,
              nama_kapal,
              loa,
              id_agen,
              created_at: new Date().toISOString(),
            });

            const { req, res } = mockReqRes(
              { nama_kapal, loa, id_agen },
              { id: 1, role: 'admin' }
            );

            await createShip(req, res);

            // Should NOT return 422 validation error
            expect(res.status).not.toHaveBeenCalledWith(422);
            // Should return 201 created
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({ success: true })
            );

            jest.clearAllMocks();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================
  // Property 9: Ship Ownership Filtering
  // **Validates: Requirements 4.6**
  // ============================================================
  describe('Property 9: Ship Ownership Filtering', () => {
    it('For ANY agent user, getShips queries with the agent ID filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          async (agentId) => {
            // Return ships belonging to this agent
            ShipModel.findAll.mockResolvedValue([
              { id_kapal: 1, nama_kapal: 'Ship A', loa: 100, id_agen: agentId, agency_name: 'Agency' },
            ]);

            const { req, res } = mockReqRes({}, { id: agentId, role: 'agen' });

            await getShips(req, res);

            // Should call findAll with the agent's ID
            expect(ShipModel.findAll).toHaveBeenCalledWith(agentId);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({ success: true })
            );

            jest.clearAllMocks();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('For ANY admin/petugas user, getShips queries without agent filter (sees all)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          fc.constantFrom('admin', 'petugas'),
          async (userId, role) => {
            // Return all ships
            ShipModel.findAll.mockResolvedValue([
              { id_kapal: 1, nama_kapal: 'Ship A', loa: 100, id_agen: 1, agency_name: 'Agency A' },
              { id_kapal: 2, nama_kapal: 'Ship B', loa: 150, id_agen: 2, agency_name: 'Agency B' },
            ]);

            const { req, res } = mockReqRes({}, { id: userId, role });

            await getShips(req, res);

            // Should call findAll without agent ID (no filter)
            expect(ShipModel.findAll).toHaveBeenCalledWith();
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({ success: true })
            );

            jest.clearAllMocks();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
