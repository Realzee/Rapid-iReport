import React from 'react';
import { ReportStatus } from '../types';

interface StatusBadgeProps {
  status: ReportStatus;
}

const statusStyles: Record<ReportStatus, string> = {
  [ReportStatus.PENDING]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  [ReportStatus.ACTIVE]: 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse',
  [ReportStatus.IN_PROGRESS]: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  [ReportStatus.RESOLVED]: 'bg-green-500/20 text-green-400 border-green-500/30',
  [ReportStatus.REJECTED]: 'bg-red-500/20 text-red-400 border-red-500/30',
  [ReportStatus.RECOVERED]: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  // FIX: Added missing status styles for 'assigned', 'on_scene', and 'closed' to match the ReportStatus enum.
  [ReportStatus.ASSIGNED]: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  [ReportStatus.ON_SCENE]: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  [ReportStatus.CLOSED]: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span
      className={`inline-block px-3 py-1 text-xs font-bold rounded-full capitalize border ${statusStyles[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
};

export default StatusBadge;
