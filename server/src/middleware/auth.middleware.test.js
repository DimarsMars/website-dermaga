const jwt = require('jsonwebtoken');

// Mock the database pool so the middleware's token_version check is deterministic
jest.mock('../config/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ token_version: 0 }] }),
}));

const pool = require('../config/db');
const { authenticateToken } = require('./auth.middleware');

process.env.JWT_SECRET = 'test-jwt-secret';

function mockReqRes(authHeader) {
  const req = { headers: { authorization: authHeader } };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('Auth Middleware - authenticateToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: every user exists with token_version 0 (matches payload default)
    pool.query.mockResolvedValue({ rows: [{ token_version: 0 }] });
  });

  it('should return 401 if no Authorization header is present', async () => {
    const { req, res, next } = mockReqRes(undefined);

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'AUTH_INVALID' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if Authorization header does not use Bearer scheme', async () => {
    const { req, res, next } = mockReqRes('Basic sometoken');

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for an invalid token', async () => {
    const { req, res, next } = mockReqRes('Bearer invalidtoken');

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'AUTH_INVALID', message: 'Invalid token' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 with AUTH_EXPIRED for an expired token', async () => {
    const token = jwt.sign(
      { id: 1, username: 'test', role: 'agen', userType: 'agen' },
      process.env.JWT_SECRET,
      { expiresIn: '0s' }
    );

    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    // Small delay ensures jwt.verify sees the token as expired
    await new Promise((resolve) => setTimeout(resolve, 10));
    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].error.code).toBe('AUTH_EXPIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() and attach user to req for a valid token with matching version', async () => {
    const payload = {
      id: 5, username: 'agent1', role: 'agen', userType: 'agen',
      tokenVersion: 0,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(5);
    expect(req.user.username).toBe('agent1');
    expect(req.user.role).toBe('agen');
    expect(req.user.userType).toBe('agen');
  });

  it('should correctly decode admin user from token', async () => {
    const payload = {
      id: 2, username: 'admin1', role: 'admin', userType: 'petugas',
      tokenVersion: 0,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('admin');
    expect(req.user.userType).toBe('petugas');
  });

  it('should reject when DB token_version differs from the token (post password-change)', async () => {
    // Simulate the user having incremented their token_version to 1 in DB
    pool.query.mockResolvedValueOnce({ rows: [{ token_version: 1 }] });

    const payload = {
      id: 5, username: 'agent1', role: 'agen', userType: 'agen',
      tokenVersion: 0, // issued BEFORE the password change → must be rejected
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    await authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].error.code).toBe('AUTH_EXPIRED');
  });

  it('should fail-open (still authenticate) on transient DB errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('connection refused'));

    const payload = {
      id: 5, username: 'agent1', role: 'agen', userType: 'agen',
      tokenVersion: 0,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    await authenticateToken(req, res, next);

    // Even though DB check failed, the access token signature is valid.
    // We fail-open to avoid locking out users during a DB blip; short access
    // token TTL plus refresh-token revocation (P1.1) still protect us.
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
  });
});