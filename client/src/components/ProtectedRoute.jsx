import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * ProtectedRoute wrapper component.
 * - Shows loading spinner while auth state is initializing
 * - Redirects to /login if user is not authenticated
 * - Shows 403 page if user role is not in allowedRoles (when provided)
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 text-sm">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-red-500">403</h1>
          <p className="mt-4 text-xl text-gray-700">Akses Ditolak</p>
          <p className="mt-2 text-gray-500">
            Anda tidak memiliki izin untuk mengakses halaman ini.
          </p>
          <a
            href="/"
            className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Kembali ke Dashboard
          </a>
        </div>
      </div>
    );
  }

  return children;
}
