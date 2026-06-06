import React, { useState, useMemo, memo } from 'react';
import { Report, VehicleReport, Severity, Profile, UserRole, ReportStatus } from '../types';
import StatusBadge from './StatusBadge';
import ReportTypeBadge from './ReportTypeBadge';
import { formatDistanceToNow } from 'date-fns';
import { CarIcon, AlertTriangleIcon, CrimeIcon, GlobeIcon, UsersIcon } from './icons';

interface ReportListItemProps {
  report: Report;
  isSelected: boolean;
  onClick: () => void;
  profile: Profile;
  reporterName: string;
  onStatusUpdate: (reportId: string, newStatus: ReportStatus, reportType: 'vehicle' | 'crime' | 'emergency') => Promise<void>;
  companyLogoUrl?: string;
  showCheckbox?: boolean;
  checked?: boolean;
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

const ReportListItem: React.FC<ReportListItemProps> = ({ report, isSelected, onClick, profile, reporterName, onStatusUpdate, companyLogoUrl, showCheckbox, checked }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const canUpdateStatus = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER].includes(profile.role) || 
                          (profile.role === UserRole.RESPONDER && report.assigned_to === profile.id);

  const isTerminalStatus = useMemo(() => {
    return [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED, ReportStatus.REJECTED].includes(report.status);
  }, [report.status]);
  
  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as ReportStatus;
    setIsUpdating(true);
    await onStatusUpdate(report.id, newStatus, report.type as 'vehicle' | 'crime' | 'emergency');
    setIsUpdating(false);
  };
  
  const statusOptions = Object.values(ReportStatus).filter(
    status => !(report.type !== 'vehicle' && status === ReportStatus.RECOVERED)
  );

  const borderColor = isSelected ? 'border-blue-500' : (isTerminalStatus ? 'border-gray-300 dark:border-gray-700' : severityBorderColors[report.severity]);
  const bgColor = isSelected ? 'bg-blue-500/10 dark:bg-blue-500/30' : (isTerminalStatus ? 'bg-gray-200/50 dark:bg-gray-900/50' : 'bg-gray-50/50 dark:bg-gray-800/60');
  const textColor = isTerminalStatus ? 'text-gray-500 dark:text-gray-500' : 'text-gray-800 dark:text-white';
  const hasImage = report.evidence_images && report.evidence_images.length > 0;

  return (
    <div 
        onClick={onClick}
        className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border-l-4 group ${bgColor} ${borderColor} hover:bg-gray-100 dark:hover:bg-gray-800 flex items-start space-x-4 ${isTerminalStatus ? 'opacity-70' : ''}`}
    >
        {showCheckbox && (
            <div className="flex-shrink-0 self-center pr-1" onClick={(e) => e.stopPropagation()}>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onClick}
                    className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
            </div>
        )}
        {hasImage && (
            <div className="flex-shrink-0">
                <img 
                    src={report.evidence_images![0]} 
                    alt="Evidence" 
                    className={`w-20 h-20 object-cover rounded-md border border-gray-200 dark:border-gray-700 ${isTerminalStatus ? 'grayscale' : ''}`}
                />
            </div>
        )}

        <div className={`flex-1 min-w-0 ${!hasImage && 'pl-2'}`}>
            <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-2 flex items-center gap-3">
                    {companyLogoUrl && (
                        <img 
                            src={companyLogoUrl} 
                            alt="Company Logo" 
                            className="w-12 h-12 rounded-full object-contain flex-shrink-0 bg-gray-200 dark:bg-gray-700"
                        />
                    )}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                        <ReportTypeBadge type={report.type as any} showText={false} className="p-1.5" />
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <p className={`font-bold text-base ${textColor} group-hover:text-blue-500 dark:group-hover:text-blue-300 transition-colors truncate`}>
                                    {report.type === 'vehicle' ? (report as any).license_plate : report.title}
                                </p>
                                {report.is_global && (
                                    <GlobeIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" title="Globally Shared Report" />
                                )}
                                {!report.is_global && report.shared_with_company_ids && report.shared_with_company_ids.length > 0 && (
                                    <UsersIcon className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" title="Shared with partner companies" />
                                )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{report.ob_number}</p>
                        </div>
                    </div>
                </div>
                <div className="flex-shrink-0">
                    {canUpdateStatus ? (
                         <div className="relative">
                            <select
                                value={report.status}
                                onChange={handleStatusChange}
                                disabled={isUpdating || isTerminalStatus}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full py-1 pl-3 pr-8 text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition disabled:opacity-70 appearance-none"
                            >
                                {statusOptions.map(status => (
                                    <option key={status} value={status} className="capitalize font-bold">{status.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                            {isUpdating && (
                                <div className="absolute top-1/2 right-2 -translate-y-1/2">
                                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <StatusBadge status={report.status} />
                    )}
                </div>
            </div>

            <div className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <ReportTypeBadge type={report.type as any} />
                {report.type === 'vehicle' ? (
                    <p className="truncate">
                        <span className={`${severityStyles[report.severity]} font-semibold capitalize`}>{report.severity}</span>
                        {' · '}
                        {(report as any).vehicle_make} {(report as any).vehicle_model} ({(report as any).vehicle_color})
                    </p>
                ) : report.type === 'emergency' ? (
                     <p className="truncate">
                        <span className={`${severityStyles[report.severity]} font-semibold capitalize`}>{report.severity}</span>
                        {' · '}
                        {(report as any).emergency_type}
                        {(report as any).license_plate && ` · ${(report as any).license_plate}`}
                    </p>
                ) : (
                     <p className="truncate">
                        <span className={`${severityStyles[report.severity]} font-semibold capitalize`}>{report.severity}</span>
                        {' · '}
                        {(report as any).crime_type}
                    </p>
                )}
            </div>
            
            <div className="flex justify-between items-end mt-2">
               <div className="text-xs text-gray-400 dark:text-gray-500 truncate pr-2">
                    <p className="truncate">{report.type === 'vehicle' ? (report as any).last_seen_location : (report as any).location}</p>
                    <p className="mt-1">By: <span className="font-medium text-gray-500 dark:text-gray-400">{reporterName}</span></p>
                </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                  {formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}
              </p>
            </div>
        </div>
    </div>
  );
};

export default memo(ReportListItem);