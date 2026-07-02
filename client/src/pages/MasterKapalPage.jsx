import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatNumber } from '../utils/format';
import { parseApiError } from '../utils/errorMessages';

const MAX_DOCK_LENGTH = 500;

export default function MasterKapalPage() {
  const [ships, setShips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [agents, setAgents] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [formData, setFormData] = useState({
    nama_kapal: '',
    loa: '',
    gt: '',
    id_agen: '',
    keterangan: '',
    type: '',
    call_sign: '',
  });

  useEffect(() => {
    fetchShips();
  }, []);

  useEffect(() => {
    if (showAddModal || editingRecord) {
      fetchAgents();
    }
  }, [showAddModal, editingRecord]);

  const fetchShips = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ships');
      setShips(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch ships:', err);
    } finally {
      setLoading(false);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  // Validate the form locally before submitting. Returns map of field errors.
  const validate = (mode = 'add') => {
    const errs = {};
    if (!formData.nama_kapal.trim()) errs.nama_kapal = 'Nama kapal wajib diisi.';

    if (formData.loa === '' || formData.loa === null || formData.loa === undefined) {
      errs.loa = 'LOA wajib diisi.';
    } else {
      const loaNum = Number(formData.loa);
      if (Number.isNaN(loaNum)) errs.loa = 'LOA harus berupa angka.';
      else if (loaNum <= 0) errs.loa = 'LOA harus lebih besar dari 0.';
      else if (loaNum > MAX_DOCK_LENGTH) errs.loa = `LOA tidak boleh lebih dari ${MAX_DOCK_LENGTH} m.`;
    }

    if (formData.gt !== '' && formData.gt !== null && formData.gt !== undefined) {
      const gtNum = Number(formData.gt);
      if (Number.isNaN(gtNum)) errs.gt = 'GT harus berupa angka.';
      else if (gtNum < 0) errs.gt = 'GT tidak boleh negatif.';
    }

    if (!formData.id_agen) errs.id_agen = 'Agen wajib dipilih.';

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const errs = validate('add');
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Periksa kembali isian yang ditandai merah.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        nama_kapal: formData.nama_kapal,
        loa: parseFloat(formData.loa),
        gt: formData.gt ? parseFloat(formData.gt) : null,
        id_agen: Number(formData.id_agen),
        keterangan: formData.keterangan || null,
        type: formData.type || null,
        call_sign: formData.call_sign || null,
      };

      await api.post('/ships', payload);
      setShowAddModal(false);
      resetForm();
      fetchShips();
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'ship', action: 'create' });
      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const errs = validate('edit');
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Periksa kembali isian yang ditandai merah.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        nama_kapal: formData.nama_kapal,
        loa: parseFloat(formData.loa),
        gt: formData.gt ? parseFloat(formData.gt) : null,
        id_agen: Number(formData.id_agen),
        keterangan: formData.keterangan || null,
        type: formData.type || null,
        call_sign: formData.call_sign || null,
      };

      const id = editingRecord.id_kapal || editingRecord.id;
      await api.put(`/ships/${id}`, payload);
      setEditingRecord(null);
      resetForm();
      fetchShips();
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'ship', action: 'update' });
      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const id = deletingRecord.id_kapal || deletingRecord.id_ship || deletingRecord.id;
      await api.delete(`/ships/${id}`);
      setDeletingRecord(null);
      fetchShips();
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'ship', action: 'delete' });
      setError(parsed.message);
      setDeletingRecord(null);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (ship) => {
    setEditingRecord(ship);
    setFormData({
      nama_kapal: ship.nama_kapal || '',
      loa: ship.loa != null && ship.loa !== '' ? formatNumber(ship.loa) : '',
      gt: ship.gt != null && ship.gt !== '' ? formatNumber(ship.gt) : '',
      id_agen: ship.id_agen || '',
      keterangan: ship.keterangan || '',
      type: ship.type || '',
      call_sign: ship.call_sign || '',
    });
    setError('');
  };

  const closeEditModal = () => {
    setEditingRecord(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ nama_kapal: '', loa: '', gt: '', id_agen: '', keterangan: '', type: '', call_sign: '' });
    setError('');
    setFieldErrors({});
  };

  const closeModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentShips = ships.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(ships.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#1e3a5f] tracking-tight">
            MASTER KAPAL
          </h1>
        </div>

        {/* Error banner for delete errors */}
        {error && !showAddModal && !editingRecord && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
            <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700 font-bold">×</button>
          </div>
        )}

        {/* Summary Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#1e3a5f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">TOTAL KAPAL</p>
              <p className="text-2xl font-bold text-[#1e3a5f]">{ships.length}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#1e3a5f]">Daftar Kapal</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Kapal
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">NAMA KAPAL</th>
                  <th className="px-4 py-3 text-center">TYPE</th>
                  <th className="px-4 py-3 text-center">LOA</th>
                  <th className="px-4 py-3 text-center">GT</th>
                  <th className="px-4 py-3 text-left">CALL SIGN</th>
                  <th className="px-4 py-3 text-left">KETERANGAN</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
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
                ) : ships.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      Tidak ada data kapal
                    </td>
                  </tr>
                ) : (
                  currentShips.map((ship) => (
                    <tr key={ship.id_kapal} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600">{ship.id_kapal}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{ship.nama_kapal || '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{ship.type || '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{ship.loa ? formatNumber(ship.loa) : '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{ship.gt ? formatNumber(ship.gt) : '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{ship.call_sign || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{ship.keterangan || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(ship)}
                            className="p-1.5 text-gray-500 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeletingRecord(ship)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {/* Pagination Controls */}
            {ships.length > itemsPerPage && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  Menampilkan {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, ships.length)} dari {ships.length} data
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="px-3 py-1 text-sm bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Sebelumnya
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="px-3 py-1 text-sm bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Kapal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={closeModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border-2 border-[#5b9bd5]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pt-6 px-6 pb-4">
              <div className="flex-1" />
              <h2 className="text-2xl font-bold text-[#1e3a5f]">Add Kapal</h2>
              <div className="flex-1 flex justify-end">
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Kapal <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="nama_kapal"
                  value={formData.nama_kapal}
                  onChange={handleChange}
                  placeholder="Masukkan nama kapal"
                  className={`input-field ${fieldErrors.nama_kapal ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                />
                {fieldErrors.nama_kapal && <p className="mt-1 text-xs text-red-600">{fieldErrors.nama_kapal}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">LOA <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="loa"
                    value={formData.loa}
                    onChange={handleChange}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    className={`input-field ${fieldErrors.loa ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                  />
                  {fieldErrors.loa && <p className="mt-1 text-xs text-red-600">{fieldErrors.loa}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">GT</label>
                  <input
                    type="number"
                    name="gt"
                    value={formData.gt}
                    onChange={handleChange}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    className={`input-field ${fieldErrors.gt ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                  />
                  {fieldErrors.gt && <p className="mt-1 text-xs text-red-600">{fieldErrors.gt}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Type Kapal</label>
                  <input type="text" name="type" value={formData.type} onChange={handleChange} placeholder="Jenis kapal" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Call Sign</label>
                  <input type="text" name="call_sign" value={formData.call_sign} onChange={handleChange} placeholder="Call sign" className="input-field" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Agen <span className="text-red-500">*</span></label>
                <select
                  name="id_agen"
                  value={formData.id_agen}
                  onChange={handleChange}
                  className={`input-field ${fieldErrors.id_agen ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                >
                  <option value="">Pilih Agen</option>
                  {agents.map((agent) => (
                    <option key={agent.id_agen} value={agent.id_agen}>{agent.agency_name}</option>
                  ))}
                </select>
                {fieldErrors.id_agen && <p className="mt-1 text-xs text-red-600">{fieldErrors.id_agen}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Keterangan</label>
                <input type="text" name="keterangan" value={formData.keterangan} onChange={handleChange} placeholder="Keterangan (opsional)" className="input-field" />
              </div>

              <div className="flex justify-center pt-4">
                <button type="submit" disabled={submitting} className="px-8 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Menyimpan...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Kapal Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={closeEditModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border-2 border-[#5b9bd5]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pt-6 px-6 pb-4">
              <div className="flex-1" />
              <h2 className="text-2xl font-bold text-[#1e3a5f]">Edit Kapal</h2>
              <div className="flex-1 flex justify-end">
                <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 transition-colors">
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

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="px-6 pb-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Kapal <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="nama_kapal"
                  value={formData.nama_kapal}
                  onChange={handleChange}
                  placeholder="Masukkan nama kapal"
                  className={`input-field ${fieldErrors.nama_kapal ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                />
                {fieldErrors.nama_kapal && <p className="mt-1 text-xs text-red-600">{fieldErrors.nama_kapal}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">LOA <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="loa"
                    value={formData.loa}
                    onChange={handleChange}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    className={`input-field ${fieldErrors.loa ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                  />
                  {fieldErrors.loa && <p className="mt-1 text-xs text-red-600">{fieldErrors.loa}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">GT</label>
                  <input
                    type="number"
                    name="gt"
                    value={formData.gt}
                    onChange={handleChange}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    className={`input-field ${fieldErrors.gt ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                  />
                  {fieldErrors.gt && <p className="mt-1 text-xs text-red-600">{fieldErrors.gt}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Type Kapal</label>
                  <input type="text" name="type" value={formData.type} onChange={handleChange} placeholder="Jenis kapal" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Call Sign</label>
                  <input type="text" name="call_sign" value={formData.call_sign} onChange={handleChange} placeholder="Call sign" className="input-field" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Agen <span className="text-red-500">*</span></label>
                <select
                  name="id_agen"
                  value={formData.id_agen}
                  onChange={handleChange}
                  className={`input-field ${fieldErrors.id_agen ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                >
                  <option value="">Pilih Agen</option>
                  {agents.map((agent) => (
                    <option key={agent.id_agen} value={agent.id_agen}>{agent.agency_name}</option>
                  ))}
                </select>
                {fieldErrors.id_agen && <p className="mt-1 text-xs text-red-600">{fieldErrors.id_agen}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Keterangan</label>
                <input type="text" name="keterangan" value={formData.keterangan} onChange={handleChange} placeholder="Keterangan (opsional)" className="input-field" />
              </div>

              <div className="flex justify-center pt-4">
                <button type="submit" disabled={submitting} className="px-8 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Menyimpan...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setDeletingRecord(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border-2 border-[#5b9bd5]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-center text-[#1e3a5f] mb-2">Hapus?</h3>
            <p className="text-center text-gray-600 mb-6">
              Apakah Anda yakin ingin menghapus kapal <span className="font-semibold">{deletingRecord.nama_kapal}</span>?
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingRecord(null)}
                className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
