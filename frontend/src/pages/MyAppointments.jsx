import React, { useEffect, useState } from 'react';
import { Calendar, AlertCircle, Inbox } from 'lucide-react';
import api from '../api/axios';
import AppointmentCard from '../components/AppointmentCard';
import { AppointmentCardSkeleton } from '../components/Skeletons';
import { EmptyState } from '../components/EmptyState';

const MyAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/appointments/');
      setAppointments(response.data);
    } catch (err) {
      setError('Failed to retrieve bookings. Please refresh to try again.');
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
    window.addEventListener('appointments-updated', handleAction);
    return () => {
      window.removeEventListener('appointment-action', handleAction);
      window.removeEventListener('appointments-updated', handleAction);
    };
  }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this cleaning appointment?')) {
      return;
    }

    try {
      await api.patch(`/appointments/${id}`, { status: 'Cancelled' });
      fetchAppointments();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((e) => e.msg).join(', ') : detail;
      alert(msg || 'Could not cancel the appointment.');
    }
  };

  const filteredAppointments = appointments.filter((appt) => {
    if (activeTab === 'All') return true;
    return appt.status === activeTab;
  });

  const tabs = ['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
          <Calendar className="h-8 w-8 text-sky-500" />
          My Cleaning Bookings
        </h1>
        <p className="text-slate-500 text-sm mt-1.5">
          Track, inspect, or cancel your home cleaning schedules and history.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-5 py-4 rounded-2xl flex items-start gap-3 text-sm mb-6">
          <AlertCircle className="h-5.5 w-5.5 mt-0.5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto pb-px mb-8 scrollbar-none">
        {tabs.map((tab) => {
          const count = tab === 'All' ? appointments.length : appointments.filter(a => a.status === tab).length;
          const isActive = activeTab === tab;
          
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm whitespace-nowrap transition-all ${
                isActive
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab}
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                isActive ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid listing */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <AppointmentCardSkeleton key={n} />
          ))}
        </div>
      ) : filteredAppointments.length === 0 ? (
        <EmptyState type="appointments" customMessage={`No appointments with status "${activeTab}" found.`} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAppointments.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              onCancel={handleCancel}
              onReviewSubmitted={fetchAppointments}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyAppointments;
