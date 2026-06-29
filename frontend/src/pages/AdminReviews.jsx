import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Filter, ArrowUpDown, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import api from '../api/axios';

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    average_rating: 0.0,
    total_reviews: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter & Sort state
  const [filterRating, setFilterRating] = useState('All'); // 'All' or number
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'highest' | 'lowest'

  const fetchStats = async () => {
    try {
      const statsRes = await api.get('/admin/reviews/stats');
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError('');
      const ratingParam = filterRating === 'All' ? '' : `?rating=${filterRating}`;
      const reviewsRes = await api.get(`/admin/reviews${ratingParam}`);
      setReviews(reviewsRes.data);
    } catch (err) {
      setError('Could not retrieve reviews.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewsAndStats = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchReviews()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [filterRating]);

  // Sort logic client side
  const sortedReviews = [...reviews].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.created_at) - new Date(a.created_at);
    } else if (sortBy === 'highest') {
      return b.rating - a.rating;
    } else if (sortBy === 'lowest') {
      return a.rating - b.rating;
    }
    return 0;
  });

  // Calculate percentage helper
  const getPercentage = (count) => {
    if (stats.total_reviews === 0) return 0;
    return (count / stats.total_reviews) * 100;
  };

  // Convert date helper
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
            <MessageSquare className="h-8 w-8 text-sky-500" />
            Customer Feedback & Reviews
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Browse service ratings, evaluate comments, and inspect operations feedback.
          </p>
        </div>
        <button
          onClick={fetchReviewsAndStats}
          className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-5 py-4 rounded-2xl flex items-start gap-3 text-sm mb-8 shadow-sm">
          <ShieldAlert className="h-5.5 w-5.5 mt-0.5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Section Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Average Rating box */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Average Rating</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold text-slate-800">{stats.average_rating.toFixed(1)}</span>
            <span className="text-lg font-bold text-slate-400">/5</span>
          </div>
          <div className="flex gap-1 mt-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-5 w-5 ${
                  star <= Math.round(stats.average_rating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Total Reviews Box */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Reviews</p>
          <span className="text-4xl font-extrabold text-slate-800">{stats.total_reviews}</span>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            All submitted client rating scores from completed cleanings.
          </p>
        </div>

        {/* Rating Distribution Box */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm flex flex-col justify-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-1">Rating Distribution</p>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = stats.distribution[rating] || 0;
              const percent = getPercentage(count);
              return (
                <div key={rating} className="flex items-center gap-3 text-xs text-slate-600">
                  <span className="font-bold w-4">{rating}★</span>
                  <div className="flex-grow h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                  <span className="font-semibold text-slate-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Control Panel: Filters and Sorting */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Rating Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            Filter by:
          </span>
          {['All', 5, 4, 3, 2, 1].map((r) => (
            <button
              key={r}
              onClick={() => setFilterRating(r)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                filterRating === r
                  ? 'bg-sky-50 text-sky-600 border-sky-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {r === 'All' ? 'All ratings' : `${r} ★`}
            </button>
          ))}
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            Sort:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl text-xs py-2 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-700 font-semibold"
          >
            <option value="newest">Newest first</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
        </div>

      </div>

      {/* Review Cards Grid */}
      {loading && sortedReviews.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm animate-pulse text-slate-500">
          Syncing review list...
        </div>
      ) : sortedReviews.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center shadow-sm max-w-md mx-auto">
          <p className="font-semibold text-slate-800 text-base">No Reviews Found</p>
          <p className="text-xs text-slate-500 mt-2">
            We couldn't find any reviews matching your rating query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
          {sortedReviews.map((review) => (
            <div key={review.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                {/* Header info */}
                <div className="flex justify-between items-start mb-3.5">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm leading-snug">{review.customer_name}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      {review.service_type} • {formatFriendlyDate(review.appointment_date)}
                    </p>
                  </div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3.5 w-3.5 ${
                          star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Comment */}
                {review.comment ? (
                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100/50 p-3 rounded-xl italic leading-relaxed">
                    "{review.comment}"
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No comment provided</p>
                )}
              </div>
              
              <div className="text-[10px] text-slate-400 mt-4 border-t border-slate-50 pt-3 flex justify-between">
                <span>Ref: Booking #{review.appointment_id}</span>
                <span>Posted: {new Date(review.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
    </div>
  );
};

export default AdminReviews;
