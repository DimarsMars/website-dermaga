import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotificationBadge } from '../hooks/useSocket';
import { ROLES } from '../utils/constants';
import logoDermagaBiru from '../assets/logo-dermaga-biru.png';

const adminLinks = [
  { label: 'Dashboard', path: '/' },
  { label: 'Bookings', path: '/bookings' },
  { label: 'Master Kapal', path: '/admin/kapal' },
  { label: 'Master Agen', path: '/admin/agen' },
  { label: 'Master Operational', path: '/admin/petugas' },
  { label: 'History', path: '/history' },
  { label: 'Notification', path: '/notifications' },
];

const agentLinks = [
  { label: 'Dashboard', path: '/' },
  { label: 'Bookings', path: '/bookings' },
  { label: 'History', path: '/history' },
  { label: 'Notification', path: '/notifications' },
];

const officerLinks = [
  { label: 'Dashboard', path: '/' },
  { label: 'Bookings', path: '/bookings' },
  { label: 'History', path: '/history' },
  { label: 'Notification', path: '/notifications' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const { unreadCount, clearBadge } = useNotificationBadge();
  const location = useLocation();

  // Clear badge when user visits the notifications page
  useEffect(() => {
    if (location.pathname === '/notifications') {
      clearBadge();
    }
  }, [location.pathname, clearBadge]);

  const getLinks = () => {
    if (user?.role === ROLES.ADMIN) return adminLinks;
    if (user?.role === ROLES.AGENT) return agentLinks;
    return officerLinks;
  };

  const links = getLinks();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bg-[#1e3a5f] shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center py-2">
              <img 
                src={logoDermagaBiru} 
                alt="Logo Pra-Booking Dermaga" 
                className="h-10 w-auto object-contain transition-transform duration-200 hover:scale-105" 
              />
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-1">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(link.path)
                    ? 'text-white' : 'text-gray-200 hover:text-white'
                }`}
              >
                {link.label}

                <span
                  className={`absolute bottom-0 left-1/2 h-0.5 bg-white/60 rounded-full transition-all duration-300 ease-out 
                  ${isActive(link.path) 
                    ? 'w-1/2 -translate-x-1/2 scale-x-100' // 'w-1/2' agar tidak terlalu panjang
                    : 'w-0 -translate-x-1/2 scale-x-0'
                  }
                  group-hover:w-1/2 group-hover:scale-x-100`}
                />

                {link.path === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* My Account (Desktop) */}
          <div className="hidden md:flex items-center">
            <Link
              to="/account"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-medium">{user.username}</span>
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#1e3a5f]">
          <div className="px-4 py-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(link.path)
                    ? 'bg-white/20 text-white'
                    : 'text-gray-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{link.label}</span>
                {link.path === '/notifications' && unreadCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            ))}
            <Link
              to="/account"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-gray-200 hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-medium">{user.username}</span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
