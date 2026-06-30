import { useState, useMemo } from 'react';
import api from '../services/api';
import { parseApiError, formatConflicts } from '../utils/errorMessages';

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const TAHUN_OPTIONS = [2024, 2025, 2026, 2027];

const JAM_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: String(i).padStart(2, '0') + ':00',
}));

/**
 * ExtendTimeForm — Allows Agen_Kapal to request an extension of berth duration.
 * Uses dropdown-based date/time pickers (rounded hours) consistent with AddBookingModal.
 *
 * @param {{ booking: object, onSuccess: (updatedBooking: object, message: string) => void, showToast: (message: string, type: string) => void }} props
 */
export default function ExtendTimeForm({ booking, onSuccess, showToast }) {
  const [etdTanggal, setEtdTanggal] = useState('');
  const [etdBulan, setEtdBulan] = useState('');
  const [etdTahun, setEtdTahun] = useState('');
  const [etdJam, setEtdJam] = useState('');

  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState(null);
  const [validationError, setValidationError] = useState('');

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

  // Combine date parts into ISO string
  const buildDatetime = (tanggal, bulan, tahun, jam) => {
    if (!tanggal || bulan === '' || !tahun || jam === '') return null;
    const date = new Date(Number(tahun), Number(bulan), Number(tanggal), Number(jam), 0, 0, 0);
    return date.toISOString();
  };

  const newEtdPreview = useMemo(() => {
    const iso = buildDatetime(etdTanggal, etdBulan, etdTahun, etdJam);
    return iso ? formatDateTime(iso) : '';
  }, [etdTanggal, etdBulan, etdTahun, etdJam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setConflicts(null);
    setValidationError('');

    const newEtdIso = buildDatetime(etdTanggal, etdBulan, etdTahun, etdJam);

    if (!newEtdIso) {
      setValidationError('Tanggal, bulan, tahun, dan jam keberangkatan baru harus diisi');
      return;
    }

    const newEtdDate = new Date(newEtdIso);
    const currentEtdDate = new Date(booking.etd_out);

    if (newEtdDate <= currentEtdDate) {
      setValidationError('Waktu keberangkatan baru harus setelah ETD saat ini');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/bookings/${booking.id_booking}/extend`, {
        new_etd_out: newEtdIso,
      });

      if (response.data.success) {
        onSuccess(response.data.data, 'Permintaan perpanjangan waktu berhasil diajukan. Menunggu persetujuan petugas.');
        setEtdTanggal(''); setEtdBulan(''); setEtdTahun(''); setEtdJam('');
      }
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'booking', action: 'extend' });
      if (parsed.conflicts.length > 0) {
        setConflicts(parsed.conflicts);
      } else {
        setValidationError(parsed.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-5 p-3 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="text-sm font-semibold text-blue-800 mb-3">Perpanjangan Waktu Sandar</h3>

      {/* Current ETD display */}
      <div className="mb-3">
        <span className="text-xs text-gray-600">ETD Saat Ini:</span>
        <p className="text-sm font-medium text-gray-800">{formatDateTime(booking.etd_out)}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <label className="block text-xs font-semibold text-gray-700 mb-2">
          ETD Baru (harus setelah ETD saat ini):
        </label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Tanggal</label>
            <select
              value={etdTanggal}
              onChange={(e) => { setEtdTanggal(e.target.value); setValidationError(''); setConflicts(null); }}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">--</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Bulan</label>
            <select
              value={etdBulan}
              onChange={(e) => { setEtdBulan(e.target.value); setValidationError(''); setConflicts(null); }}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">--</option>
              {BULAN_NAMES.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Tahun</label>
            <select
              value={etdTahun}
              onChange={(e) => { setEtdTahun(e.target.value); setValidationError(''); setConflicts(null); }}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">--</option>
              {TAHUN_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Jam</label>
            <select
              value={etdJam}
              onChange={(e) => { setEtdJam(e.target.value); setValidationError(''); setConflicts(null); }}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">--</option>
              {JAM_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* New ETD preview */}
        {newEtdPreview && (
          <div className="mb-3 text-xs text-gray-600">
            ETD Baru: <strong className="text-blue-700">{newEtdPreview}</strong>
          </div>
        )}

        {/* Validation error */}
        {validationError && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {validationError}
          </div>
        )}

        {/* Conflict warnings */}
        {conflicts && conflicts.length > 0 && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-xs font-semibold text-yellow-800 mb-1">
              ⚠️ Bentrok dengan booking berikut:
            </p>
            <ul className="text-xs text-yellow-700 space-y-1">
              {formatConflicts(conflicts).map((line, idx) => (
                <li key={idx} className="flex items-start gap-1">
                  <span className="text-yellow-600">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-yellow-600 mt-2">
              Perpanjangan akan mengirim notifikasi delay cascade ke agen terkait.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? 'Memproses...' : 'Ajukan Perpanjangan'}
        </button>
      </form>
    </div>
  );
}
