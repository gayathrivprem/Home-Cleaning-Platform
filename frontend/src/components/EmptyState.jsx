import React from 'react';

const emptyConfigs = {
  appointments: {
    icon: "📅",
    title: "No appointments yet",
    subtitle: "Book your first cleaning and we'll take care of the rest.",
    action: { label: "Book Now", href: "/book" }
  },
  notifications: {
    icon: "🔔",
    title: "All caught up!",
    subtitle: "No notifications right now.",
    action: null
  },
  reviews: {
    icon: "⭐",
    title: "No reviews yet",
    subtitle: "Reviews from completed appointments will appear here.",
    action: null
  },
  staff: {
    icon: "👥",
    title: "No staff members",
    subtitle: "Add your first cleaner to get started.",
    action: null
  },
  schedule: {
    icon: "🎉",
    title: "No jobs scheduled",
    subtitle: "Enjoy your day off!",
    action: null
  }
};

export const EmptyState = ({ type, customMessage }) => {
  const config = emptyConfigs[type] || {
    icon: "📭", title: "Nothing here", subtitle: customMessage || "", action: null
  };
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <span className="text-5xl mb-4">{config.icon}</span>
      <h3 className="text-lg font-semibold text-slate-700">{config.title}</h3>
      <p className="text-slate-400 text-sm mt-1 max-w-xs">{config.subtitle}</p>
      {config.action && (
        <a href={config.action.href}
           className="mt-4 bg-sky-500 text-white px-5 py-2 rounded-lg
                      text-sm font-medium hover:bg-sky-600 transition-colors">
          {config.action.label}
        </a>
      )}
    </div>
  );
};
