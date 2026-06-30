import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';

/**
 * NotificationPanel — Dropdown panel with bell icon, unread badge,
 * and notification list. Merges persisted API notifications with
 * realtime Socket.io notifications.
 *
 * Requirements: 9.5, 9.6
 */
export default function NotificationPanel() {
  const { notifications: realtimeNotifications, unreadCount: socketUnreadCount, markAsRead: socketMarkAsRead, markAllAsRead: socketMarkAllAsRead } = useSocket();

  const [apiNotifications, setApiNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  // Fetch persisted notifications from API on mount
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications');
      if (response.data.success) {
        setApiNotifications(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Merge API notifications with realtime Socket.io notifications (deduplicate by id)
  const mergedNotifications = mergeNotifications(apiNotifications, realtimeNotifications);

  // Calculate unread count from merged list
  const unreadCount = mergedNotifications.filter((n) => !n.is_read).length;

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mark a single notification as read (API + local state)
  const handleMarkAsRead = useCallback(async (notification) => {
    if (notification.is_read) return;

    const notifId = notification.id_notif || notification.id;

    // Optimistically update local state
    setApiNotifications((prev) =>
      prev.map((n) =>
        (n.id_notif || n.id) === notifId ? { ...n, is_read: true } : n
      )
    );
    socketMarkAsRead(notifId);

    // Call API to persist
    try {
      await api.put(`/notifications/${notifId}/read`);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      // Revert on failure
      setApiNotifications((prev) =>
        prev.map((n) =>
          (n.id_notif || n.id) === notifId ? { ...n, is_read: false } : n
        )
      );
    }
  }, [socketMarkAsRead]);

  // Mark all notifications as read
  const handleMarkAllAsRead = useCallback(async () => {
    const unreadNotifs = mergedNotifications.filter((n) => !n.is_read);

    // Optimistically update local state
    setApiNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    socketMarkAllAsRead();

    // Call API for each unread notification
    for (const notif of unreadNotifs) {
      const notifId = notif.id_notif || notif.id;
      try {
        await api.put(`/notifications/${notifId}/read`);
      } catch (err) {
        console.error(`Failed to mark notification ${notifId} as read:`, err);
      }
    }
  }, [mergedNotifications, socketMarkAllAsRead]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <BellIcon />
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 max-h-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Notifikasi</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1">
            {loading && mergedNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Memuat notifikasi...
              </div>
            ) : mergedNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Belum ada notifikasi
              </div>
            ) : (
              mergedNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id_notif || notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual notification item in the list.
 */
function NotificationItem({ notification, onMarkAsRead }) {
  const isUnread = !notification.is_read;

  return (
    <button
      onClick={() => onMarkAsRead(notification)}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isUnread ? 'bg-blue-50' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Unread indicator dot */}
        <div className="mt-1.5 flex-shrink-0">
          {isUnread ? (
            <span className="block w-2 h-2 bg-blue-500 rounded-full" />
          ) : (
            <span className="block w-2 h-2 bg-transparent rounded-full" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
            {notification.title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatTimeAgo(notification.created_at || notification.received_at)}
          </p>
        </div>
      </div>
    </button>
  );
}

/**
 * Bell icon SVG component.
 */
function BellIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

/**
 * Merge API notifications with realtime Socket.io notifications.
 * Deduplicates by id_notif/id and sorts by created_at descending.
 */
function mergeNotifications(apiNotifs, realtimeNotifs) {
  const map = new Map();

  // Add API notifications first
  for (const n of apiNotifs) {
    const key = n.id_notif || n.id;
    map.set(key, n);
  }

  // Add realtime notifications (may override API ones if same id)
  for (const n of realtimeNotifs) {
    const key = n.id_notif || n.id;
    if (!map.has(key)) {
      map.set(key, n);
    }
  }

  // Sort by created_at descending (newest first)
  return Array.from(map.values()).sort((a, b) => {
    const dateA = new Date(a.created_at || a.received_at || 0);
    const dateB = new Date(b.created_at || b.received_at || 0);
    return dateB - dateA;
  });
}

/**
 * Format a timestamp into a human-readable "time ago" string.
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';

  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;

  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
