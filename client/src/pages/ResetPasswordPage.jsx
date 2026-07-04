import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import logoDermagaBiru from '../assets/logo-dermaga-biru.png';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // State untuk fitur show/hide password
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Password tidak cocok');
      return;
    }

    if (password.length < 8) {
      setError('Password minimal 8 karakter');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password/confirm', {
        token,
        newPassword: password,
      });
      setMessage('Password berhasil direset! Mengalihkan ke halaman login...');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Gagal reset password. Token mungkin sudah kedaluwarsa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* 2. SEAMLESS GRADIENT: Diaktifkan penuh pada pembungkus luar */
    <div className="min-h-screen flex bg-gradient-to-br from-[#1e3a5f] via-[#2a4a73] to-[#1a2d47]">
      
      {/* Left Side - Dashboard Brand Panel (Transparan & Sejajar) */}
      <div className="hidden lg:flex lg:w-1/2 bg-transparent items-center justify-center relative overflow-hidden">
        
        {/* 3. INJEKSI ANIMASI KUSTOM (Floating Logo & Typing Loop) */}
        <style>{`
          @keyframes floatLogo {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          @keyframes typingLoop {
            0%, 5% { max-width: 0; }
            75%, 85% { max-width: 100%; }
            95%, 100% { max-width: 0; }
          }
          @keyframes blinkCaret {
            from, to { border-color: transparent }
            50% { border-color: #3b82f6; }
          }
          .animate-float-logo {
            animation: floatLogo 4s ease-in-out infinite;
          }
          .animate-typing-text {
            display: inline-block;
            overflow: hidden;
            white-space: nowrap;
            border-right: 3px solid white;
            width: max-content;
            max-width: 0;
            animation: 
              typingLoop 7s steps(41, end) infinite,
              blinkCaret 0.75s step-end infinite;
          }
        `}</style>

        {/* Decorative circles */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/5 rounded-full" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-white/3 rounded-full" />
        
        <div className="relative z-10 text-center px-12 flex flex-col items-center w-full">
          {/* Gambar Logo dengan Animasi Bergerak Lembut */}
          <img 
            src={logoDermagaBiru} 
            alt="Logo Smart Berth Pelabuhan Benoa" 
            className="w-full max-w-[420px] sm:max-w-[440px] h-auto object-contain mb-8 drop-shadow-sm animate-float-logo"
          />
          
          {/* Judul Utama dengan Animasi Ketikan Mesin Tik Semu */}
          <div className="w-full max-w-[580px] mb-4 overflow-hidden flex justify-center">
            <h5 className="text-white text-2xl font-bold animate-typing-text pb-1">
              Sistem Pra-Booking dan Monitoring Dermaga
            </h5>
          </div>

          {/* Deskripsi Aturan Teks Responsif */}
          <p className="text-gray-300 text-sm xl:text-base 2xl:text-lg leading-relaxed max-w-[380px] xl:max-w-[440px] opacity-90">
            Silakan buat kata sandi baru Anda untuk kembali mengakses sistem secara aman.
          </p>
        </div>
      </div>

      {/* Right Side - Reset Password Form (Putih Bersih dengan Lengkungan Halus 40px) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-white lg:rounded-l-[40px] shadow-2xl relative z-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#1e3a5f] tracking-tight">RESET PASSWORD</h1>
            <p className="text-gray-500 mt-2 text-lg">Buat Password Baru</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Pesan Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Pesan Sukses */}
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <p className="leading-relaxed">{message}</p>
              </div>
            )}

            {/* Input Password Baru */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password Baru</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-12 w-full"
                  placeholder="Masukkan password baru"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#1e3a5f] focus:outline-none transition-colors"
                  title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Input Konfirmasi Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Konfirmasi Password Baru</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field pr-12 w-full"
                  placeholder="Ketik ulang password baru"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#1e3a5f] focus:outline-none transition-colors"
                  title={showConfirmPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Tombol Submit */}
            <button
              type="submit"
              disabled={loading || !!message}
              className="w-full py-3 bg-[#1e3a5f] text-white font-semibold rounded-lg hover:bg-[#2a4f7f] transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memproses...
                </span>
              ) : (
                'Simpan Password Baru'
              )}
            </button>
          </form>

          {/* Tombol Kembali ke Login */}
          <div className="mt-8 text-center">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1e3a5f] transition-colors font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Kembali ke Login
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}