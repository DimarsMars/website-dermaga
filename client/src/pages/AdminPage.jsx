import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import MasterDataTable from '../components/MasterDataTable';
import MasterDataModal from '../components/MasterDataModal';

const TABS = [
  { key: 'ships', label: 'Kapal' },
  { key: 'agents', label: 'Agen' },
  { key: 'officers', label: 'Petugas' },
];

/**
 * Admin page with tab navigation for managing ships, agents, and officers.
 * Provides full CRUD operations with validation and referential integrity warnings.
 */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('ships');
  const [data, setData] = useState([]);
  const [agents, setAgents] = useState([]); // For ship agent dropdown
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [serverErrors, setServerErrors] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch data for the active tab
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'ships' ? '/ships' : `/${activeTab}`;
      const res = await api.get(endpoint);
      setData(res.data.data || []);
    } catch (err) {
      console.error(`Error fetching ${activeTab}:`, err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Fetch agents list for ship form dropdown
  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.get('/agents');
      setAgents(res.data.data || []);
    } catch (err) {
      console.error('Error fetching agents for dropdown:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Load agents for ship form dropdown
    fetchAgents();
  }, [fetchAgents]);

  // Column definitions per tab
  function getColumns() {
    switch (activeTab) {
      case 'ships':
        return {
          table: [
            { key: 'nama_kapal', label: 'Nama Kapal' },
            { key: 'loa', label: 'LOA (m)' },
            { key: 'gt', label: 'GT', render: (row) => row.gt ?? '-' },
            {
              key: 'id_agen',
              label: 'Agen',
              render: (row) => {
                const agent = agents.find((a) => a.id_agen === row.id_agen);
                return agent ? agent.agency_name : row.id_agen;
              },
            },
            { key: 'keterangan', label: 'Keterangan', render: (row) => row.keterangan || '-' },
          ],
          form: [
            { key: 'nama_kapal', label: 'Nama Kapal', required: true },
            { key: 'loa', label: 'LOA (meter)', type: 'number', required: true },
            { key: 'gt', label: 'GT (Gross Tonnage)', type: 'number' },
            {
              key: 'id_agen',
              label: 'Agen',
              type: 'select',
              required: true,
              options: agents.map((a) => ({
                value: a.id_agen,
                label: a.agency_name,
              })),
            },
            { key: 'keterangan', label: 'Keterangan', type: 'textarea' },
          ],
          idKey: 'id_kapal',
        };

      case 'agents':
        return {
          table: [
            { key: 'username', label: 'Username' },
            { key: 'agency_name', label: 'Nama Perusahaan' },
            { key: 'npwp', label: 'NPWP', render: (row) => row.npwp || '-' },
            { key: 'phone_number', label: 'Telepon', render: (row) => row.phone_number || '-' },
            { key: 'email', label: 'Email', render: (row) => row.email || '-' },
          ],
          form: [
            { key: 'username', label: 'Username', required: true },
            { key: 'agency_name', label: 'Nama Perusahaan', required: true },
            { key: 'npwp', label: 'NPWP' },
            { key: 'company_address', label: 'Alamat', type: 'textarea' },
            { key: 'phone_number', label: 'Nomor Telepon' },
            { key: 'email', label: 'Email', type: 'email' },
          ],
          idKey: 'id_agen',
        };

      case 'officers':
        return {
          table: [
            { key: 'employee_id', label: 'NIP' },
            { key: 'username', label: 'Username' },
            { key: 'name', label: 'Nama' },
            { key: 'phone_number', label: 'Telepon', render: (row) => row.phone_number || '-' },
            {
              key: 'user_role',
              label: 'Role',
              render: (row) => (
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                    row.user_role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {row.user_role}
                </span>
              ),
            },
          ],
          form: [
            { key: 'employee_id', label: 'NIP (Employee ID)', required: true },
            { key: 'username', label: 'Username', required: true },
            { key: 'name', label: 'Nama Lengkap', required: true },
            { key: 'phone_number', label: 'Nomor Telepon' },
            {
              key: 'user_role',
              label: 'Role',
              type: 'select',
              required: true,
              options: [
                { value: 'petugas', label: 'Petugas' },
                { value: 'admin', label: 'Admin' },
              ],
            },
          ],
          idKey: 'id_petugas',
        };

      default:
        return { table: [], form: [], idKey: 'id' };
    }
  }

  const { table: tableColumns, form: formColumns, idKey } = getColumns();

  // Modal handlers
  function handleAdd() {
    setEditingRecord(null);
    setServerErrors(null);
    setModalOpen(true);
  }

  function handleEdit(row) {
    setEditingRecord(row);
    setServerErrors(null);
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setEditingRecord(null);
    setServerErrors(null);
  }

  async function handleSubmit(formData) {
    setModalLoading(true);
    setServerErrors(null);

    try {
      if (editingRecord) {
        // Update
        const id = editingRecord[idKey];
        const endpoint =
          activeTab === 'ships'
            ? `/ships/${id}`
            : activeTab === 'agents'
            ? `/agents/${id}`
            : `/officers/${id}`;
        await api.put(endpoint, formData);
      } else {
        // Create (only ships have create endpoint in current backend)
        if (activeTab === 'ships') {
          await api.post('/ships', formData);
        }
      }

      handleCloseModal();
      fetchData();
    } catch (err) {
      const errorData = err.response?.data?.error;
      if (errorData?.details) {
        setServerErrors(errorData.details);
      } else if (errorData?.message) {
        setServerErrors([{ field: 'general', message: errorData.message }]);
      } else {
        setServerErrors([{ field: 'general', message: 'Terjadi kesalahan. Silakan coba lagi.' }]);
      }
    } finally {
      setModalLoading(false);
    }
  }

  // Delete handlers
  function handleDeleteClick(row) {
    setDeleteConfirm(row);
    setDeleteError('');
  }

  function handleCancelDelete() {
    setDeleteConfirm(null);
    setDeleteError('');
  }

  async function handleConfirmDelete() {
    if (!deleteConfirm) return;

    setDeleteLoading(true);
    setDeleteError('');

    try {
      const id = deleteConfirm[idKey];
      const endpoint =
        activeTab === 'ships'
          ? `/ships/${id}`
          : activeTab === 'agents'
          ? `/agents/${id}`
          : `/officers/${id}`;
      await api.delete(endpoint);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      const errorData = err.response?.data?.error;
      if (errorData?.code === 'INTEGRITY_CONSTRAINT') {
        setDeleteError(errorData.message);
      } else {
        setDeleteError('Gagal menghapus data. Silakan coba lagi.');
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  function getDeleteItemName() {
    if (!deleteConfirm) return '';
    switch (activeTab) {
      case 'ships':
        return deleteConfirm.nama_kapal;
      case 'agents':
        return deleteConfirm.agency_name || deleteConfirm.username;
      case 'officers':
        return deleteConfirm.name || deleteConfirm.username;
      default:
        return '';
    }
  }

  const modalTitle = editingRecord
    ? `Edit ${TABS.find((t) => t.key === activeTab)?.label}`
    : `Tambah ${TABS.find((t) => t.key === activeTab)?.label}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Master Data</h1>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="flex space-x-4 sm:space-x-8 min-w-max" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Data Table */}
      <MasterDataTable
        columns={tableColumns}
        data={data}
        loading={loading}
        idKey={idKey}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onAdd={handleAdd}
        addLabel={`Tambah ${TABS.find((t) => t.key === activeTab)?.label}`}
      />

      {/* Create/Edit Modal */}
      <MasterDataModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        columns={formColumns}
        initialData={editingRecord}
        title={modalTitle}
        loading={modalLoading}
        serverErrors={serverErrors}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={handleCancelDelete}
          />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Konfirmasi Hapus</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Apakah Anda yakin ingin menghapus{' '}
                  <span className="font-semibold">{getDeleteItemName()}</span>?
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            {/* Referential integrity error */}
            {deleteError && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <p className="text-sm text-yellow-800">{deleteError}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {deleteLoading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
