import React from 'react';
import { ReportStatus } from '../types';

interface StatusBadgeProps {
  status: ReportStatus;
}

const statusStyles: Record<ReportStatus, string> = {
  [ReportStatus.PENDING]: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30',
  [ReportStatus.ACTIVE]: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 animate-pulse',
  [ReportStatus.IN_PROGRESS]: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30',
  [ReportStatus.RESOLVED]: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
  [ReportStatus.REJECTED]: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
  [ReportStatus.RECOVERED]: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/20 dark:text-teal-400 dark:border-teal-500/30',
  [ReportStatus.ASSIGNED]: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30',
  [ReportStatus.ON_SCENE]: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30',
  [ReportStatus.CLOSED]: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30',
  [ReportStatus.DELETED]: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30',
  [ReportStatus.STOLEN]: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 font-bold',
  [ReportStatus.SUSPICIOUS]: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
  [ReportStatus.BOLO]: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/20 dark:text-pink-400 dark:border-pink-500/30',
  [ReportStatus.SOUGHT]: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-500/20 dark:text-fuchsia-400 dark:border-fuchsia-500/30',
  [ReportStatus.HIJACKED]: 'bg-red-200 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800/40 font-bold',
  [ReportStatus.USED_IN_COMMISSION_OF_CRIME]: 'bg-purple-200 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/40',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${statusStyles[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === ReportStatus.ACTIVE ? 'bg-current animate-ping' : 'bg-current'}`}></span>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

export default StatusBadge;