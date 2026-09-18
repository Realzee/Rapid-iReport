import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Report, VehicleReport, Severity, Responder, Profile, CrimeReport, ReportStatus, ACTIVE_REPORT_STATUSES } from '../types';
import { differenceInMinutes } from 'date-fns';
import { safeFormat, safeGetDate } from '../utils/dateUtils';
import StatusBadge from './StatusBadge';
import ReportTypeBadge from './ReportTypeBadge';
import { CameraIcon, UserIcon, ClockIcon, NavigationIcon, ChevronUpIcon, CarIcon, AlertTriangleIcon, CrimeIcon, GlobeIcon, UsersIcon, ZapIcon, WrenchIcon } from './icons';

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
    
    const isRecoveredOrDeleted = report.status === 'recovered' || report.status === 'deleted' || report.status === 'resolved' || report.status === 'closed' || report.status === 'rejected';

    // Report is considered opened if it is currently selected or has been viewed/opened
    const isOpened = isSelected || !isUnviewed;

    // Age-based coloring
    const ageBorderClass = isRecoveredOrDeleted ? 'border-l-gray-400 dark:border-l-gray-600' : getAgeColorClass(report.reported_at);
    const ageTextClass = isRecoveredOrDeleted ? 'text-gray-450' : getAgeTextClass(report.reported_at);

    const isSharedFromOtherCompany = profile.company_id && report.company_id && report.company_id !== profile.company_id;
    const sharingCompanyName = report.company_name || '';

    const borderClass = isSelected 
        ? 'border-blue-500 ring-2 ring-blue-500/50' 
        : (isRecoveredOrDeleted 
            ? 'border-gray-200 dark:border-gray-700/50'
            : 'border-gray-200 dark:border-gray-700/50');
        
    const bgClass = isSelected 
        ? 'bg-blue-500/10 dark:bg-gray-900/60' 
        : (isRecoveredOrDeleted
            ? 'bg-gray-150/50 dark:bg-gray-900/10 hover:bg-gray-200/50 dark:hover:bg-gray-900/20'
            : 'bg-white/50 dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/60');

    const hasImages = report.evidence_images && report.evidence_images.length > 0;
    const assignedResponderName = report.assigned_to ? responderMap.get(report.assigned_to) : null;

    const isGreenStamp = report.status === 'recovered' || report.status === 'resolved' || report.status === ReportStatus.RECOVERED || report.status === ReportStatus.RESOLVED;

    return (
        <div
            onClick={onSelect}
            className={`p-2 rounded-lg cursor-pointer transition-all duration-200 border shadow-sm border-l-4 relative overflow-hidden ${ageBorderClass} ${isSelected ? 'border-blue-500' : ''} ${bgClass}`}
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
                            <ReportTypeBadge type={report.type as any} showText={false} className="p-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
                                    <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight truncate min-w-0 flex-1" title={title}>{title}</p>
                                    <div className="flex items-center gap-1 flex-shrink-0">
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
                                        {!isOpened && isUnviewed && (
                                            <span className="px-1.5 py-0.5 bg-yellow-500 text-white text-[10px] font-bold rounded-full flex-shrink-0">
                                                NEW
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5" title={report.type === 'roadside' ? `CAR: ${(report as any).car_number || (report as any).card_number || report.ob_number}` : report.ob_number}>
                                    {report.type === 'roadside' ? `CAR: ${(report as any).car_number || (report as any).card_number || report.ob_number}` : report.ob_number}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-1.5 text-xs text-gray-700 dark:text-gray-300">
                        <p className="text-gray-500 dark:text-gray-400 line-clamp-3 break-words">{report.description}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 min-w-0 flex-1">
                            <span className={`px-1.5 py-0.5 rounded uppercase font-bold text-xs flex-shrink-0 ${severityTagStyles[report.severity]}`}>
                                {report.severity.toUpperCase()}
                            </span>
                            {hasImages && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <CameraIcon className="w-3.5 h-3.5" />
                                    <span>{report.evidence_images?.length}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1 min-w-0" title={`Reported by: ${reporterName}`}>
                                <UserIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate max-w-[140px] sm:max-w-[200px]">{reporterName}</span>
                            </div>
                            {assignedResponderName && (
                                <div className="flex items-center gap-1 min-w-0" title={`Assigned to: ${assignedResponderName}`}>
                                    <NavigationIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="font-medium text-gray-600 dark:text-gray-300 truncate max-w-[140px] sm:max-w-[200px]">{assignedResponderName}</span>
                                </div>
                            )}
                            {isSharedFromOtherCompany && (
                                <div className="flex items-center gap-1 min-w-0 text-blue-600 dark:text-blue-400 font-medium" title={`Shared by ${sharingCompanyName || 'Partner Company'}`}>
                                    <UsersIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate max-w-[140px] sm:max-w-[200px]">From: {sharingCompanyName || 'Partner'}</span>
                                </div>
                            )}
                            <div className={`flex items-center gap-1 flex-shrink-0 ${ageTextClass}`}>
                                <ClockIcon className="w-3.5 h-3.5" />
                                <span>{safeFormat(report.reported_at, 'HH:mm')}</span>
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                            <StatusBadge status={report.status} />
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
    showIdleReports?: boolean;
}

const LiveEventStack: React.FC<LiveEventStackProps> = ({ 
    reports, 
    responders, 
    allUsers, 
    onReportSelect, 
    selectedReportId, 
    newPanicReportId, 
    unviewedReportIds, 
    profile,
    showIdleReports = false
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showUnreadIndicator, setShowUnreadIndicator] = useState(false);
    const [selectedType, setSelectedType] = useState<'all' | 'vehicle' | 'crime' | 'emergency' | 'roadside'>('all');
    const [visibleCount, setVisibleCount] = useState<number>(10);
    const prevReportsLengthRef = useRef(reports.length);

    // Force re-render every minute to update age colors
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    // Filter reports according to showIdleReports mode and selectedType
    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            // When in Live mode (!showIdleReports), strictly exclude deleted reports and non-active statuses
            if (!showIdleReports) {
                if (r.status === ReportStatus.DELETED || r.status === 'deleted' || !ACTIVE_REPORT_STATUSES.includes(r.status)) {
                    return false;
                }
            }
            if (selectedType === 'all') return true;
            return r.type === selectedType;
        });
    }, [reports, selectedType, showIdleReports]);

    // Calculate count badges for each report type
    const typeCounts = useMemo(() => {
        const eligible = reports.filter(r => {
            if (!showIdleReports) {
                if (r.status === ReportStatus.DELETED || r.status === 'deleted' || !ACTIVE_REPORT_STATUSES.includes(r.status)) {
                    return false;
                }
            }
            return true;
        });
        return {
            all: eligible.length,
            vehicle: eligible.filter(r => r.type === 'vehicle').length,
            crime: eligible.filter(r => r.type === 'crime').length,
            emergency: eligible.filter(r => r.type === 'emergency').length,
            roadside: eligible.filter(r => r.type === 'roadside').length,
        };
    }, [reports, showIdleReports]);

    // Reset pagination to 10 when filter changes or mode switches
    useEffect(() => {
        setVisibleCount(10);
    }, [selectedType, showIdleReports]);

    const displayedReports = useMemo(() => {
        return filteredReports.slice(0, visibleCount);
    }, [filteredReports, visibleCount]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const isNewReportAdded = filteredReports.length > prevReportsLengthRef.current;

        if (isNewReportAdded) {
            if (container.scrollTop > 50) {
                setShowUnreadIndicator(true);
            } else {
                container.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
        
        prevReportsLengthRef.current = filteredReports.length;
    }, [filteredReports]);

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
            <div className="flex-shrink-0 mb-3 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {showIdleReports ? 'Archived Events' : 'Live Event Stack'}
                </h2>
                <div className="text-right">
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {filteredReports.length} {filteredReports.length === 1 ? 'event' : 'events'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {showIdleReports ? 'Archives & Deleted' : 'Real-time active'}
                    </p>
                </div>
            </div>

            {/* Type Filter Buttons */}
            <div className="flex-shrink-0 mb-3 overflow-x-auto pb-1 no-scrollbar">
                <div className="flex items-center gap-1.5">
                    {[
                        { id: 'all', label: 'All', icon: ZapIcon, count: typeCounts.all },
                        { id: 'vehicle', label: 'Vehicle', icon: CarIcon, count: typeCounts.vehicle },
                        { id: 'crime', label: 'Crime', icon: CrimeIcon, count: typeCounts.crime },
                        { id: 'emergency', label: 'Emergency', icon: AlertTriangleIcon, count: typeCounts.emergency },
                        { id: 'roadside', label: 'Roadside', icon: WrenchIcon, count: typeCounts.roadside },
                    ].map(filter => {
                        const Icon = filter.icon;
                        const isActive = selectedType === filter.id;
                        return (
                            <button
                                key={filter.id}
                                onClick={() => setSelectedType(filter.id as any)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 border ${
                                    isActive
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{filter.label}</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                                    isActive 
                                        ? 'bg-white/25 text-white' 
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}>
                                    {filter.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="relative flex-grow min-h-0">
                {showUnreadIndicator && (
                    <button 
                        onClick={scrollToTop}
                        className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-lg text-sm flex items-center gap-1"
                    >
                        <ChevronUpIcon className="w-4 h-4" />
                        New Events
                    </button>
                )}
                <div ref={scrollContainerRef} onScroll={handleScroll} className="space-y-2 overflow-y-auto h-full pr-2 -mr-2">
                    {displayedReports.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                            <p className="text-sm font-semibold">
                                No {selectedType === 'all' ? '' : selectedType} {showIdleReports ? 'archived' : 'live'} incidents found
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {showIdleReports ? 'Deleted and resolved reports will appear here.' : 'New active reports will appear here in real-time.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {displayedReports.map(report => (
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

                            {/* Load More Button when there are more than 10 reports */}
                            {visibleCount < filteredReports.length && (
                                <div className="pt-3 pb-2 text-center">
                                    <button
                                        onClick={() => setVisibleCount(prev => prev + 10)}
                                        className="w-full py-2.5 px-4 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-blue-200 dark:border-blue-800 shadow-sm"
                                    >
                                        <span>Load More Incidents</span>
                                        <span className="text-[10px] bg-blue-200 dark:bg-blue-900 px-2 py-0.5 rounded-full font-mono font-extrabold">
                                            ({displayedReports.length} of {filteredReports.length})
                                        </span>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveEventStack;