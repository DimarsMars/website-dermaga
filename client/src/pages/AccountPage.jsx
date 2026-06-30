import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import ChangePasswordModal from '../components/ChangePasswordModal';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0, completed: 0, active: 0 });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/me');
      setProfile(res.data.data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setProfile(user);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/bookings');
      let bookings = res.data.data || [];
      // Agents only count their own bookings
      if (user?.role === 'agen') {
        bookings = bookings.filter((b) => b.id_agen === user.id);
      }
      setStats({
        total: bookings.length,
        approved: bookings.filter((b) => b.status_request === 'approved').length,
        pending: bookings.filter((b) => b.status_request === 'pending').length,
        rejected: bookings.filter((b) => b.status_request === 'rejected').length,
        completed: bookings.filter((b) => b.status_request === 'completed').length,
        active: bookings.filter((b) => b.status === 'active').length,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabel = (role) => {
    if (role === 'agen') return 'Agen Kapal';
    if (role === 'petugas') return 'Petugas Operasional';
    if (role === 'admin') return 'Administrator';
    return role || '-';
  };

  const roleBadgeColor = (role) => {
    if (role === 'agen') return 'bg-blue-100 text-blue-700';
    if (role === 'petugas') return 'bg-green-100 text-green-700';
    if (role === 'admin') return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
  };

  // Get initials for avatar
  const getInitials = () => {
    const name = profile?.agency_name || profile?.name || profile?.username || '?';
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');
  };

  const displayName = profile?.agency_name || profile?.name || profile?.username || '-';

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Build the list of info fields based on role
  const getInfoFields = () => {
    if (!profile) return [];
    if (profile.role === 'agen') {
      return [
        { label: 'Nama Perusahaan', value: profile.agency_name, icon: 'building' },
        { label: 'Username', value: profile.username, icon: 'user' },
        { label: 'Email', value: profile.email, icon: 'mail' },
        { label: 'No. Telepon', value: profile.phone_number, icon: 'phone' },
        { label: 'NPWP', value: profile.npwp, icon: 'document' },
        { label: 'Alamat', value: profile.company_address, icon: 'location', fullWidth: true },
      ];
    }
    // petugas / admin
    return [
      { label: 'Nama Lengkap', value: profile.name, icon: 'user' },
      { label: 'Employee ID', value: profile.employee_id, icon: 'badge' },
      { label: 'Username', value: profile.username, icon: 'at' },
      { label: 'No. Telepon', value: profile.phone_number, icon: 'phone' },
    ];
  };

  const icons = {
    building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
    document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    location: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
    badge: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0',
    at: 'M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206',
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 pt-6 pb-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* LEFT: Profile summary card */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-md overflow-hidden">
              {/* Banner */}
              <div className="h-20 bg-gradient-to-r from-[#1e3a5f] to-[#2a4f7f]" />

              {/* Avatar + Name */}
              <div className="px-5 pb-5 -mt-10">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center border-4 border-white">
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#5b9bd5] flex items-center justify-center">
                      <span className="text-xl font-bold text-white">{getInitials()}</span>
                    </div>
                  </div>
                  <h1 className="mt-3 text-lg font-bold text-[#1e3a5f] text-center leading-tight">{displayName}</h1>
                  <span className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold ${roleBadgeColor(profile?.role)}`}>
                    {roleLabel(profile?.role)}
                  </span>
                  {profile?.created_at && (
                    <p className="mt-2 text-xs text-gray-400 text-center">
                      Bergabung sejak<br />{formatDate(profile.created_at)}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 space-y-2.5 border-t border-gray-100 pt-4">
                <button
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-gray-200 text-[#1e3a5f] text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Ganti Password
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-all duration-200 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Log Out
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Info card + stats */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                Informasi Akun
              </h2>

              {loading ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <svg className="animate-spin w-5 h-5 mr-2 text-[#1e3a5f]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memuat profil...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {getInfoFields().map((field, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-xl bg-gray-50 ${field.fullWidth ? 'sm:col-span-2' : ''}`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/5 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#1e3a5f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icons[field.icon]} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400">{field.label}</p>
                        <p className="text-sm font-medium text-gray-800 break-words">
                          {field.value || <span className="text-gray-300 italic">Belum diisi</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Booking statistics */}
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                Ringkasan Booking
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-[#1e3a5f]/5 p-4 text-center">
                  <p className="text-2xl font-bold text-[#1e3a5f]">{stats.total}</p>
                  <p className="text-xs text-gray-500 mt-1">Total Booking</p>
                </div>
                <div className="rounded-xl bg-green-50 p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                  <p className="text-xs text-gray-500 mt-1">Disetujui</p>
                </div>
                <div className="rounded-xl bg-yellow-50 p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                  <p className="text-xs text-gray-500 mt-1">Menunggu</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
                  <p className="text-xs text-gray-500 mt-1">Selesai</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <ChangePasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
      />
    </div>
  );
}
