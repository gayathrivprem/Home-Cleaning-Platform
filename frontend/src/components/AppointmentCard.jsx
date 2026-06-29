import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Sparkles, FileText, AlertCircle, Info, Star, User } from 'lucide-react';
import api from '../api/axios';

const AppointmentCard = ({ appointment, onCancel, showCustomerInfo = false, onReviewSubmitted }) => {
  const { id, date, time_slot, cleaning_type, address, notes, status, customer, num_rooms, selected_addons, quoted_price, review, assigned_staff, is_recurring_instance } = appointment;

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const getStatusStyle = (status) => {
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

  const getCleaningTypeBadgeColor = (type) => {
    switch (type) {
      case 'Deep Clean':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Move-In/Move-Out':
      case 'Move-In/Out':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-sky-50 text-sky-700 border-sky-200';
    }
  };

  // Convert date format for friendly reading (e.g., June 19, 2026)
  const formatFriendlyDate = (dateStr) => {
    try {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      const parsedDate = new Date(dateStr);
      // Check for valid date
      if (isNaN(parsedDate.getTime())) return dateStr;
      return parsedDate.toLocaleDateString(undefined, options);
    } catch {
      return dateStr;
    }
  };

  const isCancellable = (status) => {
    return status === 'Pending' || status === 'Confirmed';
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    setReviewError('');
    try {
      await api.post('/reviews', {
        appointment_id: id,
        rating,
        comment
      });
      setShowReviewForm(false);
      setComment('');
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setReviewError(detail || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 p-6 flex flex-col justify-between">
      <div>
        {/* Header with status and type */}
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getCleaningTypeBadgeColor(cleaning_type)}`}>
              {cleaning_type}
            </span>
            {is_recurring_instance && (
              <Link
                to="/my-recurring"
                className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 border border-sky-100 text-sky-600 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all"
                title="View recurring series"
              >
                <span>🔄 Recurring</span>
              </Link>
            )}
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusStyle(status)}`}>
            {status}
          </span>
        </div>

        {/* Date and Time */}
        <div className="space-y-3 text-slate-600">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-medium">{formatFriendlyDate(date)}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-medium">{time_slot}</span>
          </div>
          <div className="flex items-start gap-2.5">
            <MapPin className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
            <span className="text-sm leading-relaxed">{address}</span>
          </div>
          
          {assigned_staff && (
            <div className="flex items-center gap-2.5">
              <User className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-medium">Cleaner: <span className="text-slate-800 font-semibold">{assigned_staff.name}</span></span>
            </div>
          )}
          
          {quoted_price !== undefined && quoted_price !== null && (
            <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 text-slate-600 text-xs">
              <span className="font-semibold text-slate-700">Price:</span>
              <span className="font-bold text-sky-600">Est. ₹{quoted_price.toFixed(2)}</span>
              <div className="relative group cursor-pointer text-slate-400 hover:text-sky-500">
                <Info className="h-3.5 w-3.5" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-44 bg-slate-800 text-white text-[10px] p-2 rounded-xl shadow-lg z-50 text-center pointer-events-none">
                  Price quoted at time of booking
                </div>
              </div>
            </div>
          )}

          {notes && (
            <div className="flex items-start gap-2.5 mt-2 pt-2.5 border-t border-slate-50">
              <FileText className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-500 italic leading-relaxed">{notes}</p>
            </div>
          )}
        </div>

        {/* Optional Customer Info (e.g. for Admin or general debugging) */}
        {showCustomerInfo && customer && (
          <div className="mt-4 pt-3 border-t border-slate-100 bg-slate-50/50 rounded-xl p-3 text-xs space-y-1">
            <p className="font-semibold text-slate-700">Customer details:</p>
            <p className="text-slate-600"><span className="font-medium text-slate-500">Name:</span> {customer.name}</p>
            <p className="text-slate-600"><span className="font-medium text-slate-500">Email:</span> {customer.email}</p>
            <p className="text-slate-600"><span className="font-medium text-slate-500">Phone:</span> {customer.phone}</p>
          </div>
        )}
      </div>

      {/* Review & Ratings Section for Completed Status */}
      {status === 'Completed' && (
        <div className="mt-6 pt-4 border-t border-slate-100">
          {review ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">Your Feedback</span>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold">
                  ✓ Reviewed
                </span>
              </div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4.5 w-4.5 ${
                      star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                    }`}
                  />
                ))}
              </div>
              {review.comment && (
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl italic border border-slate-100/50 leading-relaxed">
                  "{review.comment}"
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {!showReviewForm ? (
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="w-full text-center border border-sky-200 bg-sky-50/50 hover:bg-sky-50 text-sky-600 text-xs font-bold py-2.5 rounded-xl transition-all"
                >
                  Leave a Review
                </button>
              ) : (
                <form onSubmit={handleReviewSubmit} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">Rate service:</span>
                    <button
                      type="button"
                      onClick={() => setShowReviewForm(false)}
                      className="text-xs font-medium text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="focus:outline-none transition-transform active:scale-90"
                      >
                        <Star
                          className={`h-6 w-6 transition-colors ${
                            star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Write a comment... (optional, max 500 chars)"
                    maxLength={500}
                    rows={2}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-slate-50"
                  />

                  {reviewError && (
                    <p className="text-[10px] font-semibold text-rose-500">{reviewError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full bg-sky-500 hover:bg-sky-600 active:scale-[0.98] text-white text-xs font-bold py-2 rounded-xl transition-all disabled:opacity-50"
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action button (Cancel) */}
      {onCancel && isCancellable(status) && (
        <div className="mt-6 pt-4 border-t border-slate-50">
          <button
            onClick={() => onCancel(id)}
            className="w-full text-center border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-600 hover:text-red-600 text-xs font-semibold py-2.5 rounded-xl transition-all duration-200"
          >
            Cancel Appointment
          </button>
        </div>
      )}
    </div>
  );
};

export default AppointmentCard;
