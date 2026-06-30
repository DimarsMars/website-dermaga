const fc = require('fast-check');
const bcrypt = require('bcrypt');

// Mock the database pool
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../config/db');
const { login } = require('./auth.controller');
const { authorize } = require('../middleware/role.middleware');

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

describe('Auth Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 1: Authentication Error Opacity
   *
   * For any combination of invalid credentials (wrong username, wrong password, or both),
   * the authentication error response SHALL return the same generic error message
   * without revealing which specific field is incorrect.
   *
   * **Validates: Requirements 1.3**
   */
  describe('Property 1: Authentication Error Opacity', () => {
    // Pre-hash a known password for comparison
    const KNOWN_USERNAME = 'validuser';
    const KNOWN_PASSWORD = 'correctpassword123';
    let hashedPassword;

    beforeAll(async () => {
      hashedPassword = await bcrypt.hash(KNOWN_PASSWORD, 4); // low rounds for speed in tests
    });

    it('should return the same error response for any invalid credential combination', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a scenario type: 'wrong_username', 'wrong_password', or 'both_wrong'
          fc.constantFrom('wrong_username', 'wrong_password', 'both_wrong'),
          // Generate random strings for invalid credentials
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s !== KNOWN_USERNAME),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s !== KNOWN_PASSWORD),
          async (scenario, randomUsername, randomPassword) => {
            jest.clearAllMocks();

            let reqBody;

            switch (scenario) {
              case 'wrong_username':
                // Username doesn't exist in either table
                reqBody = { username: randomUsername, password: KNOWN_PASSWORD };
                pool.query
                  .mockResolvedValueOnce({ rows: [] }) // not in master_agen
                  .mockResolvedValueOnce({ rows: [] }); // not in master_petugas
                break;

              case 'wrong_password':
                // Username exists but password is wrong
                reqBody = { username: KNOWN_USERNAME, password: randomPassword };
                pool.query.mockResolvedValueOnce({
                  rows: [{ id_agen: 1, username: KNOWN_USERNAME, password: hashedPassword }],
                });
                break;

              case 'both_wrong':
                // Both username and password are wrong
                reqBody = { username: randomUsername, password: randomPassword };
                pool.query
                  .mockResolvedValueOnce({ rows: [] }) // not in master_agen
                  .mockResolvedValueOnce({ rows: [] }); // not in master_petugas
                break;
            }

            const { req, res } = mockReqRes(reqBody);
            await login(req, res);

            // All invalid credential scenarios must return the same error
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
              success: false,
              error: { code: 'AUTH_INVALID', message: 'Invalid credentials' },
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should never reveal whether the username or password was incorrect', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.string({ minLength: 1, maxLength: 30 }),
          async (username, password) => {
            jest.clearAllMocks();

            // Simulate user not found in either table
            pool.query
              .mockResolvedValueOnce({ rows: [] })
              .mockResolvedValueOnce({ rows: [] });

            const { req, res } = mockReqRes({ username, password });
            await login(req, res);

            // The error message must NOT contain hints about which field is wrong
            const response = res.json.mock.calls[0][0];
            const errorMessage = response.error.message.toLowerCase();
            expect(errorMessage).not.toContain('username');
            expect(errorMessage).not.toContain('password');
            expect(errorMessage).not.toContain('not found');
            expect(errorMessage).not.toContain('user does not exist');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 2: Role-Restricted Account Creation
   *
   * For any user who is not authenticated as Admin, attempting to create a
   * Petugas_Operasional or Admin account SHALL be rejected with a 403 Forbidden response.
   *
   * **Validates: Requirements 1.6, 1.7**
   */
  describe('Property 2: Role-Restricted Account Creation', () => {
    it('should reject create-officer and create-admin for any non-admin role', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate non-admin roles
          fc.constantFrom('agen', 'petugas'),
          // Generate which endpoint to test
          fc.constantFrom('createOfficer', 'createAdmin'),
          async (role, endpoint) => {
            // Create the authorize middleware configured for admin-only
            const middleware = authorize('admin');

            // Simulate a request from a non-admin user
            const req = {
              user: { id: 1, username: 'testuser', role, userType: role },
            };
            const res = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn().mockReturnThis(),
            };
            const next = jest.fn();

            middleware(req, res, next);

            // The middleware should block with 403
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Access denied. Insufficient permissions.',
              },
            });
            // next() should NOT have been called
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject account creation when user has no role set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('createOfficer', 'createAdmin'),
          // Generate various falsy/invalid role values
          fc.constantFrom(null, undefined, '', 'unknown', 'guest', 'user'),
          async (endpoint, invalidRole) => {
            const middleware = authorize('admin');

            const req = {
              user: invalidRole ? { id: 1, username: 'test', role: invalidRole } : null,
            };
            const res = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn().mockReturnThis(),
            };
            const next = jest.fn();

            middleware(req, res, next);

            // Should be rejected with 403
            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should allow admin role to pass the authorize middleware', async () => {
      const middleware = authorize('admin');

      const req = {
        user: { id: 1, username: 'adminuser', role: 'admin', userType: 'petugas' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      // Admin should pass through
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
