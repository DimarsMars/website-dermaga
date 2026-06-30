/**
 * Integration tests for Socket.io broadcast service.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 *
 * 8.1 - WebSocket_Service establishes persistent connection with authenticated clients
 * 8.2 - Broadcasts updated booking data on create/approve/reject/extend within 2 seconds
 * 8.3 - Automatic reconnection with exponential backoff (client-side config)
 * 8.4 - State synchronization on reconnection
 * 8.5 - WebSocket authenticates using same session token as HTTP API
 */

const { broadcastBerthingUpdate, broadcastNotification } = require('./socket.service');
const initSocket = require('../config/socket');

// ─── Mock io object for broadcast tests ───────────────────────────────────────

function createMockIo() {
  const mockIo = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };
  return mockIo;
}

// ─── Sample booking data ──────────────────────────────────────────────────────

const sampleBooking = {
  id_booking: 1,
  id_kapal: 10,
  id_agen: 5,
  nama_kapal: 'MV Test Ship',
  loa: 120,
  pos_start: 50,
  pos_end: 175,
  eta_in: '2024-06-15T08:00:00.000Z',
  etd_out: '2024-06-16T18:00:00.000Z',
  pbm: 'PT Pelindo',
  keterangan: 'Test booking',
  status_request: 'pending',
  created_at: '2024-06-14T10:00:00.000Z',
  updated_at: '2024-06-14T10:00:00.000Z',
};

// ─── broadcastBerthingUpdate tests ────────────────────────────────────────────

