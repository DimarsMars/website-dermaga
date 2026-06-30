import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../utils/constants';
import BookingForm from '../components/BookingForm';

/**
 * Booking page accessible from the dashboard.
 * - Agen: shows agent booking form (ships filtered by their account)
 * - Petugas/Admin: shows manual booking form with agent selection
 */
export default function BookingPage() {
  const { user } = useAuth();

  const isAgent = user?.role === ROLES.AGENT;
  const variant = isAgent ? 'agent' : 'manual';

  function handleSuccess(booking) {
    // Could navigate to berthing plan or show additional info
    console.log('Booking created:', booking);
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {isAgent ? 'Ajukan Pre-Booking' : 'Input Booking Manual'}
        </h1>
        <p className="mt-1 text-gray-500">
          {isAgent
            ? 'Isi form berikut untuk mengajukan pre-booking dermaga.'
            : 'Input data booking secara manual untuk agen yang tidak dapat mengajukan secara elektronik.'}
        </p>
      </div>

      <BookingForm variant={variant} onSuccess={handleSuccess} />
    </div>
  );
}
