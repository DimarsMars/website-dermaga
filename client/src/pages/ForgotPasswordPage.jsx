import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import logoDermagaBiru from '../assets/logo-dermaga-biru.png';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email) {
      setError('Alamat email wajib diisi');
      return;
    }

    setLoading(true);
    try {
      // Menembak endpoint backend yang sudah Anda buat tadi
      await api.post('/auth/reset-password', { email });
      
      // Pesan sukses sesuai dengan respon aman backend Anda
      setMessage('Jika alamat email tersebut terdaftar, tautan pemulihan sandi telah dikirim ke kotak masuk Anda.');
      setEmail(''); // Kosongkan field input setelah sukses
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Terjadi kesalahan saat mencoba mengirim email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* 2. SEAMLESS GRADIENT: Diaktifkan pada parent utama */
    <div className="min-h-screen flex bg-gradient-to-br from-[#1e3a5f] via-[#2a4a73] to-[#1a2d47]">
      
      {/* Left Side - Dashboard Brand Panel (Transparan & Sejajar) */}
      <div className="hidden lg:flex lg:w-1/2 bg-transparent items-center justify-center relative overflow-hidden">
        
        {/* 3. INJEKSI ANIMASI KUSTOM (Floating & Typing) */}
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
              typingLoop 7s steps(41, end) infinite;
              blinkCaret 0.75s step-end infinite;
          }
        `}</style>

        {/* Decorative circles */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-white/5 rounded-full" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-white/3 rounded-full" />
        
        <div className="relative z-10 text-center px-12 flex flex-col items-center w-full">
          {/* Logo dengan Animasi Looping Floating */}
          <img 
            src={logoDermagaBiru} 
            alt="Logo Smart Berth Pelabuhan Benoa" 
            className="w-full max-w-[420px] sm:max-w-[440px] h-auto object-contain mb-8 drop-shadow-sm animate-float-logo"
          />
          
          {/* Judul dengan Animasi Ketikan (Disamakan agar seragam & presisi) */}
          <div className="w-full max-w-[580px] mb-4 overflow-hidden flex justify-center">
            <h5 className="text-white text-2xl font-bold animate-typing-text pb-1">
              Sistem Pra-Booking dan Monitoring Dermaga
            </h5>
          </div>

          {/* Deskripsi - Responsif 2 Baris */}
          <p className="text-gray-300 text-sm xl:text-base 2xl:text-lg leading-relaxed max-w-[380px] xl:max-w-[440px] opacity-90">
            Lupa kata sandi Anda? Masukkan email perusahaan yang terdaftar untuk menerima tautan pemulihan akun.
          </p>
        </div>
      </div>

      {/* Right Side - Form Input Email (Putih Bersih dengan Sudut Lengkung Premium) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-white lg:rounded-l-[40px] shadow-2xl relative z-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#1e3a5f] tracking-tight">LUPA PASSWORD</h1>
            <p className="text-gray-500 mt-2 text-lg">Permintaan Tautan Pemulihan</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="leading-relaxed">{message}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat Email Agen</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field w-full"
                placeholder="nama@emailperusahaan.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Mengirim Tautan...
                </span>
              ) : (
                'Kirim Tautan Reset'
              )}
            </button>
          </form>

          {/* Navigasi Kembali ke Login */}
          <div className="mt-8 text-center">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1e3a5f] transition-colors font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Kembali ke Login
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
}