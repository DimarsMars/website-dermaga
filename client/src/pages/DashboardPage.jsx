import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // LOGIKA Menentukan role untuk percabangan konten
  const isPetugas = user?.role === 'petugas' || user?.role === 'admin';
  const roleLabel = user?.role === 'agen' ? 'Agen' : user?.role === 'admin' ? 'Admin' : 'Petugas';
  const displayName = user?.name || user?.username || 'User';

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* BANNER UTAMA */}
        <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a4f7f] rounded-2xl p-6 sm:p-8 shadow-md text-white relative overflow-hidden">

          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-xl" />
          <div className="relative z-10 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 bg-white/10 px-2 py-0.5 rounded-md">
              Role: {roleLabel}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
              Selamat Datang, <span className="capitalize">{displayName}</span>
            </h1>
            <p className="text-gray-200 text-xs sm:text-sm max-w-md pt-0.5 font-medium opacity-90">
              Sistem Informasi Monitoring dan Pengelolaan Pra-Booking Dermaga Pelabuhan Benoa.
            </p>
          </div>
        </div>

        {/* PERMINTAAN PENDING: Hanya muncul untuk akun Petugas/Admin */}
        {isPetugas && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm flex items-center justify-between transition-all duration-200 hover:bg-amber-100/50">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider">Permintaan Pending</h3>
              <p className="text-xs text-amber-700 font-medium">Jumlah booking dermaga sedang menunggu proses persetujuan Anda.</p>
            </div>
            <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center flex-shrink-0 shadow-inner">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        )}

        {/* MENU AKSI UTAMA (3 Kolom Sejajar) */}
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Aksi Navigasi Cepat</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* BOX INPUT / SUBMIT BOOKING */}
            <div 
              onClick={() => navigate('/bookings')}
              className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between h-44 group hover:shadow-md hover:border-blue-200 transition-all duration-200">
              <div className="space-y-2">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-[#1e3a5f] group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-800 text-base">
                  {isPetugas ? 'Booking Manual' : 'Submit Booking'}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed font-medium">
                  {isPetugas ? 'Input data booking secara manual untuk pihak agen.' : 'Ajukan pre-booking dermaga baru untuk kapal Anda.'}
                </p>
              </div>
              <button
                className="text-xs font-bold text-blue-600 group-hover:text-[#1e3a5f] flex items-center gap-1 mt-4 transition-colors w-max"
              >
                {isPetugas ? 'Input Booking →' : 'Buat Booking →'}
              </button>
            </div>

            {/* BOX BERTHING PLAN */}
            <div 
              onClick={() => navigate('/bookings')}
              className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between h-44 group hover:shadow-md hover:border-green-200 transition-all duration-200"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-800 text-base">Berthing Plan</h3>
                <p className="text-xs text-gray-400 leading-relaxed font-medium">
                  {isPetugas ? 'Kelola dan pantau rencana sandar kapal di dermaga.' : 'Lihat rencana sandar tambatan dermaga secara realtime.'}
                </p>
              </div>
              <button
                className="text-xs font-bold text-green-600 group-hover:text-green-700 flex items-center gap-1 mt-4 transition-colors w-max"
              >
                {isPetugas ? 'Buka Plan →' : 'Lihat Plan →'}
              </button>
            </div>

            {/* BOX RIWAYAT BOOKING */}
            <div 
              onClick={() => navigate('/history')}
              className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between h-44 group hover:shadow-md hover:border-purple-200 transition-all duration-200"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-800 text-base">Riwayat Booking</h3>
                <p className="text-xs text-gray-400 leading-relaxed font-medium">
                  {isPetugas ? 'Lihat seluruh catatan riwayat data booking dan log aktivitas.' : 'Lihat daftar riwayat dan status pengajuan booking Anda.'}
                </p>
              </div>
              <button
                className="text-xs font-bold text-purple-600 group-hover:text-purple-700 flex items-center gap-1 mt-4 transition-colors w-max"
              >
                {isPetugas ? 'Lihat Riwayat →' : 'Lihat Riwayat →'}
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}