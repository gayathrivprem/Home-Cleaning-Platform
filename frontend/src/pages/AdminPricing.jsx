import React, { useState, useEffect } from 'react';
import { IndianRupee, ShieldAlert, Sparkles, Plus, ToggleLeft, ToggleRight, Check, Save, Edit, RefreshCw } from 'lucide-react';
import api from '../api/axios';

const AdminPricing = () => {
  const [pricing, setPricing] = useState({ services: [], addons: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Service editing states
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceForm, setServiceForm] = useState({ base_price: '', price_per_room: '', description: '' });

  // Addon editing states
  const [newAddon, setNewAddon] = useState({ name: '', price: '' });
  const [addonSubmitting, setAddonSubmitting] = useState(false);

  const fetchPricing = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/pricing');
      setPricing(response.data);
    } catch (err) {
      setError('Could not retrieve pricing configuration.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, []);

  const handleEditServiceClick = (service) => {
    setEditingServiceId(service.id);
    setServiceForm({
      base_price: service.base_price,
      price_per_room: service.price_per_room,
      description: service.description || ''
    });
  };

  const handleSaveService = async (id) => {
    try {
      setError('');
      const response = await api.patch(`/admin/pricing/${id}`, {
        base_price: parseFloat(serviceForm.base_price),
        price_per_room: parseFloat(serviceForm.price_per_room),
        description: serviceForm.description
      });
      
      setSuccessMsg('Service package pricing updated successfully!');
      setEditingServiceId(null);
      fetchPricing();
      
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update service pricing.');
    }
  };

  const handleToggleAddon = async (addon) => {
    try {
      setError('');
      await api.patch(`/admin/pricing/addons/${addon.id}`, {
        is_active: !addon.is_active,
        price: addon.price
      });
      fetchPricing();
    } catch (err) {
      setError('Failed to toggle add-on status.');
    }
  };

  const handleUpdateAddonPrice = async (addon, newPrice) => {
    if (isNaN(newPrice) || newPrice < 0) return;
    try {
      setError('');
      await api.patch(`/admin/pricing/addons/${addon.id}`, {
        is_active: addon.is_active,
        price: parseFloat(newPrice)
      });
      fetchPricing();
    } catch (err) {
      setError('Failed to update add-on price.');
    }
  };

  const handleAddAddon = async (e) => {
    e.preventDefault();
    if (!newAddon.name || !newAddon.price || isNaN(newAddon.price)) {
      setError('Please provide a valid name and price for the new add-on.');
      return;
    }
    
    setAddonSubmitting(true);
    setError('');
    try {
      await api.post('/admin/pricing/addons', {
        name: newAddon.name,
        price: parseFloat(newAddon.price)
      });
      setNewAddon({ name: '', price: '' });
      setSuccessMsg('New add-on added successfully!');
      fetchPricing();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add new add-on.');
    } finally {
      setAddonSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
            <IndianRupee className="h-8 w-8 text-sky-500" />
            Pricing Configurations
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage packages base rates, extra room surcharges, and optional add-on configurations.
          </p>
        </div>
        <button
          onClick={fetchPricing}
          className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-5 py-4 rounded-2xl flex items-start gap-3 text-sm mb-6">
          <ShieldAlert className="h-5.5 w-5.5 mt-0.5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-5 py-4 rounded-2xl flex items-center gap-3 text-sm mb-6 animate-fadeIn">
          <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Note Warning banner */}
      <div className="bg-sky-50 border border-sky-100 text-sky-800 p-4 rounded-2xl mb-8 flex items-start gap-3 text-xs">
        <InfoIcon className="h-5 w-5 text-sky-500 shrink-0" />
        <div>
          <span className="font-bold uppercase tracking-wider block mb-0.5 text-sky-900">Price Lock Notice</span>
          Existing bookings retain their quoted price locked at their time of creation. Modifications below will only affect new customer scheduling requests.
        </div>
      </div>

      {loading && pricing.services.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm animate-pulse text-slate-500">
          Loading pricing parameters...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Service Pricing Manager */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 sm:p-8">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-sky-500" />
                Service Packages Pricing
              </h2>
              
              <div className="space-y-6">
                {pricing.services.map((service) => {
                  const isEditing = editingServiceId === service.id;
                  
                  return (
                    <div
                      key={service.id}
                      className={`border rounded-2xl p-5 transition-all ${
                        isEditing ? 'border-sky-300 bg-sky-50/10 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-slate-800 text-base">{service.cleaning_type}</h3>
                          {!isEditing && (
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{service.description || 'No description provided'}</p>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveService(service.id)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-xl flex items-center justify-center transition-colors active:scale-95"
                              title="Save Changes"
                            >
                              <Save className="h-4.5 w-4.5" />
                            </button>
                            <button
                              onClick={() => setEditingServiceId(null)}
                              className="border border-slate-200 hover:bg-slate-50 text-slate-500 p-2 rounded-xl flex items-center justify-center transition-colors text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditServiceClick(service)}
                            className="text-slate-400 hover:text-sky-500 p-2 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all"
                            title="Edit Package"
                          >
                            <Edit className="h-4.5 w-4.5" />
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-4 animate-fadeIn">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Base Price (₹)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={serviceForm.base_price}
                                onChange={(e) => setServiceForm({ ...serviceForm, base_price: e.target.value })}
                                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Per Room Surcharge (₹)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={serviceForm.price_per_room}
                                onChange={(e) => setServiceForm({ ...serviceForm, price_per_room: e.target.value })}
                                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Package Description</label>
                            <textarea
                              rows={2}
                              value={serviceForm.description}
                              onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-6 mt-2 pt-2.5 border-t border-slate-50 text-xs text-slate-600">
                          <div>
                            <span className="font-medium text-slate-400">Base Price: </span>
                            <span className="font-extrabold text-slate-800 text-sm">₹{service.base_price.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-400">Per Room Add: </span>
                            <span className="font-extrabold text-slate-800 text-sm">₹{service.price_per_room.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Add-ons Manager */}
          <div className="space-y-6">
            
            {/* Add Addon Form */}
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-1.5">
                <Plus className="h-5 w-5 text-sky-500" />
                Add New Add-on
              </h2>
              <form onSubmit={handleAddAddon} className="space-y-3.5">
                <div>
                  <input
                    type="text"
                    value={newAddon.name}
                    onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })}
                    placeholder="Add-on Name (e.g. Inside Fridge)"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    step="0.01"
                    value={newAddon.price}
                    onChange={(e) => setNewAddon({ ...newAddon, price: e.target.value })}
                    placeholder="Surcharge Price (₹)"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-slate-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addonSubmitting}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 rounded-xl text-xs transition-colors disabled:opacity-50"
                >
                  {addonSubmitting ? 'Adding...' : 'Create Addon'}
                </button>
              </form>
            </div>

            {/* Addon List */}
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
              <h2 className="text-base font-bold text-slate-800 mb-4">Add-ons List</h2>
              
              <div className="space-y-3">
                {pricing.addons.map((addon) => (
                  <div
                    key={addon.id}
                    className={`flex items-center justify-between p-3 border rounded-2xl transition-all ${
                      addon.is_active ? 'border-slate-100 bg-slate-50/20' : 'border-slate-100 bg-slate-50/60 opacity-60'
                    }`}
                  >
                    <div className="flex-grow">
                      <p className="text-xs font-bold text-slate-700 leading-tight">{addon.name}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">Price: ₹</span>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={addon.price}
                          onBlur={(e) => handleUpdateAddonPrice(addon, e.target.value)}
                          className="w-16 border-b border-transparent hover:border-slate-200 focus:border-sky-500 focus:outline-none text-xs font-semibold text-slate-600 bg-transparent py-0.5"
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleToggleAddon(addon)}
                      className={`p-1 rounded-xl transition-all ${
                        addon.is_active ? 'text-emerald-500' : 'text-slate-300'
                      }`}
                    >
                      {addon.is_active ? (
                        <ToggleRight className="h-8 w-8 stroke-[1.5]" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 stroke-[1.5]" />
                      )}
                    </button>
                  </div>
                ))}
                
                {pricing.addons.length === 0 && (
                  <p className="text-center py-6 text-slate-400 text-xs italic">No add-ons created yet.</p>
                )}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};

// Lucide Info icon helper
const InfoIcon = (props) => (
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
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export default AdminPricing;
