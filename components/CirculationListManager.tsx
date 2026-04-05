import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { VehicleReport, ReportStatus, Severity, Profile, UserRole } from '../types';
import { useToast } from '../contexts/ToastContext';
import { PlusIcon, SearchIcon, AlertTriangleIcon, FilterIcon, TrashIcon, EyeIcon } from './icons';
import ConfirmModal from './ConfirmModal';

interface CirculationListManagerProps {
    profile: Profile;
    reports: VehicleReport[];
    loading?: boolean;
    onSelectReport: (reportId: string) => void;
    onQuickAdd: () => void;
}

const CirculationListManager: React.FC<CirculationListManagerProps> = ({ profile, reports, loading = false, onSelectReport, onQuickAdd }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [reportToResolve, setReportToResolve] = useState<VehicleReport | null>(null);
    const [isResolving, setIsResolving] = useState<string | null>(null);
    const { addToast } = useToast();

    const circulationListReports = useMemo(() => {
        const activeStatuses = [ReportStatus.PENDING, ReportStatus.ACTIVE, ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE];
        return reports.filter(r => activeStatuses.includes(r.status));
    }, [reports]);
    
    const filteredReports = useMemo(() => {
        const lowercasedTerm = searchTerm.toLowerCase();
        if (!lowercasedTerm) return circulationListReports;
        return circulationListReports.filter(report =>
            report.license_plate.toLowerCase().includes(lowercasedTerm) ||
            (report.vehicle_make && report.vehicle_make.toLowerCase().includes(lowercasedTerm)) ||
            (report.vehicle_model && report.vehicle_model.toLowerCase().includes(lowercasedTerm))
        );
    }, [circulationListReports, searchTerm]);
    
    const handleResolve = async () => {
        if (!reportToResolve) return;
        
        setIsResolving(reportToResolve.id);
        const { error } = await supabase
            .from('vehicle_reports')
            .update({ status: ReportStatus.RESOLVED })
            .eq('id', reportToResolve.id);

        if (error) {
            addToast(`Failed to resolve report for ${reportToResolve.license_plate}: ${error.message}`, 'error');
        } else {
            addToast(`Report for ${reportToResolve.license_plate} has been resolved.`, 'success');
        }
        setIsResolving(null);
        setReportToResolve(null);
    };

    return (
        <>
            <div className="bg-white/70 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg flex flex-col gap-4">
                {/* Header Section */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                            <AlertTriangleIcon className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div>
                            <h3 className="text-md font-bold leading-tight">Circulation List</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{circulationListReports.length} Active Vehicles</p>
                        </div>
                    </div>
                    <button onClick={onQuickAdd} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm" title="Quick Add to List">
                        <PlusIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Add Vehicle</span>
                    </button>
                </div>

                {/* Search Section */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="w-4 h-4 text-gray-400" />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search by plate, make or model..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all" 
                    />
                </div>
                
                {/* Vertical List Section */}
                <div className="max-h-80 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : filteredReports.length === 0 ? (
                        <div className="text-sm text-gray-500 text-center py-8 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                            No active vehicles match your search.
                        </div>
                    ) : (
                        filteredReports.map(report => (
                            <div key={report.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-3 hover:border-blue-300 dark:hover:border-blue-700 transition-all group">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-mono font-bold text-lg text-gray-900 dark:text-white tracking-wider">{report.license_plate}</span>
                                            <span className={`w-2 h-2 rounded-full ${report.severity === Severity.CRITICAL ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                                            {report.vehicle_make} {report.vehicle_model} • {report.vehicle_color}
                                        </p>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-tighter">
                                            Last seen: {report.last_seen_location}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button 
                                            onClick={() => onSelectReport(report.id)} 
                                            className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm transition-all"
                                            title="View Details"
                                        >
                                            <EyeIcon className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => setReportToResolve(report)} 
                                            disabled={isResolving === report.id}
                                            className="p-2 text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center justify-center"
                                            title="Mark as Resolved"
                                        >
                                            {isResolving === report.id ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            ) : <TrashIcon className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {reportToResolve && (
                <ConfirmModal
                    isOpen={!!reportToResolve}
                    onClose={() => setReportToResolve(null)}
                    onConfirm={handleResolve}
                    title="Resolve Incident"
                    message={`Are you sure you want to mark the report for vehicle <strong>${reportToResolve.license_plate}</strong> as resolved? This will remove it from the active circulation list.`}
                    confirmText="Confirm Resolution"
                    confirmVariant="primary"
                />
            )}
        </>
    );
};

export default CirculationListManager;
