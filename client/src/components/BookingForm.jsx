import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { MAX_LENGTH, CLEARANCE, ROLES } from '../utils/constants';

/**
 * BookingForm component for submitting pre-booking requests.
 *
 * Props:
 * - variant: 'agent' | 'manual' — determines form mode
 *   - 'agent': for Agen_Kapal users (ship filtered by agent, no agent dropdown)
 *   - 'manual': for Petugas/Admin users (includes agent selection dropdown)
 * - onSuccess: callback after successful submission
 */
export default function BookingForm({ variant = 'agent', onSuccess }) {
  const { user } = useAuth();

  // Determine variant based on user role if not explicitly set
  const formVariant = useMemo(() => {
    if (variant) return variant;
    return user?.role === ROLES.AGENT ? 'agent' : 'manual';
  }, [variant, user?.role]);

  const isManual = formVariant === 'manual';

  // Form state
  const [formData, setFormData] = useState({
    id_kapal: '',
    id_agen: '',
    pos_start: '',
    eta_in: '',
    etd_out: '',
    pbm: '',
    keterangan: '',
  });

  // Data lists
  const [ships, setShips] = useState([]);
  const [agents, setAgents] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [fetchingShips, setFetchingShips] = useState(false);
  const [fetchingAgents, setFetchingAgents] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');

  // Selected ship LOA for POS_END calculation
  const selectedShip = useMemo(() => {
    return ships.find((s) => s.id_kapal === Number(formData.id_kapal));
  }, [ships, formData.id_kapal]);

  // Calculate POS_END in realtime
  const posEnd = useMemo(() => {
    const posStart = parseFloat(formData.pos_start);
    if (isNaN(posStart) || !selectedShip) return null;
    return posStart + parseFloat(selectedShip.loa) + CLEARANCE;
  }, [formData.pos_start, selectedShip]);

  // Check if POS_END exceeds MAX_LENGTH
  const posEndExceeds = posEnd !== null && posEnd > MAX_LENGTH;

  // Fetch ships on mount (filtered by agent for agen role)
  useEffect(() => {
    fetchShips();
  }, []);

  // Fetch agents for manual booking form
  useEffect(() => {
    if (isManual) {
      fetchAgents();
    }
  }, [isManual]);

  // When agent changes in manual mode, re-fetch ships for that agent
  useEffect(() => {
    if (isManual && formData.id_agen) {
      fetchShipsForAgent(formData.id_agen);
    }
  }, [isManual, formData.id_agen]);

  async function fetchShips() {
    setFetchingShips(true);
    try {
      const response = await api.get('/ships');
      setShips(response.data.data || []);
    } catch (err) {
      console.error('Error fetching ships:', err);
    } finally {
      setFetchingShips(false);
    }
  }

  async function fetchShipsForAgent(agentId) {
    setFetchingShips(true);
    try {
      // For manual mode, fetch all ships and filter client-side by agent
      const response = await api.get('/ships');
      const allShips = response.data.data || [];
      const filtered = allShips.filter((s) => s.id_agen === Number(agentId));
      setShips(filtered);
      // Reset ship selection when agent changes
      setFormData((prev) => ({ ...prev, id_kapal: '' }));
    } catch (err) {
      console.error('Error fetching ships for agent:', err);
    } finally {
      setFetchingShips(false);
    }
  }

  async function fetchAgents() {
    setFetchingAgents(true);
    try {
      const response = await api.get('/agents');
      setAgents(response.data.data || []);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setFetchingAgents(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-specific error on change
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    // Clear server errors on any change
    if (serverError) setServerError(null);
    if (conflicts.length > 0) setConflicts([]);
  }

  function validateForm() {
    const newErrors = {};

    if (isManual && !formData.id_agen) {
      newErrors.id_agen = 'Pilih agen terlebih dahulu';
    }
    if (!formData.id_kapal) {
      newErrors.id_kapal = 'Pilih kapal terlebih dahulu';
    }
    if (formData.pos_start === '' || formData.pos_start === null) {
      newErrors.pos_start = 'POS_START wajib diisi';
    } else if (parseFloat(formData.pos_start) < 0) {
      newErrors.pos_start = 'POS_START tidak boleh negatif';
    }
    if (!formData.eta_in) {
      newErrors.eta_in = 'Waktu kedatangan wajib diisi';
    }
    if (!formData.etd_out) {
      newErrors.etd_out = 'Waktu keberangkatan wajib diisi';
    }
    if (formData.eta_in && formData.etd_out && formData.eta_in >= formData.etd_out) {
      newErrors.etd_out = 'Waktu keberangkatan harus setelah waktu kedatangan';
    }
    if (formData.eta_in && new Date(formData.eta_in) < new Date()) {
      newErrors.eta_in = 'Waktu kedatangan tidak boleh di waktu yang sudah lewat';
    }

    // Capacity validation
    if (posEndExceeds) {
      newErrors.pos_start = `POS_END (${posEnd?.toFixed(2)}m) melebihi kapasitas dermaga (${MAX_LENGTH}m)`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccessMessage('');
    setServerError(null);
    setConflicts([]);

    if (!validateForm()) return;

    setLoading(true);

    try {
      const payload = {
        id_kapal: Number(formData.id_kapal),
        pos_start: parseFloat(formData.pos_start),
        eta_in: new Date(formData.eta_in).toISOString(),
        etd_out: new Date(formData.etd_out).toISOString(),
        pbm: formData.pbm || null,
        keterangan: formData.keterangan || null,
      };

      let response;
      if (isManual) {
        payload.id_agen = Number(formData.id_agen);
        response = await api.post('/bookings/manual', payload);
      } else {
        response = await api.post('/bookings', payload);
      }

      if (response.data.success) {
        setSuccessMessage(
          isManual
            ? 'Booking berhasil dibuat dengan status Approved!'
            : 'Pre-booking berhasil diajukan! Status: Pending.'
        );
        resetForm();
        if (onSuccess) onSuccess(response.data.data);
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleApiError(err) {
    if (err.response?.data?.error) {
      const { code, message, details } = err.response.data.error;

      if (code === 'VALIDATION_CAPACITY') {
        setErrors((prev) => ({
          ...prev,
          pos_start: message,
        }));
      } else if (code === 'VALIDATION_CONFLICT') {
        setConflicts(details?.conflicts || []);
        setServerError(message);
      } else if (code === 'VALIDATION_FIELDS' && details) {
        const fieldErrors = {};
        details.forEach((d) => {
          fieldErrors[d.field] = d.message;
        });
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      } else {
        setServerError(message || 'Terjadi kesalahan pada server');
      }
    } else {
      setServerError('Terjadi kesalahan jaringan. Silakan coba lagi.');
    }
  }

  function resetForm() {
    setFormData({
      id_kapal: '',
      id_agen: '',
      pos_start: '',
      eta_in: '',
      etd_out: '',
      pbm: '',
      keterangan: '',
    });
    setErrors({});
    setConflicts([]);
    setServerError(null);
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">
        {isManual ? 'Input Booking Manual' : 'Form Pre-Booking'}
      </h2>

      {/* Success message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 font-medium">{successMessage}</p>
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium">{serverError}</p>
        </div>
      )}

      {/* Conflict details */}
      {conflicts.length > 0 && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-orange-800 font-medium mb-2">
            Konflik terdeteksi dengan booking berikut:
          </p>
          <ul className="list-disc list-inside space-y-1">
            {conflicts.map((c, idx) => (
              <li key={idx} className="text-sm text-orange-700">
                {c.nama_kapal} — Posisi: {c.pos_start}m - {c.pos_end}m
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Agent selection (manual mode only) */}
        {isManual && (
          <div>
            <label htmlFor="id_agen" className="block text-sm font-medium text-gray-700 mb-1">
              Agen <span className="text-red-500">*</span>
            </label>
            <select
              id="id_agen"
              name="id_agen"
              value={formData.id_agen}
              onChange={handleChange}
              disabled={fetchingAgents}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.id_agen ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">
                {fetchingAgents ? 'Memuat agen...' : '-- Pilih Agen --'}
              </option>
              {agents.map((agent) => (
                <option key={agent.id_agen} value={agent.id_agen}>
                  {agent.agency_name} ({agent.username})
                </option>
              ))}
            </select>
            {errors.id_agen && (
              <p className="mt-1 text-sm text-red-600">{errors.id_agen}</p>
            )}
          </div>
        )}

        {/* Ship selection */}
        <div>
          <label htmlFor="id_kapal" className="block text-sm font-medium text-gray-700 mb-1">
            Kapal <span className="text-red-500">*</span>
          </label>
          <select
            id="id_kapal"
            name="id_kapal"
            value={formData.id_kapal}
            onChange={handleChange}
            disabled={fetchingShips || (isManual && !formData.id_agen)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.id_kapal ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">
              {fetchingShips
                ? 'Memuat kapal...'
                : isManual && !formData.id_agen
                ? '-- Pilih agen terlebih dahulu --'
                : '-- Pilih Kapal --'}
            </option>
            {ships.map((ship) => (
              <option key={ship.id_kapal} value={ship.id_kapal}>
                {ship.nama_kapal} (LOA: {ship.loa}m)
              </option>
            ))}
          </select>
          {errors.id_kapal && (
            <p className="mt-1 text-sm text-red-600">{errors.id_kapal}</p>
          )}
          {selectedShip && (
            <p className="mt-1 text-xs text-gray-500">
              LOA: {selectedShip.loa}m | GT: {selectedShip.gt || '-'}
            </p>
          )}
        </div>

        {/* POS_START input */}
        <div>
          <label htmlFor="pos_start" className="block text-sm font-medium text-gray-700 mb-1">
            POS_START (meter) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="pos_start"
            name="pos_start"
            value={formData.pos_start}
            onChange={handleChange}
            min="0"
            max={MAX_LENGTH}
            step="0.01"
            placeholder="0"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.pos_start ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.pos_start && (
            <p className="mt-1 text-sm text-red-600">{errors.pos_start}</p>
          )}
        </div>

        {/* POS_END display (calculated) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            POS_END (kalkulasi otomatis)
          </label>
          <div
            className={`w-full px-3 py-2 border rounded-lg bg-gray-50 ${
              posEndExceeds ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
          >
            {posEnd !== null ? (
              <span className={posEndExceeds ? 'text-red-700 font-medium' : 'text-gray-700'}>
                {posEnd.toFixed(2)} m
              </span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </div>
          {posEnd !== null && (
            <p className="mt-1 text-xs text-gray-500">
              Formula: POS_START ({formData.pos_start}) + LOA ({selectedShip?.loa}) + CLEARANCE ({CLEARANCE}) = {posEnd.toFixed(2)}m
            </p>
          )}
          {posEndExceeds && (
            <p className="mt-1 text-sm text-red-600 font-medium">
              ⚠️ POS_END melebihi kapasitas dermaga ({MAX_LENGTH}m)!
            </p>
          )}
        </div>

        {/* ETA_IN (arrival datetime) */}
        <div>
          <label htmlFor="eta_in" className="block text-sm font-medium text-gray-700 mb-1">
            Waktu Kedatangan (ETA) <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            id="eta_in"
            name="eta_in"
            value={formData.eta_in}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.eta_in ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.eta_in && (
            <p className="mt-1 text-sm text-red-600">{errors.eta_in}</p>
          )}
        </div>

        {/* ETD_OUT (departure datetime) */}
        <div>
          <label htmlFor="etd_out" className="block text-sm font-medium text-gray-700 mb-1">
            Waktu Keberangkatan (ETD) <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            id="etd_out"
            name="etd_out"
            value={formData.etd_out}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.etd_out ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.etd_out && (
            <p className="mt-1 text-sm text-red-600">{errors.etd_out}</p>
          )}
        </div>

        {/* PBM (optional) */}
        <div>
          <label htmlFor="pbm" className="block text-sm font-medium text-gray-700 mb-1">
            PBM (Perusahaan Bongkar Muat)
          </label>
          <input
            type="text"
            id="pbm"
            name="pbm"
            value={formData.pbm}
            onChange={handleChange}
            placeholder="Nama PBM (opsional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Keterangan (optional) */}
        <div>
          <label htmlFor="keterangan" className="block text-sm font-medium text-gray-700 mb-1">
            Keterangan
          </label>
          <textarea
            id="keterangan"
            name="keterangan"
            value={formData.keterangan}
            onChange={handleChange}
            rows={3}
            placeholder="Catatan tambahan (opsional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Submit button */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || posEndExceeds}
            className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
              loading || posEndExceeds
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Mengirim...
              </span>
            ) : isManual ? (
              'Simpan Booking'
            ) : (
              'Ajukan Pre-Booking'
            )}
          </button>
          <button
            type="button"
            onClick={resetForm}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
