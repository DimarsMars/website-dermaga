import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { formatLogMessage } from '../utils/format';

export default function BookingHistoryPage() {
  const { user } = useAuth();
  const canFilterByDate = user?.role === 'petugas' || user?.role === 'admin';
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDay, setFilterDay] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Activity Log Modal state
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logModalBooking, setLogModalBooking] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings');
      setBookings(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- PDF Export handler ---
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      let startDate, endDate;
      if (canFilterByDate && filterDay) {
        // Specific day
        startDate = new Date(filterYear, filterMonth - 1, Number(filterDay), 0, 0, 0).toISOString();
        endDate = new Date(filterYear, filterMonth - 1, Number(filterDay), 23, 59, 59).toISOString();
      } else {
        // Full month
        startDate = new Date(filterYear, filterMonth - 1, 1).toISOString();
        endDate = new Date(filterYear, filterMonth, 0, 23, 59, 59).toISOString();
      }

      const response = await api.get('/bookings/export/pdf', {
        params: { startDate, endDate },
        responseType: 'blob',
      });

      // Create a download link from the blob
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `booking-history-${filterYear}-${String(filterMonth).padStart(2, '0')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Gagal mengunduh PDF. Pastikan Anda memiliki akses.');
    } finally {
      setExporting(false);
    }
  };

  // --- Activity Log Modal handler ---
  const handleViewLog = async (booking) => {
    setLogModalBooking(booking);
    setLogModalOpen(true);
    setLogsLoading(true);
    try {
      const res = await api.get('/activity', { 
        params: { bookingId: booking.id_booking } 
      });

      console.log("Data log yang diterima:", res.data.data);

      // Tampilkan hanya yang benar-benar milik booking ini
      setActivityLogs(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
      setActivityLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const closeLogModal = () => {
    setLogModalOpen(false);
    setLogModalBooking(null);
    setActivityLogs([]);
  };

  // Filter bookings by selected month/year (and day for petugas/admin)
  // Agents only see their own bookings (filtered by id_agen)
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Agen role: only show their own bookings
      if (user?.role === 'agen' && b.id_agen !== user.id) return false;

      if (!b.eta_in) return false;
      const etaDate = new Date(b.eta_in);
      const matchMonth = etaDate.getMonth() + 1 === filterMonth;
      const matchYear = etaDate.getFullYear() === filterYear;
      if (!matchMonth || !matchYear) return false;
      // Day filter only for petugas/admin
      if (canFilterByDate && filterDay) {
        return etaDate.getDate() === Number(filterDay);
      }
      return true;
    });
  }, [bookings, filterMonth, filterYear, filterDay, canFilterByDate, user]);

  // Reset ke halaman 1 setiap kali filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMonth, filterYear, filterDay]);

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalRequests = filteredBookings.length;
  const approvedCount = filteredBookings.filter((b) => b.status === 'approved' || b.status_request === 'approved').length;
  const rejectedCount = filteredBookings.filter((b) => b.status === 'rejected' || b.status_request === 'rejected').length;
  const completedCount = filteredBookings.filter((b) => b.status === 'completed' || b.status_request === 'completed').length;

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#1e3a5f] tracking-tight">
            HISTORY
          </h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">TOTAL REQUEST</p>
              <p className="text-2xl font-bold text-gray-800">{totalRequests}</p>
            </div>
          </div>

          <div className="bg-blue-600 rounded-xl shadow-md p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-blue-100 font-medium">APPROVED</p>
              <p className="text-2xl font-bold text-white">{approvedCount}</p>
            </div>
          </div>

          <div className="bg-red-500 rounded-xl shadow-md p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-red-100 font-medium">REJECTED</p>
              <p className="text-2xl font-bold text-white">{rejectedCount}</p>
            </div>
          </div>

          <div className="bg-emerald-600 rounded-xl shadow-md p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-emerald-100 font-medium">COMPLETED</p>
              <p className="text-2xl font-bold text-white">{completedCount}</p>
            </div>
          </div>
        </div>

        {/* Date Filter */}
        <div className="card mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {canFilterByDate && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Tanggal:</label>
                <select
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                  className="input-field w-auto"
                >
                  <option value="">Semua</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Bulan:</label>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                className="input-field w-auto"
              >
                {months.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Tahun:</label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="input-field w-auto"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#1e3a5f]">Riwayat Booking</h2>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export PDF"
            >
              {exporting ? (
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              <span>{exporting ? 'Mengunduh...' : 'Export PDF'}</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">NO</th>
                  <th className="px-4 py-3 text-left">NAMA KAPAL</th>
                  <th className="px-4 py-3 text-center">LOA</th>
                  <th className="px-4 py-3 text-center">POSISI</th>
                  <th className="px-4 py-3 text-center">ETA/IN</th>
                  <th className="px-4 py-3 text-center">ETA/OUT</th>
                  <th className="px-4 py-3 text-center">STATUS REQUEST</th>
                  <th className="px-4 py-3 text-center">LOG ACTIVITY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5 text-[#1e3a5f]" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Memuat data...
                      </div>
                    </td>
                  </tr>
                ) : filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      Tidak ada riwayat booking untuk periode ini
                    </td>
                  </tr>
                ) : (
                  paginatedBookings.map((booking, index) => (
                    <tr key={booking.id_booking} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{booking.nama_kapal || booking.ship_name || '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{booking.loa ? Math.round(Number(booking.loa)) : '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {booking.pos_start != null && booking.pos_end != null ? `${Math.round(Number(booking.pos_start))}-${Math.round(Number(booking.pos_end))}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">
                        {booking.eta_in ? new Date(booking.eta_in).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">
                        {booking.etd_out ? new Date(booking.etd_out).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                          booking.status_request === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : booking.status_request === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : booking.status_request === 'completed'
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {(() => {
                            const s = booking.status_request || booking.status || 'pending';
                            return s.charAt(0).toUpperCase() + s.slice(1);
                          })()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleViewLog(booking)}
                          className="p-1.5 text-gray-500 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Log"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-sm text-gray-500">
                Menampilkan {paginatedBookings.length} dari {filteredBookings.length} data
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`px-3 py-1 text-sm rounded-lg border transition ${
                      currentPage === i + 1
                        ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                        : 'border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-100 transition"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activity Log Modal */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-[#1e3a5f]">Activity Log</h3>
                {logModalBooking && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {logModalBooking.nama_kapal || logModalBooking.ship_name || 'Booking'} #{logModalBooking.id_booking}
                  </p>
                )}
              </div>
              <button
                onClick={closeLogModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin w-6 h-6 text-[#1e3a5f]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="ml-2 text-gray-500">Memuat log...</span>
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p>Belum ada activity log untuk booking ini.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activityLogs.map((log) => (
                    <div
                      key={log.id_log}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center mt-0.5">
                        <svg className="w-4 h-4 text-[#1e3a5f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                            {log.activity_type || 'activity'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {log.user_type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 break-words">{formatLogMessage(log.keterangan) || '-'}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {log.date_time
                            ? new Date(log.date_time).toLocaleString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeLogModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
