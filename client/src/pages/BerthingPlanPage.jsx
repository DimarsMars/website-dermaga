import { useState, useEffect, useMemo } from 'react';
import { useBookings } from '../hooks/useBookings';
import { useAuth } from '../hooks/useAuth';
import BerthingCanvas from '../components/BerthingCanvas';
import AddBookingModal from '../components/AddBookingModal';
import EditBookingModal from '../components/EditBookingModal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import Toast from '../components/Toast';
import api from '../services/api';
import { parseApiError } from '../utils/errorMessages';

export default function BerthingPlanPage() {
  const { bookings, fetchBookings, loading } = useBookings();
  const { user } = useAuth();
  const canEdit = user?.role === 'petugas' || user?.role === 'admin';
  const [filterDate, setFilterDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editBooking, setEditBooking] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteBooking, setDeleteBooking] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const currentDate = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).toUpperCase();
  }, []);

  // Filter bookings by selected date (same filter for canvas AND table)
  // Exclude completed bookings from the berthing plan view
  const filteredBookings = useMemo(() => {
    if (!filterDate) return bookings.filter(b => b.status_request !== 'completed');
    
    const dayStart = new Date(filterDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(filterDate);
    dayEnd.setHours(23, 59, 59, 999);

    return bookings.filter((b) => {
      if (b.status_request === 'completed') return false;
      if (!b.eta_in || !b.etd_out) return false;
      const etaIn = new Date(b.eta_in);
      const etdOut = new Date(b.etd_out);
      return etaIn <= dayEnd && etdOut >= dayStart;
    });
  }, [bookings, filterDate]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#1e3a5f] tracking-tight">
            SISTEM PRA-BOOKING DAN MONITORING DERMAGA TIMUR
          </h1>
          <p className="text-gray-500 mt-2 text-lg font-medium">{currentDate}</p>
        </div>
      </div>

      {/* Dock Visualization + Unified Filter */}
      <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8">
        <div className="card p-2 mb-5">
          {/* Unified date filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <label className="text-sm font-semibold text-[#1e3a5f]">Tampilkan tanggal:</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="input-field w-auto text-sm"
              />
              <button
                onClick={() => setFilterDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-1.5 text-xs font-medium bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2a4f7f] transition-colors whitespace-nowrap"
              >
                Hari Ini
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-[#34D399] border border-black"></span>
                Active
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-[#FCD34D] border border-dashed border-gray-500 opacity-50"></span>
                Inactive
              </span>
            </div>
          </div>
          <BerthingCanvas bookings={filteredBookings} />
        </div>
      </div>

      {/* Data Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Data Table */}
        <div className="card overflow-hidden p-3 sm:p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-[#1e3a5f]">Data Booking</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm flex items-center gap-1.5 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Data
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="table-header text-[12px]">
                  <th className="px-1 py-1.5 text-center">NO</th>
                  <th className="px-1 py-1.5 text-center">NAMA KAPAL</th>
                  <th className="px-1 py-1.5 text-center">AGEN</th>
                  <th className="px-1 py-1.5 text-center">LOA</th>
                  <th className="px-1 py-1.5 text-center">GT</th>
                  <th className="px-1 py-1.5 text-center">REALISASI</th>
                  <th className="px-1 py-1.5 text-center">MUATAN</th>
                  <th className="px-1 py-1.5 text-center">POSISI</th>
                  <th className="px-1 py-1.5 text-center">ETA/IN</th>
                  <th className="px-1 py-1.5 text-center">ETD/OUT</th>
                  <th className="px-1 py-1.5 text-center">STATUS</th>
                  <th className="px-1 py-1.5 text-center">REQUEST</th>
                  <th className="px-1 py-1.5 text-left">KET</th>
                  {canEdit && <th className="px-1 py-1.5 text-center">AKSI</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={canEdit ? 14 : 13} className="px-4 py-8 text-center text-gray-500">
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
                    <td colSpan={canEdit ? 14 : 13} className="px-4 py-8 text-center text-gray-500">
                      Tidak ada data booking untuk tanggal ini
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((booking, index) => (
                    <tr key={booking.id_booking} className="hover:bg-gray-50 transition-colors">
                      <td className="px-1.5 py-2 text-center text-gray-600">{index + 1}</td>
                      <td className="px-1.5 py-2 font-medium text-gray-800">{booking.nama_kapal || booking.ship_name || '-'}</td>
                      <td className="px-1.5 py-2 text-gray-600">{booking.agency_name || '-'}</td>
                      <td className="px-1.5 py-2 text-center text-gray-600">{booking.loa ? Math.round(Number(booking.loa)) : '-'}</td>
                      <td className="px-1.5 py-2 text-center text-gray-600">{booking.gt ? Math.round(Number(booking.gt)) : '-'}</td>
                      <td className="px-1.5 py-2 text-center text-gray-600">{booking.realisasi || '-'}</td>
                      <td className="px-1.5 py-2 text-center text-gray-600">{booking.muatan || booking.total_muatan || '-'}</td>
                      <td className="px-1.5 py-2 text-center text-gray-600">
                        {booking.pos_start != null && booking.pos_end != null ? `${Math.round(Number(booking.pos_start))}-${Math.round(Number(booking.pos_end))}` : '-'}
                      </td>
                      <td className="px-1.5 py-2 text-center text-gray-600 whitespace-nowrap">
                        {booking.eta_in ? new Date(booking.eta_in).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-1.5 py-2 text-center text-gray-600 whitespace-nowrap">
                        {booking.etd_out ? new Date(booking.etd_out).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-1.5 py-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          booking.status === 'active' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {booking.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-1.5 py-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          booking.status_request === 'approved' ? 'bg-green-100 text-green-700' :
                          booking.status_request === 'rejected' ? 'bg-red-100 text-red-700' :
                          booking.status_request === 'completed' ? 'bg-gray-200 text-gray-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {booking.status_request
                            ? booking.status_request.charAt(0).toUpperCase() + booking.status_request.slice(1)
                            : '-'}
                        </span>
                      </td>
                      <td className="px-1.5 py-2 text-gray-600 max-w-[80px] truncate" title={booking.keterangan || ''}>
                        {booking.keterangan || '-'}
                      </td>
                      {canEdit && (
                      <td className="px-1.5 py-2 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => {
                              setEditBooking(booking);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setDeleteBooking(booking);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Booking Modal */}
      <AddBookingModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => fetchBookings()}
      />

      {/* Edit Booking Modal */}
      <EditBookingModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditBooking(null); }}
        onSuccess={() => fetchBookings()}
        booking={editBooking}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteBooking(null); }}
        onConfirm={async () => {
          try {
            await api.delete('/bookings/' + deleteBooking.id_booking);
            fetchBookings();
            setShowDeleteModal(false);
            setDeleteBooking(null);
            setToast({ message: 'Booking berhasil dihapus.', type: 'success' });
          } catch (err) {
            const parsed = parseApiError(err, { entity: 'booking', action: 'delete' });
            setToast({ message: parsed.message, type: 'error' });
            setShowDeleteModal(false);
            setDeleteBooking(null);
          }
        }}
        bookingName={deleteBooking?.nama_kapal || deleteBooking?.ship_name || ''}
      />

      {/* Toast notification */}
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
