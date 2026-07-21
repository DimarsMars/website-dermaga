import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';
import Toast from '../components/Toast';
import ExtendTimeForm from '../components/ExtendTimeForm';
import { parseApiError } from '../utils/errorMessages';

export default function NotificationPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [pendingExtends, setPendingExtends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [extendBooking, setExtendBooking] = useState(null); // booking being extended (modal)
  const [activeNotifId, setActiveNotifId] = useState(null);
  const canApprove = user?.role === 'petugas' || user?.role === 'admin';

  useEffect(() => {
    fetchNotifications();
    if (canApprove) {
      fetchPendingExtends();
    }
  }, [canApprove]);
  
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      let notifs = res.data.data || [];

      // SINKRONISASI STATUS EXTEND:
      // Agar saat di-refresh tombol tetap mati (is_submitted = true)
      if (user?.role === 'agen') {
        try {
          // Ambil data booking milik agen ini
          const bRes = await api.get('/bookings');
          const bookings = bRes.data.data || [];
          
          notifs = notifs.map(n => {
            // Jika ini adalah notifikasi extend
            if (n.title === 'Waktu Booking Hampir Habis' && n.related_booking_id) {
              const b = bookings.find(x => x.id_booking === n.related_booking_id);
              // Jika booking tersebut sudah diajukan extend-nya (pending) atau sudah disetujui
              if (b && (b.extend_status === 'pending' || b.extend_status === 'approved')) {
                return { ...n, is_submitted: true };
              }
            }
            return n;
          });
        } catch (e) {
          console.error("Gagal sinkronisasi status booking dengan notifikasi:", e);
        }
      }

      setNotifications(notifs);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingExtends = async () => {
    try {
      const res = await api.get('/bookings');
      const allBookings = res.data.data || [];
      const pending = allBookings.filter(b => b.extend_status === 'pending');
      setPendingExtends(pending);
    } catch (err) {
      console.error('Failed to fetch pending extends:', err);
    }
  };

  const handleApproveExtend = async (bookingId) => {
    try {
      await api.put(`/bookings/${bookingId}/extend/approve`);
      setToast({ message: 'Perpanjangan waktu disetujui', type: 'success' });
      fetchPendingExtends();
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'booking', action: 'extend' });
      setToast({ message: parsed.message, type: 'error' });
    }
  };

  const handleRejectExtend = async (bookingId) => {
    try {
      await api.put(`/bookings/${bookingId}/extend/reject`);
      setToast({ message: 'Perpanjangan waktu ditolak', type: 'success' });
      fetchPendingExtends();
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'booking', action: 'extend' });
      setToast({ message: parsed.message, type: 'error' });
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id_notif === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id_notif !== id));
      setToast({ message: 'Notifikasi dihapus', type: 'success' });
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'notification', action: 'delete' });
      setToast({ message: parsed.message, type: 'error' });
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (!window.confirm('Hapus semua notifikasi?')) return;
    try {
      await api.delete('/notifications');
      setNotifications([]);
      setToast({ message: 'Semua notifikasi dihapus', type: 'success' });
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'notification', action: 'delete' });
      setToast({ message: parsed.message, type: 'error' });
    }
  };

  // Open the extend time form for a given booking (from extend offer notification)
  const handleExtendClick = async (notif, e) => {
    if (e) e.stopPropagation();
    const bookingId = notif.related_booking_id;
    if (!bookingId) {
      setToast({ message: 'Data booking tidak ditemukan', type: 'error' });
      return;
    }
    try {
      const res = await api.get(`/bookings/${bookingId}`);
      const booking = res.data.data;
      if (booking.status_request === 'completed' || booking.status !== 'active') {
        setToast({ message: 'Booking ini sudah tidak bisa diperpanjang', type: 'error' });
        return;
      }
      setExtendBooking(booking);
      setActiveNotifId(notif.id_notif);
    } catch (err) {
      setToast({ message: err.response?.data?.error?.message || 'Gagal memuat data booking', type: 'error' });
    }
  };

  // Dismiss the extend offer: just delete the notification
  const handleDismissExtend = async (notif, e) => {
    if (e) e.stopPropagation();
    await handleDelete(notif.id_notif);
  };

  const handleExtendSuccess = async (updatedBooking, message) => {
    setExtendBooking(null);
    setToast({ message, type: 'success' });
    if (activeNotifId) {
      // Ubah UI notifikasi di layar
      setNotifications((prev) => 
        prev.map((n) => 
          n.id_notif === activeNotifId 
            ? { ...n, is_submitted: true, is_read: true } // Tambahkan tanda is_submitted
            : n
        )
      );

      // Menandaiu sudah dibaca di database agar tidak saat baru di refresh
      try {
        await api.put(`/notifications/${activeNotifId}/read`);
      } catch (err) {
        console.error("Gagal update status read:", err);
      }

      setActiveNotifId(null);
    } else {
      fetchNotifications();
    }
  };

  // Check if a notification is an "extend offer"
  const isExtendOffer = (notif) =>
    notif.title === 'Waktu Booking Hampir Habis' && notif.related_booking_id;

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 pb-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1" />
          <h1 className="text-2xl md:text-3xl font-bold text-[#1e3a5f] tracking-tight text-center">
            NOTIFICATION
          </h1>
          <div className="flex-1 flex justify-end">
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Hapus semua notifikasi"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Pending Extend Requests (Petugas/Admin only) */}
        {canApprove && pendingExtends.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-[#1e3a5f] mb-3">
              Permintaan Perpanjangan Waktu
            </h2>
            <div className="space-y-3">
              {pendingExtends.map((booking) => (
                <div
                  key={booking.id_booking}
                  className="card border-l-4 border-l-orange-400 bg-orange-50/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-800">
                        {booking.nama_kapal || 'Kapal'} — {booking.agency_name || 'Agen'}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Booking ID: {booking.id_booking}
                      </p>
                      <div className="flex gap-4 mt-2 text-xs text-gray-600">
                        <span>
                          ETD Saat Ini: <strong>{formatDateTime(booking.etd_out)}</strong>
                        </span>
                        <span>
                          ETD Baru: <strong className="text-orange-700">{formatDateTime(booking.extend_etd_out)}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApproveExtend(booking.id_booking)}
                        className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Setujui
                      </button>
                      <button
                        onClick={() => handleRejectExtend(booking.id_booking)}
                        className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Tolak
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notification List */}
        <div className="space-y-3">
          {loading ? (
            <div className="card flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-gray-500">
                <svg className="animate-spin w-5 h-5 text-[#1e3a5f]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Memuat notifikasi...
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="card text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-gray-500">Tidak ada notifikasi</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id_notif}
                onClick={() => !notif.is_read && markAsRead(notif.id_notif)}
                className={`card flex items-start gap-4 cursor-pointer hover:shadow-lg transition-all duration-200 ${
                  !notif.is_read ? 'border-l-4 border-l-[#1e3a5f] bg-blue-50/30' : ''
                }`}
              >
                {/* Bell Icon */}
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${
                  !notif.is_read ? 'bg-[#1e3a5f]/10' : 'bg-gray-100'
                }`}>
                  <svg className={`w-5 h-5 ${!notif.is_read ? 'text-[#1e3a5f]' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-semibold ${!notif.is_read ? 'text-[#1e3a5f]' : 'text-gray-700'}`}>
                    {notif.title || 'Incoming Request'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                    {notif.message || notif.content || 'New notification received'}
                  </p>

                  {/* Extend offer action buttons */}
                  {isExtendOffer(notif) && (
                    <div className="flex items-center gap-2 mt-3">
                      {notif.is_submitted ? (
                        // TAMPILAN TOMBOL MATI (SETELAH SUBMIT)
                        <button 
                          disabled
                          className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed border border-gray-200"
                        >
                          Perpanjangan Waktu Sudah Diajukan
                        </button>
                      ) : (
                        // TAMPILAN TOMBOL (SEBELUM SUBMIT)
                        <>
                          <button
                            onClick={(e) => handleExtendClick(notif, e)}
                            className="px-3 py-1.5 text-xs font-medium bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2a4f7f] transition-colors"
                          >
                            Perpanjang Waktu
                          </button>
                          <button
                            onClick={(e) => handleDismissExtend(notif, e)}
                            className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                          >
                            Abaikan
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Timestamp + Delete */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {getTimeAgo(notif.created_at)}
                  </span>
                  <button
                    onClick={(e) => handleDelete(notif.id_notif, e)}
                    className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Hapus notifikasi"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Extend Time Modal */}
      {extendBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setExtendBooking(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-[#1e3a5f]">Perpanjang Waktu</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {extendBooking.nama_kapal || 'Kapal'}
                </p>
              </div>
              <button
                onClick={() => setExtendBooking(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 pb-6">
              <ExtendTimeForm
                booking={extendBooking}
                onSuccess={handleExtendSuccess}
                showToast={(message, type) => setToast({ message, type })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
