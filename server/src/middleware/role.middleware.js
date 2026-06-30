/**
 * Role-Based Access Control (RBAC) middleware.
 *
 * Must be used AFTER auth.middleware.js so that req.user is available.
 * Accepts one or more allowed roles and checks req.user.role against them.
 *
 * Usage:
 *   const { authorize } = require('../middleware/role.middleware');
 *   router.post('/bookings', authenticateToken, authorize('agen'), controller.create);
 *   router.put('/bookings/:id/approve', authenticateToken, authorize('petugas', 'admin'), controller.approve);
 */

// Valid roles in the system
const ROLES = {
  AGEN: 'agen',
  PETUGAS: 'petugas',
  ADMIN: 'admin',
};

/**
 * Permission matrix mapping routes/actions to allowed roles.
 * Used as documentation and can be referenced for property-based tests.
 */
const PERMISSIONS = {
  // Bookings
  'GET /api/bookings': [ROLES.AGEN, ROLES.PETUGAS, ROLES.ADMIN],
  'POST /api/bookings': [ROLES.AGEN],
  'POST /api/bookings/manual': [ROLES.PETUGAS, ROLES.ADMIN],
  'PUT /api/bookings/:id': [ROLES.PETUGAS, ROLES.ADMIN],
  'PUT /api/bookings/:id/approve': [ROLES.PETUGAS, ROLES.ADMIN],
  'PUT /api/bookings/:id/reject': [ROLES.PETUGAS, ROLES.ADMIN],
  'PUT /api/bookings/:id/position': [ROLES.PETUGAS, ROLES.ADMIN],
  'POST /api/bookings/:id/extend': [ROLES.AGEN],
  'PUT /api/bookings/:id/extend/approve': [ROLES.PETUGAS, ROLES.ADMIN],

  // Ships
  'GET /api/ships': [ROLES.AGEN, ROLES.PETUGAS, ROLES.ADMIN],
  'POST /api/ships': [ROLES.ADMIN],
  'PUT /api/ships/:id': [ROLES.ADMIN],
  'DELETE /api/ships/:id': [ROLES.ADMIN],

  // Agents
  'GET /api/agents': [ROLES.ADMIN],
  'POST /api/agents': [ROLES.ADMIN],
  'PUT /api/agents/:id': [ROLES.ADMIN],
  'DELETE /api/agents/:id': [ROLES.ADMIN],

  // Officers
  'GET /api/officers': [ROLES.ADMIN],
  'POST /api/officers': [ROLES.ADMIN],
  'PUT /api/officers/:id': [ROLES.ADMIN],
  'DELETE /api/officers/:id': [ROLES.ADMIN],

  // Notifications
  'GET /api/notifications': [ROLES.AGEN, ROLES.PETUGAS, ROLES.ADMIN],
  'PUT /api/notifications/:id/read': [ROLES.AGEN, ROLES.PETUGAS, ROLES.ADMIN],

  // Activity
  'GET /api/activity': [ROLES.AGEN, ROLES.PETUGAS, ROLES.ADMIN],
  'GET /api/activity/export/pdf': [ROLES.AGEN, ROLES.PETUGAS, ROLES.ADMIN],
};

/**
 * Creates a middleware that checks if the authenticated user's role
 * is included in the list of allowed roles.
 *
 * @param  {...string} allowedRoles - Roles permitted to access the route
 * @returns {Function} Express middleware function
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    // req.user should be set by auth.middleware.js
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. Insufficient permissions.',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. Insufficient permissions.',
        },
      });
    }

    next();
  };
}

module.exports = { authorize, ROLES, PERMISSIONS };
