
import React from 'react';
import { Report, VehicleReport, Severity } from '../types';
import { format } from 'date-fns';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const severityStyles: Record<Severity, { bg: string, text: string, name: string }> = {
    [Severity.CRITICAL]: { bg: 'bg-red-500', text: 'text-red-100', name: 'Critical' },
    [Severity.HIGH]: { bg: 'bg-orange-500', text: 'text-orange-100', name: 'High' },
    [Severity.MEDIUM]: { bg: 'bg-blue-500', text: 'text-blue-100', name: 'Medium' },
    [Severity.LOW]: { bg: 'bg-green-500', text: 'text-green-100', name: 'Low' },
};

const LiveEventItem: React.FC<{ report: Report, isSelected: boolean, onSelect: () => void }> = ({ report, isSelected, onSelect }) => {
    const reportType = isVehicleReport(report) ? 'Stolen Vehicle' : 'Crime';
    const styles = severityStyles[report.severity];

    return (
        <div 
            onClick={onSelect}
            className={`p-4 rounded-lg cursor-pointer transition-all duration-200 border-2 ${isSelected ? 'border-blue-500 bg-gray-700' : 'border-transparent bg-gray-800 hover:bg-gray-700/80'}`}
        >
            <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-2">
                    <span className={`px-2 py-1 text-xs font-bold rounded ${styles.bg} ${styles.text}`}>{styles.name}</span>
                    <p className="font-semibold text-white mt-1">{reportType}</p>
                </div>
                <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm text-gray-300">{report.ob_number}</p>
                    <p className="text-xs text-gray-400">{format(new Date(report.reported_at), 'HH:mm a')}</p>
                </div>
            </div>
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
