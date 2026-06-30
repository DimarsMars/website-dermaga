import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { formatLogMessage } from '../utils/format';

const ACTIVITY_TYPES = [
  { value: '', label: 'Semua Aktivitas' },
  { value: 'login', label: 'Login' },
  { value: 'booking_created', label: 'Booking Dibuat' },
  { value: 'booking_approved', label: 'Booking Disetujui' },
  { value: 'booking_rejected', label: 'Booking Ditolak' },
  { value: 'booking_extended', label: 'Booking Diperpanjang' },
  { value: 'position_edited', label: 'Posisi Diedit' },
];

/**
 * ActivityLog — Filterable activity log table component.
 * Fetches from GET /api/activity with optional date range and activity type filters.
 */
export default function ActivityLog({ filters, onFiltersChange }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.activityType) params.activityType = filters.activityType;

      const res = await api.get('/activity', { params });
      setLogs(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Gagal memuat log aktivitas');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, filters.activityType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getUserTypeBadge(userType) {
    const styles = {
      agen: 'bg-blue-100 text-blue-700',
      petugas: 'bg-green-100 text-green-700',
      admin: 'bg-purple-100 text-purple-700',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${styles[userType] || 'bg-gray-100 text-gray-700'}`}>
        {userType}
      </span>
    );
  }

  function getActivityLabel(type) {
    const found = ACTIVITY_TYPES.find((t) => t.value === type);
    return found ? found.label : type;
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Akhir</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Aktivitas</label>
          <select
            value={filters.activityType}
            onChange={(e) => onFiltersChange({ ...filters, activityType: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {ACTIVITY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Waktu
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipe User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktivitas
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Keterangan
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Memuat data...
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                  Tidak ada data log aktivitas.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id_log} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                    {formatDateTime(log.date_time)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {getUserTypeBadge(log.user_type)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {getActivityLabel(log.activity_type)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatLogMessage(log.keterangan) || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
