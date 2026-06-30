const fc = require('fast-check');
const NotificationService = require('./notification.service');
const NotificationModel = require('../models/notification.model');
const pool = require('../config/db');
const { broadcastNotification } = require('./socket.service');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));
jest.mock('../models/notification.model');
jest.mock('./socket.service', () => ({
  broadcastNotification: jest.fn(),
}));

describe('NotificationService - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 9.1, 9.2, 9.4**
   *
   * Property 15: Notification Routing Correctness
   * For any new Pre_Booking submission, an "Incoming Request" notification SHALL be sent
   * to all Petugas_Operasional and Admin users. For any booking approval or rejection,
   * a status notification SHALL be sent to the submitting Agen_Kapal. For any Extend_Time
   * conflict, a Delay_Cascade notification SHALL be sent to each affected Agen_Kapal.
   */
  describe('Property 15: Notification Routing Correctness', () => {
    it('notifyNewBooking sends notifications to ALL petugas and admin users', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a list of officers (petugas/admin)
          fc.array(
            fc.record({
              id_petugas: fc.integer({ min: 1, max: 1000 }),
              user_role: fc.constantFrom('petugas', 'admin'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          // Generate a booking object
          fc.record({
            id_booking: fc.integer({ min: 1, max: 10000 }),
            id_agen: fc.integer({ min: 1, max: 1000 }),
          }),
          // Generate an agent name
          fc.string({ minLength: 1, maxLength: 50 }),
          async (officers, booking, agentName) => {
            // Clear mocks between iterations
            jest.clearAllMocks();

            // Setup mocks
            pool.query.mockResolvedValueOnce({ rows: officers });
            NotificationModel.create.mockImplementation(async (data) => ({
              id_notif: Math.floor(Math.random() * 10000),
              ...data,
              is_read: false,
              created_at: new Date().toISOString(),
            }));

            const result = await NotificationService.notifyNewBooking(null, booking, agentName);

            // Property: notification count equals officer count
            expect(result).toHaveLength(officers.length);

            // Property: each officer receives exactly one notification
            expect(NotificationModel.create).toHaveBeenCalledTimes(officers.length);

            // Property: each notification targets the correct officer
            officers.forEach((officer, index) => {
              expect(NotificationModel.create).toHaveBeenNthCalledWith(index + 1, {
                id_user: officer.id_petugas,
                user_type: officer.user_role,
                title: 'Permintaan Booking Baru',
                message: expect.stringContaining(agentName),
              });
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('notifyNewBooking uses booking ID in message when agentName is not provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id_petugas: fc.integer({ min: 1, max: 1000 }),
              user_role: fc.constantFrom('petugas', 'admin'),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.record({
            id_booking: fc.integer({ min: 1, max: 10000 }),
            id_agen: fc.integer({ min: 1, max: 1000 }),
          }),
          async (officers, booking) => {
            jest.clearAllMocks();

            pool.query.mockResolvedValueOnce({ rows: officers });
            NotificationModel.create.mockImplementation(async (data) => ({
              id_notif: Math.floor(Math.random() * 10000),
              ...data,
              is_read: false,
              created_at: new Date().toISOString(),
            }));

            await NotificationService.notifyNewBooking(null, booking, undefined);

            // Property: message contains booking ID when no agent name
            officers.forEach((_, index) => {
              expect(NotificationModel.create).toHaveBeenNthCalledWith(index + 1,
                expect.objectContaining({
                  message: expect.stringContaining(String(booking.id_booking)),
                })
              );
            });
          }
        ),
        { numRuns: 30 }
      );
    });

    it('notifyStatusChange sends notification to the booking agent (id_agen)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a booking with an agent
          fc.record({
            id_booking: fc.integer({ min: 1, max: 10000 }),
            id_agen: fc.integer({ min: 1, max: 1000 }),
          }),
          // Generate a status
          fc.constantFrom('approved', 'rejected'),
          async (booking, newStatus) => {
            jest.clearAllMocks();

            NotificationModel.create.mockImplementation(async (data) => ({
              id_notif: Math.floor(Math.random() * 10000),
              ...data,
              is_read: false,
              created_at: new Date().toISOString(),
            }));

            const result = await NotificationService.notifyStatusChange(null, booking, newStatus);

            // Property: exactly one notification created
            expect(NotificationModel.create).toHaveBeenCalledTimes(1);

            // Property: notification targets the booking's agent
            expect(NotificationModel.create).toHaveBeenCalledWith({
              id_user: booking.id_agen,
              user_type: 'agen',
              title: expect.any(String),
              message: expect.stringContaining(String(booking.id_booking)),
            });

            // Property: notification user is always the booking's agent
            expect(result.id_user).toBe(booking.id_agen);
            expect(result.user_type).toBe('agen');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('notifyDelayCascade sends notification to each affected booking agent', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate affected bookings (each with a different agent)
          fc.array(
            fc.record({
              id_booking: fc.integer({ min: 1, max: 10000 }),
              id_agen: fc.integer({ min: 1, max: 1000 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (affectedBookings) => {
            jest.clearAllMocks();

            NotificationModel.create.mockImplementation(async (data) => ({
              id_notif: Math.floor(Math.random() * 10000),
              ...data,
              is_read: false,
              created_at: new Date().toISOString(),
            }));

            const result = await NotificationService.notifyDelayCascade(null, affectedBookings);

            // Property: notification count equals affected bookings count
            expect(result).toHaveLength(affectedBookings.length);

            // Property: each affected booking's agent receives a notification
            expect(NotificationModel.create).toHaveBeenCalledTimes(affectedBookings.length);

            affectedBookings.forEach((booking, index) => {
              expect(NotificationModel.create).toHaveBeenNthCalledWith(index + 1, {
                id_user: booking.id_agen,
                user_type: 'agen',
                title: 'Pemberitahuan Delay Cascade',
                message: expect.stringContaining(String(booking.id_booking)),
              });
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('notifyNewBooking broadcasts to each officer when io is provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id_petugas: fc.integer({ min: 1, max: 1000 }),
              user_role: fc.constantFrom('petugas', 'admin'),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.record({
            id_booking: fc.integer({ min: 1, max: 10000 }),
            id_agen: fc.integer({ min: 1, max: 1000 }),
          }),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (officers, booking, agentName) => {
            jest.clearAllMocks();

            pool.query.mockResolvedValueOnce({ rows: officers });
            NotificationModel.create.mockImplementation(async (data) => ({
              id_notif: Math.floor(Math.random() * 10000),
              ...data,
              is_read: false,
              created_at: new Date().toISOString(),
            }));

            const mockIo = {}; // non-null io to trigger broadcast
            await NotificationService.notifyNewBooking(mockIo, booking, agentName);

            // Property: broadcastNotification called once per officer
            expect(broadcastNotification).toHaveBeenCalledTimes(officers.length);

            // Property: each broadcast targets the correct officer
            officers.forEach((officer, index) => {
              expect(broadcastNotification).toHaveBeenNthCalledWith(
                index + 1,
                mockIo,
                officer.id_petugas,
                officer.user_role,
                expect.objectContaining({
                  id_user: officer.id_petugas,
                  user_type: officer.user_role,
                })
              );
            });
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * **Validates: Requirements 9.6, 14.3**
   *
   * Property 16: Notification Persistence Round-Trip
   * For any notification generated by the system, it SHALL be persisted in the NOTIFIKASI
   * table and retrievable by the target user upon query.
   */
  describe('Property 16: Notification Persistence Round-Trip', () => {
    it('notifyNewBooking persists each notification with correct fields via NotificationModel.create', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id_petugas: fc.integer({ min: 1, max: 1000 }),
              user_role: fc.constantFrom('petugas', 'admin'),
            }),
            { minLength: 1, maxLength: 8 }
          ),
          fc.record({
            id_booking: fc.integer({ min: 1, max: 10000 }),
            id_agen: fc.integer({ min: 1, max: 1000 }),
          }),
          fc.string({ minLength: 1, maxLength: 30 }),
          async (officers, booking, agentName) => {
            jest.clearAllMocks();

            pool.query.mockResolvedValueOnce({ rows: officers });

            const createdNotifications = [];
            NotificationModel.create.mockImplementation(async (data) => {
              const notification = {
                id_notif: createdNotifications.length + 1,
                ...data,
                is_read: false,
                created_at: new Date().toISOString(),
              };
              createdNotifications.push(notification);
              return notification;
            });

            const result = await NotificationService.notifyNewBooking(null, booking, agentName);

            // Property: every call to create has required fields
            createdNotifications.forEach((notif) => {
              expect(notif).toHaveProperty('id_user');
              expect(notif).toHaveProperty('user_type');
              expect(notif).toHaveProperty('title');
              expect(notif).toHaveProperty('message');
              expect(typeof notif.id_user).toBe('number');
              expect(['petugas', 'admin']).toContain(notif.user_type);
              expect(notif.title.length).toBeGreaterThan(0);
              expect(notif.message.length).toBeGreaterThan(0);
            });

            // Property: returned notifications match what was persisted
            expect(result).toEqual(createdNotifications);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('notifyStatusChange persists notification with correct agent target and status info', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id_booking: fc.integer({ min: 1, max: 10000 }),
            id_agen: fc.integer({ min: 1, max: 1000 }),
          }),
          fc.constantFrom('approved', 'rejected'),
          async (booking, newStatus) => {
            jest.clearAllMocks();

            let persistedData = null;
            NotificationModel.create.mockImplementation(async (data) => {
              persistedData = { ...data };
              return {
                id_notif: 1,
                ...data,
                is_read: false,
                created_at: new Date().toISOString(),
              };
            });

            await NotificationService.notifyStatusChange(null, booking, newStatus);

            // Property: persisted notification has all required fields
            expect(persistedData).not.toBeNull();
            expect(persistedData.id_user).toBe(booking.id_agen);
            expect(persistedData.user_type).toBe('agen');
            expect(persistedData.title).toBeDefined();
            expect(persistedData.message).toBeDefined();

            // Property: title reflects the status
            if (newStatus === 'approved') {
              expect(persistedData.title).toContain('Disetujui');
            } else {
              expect(persistedData.title).toContain('Ditolak');
            }

            // Property: message contains booking ID for traceability
            expect(persistedData.message).toContain(String(booking.id_booking));
          }
        ),
        { numRuns: 50 }
      );
    });

    it('notifyDelayCascade persists one notification per affected booking with correct fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id_booking: fc.integer({ min: 1, max: 10000 }),
              id_agen: fc.integer({ min: 1, max: 1000 }),
            }),
            { minLength: 1, maxLength: 8 }
          ),
          async (affectedBookings) => {
            jest.clearAllMocks();

            const persistedNotifications = [];
            NotificationModel.create.mockImplementation(async (data) => {
              const notification = {
                id_notif: persistedNotifications.length + 1,
                ...data,
                is_read: false,
                created_at: new Date().toISOString(),
              };
              persistedNotifications.push(notification);
              return notification;
            });

            const result = await NotificationService.notifyDelayCascade(null, affectedBookings);

            // Property: number of persisted notifications equals affected bookings
            expect(persistedNotifications).toHaveLength(affectedBookings.length);

            // Property: each persisted notification has correct structure
            persistedNotifications.forEach((notif, index) => {
              expect(notif.id_user).toBe(affectedBookings[index].id_agen);
              expect(notif.user_type).toBe('agen');
              expect(notif.title).toBe('Pemberitahuan Delay Cascade');
              expect(notif.message).toContain(String(affectedBookings[index].id_booking));
            });

            // Property: returned result matches persisted data
            expect(result).toEqual(persistedNotifications);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
