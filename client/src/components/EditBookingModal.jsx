import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { MAX_LENGTH, CLEARANCE } from '../utils/constants';
import { formatNumber } from '../utils/format';
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
 * EditBookingModal — Modal form for editing existing booking data.
 * Reuses the same form structure as AddBookingModal but pre-fills with existing data.
 */
export default function EditBookingModal({ isOpen, onClose, onSuccess, booking }) {
  const [ships, setShips] = useState([]);
  const [agents, setAgents] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loadingShips, setLoadingShips] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});

  const [formData, setFormData] = useState({
    id_kapal: '',
    id_agen: '',
    pos_start: '',
    pbm: '',
    keterangan: '',
    status: '',
    status_request: '',
  });

  // ETA/IN date parts
  const [etaTanggal, setEtaTanggal] = useState('');
  const [etaBulan, setEtaBulan] = useState('');
  const [etaTahun, setEtaTahun] = useState('');
  const [etaJam, setEtaJam] = useState('');

  // ETD/OUT date parts
  const [etdTanggal, setEtdTanggal] = useState('');
  const [etdBulan, setEtdBulan] = useState('');
  const [etdTahun, setEtdTahun] = useState('');
  const [etdJam, setEtdJam] = useState('');

  // Pre-fill form when booking changes
  useEffect(() => {
    if (isOpen && booking) {
      setFormData({
        id_kapal: String(booking.id_kapal || ''),
        id_agen: String(booking.id_agen || ''),
        pos_start: String(booking.pos_start || ''),
        pbm: booking.pbm || '',
        keterangan: booking.keterangan || '',
        status: booking.status || 'inactive',
        status_request: booking.status_request || 'pending',
      });

      // Parse ETA/IN
      if (booking.eta_in) {
        const eta = new Date(booking.eta_in);
        setEtaTanggal(String(eta.getDate()));
        setEtaBulan(String(eta.getMonth()));
        setEtaTahun(String(eta.getFullYear()));
        setEtaJam(String(eta.getHours()));
      }

      // Parse ETD/OUT
      if (booking.etd_out) {
        const etd = new Date(booking.etd_out);
        setEtdTanggal(String(etd.getDate()));
        setEtdBulan(String(etd.getMonth()));
        setEtdTahun(String(etd.getFullYear()));
        setEtdJam(String(etd.getHours()));
      }
    }
  }, [isOpen, booking]);

  // Fetch ships and agents on mount
  useEffect(() => {
    if (isOpen) {
      fetchShips();
      fetchAgents();
      fetchAllBookings();
    }
  }, [isOpen]);

  const fetchShips = async () => {
    setLoadingShips(true);
    try {
      const res = await api.get('/ships');
      setShips(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch ships:', err);
    } finally {
      setLoadingShips(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await api.get('/agents');
      setAgents(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  };

  const fetchAllBookings = async () => {
    try {
      const res = await api.get('/bookings');
      setAllBookings((res.data.data || []).filter(b => b.id_booking !== booking?.id_booking));
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    }
  };

  // Selected ship details
  const selectedShip = useMemo(() => {
    return ships.find((s) => s.id_kapal === Number(formData.id_kapal));
  }, [ships, formData.id_kapal]);

  // Auto-fill agent when ship is selected
  useEffect(() => {
    if (selectedShip) {
      setFormData((prev) => ({ ...prev, id_agen: String(selectedShip.id_agen) }));
    }
  }, [selectedShip]);

  // Calculate POS_END
  const posEnd = useMemo(() => {
    const posStart = parseFloat(formData.pos_start);
    if (isNaN(posStart) || !selectedShip) return '';
    return (posStart + parseFloat(selectedShip.loa) + CLEARANCE).toFixed(2);
  }, [formData.pos_start, selectedShip]);

  // Get agent name
  const agentName = useMemo(() => {
    if (!selectedShip) return '';
    const agent = agents.find((a) => a.id_agen === selectedShip.id_agen);
    return agent ? agent.agency_name : selectedShip.agency_name || '';
  }, [selectedShip, agents]);

  // Check if positions overlap
  const positionsOverlap = useCallback((bookingStart, bookingEnd, newStart, newEnd) => {
    return bookingStart < newEnd && bookingEnd > newStart;
  }, []);

  // Get disabled hours for ETA based on date and position
  const disabledEtaHours = useMemo(() => {
    if (!etaTanggal || !etaBulan || !etaTahun || !formData.pos_start || !selectedShip) {
      return new Set();
    }

    const posStart = parseFloat(formData.pos_start);
    const posEndVal = posStart + parseFloat(selectedShip.loa) + CLEARANCE;
    const selectedDate = new Date(Number(etaTahun), Number(etaBulan), Number(etaTanggal));

    const disabled = new Set();

    allBookings.forEach((b) => {
      if (b.status !== 'approved') return;
      const bStart = parseFloat(b.pos_start);
      const bEnd = parseFloat(b.pos_end);
      if (!positionsOverlap(bStart, bEnd, posStart, posEndVal)) return;

      const bookingEta = new Date(b.eta_in);
      const bookingEtd = new Date(b.etd_out);

      for (let hour = 0; hour < 24; hour++) {
        const checkTime = new Date(selectedDate);
        checkTime.setHours(hour, 0, 0, 0);
        const checkTimeEnd = new Date(checkTime);
        checkTimeEnd.setHours(hour + 1, 0, 0, 0);
        if (checkTime < bookingEtd && checkTimeEnd > bookingEta) {
          disabled.add(hour);
        }
      }
    });

    return disabled;
  }, [etaTanggal, etaBulan, etaTahun, formData.pos_start, selectedShip, allBookings, positionsOverlap]);

  // Get disabled hours for ETD based on date and position
  const disabledEtdHours = useMemo(() => {
    if (!etdTanggal || !etdBulan || !etdTahun || !formData.pos_start || !selectedShip) {
      return new Set();
    }

    const posStart = parseFloat(formData.pos_start);
    const posEndVal = posStart + parseFloat(selectedShip.loa) + CLEARANCE;
    const selectedDate = new Date(Number(etdTahun), Number(etdBulan), Number(etdTanggal));

    const disabled = new Set();

    allBookings.forEach((b) => {
      if (b.status !== 'approved') return;
      const bStart = parseFloat(b.pos_start);
      const bEnd = parseFloat(b.pos_end);
      if (!positionsOverlap(bStart, bEnd, posStart, posEndVal)) return;

      const bookingEta = new Date(b.eta_in);
      const bookingEtd = new Date(b.etd_out);

      for (let hour = 0; hour < 24; hour++) {
        const checkTime = new Date(selectedDate);
        checkTime.setHours(hour, 0, 0, 0);
        const checkTimeEnd = new Date(checkTime);
        checkTimeEnd.setHours(hour + 1, 0, 0, 0);
        if (checkTime < bookingEtd && checkTimeEnd > bookingEta) {
          disabled.add(hour);
        }
      }
    });

    return disabled;
  }, [etdTanggal, etdBulan, etdTahun, formData.pos_start, selectedShip, allBookings, positionsOverlap]);

  // Combine date parts into ISO string
  const buildDatetime = (tanggal, bulan, tahun, jam) => {
    if (!tanggal || bulan === '' || !tahun || jam === '') return null;
    const date = new Date(Number(tahun), Number(bulan), Number(tanggal), Number(jam), 0, 0, 0);
    return date.toISOString();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setConflicts([]);
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const validate = (etaIso, etdIso) => {
    const errs = {};
    if (!formData.id_kapal) errs.id_kapal = 'Kapal wajib dipilih.';

    if (formData.pos_start === '' || formData.pos_start === null || formData.pos_start === undefined) {
      errs.pos_start = 'Posisi awal wajib diisi.';
    } else {
      const ps = Number(formData.pos_start);
      if (Number.isNaN(ps)) errs.pos_start = 'Posisi awal harus berupa angka.';
      else if (ps < 0) errs.pos_start = 'Posisi awal tidak boleh negatif.';
      else if (selectedShip) {
        const end = ps + Number(selectedShip.loa) + CLEARANCE;
        if (end > MAX_LENGTH) {
          errs.pos_start = `Posisi akhir akan melewati ujung dermaga (${MAX_LENGTH} m). Maksimum posisi awal: ${Math.max(0, MAX_LENGTH - Number(selectedShip.loa) - CLEARANCE).toFixed(0)} m.`;
        }
      }
    }

    if (!etaIso) errs.eta_in = 'Tanggal, bulan, tahun, dan jam ETA/IN wajib lengkap.';
    if (!etdIso) errs.etd_out = 'Tanggal, bulan, tahun, dan jam ETD/OUT wajib lengkap.';
    if (etaIso && etdIso && new Date(etdIso) <= new Date(etaIso)) {
      errs.etd_out = 'Waktu keberangkatan harus setelah waktu kedatangan.';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setConflicts([]);
    setFieldErrors({});

    const etaDatetime = buildDatetime(etaTanggal, etaBulan, etaTahun, etaJam);
    const etdDatetime = buildDatetime(etdTanggal, etdBulan, etdTahun, etdJam);

    const errs = validate(etaDatetime, etdDatetime);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Periksa kembali isian yang ditandai merah.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id_kapal: Number(formData.id_kapal),
        id_agen: Number(formData.id_agen),
        pos_start: parseFloat(formData.pos_start),
        eta_in: etaDatetime,
        etd_out: etdDatetime,
        pbm: formData.pbm || null,
        keterangan: formData.keterangan || null,
        status: formData.status,
        status_request: formData.status_request,
      };

      const res = await api.put(`/bookings/${booking.id_booking}`, payload);
      if (res.data.success) {
        onSuccess && onSuccess(res.data.data);
        onClose();
      }
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'booking', action: 'update' });
      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors);
      setConflicts(parsed.conflicts);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !booking) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border-2 border-[#5b9bd5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pt-6 px-6 pb-4">
          <div className="flex-1" />
          <h2 className="text-2xl font-bold italic text-[#1e3a5f] text-center">Edit Data</h2>
          <div className="flex-1 flex justify-end">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="mx-6 mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
            <p className="font-medium mb-1">Bentrok dengan booking berikut:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {formatConflicts(conflicts).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-orange-600">Coba ubah posisi awal atau jam ETA/ETD ya.</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3">
          {/* Row 1: Nama Kapal | Posisi Awal | Posisi Akhir */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Kapal</label>
              <select
                name="id_kapal"
                value={formData.id_kapal}
                onChange={handleChange}
                className={`input-field ${fieldErrors.id_kapal ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                disabled={loadingShips}
              >
                <option value="">{loadingShips ? 'Memuat...' : 'Pilih Nama Kapal'}</option>
                {ships.map((ship) => (
                  <option key={ship.id_kapal} value={ship.id_kapal}>
                    {ship.nama_kapal}
                  </option>
                ))}
              </select>
              {fieldErrors.id_kapal && <p className="mt-1 text-xs text-red-600">{fieldErrors.id_kapal}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Posisi Awal</label>
              <input
                type="number"
                name="pos_start"
                value={formData ? formatNumber(formData.pos_start) : ''}
                onChange={handleChange}
                min="0"
                max={MAX_LENGTH}
                placeholder="0"
                className={`input-field ${fieldErrors.pos_start ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
              />
              {fieldErrors.pos_start && <p className="mt-1 text-xs text-red-600">{fieldErrors.pos_start}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Posisi Akhir</label>
              <input
                type="text"
                value={posEnd ? formatNumber(posEnd) : '-'}
                readOnly
                className="input-field bg-gray-100 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Row 2: Agen | LOA | GT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Agen</label>
              <input
                type="text"
                value={agentName}
                readOnly
                className="input-field bg-gray-100 cursor-not-allowed"
                placeholder="Otomatis dari kapal"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">LOA</label>
              <input
                type="text"
                value={selectedShip ? formatNumber(selectedShip.loa) : '-'}
                readOnly
                className="input-field bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">GT</label>
              <input
                type="text"
                value={selectedShip && selectedShip.gt ? formatNumber(selectedShip.gt) : '-'}
                readOnly
                className="input-field bg-gray-100 cursor-not-allowed"
              />
            </div>
          </div>

          {/* ETA/IN + ETD/OUT side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ETA/IN DateTime Picker */}
          <div className={`border rounded-lg p-4 ${fieldErrors.eta_in ? 'border-red-300 bg-red-50/30' : 'border-[#1e3a5f]/20 bg-[#1e3a5f]/[0.02]'}`}>
            <label className="block text-sm font-semibold text-[#1e3a5f] mb-3">
              Waktu Kedatangan (ETA/IN)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
                <select
                  value={etaTanggal}
                  onChange={(e) => { setEtaTanggal(e.target.value); setEtaJam(''); }}
                  className="input-field text-sm"
                >
                  <option value="">--</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bulan</label>
                <select
                  value={etaBulan}
                  onChange={(e) => { setEtaBulan(e.target.value); setEtaJam(''); }}
                  className="input-field text-sm"
                >
                  <option value="">--</option>
                  {BULAN_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tahun</label>
                <select
                  value={etaTahun}
                  onChange={(e) => { setEtaTahun(e.target.value); setEtaJam(''); }}
                  className="input-field text-sm"
                >
                  <option value="">--</option>
                  {TAHUN_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Jam</label>
                <select
                  value={etaJam}
                  onChange={(e) => setEtaJam(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">--</option>
                  {JAM_OPTIONS.map(({ value, label }) => {
                    const isDisabled = disabledEtaHours.has(value);
                    return (
                      <option
                        key={value}
                        value={value}
                        disabled={isDisabled}
                        style={isDisabled ? { color: '#f87171', backgroundColor: '#fef2f2', textDecoration: 'line-through' } : {}}
                      >
                        {label}{isDisabled ? ' (terisi)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            {fieldErrors.eta_in && <p className="mt-2 text-xs text-red-600">{fieldErrors.eta_in}</p>}
          </div>

          {/* ETD/OUT DateTime Picker */}
          <div className={`border rounded-lg p-4 ${fieldErrors.etd_out ? 'border-red-300 bg-red-50/30' : 'border-[#1e3a5f]/20 bg-[#1e3a5f]/[0.02]'}`}>
            <label className="block text-sm font-semibold text-[#1e3a5f] mb-3">
              Waktu Keberangkatan (ETD/OUT)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
                <select
                  value={etdTanggal}
                  onChange={(e) => { setEtdTanggal(e.target.value); setEtdJam(''); }}
                  className="input-field text-sm"
                >
                  <option value="">--</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bulan</label>
                <select
                  value={etdBulan}
                  onChange={(e) => { setEtdBulan(e.target.value); setEtdJam(''); }}
                  className="input-field text-sm"
                >
                  <option value="">--</option>
                  {BULAN_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tahun</label>
                <select
                  value={etdTahun}
                  onChange={(e) => { setEtdTahun(e.target.value); setEtdJam(''); }}
                  className="input-field text-sm"
                >
                  <option value="">--</option>
                  {TAHUN_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Jam</label>
                <select
                  value={etdJam}
                  onChange={(e) => setEtdJam(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">--</option>
                  {JAM_OPTIONS.map(({ value, label }) => {
                    const isDisabled = disabledEtdHours.has(value);
                    return (
                      <option
                        key={value}
                        value={value}
                        disabled={isDisabled}
                        style={isDisabled ? { color: '#f87171', backgroundColor: '#fef2f2', textDecoration: 'line-through' } : {}}
                      >
                        {label}{isDisabled ? ' (terisi)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            {fieldErrors.etd_out && <p className="mt-2 text-xs text-red-600">{fieldErrors.etd_out}</p>}
          </div>
          </div>

          {/* Row: Status | Status Request */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Status Kapal</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input-field"
              >
                <option value="inactive">Inactive (Belum di Dermaga)</option>
                <option value="active">Active (Sedang di Dermaga)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Status Request</label>
              <select
                name="status_request"
                value={formData.status_request}
                onChange={handleChange}
                className="input-field"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Row: PBM | Keterangan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">PBM</label>
              <input
                type="text"
                name="pbm"
                value={formData.pbm}
                onChange={handleChange}
                placeholder="Nama PBM"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Keterangan</label>
              <input
                type="text"
                name="keterangan"
                value={formData.keterangan}
                onChange={handleChange}
                placeholder="Keterangan"
                className="input-field"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all duration-200"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-2.5 bg-[#1e3a5f] text-white font-semibold rounded-lg hover:bg-[#2a4f7f] transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Menyimpan...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
