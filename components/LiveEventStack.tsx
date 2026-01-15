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

const severityCardBg: Record<Severity, string> = {
    [Severity.CRITICAL]: 'bg-red-900/60 hover:bg-red-900/80',
    [Severity.HIGH]: 'bg-orange-900/60 hover:bg-orange-900/80',
    [Severity.MEDIUM]: 'bg-slate-800 hover:bg-slate-700',
    [Severity.LOW]: 'bg-green-900/60 hover:bg-green-900/80',
};

const severityTag: Record<Severity, string> = {
    [Severity.CRITICAL]: 'bg-red-500 text-white',
    [Severity.HIGH]: 'bg-orange-500 text-white',
    [Severity.MEDIUM]: 'bg-gray-200 text-gray-800 font-bold',
    [Severity.LOW]: 'bg-green-400 text-green-900 font-bold',
};


const LiveEventItem: React.FC<{ report: Report, isSelected: boolean, onSelect: () => void }> = ({ report, isSelected, onSelect }) => {
    const title = getReportTitle(report);

    return (
        <div
            onClick={onSelect}
            className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${isSelected ? 'border-blue-500 bg-blue-900/90' : `border-transparent ${severityCardBg[report.severity]}`}`}
        >
            <div className="flex justify-between items-start gap-2">
                <p className="font-semibold text-white text-md">{title}</p>
                <div className="text-right flex-shrink-0">
                    <p className="font-mono text-xs text-gray-300">{report.ob_number}</p>
                    <p className="text-xs text-gray-400">{format(new Date(report.reported_at), 'HH:mm:ss a')}</p>
                </div>
            </div>
            <div className="mt-2">
                 <span className={`px-2 py-0.5 text-xs rounded capitalize ${severityTag[report.severity]}`}>
                    {report.severity}
                </span>
            </div>
            <p className="mt-2 text-sm text-gray-300 line-clamp-3">{report.description}</p>
            {report.location_coords && (
                 <p className="mt-2 text-xs text-gray-400 font-mono flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    {report.location_coords.lat.toFixed(6)} {report.location_coords.lng.toFixed(6)}
                </p>
            )}
            {isVehicleReport(report) && (
                <div className="mt-2 pt-2 border-t border-gray-700/50 text-xs text-gray-400 font-mono flex justify-between items-center gap-2">
                    <span>PLATE: <span className="font-sans font-semibold text-white bg-gray-700 px-1 rounded">{report.license_plate}</span></span>
                    <span>MAKE: <span className="font-sans font-semibold text-white">{report.vehicle_make}</span></span>
                    <span>COLOR: <span className="font-sans font-semibold text-white">{report.vehicle_color}</span></span>
                </div>
            )}
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
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 flex flex-col text-white backdrop-blur-lg">
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

            <div className="space-y-2">
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
