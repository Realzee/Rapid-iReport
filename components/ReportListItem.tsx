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
    [Severity.CRITICAL]: 'bg-red-500/20 text-red-400',
    [Severity.HIGH]: 'bg-orange-500/20 text-orange-400',
    [Severity.MEDIUM]: 'bg-yellow-500/20 text-yellow-400',
    [Severity.LOW]: 'bg-green-500/20 text-green-400'
};

const severityBorderColors: Record<Severity, string> = {
    [Severity.CRITICAL]: 'border-red-500',
    [Severity.HIGH]: 'border-orange-500',
    [Severity.MEDIUM]: 'border-yellow-500',
    [Severity.LOW]: 'border-green-500'
};

const DetailItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <span className="text-xs text-gray-400 font-medium uppercase">{label}</span>
        <p className="text-sm text-white font-semibold">{value}</p>
    </div>
);

const ReportListItem: React.FC<ReportListItemProps> = ({ report, isSelected, onClick }) => {
  const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

  const borderColor = isSelected ? 'border-blue-500' : severityBorderColors[report.severity];
  const bgColor = isSelected ? 'bg-blue-500/20' : 'bg-gray-800/50';
  const hasImage = report.evidence_images && report.evidence_images.length > 0;

  return (
    <div 
        onClick={onClick}
        className={`p-4 rounded-lg cursor-pointer transition-all duration-200 border-l-4 group ${bgColor} ${borderColor} hover:bg-gray-700/50 flex flex-col space-y-3`}
    >
        {/* Header: Title/Plate and Status */}
        <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-2">
                <p className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors truncate">
                    {isVehicleReport(report) ? report.license_plate : report.title}
                </p>
                <p className="text-xs text-gray-400 font-mono">{report.ob_number}</p>
            </div>
            <div className="flex-shrink-0">
                <StatusBadge status={report.status} />
            </div>
        </div>

        {/* Detailed Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 border-t border-b border-gray-700/50 py-3">
            <div>
                <span className="text-xs text-gray-400 font-medium uppercase">Severity</span>
                <p className={`text-sm font-bold capitalize px-2 py-0.5 rounded-full inline-block ${severityStyles[report.severity]}`}>{report.severity}</p>
            </div>
            {isVehicleReport(report) ? (
                <>
                    <DetailItem label="Make" value={report.vehicle_make} />
                    <DetailItem label="Model" value={report.vehicle_model} />
                    <DetailItem label="Color" value={report.vehicle_color} />
                </>
            ) : (
                <DetailItem label="Crime Type" value={report.crime_type} />
            )}
        </div>

        {/* Description */}
        <div>
            <span className="text-xs text-gray-400 font-medium uppercase">Description</span>
            <p className="text-sm text-gray-300 pt-1 line-clamp-2">
                {report.description}
            </p>
        </div>

        {/* Evidence Image */}
        {hasImage && (
            <div className="pt-1">
                <img 
                    src={report.evidence_images![0]} 
                    alt="Evidence" 
                    className="w-full h-auto max-h-48 object-cover rounded-lg border border-gray-700"
                />
            </div>
        )}

        {/* Footer: Location and Timestamp */}
        <div className="flex justify-between items-end pt-2">
           <div className="flex-1 min-w-0 pr-2">
                <span className="text-xs text-gray-400 font-medium uppercase">Location</span>
                <p className="text-sm text-gray-300 truncate">
                    {isVehicleReport(report) ? report.last_seen_location : report.location}
                </p>
           </div>
          <p className="text-xs text-gray-500 flex-shrink-0">
              {formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}
          </p>
        </div>
    </div>
  );
};

export default ReportListItem;