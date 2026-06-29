import React from 'react';

const Pulse = ({ className }) => (
  <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />
);

export const AppointmentCardSkeleton = () => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
    <div className="flex justify-between">
      <Pulse className="h-4 w-32" />
      <Pulse className="h-5 w-20 rounded-full" />
    </div>
    <Pulse className="h-3 w-48" />
    <Pulse className="h-3 w-36" />
    <Pulse className="h-3 w-24" />
  </div>
);

export const StatCardSkeleton = () => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
    <Pulse className="h-3 w-24" />
    <Pulse className="h-8 w-16" />
  </div>
);

export const ScheduleSkeleton = () => (
  <div className="p-4 max-w-lg mx-auto space-y-4">
    <Pulse className="h-6 w-40 mb-6" />
    {[1,2,3].map(i => (
      <div key={i} className="bg-white border border-slate-200
                               rounded-xl p-4 space-y-3">
        <div className="flex justify-between">
          <Pulse className="h-5 w-32" />
          <Pulse className="h-5 w-20 rounded-full" />
        </div>
        <Pulse className="h-4 w-full" />
        <Pulse className="h-4 w-3/4" />
      </div>
    ))}
  </div>
);

export const TableRowSkeleton = ({ cols = 5 }) => (
  <tr>
    {Array(cols).fill(0).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Pulse className="h-4 w-full" />
      </td>
    ))}
  </tr>
);
