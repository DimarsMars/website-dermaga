const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock the database pool
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

// Mock the email transporter so resetPassword tests don't try to really send mail
jest.mock('../config/email', () => ({
  sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
}));

// Mock RefreshTokenService so login/refresh/changePassword don't touch the DB.
// Each test that needs it can override these defaults with mockResolvedValueOnce.
jest.mock('../services/refreshToken.service', () => ({
  issue: jest.fn().mockResolvedValue('mock-refresh-token'),
  rotate: jest.fn(),
  revoke: jest.fn().mockResolvedValue(true),
  revokeAllForUser: jest.fn().mockResolvedValue(0),
}));

const pool = require('../config/db');
const RefreshTokenService = require('../services/refreshToken.service');
const { register, login, resetPassword, createOfficer, createAdmin, refreshToken, logout, changePassword } = require('./auth.controller');

// Set environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// Helper to create mock req/res
function mockReqRes(body = {}, user = null) {
  const req = { body, user };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new agent successfully', async () => {
      const { req, res } = mockReqRes({
        username: 'newagent',
        password: 'securepass123',
        agency_name: 'Test Agency',
        email: 'test@agency.com',
      });

      pool.query
        .mockResolvedValueOnce({ rows: [] }) // username check
        .mockResolvedValueOnce({ rows: [] }) // email check
        .mockResolvedValueOnce({
          rows: [{ id_agen: 1, username: 'newagent', agency_name: 'Test Agency', email: 'test@agency.com', created_at: new Date().toISOString() }],
        }); // insert

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('should reject registration with existing username', async () => {
      const { req, res } = mockReqRes({
        username: 'existinguser',
        password: 'password123',
        agency_name: 'Agency',
        email: 'a@example.com',
      });

      pool.query.mockResolvedValueOnce({ rows: [{ id_agen: 1 }] }); // username exists

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'VALIDATION_FIELDS' }),
        })
      );
    });

    it('should reject registration with existing email', async () => {
      const { req, res } = mockReqRes({
        username: 'anotheruser',
        password: 'password123',
        agency_name: 'Agency',
        email: 'taken@agency.com',
      });

      pool.query
        .mockResolvedValueOnce({ rows: [] }) // username check passes
        .mockResolvedValueOnce({ rows: [{ id_agen: 5 }] }); // email already exists

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: 'Email already registered' }),
        })
      );
    });
  });

  describe('login', () => {
    it('should login an agent with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('correctpass', 12);
      const { req, res } = mockReqRes({
        username: 'agent1',
        password: 'correctpass',
      });

      pool.query.mockResolvedValueOnce({
        rows: [{ id_agen: 1, username: 'agent1', password: hashedPassword }],
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.accessToken).toBeDefined();
      expect(responseData.data.refreshToken).toBeDefined();
      expect(responseData.data.user.role).toBe('agen');
      expect(responseData.data.user.userType).toBe('agen');
    });

    it('should login a petugas with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('officerpass', 12);
      const { req, res } = mockReqRes({
        username: 'officer1',
        password: 'officerpass',
      });

      pool.query
        .mockResolvedValueOnce({ rows: [] }) // not in master_agen
        .mockResolvedValueOnce({
          rows: [{ id_petugas: 5, username: 'officer1', password: hashedPassword, user_role: 'petugas' }],
        });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.user.role).toBe('petugas');
      expect(responseData.data.user.userType).toBe('petugas');
    });

    it('should return generic error for non-existent username', async () => {
      const { req, res } = mockReqRes({
        username: 'nonexistent',
        password: 'anypass',
      });

      pool.query
        .mockResolvedValueOnce({ rows: [] }) // not in master_agen
        .mockResolvedValueOnce({ rows: [] }); // not in master_petugas

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'AUTH_INVALID', message: 'Invalid credentials' },
      });
    });

    it('should return generic error for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correctpass', 12);
      const { req, res } = mockReqRes({
        username: 'agent1',
        password: 'wrongpass',
      });

      pool.query.mockResolvedValueOnce({
        rows: [{ id_agen: 1, username: 'agent1', password: hashedPassword }],
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'AUTH_INVALID', message: 'Invalid credentials' },
      });
    });

    it('should return same error message for wrong username and wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correctpass', 12);

      // Wrong username
      const { req: req1, res: res1 } = mockReqRes({ username: 'wrong', password: 'any' });
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      await login(req1, res1);

      // Wrong password
      const { req: req2, res: res2 } = mockReqRes({ username: 'agent1', password: 'wrong' });
      pool.query.mockResolvedValueOnce({
        rows: [{ id_agen: 1, username: 'agent1', password: hashedPassword }],
      });
      await login(req2, res2);

      // Both should have same error message
      const error1 = res1.json.mock.calls[0][0].error;
      const error2 = res2.json.mock.calls[0][0].error;
      expect(error1.message).toBe(error2.message);
      expect(error1.code).toBe(error2.code);
    });

    it('should include correct JWT payload fields', async () => {
      const hashedPassword = await bcrypt.hash('pass123', 12);
      const { req, res } = mockReqRes({ username: 'agent1', password: 'pass123' });

      pool.query.mockResolvedValueOnce({
        rows: [{ id_agen: 7, username: 'agent1', password: hashedPassword }],
      });

      await login(req, res);

      const { accessToken } = res.json.mock.calls[0][0].data;
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
      expect(decoded.id).toBe(7);
      expect(decoded.username).toBe('agent1');
      expect(decoded.role).toBe('agen');
      expect(decoded.userType).toBe('agen');
    });
  });

  describe('resetPassword', () => {
    it('should return success regardless of whether email exists', async () => {
      // Email exists in master_agen
      const { req: req1, res: res1 } = mockReqRes({ email: 'exists@test.com' });
      pool.query
        .mockResolvedValueOnce({ rows: [{ id_agen: 1, email: 'exists@test.com' }] }) // agen check
        .mockResolvedValueOnce({ rows: [] }); // UPDATE reset_token
      await resetPassword(req1, res1);
      expect(res1.status).toHaveBeenCalledWith(200);
      expect(res1.json.mock.calls[0][0].success).toBe(true);

      // Email does not exist in either table
      const { req: req2, res: res2 } = mockReqRes({ email: 'noexist@test.com' });
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // agen check (not found)
        .mockResolvedValueOnce({ rows: [] }); // petugas check (not found)
      await resetPassword(req2, res2);
      expect(res2.status).toHaveBeenCalledWith(200);
      expect(res2.json.mock.calls[0][0].success).toBe(true);
    });
  });

  describe('createOfficer', () => {
    it('should create a new officer with petugas role', async () => {
      const { req, res } = mockReqRes({
        employee_id: 'EMP001',
        username: 'officer1',
        password: 'officerpass',
        name: 'Officer One',
        email: 'officer@example.com',
        phone_number: '08123456789',
      });

      pool.query
        .mockResolvedValueOnce({ rows: [] }) // username/employee_id check
        .mockResolvedValueOnce({ rows: [] }) // email check
        .mockResolvedValueOnce({
          rows: [{ id_petugas: 1, employee_id: 'EMP001', username: 'officer1', name: 'Officer One', phone_number: '08123456789', email: 'officer@example.com', user_role: 'petugas', created_at: new Date().toISOString() }],
        }); // insert

      await createOfficer(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json.mock.calls[0][0].data.user_role).toBe('petugas');
    });

    it('should reject if username or employee_id already exists', async () => {
      const { req, res } = mockReqRes({
        employee_id: 'EMP001',
        username: 'existing',
        password: 'password123',
        name: 'Test',
        email: 'test@example.com',
      });

      pool.query.mockResolvedValueOnce({ rows: [{ id_petugas: 1 }] });

      await createOfficer(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('createAdmin', () => {
    it('should create a new admin account', async () => {
      const { req, res } = mockReqRes({
        employee_id: 'ADM001',
        username: 'admin2',
        password: 'adminpass',
        name: 'Admin Two',
        email: 'admin2@example.com',
      });

      pool.query
        .mockResolvedValueOnce({ rows: [] }) // username/employee_id check
        .mockResolvedValueOnce({ rows: [] }) // email check
        .mockResolvedValueOnce({
          rows: [{ id_petugas: 2, employee_id: 'ADM001', username: 'admin2', name: 'Admin Two', phone_number: null, email: 'admin2@example.com', user_role: 'admin', created_at: new Date().toISOString() }],
        }); // insert

      await createAdmin(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json.mock.calls[0][0].data.user_role).toBe('admin');
    });
  });

  describe('login (refresh token issuance)', () => {
    it('should issue a refresh token from RefreshTokenService on successful login', async () => {
      const hashedPassword = await bcrypt.hash('correctpass', 12);
      const { req, res } = mockReqRes({
        username: 'agent1',
        password: 'correctpass',
      });

      pool.query.mockResolvedValueOnce({
        rows: [{ id_agen: 1, username: 'agent1', password: hashedPassword }],
      });

      // Override default mock to return a plausible-looking refresh token JWT
      RefreshTokenService.issue.mockResolvedValueOnce('fresh-refresh-jwt');

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBe('fresh-refresh-jwt');
      // RefreshTokenService.issue should be called with the correct payload
      expect(RefreshTokenService.issue).toHaveBeenCalledTimes(1);
      const issuedPayload = RefreshTokenService.issue.mock.calls[0][0];
      expect(issuedPayload.id).toBe(1);
      expect(issuedPayload.role).toBe('agen');
    });
  });

  describe('refreshToken (rotation)', () => {
    it('should return new access + refresh tokens on successful rotation', async () => {
      const { req, res } = mockReqRes({ refreshToken: 'old-valid-refresh-jwt' });

      RefreshTokenService.rotate.mockResolvedValueOnce({
        payload: { id: 7, username: 'agent1', role: 'agen', userType: 'agen' },
        newAccessToken: 'new-access-jwt',
        newRefreshToken: 'new-refresh-jwt',
      });

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.accessToken).toBe('new-access-jwt');
      expect(data.refreshToken).toBe('new-refresh-jwt');
      expect(data.user.id).toBe(7);
      expect(RefreshTokenService.rotate).toHaveBeenCalledWith('old-valid-refresh-jwt');
    });

    it('should return 401 AUTH_EXPIRED when rotate throws a TokenError', async () => {
      const { req, res } = mockReqRes({ refreshToken: 'stale-jwt' });

      const err = new Error('Refresh token has been revoked');
      err.code = 'AUTH_EXPIRED';
      RefreshTokenService.rotate.mockRejectedValueOnce(err);

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json.mock.calls[0][0].error.code).toBe('AUTH_EXPIRED');
    });

    it('should reject when no refresh token supplied', async () => {
      const { req, res } = mockReqRes({});

      const err = new Error('Refresh token required');
      err.code = 'AUTH_INVALID';
      RefreshTokenService.rotate.mockRejectedValueOnce(err);

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json.mock.calls[0][0].error.code).toBe('AUTH_INVALID');
    });
  });

  describe('logout', () => {
    it('should revoke the refresh token and return 200', async () => {
      const { req, res } = mockReqRes({ refreshToken: 'token-to-revoke' }, { id: 1, role: 'agen' });

      RefreshTokenService.revoke.mockResolvedValueOnce(true);

      await logout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(RefreshTokenService.revoke).toHaveBeenCalledWith('token-to-revoke');
    });

    it('should reject when no refresh token supplied', async () => {
      const { req, res } = mockReqRes({}, { id: 1, role: 'agen' });

      await logout(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('changePassword (refresh token revocation)', () => {
    it('should revoke all refresh tokens for the user after password change', async () => {
      const hashedPassword = await bcrypt.hash('oldpassword123', 12);
      const { req, res } = mockReqRes(
        { oldPassword: 'oldpassword123', newPassword: 'newpassword123' },
        { id: 5, role: 'petugas' }
      );

      pool.query
        .mockResolvedValueOnce({ rows: [{ password: hashedPassword }] }) // SELECT current password
        .mockResolvedValueOnce({ rows: [] }); // UPDATE new password

      RefreshTokenService.revokeAllForUser.mockResolvedValueOnce(3);

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(RefreshTokenService.revokeAllForUser).toHaveBeenCalledWith(5, 'petugas');
    });
  });
});
