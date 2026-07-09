import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Report, VehicleReport, Severity, Responder, Profile, CrimeReport, ReportStatus } from '../types';
import { differenceInMinutes } from 'date-fns';
import { safeFormat, safeGetDate } from '../utils/dateUtils';
import StatusBadge from './StatusBadge';
import ReportTypeBadge from './ReportTypeBadge';
import { CameraIcon, UserIcon, ClockIcon, NavigationIcon, ChevronUpIcon, CarIcon, AlertTriangleIcon, CrimeIcon, GlobeIcon, UsersIcon } from './icons';

const severityTagStyles: Record<Severity, string> = {
    [Severity.CRITICAL]: 'bg-red-500/10 text-red-600 dark:text-red-400',
    [Severity.HIGH]: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    [Severity.MEDIUM]: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    [Severity.LOW]: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

const getAgeColorClass = (date: string) => {
    const d = safeGetDate(date);
    if (!d) return 'border-l-gray-300';
    const minutes = differenceInMinutes(new Date(), d);
    if (minutes < 10) return 'border-l-green-500';
    if (minutes < 30) return 'border-l-blue-500';
    if (minutes < 60) return 'border-l-yellow-500';
    return 'border-l-orange-500';
};

const getAgeTextClass = (date: string) => {
    const d = safeGetDate(date);
    if (!d) return 'text-gray-400';
    const minutes = differenceInMinutes(new Date(), d);
    if (minutes < 10) return 'text-green-600 dark:text-green-400 font-bold';
    if (minutes < 30) return 'text-blue-600 dark:text-blue-400 font-medium';
    if (minutes < 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
};

const LiveEventItem: React.FC<{
    report: Report;
    isSelected: boolean;
    isPanic: boolean;
    isUnviewed: boolean;
    onSelect: () => void;
    responderMap: Map<string, string>;
    reporterName: string;
    profile: Profile;
}> = ({ report, isSelected, isPanic, isUnviewed, onSelect, responderMap, reporterName, profile }) => {
    const title = report.type === 'vehicle' ? (report as any).license_plate : report.title;
    
    const isRecoveredOrDeleted = report.status === 'recovered' || report.status === 'deleted' || report.status === 'resolved';

    // Age-based coloring
    const ageBorderClass = isRecoveredOrDeleted ? 'border-l-gray-400 dark:border-l-gray-600' : getAgeColorClass(report.reported_at);
    const ageTextClass = isRecoveredOrDeleted ? 'text-gray-450' : getAgeTextClass(report.reported_at);

    const isSharedFromOtherCompany = profile.company_id && report.company_id && report.company_id !== profile.company_id;
    const sharingCompanyName = report.company_name || '';

    const borderClass = isSelected 
        ? 'border-blue-500 ring-2 ring-blue-500/50' 
        : (isRecoveredOrDeleted 
            ? 'border-gray-200 dark:border-gray-700/50'
            : (isPanic ? 'border-red-500' : 'border-gray-200 dark:border-gray-700/50'));
        
    const bgClass = isSelected 
        ? 'bg-blue-500/10 dark:bg-gray-900/60' 
        : (isRecoveredOrDeleted
            ? 'bg-gray-150/50 dark:bg-gray-900/10 hover:bg-gray-200/50 dark:hover:bg-gray-900/20'
            : (isPanic ? 'bg-red-500/10' : 'bg-white/50 dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/60'));
        
    // Flash animation for unviewed reports
    const pulseClass = isPanic ? 'animate-pulse' : (isUnviewed ? 'animate-pulse ring-2 ring-yellow-400/50' : '');

    const hasImages = report.evidence_images && report.evidence_images.length > 0;
    const assignedResponderName = report.assigned_to ? responderMap.get(report.assigned_to) : null;

    const isGreenStamp = report.status === 'recovered' || report.status === 'resolved' || report.status === ReportStatus.RECOVERED || report.status === ReportStatus.RESOLVED;

    return (
        <div
            onClick={onSelect}
            className={`p-2 rounded-lg cursor-pointer transition-all duration-200 border shadow-sm border-l-4 relative overflow-hidden ${ageBorderClass} ${isSelected ? 'border-blue-500' : ''} ${bgClass} ${pulseClass}`}
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
            <div className={`flex gap-3 ${isRecoveredOrDeleted ? 'opacity-40 grayscale blur-[0.5px]' : ''}`}>
                {hasImages && (
                    <div className="flex-shrink-0">
                        <img 
                            src={report.evidence_images![0]} 
                            alt="Evidence" 
                            className="w-20 h-20 object-cover rounded-md border border-gray-200 dark:border-gray-700"
                        />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <ReportTypeBadge type={report.type as any} showText={false} className="p-1.5" />
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight truncate">{title}</p>
                                    {report.is_global && (
                                        <GlobeIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" title="Global Report" />
                                    )}
                                    {!report.is_global && report.shared_with_company_ids && report.shared_with_company_ids.length > 0 && (
                                        <UsersIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" title="Shared with specific companies" />
                                    )}
                                    {isSharedFromOtherCompany && (
                                        <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border border-blue-200 dark:border-blue-900 leading-none flex-shrink-0" title={`Shared by ${sharingCompanyName || 'Partner Company'}`}>
                                            Shared
                                        </span>
                                    )}
                                    {isUnviewed && (
                                        <span className="px-1.5 py-0.5 bg-yellow-500 text-white text-[10px] font-bold rounded-full animate-bounce">
                                            NEW
                                        </span>
                                    )}
                                </div>
                                <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{report.ob_number}</p>
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                            <StatusBadge status={report.status} />
                        </div>
                    </div>

                    <div className="mt-1.5 text-xs text-gray-700 dark:text-gray-300">
                        <p className="text-gray-500 dark:text-gray-400 line-clamp-2">{report.description}</p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className={`px-1.5 py-0.5 rounded capitalize font-semibold text-xs ${severityTagStyles[report.severity]}`}>
                            {report.severity}
                        </span>
                        {hasImages && (
                            <div className="flex items-center gap-1">
                                <CameraIcon className="w-3.5 h-3.5" />
                                <span>{report.evidence_images?.length}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1 truncate" title={`Reported by: ${reporterName}`}>
                            <UserIcon className="w-3.5 h-3.5" />
                            <span className="truncate">{reporterName}</span>
                        </div>
                        {assignedResponderName && (
                            <div className="flex items-center gap-1 truncate" title={`Assigned to: ${assignedResponderName}`}>
                                <NavigationIcon className="w-3.5 h-3.5" />
                                <span className="font-medium text-gray-600 dark:text-gray-300 truncate">{assignedResponderName}</span>
                            </div>
                        )}
                        {isSharedFromOtherCompany && (
                            <div className="flex items-center gap-1 truncate text-blue-600 dark:text-blue-400 font-medium" title={`Shared by ${sharingCompanyName || 'Partner Company'}`}>
                                <UsersIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">From: {sharingCompanyName || 'Partner'}</span>
                            </div>
                        )}
                        <div className={`flex items-center gap-1 ml-auto ${ageTextClass}`}>
                            <ClockIcon className="w-3.5 h-3.5" />
                            <span>{safeFormat(report.reported_at, 'HH:mm')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


interface LiveEventStackProps {
    reports: Report[];
    responders: Responder[];
    allUsers: Profile[];
    onReportSelect: (id: string) => void;
    selectedReportId: string | null;
    newPanicReportId?: string | null;
    unviewedReportIds?: Set<string>;
    profile: Profile;
}

const LiveEventStack: React.FC<LiveEventStackProps> = ({ reports, responders, allUsers, onReportSelect, selectedReportId, newPanicReportId, unviewedReportIds, profile }) => {
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showUnreadIndicator, setShowUnreadIndicator] = useState(false);
    const prevReportsLengthRef = useRef(reports.length);

    // Force re-render every minute to update age colors
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const isNewReportAdded = reports.length > prevReportsLengthRef.current;

        if (isNewReportAdded) {
            if (container.scrollTop > 50) {
                setShowUnreadIndicator(true);
            } else {
                container.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
        
        prevReportsLengthRef.current = reports.length;
    }, [reports]);

    const handleScroll = () => {
        if (scrollContainerRef.current && scrollContainerRef.current.scrollTop < 50) {
            setShowUnreadIndicator(false);
        }
    };

    const scrollToTop = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            setShowUnreadIndicator(false);
        }
    };
    
    const responderMap = useMemo(() => {
        return new Map(responders.map(r => [r.id, `${r.first_name} ${r.surname}`]));
    }, [responders]);

    const userMap = useMemo(() => {
        return new Map(allUsers.map(u => [u.id, `${u.first_name} ${u.surname}`]));
    }, [allUsers]);

    return (
        <div className="flex flex-col flex-grow min-h-0">
            <div className="flex-shrink-0 mb-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Live Event Stack</h2>
                <div className="text-right">
                    <p className="text-sm text-gray-700 dark:text-gray-200">{reports.length} events</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Real-time updates</p>
                </div>
            </div>

            <div className="relative flex-grow min-h-0">
                {showUnreadIndicator && (
                    <button 
                        onClick={scrollToTop}
                        className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-lg text-sm flex items-center gap-1 animate-bounce"
                    >
                        <ChevronUpIcon className="w-4 h-4" />
                        New Events
                    </button>
                )}
                <div ref={scrollContainerRef} onScroll={handleScroll} className="space-y-2 overflow-y-auto h-full pr-2 -mr-2">
                    {reports.map(report => (
                        <LiveEventItem
                            key={report.id}
                            report={report}
                            isSelected={report.id === selectedReportId}
                            isPanic={report.id === newPanicReportId || (report as CrimeReport).crime_type === 'PUBLIC_PANIC_ASSIST'}
                            isUnviewed={unviewedReportIds?.has(report.id) || false}
                            onSelect={() => onReportSelect(report.id)}
                            responderMap={responderMap}
                            reporterName={userMap.get(report.reported_by) || 'Unknown User'}
                            profile={profile}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LiveEventStack;