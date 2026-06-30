import { useState, useEffect } from 'react';

/**
 * Reusable modal for creating/editing master data records.
 * Renders dynamic form fields based on column definitions.
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onSubmit: (formData) => Promise<void>
 * - columns: Array<{ key, label, type?, required?, options?, readOnly? }>
 * - initialData: object | null (null = create mode)
 * - title: string
 * - loading: boolean
 * - serverErrors: Array<{ field, message }> | null
 */
export default function MasterDataModal({
  isOpen,
  onClose,
  onSubmit,
  columns,
  initialData,
  title,
  loading = false,
  serverErrors = null,
}) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({ ...initialData });
      } else {
        // Initialize empty form
        const empty = {};
        columns.forEach((col) => {
          if (!col.readOnly) {
            empty[col.key] = '';
          }
        });
        setFormData(empty);
      }
      setErrors({});
    }
  }, [isOpen, initialData, columns]);

  function validate() {
    const newErrors = {};

    columns.forEach((col) => {
      if (col.readOnly) return;

      const value = formData[col.key];

      // Required check
      if (col.required && (value === '' || value === null || value === undefined)) {
        newErrors[col.key] = `${col.label} wajib diisi`;
        return;
      }

      // Number validation
      if (col.type === 'number' && value !== '' && value !== null && value !== undefined) {
        const num = Number(value);
        if (isNaN(num)) {
          newErrors[col.key] = `${col.label} harus berupa angka`;
        } else if (num < 0) {
          newErrors[col.key] = `${col.label} tidak boleh negatif`;
        } else if (col.key === 'loa' && num <= 0) {
          newErrors[col.key] = `${col.label} harus lebih dari 0`;
        } else if (col.key === 'loa' && num > 500) {
          newErrors[col.key] = `${col.label} tidak boleh lebih dari 500`;
        }
      }

      // Email validation
      if (col.type === 'email' && value && value.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[col.key] = `Format email tidak valid`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleChange(key, value) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field on change
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    // Build submission data (exclude readOnly fields)
    const submitData = {};
    columns.forEach((col) => {
      if (!col.readOnly && formData[col.key] !== undefined) {
        if (col.type === 'number' && formData[col.key] !== '') {
          submitData[col.key] = Number(formData[col.key]);
        } else {
          submitData[col.key] = formData[col.key] || null;
        }
      }
    });

    await onSubmit(submitData);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Server errors */}
        {serverErrors && serverErrors.length > 0 && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <ul className="text-sm text-red-700 list-disc list-inside">
              {serverErrors.map((err, idx) => (
                <li key={idx}>{err.message || err.field}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {columns
            .filter((col) => !col.readOnly)
            .map((col) => (
              <div key={col.key}>
                <label
                  htmlFor={`field-${col.key}`}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {col.label}
                  {col.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {col.type === 'select' ? (
                  <select
                    id={`field-${col.key}`}
                    value={formData[col.key] || ''}
                    onChange={(e) => handleChange(col.key, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors[col.key] ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">-- Pilih {col.label} --</option>
                    {(col.options || []).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : col.type === 'textarea' ? (
                  <textarea
                    id={`field-${col.key}`}
                    value={formData[col.key] || ''}
                    onChange={(e) => handleChange(col.key, e.target.value)}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors[col.key] ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                ) : (
                  <input
                    id={`field-${col.key}`}
                    type={col.type === 'number' ? 'text' : col.type || 'text'}
                    inputMode={col.type === 'number' ? 'decimal' : undefined}
                    value={formData[col.key] ?? ''}
                    onChange={(e) => handleChange(col.key, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors[col.key] ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                )}

                {errors[col.key] && (
                  <p className="mt-1 text-sm text-red-600">{errors[col.key]}</p>
                )}
              </div>
            ))}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {initialData ? 'Simpan' : 'Tambah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
