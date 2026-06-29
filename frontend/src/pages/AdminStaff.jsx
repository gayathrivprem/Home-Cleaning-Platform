import React, { useState, useEffect } from 'react';
import { User, Plus, ToggleLeft, ToggleRight, Check, Save, Edit, RefreshCw, ShieldAlert, Sparkles, Calendar, X, Clock, Trash2, CalendarDays, Info } from 'lucide-react';
import api from '../api/axios';

const AdminStaff = () => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modals visibility
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Selected cleaner data for models
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Form states
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [editForm, setEditForm] = useState({ id: null, name: '', phone: '', is_active: true });
  const [leaveForm, setLeaveForm] = useState({ date: '', reason: '' });
  const [staffLeaves, setStaffLeaves] = useState([]);
  
  // Weekly Schedule states
  const [scheduleWeek, setScheduleWeek] = useState([]); // Array of 7 days: { dateStr, dayName, appointments: { "Morning 8–12": appt, ... }, isLeave: bool, leaveReason: str }
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = past week, 1 = next week

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/admin/staff');
      setStaffList(response.data);
    } catch (err) {
      setError('Could not retrieve staff directory.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email || !addForm.phone || !addForm.password) {
      setError('Please fill in all fields for the new staff member.');
      return;
    }
    setError('');
    try {
      await api.post('/admin/staff', addForm);
      setSuccess('Staff member registered successfully!');
      setAddForm({ name: '', email: '', phone: '', password: '' });
      setShowAddModal(false);
      fetchStaff();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to register staff.');
    }
  };

  const handleEditClick = (staff) => {
    setSelectedStaff(staff);
    setEditForm({
      id: staff.id,
      name: staff.name,
      phone: staff.phone,
      is_active: staff.is_active
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.patch(`/admin/staff/${editForm.id}`, {
        name: editForm.name,
        phone: editForm.phone,
        is_active: editForm.is_active
      });
      setSuccess('Staff profile updated successfully!');
      setShowEditModal(false);
      fetchStaff();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile.');
    }
  };

  const handleToggleActive = async (staff) => {
    const confirmMsg = staff.is_active 
      ? `Deactivating ${staff.name} will unassign them from all future appointments. Proceed?`
      : `Reactivate ${staff.name}?`;
    if (!window.confirm(confirmMsg)) return;

    setError('');
    try {
      await api.patch(`/admin/staff/${staff.id}`, {
        name: staff.name,
        phone: staff.phone,
        is_active: !staff.is_active
      });
      fetchStaff();
    } catch (err) {
      setError('Failed to change status.');
    }
  };

  // Leave Calendar Management
  const handleManageLeaveClick = async (staff) => {
    setSelectedStaff(staff);
    setShowLeaveModal(true);
    fetchLeaves(staff.id);
  };

  const fetchLeaves = async (staffId) => {
    try {
      const response = await api.get(`/admin/staff/${staffId}/leave`);
      setStaffLeaves(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.date) return;
    try {
      await api.post(`/admin/staff/${selectedStaff.id}/leave`, {
        date: leaveForm.date,
        reason: leaveForm.reason
      });
      setLeaveForm({ date: '', reason: '' });
      fetchLeaves(selectedStaff.id);
      fetchStaff(); // Refresh weekly metrics
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add leave request.');
    }
  };

  const handleRemoveLeave = async (leaveId) => {
    if (!window.confirm('Delete this leave block?')) return;
    try {
      await api.delete(`/admin/staff/${selectedStaff.id}/leave/${leaveId}`);
      fetchLeaves(selectedStaff.id);
      fetchStaff(); // Refresh weekly metrics
    } catch (err) {
      alert('Failed to remove leave block.');
    }
  };

  // Weekly Schedule Grid
  const handleViewScheduleClick = (staff) => {
    setSelectedStaff(staff);
    setWeekOffset(0);
    setShowScheduleModal(true);
  };

  useEffect(() => {
    if (showScheduleModal && selectedStaff) {
      buildWeeklySchedule();
    }
  }, [showScheduleModal, selectedStaff, weekOffset]);

  const buildWeeklySchedule = async () => {
    try {
      // Calculate start and end date for offset week (Monday to Sunday)
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // steps back to Mon
      
      const monday = new Date(today);
      monday.setDate(today.getDate() + diffToMon + (weekOffset * 7));
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const startStr = monday.toISOString().split('T')[0];
      const endStr = sunday.toISOString().split('T')[0];

      // Fetch appointments and leaves
      const [apptRes, leaveRes] = await Promise.all([
        api.get(`/admin/staff/${selectedStaff.id}/schedule?start=${startStr}&end=${endStr}`),
        api.get(`/admin/staff/${selectedStaff.id}/leave`)
      ]);

      const appointments = apptRes.data;
      const leaves = leaveRes.data;

      // Build 7 day columns
      const days = [];
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
        // Find if this date is a leave date
        const leaveInfo = leaves.find(l => l.date === dateStr);
        
        // Find appointments for this date mapped by slot
        const dayAppts = {};
        const slots = ["Morning 8–12", "Afternoon 12–5", "Evening 5–8"];
        slots.forEach(slot => {
          dayAppts[slot] = appointments.find(a => a.date === dateStr && a.time_slot === slot) || null;
        });

        days.push({
          dateStr,
          dayName: dayNames[i],
          displayDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          appointments: dayAppts,
          isLeave: !!leaveInfo,
          leaveReason: leaveInfo ? leaveInfo.reason : ''
        });
      }
      setScheduleWeek(days);
    } catch (err) {
      console.error("Failed to build weekly schedule", err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
            <User className="h-8 w-8 text-sky-500" />
            Staff Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Register cleaning staff, schedule service assignments, and monitor cleaner workload and leave.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md shadow-sky-500/10 self-start sm:self-auto"
        >
          <Plus className="h-4.5 w-4.5" />
          Add Staff Member
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-5 py-4 rounded-2xl flex items-start gap-3 text-sm mb-6">
          <ShieldAlert className="h-5.5 w-5.5 mt-0.5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-5 py-4 rounded-2xl flex items-center gap-3 text-sm mb-6 animate-fadeIn">
          <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {loading && staffList.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm animate-pulse text-slate-500">
          Syncing cleaner directory...
        </div>
      ) : staffList.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center max-w-lg mx-auto shadow-sm">
          <User className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800">No Cleaners Registered</h3>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            There are no staff cleaners currently created. Click the button above to register your first team member.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staffList.map((cleaner) => (
            <div
              key={cleaner.id}
              className={`bg-white border rounded-2xl p-6 transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
                cleaner.is_active ? 'border-slate-100' : 'border-slate-100 bg-slate-50/50 opacity-75'
              }`}
            >
              <div>
                {/* Card Title & Status Badge */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${cleaner.is_active ? 'bg-sky-50 text-sky-600' : 'bg-slate-100 text-slate-400'}`}>
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-base leading-tight">{cleaner.name}</h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{cleaner.email}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    cleaner.is_active 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      : 'bg-rose-50 text-rose-700 border-rose-100'
                  }`}>
                    {cleaner.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Cleaner Info */}
                <div className="space-y-1.5 text-xs text-slate-600 mb-6 border-b border-slate-50 pb-4">
                  <p><span className="font-semibold text-slate-400">Phone:</span> {cleaner.phone}</p>
                  <p><span className="font-semibold text-slate-400">Registered:</span> {new Date().toLocaleDateString()}</p>
                </div>

                {/* Workload statistics */}
                <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Jobs Today</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">{cleaner.jobs_today}</p>
                  </div>
                  <div className="text-center border-l border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Jobs This Week</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">{cleaner.jobs_this_week}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleViewScheduleClick(cleaner)}
                    className="border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold py-2 rounded-xl transition-all"
                  >
                    View Schedule
                  </button>
                  <button
                    onClick={() => handleManageLeaveClick(cleaner)}
                    className="border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold py-2 rounded-xl transition-all"
                  >
                    Manage Leave
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleEditClick(cleaner)}
                    className="border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold py-2 rounded-xl transition-all"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => handleToggleActive(cleaner)}
                    className={`text-xs font-semibold py-2 rounded-xl transition-all border ${
                      cleaner.is_active
                        ? 'border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-rose-600'
                        : 'border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {cleaner.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- ADD MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 sm:p-8 animate-scaleIn border border-slate-100">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <User className="h-6 w-6 text-sky-500" />
              Add New Cleaner
            </h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="Cleaner's Full Name"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="cleaner@cleanpro.com"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Phone</label>
                <input
                  type="text"
                  required
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="Enter login password"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-xl text-sm transition-colors mt-6 shadow-md shadow-sky-500/10"
              >
                Register Cleaner
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL --- */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 sm:p-8 border border-slate-100">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Edit className="h-6 w-6 text-sky-500" />
              Edit Cleaner Profile
            </h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Phone</label>
                <input
                  type="text"
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50"
                />
              </div>
              <div className="flex items-center justify-between border border-slate-100 rounded-xl p-3 bg-slate-50/50 mt-4">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Cleaner Active status</span>
                  <span className="text-[10px] text-slate-400">Controls if cleaner can take bookings.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
                  className={`p-1 rounded-xl transition-all ${
                    editForm.is_active ? 'text-emerald-500' : 'text-slate-300'
                  }`}
                >
                  {editForm.is_active ? (
                    <ToggleRight className="h-9 w-9 stroke-[1.5]" />
                  ) : (
                    <ToggleLeft className="h-9 w-9 stroke-[1.5]" />
                  )}
                </button>
              </div>
              <button
                type="submit"
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-xl text-sm transition-colors mt-6 shadow-md shadow-sky-500/10"
              >
                Save Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- LEAVE MANAGEMENT MODAL --- */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl max-w-lg w-full shadow-2xl p-6 border border-slate-100">
            <button
              onClick={() => setShowLeaveModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-sky-500" />
              Manage Time-Off: {selectedStaff?.name}
            </h2>
            
            {/* Add Leave Form */}
            <form onSubmit={handleAddLeave} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl mb-6 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Record New Leave Block</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    type="date"
                    required
                    value={leaveForm.date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, date: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="Reason (e.g. Doctor's Appt)"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl text-xs transition-colors self-end"
              >
                Log Leave Block
              </button>
            </form>

            {/* Leave history */}
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Logged Upcoming Leave Blocks</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {staffLeaves.length === 0 ? (
                <p className="text-center py-6 text-slate-400 text-xs italic">No leave registered for this cleaner.</p>
              ) : (
                staffLeaves.map((l) => (
                  <div key={l.id} className="flex justify-between items-center bg-amber-50/50 border border-amber-100 p-3 rounded-xl text-xs">
                    <div>
                      <span className="font-bold text-amber-900 block">
                        {new Date(l.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                      {l.reason && <span className="text-[11px] text-amber-700 italic mt-0.5 block">Reason: "{l.reason}"</span>}
                    </div>
                    <button
                      onClick={() => handleRemoveLeave(l.id)}
                      className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- WEEKLY SCHEDULE MODAL --- */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl max-w-5xl w-full shadow-2xl p-6 border border-slate-100 overflow-hidden flex flex-col">
            <button
              onClick={() => setShowScheduleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
            </button>
            
            {/* Header info */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-sky-500" />
                  Assigned Schedule: {selectedStaff?.name}
                </h2>
                <p className="text-xs text-slate-400">Weekly scheduling calendar view.</p>
              </div>
              
              {/* Navigation */}
              <div className="flex gap-2">
                <button
                  onClick={() => setWeekOffset(prev => prev - 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-600"
                >
                  ◀ Prev Week
                </button>
                <button
                  onClick={() => setWeekOffset(0)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-600"
                >
                  Current Week
                </button>
                <button
                  onClick={() => setWeekOffset(prev => prev + 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-600"
                >
                  Next Week ▶
                </button>
              </div>
            </div>

            {/* Weekly Schedule Grid */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4 overflow-x-auto">
              {scheduleWeek.map((day, idx) => (
                <div
                  key={idx}
                  className={`border rounded-2xl p-3 flex flex-col justify-start min-h-[300px] ${
                    day.isLeave
                      ? 'border-amber-200 bg-amber-50/10'
                      : 'border-slate-100 bg-slate-50/20'
                  }`}
                >
                  <div className="border-b border-slate-100 pb-2 mb-3 text-center">
                    <span className="font-extrabold text-slate-700 text-xs block">{day.dayName}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{day.displayDate}</span>
                  </div>

                  {day.isLeave ? (
                    <div className="flex-grow flex flex-col justify-center items-center text-center p-3 rounded-xl bg-amber-50 border border-amber-100/50">
                      <span className="text-lg mb-1">💤</span>
                      <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">On Leave</span>
                      {day.leaveReason && (
                        <span className="text-[9px] text-amber-600 italic mt-1 leading-snug">"{day.leaveReason}"</span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 flex-grow flex flex-col justify-start">
                      {["Morning 8–12", "Afternoon 12–5", "Evening 5–8"].map(slot => {
                        const appt = day.appointments[slot];
                        return (
                          <div
                            key={slot}
                            className={`p-2.5 rounded-xl border flex flex-col justify-between min-h-[72px] ${
                              appt
                                ? 'bg-sky-50 border-sky-100 text-sky-850'
                                : 'bg-white border-slate-150 text-slate-400'
                            }`}
                          >
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wider block leading-none mb-1 text-slate-400">
                                {slot.split(' ')[0]}
                              </span>
                              {appt ? (
                                <>
                                  <span className="font-bold text-xs text-sky-900 leading-snug block">
                                    {appt.cleaning_type}
                                  </span>
                                  <span className="text-[9px] text-sky-600 leading-tight truncate block mt-0.5" title={appt.address}>
                                    📍 {appt.address.split(',')[0]}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] italic">Available</span>
                              )}
                            </div>
                            {appt && (
                              <span className={`self-start mt-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded border leading-none ${
                                appt.status === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : appt.status === 'Confirmed'
                                  ? 'bg-sky-100 text-sky-700 border-sky-200'
                                  : 'bg-yellow-50 text-yellow-700 border-yellow-100'
                              }`}>
                                {appt.status}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStaff;
