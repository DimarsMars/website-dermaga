import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import RecaptchaPlaceholder from '../components/RecaptchaPlaceholder';
import logoDermagaBiru from '../assets/logo-dermaga-biru.png';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Username dan password harus diisi');
      return;
    }

    if (!recaptchaToken) {
      setError('Silakan centang reCAPTCHA terlebih dahulu');
      return;
    }

    setLoading(true);
    try {
      await login(username, password, recaptchaToken);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login gagal. Periksa kembali kredensial Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#1e3a5f] via-[#2a4a73] to-[#1a2d47]">
      {/* Left Side - Dashboard Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-transparent items-center justify-center relative overflow-hidden">
        
        {/* ANIMASI KUSTOM */}
        <style>{`
          @keyframes floatLogo {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          @keyframes typingLoop {
            0%, 5% { max-width: 0; }
            75%, 85% { max-width: 100%; } /* Menahan teks penuh secara utuh */
            95%, 100% { max-width: 0; }
          }
          @keyframes blinkCaret {
            from, to { border-color: transparent }
            50% { border-color: #3b82f6; } /* Warna kursor ketikan biru */
          }
          .animate-float-logo {
            animation: floatLogo 4s ease-in-out infinite;
          }
          .animate-typing-text {
            display: inline-block;
            overflow: hidden;
            white-space: nowrap;
            border-right: 3px solid white;
            width: max-content; /* KUNCI UTAMA: Lebar otomatis mengikuti panjang teks asli */
            max-width: 0;
            animation: 
              typingLoop 7s steps(41, end) infinite, /* 41 steps sesuai jumlah karakter kalimat Anda */
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
          
          {/* Pembungkus Diperlebar ke 580px + flex-center agar teks mengetik rapi memekar dari tengah */}
          <div className="w-full max-w-[580px] mb-4 overflow-hidden flex justify-center">
            <h5 className="text-white text-2xl font-bold animate-typing-text pb-1">
              Sistem Pra-Booking dan Monitoring Dermaga
            </h5>
          </div>

          <p className="text-gray-300 text-sm xl:text-base 2xl:text-lg leading-relaxed max-w-[380px] xl:max-w-[440px] opacity-90">
            Monitoring dan pengelolaan dermaga dengan visualisasi real-time untuk efisiensi operasional pelabuhan.
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-white lg:rounded-l-[40px] shadow-2xl">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#1e3a5f] tracking-tight mb-4">SMART BERTH</h1>
            <p className="text-gray-500 mt-2 text-lg">Login</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="Masukkan username"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-12"
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#1e3a5f] focus:outline-none transition-colors"
                  title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    /* Ikon Mata Tertutup (Eye Off) */
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    /* Ikon Mata Terbuka (Eye) */
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-center">
              <RecaptchaPlaceholder onVerify={setRecaptchaToken} />
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
                  Loading...
                </span>
              ) : (
                'Login'
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <p className="text-sm text-gray-500">
              Forgot Password?{' '}
              <Link to="/forgot-password" className="text-[#1e3a5f] font-medium hover:underline">
                Reset Password
              </Link>
            </p>
            <p className="text-sm text-gray-500">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-[#1e3a5f] font-medium hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
