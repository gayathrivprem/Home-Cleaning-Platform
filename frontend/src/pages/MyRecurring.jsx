import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Calendar, MapPin, CreditCard, Trash2, Play, Pause, CalendarClock, Inbox, Info } from 'lucide-react';
import api from '../api/axios';

const MyRecurring = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/recurring');
      setSchedules(response.data);
    } catch (err) {
      setError('Could not retrieve your recurring cleaning plans.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleToggleActive = async (schedule) => {
    const actionText = schedule.is_active ? 'pause' : 'resume';
    if (!window.confirm(`Are you sure you want to ${actionText} this recurring series?`)) {
      return;
    }
    setError('');
    try {
      await api.patch(`/recurring/${schedule.id}`, { is_active: !schedule.is_active });
      setSuccess(`Successfully ${actionText === 'pause' ? 'paused' : 'resumed'} recurring cleaning series.`);
      fetchSchedules();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to update recurring series.');
    }
  };

  const handleCancelSeries = async (id) => {
    const msg = 'This will cancel all future pending appointments in this series. Already confirmed visits will not be affected. Proceed?';
    if (!window.confirm(msg)) {
      return;
    }
    setError('');
    try {
      await api.delete(`/recurring/${id}`);
      setSuccess('Successfully cancelled recurring plan series.');
      fetchSchedules();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to cancel recurring plan series.');
    }
  };

  const formatFriendlyDate = (dateStr) => {
    try {
      const options = { month: 'short', day: 'numeric', year: 'numeric' };
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString(undefined, options);
    } catch {
      return dateStr;
    }
  };

  const getFrequencyLabel = (freq) => {
    switch (freq) {
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Every 2 Weeks';
      case 'monthly': return 'Monthly';
      default: return freq;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
            <CalendarClock className="h-8 w-8 text-sky-500" />
            My Recurring Cleaning Plans
          </h1>
          <p className="text-slate-500 text-sm mt-1.5">
            Manage your repeated weekly, biweekly, or monthly cleaning subscriptions.
          </p>
        </div>
        <button
          onClick={fetchSchedules}
          className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-5 py-4 rounded-2xl flex items-start gap-3 text-sm mb-6">
          <AlertCircle className="h-5.5 w-5.5 mt-0.5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-5 py-4 rounded-2xl flex items-center gap-3 text-sm mb-6 animate-fadeIn">
          <CheckIcon className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {loading && schedules.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div key={n} className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4 animate-pulse h-48"></div>
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl py-16 px-4 text-center max-w-lg mx-auto shadow-sm">
          <div className="bg-slate-50 p-4 rounded-full inline-flex text-slate-400 mb-4">
            <Inbox className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No Recurring Plans Setup</h3>
          <p className="mt-2 text-slate-500 text-sm leading-relaxed">
            You don't have any subscription cleaning plans. Toggle "Make this recurring?" on the Book Service tab to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className={`bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                schedule.is_active ? 'border-slate-100' : 'border-slate-100 bg-slate-50/50 opacity-75'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base leading-tight">
                      {schedule.cleaning_type} — {getFrequencyLabel(schedule.frequency)}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-semibold uppercase tracking-wide">
                      Time Slot: {schedule.time_slot}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    schedule.is_active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-yellow-50 text-yellow-700 border-yellow-100'
                  }`}>
                    {schedule.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-3 text-xs text-slate-600 mb-6">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{schedule.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>
                      {schedule.is_active 
                        ? `Next booking run: ${formatFriendlyDate(schedule.next_run_date)}`
                        : 'Series paused (No upcoming runs)'}
                    </span>
                  </div>
                  {schedule.end_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Terminates on: {formatFriendlyDate(schedule.end_date)}</span>
                    </div>
                  )}
                  
                  {/* Estimated Price Card */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-slate-700 font-medium text-xs mt-2.5 flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Est. price per visit:</span>
                    <span className="font-extrabold text-sky-600 text-sm">₹{JSON.parse(schedule.selected_addons).length > 0 ? 'See appt details' : 'Calculated per booking'}</span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex gap-3 mt-4 border-t border-slate-50 pt-4">
                <button
                  onClick={() => handleToggleActive(schedule)}
                  className={`flex-1 flex items-center justify-center gap-1.5 font-bold py-2 px-4 rounded-xl text-xs transition-all border ${
                    schedule.is_active
                      ? 'border-yellow-250 bg-yellow-50/50 hover:bg-yellow-50 text-yellow-600'
                      : 'border-emerald-250 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {schedule.is_active ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      Pause Plan
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Resume Plan
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleCancelSeries(schedule.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 hover:bg-rose-50 hover:border-rose-100 text-slate-500 hover:text-rose-600 font-bold py-2 px-4 rounded-xl text-xs transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Cancel Series
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Check icon helper
const CheckIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export default MyRecurring;
