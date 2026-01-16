import React, { useMemo } from 'react';
import { Report, VehicleReport, Severity, Responder } from '../types';
import { format } from 'date-fns';
import StatusBadge from './StatusBadge';
import { CameraIcon, UserIcon } from './icons';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const getReportTitle = (report: Report): string => {
    if (isVehicleReport(report)) {
        if (report.description.toLowerCase().includes('accident') || report.description.toLowerCase().includes('rolled')) {
            return 'Vehicle Accident';
        }
        return 'Stolen Vehicle';
    }
    return report.title || 'Crime Report';
};

const severityTagStyles: Record<Severity, string> = {
    [Severity.CRITICAL]: 'bg-red-500/10 text-red-600 dark:text-red-400 font-bold',
    [Severity.HIGH]: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold',
    [Severity.MEDIUM]: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-bold',
    [Severity.LOW]: 'bg-green-500/10 text-green-600 dark:text-green-400 font-bold',
};


const LiveEventItem: React.FC<{
    report: Report;
    isSelected: boolean;
    onSelect: () => void;
    responderMap: Map<string, string>;
}> = ({ report, isSelected, onSelect, responderMap }) => {
    const title = getReportTitle(report);
    
    const borderClass = isSelected ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-200 dark:border-gray-700/50';
    const bgClass = isSelected ? 'bg-blue-500/10 dark:bg-gray-900/60' : 'bg-white/50 dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/60';

    const hasImages = report.evidence_images && report.evidence_images.length > 0;
    const assignedResponderName = report.assigned_to ? responderMap.get(report.assigned_to) : null;

    return (
        <div
            onClick={onSelect}
            className={`p-4 rounded-lg cursor-pointer transition-all duration-200 border shadow-sm ${borderClass} ${bgClass}`}
        >
            {/* Header */}
            <div className="flex justify-between items-start gap-2">
                <div>
                    <p className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{title}</p>
                    <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{report.ob_number}</p>
                </div>
                <div className="text-right flex-shrink-0">
                    <StatusBadge status={report.status} />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{format(new Date(report.reported_at), 'HH:mm:ss a')}</p>
                </div>
            </div>

            {/* Details Grid */}
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase">Severity</p>
                    <span className={`px-2 py-0.5 text-xs rounded capitalize ${severityTagStyles[report.severity]}`}>
                        {report.severity}
                    </span>
                </div>
                 {hasImages && (
                    <div className="flex items-center gap-1.5">
                        <CameraIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">{report.evidence_images?.length} image(s)</span>
                    </div>
                )}
                {assignedResponderName && (
                     <div className="col-span-2 flex items-center gap-1.5">
                        <UserIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Assigned to: <span className="font-semibold text-gray-700 dark:text-gray-300">{assignedResponderName}</span></span>
                    </div>
                )}
            </div>

            {/* Vehicle / Crime Specifics */}
            {isVehicleReport(report) ? (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
                    <p className="text-xs font-bold text-gray-400 uppercase">Vehicle Details</p>
                    <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
                        <p><strong>Plate:</strong> <span className="font-mono text-gray-800 dark:text-white bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">{report.license_plate}</span></p>
                        <p><strong>Make:</strong> {report.vehicle_make}</p>
                        <p><strong>Model:</strong> {report.vehicle_model}</p>
                        <p><strong>Color:</strong> {report.vehicle_color}</p>
                    </div>
                     <p className="mt-2"><strong>Last Seen:</strong> {report.last_seen_location}</p>
                </div>
            ) : (
                 <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
                    <p className="text-xs font-bold text-gray-400 uppercase">Incident Details</p>
                    <div className="mt-1 grid grid-cols-1 text-sm text-gray-700 dark:text-gray-300">
                        <p><strong>Type:</strong> {report.crime_type}</p>
                        <p><strong>Location:</strong> {report.location}</p>
                    </div>
                </div>
            )}
            
            {/* Description */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
                <p className="text-xs font-bold text-gray-400 uppercase">Description</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{report.description}</p>
            </div>

            {/* Coords */}
            {report.location_coords && (
                 <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 font-mono flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    {report.location_coords.lat.toFixed(6)}, {report.location_coords.lng.toFixed(6)}
                </p>
            )}
        </div>
    );
};


interface LiveEventStackProps {
    reports: Report[];
    responders: Responder[];
    onReportSelect: (id: string) => void;
    selectedReportId: string | null;
}

const LiveEventStack: React.FC<LiveEventStackProps> = ({ reports, responders, onReportSelect, selectedReportId }) => {
    
    const responderMap = useMemo(() => {
        return new Map(responders.map(r => [r.id, r.full_name]));
    }, [responders]);

    return (
        <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col backdrop-blur-lg max-h-[calc(100vh-8rem)]">
            <div className="flex-shrink-0 mb-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Live Event Stack</h2>
                    <div className="text-right">
                        <p className="text-sm text-gray-700 dark:text-gray-200">{reports.length} events</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Real-time updates</p>
                    </div>
                </div>
            </div>

            <div className="space-y-3 overflow-y-auto pr-2 -mr-2">
                {reports.map(report => (
                    <LiveEventItem
                        key={report.id}
                        report={report}
                        isSelected={report.id === selectedReportId}
                        onSelect={() => onReportSelect(report.id)}
                        responderMap={responderMap}
                    />
                ))}
            </div>
        </div>
    );
};

export default LiveEventStack;