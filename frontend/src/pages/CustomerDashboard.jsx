import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Plus, Sparkles, AlertCircle, ArrowRight, CheckCircle, ShieldAlert } from 'lucide-react';
import api from '../api/axios';
import AppointmentCard from '../components/AppointmentCard';
import { AppointmentCardSkeleton } from '../components/Skeletons';
import { EmptyState } from '../components/EmptyState';

const CustomerDashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const name = localStorage.getItem('name');

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/appointments/');
      setAppointments(response.data);
    } catch (err) {
      setError('Could not retrieve your bookings. Please try reloading.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();

    const handleAction = () => {
      fetchAppointments();
    };
    window.addEventListener('appointment-action', handleAction);
    return () => {
      window.removeEventListener('appointment-action', handleAction);
    };
  }, []);

  const handleCancelAppointment = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this cleaning appointment?')) {
      return;
    }

    try {
      await api.patch(`/appointments/${id}`, { status: 'Cancelled' });
      // Refresh list
      fetchAppointments();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((e) => e.msg).join(', ') : detail;
      alert(msg || 'Could not cancel the appointment.');
    }
  };

  // Filter for upcoming active appointments
  const upcomingAppointments = appointments.filter(
    (appt) => appt.status === 'Pending' || appt.status === 'Confirmed'
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Welcome banner */}
      <div className="bg-gradient-to-r from-sky-400 to-sky-600 rounded-3xl p-6 sm:p-10 text-white shadow-xl shadow-sky-500/10 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-2">
            Hello, {name}! <Sparkles className="h-7 w-7 text-sky-100 animate-pulse" />
          </h1>
          <p className="mt-2 text-sky-100 font-medium text-sm sm:text-base max-w-xl">
            Welcome back to your scheduling control panel. Manage your bookings or chat with our AI helper for scheduling updates!
          </p>
        </div>
        <Link
          to="/book"
          className="inline-flex items-center justify-center gap-2 bg-white text-sky-600 hover:bg-sky-50 font-bold px-6 py-3.5 rounded-2xl transition-all duration-200 shadow-lg shadow-sky-800/10 shrink-0 self-start md:self-auto"
        >
          <Plus className="h-5 w-5" />
          Book New Cleaning
        </Link>
      </div>

      {/* Mobile quick actions */}
      <div className="md:hidden grid grid-cols-2 gap-3 mb-6">
        <a href="/book"
           className="bg-sky-500 text-white rounded-xl p-4 text-center
                      font-medium text-sm hover:bg-sky-600 active:scale-95
                      transition-all">
          📅 Book Now
        </a>
        <a href="/appointments"
           className="bg-white border border-slate-200 text-slate-700
                      rounded-xl p-4 text-center font-medium text-sm
                      hover:bg-slate-50 active:scale-95 transition-all">
          📋 My Bookings
        </a>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-5 py-4 rounded-2xl flex items-start gap-3 text-sm mb-8 shadow-sm">
          <AlertCircle className="h-5.5 w-5.5 mt-0.5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="h-5.5 w-5.5 text-sky-500" />
            Upcoming Cleanings
          </h2>
          {upcomingAppointments.length > 0 && (
            <Link
              to="/appointments"
              className="text-sky-600 hover:text-sky-700 font-semibold text-sm flex items-center gap-1 group"
            >
              View all bookings
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <AppointmentCardSkeleton key={n} />
            ))}
          </div>
        ) : upcomingAppointments.length === 0 ? (
          <EmptyState type="appointments" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingAppointments.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                onCancel={handleCancelAppointment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDashboard;
