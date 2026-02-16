import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Report, VehicleReport, Severity, Responder, Profile } from '../types';
import { format } from 'date-fns';
import StatusBadge from './StatusBadge';
import { CameraIcon, UserIcon, ClockIcon, NavigationIcon, ChevronUpIcon } from './icons';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const severityTagStyles: Record<Severity, string> = {
    [Severity.CRITICAL]: 'bg-red-500/10 text-red-600 dark:text-red-400',
    [Severity.HIGH]: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    [Severity.MEDIUM]: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    [Severity.LOW]: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

const LiveEventItem: React.FC<{
    report: Report;
    isSelected: boolean;
    onSelect: () => void;
    responderMap: Map<string, string>;
    reporterName: string;
}> = ({ report, isSelected, onSelect, responderMap, reporterName }) => {
    const title = isVehicleReport(report) ? report.license_plate : report.title;
    
    const borderClass = isSelected ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-200 dark:border-gray-700/50';
    const bgClass = isSelected ? 'bg-blue-500/10 dark:bg-gray-900/60' : 'bg-white/50 dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/60';

    const hasImages = report.evidence_images && report.evidence_images.length > 0;
    const assignedResponderName = report.assigned_to ? responderMap.get(report.assigned_to) : null;

    return (
        <div
            onClick={onSelect}
            className={`p-2 rounded-lg cursor-pointer transition-all duration-200 border shadow-sm ${borderClass} ${bgClass}`}
        >
            <div className="flex justify-between items-center gap-2">
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight truncate">{title}</p>
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{report.ob_number}</p>
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
                <div className="flex items-center gap-1 ml-auto">
                    <ClockIcon className="w-3.5 h-3.5" />
                    <span>{format(new Date(report.reported_at), 'HH:mm')}</span>
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
}

const LiveEventStack: React.FC<LiveEventStackProps> = ({ reports, responders, allUsers, onReportSelect, selectedReportId }) => {
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showUnreadIndicator, setShowUnreadIndicator] = useState(false);
    const prevReportsLengthRef = useRef(reports.length);

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
                            onSelect={() => onReportSelect(report.id)}
                            responderMap={responderMap}
                            reporterName={userMap.get(report.reported_by) || 'Unknown User'}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LiveEventStack;