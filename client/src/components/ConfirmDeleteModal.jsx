import { useState } from 'react';

/**
 * ConfirmDeleteModal — Custom confirmation popup for deleting bookings.
 * Styled to match the system theme (blue #1e3a5f, rounded, shadow).
 */
export default function ConfirmDeleteModal({ isOpen, onClose, onConfirm, bookingName }) {
  const [deleting, setDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md border-2 border-[#5b9bd5] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon & Title */}
        <div className="flex flex-col items-center pt-8 pb-4 px-6">
          {/* Warning Icon */}
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>

          <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">Hapus Booking</h3>
          <p className="text-gray-600 text-center text-sm leading-relaxed">
            Apakah Anda yakin ingin menghapus booking
            {bookingName && (
              <span className="font-semibold text-gray-800"> "{bookingName}"</span>
            )}
            ? Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 px-6 pb-6 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all duration-200 border border-gray-200 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {deleting ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Menghapus...
              </>
            ) : (
              'Ya, Hapus'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
