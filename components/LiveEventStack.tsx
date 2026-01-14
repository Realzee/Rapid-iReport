
import React from 'react';
import { Report, VehicleReport, Severity } from '../types';
import { format } from 'date-fns';

interface LiveEventStackProps {
    reports: Report[];
    onReportSelect: (id: string) => void;
    selectedReportId: string | null;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const severityCardStyles: Record<Severity, { bg: string, border: string, text: string }> = {
    [Severity.CRITICAL]: { bg: 'bg-red-500/10 dark:bg-red-900/30', border: 'border-red-500/50', text: 'text-red-500' },
    [Severity.HIGH]: { bg: 'bg-orange-500/10 dark:bg-orange-900/30', border: 'border-orange-500/50', text: 'text-orange-500' },
    [Severity.MEDIUM]: { bg: 'bg-blue-500/10 dark:bg-blue-900/30', border: 'border-blue-500/50', text: 'text-blue-500' },
    [Severity.LOW]: { bg: 'bg-green-500/10 dark:bg-green-900/30', border: 'border-green-500/50', text: 'text-green-500' },
};

const EventCard: React.FC<{ report: Report, onSelect: () => void, isSelected: boolean }> = ({ report, onSelect, isSelected }) => {
    const isVehicle = isVehicleReport(report);
    const cardStyle = severityCardStyles[report.severity];
    
    const selectedClasses = isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-black' : `hover:border-gray-300 dark:hover:border-gray-600`;

    return (
        <div
            onClick={onSelect}
            className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border ${cardStyle.bg} ${isSelected ? 'border-blue-500' : cardStyle.border} ${selectedClasses}`}
        >
            <div className="flex justify-between items-start mb-1">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{isVehicle ? (report.description.toLowerCase().includes('accident') ? 'Vehicle Accident' : 'Stolen Vehicle') : report.title}</p>
                <div className="text-right flex-shrink-0 pl-2">
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-mono">{report.ob_number}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(report.reported_at), 'HH:mm')}</p>
                </div>
            </div>
            
            <p className={`text-xs font-bold capitalize`}>
                <span className={cardStyle.text}>{report.severity}</span>
            </p>

            <p className="text-sm text-gray-700 dark:text-gray-300 my-2 line-clamp-2">{report.description}</p>
            
            {isVehicle && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-gray-600 dark:text-gray-300 mt-2">
                    <div className="flex items-baseline">
                        <span className="opacity-70 mr-1">PLATE:</span>
                        <span className="font-bold">{report.license_plate}</span>
                    </div>
                    <div className="flex items-baseline">
                        <span className="opacity-70 mr-1">MAKE:</span>
                        <span className="font-bold">{report.vehicle_make}</span>
                    </div>
                     <div className="flex items-baseline">
                        <span className="opacity-70 mr-1">COLOR:</span>
                        <span className="font-bold">{report.vehicle_color}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const LiveEventStack: React.FC<LiveEventStackProps> = ({ reports, onReportSelect, selectedReportId }) => {
    return (
        <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg flex flex-col flex-grow min-h-0">
            <header className="flex-shrink-0 mb-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Live Event Stack</h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-bold">{reports.length} events</span> &middot; Updated: just now
                    </div>
                </div>
                 <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full mr-1.5"></span>Vehicle</div>
                    <div className="flex items-center"><span className="w-2.5 h-2.5 bg-red-500 rounded-full mr-1.5"></span>Crime</div>
                    <div className="flex items-center"><span className="w-2.5 h-2.5 bg-gray-400 rounded-full mr-1.5"></span>Other</div>
                </div>
            </header>
            <div className="flex-grow space-y-3 overflow-y-auto pr-1">
                {reports.map(report => (
                    <EventCard
                        key={report.id}
                        report={report}
                        onSelect={() => onReportSelect(report.id)}
                        isSelected={report.id === selectedReportId}
                    />
                ))}
            </div>
        </div>
    );
};

export default LiveEventStack;
