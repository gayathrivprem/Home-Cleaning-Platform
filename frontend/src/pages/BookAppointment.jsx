import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Calendar as CalendarIcon, Clock, MapPin, Clipboard, ArrowLeft, Check, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import api from '../api/axios';

const BookAppointment = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    date: '',
    time_slot: '',
    cleaning_type: 'Standard',
    address: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [availLoading, setAvailLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [availability, setAvailability] = useState({});

  // Pricing states
  const [pricing, setPricing] = useState({ services: [], addons: [] });
  const [numRooms, setNumRooms] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [quotePrice, setQuotePrice] = useState({ base: 0, addons: 0, total: 0, breakdown: [] });
  const [savedAddresses, setSavedAddresses] = useState([]);

  // Recurring states
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const [endDate, setEndDate] = useState('');

  // Calendar state
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const fetchProfile = async () => {
    try {
      const response = await api.get('/profile/');
      setSavedAddresses(response.data.saved_addresses || []);
      if (response.data.cleaning_notes) {
        setFormData(p => ({ ...p, notes: p.notes || response.data.cleaning_notes }));
      }
    } catch (err) {
      console.error("Failed to fetch profile details", err);
    }
  };

  const fetchAvailability = async () => {
    try {
      setAvailLoading(true);
      const start = new Date();
      // Fetch 90 days of availability checking
      const end = new Date();
      end.setDate(start.getDate() + 85);
      
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      
      const response = await api.get(`/availability?start=${startStr}&end=${endStr}`);
      setAvailability(response.data);
    } catch (err) {
      console.error("Failed to fetch availability", err);
      setError("Could not load real-time slot availability. Please refresh.");
    } finally {
      setAvailLoading(false);
    }
  };

  const fetchPricing = async () => {
    try {
      const response = await api.get('/pricing');
      setPricing(response.data);
    } catch (err) {
      console.error("Failed to fetch pricing config", err);
    }
  };

  useEffect(() => {
    fetchAvailability();
    fetchPricing();
    fetchProfile();
  }, []);

  // Live Quote calculation debounced
  useEffect(() => {
    const handler = setTimeout(() => {
      calculateLiveQuote();
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [formData.cleaning_type, numRooms, selectedAddons]);

  const calculateLiveQuote = async () => {
    try {
      const response = await api.post('/pricing/quote', {
        cleaning_type: formData.cleaning_type,
        num_rooms: numRooms,
        addon_ids: selectedAddons
      });
      setQuotePrice(response.data);
    } catch (err) {
      console.error("Failed to calculate quote", err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { date, time_slot, cleaning_type, address } = formData;

    if (!date) {
      setError('Please select an available date from the calendar.');
      return;
    }
    if (!time_slot) {
      setError('Please select a time slot for your chosen date.');
      return;
    }
    if (!cleaning_type || !address) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isRecurring) {
        await api.post('/recurring', {
          frequency,
          time_slot: formData.time_slot,
          cleaning_type: formData.cleaning_type,
          address: formData.address,
          num_rooms: numRooms,
          addon_ids: selectedAddons,
          start_date: formData.date,
          end_date: endDate || null
        });
      } else {
        await api.post('/appointments/', {
          ...formData,
          num_rooms: numRooms,
          addon_ids: selectedAddons
        });
      }
      setSuccess(true);
      setTimeout(() => {
        navigate(isRecurring ? '/my-recurring' : '/appointments');
      }, 3000);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((e) => e.msg).join(', '));
      } else {
        setError(detail || 'Failed to submit booking. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Calendar calculations
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const getDateStatus = (dateStr) => {
    const todayZero = new Date();
    todayZero.setHours(0, 0, 0, 0);
    const dateObj = new Date(dateStr + 'T00:00:00');

    if (dateObj < todayZero) {
      return 'past';
    }

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 85);
    maxDate.setHours(23, 59, 59, 999);
    if (dateObj > maxDate) {
      return 'out-of-range';
    }

    const daySlots = availability[dateStr];
    if (!daySlots) {
      return 'available';
    }

    const statuses = Object.values(daySlots);
    const allBlockedOrFull = statuses.every(s => s === 'blocked' || s === 'full');
    const allAvailable = statuses.every(s => s === 'available');

    if (allBlockedOrFull) return 'full';
    if (allAvailable) return 'available';
    return 'partial';
  };

  const handleDateSelect = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = getDateStatus(dateStr);

    if (status === 'past' || status === 'out-of-range' || status === 'full') {
      return;
    }

    const daySlots = availability[dateStr] || {
      "Morning 8–12": "available",
      "Afternoon 12–5": "available",
      "Evening 5–8": "available"
    };

    // Auto-select first available slot
    let selectedSlot = formData.time_slot;
    if (!selectedSlot || daySlots[selectedSlot] !== 'available') {
      const firstAvail = Object.keys(daySlots).find(slot => daySlots[slot] === 'available');
      selectedSlot = firstAvail || '';
    }

    setFormData(prev => ({
      ...prev,
      date: dateStr,
      time_slot: selectedSlot
    }));
    if (error) setError('');
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);
  const gridCells = [];

  // Pad the grid prefix
  for (let i = 0; i < firstDayIndex; i++) {
    gridCells.push(<div key={`empty-${i}`} className="p-2"></div>);
  }

  // Generate day components
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = getDateStatus(dateStr);
    const isSelected = formData.date === dateStr;

    let cellClass = "aspect-square flex flex-col items-center justify-center rounded-2xl text-sm font-semibold transition-all relative border ";
    let dotClass = "h-1.5 w-1.5 rounded-full mt-1 ";

    if (status === 'past' || status === 'out-of-range') {
      cellClass += "bg-slate-50 text-slate-300 border-transparent cursor-not-allowed";
      dotClass += "bg-slate-200";
    } else if (status === 'full') {
      cellClass += "bg-rose-50/50 text-rose-400 border-rose-100 cursor-not-allowed";
      dotClass += "bg-rose-500 animate-pulse";
    } else if (status === 'partial') {
      cellClass += "bg-amber-50/60 text-amber-800 border-amber-100 hover:bg-amber-100/60 cursor-pointer";
      dotClass += "bg-amber-500";
    } else {
      cellClass += "bg-emerald-50/60 text-emerald-800 border-emerald-100 hover:bg-emerald-100/60 cursor-pointer";
      dotClass += "bg-emerald-500";
    }

    if (isSelected) {
      cellClass = "aspect-square flex flex-col items-center justify-center rounded-2xl text-sm font-extrabold transition-all relative border-2 border-sky-500 bg-sky-500 text-white shadow-md shadow-sky-500/20 cursor-pointer";
      dotClass = "h-1.5 w-1.5 rounded-full mt-1 bg-white";
    }

    gridCells.push(
      <button
        key={`day-${day}`}
        type="button"
        disabled={status === 'past' || status === 'out-of-range' || status === 'full'}
        onClick={() => handleDateSelect(day)}
        className={cellClass}
      >
        <span>{day}</span>
        <span className={dotClass}></span>
      </button>
    );
  }

  // Selected date's slots
  const currentDaySlots = formData.date ? (availability[formData.date] || {
    "Morning 8–12": "available",
    "Afternoon 12–5": "available",
    "Evening 5–8": "available"
  }) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-slate-500 hover:text-sky-600 font-semibold text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Booking Panel */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-6 w-6 text-sky-500" />
            <h1 className="text-2xl font-bold text-slate-800">Book Cleaning Service</h1>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3.5 rounded-xl text-sm mb-6 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center py-12 space-y-4">
              <div className="bg-emerald-50 text-emerald-500 p-4 rounded-full inline-flex border border-emerald-100 animate-bounce">
                <Check className="h-10 w-10 stroke-[3]" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Booking Submitted!</h2>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                Your appointment has been booked. Estimated price: <span className="font-extrabold text-sky-600">₹{quotePrice.total.toFixed(2)}</span>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Calendar Section */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">1. Select Appointment Date</h3>
                
                {availLoading ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center animate-pulse text-slate-400">
                    Loading slots availability map...
                  </div>
                ) : (
                  <div className="bg-slate-50/50 border border-slate-200/60 rounded-3xl p-4 sm:p-6">
                    {/* Month Picker Header */}
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h4 className="font-bold text-slate-800 text-base">
                        {monthNames[currentMonth]} {currentYear}
                      </h4>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
                        >
                          <ChevronLeft className="h-4.5 w-4.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
                        >
                          <ChevronRight className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>

                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 uppercase tracking-wider mb-2">
                      <div>Sun</div>
                      <div>Mon</div>
                      <div>Tue</div>
                      <div>Wed</div>
                      <div>Thu</div>
                      <div>Fri</div>
                      <div>Sat</div>
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {gridCells}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 justify-center">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 bg-emerald-500 rounded-full"></span>
                        <span>Fully Available</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 bg-amber-500 rounded-full"></span>
                        <span>Partially Booked</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 bg-rose-500 rounded-full"></span>
                        <span>Full / Blocked</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Time Slots Section */}
              {formData.date && (
                <div className="animate-fadeIn">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">2. Select Time Slot for {formData.date}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { key: "Morning 8–12", label: "Morning", desc: "8:00 AM – 12:00 PM" },
                      { key: "Afternoon 12–5", label: "Afternoon", desc: "12:00 PM – 5:00 PM" },
                      { key: "Evening 5–8", label: "Evening", desc: "5:00 PM – 8:00 PM" }
                    ].map((slot) => {
                      const slotState = currentDaySlots ? currentDaySlots[slot.key] : "available";
                      const isSelected = formData.time_slot === slot.key;
                      const isDisabled = slotState === 'blocked' || slotState === 'full';

                      let btnClass = "border p-4 rounded-2xl flex flex-col text-left transition-all duration-200 relative cursor-pointer ";
                      if (isDisabled) {
                        btnClass += "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60";
                      } else if (isSelected) {
                        btnClass += "bg-sky-50 text-sky-800 border-sky-400 ring-2 ring-sky-400/20";
                      } else {
                        btnClass += "bg-white text-slate-700 border-slate-200 hover:bg-slate-50";
                      }

                      return (
                        <button
                          key={slot.key}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => setFormData({ ...formData, time_slot: slot.key })}
                          className={btnClass}
                        >
                          <div className="flex justify-between items-start w-full">
                            <span className="font-bold text-sm">{slot.label}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                              slotState === 'available'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : slotState === 'partial'
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : slotState === 'full'
                                ? 'bg-rose-50 text-rose-700 border-rose-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {slotState === 'available' ? 'Open' : slotState}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            {slot.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Service Detail Settings */}
              <div className="space-y-6 pt-2 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">3. Service Details</h3>
                
                {/* Cleaning Package */}
                <div>
                  <label htmlFor="cleaning_type" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Cleaning Package *
                  </label>
                  <select
                    id="cleaning_type"
                    name="cleaning_type"
                    required
                    value={formData.cleaning_type}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  >
                    <option value="Standard">Standard Clean (Light maintenance, dusting, mopping)</option>
                    <option value="Deep Clean">Deep Clean (Thorough scrubbing, appliances, vents)</option>
                    <option value="Move-In/Move-Out">Move-In / Move-Out (Empty house detailing, baseboards)</option>
                  </select>
                </div>

                {/* Number of rooms stepper */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Number of Rooms *
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setNumRooms(prev => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center font-bold text-lg hover:bg-slate-50 active:scale-95 transition-all text-slate-600 bg-white"
                    >
                      -
                    </button>
                    <span className="font-extrabold text-base text-slate-800 w-8 text-center">{numRooms}</span>
                    <button
                      type="button"
                      onClick={() => setNumRooms(prev => Math.min(10, prev + 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center font-bold text-lg hover:bg-slate-50 active:scale-95 transition-all text-slate-600 bg-white"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Addons checkbox selection */}
                {pricing.addons && pricing.addons.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Optional Add-ons
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {pricing.addons.map((addon) => {
                        const isChecked = selectedAddons.includes(addon.id);
                        return (
                          <label
                            key={addon.id}
                            className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-sky-50/50 border-sky-300 text-sky-950 font-medium'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedAddons(prev => prev.filter(id => id !== addon.id));
                                  } else {
                                    setSelectedAddons(prev => [...prev, addon.id]);
                                  }
                                }}
                                className="h-4.5 w-4.5 text-sky-500 border-slate-300 rounded focus:ring-sky-400"
                              />
                              <span className="text-sm font-semibold">{addon.name}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                              +₹{addon.price.toFixed(2)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Address */}
                <div>
                  <label htmlFor="address" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Full Service Address *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <input
                      id="address"
                      name="address"
                      type="text"
                      required
                      value={formData.address}
                      onChange={handleChange}
                      className="block w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder-slate-400"
                      placeholder="123 Main Street, Suite 4B, City"
                    />
                  </div>
                  {savedAddresses.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {savedAddresses.map(addr => (
                        <button
                          key={addr}
                          type="button"
                          onClick={() => setFormData(p => ({ ...p, address: addr }))}
                          className="text-[10px] font-bold bg-sky-50 text-sky-600 border border-sky-100 rounded-full px-2.5 py-1 hover:bg-sky-100 transition-colors"
                        >
                          {addr.length > 30 ? addr.slice(0, 30) + "…" : addr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="notes" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Special Notes or Instructions
                  </label>
                  <div className="relative">
                    <div className="absolute top-3.5 left-4 pointer-events-none text-slate-400">
                      <Clipboard className="h-5 w-5" />
                    </div>
                    <textarea
                      id="notes"
                      name="notes"
                      rows={3}
                      value={formData.notes}
                      onChange={handleChange}
                      className="block w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder-slate-400"
                      placeholder="Key is under the doormat. Beware of friendly dog. Focus on kitchen cabinets."
                    />
                  </div>
                </div>

                {/* Recurring Options */}
                <div className="border-t border-slate-100 pt-5 mt-5">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="h-5 w-5 text-sky-500 border-slate-300 rounded focus:ring-sky-400 cursor-pointer"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-slate-800">Make this cleaning recurring?</span>
                      <span className="block text-[11px] text-slate-400 leading-normal">Schedule automatically and get pre-generated appointments.</span>
                    </div>
                  </label>

                  {isRecurring && (
                    <div className="mt-4 p-4 bg-sky-50/30 border border-sky-100 rounded-2xl space-y-4 animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="frequency" className="block text-xs font-bold text-sky-900 uppercase tracking-wider mb-1.5">
                            Frequency *
                          </label>
                          <select
                            id="frequency"
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value)}
                            className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-semibold"
                          >
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Biweekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="endDate" className="block text-xs font-bold text-sky-900 uppercase tracking-wider mb-1.5">
                            Repeat until (optional)
                          </label>
                          <input
                            id="endDate"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={formData.date || today.toISOString().split('T')[0]}
                            className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                          />
                        </div>
                      </div>
                      <p className="text-[10.5px] text-sky-700 leading-normal">
                        ℹ️ We'll automatically schedule your next cleaning and notify you before each visit. You can pause or cancel the series anytime from your Recurring Plans dashboard.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sky-500 hover:bg-sky-600 active:scale-[0.99] text-white font-bold py-4 px-4 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-sky-500/10 disabled:opacity-50 disabled:scale-100"
                >
                  {loading ? 'Submitting Booking...' : 'Request Cleaning Appointment'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Info Column */}
        <div className="space-y-6">
          {/* Real-time Live Price Estimate Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-base border-b border-slate-200 pb-2">Price Estimate</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>{formData.cleaning_type} Clean ({numRooms} room{numRooms > 1 ? 's' : ''})</span>
                <span className="font-semibold text-slate-800">₹{quotePrice.base.toFixed(2)}</span>
              </div>
              {quotePrice.breakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs text-slate-500 pl-3">
                  <span>+ {item.name}</span>
                  <span>₹{item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 pt-3 flex justify-between font-extrabold text-slate-800 text-base">
              <span>Total</span>
              <span className="text-sky-600">₹{quotePrice.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
            <h3 className="font-bold text-slate-800 text-base mb-4">Our Packages</h3>
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="font-bold text-sm text-sky-600 font-sans">Standard Clean</p>
                <p className="text-xs text-slate-500 mt-1">
                  Perfect for regular home upkeep. Covers sweeping, mopping, dusting surfaces, kitchen counters, and basic bathroom sanitization.
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="font-bold text-sm text-purple-600 font-sans">Deep Clean</p>
                <p className="text-xs text-slate-500 mt-1">
                  Detailed scrub down. Includes inside microwave, grout scrubbing, window sills, details, and thorough sanitization of all surfaces.
                </p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="font-bold text-sm text-indigo-600 font-sans">Move-In/Move-Out</p>
                <p className="text-xs text-slate-500 mt-1">
                  Designed for empty homes. In-depth detailing of baseboards, inside cabinets/drawers, refrigerator interior, oven, and light fixtures.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-sky-50/50 border border-sky-100/50 rounded-3xl p-6">
            <h3 className="font-bold text-sky-900 text-sm flex items-center gap-1.5 mb-2">
              <CalendarIcon className="h-4.5 w-4.5 text-sky-600" />
              Smart AI Scheduling
            </h3>
            <p className="text-xs text-sky-700 leading-relaxed">
              Prefer to book naturally? Simply open the **CleanPro AI Chat assistant** at the bottom-right and say:
              <br />
              <span className="italic block mt-1.5 font-semibold text-sky-800 bg-sky-100/50 px-2 py-1 rounded">
                "I want to book a deep clean on June 25th in the afternoon."
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookAppointment;
