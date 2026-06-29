import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { ScheduleSkeleton } from '../components/Skeletons';

const StaffSchedule = () => {
  const name = localStorage.getItem('name');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState(null);
  const [notes, setNotes] = useState({});   // { [appt_id]: string }
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/staff/my-schedule");
      setJobs(res.data);
      // Pre-fill notes from existing completion notes
      const notesMap = {};
      res.data.forEach(j => {
        if (j.completion_notes) notesMap[j.id] = j.completion_notes;
      });
      setNotes(notesMap);
    } catch (err) {
      toast.error("Failed to load schedule");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const completeJob = async (id) => {
    setCompletingId(id);
    try {
      await api.patch(`/staff/my-schedule/${id}/complete`,
        { notes: notes[id] || null });
      toast.success("Job marked complete!");
      await load();
    } catch (err) {
      toast.error("Failed to complete job");
    } finally {
      setCompletingId(null);
    }
  };

  const saveNotes = async (id) => {
    try {
      await api.patch(`/staff/my-schedule/${id}/notes`,
        { notes: notes[id] || "" });
      toast.success("Notes saved");
    } catch (err) {
      toast.error("Failed to save notes");
    }
  };

  const todayJobs = jobs.filter(j => j.is_today);
  const tomorrowJobs = jobs.filter(j => j.is_tomorrow);
  const upcomingJobs = jobs.filter(j => !j.is_today && !j.is_tomorrow);

  const slotOrder = { Morning: 0, Afternoon: 1, Evening: 2 };
  const sortJobs = arr => [...arr].sort(
    (a, b) => slotOrder[a.time_slot] - slotOrder[b.time_slot]);

  const statusColors = {
    Pending:   "bg-yellow-100 text-yellow-700",
    Confirmed: "bg-green-100 text-green-700",
    Completed: "bg-blue-100 text-blue-700",
  };

  const slotIcons = { Morning: "🌅", Afternoon: "☀️", Evening: "🌙" };

  const JobCard = ({ job }) => {
    const isExpanded = expandedId === job.id;
    return (
      <div className={`border rounded-xl overflow-hidden transition-all ${
        job.status === "Completed"
          ? "border-slate-200 opacity-70"
          : "border-slate-200 hover:border-sky-200"
      }`}>
        {/* Card header */}
        <div className="p-4 bg-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{slotIcons[job.time_slot] || "🧹"}</span>
              <div>
                <p className="font-semibold text-slate-800">
                  {job.cleaning_type}
                </p>
                <p className="text-sm text-slate-500">
                  {job.time_slot} · {job.num_rooms} room{job.num_rooms > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium
                             ${statusColors[job.status] || "bg-slate-100 text-slate-700"}`}>
              {job.status}
            </span>
          </div>

          <div className="mt-3 space-y-1">
            <p className="text-sm text-slate-600">
              📍 {job.address}
            </p>
            <p className="text-sm text-slate-500">
              👤 {job.customer_first_name}
            </p>
            {job.notes && (
              <p className="text-sm text-amber-700 bg-amber-50
                            rounded-lg px-2 py-1 mt-2">
                📋 Customer note: {job.notes}
              </p>
            )}
          </div>

          {job.status !== "Completed" && (
            <button
              onClick={() => setExpandedId(isExpanded ? null : job.id)}
              className="mt-3 text-sm text-sky-500 hover:underline">
              {isExpanded ? "Hide details ▲" : "Add notes & complete ▼"}
            </button>
          )}

          {job.status === "Completed" && job.completion_notes && (
            <p className="mt-2 text-sm text-slate-500 italic">
              ✓ Note: {job.completion_notes}
            </p>
          )}
        </div>

        {/* Expanded panel */}
        {isExpanded && job.status !== "Completed" && (
          <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-600">
                Completion Notes (optional)
              </label>
              <textarea
                value={notes[job.id] || ""}
                onChange={e => setNotes(n => ({...n, [job.id]: e.target.value}))}
                placeholder="e.g. Focused on bathroom, moved furniture..."
                rows={3}
                className="w-full mt-1 border border-slate-200 rounded-lg
                           px-3 py-2 text-sm outline-none focus:border-sky-400
                           resize-none bg-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => completeJob(job.id)}
                disabled={completingId === job.id}
                className="flex-1 bg-green-500 text-white py-2 rounded-lg
                           text-sm font-medium hover:bg-green-600
                           disabled:opacity-50">
                {completingId === job.id ? "Completing..." : "✓ Mark Complete"}
              </button>
              <button
                onClick={() => saveNotes(job.id)}
                className="px-4 py-2 border border-slate-200 rounded-lg
                           text-sm text-slate-600 hover:bg-slate-100">
                Save Notes
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const Section = ({ title, jobs: sectionJobs, highlight }) => {
    if (sectionJobs.length === 0) return null;
    return (
      <div>
        <div className={`flex items-center gap-2 mb-3 ${
          highlight ? "text-sky-700" : "text-slate-600"
        }`}>
          <h2 className="font-semibold">{title}</h2>
          <span className="text-xs bg-slate-100 text-slate-500
                           px-2 py-0.5 rounded-full">
            {sectionJobs.length} job{sectionJobs.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="space-y-3">
          {sortJobs(sectionJobs).map(j => <JobCard key={j.id} job={j} />)}
        </div>
      </div>
    );
  };

  if (loading) return <ScheduleSkeleton />;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-slate-800">My Schedule (Welcome, {name})</h1>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long", year: "numeric",
              month: "long", day: "numeric"
            })}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Today highlight */}
        {todayJobs.length > 0 && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
            <p className="text-sky-700 font-semibold text-sm mb-3">
              Today — {todayJobs.length} job{todayJobs.length > 1 ? "s" : ""}
            </p>
            <div className="space-y-3">
              {sortJobs(todayJobs).map(j => <JobCard key={j.id} job={j} />)}
            </div>
          </div>
        )}

        <Section title="Tomorrow" jobs={tomorrowJobs} />
        <Section title="Upcoming" jobs={upcomingJobs} />

        {jobs.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-slate-600 font-medium">No jobs scheduled</p>
            <p className="text-slate-400 text-sm mt-1">
              Enjoy your day off!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffSchedule;
