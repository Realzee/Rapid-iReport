
import React from 'react';
import { Report, VehicleReport, Severity } from '../types';
import { format } from 'date-fns';

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

const severityBgStyles: Record<Severity, string> = {
    [Severity.CRITICAL]: 'bg-red-500/20 hover:bg-red-500/30',
    [Severity.HIGH]: 'bg-orange-500/20 hover:bg-orange-500/30',
    [Severity.MEDIUM]: 'bg-blue-500/20 hover:bg-blue-500/30',
    [Severity.LOW]: 'bg-green-500/20 hover:bg-green-500/30',
};

const severityTagStyles: Record<Severity, string> = {
    [Severity.CRITICAL]: 'bg-red-500 text-white',
    [Severity.HIGH]: 'bg-orange-500 text-white',
    [Severity.MEDIUM]: 'bg-blue-500 text-white',
    [Severity.LOW]: 'bg-green-500 text-white',
};

const LiveEventItem: React.FC<{ report: Report, isSelected: boolean, onSelect: () => void }> = ({ report, isSelected, onSelect }) => {
    const title = getReportTitle(report);
    const bgStyle = severityBgStyles[report.severity];
    const tagStyle = severityTagStyles[report.severity];

    return (
        <div
            onClick={onSelect}
            className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${isSelected ? 'border-blue-500 bg-blue-700/60' : `border-transparent ${bgStyle}`}`}
        >
            <div className="flex justify-between items-start">
                <p className="font-semibold text-white text-md">{title}</p>
                <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm text-gray-300">{report.ob_number}</p>
                    <p className="text-xs text-gray-400">{format(new Date(report.reported_at), 'hh:mm:ss a')}</p>
                </div>
            </div>
            
            <span className={`mt-2 inline-block px-2.5 py-0.5 text-xs font-bold rounded-full capitalize ${tagStyle}`}>
                {report.severity}
            </span>

            <p className="mt-2 text-sm text-gray-300 line-clamp-2">{report.description}</p>
        </div>
    );
};


interface LiveEventStackProps {
    reports: Report[];
    onReportSelect: (id: string) => void;
    selectedReportId: string | null;
}

const LiveEventStack: React.FC<LiveEventStackProps> = ({ reports, onReportSelect, selectedReportId }) => {
    return (
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 h-full flex flex-col text-white backdrop-blur-lg">
            <div className="flex-shrink-0 mb-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Live Event Stack</h2>
                    <div className="text-right">
                        <p className="text-sm">{reports.length} events</p>
                        <p className="text-xs text-gray-400">Updated: Just now</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4 text-xs mt-2 text-gray-400">
                    <span><span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1.5"></span>Vehicle</span>
                    <span><span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-1.5"></span>Crime</span>
                    <span><span className="inline-block w-2 h-2 bg-gray-500 rounded-full mr-1.5"></span>Other</span>
                </div>
            </div>

            <div className="flex-grow space-y-3 overflow-y-auto pr-1">
                {reports.map(report => (
                    <LiveEventItem
                        key={report.id}
                        report={report}
                        isSelected={report.id === selectedReportId}
                        onSelect={() => onReportSelect(report.id)}
                    />
                ))}
            </div>
        </div>
    );
};

export default LiveEventStack;
