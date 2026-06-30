import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { MAX_LENGTH, CLEARANCE } from '../utils/constants';
import { formatNumber } from '../utils/format';
import { parseApiError, formatConflicts } from '../utils/errorMessages';

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const TAHUN_OPTIONS = [2026, 2027, 2028, 2029, 2030];

const JAM_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: String(i).padStart(2, '0') + ':00',
}));

/**
 * AddBookingModal — Modal form for adding new booking data.
 * Uses custom dropdown-based date/time pickers with rounded hours and availability checking.
 */
export default function AddBookingModal({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  const isAgent = user?.role === 'agen';
  const [ships, setShips] = useState([]);
  const [agents, setAgents] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loadingShips, setLoadingShips] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [formData, setFormData] = useState({
    id_kapal: '',
    id_agen: '',
    pos_start: '',
    pbm: '',
    keterangan: '',
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

  // Fetch ships and agents on mount
  useEffect(() => {
    if (isOpen) {
      fetchShips();
      fetchAgents();
      fetchAllBookings();

      const now = new Date();
      setEtaTanggal(String(now.getDate()));
      setEtaBulan(String(now.getMonth()));
      setEtaTahun(String(now.getFullYear()));
      setEtaJam(String(now.getHours()));

      // ETD otomatis diset 2 jam setelah ETA agar form langsung valid tanpa error awal
      const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      setEtdTanggal(String(later.getDate()));
      setEtdBulan(String(later.getMonth()));
      setEtdTahun(String(later.getFullYear()));
      setEtdJam(String(later.getHours()));
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      setAllBookings(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    }
  };

  // Filter ships based on search term
  const filteredShips = useMemo(() => {
    if (!searchTerm.trim()) return ships;
    return ships.filter((ship) =>
      ship.nama_kapal?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [ships, searchTerm]);

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

    allBookings.forEach((booking) => {
      // Only check approved bookings
      if (booking.status !== 'approved') return;

      // Check position overlap
      const bStart = parseFloat(booking.pos_start);
      const bEnd = parseFloat(booking.pos_end);
      if (!positionsOverlap(bStart, bEnd, posStart, posEndVal)) return;

      // Check if booking overlaps with the selected date
      const bookingEta = new Date(booking.eta_in);
      const bookingEtd = new Date(booking.etd_out);

      for (let hour = 0; hour < 24; hour++) {
        const checkTime = new Date(selectedDate);
        checkTime.setHours(hour, 0, 0, 0);

        const checkTimeEnd = new Date(checkTime);
        checkTimeEnd.setHours(hour + 1, 0, 0, 0);

        // If this hour slot overlaps with an existing booking
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

    allBookings.forEach((booking) => {
      if (booking.status !== 'approved') return;

      const bStart = parseFloat(booking.pos_start);
      const bEnd = parseFloat(booking.pos_end);
      if (!positionsOverlap(bStart, bEnd, posStart, posEndVal)) return;

      const bookingEta = new Date(booking.eta_in);
      const bookingEtd = new Date(booking.etd_out);

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

  // Handle ship selection from dropdown
  const handleSelectShip = (idKapal) => {
    setFormData((prev) => ({ ...prev, id_kapal: String(idKapal) }));
    setError('');
    setConflicts([]);
    setFieldErrors((prev) => {
      if (!prev.id_kapal) return prev;
      const next = { ...prev };
      delete next.id_kapal;
      return next;
    });
    setIsDropdownOpen(false);
    setSearchTerm(''); // Reset pencarian setelah dipilih
  };

  // Validate inputs locally and return a map of friendly Indonesian errors per field.
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

    if (etaIso && new Date(etaIso) < new Date()) {
      errs.eta_in = 'Waktu kedatangan tidak boleh di masa lalu.';
    }
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
        pos_start: parseFloat(formData.pos_start),
        eta_in: etaDatetime,
        etd_out: etdDatetime,
        pbm: formData.pbm || null,
        keterangan: formData.keterangan || null,
      };

      // Add id_agen only for manual booking (petugas/admin)
      if (!isAgent) {
        payload.id_agen = Number(formData.id_agen);
      }

      const res = await api.post(isAgent ? '/bookings' : '/bookings/manual', payload);
      if (res.data.success) {
        onSuccess && onSuccess(res.data.data);
        resetForm();
        onClose();
      }
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'booking', action: 'create' });
      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors);
      setConflicts(parsed.conflicts);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ id_kapal: '', id_agen: '', pos_start: '', pbm: '', keterangan: '' });

    const now = new Date();
    setEtaTanggal(String(now.getDate()));
    setEtaBulan(String(now.getMonth()));
    setEtaTahun(String(now.getFullYear()));
    setEtaJam(String(now.getHours()));

    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    setEtdTanggal(String(later.getDate()));
    setEtdBulan(String(later.getMonth()));
    setEtdTahun(String(later.getFullYear()));
    setEtdJam(String(later.getHours()));
    
    setError('');
    setConflicts([]);
    setFieldErrors({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border-2 border-[#5b9bd5]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */} 
        <div className="flex items-center justify-between pt-6 px-6 pb-4">
          <div className="flex-1" />
          <h2 className="text-2xl font-bold italic text-[#1e3a5f] text-center">Add Data</h2>
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
            
            {/* KOLOM NAMA KAPAL BERFITUR SEARCH */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Kapal</label>
              
              {/* Box Pemicu Dropdown */}
              <div
                onClick={() => !loadingShips && setIsDropdownOpen(!isDropdownOpen)}
                className={`input-field flex items-center justify-between cursor-pointer bg-white ${
                  fieldErrors.id_kapal ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''
                } ${loadingShips ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              >
                <span className={selectedShip ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                  {loadingShips 
                    ? 'Memuat...' 
                    : selectedShip 
                      ? selectedShip.nama_kapal 
                      : 'Pilih Nama Kapal'}
                </span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Panel Isi Dropdown Menu (Muncul jika diklik) */}
              {isDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-hidden flex flex-col">
                  
                  {/* Kolom Kolom Search Input */}
                  <div className="p-2 border-b border-gray-100 bg-gray-50 sticky top-0">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Cari nama kapal..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-1.5 pl-8 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                        autoFocus
                      />
                      <svg className="absolute left-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  {/* List Hasil Kapal */}
                  <div className="overflow-y-auto max-h-44 divide-y divide-gray-50">
                    {filteredShips.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-500 text-center italic">
                        Kapal tidak ditemukan
                      </div>
                    ) : (
                      filteredShips.map((ship) => (
                        <div
                          key={ship.id_kapal}
                          onClick={() => handleSelectShip(ship.id_kapal)}
                          className={`px-4 py-2.5 text-xs cursor-pointer transition-colors text-left hover:bg-gray-50 ${
                            Number(formData.id_kapal) === ship.id_kapal 
                              ? 'bg-blue-50 text-[#1e3a5f] font-semibold' 
                              : 'text-gray-700'
                          }`}
                        >
                          {ship.nama_kapal}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
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
                        className={isDisabled ? 'opacity-50 cursor-not-allowed bg-red-50 text-red-400 line-through' : ''}
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
                        className={isDisabled ? 'opacity-50 cursor-not-allowed bg-red-50 text-red-400 line-through' : ''}
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

          {/* Submit Button */}
          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Menyimpan...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
