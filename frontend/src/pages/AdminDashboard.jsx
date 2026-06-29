import React, { useEffect, useState } from 'react';
import { Shield, Users, Calendar, AlertCircle, CheckCircle, Clock, Trash2, Search, Filter, RefreshCw, BarChart2, Star, MessageSquare } from 'lucide-react';
import api from '../api/axios';

const AdminDashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [stats, setStats] = useState({
    total_bookings_today: 0,
    pending_count: 0,
    completed_this_week: 0,
    average_rating: 0.0,
    total_reviews: 0,
    active_recurring_plans: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('bookings'); // 'bookings' or 'customers'
  
  // Search & Filter state
  const [searchName, setSearchName] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDate, setFilterDate] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [apptsRes, statsRes, custRes, reviewStatsRes, staffRes] = await Promise.all([
        api.get('/appointments/'),
        api.get('/admin/stats'),
        api.get('/admin/customers'),
        api.get('/admin/reviews/stats'),
        api.get('/admin/staff')
      ]);

      setAppointments(apptsRes.data);
      setStats({
        ...statsRes.data,
        average_rating: reviewStatsRes.data.average_rating,
        total_reviews: reviewStatsRes.data.total_reviews
      });
      setCustomers(custRes.data);
      setStaff(staffRes.data);
    } catch (err) {
      setError('Could not retrieve dashboard metrics. Verify backend connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignStaff = async (appointmentId, staffId) => {
    try {
      await api.patch(`/admin/appointments/${appointmentId}/assign`, {
        staff_id: staffId ? parseInt(staffId) : null
      });
      fetchDashboardData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((e) => e.msg).join(', ') : detail;
      alert(msg || 'Failed to assign staff.');
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const handleAction = () => {
      fetchDashboardData();
    };
    window.addEventListener('appointment-action', handleAction);
    return () => {
      window.removeEventListener('appointment-action', handleAction);
    };
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.patch(`/appointments/${id}`, { status: newStatus });
      // Reload stats and appointments
      fetchDashboardData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((e) => e.msg).join(', ') : detail;
      alert(msg || 'Failed to update appointment status.');
    }
  };

  const handleResetFilters = () => {
    setSearchName('');
    setFilterStatus('All');
    setFilterDate('');
  };

  // Filter appointments logic
  const filteredAppointments = appointments.filter((appt) => {
    const matchesSearch = appt.customer?.name.toLowerCase().includes(searchName.toLowerCase()) || 
                          appt.customer?.email.toLowerCase().includes(searchName.toLowerCase());
    const matchesStatus = filterStatus === 'All' ? true : appt.status === filterStatus;
    const matchesDate = filterDate === '' ? true : appt.date === filterDate;
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Confirmed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Completed':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Helper date conversions
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Shield className="h-8 w-8 text-sky-500" />
            Admin Control Center
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage scheduling operations, update booking states, and review customer files.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Sync Data
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-5 py-4 rounded-2xl flex items-start gap-3 text-sm mb-8 shadow-sm">
          <AlertCircle className="h-5.5 w-5.5 mt-0.5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        {/* Card 1 */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-sky-50 p-3.5 rounded-2xl text-sky-500">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bookings Today</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              {loading ? '...' : stats.total_bookings_today}
            </h3>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-yellow-50 p-3.5 rounded-2xl text-yellow-500">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Approvals</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              {loading ? '...' : stats.pending_count}
            </h3>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-emerald-50 p-3.5 rounded-2xl text-emerald-500">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed This Week</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              {loading ? '...' : stats.completed_this_week}
            </h3>
          </div>
        </div>

        {/* Card 4 - Average Rating */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-amber-50 p-3.5 rounded-2xl text-amber-500">
            <Star className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg. Rating</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              {loading ? '...' : stats.average_rating.toFixed(1)}
            </h3>
          </div>
        </div>

        {/* Card 5 - Total Reviews */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-purple-50 p-3.5 rounded-2xl text-purple-500">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Reviews</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              {loading ? '...' : stats.total_reviews}
            </h3>
          </div>
        </div>

        {/* Card 6 - Active Repeat Plans */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="bg-sky-50 p-3.5 rounded-2xl text-sky-600">
            <RefreshCw className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Repeat Plans</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              {loading ? '...' : stats.active_recurring_plans || 0}
            </h3>
          </div>
        </div>
      </div>

      {/* Staff Workload Overview */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-500" />
            Staff Availability & Workload
          </h2>
          <span className="text-xs font-semibold bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full">
            {staff.filter(s => s.is_active).length} Active Cleaners
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-4 py-3">Cleaner Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Jobs Today</th>
                <th className="px-4 py-3 text-center">Jobs This Week</th>
                <th className="px-4 py-3">Availability Today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700 text-sm">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-6 text-slate-400">
                    No cleaner profiles registered yet. Go to "Manage Staff" to add some.
                  </td>
                </tr>
              ) : (
                staff.map((cleaner) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isOnLeaveToday = cleaner.leaves?.includes(todayStr);
                  let availabilityStatus = "Available";
                  let statusColor = "text-emerald-600 bg-emerald-50 border-emerald-100";
                  
                  if (!cleaner.is_active) {
                    availabilityStatus = "Inactive";
                    statusColor = "text-slate-400 bg-slate-50 border-slate-100";
                  } else if (isOnLeaveToday) {
                    availabilityStatus = "On Leave Today";
                    statusColor = "text-amber-600 bg-amber-50 border-amber-100";
                  } else if (cleaner.jobs_today >= 3) {
                    availabilityStatus = "Fully Booked Today";
                    statusColor = "text-rose-600 bg-rose-50 border-rose-100";
                  }
                  
                  return (
                    <tr key={cleaner.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {cleaner.name}
                        <span className="block text-xs font-normal text-slate-400 mt-0.5">{cleaner.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          cleaner.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {cleaner.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-800">
                        {cleaner.jobs_today}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-800">
                        {cleaner.jobs_this_week}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor}`}>
                          {availabilityStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveView('bookings')}
          className={`px-5 py-3 border-b-2 font-semibold text-sm transition-all flex items-center gap-2 ${
            activeView === 'bookings'
              ? 'border-sky-500 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Calendar className="h-5 w-5" />
          Bookings Management ({appointments.length})
        </button>
        <button
          onClick={() => setActiveView('customers')}
          className={`px-5 py-3 border-b-2 font-semibold text-sm transition-all flex items-center gap-2 ${
            activeView === 'customers'
              ? 'border-sky-500 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Users className="h-5 w-5" />
          Registered Customers ({customers.length})
        </button>
      </div>

      {/* Main panel loading state */}
      {loading && appointments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm animate-pulse">
          <p className="text-slate-500">Synchronizing control panel...</p>
        </div>
      ) : activeView === 'bookings' ? (
        /* Bookings View */
        <div className="space-y-6">
          {/* Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-1 flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="Search customer name or email..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder-slate-400"
                />
              </div>

              {/* Status filter */}
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full sm:w-44 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-slate-700"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="relative">
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-slate-700"
                />
              </div>
            </div>

            {/* Reset Button */}
            {(searchName || filterStatus !== 'All' || filterDate) && (
              <button
                onClick={handleResetFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 border border-rose-100 hover:bg-rose-50 px-3.5 py-2.5 rounded-xl transition-all self-start md:self-auto"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Bookings Table */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Date / Slot</th>
                    <th className="px-6 py-4">Cleaning details</th>
                    <th className="px-6 py-4">Address & Notes</th>
                    <th className="px-6 py-4">Assigned Cleaner</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Modify Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700 text-sm">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-10 text-slate-400">
                        No appointments match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map((appt) => (
                      <tr key={appt.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">
                            {appt.customer?.name || 'Unknown User'}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {appt.customer?.email}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {appt.customer?.phone}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">
                            {formatFriendlyDate(appt.date)}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {appt.time_slot}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            appt.cleaning_type === 'Deep Clean'
                              ? 'bg-purple-50 text-purple-700 border-purple-100'
                              : appt.cleaning_type === 'Move-In/Move-Out'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              : 'bg-sky-50 text-sky-700 border-sky-100'
                          }`}>
                            {appt.cleaning_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="text-xs font-medium text-slate-800 truncate" title={appt.address}>
                            {appt.address}
                          </div>
                          {appt.notes && (
                            <div className="text-[11px] text-slate-400 italic truncate mt-1" title={appt.notes}>
                              "{appt.notes}"
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={appt.assigned_staff_id || ''}
                            onChange={(e) => handleAssignStaff(appt.id, e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 max-w-[170px]"
                          >
                            <option value="">-- Unassigned --</option>
                            {staff.filter(s => s.is_active).map(s => {
                              const onLeave = s.leaves?.includes(appt.date);
                              const hasConflict = appointments.some(a => a.assigned_staff_id === s.id && a.date === appt.date && a.time_slot === appt.time_slot && a.status !== 'Cancelled' && a.id !== appt.id);
                              const dayWorkload = appointments.filter(a => a.assigned_staff_id === s.id && a.date === appt.date && ['Pending', 'Confirmed', 'Completed'].includes(a.status)).length;
                              
                              let statusText = `Workload: ${dayWorkload}`;
                              if (onLeave) statusText = "On Leave";
                              else if (hasConflict) statusText = "Conflict";
                              
                              return (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({statusText})
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(appt.status)}`}>
                            {appt.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <select
                            value={appt.status}
                            onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg text-xs py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Customers View */
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Customer Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone Number</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Registration Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700 text-sm">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-slate-400">
                      No registered customers found.
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {customer.name}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {customer.email}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {customer.phone}
                      </td>
                      <td className="px-6 py-4 uppercase text-xs font-medium tracking-wider text-slate-500">
                        {customer.role}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {new Date(customer.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
