import { useState, useEffect } from 'react';
import api from '../services/api';
import { parseApiError } from '../utils/errorMessages';

export default function MasterAgenPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    agency_name: '',
    npwp: '',
    company_address: '',
    phone_number: '',
    email: '',
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/agents');
      setAgents(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
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

  // Validate inputs locally. `mode = 'add' | 'edit'` (edit doesn't require password).
  const validate = (mode) => {
    const errs = {};
    if (!formData.username.trim()) errs.username = 'Username wajib diisi.';
    else if (formData.username.length < 3) errs.username = 'Username minimal 3 karakter.';

    if (mode === 'add') {
      if (!formData.password) errs.password = 'Password wajib diisi.';
      else if (formData.password.length < 6) errs.password = 'Password minimal 6 karakter.';
    }

    if (!formData.agency_name.trim()) errs.agency_name = 'Nama perusahaan wajib diisi.';

    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      errs.email = 'Format email tidak valid.';
    }
    if (formData.phone_number && !/^[0-9+\-\s()]{6,}$/.test(formData.phone_number)) {
      errs.phone_number = 'Nomor telepon tidak valid.';
    }
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
        username: formData.username,
        password: formData.password,
        agency_name: formData.agency_name,
        npwp: formData.npwp || undefined,
        company_address: formData.company_address || undefined,
        phone_number: formData.phone_number || undefined,
        email: formData.email || undefined,
      };

      await api.post('/auth/register', payload);
      setShowAddModal(false);
      resetForm();
      fetchAgents();
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'agent', action: 'create' });
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
        username: formData.username,
        agency_name: formData.agency_name,
        npwp: formData.npwp || undefined,
        company_address: formData.company_address || undefined,
        phone_number: formData.phone_number || undefined,
        email: formData.email || undefined,
      };

      const id = editingRecord.id_agen || editingRecord.id_agent || editingRecord.id;
      await api.put(`/agents/${id}`, payload);
      setEditingRecord(null);
      resetForm();
      fetchAgents();
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'agent', action: 'update' });
      setError(parsed.message);
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const id = deletingRecord.id_agen || deletingRecord.id_agent || deletingRecord.id;
      await api.delete(`/agents/${id}`);
      setDeletingRecord(null);
      fetchAgents();
    } catch (err) {
      const parsed = parseApiError(err, { entity: 'agent', action: 'delete' });
      setError(parsed.message);
      setDeletingRecord(null);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (agent) => {
    setEditingRecord(agent);
    setFormData({
      username: agent.username || '',
      password: '',
      agency_name: agent.company_name || agent.agencyName || agent.agency_name || '',
      npwp: agent.npwp || '',
      company_address: agent.address || agent.company_address || '',
      phone_number: agent.phone_number || agent.phone || '',
      email: agent.email || '',
    });
    setError('');
  };

  const closeEditModal = () => {
    setEditingRecord(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ username: '', password: '', agency_name: '', npwp: '', company_address: '', phone_number: '', email: '' });
    setError('');
    setFieldErrors({});
  };

  const closeModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#1e3a5f] tracking-tight">
            MASTER AGEN
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">TOTAL AGEN</p>
              <p className="text-2xl font-bold text-[#1e3a5f]">{agents.length}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#1e3a5f]">Daftar Agen</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Agen
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">NAMA PERUSAHAAN</th>
                  <th className="px-4 py-3 text-left">ALAMAT PERUSAHAAN</th>
                  <th className="px-4 py-3 text-left">NPWP PERUSAHAAN</th>
                  <th className="px-4 py-3 text-left">USERNAME</th>
                  <th className="px-4 py-3 text-left">PASSWORD</th>
                  <th className="px-4 py-3 text-left">EMAIL</th>
                  <th className="px-4 py-3 text-center">ROLE</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5 text-[#1e3a5f]" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Memuat data...
                      </div>
                    </td>
                  </tr>
                ) : agents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      Tidak ada data agen
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={agent.id_agen || agent.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600">{agent.id_agen || agent.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{agent.agency_name || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{agent.company_address || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{agent.npwp || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{agent.username || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">••••••••</td>
                      <td className="px-4 py-3 text-gray-600">{agent.email || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {agent.role || 'agen'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(agent)}
                            className="p-1.5 text-gray-500 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeletingRecord(agent)}
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
          </div>
        </div>
      </div>

      {/* Add Agen Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={closeModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border-2 border-[#5b9bd5]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pt-6 px-6 pb-4">
              <div className="flex-1" />
              <h2 className="text-2xl font-bold text-[#1e3a5f]">Add Agen</h2>
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
                <label className="block text-sm font-semibold text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Masukkan username"
                  className={`input-field ${fieldErrors.username ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                />
                {fieldErrors.username && <p className="mt-1 text-xs text-red-600">{fieldErrors.username}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimal 6 karakter"
                  className={`input-field ${fieldErrors.password ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                />
                {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Perusahaan / Agency Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="agency_name"
                  value={formData.agency_name}
                  onChange={handleChange}
                  placeholder="Masukkan nama perusahaan"
                  className={`input-field ${fieldErrors.agency_name ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                />
                {fieldErrors.agency_name && <p className="mt-1 text-xs text-red-600">{fieldErrors.agency_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">NPWP</label>
                <input
                  type="text"
                  name="npwp"
                  value={formData.npwp}
                  onChange={handleChange}
                  placeholder="Masukkan NPWP (opsional)"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Alamat Perusahaan</label>
                <input
                  type="text"
                  name="company_address"
                  value={formData.company_address}
                  onChange={handleChange}
                  placeholder="Masukkan alamat perusahaan (opsional)"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  placeholder="Masukkan nomor telepon (opsional)"
                  className={`input-field ${fieldErrors.phone_number ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                />
                {fieldErrors.phone_number && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone_number}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Masukkan email (opsional)"
                  className={`input-field ${fieldErrors.email ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                />
                {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
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
      )}

      {/* Edit Agen Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={closeEditModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border-2 border-[#5b9bd5]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pt-6 px-6 pb-4">
              <div className="flex-1" />
              <h2 className="text-2xl font-bold text-[#1e3a5f]">Edit Agen</h2>
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

            {/* Form - No password field in edit mode */}
            <form onSubmit={handleEditSubmit} className="px-6 pb-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Masukkan username"
                  className={`input-field ${fieldErrors.username ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                />
                {fieldErrors.username && <p className="mt-1 text-xs text-red-600">{fieldErrors.username}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Perusahaan / Agency Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="agency_name"
                  value={formData.agency_name}
                  onChange={handleChange}
                  placeholder="Masukkan nama perusahaan"
                  className={`input-field ${fieldErrors.agency_name ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                />
                {fieldErrors.agency_name && <p className="mt-1 text-xs text-red-600">{fieldErrors.agency_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">NPWP</label>
                <input
                  type="text"
                  name="npwp"
                  value={formData.npwp}
                  onChange={handleChange}
                  placeholder="Masukkan NPWP (opsional)"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Alamat Perusahaan</label>
                <input
                  type="text"
                  name="company_address"
                  value={formData.company_address}
                  onChange={handleChange}
                  placeholder="Masukkan alamat perusahaan (opsional)"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  placeholder="Masukkan nomor telepon (opsional)"
                  className={`input-field ${fieldErrors.phone_number ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                />
                {fieldErrors.phone_number && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone_number}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Masukkan email (opsional)"
                  className={`input-field ${fieldErrors.email ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : ''}`}
                />
                {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
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
              Apakah Anda yakin ingin menghapus agen <span className="font-semibold">{deletingRecord.company_name || deletingRecord.agencyName || deletingRecord.agency_name}</span>?
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
