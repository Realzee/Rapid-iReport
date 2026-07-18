import React, { useState, useMemo, memo } from 'react';
import { Report, VehicleReport, Severity, Profile, UserRole, ReportStatus, Company } from '../types';
import StatusBadge from './StatusBadge';
import ReportTypeBadge from './ReportTypeBadge';
import { safeFormatDistanceToNow } from '../utils/dateUtils';
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
  sharingCompany?: Company;
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

const ReportListItem: React.FC<ReportListItemProps> = ({ report, isSelected, onClick, profile, reporterName, onStatusUpdate, companyLogoUrl, showCheckbox, checked, sharingCompany }) => {
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

  const isRecoveredOrDeleted = useMemo(() => {
    return report.status === ReportStatus.RECOVERED || report.status === ReportStatus.DELETED || report.status === ReportStatus.RESOLVED || report.status === 'recovered' || report.status === 'deleted' || report.status === 'resolved';
  }, [report.status]);

  const borderColor = isSelected 
    ? 'border-blue-500' 
    : (isRecoveredOrDeleted 
      ? 'border-gray-300 dark:border-gray-700' 
      : (isTerminalStatus ? 'border-gray-300 dark:border-gray-700' : severityBorderColors[report.severity]));
  const bgColor = isSelected 
    ? 'bg-blue-500/10 dark:bg-blue-500/30' 
    : (isRecoveredOrDeleted 
      ? 'bg-gray-150/50 dark:bg-gray-900/10' 
      : (isTerminalStatus ? 'bg-gray-200/50 dark:bg-gray-900/50' : 'bg-gray-50/50 dark:bg-gray-800/60'));
  const textColor = (isTerminalStatus || isRecoveredOrDeleted) ? 'text-gray-500 dark:text-gray-500' : 'text-gray-800 dark:text-white';
  const hasImage = report.evidence_images && report.evidence_images.length > 0;

  const isSharedFromOtherCompany = profile.company_id && report.company_id && report.company_id !== profile.company_id;
  const sharingCompanyName = sharingCompany?.name || report.company_name;

  const isGreenStamp = report.status === 'recovered' || report.status === 'resolved' || report.status === ReportStatus.RECOVERED || report.status === ReportStatus.RESOLVED;

  return (
    <div 
        onClick={onClick}
        className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border-l-4 relative overflow-hidden group ${bgColor} ${borderColor} hover:bg-gray-100 dark:hover:bg-gray-800`}
    >
        {isRecoveredOrDeleted && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 select-none bg-black/5 dark:bg-black/10">
                <div className={`border-4 border-double ${
                    isGreenStamp 
                        ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 bg-emerald-50/95 dark:bg-emerald-950/95 shadow-emerald-500/10' 
                        : 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400 bg-rose-50/95 dark:bg-rose-950/95 shadow-rose-500/10'
                    } font-black text-sm tracking-widest px-4 py-1.5 uppercase rounded-md transform -rotate-12 shadow-2xl ring-2 ring-offset-2 ${
                    isGreenStamp 
                        ? 'ring-emerald-500/20 dark:ring-emerald-400/20 ring-offset-emerald-50 dark:ring-offset-emerald-950' 
                        : 'ring-rose-500/20 dark:ring-rose-400/20 ring-offset-rose-50 dark:ring-offset-rose-950'
                    } font-mono`}
                >
                    {report.status.replace(/_/g, ' ')}
                </div>
            </div>
        )}
        <div className={`flex items-start space-x-4 w-full ${isRecoveredOrDeleted ? 'opacity-40 grayscale blur-[0.5px]' : (isTerminalStatus ? 'opacity-70' : '')}`}>
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
            <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0 flex items-start gap-2">
                    {companyLogoUrl && (
                        <img 
                            src={companyLogoUrl} 
                            alt="Company Logo" 
                            className="w-8 h-8 rounded-full object-contain flex-shrink-0 bg-gray-200 dark:bg-gray-700 mt-0.5"
                        />
                    )}
                    <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <ReportTypeBadge type={report.type as any} showText={false} className="p-1 flex-shrink-0" />
                            <p className={`font-bold text-sm ${textColor} group-hover:text-blue-500 dark:group-hover:text-blue-300 transition-colors truncate max-w-full`}>
                                {report.type === 'vehicle' ? (report as any).license_plate : report.title}
                            </p>
                            {report.is_global && (
                                <GlobeIcon className="w-3 h-3 text-blue-500 flex-shrink-0" title="Globally Shared Report" />
                            )}
                            {!report.is_global && report.shared_with_company_ids && report.shared_with_company_ids.length > 0 && (
                                <UsersIcon className="w-3 h-3 text-purple-500 flex-shrink-0" title="Shared with partner companies" />
                            )}
                            {isSharedFromOtherCompany && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800 leading-none flex-shrink-0" title={`Shared by ${sharingCompanyName || 'Partner Company'}`}>
                                    Shared
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate mt-0.5">{report.ob_number}</p>
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
                                className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full py-0.5 pl-2.5 pr-6 text-[10px] font-bold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition disabled:opacity-70 appearance-none w-full max-w-[90px] sm:max-w-[120px] whitespace-nowrap overflow-hidden text-ellipsis"
                            >
                                {statusOptions.map(status => (
                                    <option key={status} value={status} className="capitalize font-bold">{status.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                            {isUpdating ? (
                                <div className="absolute top-1/2 right-1.5 -translate-y-1/2 pointer-events-none">
                                    <div className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="absolute top-1/2 right-1.5 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </div>
                            )}
                        </div>
                    ) : (
                        <StatusBadge status={report.status} />
                    )}
                </div>
            </div>

            <div className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 min-w-0">
                <ReportTypeBadge type={report.type as any} className="flex-shrink-0" />
                {report.type === 'vehicle' ? (
                    <p className="truncate flex-1 min-w-0">
                        <span className={`${severityStyles[report.severity]} font-semibold capitalize`}>{report.severity}</span>
                        {' · '}
                        {(report as any).vehicle_make} {(report as any).vehicle_model} ({(report as any).vehicle_color})
                    </p>
                ) : report.type === 'emergency' ? (
                     <p className="truncate flex-1 min-w-0">
                        <span className={`${severityStyles[report.severity]} font-semibold capitalize`}>{report.severity}</span>
                        {' · '}
                        {(report as any).emergency_type}
                        {(report as any).license_plate && ` · ${(report as any).license_plate}`}
                    </p>
                ) : (
                     <p className="truncate flex-1 min-w-0">
                        <span className={`${severityStyles[report.severity]} font-semibold capitalize`}>{report.severity}</span>
                        {' · '}
                        {(report as any).crime_type}
                    </p>
                )}
            </div>
            
            <div className="flex justify-between items-end mt-2 min-w-0 gap-2">
               <div className="text-xs text-gray-400 dark:text-gray-500 min-w-0 flex-1 pr-2">
                    <p className="truncate w-full">{report.type === 'vehicle' ? (report as any).last_seen_location : (report as any).location}</p>
                    <p className="mt-1 truncate w-full">By: <span className="font-medium text-gray-500 dark:text-gray-400">{reporterName}</span></p>
                    {isSharedFromOtherCompany && (
                         <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-medium truncate w-full">
                             Shared by: <span className="font-semibold">{sharingCompanyName || 'Partner Company'}</span>
                         </p>
                    )}
                </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 whitespace-nowrap">
                  {safeFormatDistanceToNow(report.reported_at, { addSuffix: true })}
              </p>
            </div>
        </div>
        </div>
    </div>
  );
};

export default memo(ReportListItem);