/**
 * Reusable CRUD table component for master data management.
 *
 * Props:
 * - columns: Array<{ key, label, render? }>
 * - data: Array<object>
 * - loading: boolean
 * - idKey: string (primary key field name)
 * - onEdit: (row) => void
 * - onDelete: (row) => void
 * - onAdd: () => void
 * - addLabel: string (button text for adding new record)
 */
export default function MasterDataTable({
  columns,
  data,
  loading,
  idKey,
  onEdit,
  onDelete,
  onAdd,
  addLabel = 'Tambah Baru',
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-3 text-gray-600">Memuat data...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Add button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={onAdd}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {addLabel}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                No
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Tidak ada data
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={row[idKey]} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {index + 1}
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-sm text-gray-900">
                      {col.render ? col.render(row) : row[col.key] ?? '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => onEdit(row)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(row)}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                        title="Hapus"
                      >
                        Hapus
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
  );
}
