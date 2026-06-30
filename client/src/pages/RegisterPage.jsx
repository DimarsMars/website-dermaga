import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import RecaptchaPlaceholder from '../components/RecaptchaPlaceholder';
import logoDermagaBiru from '../assets/logo-dermaga-biru.png';

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    password: '',
    agencyName: '',
    npwp: '',
    address: '',
    phone: '',
    email: '',
  });
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.username || !form.password || !form.agencyName || !form.email) {
      setError('Username, password, email, dan nama perusahaan harus diisi');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('Format email tidak valid');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        ...form,
        recaptchaToken,
      });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registrasi gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#1e3a5f] via-[#2a4a73] to-[#1a2d47]">
      
      {/* Left Side - Dashboard Brand Panel (Sticky) */}
      <div className="hidden lg:flex lg:w-1/2 bg-transparent items-center justify-center relative overflow-hidden lg:sticky lg:top-0 lg:h-screen">
        {/* INJEKSI ANIMASI KUSTOM */}
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
          <img 
            src={logoDermagaBiru} 
            alt="Logo Smart Berth Pelabuhan Benoa" 
            className="w-full max-w-[420px] sm:max-w-[440px] h-auto object-contain mb-8 drop-shadow-sm animate-float-logo"
          />
          <div className="w-full max-w-[580px] mb-4 overflow-hidden flex justify-center">
            <h5 className="text-white text-2xl font-bold animate-typing-text pb-1">
              Sistem Pra-Booking dan Monitoring Dermaga
            </h5>
          </div>
          <p className="text-gray-300 text-sm xl:text-base 2xl:text-lg leading-relaxed max-w-[340px] xl:max-w-[420px] opacity-90">
            Daftarkan perusahaan Anda untuk mengakses sistem booking dermaga timur.
          </p>
        </div>
      </div>

      {/* Right Side - Compact Register Form (Scrollable on long content) */}
      <div className="w-full lg:w-1/2 flex items-start lg:items-center justify-center px-6 py-4 sm:py-8 bg-white lg:rounded-l-[40px] shadow-2xl relative z-10 lg:h-screen overflow-y-auto">
        <div className="w-full max-w-md flex flex-col justify-center py-2 my-auto">
          
          {/* Header Section - Keperketat Margin */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1e3a5f] tracking-tight mb-4">SMART BERTH</h1>
            <p className="text-gray-500 mt-0.5 text-lg">Register</p>
          </div>

          {/* Form - Jarak antar kolom dipersempit menggunakan space-y-2.5 */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs mb-1">
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                className="input-field !py-1.5 text-sm h-9"
                placeholder="Masukkan username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className="input-field !py-1.5 !pr-10 text-sm h-9"
                  placeholder="Masukkan password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#1e3a5f] focus:outline-none transition-colors"
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Agency Name */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Agency Name</label>
              <input
                type="text"
                name="agencyName"
                value={form.agencyName}
                onChange={handleChange}
                className="input-field !py-1.5 text-sm h-9"
                placeholder="Nama perusahaan"
              />
            </div>

            {/* NPWP */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">NPWP</label>
              <input
                type="text"
                name="npwp"
                value={form.npwp}
                onChange={handleChange}
                className="input-field !py-1.5 text-sm h-9"
                placeholder="Nomor NPWP"
              />
            </div>

            {/* Company Address */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Company Address</label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                className="input-field !py-1.5 text-sm h-9"
                placeholder="Alamat perusahaan"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number</label>
              <input
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="input-field !py-1.5 text-sm h-9"
                placeholder="Nomor telepon"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="input-field !py-1.5 text-sm h-9"
                placeholder="Email perusahaan (wajib untuk reset password)"
                required
              />
            </div>

            {/* ReCAPTCHA Wrapper - Diperketat agar tidak memakan ruang */}
            <div className="flex justify-center scale-90 -my-1">
              <RecaptchaPlaceholder onVerify={setRecaptchaToken} />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-green-600 text-white font-semibold text-sm rounded-lg hover:bg-green-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed h-10 mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2 text-xs">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </span>
              ) : (
                'Register'
              )}
            </button>
          </form>

          {/* Footer Navigation Link */}
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              Have an account?{' '}
              <Link to="/login" className="text-[#1e3a5f] font-medium hover:underline">
                Login
              </Link>
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}