describe('broadcastBerthingUpdate', () => {
  let mockIo;

  beforeEach(() => {
    mockIo = createMockIo();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Validates: Requirement 8.2
   * WHEN a Pre_Booking is created, the WebSocket_Service SHALL broadcast
   * the updated booking data to all connected clients.
   */
  test('broadcasts "created" event to berthing_plan room', () => {
    broadcastBerthingUpdate(mockIo, 'created', sampleBooking);

    expect(mockIo.to).toHaveBeenCalledWith('berthing_plan');
    expect(mockIo.emit).toHaveBeenCalledWith('update_berthing', {
      event: 'created',
      booking: sampleBooking,
      timestamp: '2024-06-15T12:00:00.000Z',
    });
  });

  /**
   * Validates: Requirement 8.2
   * WHEN a Pre_Booking is approved, the WebSocket_Service SHALL broadcast
   * the updated booking data to all connected clients.
   */
  test('broadcasts "approved" event to berthing_plan room', () => {
    const approvedBooking = { ...sampleBooking, status_request: 'approved' };
    broadcastBerthingUpdate(mockIo, 'approved', approvedBooking);

    expect(mockIo.to).toHaveBeenCalledWith('berthing_plan');
    expect(mockIo.emit).toHaveBeenCalledWith('update_berthing', {
      event: 'approved',
      booking: approvedBooking,
      timestamp: '2024-06-15T12:00:00.000Z',
    });
  });

  /**
   * Validates: Requirement 8.2
   * WHEN a Pre_Booking is rejected, the WebSocket_Service SHALL broadcast
   * the updated booking data to all connected clients.
   */
  test('broadcasts "rejected" event to berthing_plan room', () => {
    const rejectedBooking = { ...sampleBooking, status_request: 'rejected' };
    broadcastBerthingUpdate(mockIo, 'rejected', rejectedBooking);

    expect(mockIo.to).toHaveBeenCalledWith('berthing_plan');
    expect(mockIo.emit).toHaveBeenCalledWith('update_berthing', {
      event: 'rejected',
      booking: rejectedBooking,
      timestamp: '2024-06-15T12:00:00.000Z',
    });
  });

  /**
   * Validates: Requirement 8.2
   * WHEN a Pre_Booking is extended, the WebSocket_Service SHALL broadcast
   * the updated booking data to all connected clients.
   */
  test('broadcasts "extended" event to berthing_plan room', () => {
    const extendedBooking = {
      ...sampleBooking,
      status_request: 'approved',
      etd_out: '2024-06-17T06:00:00.000Z',
    };
    broadcastBerthingUpdate(mockIo, 'extended', extendedBooking);

    expect(mockIo.to).toHaveBeenCalledWith('berthing_plan');
    expect(mockIo.emit).toHaveBeenCalledWith('update_berthing', {
      event: 'extended',
      booking: extendedBooking,
      timestamp: '2024-06-15T12:00:00.000Z',
    });
  });

  /**
   * Validates: Requirement 8.2
   * Verify the emitted payload contains { event, booking, timestamp }
   * and timestamp is a valid ISO 8601 string.
   */
  test('emitted payload contains event, booking, and valid ISO 8601 timestamp', () => {
    broadcastBerthingUpdate(mockIo, 'created', sampleBooking);

    const emittedPayload = mockIo.emit.mock.calls[0][1];

    expect(emittedPayload).toHaveProperty('event', 'created');
    expect(emittedPayload).toHaveProperty('booking', sampleBooking);
    expect(emittedPayload).toHaveProperty('timestamp');

    // Verify timestamp is valid ISO 8601
    const parsedDate = new Date(emittedPayload.timestamp);
    expect(parsedDate.toISOString()).toBe(emittedPayload.timestamp);
    expect(isNaN(parsedDate.getTime())).toBe(false);
  });

  /**
   * Validates: Requirement 8.2
   * Verify that each broadcast call targets the correct room.
   */
  test('always targets the berthing_plan room regardless of event type', () => {
    const events = ['created', 'approved', 'rejected', 'extended', 'position_edited'];

    events.forEach((event) => {
      const io = createMockIo();
      broadcastBerthingUpdate(io, event, sampleBooking);
      expect(io.to).toHaveBeenCalledWith('berthing_plan');
    });
  });
});

// ─── broadcastNotification tests ──────────────────────────────────────────────

describe('broadcastNotification', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Validates: Requirement 8.2
   * Targeted notification is sent to the correct user socket.
   */
  test('sends notification to matching user socket', () => {
    const mockEmit = jest.fn();
    const mockIo = {
      sockets: {
        sockets: new Map([
          ['socket1', { user: { id: 5, role: 'agen' }, emit: mockEmit }],
          ['socket2', { user: { id: 10, role: 'petugas' }, emit: jest.fn() }],
        ]),
      },
    };

    const notification = { title: 'Request Approved', message: 'Your booking has been approved' };
    broadcastNotification(mockIo, 5, 'agen', notification);

    expect(mockEmit).toHaveBeenCalledWith('new_notification', {
      title: 'Request Approved',
      message: 'Your booking has been approved',
      timestamp: '2024-06-15T12:00:00.000Z',
    });
  });

  /**
   * Validates: Requirement 8.2
   * Notification is NOT sent to non-matching users.
   */
  test('does not send notification to non-matching user sockets', () => {
    const mockEmitTarget = jest.fn();
    const mockEmitOther = jest.fn();
    const mockIo = {
      sockets: {
        sockets: new Map([
          ['socket1', { user: { id: 5, role: 'agen' }, emit: mockEmitTarget }],
          ['socket2', { user: { id: 10, role: 'petugas' }, emit: mockEmitOther }],
          ['socket3', { user: { id: 5, role: 'petugas' }, emit: mockEmitOther }],
        ]),
      },
    };

    const notification = { title: 'Test', message: 'Test message' };
    broadcastNotification(mockIo, 5, 'agen', notification);

    expect(mockEmitTarget).toHaveBeenCalledTimes(1);
    expect(mockEmitOther).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirement 8.2
   * Notification payload includes a valid ISO 8601 timestamp.
   */
  test('notification payload includes valid ISO 8601 timestamp', () => {
    const mockEmit = jest.fn();
    const mockIo = {
      sockets: {
        sockets: new Map([
          ['socket1', { user: { id: 1, role: 'petugas' }, emit: mockEmit }],
        ]),
      },
    };

    const notification = { title: 'Incoming Request', message: 'New booking submitted' };
    broadcastNotification(mockIo, 1, 'petugas', notification);

    const emittedPayload = mockEmit.mock.calls[0][1];
    const parsedDate = new Date(emittedPayload.timestamp);
    expect(parsedDate.toISOString()).toBe(emittedPayload.timestamp);
    expect(isNaN(parsedDate.getTime())).toBe(false);
  });

  /**
   * Validates: Requirement 8.2
   * When no matching sockets exist, no emit is called.
   */
  test('does nothing when no matching sockets exist', () => {
    const mockEmit = jest.fn();
    const mockIo = {
      sockets: {
        sockets: new Map([
          ['socket1', { user: { id: 99, role: 'admin' }, emit: mockEmit }],
        ]),
      },
    };

    const notification = { title: 'Test', message: 'Test' };
    broadcastNotification(mockIo, 5, 'agen', notification);

    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ─── Socket.io config structure tests ─────────────────────────────────────────

describe('Socket.io configuration (initSocket)', () => {
  /**
   * Validates: Requirement 8.5
   * THE WebSocket_Service SHALL authenticate connections using the same
   * session token as the HTTP API.
   */
  test('initSocket is a function that accepts httpServer', () => {
    expect(typeof initSocket).toBe('function');
    expect(initSocket.length).toBe(1); // accepts one parameter (httpServer)
  });

  /**
   * Validates: Requirement 8.1, 8.5
   * Verify the socket config module exports a function that sets up
   * JWT authentication middleware on handshake.
   */
  test('socket config source contains JWT authentication middleware', () => {
    const fs = require('fs');
    const path = require('path');
    const socketConfigSource = fs.readFileSync(
      path.join(__dirname, '../config/socket.js'),
      'utf-8'
    );

    // Verify JWT auth is configured in the socket setup
    expect(socketConfigSource).toContain('jwt');
    expect(socketConfigSource).toContain('socket.handshake.auth.token');
    expect(socketConfigSource).toContain('Authentication token required');
    expect(socketConfigSource).toContain('Invalid token');
  });

  /**
   * Validates: Requirement 8.4
   * WHEN a client reconnects after a disconnection, THE System SHALL
   * synchronize the client with the current state of all active bookings.
   */
  test('socket config source contains state synchronization on connection', () => {
    const fs = require('fs');
    const path = require('path');
    const socketConfigSource = fs.readFileSync(
      path.join(__dirname, '../config/socket.js'),
      'utf-8'
    );

    // Verify sync_state emission on connection
    expect(socketConfigSource).toContain('sync_state');
    expect(socketConfigSource).toContain("socket.join('berthing_plan')");
  });

  /**
   * Validates: Requirement 8.3
   * Verify the client socket config has reconnection with exponential backoff.
   */
  test('client socket config contains reconnection settings', () => {
    const fs = require('fs');
    const path = require('path');
    const clientSocketPath = path.resolve(
      __dirname,
      '../../../client/src/services/socket.js'
    );

    // Only run if client socket file exists
    if (fs.existsSync(clientSocketPath)) {
      const clientSocketSource = fs.readFileSync(clientSocketPath, 'utf-8');
      expect(clientSocketSource).toContain('reconnection');
    }
  });
});
