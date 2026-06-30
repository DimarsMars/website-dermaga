import { STATUS_COLORS } from '../utils/constants';

/**
 * Individual booking block rendered on the BerthingCanvas.
 * Positioned absolutely based on meter position (horizontal) and time window (vertical).
 *
 * Props:
 * - booking: { id_booking, nama_kapal, pos_start, pos_end, eta_in, etd_out, status_request }
 * - style: { left, width, top, height } — positioning calculated by BerthingCanvas
 * - onClick: (booking) => void
 */
export default function ShipBlock({ booking, style, onClick }) {
  const backgroundColor = STATUS_COLORS[booking.status_request] || '#E5E7EB';

  const handleClick = () => {
    if (onClick) {
      onClick(booking);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="absolute rounded shadow-sm border border-gray-300 cursor-pointer
                 hover:opacity-90 hover:shadow-md transition-all overflow-hidden
                 flex flex-col justify-center items-center text-center px-1"
      style={{
        ...style,
        backgroundColor,
        minHeight: '24px',
      }}
      title={`${booking.nama_kapal} (${booking.pos_start}m - ${booking.pos_end}m)`}
      aria-label={`Booking: ${booking.nama_kapal}, position ${booking.pos_start}m to ${booking.pos_end}m, status ${booking.status_request}`}
    >
      <span className="text-xs font-semibold text-gray-800 truncate w-full leading-tight">
        {booking.nama_kapal}
      </span>
      <span className="text-[10px] text-gray-600 truncate w-full leading-tight">
        {booking.pos_start}m - {booking.pos_end}m
      </span>
    </div>
  );
}
