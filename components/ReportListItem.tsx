import React from 'react';
import { Report, VehicleReport, CrimeReport, Severity } from '../types';
import StatusBadge from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';

interface ReportListItemProps {
  report: Report;
  isSelected: boolean;
  onClick: () => void;
}

const severityColors: Record<Severity, string> = {
    [Severity.CRITICAL]: 'border-red-500',
    [Severity.HIGH]: 'border-orange-500',
    [Severity.MEDIUM]: 'border-yellow-500',
    [Severity.LOW]: 'border-green-500'
};

const ReportListItem: React.FC<ReportListItemProps> = ({ report, isSelected, onClick }) => {
  const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

  const borderColor = isSelected ? 'border-blue-500' : severityColors[report.severity];
  const bgColor = isSelected ? 'bg-blue-500/20' : 'bg-gray-800/50';

  return (
    <div 
        onClick={onClick}
        className={`p-3.5 rounded-lg cursor-pointer transition-all duration-200 border-l-4 group ${bgColor} ${borderColor} hover:bg-gray-700/50`}
    >
      <div className="flex justify-between items-start">
        <div>
            <p className="font-semibold text-white group-hover:text-blue-300 transition-colors">
                {isVehicleReport(report) ? report.license_plate : report.title}
            </p>
            <p className="text-sm text-gray-400 font-mono">{report.ob_number}</p>
        </div>
        <StatusBadge status={report.status} />
      </div>
      <div className="flex justify-between items-end mt-2">
         <p className="text-xs text-gray-500">
            {isVehicleReport(report) ? report.last_seen_location : report.location}
        </p>
        <p className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
};

export default ReportListItem;
