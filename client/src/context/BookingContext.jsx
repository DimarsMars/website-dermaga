import { createContext, useState, useCallback, useEffect } from 'react';
import api from '../services/api';

export const BookingContext = createContext(null);

export function BookingProvider({ children }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/bookings');
      setBookings(response.data.data || []);
      setHasFetched(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Gagal memuat data booking');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount if user is authenticated (token exists)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !hasFetched) {
      fetchBookings();
    }
  }, [fetchBookings, hasFetched]);

  const addBooking = useCallback((booking) => {
    setBookings((prev) => {
      const exists = prev.find((b) => b.id_booking === booking.id_booking);
      if (exists) return prev;
      return [...prev, booking];
    });
  }, []);

  const updateBooking = useCallback((updatedBooking) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id_booking === updatedBooking.id_booking ? { ...b, ...updatedBooking } : b
      )
    );
  }, []);

  const replaceBookings = useCallback((newBookings) => {
    setBookings(newBookings);
  }, []);

  const value = {
    bookings,
    loading,
    error,
    fetchBookings,
    addBooking,
    updateBooking,
    setBookings: replaceBookings,
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
}
