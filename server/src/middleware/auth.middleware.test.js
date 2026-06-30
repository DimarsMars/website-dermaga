const jwt = require('jsonwebtoken');
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
  it('should return 401 if no Authorization header is present', () => {
    const { req, res, next } = mockReqRes(undefined);

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'AUTH_INVALID' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if Authorization header does not use Bearer scheme', () => {
    const { req, res, next } = mockReqRes('Basic sometoken');

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for an invalid token', () => {
    const { req, res, next } = mockReqRes('Bearer invalidtoken');

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'AUTH_INVALID', message: 'Invalid token' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 with AUTH_EXPIRED for an expired token', () => {
    const token = jwt.sign(
      { id: 1, username: 'test', role: 'agen', userType: 'agen' },
      process.env.JWT_SECRET,
      { expiresIn: '0s' } // immediately expired
    );

    // Small delay to ensure token is expired
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    // Need a tiny delay for the token to actually expire
    setTimeout(() => {
      authenticateToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json.mock.calls[0][0].error.code).toBe('AUTH_EXPIRED');
    }, 10);
  });

  it('should call next() and attach user to req for a valid token', () => {
    const payload = { id: 5, username: 'agent1', role: 'agen', userType: 'agen' };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(5);
    expect(req.user.username).toBe('agent1');
    expect(req.user.role).toBe('agen');
    expect(req.user.userType).toBe('agen');
  });

  it('should correctly decode admin user from token', () => {
    const payload = { id: 2, username: 'admin1', role: 'admin', userType: 'petugas' };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('admin');
    expect(req.user.userType).toBe('petugas');
  });
});
