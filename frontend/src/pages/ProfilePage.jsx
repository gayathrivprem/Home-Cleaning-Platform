import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, MapPin, Clipboard, Key, Plus, Trash2, ShieldAlert, CheckCircle } from 'lucide-react';
import api from '../api/axios';

const ProfilePage = () => {
  const [profile, setProfile] = useState(null);
  const [staff, setStaff] = useState([]);
  const [newAddress, setNewAddress] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Password change states
  const [pwForm, setPwForm] = useState({
    current_password: '',
    new_password: '',
    confirm: ''
  });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Form states
  const [form, setForm] = useState({
    name: '',
    phone: '',
    cleaning_notes: '',
    preferred_staff_id: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      const [profileRes, staffRes] = await Promise.all([
        api.get('/profile/'),
        api.get('/active').catch(() => ({ data: [] }))
      ]);
      
      setProfile(profileRes.data);
      setStaff(staffRes.data || []);
      setForm({
        name: profileRes.data.name || '',
        phone: profileRes.data.phone || '',
        cleaning_notes: profileRes.data.cleaning_notes || '',
        preferred_staff_id: profileRes.data.preferred_staff_id || ''
      });
    } catch (err) {
      console.error(err);
      setError('Failed to load profile details.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await api.patch('/profile/', {
        ...form,
        preferred_staff_id: form.preferred_staff_id ? parseInt(form.preferred_staff_id) : null
      });
      
      // Update local storage in case name changed
      localStorage.setItem('name', form.name);
      
      // Trigger navbar re-render if needed
      window.dispatchEvent(new Event('storage'));
      
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
      loadData();
    } catch (err) {
      console.error(err);
      setError('Failed to update profile details.');
    } finally {
      setSaving(false);
    }
  };

  const addAddress = async (e) => {
    e.preventDefault();
    if (!newAddress.trim()) return;
    
    try {
      const updated = [...(profile.saved_addresses || []), newAddress.trim()];
      await api.patch('/profile/', { saved_addresses: updated });
      setProfile(p => ({ ...p, saved_addresses: updated }));
      setNewAddress('');
      setSuccess('Address added successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error(err);
      setError('Failed to add address.');
    }
  };

  const removeAddress = async (addr) => {
    try {
      const updated = profile.saved_addresses.filter(a => a !== addr);
      await api.patch('/profile/', { saved_addresses: updated });
      setProfile(p => ({ ...p, saved_addresses: updated }));
      setSuccess('Address removed successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error(err);
      setError('Failed to remove address.');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    
    if (pwForm.new_password !== pwForm.confirm) {
      setPwError("Passwords don't match");
      return;
    }
    
    setPwLoading(true);
    try {
      await api.patch('/profile/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password
      });
      setPwSuccess(true);
      setPwForm({ current_password: '', new_password: '', confirm: '' });
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (e) {
      setPwError(e.response?.data?.detail || "Failed to change password");
    } finally {
      setPwLoading(false);
    }
  };

  if (!profile) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center text-slate-400 font-medium">
      Loading profile details...
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans space-y-8 animate-fadeIn">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
          <User className="h-8 w-8 text-sky-500" />
          My Profile
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage your personal details, default cleaning preferences, saved addresses, and security settings.
        </p>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-5 py-4 rounded-2xl flex items-start gap-3 text-sm shadow-sm">
          <ShieldAlert className="h-5.5 w-5.5 mt-0.5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-105 text-emerald-700 px-5 py-4 rounded-2xl flex items-center gap-3 text-sm shadow-sm">
          <CheckCircle className="h-5.5 w-5.5 text-emerald-500 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Profile Details form */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100/50 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <User className="h-5 w-5 text-sky-500" />
              Account Details
            </h2>
            
            <form onSubmit={saveProfile} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="block w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-semibold"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                      <Phone className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      className="block w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-350">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    disabled
                    value={profile.email}
                    className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-400 text-sm cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-normal">
                  Email Address is used as account identifier and cannot be modified.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Default Cleaning Notes
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-4 pointer-events-none text-slate-400">
                    <Clipboard className="h-4 w-4" />
                  </div>
                  <textarea
                    value={form.cleaning_notes}
                    onChange={e => setForm(p => ({ ...p, cleaning_notes: e.target.value }))}
                    placeholder="e.g. Focus on kitchen and bathrooms, beware of friendly cat, key is under the mat..."
                    rows={3}
                    className="block w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              {staff.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Preferred Cleaner
                  </label>
                  <select
                    value={form.preferred_staff_id}
                    onChange={e => setForm(p => ({ ...p, preferred_staff_id: e.target.value }))}
                    className="block w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-semibold"
                  >
                    <option value="">No preference / Random Assignment</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving changes...' : 'Save Details'}
              </button>
            </form>
          </div>

          {/* Saved Addresses list */}
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100/50 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-sky-500" />
              Saved Addresses
            </h2>

            <form onSubmit={addAddress} className="flex gap-2 mb-6">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                  <MapPin className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Add new address (e.g. 123 Main St, Apt 4B)"
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  className="block w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
              <button
                type="submit"
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 rounded-xl text-xs transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </form>

            <div className="space-y-3">
              {(profile.saved_addresses || []).map((addr, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl"
                >
                  <span className="text-xs text-slate-700 font-semibold">{addr}</span>
                  <button
                    onClick={() => removeAddress(addr)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition-all"
                    title="Remove Address"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              {(!profile.saved_addresses || profile.saved_addresses.length === 0) && (
                <p className="text-center py-6 text-slate-400 text-xs italic">No saved addresses. Add one to quick-fill booking requests.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Security (Change password) */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-100/50 p-6">
            <h2 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
              <Key className="h-5 w-5 text-sky-500" />
              Security Settings
            </h2>
            
            {pwError && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3.5 rounded-xl flex items-start gap-2 text-xs mb-4">
                <ShieldAlert className="h-4.5 w-4.5 mt-0.5 text-rose-500 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}
            
            {pwSuccess && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-3.5 rounded-xl flex items-center gap-2 text-xs mb-4">
                <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                <span>Password changed!</span>
              </div>
            )}

            <form onSubmit={changePassword} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={pwForm.current_password}
                  onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))}
                  className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 8 characters"
                  value={pwForm.new_password}
                  onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))}
                  className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Confirm new password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                  className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={pwLoading || !pwForm.current_password || !pwForm.new_password}
                className="w-full bg-slate-850 hover:bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs transition-colors disabled:opacity-50"
              >
                {pwLoading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfilePage;
