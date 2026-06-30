const fc = require('fast-check');

jest.mock('../models/activity.model');
const ActivityModel = require('../models/activity.model');
const { ActivityService, ACTIVITY_TYPES } = require('./activity.service');

/**
 * Property-Based Tests for Activity Log Service
 *
 * Property 13: Activity Log Completeness and Structure
 * Property 14: Activity Log Access Control
 *
 * Validates: Requirements 6.4, 10.1, 10.2, 10.3, 10.4
 */
describe('Activity Service - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 10.1, 10.4**
   *
   * Property 13: Activity Log Completeness and Structure
   * For any qualifying action, the system SHALL create an Activity_Log entry
   * containing: timestamp, user identifier, user type, action type, and description.
   */
  describe('Property 13: Activity Log Completeness and Structure', () => {
    it('ACTIVITY_TYPES defines all required activity types', () => {
      const requiredTypes = [
        'LOGIN',
        'REGISTER',
        'BOOKING_CREATED',
        'BOOKING_APPROVED',
        'BOOKING_REJECTED',
        'BOOKING_EXTENDED',
        'POSITION_EDITED',
        'SHIP_CREATED',
        'SHIP_UPDATED',
        'SHIP_DELETED',
        'AGENT_CREATED',
        'AGENT_UPDATED',
        'AGENT_DELETED',
        'OFFICER_CREATED',
        'OFFICER_UPDATED',
        'OFFICER_DELETED',
      ];

      for (const type of requiredTypes) {
        expect(ACTIVITY_TYPES).toHaveProperty(type);
        expect(typeof ACTIVITY_TYPES[type]).toBe('string');
        expect(ACTIVITY_TYPES[type].length).toBeGreaterThan(0);
      }
    });

    it('logActivity creates an entry with id_user, user_type, activity_type, keterangan for any valid input', async () => {
      const userTypeArb = fc.constantFrom('agen', 'petugas', 'admin');
      const activityTypeArb = fc.constantFrom(...Object.values(ACTIVITY_TYPES));

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          userTypeArb,
          activityTypeArb,
          fc.string({ minLength: 1, maxLength: 200 }),
          async (userId, userType, activityType, keterangan) => {
            ActivityModel.create.mockReset();
            ActivityModel.create.mockResolvedValueOnce({
              id_log: 1,
              id_user: userId,
              user_type: userType,
              activity_type: activityType,
              keterangan,
              date_time: new Date().toISOString(),
            });

            await ActivityService.logActivity(userId, userType, activityType, keterangan);

            expect(ActivityModel.create).toHaveBeenCalledTimes(1);
            expect(ActivityModel.create).toHaveBeenCalledWith({
              id_user: userId,
              user_type: userType,
              activity_type: activityType,
              keterangan,
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('logActivity always passes exactly four required fields to ActivityModel.create', async () => {
      const userTypeArb = fc.constantFrom('agen', 'petugas', 'admin');
      const activityTypeArb = fc.constantFrom(...Object.values(ACTIVITY_TYPES));

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          userTypeArb,
          activityTypeArb,
          fc.string({ minLength: 1, maxLength: 200 }),
          async (userId, userType, activityType, keterangan) => {
            ActivityModel.create.mockReset();
            ActivityModel.create.mockResolvedValueOnce({
              id_log: 1,
              id_user: userId,
              user_type: userType,
              activity_type: activityType,
              keterangan,
              date_time: new Date().toISOString(),
            });

            await ActivityService.logActivity(userId, userType, activityType, keterangan);

            const callArgs = ActivityModel.create.mock.calls[0][0];
            expect(callArgs).toHaveProperty('id_user');
            expect(callArgs).toHaveProperty('user_type');
            expect(callArgs).toHaveProperty('activity_type');
            expect(callArgs).toHaveProperty('keterangan');
            expect(Object.keys(callArgs)).toHaveLength(4);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 10.2, 10.3**
   *
   * Property 14: Activity Log Access Control
   * For any Agen_Kapal user, the visible Activity_Log entries SHALL contain only
   * entries related to that agent's own actions. For any Petugas_Operasional or
   * Admin user, all Activity_Log entries SHALL be visible.
   */
  describe('Property 14: Activity Log Access Control', () => {
    it('getActivityLogs for agen role calls findFiltered with userId and userType=agen', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          fc.record({
            startDate: fc.option(fc.constant('2024-01-01'), { nil: undefined }),
            endDate: fc.option(fc.constant('2024-12-31'), { nil: undefined }),
            activityType: fc.option(fc.constantFrom(...Object.values(ACTIVITY_TYPES)), { nil: undefined }),
          }),
          async (userId, filters) => {
            ActivityModel.findFiltered.mockReset();
            ActivityModel.findFiltered.mockResolvedValueOnce([]);

            const user = { id: userId, role: 'agen' };
            await ActivityService.getActivityLogs(user, filters);

            expect(ActivityModel.findFiltered).toHaveBeenCalledTimes(1);
            const callArgs = ActivityModel.findFiltered.mock.calls[0][0];
            expect(callArgs.userId).toBe(userId);
            expect(callArgs.userType).toBe('agen');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('getActivityLogs for petugas role calls findFiltered WITHOUT userId filter (sees all)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          fc.record({
            startDate: fc.option(fc.constant('2024-01-01'), { nil: undefined }),
            endDate: fc.option(fc.constant('2024-12-31'), { nil: undefined }),
            activityType: fc.option(fc.constantFrom(...Object.values(ACTIVITY_TYPES)), { nil: undefined }),
          }),
          async (userId, filters) => {
            ActivityModel.findFiltered.mockReset();
            ActivityModel.findFiltered.mockResolvedValueOnce([]);

            const user = { id: userId, role: 'petugas' };
            await ActivityService.getActivityLogs(user, filters);

            expect(ActivityModel.findFiltered).toHaveBeenCalledTimes(1);
            const callArgs = ActivityModel.findFiltered.mock.calls[0][0];
            expect(callArgs.userId).toBeUndefined();
            expect(callArgs.userType).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('getActivityLogs for admin role calls findFiltered WITHOUT userId filter (sees all)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          fc.record({
            startDate: fc.option(fc.constant('2024-01-01'), { nil: undefined }),
            endDate: fc.option(fc.constant('2024-12-31'), { nil: undefined }),
            activityType: fc.option(fc.constantFrom(...Object.values(ACTIVITY_TYPES)), { nil: undefined }),
          }),
          async (userId, filters) => {
            ActivityModel.findFiltered.mockReset();
            ActivityModel.findFiltered.mockResolvedValueOnce([]);

            const user = { id: userId, role: 'admin' };
            await ActivityService.getActivityLogs(user, filters);

            expect(ActivityModel.findFiltered).toHaveBeenCalledTimes(1);
            const callArgs = ActivityModel.findFiltered.mock.calls[0][0];
            expect(callArgs.userId).toBeUndefined();
            expect(callArgs.userType).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('access control is consistent: only agen role restricts by userId, all other roles see all', async () => {
      const roleArb = fc.constantFrom('agen', 'petugas', 'admin');

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          roleArb,
          async (userId, role) => {
            ActivityModel.findFiltered.mockReset();
            ActivityModel.findFiltered.mockResolvedValueOnce([]);

            const user = { id: userId, role };
            await ActivityService.getActivityLogs(user, {});

            expect(ActivityModel.findFiltered).toHaveBeenCalledTimes(1);
            const callArgs = ActivityModel.findFiltered.mock.calls[0][0];

            if (role === 'agen') {
              expect(callArgs.userId).toBe(userId);
              expect(callArgs.userType).toBe('agen');
            } else {
              expect(callArgs.userId).toBeUndefined();
              expect(callArgs.userType).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
