import React from 'react';
import { Report, VehicleReport, CrimeReport, Severity } from '../types';
import StatusBadge from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';

interface ReportListItemProps {
  report: Report;
  isSelected: boolean;
  onClick: () => void;
}

const severityStyles: Record<Severity, string> = {
    [Severity.CRITICAL]: 'text-red-500 dark:text-red-400',
    [Severity.HIGH]: 'text-orange-500 dark:text-orange-400',
    [Severity.MEDIUM]: 'text-yellow-500 dark:text-yellow-400',
    [Severity.LOW]: 'text-green-500 dark:text-green-400'
};

const severityBorderColors: Record<Severity, string> = {
    [Severity.CRITICAL]: 'border-red-500',
    [Severity.HIGH]: 'border-orange-500',
    [Severity.MEDIUM]: 'border-yellow-500',
    [Severity.LOW]: 'border-green-500'
};

const ReportListItem: React.FC<ReportListItemProps> = ({ report, isSelected, onClick }) => {
  const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

  const borderColor = isSelected ? 'border-blue-500' : severityBorderColors[report.severity];
  const bgColor = isSelected ? 'bg-blue-500/10 dark:bg-blue-500/30' : 'bg-gray-50/50 dark:bg-gray-800/60';
  const hasImage = report.evidence_images && report.evidence_images.length > 0;

  return (
    <div 
        onClick={onClick}
        className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border-l-4 group ${bgColor} ${borderColor} hover:bg-gray-100 dark:hover:bg-gray-800 flex items-start space-x-4`}
    >
        {hasImage && (
            <div className="flex-shrink-0">
                <img 
                    src={report.evidence_images![0]} 
                    alt="Evidence" 
                    className="w-20 h-20 object-cover rounded-md border border-gray-200 dark:border-gray-700"
                />
            </div>
        )}

        <div className={`flex-1 min-w-0 ${!hasImage && 'pl-2'}`}>
            <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-base text-gray-800 dark:text-white group-hover:text-blue-500 dark:group-hover:text-blue-300 transition-colors truncate">
                        {isVehicleReport(report) ? report.license_plate : report.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{report.ob_number}</p>
                </div>
                <div className="flex-shrink-0">
                    <StatusBadge status={report.status} />
                </div>
            </div>

            <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {isVehicleReport(report) ? (
                    <p>
                        <span className={`${severityStyles[report.severity]} font-semibold capitalize`}>{report.severity}</span>
                        {' · '}
                        {report.vehicle_make} {report.vehicle_model} ({report.vehicle_color})
                    </p>
                ) : (
                     <p>
                        <span className={`${severityStyles[report.severity]} font-semibold capitalize`}>{report.severity}</span>
                        {' · '}
                        {report.crime_type}
                    </p>
                )}
            </div>
            
            <div className="flex justify-between items-end mt-2">
               <p className="text-xs text-gray-400 dark:text-gray-500 truncate pr-2">
                  {isVehicleReport(report) ? report.last_seen_location : report.location}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                  {formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}
              </p>
            </div>
        </div>
    </div>
  );
};

export default ReportListItem;