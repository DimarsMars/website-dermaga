const { authorize, ROLES, PERMISSIONS } = require('./role.middleware');

function mockReqRes(userRole) {
  const req = { user: userRole ? { id: 1, username: 'testuser', role: userRole, userType: userRole } : null };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('Role Middleware - authorize', () => {
  describe('allows access for authorized roles', () => {
    it('should call next() when user role is in allowed roles (single role)', () => {
      const { req, res, next } = mockReqRes('agen');
      const middleware = authorize('agen');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() when user role is in allowed roles (multiple roles)', () => {
      const { req, res, next } = mockReqRes('petugas');
      const middleware = authorize('petugas', 'admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() for admin when all roles are allowed', () => {
      const { req, res, next } = mockReqRes('admin');
      const middleware = authorize('agen', 'petugas', 'admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('denies access for unauthorized roles', () => {
    it('should return 403 when user role is not in allowed roles', () => {
      const { req, res, next } = mockReqRes('agen');
      const middleware = authorize('petugas', 'admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. Insufficient permissions.',
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when petugas tries to access agen-only route', () => {
      const { req, res, next } = mockReqRes('petugas');
      const middleware = authorize('agen');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when agen tries to access admin-only route', () => {
      const { req, res, next } = mockReqRes('agen');
      const middleware = authorize('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('handles missing user or role', () => {
    it('should return 403 when req.user is null', () => {
      const { req, res, next } = mockReqRes(null);
      req.user = null;
      const middleware = authorize('agen');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied. Insufficient permissions.',
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when req.user.role is undefined', () => {
      const { req, res, next } = mockReqRes(null);
      req.user = { id: 1, username: 'test' }; // no role property
      const middleware = authorize('agen');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('permission matrix coverage', () => {
    it('should have all three roles defined', () => {
      expect(ROLES.AGEN).toBe('agen');
      expect(ROLES.PETUGAS).toBe('petugas');
      expect(ROLES.ADMIN).toBe('admin');
    });

    it('should define permissions for booking routes', () => {
      expect(PERMISSIONS['POST /api/bookings']).toEqual(['agen']);
      expect(PERMISSIONS['PUT /api/bookings/:id/approve']).toEqual(['petugas', 'admin']);
      expect(PERMISSIONS['PUT /api/bookings/:id/reject']).toEqual(['petugas', 'admin']);
    });

    it('should define permissions for master data routes', () => {
      expect(PERMISSIONS['POST /api/ships']).toEqual(['admin']);
      expect(PERMISSIONS['GET /api/agents']).toEqual(['admin']);
      expect(PERMISSIONS['DELETE /api/officers/:id']).toEqual(['admin']);
    });

    it('should allow all roles for notification and activity routes', () => {
      expect(PERMISSIONS['GET /api/notifications']).toEqual(['agen', 'petugas', 'admin']);
      expect(PERMISSIONS['GET /api/activity']).toEqual(['agen', 'petugas', 'admin']);
      expect(PERMISSIONS['GET /api/activity/export/pdf']).toEqual(['agen', 'petugas', 'admin']);
    });

    it('should restrict manual booking to petugas and admin', () => {
      expect(PERMISSIONS['POST /api/bookings/manual']).toEqual(['petugas', 'admin']);
    });

    it('should restrict extend time request to agen only', () => {
      expect(PERMISSIONS['POST /api/bookings/:id/extend']).toEqual(['agen']);
    });

    it('should restrict extend time approval to petugas and admin', () => {
      expect(PERMISSIONS['PUT /api/bookings/:id/extend/approve']).toEqual(['petugas', 'admin']);
    });
  });

  describe('role-specific access patterns', () => {
    const allRoles = ['agen', 'petugas', 'admin'];

    it('agen can access booking list but not approve/reject', () => {
      // Can access GET bookings
      const { req: req1, res: res1, next: next1 } = mockReqRes('agen');
      authorize('agen', 'petugas', 'admin')(req1, res1, next1);
      expect(next1).toHaveBeenCalled();

      // Cannot approve
      const { req: req2, res: res2, next: next2 } = mockReqRes('agen');
      authorize('petugas', 'admin')(req2, res2, next2);
      expect(res2.status).toHaveBeenCalledWith(403);
    });

    it('petugas can approve/reject but cannot submit pre-booking', () => {
      // Can approve
      const { req: req1, res: res1, next: next1 } = mockReqRes('petugas');
      authorize('petugas', 'admin')(req1, res1, next1);
      expect(next1).toHaveBeenCalled();

      // Cannot submit pre-booking (agen only)
      const { req: req2, res: res2, next: next2 } = mockReqRes('petugas');
      authorize('agen')(req2, res2, next2);
      expect(res2.status).toHaveBeenCalledWith(403);
    });

    it('admin has access to admin-only routes', () => {
      const { req, res, next } = mockReqRes('admin');
      authorize('admin')(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
