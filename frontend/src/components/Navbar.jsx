import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, LogOut, User, Menu, X, Calendar, ClipboardList, Shield, IndianRupee, MessageSquare, RefreshCw, Users } from 'lucide-react';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const name = localStorage.getItem('name');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (!token) return null; // Don't show navbar if not logged in

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive(path)
        ? 'bg-sky-50 text-sky-600 shadow-sm'
        : 'text-slate-600 hover:text-sky-600 hover:bg-slate-50'
    }`;

  const mobileLinkClass = (path) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all ${
      isActive(path)
        ? 'bg-sky-50 text-sky-600'
        : 'text-slate-600 hover:bg-slate-50 hover:text-sky-600'
    }`;

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Logo */}
            <Link to={role === 'admin' ? '/admin' : role === 'staff' ? '/staff/schedule' : '/'} className="flex items-center gap-2 font-bold text-xl text-sky-600">
              <Sparkles className="h-6 w-6 animate-pulse" />
              <span>CleanPro</span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex md:ml-10 md:space-x-4">
              {role === 'customer' && (
                <>
                  <Link to="/" className={linkClass('/')}>
                    <Calendar className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <Link to="/book" className={linkClass('/book')}>
                    <Sparkles className="h-4 w-4" />
                    Book Service
                  </Link>
                  <Link to="/appointments" className={linkClass('/appointments')}>
                    <ClipboardList className="h-4 w-4" />
                    My Bookings
                  </Link>
                  <Link to="/my-recurring" className={linkClass('/my-recurring')}>
                    <RefreshCw className="h-4 w-4" />
                    Recurring Plans
                  </Link>
                  <Link to="/profile" className={linkClass('/profile')}>
                    <User className="h-4 w-4" />
                    My Profile
                  </Link>
                </>
              )}
              {role === 'admin' && (
                <>
                  <Link to="/admin" className={linkClass('/admin')}>
                    <Shield className="h-4 w-4" />
                    Admin Dashboard
                  </Link>
                  <Link to="/admin/availability" className={linkClass('/admin/availability')}>
                    <Calendar className="h-4 w-4" />
                    Manage Availability
                  </Link>
                  <Link to="/admin/pricing" className={linkClass('/admin/pricing')}>
                    <IndianRupee className="h-4 w-4" />
                    Pricing
                  </Link>
                  <Link to="/admin/reviews" className={linkClass('/admin/reviews')}>
                    <MessageSquare className="h-4 w-4" />
                    Reviews
                  </Link>
                  <Link to="/admin/staff" className={linkClass('/admin/staff')}>
                    <Users className="h-4 w-4" />
                    Manage Staff
                  </Link>
                </>
              )}
              {role === 'staff' && (
                <>
                  <Link to="/staff/schedule" className={linkClass('/staff/schedule')}>
                    <Calendar className="h-4 w-4" />
                    My Schedule
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* User Profile & Logout */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full py-1.5 px-3">
              <div className="bg-sky-100 p-1 rounded-full text-sky-600">
                <User className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-slate-700">{name}</span>
              <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full capitalize font-medium">
                {role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 p-2.5 rounded-full transition-all duration-200"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-500 hover:text-sky-600 p-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-2 pt-2 pb-4 space-y-1 shadow-inner">
          {role === 'customer' && (
            <>
              <Link to="/" onClick={() => setIsOpen(false)} className={mobileLinkClass('/')}>
                <Calendar className="h-5 w-5" />
                Dashboard
              </Link>
              <Link to="/book" onClick={() => setIsOpen(false)} className={mobileLinkClass('/book')}>
                <Sparkles className="h-5 w-5" />
                Book Service
              </Link>
              <Link to="/appointments" onClick={() => setIsOpen(false)} className={mobileLinkClass('/appointments')}>
                <ClipboardList className="h-5 w-5" />
                My Bookings
              </Link>
              <Link to="/my-recurring" onClick={() => setIsOpen(false)} className={mobileLinkClass('/my-recurring')}>
                    <RefreshCw className="h-5 w-5" />
                    Recurring Plans
                  </Link>
              <Link to="/profile" onClick={() => setIsOpen(false)} className={mobileLinkClass('/profile')}>
                <User className="h-5 w-5" />
                My Profile
              </Link>
            </>
          )}
          {role === 'admin' && (
            <>
              <Link to="/admin" onClick={() => setIsOpen(false)} className={mobileLinkClass('/admin')}>
                <Shield className="h-5 w-5" />
                Admin Dashboard
              </Link>
              <Link to="/admin/availability" onClick={() => setIsOpen(false)} className={mobileLinkClass('/admin/availability')}>
                <Calendar className="h-5 w-5" />
                Manage Availability
              </Link>
              <Link to="/admin/pricing" onClick={() => setIsOpen(false)} className={mobileLinkClass('/admin/pricing')}>
                <IndianRupee className="h-5 w-5" />
                Pricing
              </Link>
              <Link to="/admin/reviews" onClick={() => setIsOpen(false)} className={mobileLinkClass('/admin/reviews')}>
                <MessageSquare className="h-5 w-5" />
                Reviews
              </Link>
              <Link to="/admin/staff" onClick={() => setIsOpen(false)} className={mobileLinkClass('/admin/staff')}>
                <Users className="h-5 w-5" />
                Manage Staff
              </Link>
            </>
          )}
          {role === 'staff' && (
            <>
              <Link to="/staff/schedule" onClick={() => setIsOpen(false)} className={mobileLinkClass('/staff/schedule')}>
                <Calendar className="h-5 w-5" />
                My Schedule
              </Link>
            </>
          )}
          <div className="border-t border-slate-100 my-2 pt-3 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-sky-100 p-1.5 rounded-full text-sky-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 leading-none">{name}</p>
                <p className="text-xs text-slate-500 capitalize">{role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-600 hover:bg-red-50 font-semibold text-sm py-2 px-3 rounded-lg transition-all"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
