const fc = require('fast-check');
const { authorize, ROLES, PERMISSIONS } = require('./role.middleware');

/**
 * Property 3: Role-Based Access Control Enforcement
 *
 * For any authenticated user with a given role and for any API route,
 * access SHALL be granted if and only if the route is within that role's
 * permission set. Unauthenticated requests to protected routes SHALL be
 * denied with 403.
 *
 * **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**
 */

// Helper: create mock req/res/next
function createMocks(user) {
  const req = { user };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  return { req, res, next, wasNextCalled: () => nextCalled };
}

// All defined roles in the system
const ALL_ROLES = Object.values(ROLES);

// All routes defined in the PERMISSIONS matrix
const ALL_ROUTES = Object.keys(PERMISSIONS);

// Arbitraries
const roleArb = fc.constantFrom(...ALL_ROLES);
const routeArb = fc.constantFrom(...ALL_ROUTES);
const invalidRoleArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => !ALL_ROLES.includes(s));

describe('Property 3: Role-Based Access Control Enforcement', () => {
  describe('access granted iff role is in permission set', () => {
    it('should grant access when user role IS in the route permission set', () => {
      fc.assert(
        fc.property(routeArb, (route) => {
          const allowedRoles = PERMISSIONS[route];

          // For each allowed role on this route, access must be granted
          for (const role of allowedRoles) {
            const { req, res, next, wasNextCalled } = createMocks({
              id: 1,
              username: 'testuser',
              role,
              userType: role,
            });

            const middleware = authorize(...allowedRoles);
            middleware(req, res, next);

            if (!wasNextCalled()) {
              return false; // Property violated: should have called next()
            }
            if (res.statusCode !== null) {
              return false; // Property violated: should not have set status
            }
          }
          return true;
        }),
        { numRuns: 200 }
      );
    });

    it('should deny access when user role is NOT in the route permission set', () => {
      fc.assert(
        fc.property(routeArb, roleArb, (route, role) => {
          const allowedRoles = PERMISSIONS[route];

          // Only test when the role is NOT in the allowed set
          if (allowedRoles.includes(role)) {
            return true; // Skip — this combination is allowed
          }

          const { req, res, next, wasNextCalled } = createMocks({
            id: 1,
            username: 'testuser',
            role,
            userType: role,
          });

          const middleware = authorize(...allowedRoles);
          middleware(req, res, next);

          // Must NOT call next
          if (wasNextCalled()) return false;
          // Must return 403
          if (res.statusCode !== 403) return false;
          // Must return proper error structure
          if (!res.body || res.body.success !== false) return false;
          if (res.body.error.code !== 'FORBIDDEN') return false;

          return true;
        }),
        { numRuns: 500 }
      );
    });
  });

  describe('unauthenticated requests are denied', () => {
    it('should return 403 when req.user is null for any route', () => {
      fc.assert(
        fc.property(routeArb, (route) => {
          const allowedRoles = PERMISSIONS[route];
          const { req, res, next, wasNextCalled } = createMocks(null);

          const middleware = authorize(...allowedRoles);
          middleware(req, res, next);

          if (wasNextCalled()) return false;
          if (res.statusCode !== 403) return false;
          if (!res.body || res.body.success !== false) return false;
          if (res.body.error.code !== 'FORBIDDEN') return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return 403 when req.user is undefined for any route', () => {
      fc.assert(
        fc.property(routeArb, (route) => {
          const allowedRoles = PERMISSIONS[route];
          const { req, res, next, wasNextCalled } = createMocks(undefined);

          const middleware = authorize(...allowedRoles);
          middleware(req, res, next);

          if (wasNextCalled()) return false;
          if (res.statusCode !== 403) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return 403 when req.user has no role property for any route', () => {
      fc.assert(
        fc.property(routeArb, (route) => {
          const allowedRoles = PERMISSIONS[route];
          const { req, res, next, wasNextCalled } = createMocks({ id: 1, username: 'test' });

          const middleware = authorize(...allowedRoles);
          middleware(req, res, next);

          if (wasNextCalled()) return false;
          if (res.statusCode !== 403) return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('invalid roles are always denied', () => {
    it('should deny access for any non-system role on any route', () => {
      fc.assert(
        fc.property(routeArb, invalidRoleArb, (route, fakeRole) => {
          const allowedRoles = PERMISSIONS[route];
          const { req, res, next, wasNextCalled } = createMocks({
            id: 1,
            username: 'attacker',
            role: fakeRole,
            userType: fakeRole,
          });

          const middleware = authorize(...allowedRoles);
          middleware(req, res, next);

          if (wasNextCalled()) return false;
          if (res.statusCode !== 403) return false;

          return true;
        }),
        { numRuns: 300 }
      );
    });
  });

  describe('permission matrix completeness', () => {
    it('every route in PERMISSIONS maps to at least one valid role', () => {
      fc.assert(
        fc.property(routeArb, (route) => {
          const allowedRoles = PERMISSIONS[route];
          if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return false;
          return allowedRoles.every(r => ALL_ROLES.includes(r));
        }),
        { numRuns: 100 }
      );
    });

    it('authorize is biconditional: access iff role in allowed set', () => {
      fc.assert(
        fc.property(routeArb, roleArb, (route, role) => {
          const allowedRoles = PERMISSIONS[route];
          const shouldAllow = allowedRoles.includes(role);

          const { req, res, next, wasNextCalled } = createMocks({
            id: 1,
            username: 'user',
            role,
            userType: role,
          });

          const middleware = authorize(...allowedRoles);
          middleware(req, res, next);

          const wasAllowed = wasNextCalled();
          const wasDenied = res.statusCode === 403;

          // Biconditional: allowed iff role in set
          if (shouldAllow && !wasAllowed) return false;
          if (shouldAllow && wasDenied) return false;
          if (!shouldAllow && wasAllowed) return false;
          if (!shouldAllow && !wasDenied) return false;

          return true;
        }),
        { numRuns: 500 }
      );
    });
  });
});
