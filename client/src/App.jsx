import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BookingProvider } from './context/BookingContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BerthingPlanPage from './pages/BerthingPlanPage';
import BookingPage from './pages/BookingPage';
import BookingHistoryPage from './pages/BookingHistoryPage';
import MasterKapalPage from './pages/MasterKapalPage';
import MasterAgenPage from './pages/MasterAgenPage';
import MasterOperationalPage from './pages/MasterOperationalPage';
import NotificationPage from './pages/NotificationPage';
import AccountPage from './pages/AccountPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import { ROLES } from './utils/constants';
import { useSocket } from './hooks/useSocket';
import Toast from './components/Toast';
import { useState, useEffect, useRef } from 'react';

/**
 * SocketManager — activates the useSocket hook and shows toast on new notifications.
 * Must be rendered inside AuthProvider and BookingProvider.
 */
function SocketManager() {
  const { notifications } = useSocket();
  const [toast, setToast] = useState(null);
  const prevCount = useRef(0);

  useEffect(() => {
    if (notifications.length > prevCount.current && prevCount.current > 0) {
      // New notification arrived
      const latest = notifications[0];
      if (latest?.type === 'extend_offer') {
        setToast(`⏰ Waktu booking ${latest.nama_kapal || ''} hampir habis!`);
      } else {
        setToast(latest?.title || latest?.message || 'Notifikasi baru');
      }
    }
    prevCount.current = notifications.length;
  }, [notifications]);

  if (!toast) return null;

  return (
    <Toast
      message={toast}
      type="info"
      duration={4000}
      onClose={() => setToast(null)}
    />
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="mt-4 text-xl text-gray-700 font-medium">Halaman Tidak Ditemukan</p>
        <p className="mt-2 text-gray-500">Halaman yang Anda cari tidak tersedia.</p>
        <a
          href="/"
          className="mt-6 inline-block px-6 py-2.5 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2a4a73] transition-all duration-200 shadow-sm font-medium"
        >
          Kembali
        </a>
      </div>
    </div>
  );
}

/**
 * Layout wrapper for authenticated pages — includes Navbar.
 */
function AuthenticatedLayout({ children, allowedRoles }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <Navbar />
      <main>{children}</main>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BookingProvider>
          <SocketManager />
          <div className="min-h-screen bg-gray-50">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

              {/* Protected routes — all roles */}
              <Route
                path="/"
                element={
                  <AuthenticatedLayout>
                    <DashboardPage />
                  </AuthenticatedLayout>
                }
              />
              <Route
                path="/bookings"
                element={
                  <AuthenticatedLayout>
                    <BerthingPlanPage />
                  </AuthenticatedLayout>
                }
              />
              <Route
                path="/history"
                element={
                  <AuthenticatedLayout>
                    <BookingHistoryPage />
                  </AuthenticatedLayout>
                }
              />
              <Route
                path="/notifications"
                element={
                  <AuthenticatedLayout>
                    <NotificationPage />
                  </AuthenticatedLayout>
                }
              />
              <Route
                path="/account"
                element={
                  <AuthenticatedLayout>
                    <AccountPage />
                  </AuthenticatedLayout>
                }
              />

              {/* Admin-only routes */}
              <Route
                path="/admin/kapal"
                element={
                  <AuthenticatedLayout allowedRoles={[ROLES.ADMIN]}>
                    <MasterKapalPage />
                  </AuthenticatedLayout>
                }
              />
              <Route
                path="/admin/agen"
                element={
                  <AuthenticatedLayout allowedRoles={[ROLES.ADMIN]}>
                    <MasterAgenPage />
                  </AuthenticatedLayout>
                }
              />
              <Route
                path="/admin/petugas"
                element={
                  <AuthenticatedLayout allowedRoles={[ROLES.ADMIN]}>
                    <MasterOperationalPage />
                  </AuthenticatedLayout>
                }
              />

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </div>
        </BookingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
