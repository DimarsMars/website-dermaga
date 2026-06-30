// Mock the database pool
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../config/db');
const {
  getShips,
  createShip,
  updateShip,
  deleteShip,
  getAgents,
  updateAgent,
  deleteAgent,
  getOfficers,
  updateOfficer,
  deleteOfficer,
} = require('./master.controller');

// Helper to create mock req/res
function mockReqRes(body = {}, user = null, params = {}) {
  const req = { body, user, params };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

describe('Master Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // Ship Tests
  // ============================================================
  describe('getShips', () => {
    it('should return all ships for admin role', async () => {
      const { req, res } = mockReqRes({}, { id: 1, role: 'admin' });
      pool.query.mockResolvedValueOnce({
        rows: [
          { id_kapal: 1, nama_kapal: 'Ship A', loa: 100, id_agen: 1, agency_name: 'Agency A' },
          { id_kapal: 2, nama_kapal: 'Ship B', loa: 150, id_agen: 2, agency_name: 'Agency B' },
        ],
      });

      await getShips(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id_kapal: 1 }),
          expect.objectContaining({ id_kapal: 2 }),
        ]),
      });
    });

    it('should return only agent-owned ships for agen role', async () => {
      const { req, res } = mockReqRes({}, { id: 5, role: 'agen' });
      pool.query.mockResolvedValueOnce({
        rows: [{ id_kapal: 3, nama_kapal: 'My Ship', loa: 80, id_agen: 5, agency_name: 'My Agency' }],
      });

      await getShips(req, res);

      // Verify the query was called with the agent's ID
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE mk.id_agen = $1'),
        [5]
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [expect.objectContaining({ id_kapal: 3, id_agen: 5 })],
      });
    });
  });

  describe('createShip', () => {
    it('should create a ship with valid data', async () => {
      const { req, res } = mockReqRes(
        { nama_kapal: 'New Ship', loa: 120, id_agen: 1, gt: 5000 },
        { id: 1, role: 'admin' }
      );

      // Agent exists check
      pool.query.mockResolvedValueOnce({
        rows: [{ id_agen: 1, username: 'agent1', agency_name: 'Agency' }],
      });
      // Insert
      pool.query.mockResolvedValueOnce({
        rows: [{ id_kapal: 10, nama_kapal: 'New Ship', loa: 120, id_agen: 1, gt: 5000, created_at: new Date().toISOString() }],
      });

      await createShip(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id_kapal: 10, nama_kapal: 'New Ship' }),
      });
    });

    it('should reject ship creation with missing required fields', async () => {
      const { req, res } = mockReqRes(
        { nama_kapal: 'Ship' }, // missing loa and id_agen
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
    });

    it('should reject ship creation with non-existent agent', async () => {
      const { req, res } = mockReqRes(
        { nama_kapal: 'Ship', loa: 100, id_agen: 999 },
        { id: 1, role: 'admin' }
      );

      // Agent does not exist
      pool.query.mockResolvedValueOnce({ rows: [] });

      await createShip(req, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Referenced agent does not exist' }),
        })
      );
    });
  });

  describe('updateShip', () => {
    it('should update a ship with valid data', async () => {
      const { req, res } = mockReqRes(
        { nama_kapal: 'Updated Ship', loa: 130, id_agen: 1 },
        { id: 1, role: 'admin' },
        { id: '5' }
      );

      // Agent exists
      pool.query.mockResolvedValueOnce({
        rows: [{ id_agen: 1, username: 'agent1', agency_name: 'Agency' }],
      });
      // Update
      pool.query.mockResolvedValueOnce({
        rows: [{ id_kapal: 5, nama_kapal: 'Updated Ship', loa: 130, id_agen: 1 }],
      });

      await updateShip(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id_kapal: 5, nama_kapal: 'Updated Ship' }),
      });
    });

    it('should return 404 for non-existent ship', async () => {
      const { req, res } = mockReqRes(
        { nama_kapal: 'Ship', loa: 100, id_agen: 1 },
        { id: 1, role: 'admin' },
        { id: '999' }
      );

      // Agent exists
      pool.query.mockResolvedValueOnce({
        rows: [{ id_agen: 1, username: 'agent1', agency_name: 'Agency' }],
      });
      // Ship not found
      pool.query.mockResolvedValueOnce({ rows: [] });

      await updateShip(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteShip', () => {
    it('should delete a ship with no bookings', async () => {
      const { req, res } = mockReqRes({}, { id: 1, role: 'admin' }, { id: '5' });

      // Ship exists
      pool.query.mockResolvedValueOnce({
        rows: [{ id_kapal: 5, nama_kapal: 'Ship', loa: 100, id_agen: 1, agency_name: 'Agency' }],
      });
      // No bookings
      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Delete
      pool.query.mockResolvedValueOnce({ rows: [{ id_kapal: 5 }] });

      await deleteShip(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Ship deleted successfully',
      });
    });

    it('should reject deletion of ship with existing bookings', async () => {
      const { req, res } = mockReqRes({}, { id: 1, role: 'admin' }, { id: '5' });

      // Ship exists
      pool.query.mockResolvedValueOnce({
        rows: [{ id_kapal: 5, nama_kapal: 'Ship', loa: 100, id_agen: 1, agency_name: 'Agency' }],
      });
      // Has bookings
      pool.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });

      await deleteShip(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTEGRITY_CONSTRAINT',
          message: 'Cannot delete ship with existing bookings',
        },
      });
    });

    it('should return 404 for non-existent ship', async () => {
      const { req, res } = mockReqRes({}, { id: 1, role: 'admin' }, { id: '999' });

      // Ship not found
      pool.query.mockResolvedValueOnce({ rows: [] });

      await deleteShip(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ============================================================
  // Agent Tests
  // ============================================================
  describe('getAgents', () => {
    it('should return all agents', async () => {
      const { req, res } = mockReqRes({}, { id: 1, role: 'admin' });
      pool.query.mockResolvedValueOnce({
        rows: [
          { id_agen: 1, username: 'agent1', agency_name: 'Agency A' },
          { id_agen: 2, username: 'agent2', agency_name: 'Agency B' },
        ],
      });

      await getAgents(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id_agen: 1 }),
          expect.objectContaining({ id_agen: 2 }),
        ]),
      });
    });
  });

  describe('updateAgent', () => {
    it('should update an agent with valid data', async () => {
      const { req, res } = mockReqRes(
        { username: 'updated_agent', agency_name: 'Updated Agency' },
        { id: 1, role: 'admin' },
        { id: '2' }
      );

      // Username not taken
      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Update
      pool.query.mockResolvedValueOnce({
        rows: [{ id_agen: 2, username: 'updated_agent', agency_name: 'Updated Agency' }],
      });

      await updateAgent(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id_agen: 2, username: 'updated_agent' }),
      });
    });

    it('should reject update with duplicate username', async () => {
      const { req, res } = mockReqRes(
        { username: 'taken_name', agency_name: 'Agency' },
        { id: 1, role: 'admin' },
        { id: '2' }
      );

      // Username already taken
      pool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await updateAgent(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('deleteAgent', () => {
    it('should delete an agent with no ships or bookings', async () => {
      const { req, res } = mockReqRes({}, { id: 1, role: 'admin' }, { id: '3' });

      // Agent exists
      pool.query.mockResolvedValueOnce({
        rows: [{ id_agen: 3, username: 'agent3', agency_name: 'Agency C' }],
      });
      // No ships
      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // No bookings
      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Delete
      pool.query.mockResolvedValueOnce({ rows: [{ id_agen: 3 }] });

      await deleteAgent(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Agent deleted successfully',
      });
    });

    it('should reject deletion of agent with ships', async () => {
      const { req, res } = mockReqRes({}, { id: 1, role: 'admin' }, { id: '3' });

      // Agent exists
      pool.query.mockResolvedValueOnce({
        rows: [{ id_agen: 3, username: 'agent3', agency_name: 'Agency C' }],
      });
      // Has ships
      pool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });

      await deleteAgent(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTEGRITY_CONSTRAINT',
          message: 'Cannot delete agent with existing ships',
        },
      });
    });
  });

  // ============================================================
  // Officer Tests
  // ============================================================
  describe('getOfficers', () => {
    it('should return all officers', async () => {
      const { req, res } = mockReqRes({}, { id: 1, role: 'admin' });
      pool.query.mockResolvedValueOnce({
        rows: [
          { id_petugas: 1, employee_id: 'EMP001', username: 'officer1', name: 'Officer One', user_role: 'petugas' },
        ],
      });

      await getOfficers(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [expect.objectContaining({ id_petugas: 1, employee_id: 'EMP001' })],
      });
    });
  });

  describe('updateOfficer', () => {
    it('should update an officer with valid data', async () => {
      const { req, res } = mockReqRes(
        { employee_id: 'EMP002', username: 'officer_updated', name: 'Updated Officer', user_role: 'petugas' },
        { id: 1, role: 'admin' },
        { id: '1' }
      );

      // Employee ID not taken
      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Username not taken
      pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Update
      pool.query.mockResolvedValueOnce({
        rows: [{ id_petugas: 1, employee_id: 'EMP002', username: 'officer_updated', name: 'Updated Officer', user_role: 'petugas' }],
      });

      await updateOfficer(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ id_petugas: 1, username: 'officer_updated' }),
      });
    });

    it('should reject update with duplicate employee_id', async () => {
      const { req, res } = mockReqRes(
        { employee_id: 'EMP001', username: 'officer2', name: 'Officer', user_role: 'petugas' },
        { id: 1, role: 'admin' },
        { id: '2' }
      );

      // Employee ID already taken
      pool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await updateOfficer(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('deleteOfficer', () => {
    it('should delete an officer', async () => {
      const { req, res } = mockReqRes({}, { id: 1, role: 'admin' }, { id: '2' });

      // Officer exists
      pool.query.mockResolvedValueOnce({
        rows: [{ id_petugas: 2, employee_id: 'EMP002', username: 'officer2', name: 'Officer Two' }],
      });
      // Delete
      pool.query.mockResolvedValueOnce({
        rows: [{ id_petugas: 2, username: 'officer2', name: 'Officer Two' }],
      });

      await deleteOfficer(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Officer deleted successfully',
      });
    });

    it('should return 404 for non-existent officer', async () => {
      const { req, res } = mockReqRes({}, { id: 1, role: 'admin' }, { id: '999' });

      // Officer not found
      pool.query.mockResolvedValueOnce({ rows: [] });

      await deleteOfficer(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
