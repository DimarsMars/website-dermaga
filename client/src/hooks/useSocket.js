import { useEffect, useState, useCallback } from 'react';
import socket from '../services/socket';
import { useAuth } from './useAuth';
import { useBookings } from './useBookings';

/**
 * ============================================================
 * Module-level shared state + singleton socket listeners.
 * This guarantees socket events are handled ONCE, no matter how
 * many components call useSocket(). Prevents double-counting.
 * ============================================================
 */

let _unreadCount = 0;
let _notifications = [];
let _isConnected = false;

const _countSubs = new Set();
const _notifSubs = new Set();
const _connSubs = new Set();

function notifyCount() { _countSubs.forEach((fn) => fn(_unreadCount)); }
function notifyNotifs() { _notifSubs.forEach((fn) => fn(_notifications)); }
function notifyConn() { _connSubs.forEach((fn) => fn(_isConnected)); }

function setUnreadCount(val) { _unreadCount = val; notifyCount(); }
function incrementUnread() { _unreadCount += 1; notifyCount(); }
function resetUnread() { _unreadCount = 0; notifyCount(); }

// Booking-state callbacks registered by the active useSocket consumer.
// Only one set is needed; we store the latest.
let _bookingHandlers = { addBooking: null, updateBooking: null, setBookings: null };

// Track whether the singleton listeners have been attached
let _listenersAttached = false;

function attachSocketListeners() {
  if (_listenersAttached) return;
  _listenersAttached = true;

  socket.on('connect', () => { _isConnected = true; notifyConn(); });
  socket.on('disconnect', () => { _isConnected = false; notifyConn(); });

  socket.on('update_berthing', (payload) => {
    if (!payload || !payload.booking) return;
    const { event, booking } = payload;
    if (event === 'created' && _bookingHandlers.addBooking) {
      _bookingHandlers.addBooking(booking);
    } else if (_bookingHandlers.updateBooking) {
      _bookingHandlers.updateBooking(booking);
    }
  });

  socket.on('sync_state', (payload) => {
    if (!payload || !payload.bookings) return;
    if (_bookingHandlers.setBookings) {
      _bookingHandlers.setBookings(payload.bookings);
    }
  });

  socket.on('new_notification', (payload) => {
    if (!payload) return;
    const notification = {
      ...payload,
      id: payload.id || Date.now() + Math.random(),
      is_read: false,
      received_at: payload.timestamp || new Date().toISOString(),
    };
    _notifications = [notification, ..._notifications];
    notifyNotifs();
    incrementUnread();
  });
}

/**
 * useNotificationBadge — lightweight hook that ONLY reads the shared unread count.
 * Safe to use anywhere (e.g. Navbar) without setting up socket logic.
 */
export function useNotificationBadge() {
  const [count, setCount] = useState(_unreadCount);

  useEffect(() => {
    const handler = (val) => setCount(val);
    _countSubs.add(handler);
    setCount(_unreadCount);
    return () => { _countSubs.delete(handler); };
  }, []);

  const clearBadge = useCallback(() => { resetUnread(); }, []);

  return { unreadCount: count, clearBadge };
}

/**
 * useSocket — manages Socket.io connection lifecycle tied to authentication.
 * Socket event listeners are attached once at module level (singleton),
 * so multiple components can safely call this hook.
 */
export function useSocket() {
  const { isAuthenticated } = useAuth();
  const { addBooking, updateBooking, setBookings } = useBookings();

  const [isConnected, setIsConnected] = useState(_isConnected);
  const [notifications, setNotifications] = useState(_notifications);
  const [unreadCount, setLocalUnread] = useState(_unreadCount);

  // Keep the module-level booking handlers up to date
  useEffect(() => {
    _bookingHandlers = { addBooking, updateBooking, setBookings };
  }, [addBooking, updateBooking, setBookings]);

  // Subscribe to shared state
  useEffect(() => {
    const countHandler = (val) => setLocalUnread(val);
    const notifHandler = (val) => setNotifications(val);
    const connHandler = (val) => setIsConnected(val);
    _countSubs.add(countHandler);
    _notifSubs.add(notifHandler);
    _connSubs.add(connHandler);
    return () => {
      _countSubs.delete(countHandler);
      _notifSubs.delete(notifHandler);
      _connSubs.delete(connHandler);
    };
  }, []);

  // Connect/disconnect socket based on auth, attach listeners once
  useEffect(() => {
    if (isAuthenticated) {
      attachSocketListeners();
      const token = localStorage.getItem('token');
      socket.auth = { token };
      if (!socket.connected) socket.connect();
    } else {
      _notifications = [];
      notifyNotifs();
      resetUnread();
      socket.disconnect();
    }
  }, [isAuthenticated]);

  const markAsRead = useCallback((notificationId) => {
    _notifications = _notifications.map((n) =>
      n.id === notificationId ? { ...n, is_read: true } : n
    );
    notifyNotifs();
    setUnreadCount(Math.max(0, _unreadCount - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    _notifications = _notifications.map((n) => ({ ...n, is_read: true }));
    notifyNotifs();
    resetUnread();
  }, []);

  return {
    isConnected,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
