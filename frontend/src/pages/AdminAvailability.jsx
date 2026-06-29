import React, { useState, useEffect } from 'react';
import { Shield, Calendar, Clock, Trash2, Plus, AlertCircle, CheckCircle, Sliders, Sparkles } from 'lucide-react';
import api from '../api/axios';

const AdminAvailability = () => {
  const [blocks, setBlocks] = useState([]);
  const [maxPerSlot, setMaxPerSlot] = useState(3);
  const [loading, setLoading] = useState(true);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Block form state
  const [blockDate, setBlockDate] = useState('');
  const [blockSlot, setBlockSlot] = useState(''); // Empty string = All Day
  const [blockReason, setBlockReason] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchAvailabilityConfig = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [blocksRes, configRes] = await Promise.all([
        api.get('/admin/availability/blocks'),
        api.get('/admin/slot-config')
      ]);

      setBlocks(blocksRes.data);
      setMaxPerSlot(configRes.data.max_per_slot);
    } catch (err) {
      console.error(err);
      setError('Could not retrieve availability settings. Verify admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailabilityConfig();
  }, []);

  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    if (maxPerSlot < 1) {
      setError('Limit per slot must be at least 1.');
      return;
    }

    setUpdatingConfig(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.patch('/admin/slot-config', { max_per_slot: Number(maxPerSlot) });
      setSuccessMsg('Global slot capacity limit updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to update capacity limit configuration.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleCreateBlock = async (e) => {
    e.preventDefault();
    if (!blockDate) {
      setError('Please select a date to block.');
      return;
    }

    setCreatingBlock(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.post('/admin/availability/block', {
        date: blockDate,
        time_slot: blockSlot || null,
        reason: blockReason || null
      });

      setSuccessMsg('Availability block successfully created!');
      setBlockDate('');
      setBlockSlot('');
      setBlockReason('');
      
      // Refresh list
      const blocksRes = await api.get('/admin/availability/blocks');
      setBlocks(blocksRes.data);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      setError(detail || 'Failed to create availability block.');
    } finally {
      setCreatingBlock(false);
    }
  };

  const handleDeleteBlock = async (id) => {
    if (!window.confirm('Are you sure you want to remove this availability block?')) {
      return;
    }

    setError('');
    setSuccessMsg('');

    try {
      await api.delete(`/admin/availability/block/${id}`);
      setSuccessMsg('Block successfully removed.');
      setBlocks(blocks.filter(b => b.id !== id));
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to delete availability block.');
    }
  };

  const formatFriendlyDate = (dateStr) => {
    try {
      const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
      const date = new Date(dateStr + 'T00:00:00');
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString(undefined, options);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
          <Shield className="h-8 w-8 text-sky-500" />
          Manage Availability
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Lock company vacation dates, block unavailable time slots, and customize concurrent booking capacities.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-5 py-4 rounded-2xl flex items-start gap-3 text-sm mb-6 shadow-sm">
          <AlertCircle className="h-5.5 w-5.5 mt-0.5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-5 py-4 rounded-2xl flex items-start gap-3 text-sm mb-6 shadow-sm">
          <CheckCircle className="h-5.5 w-5.5 mt-0.5 text-emerald-500 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm animate-pulse">
          <p className="text-slate-500 font-semibold">Synchronizing scheduler configurations...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Form Settings */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Slot Config Card */}
            <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-xl shadow-slate-100/50">
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Sliders className="h-5 w-5 text-sky-500" />
                Slot Capacity Cap
              </h2>
              <form onSubmit={handleUpdateConfig} className="space-y-4">
                <div>
                  <label htmlFor="maxPerSlot" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Max bookings per slot *
                  </label>
                  <input
                    id="maxPerSlot"
                    type="number"
                    min="1"
                    required
                    value={maxPerSlot}
                    onChange={(e) => setMaxPerSlot(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-semibold"
                  />
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    Determines the max number of cleanings customers can schedule simultaneously during the same day and time slot.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={updatingConfig}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md shadow-sky-500/10"
                >
                  {updatingConfig ? 'Saving...' : 'Update Capacity Limit'}
                </button>
              </form>
            </div>

            {/* Block Slot Card */}
            <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-xl shadow-slate-100/50">
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-sky-500" />
                Add Vacation Block
              </h2>
              <form onSubmit={handleCreateBlock} className="space-y-4">
                
                {/* Date */}
                <div>
                  <label htmlFor="blockDate" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Date to Block *
                  </label>
                  <input
                    id="blockDate"
                    type="date"
                    required
                    min={todayStr}
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-slate-700 font-medium"
                  />
                </div>

                {/* Slot Choice */}
                <div>
                  <label htmlFor="blockSlot" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Time Slot
                  </label>
                  <select
                    id="blockSlot"
                    value={blockSlot}
                    onChange={(e) => setBlockSlot(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  >
                    <option value="">All Day (Block Entire Date)</option>
                    <option value="Morning 8–12">Morning (8:00 AM – 12:00 PM)</option>
                    <option value="Afternoon 12–5">Afternoon (12:00 PM – 5:00 PM)</option>
                    <option value="Evening 5–8">Evening (5:00 PM – 8:00 PM)</option>
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <label htmlFor="blockReason" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Block Reason / Notes
                  </label>
                  <input
                    id="blockReason"
                    type="text"
                    placeholder="Holiday, Staff Out, Maintenance..."
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder-slate-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingBlock}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  {creatingBlock ? 'Blocking...' : 'Add Availability Block'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Listing Blocks */}
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-xl shadow-slate-100/50">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="h-5.5 w-5.5 text-sky-500" />
              Active Availability Locks ({blocks.length})
            </h2>

            <div className="border border-slate-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Blocked Date</th>
                      <th className="px-6 py-4">Time Slot</th>
                      <th className="px-6 py-4">Reason / Notes</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700 text-sm">
                    {blocks.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-12 text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Sparkles className="h-8 w-8 text-slate-300" />
                            <span>No active vacation blocks are currently set.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      blocks.map((block) => (
                        <tr key={block.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-800">
                            {formatFriendlyDate(block.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {block.time_slot ? (
                              <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 border border-slate-200 text-xs px-2.5 py-0.5 rounded-full">
                                <Clock className="h-3 w-3 text-slate-400" />
                                {block.time_slot.split(' ')[0]}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-100 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                All Day
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {block.reason ? (
                              <span className="text-slate-750 font-medium">{block.reason}</span>
                            ) : (
                              <span className="text-slate-400 italic text-xs">No reason provided</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleDeleteBlock(block.id)}
                              className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition-all"
                              title="Delete Availability Block"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default AdminAvailability;
