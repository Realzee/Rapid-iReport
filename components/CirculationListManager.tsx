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
        
        const { error } = await supabase
            .from('vehicle_reports')
            .update({ status: ReportStatus.RESOLVED })
            .eq('id', reportToResolve.id);

        if (error) {
            addToast(`Failed to resolve report for ${reportToResolve.license_plate}: ${error.message}`, 'error');
        } else {
            addToast(`Report for ${reportToResolve.license_plate} has been resolved.`, 'success');
        }
        setReportToResolve(null);
    };

    return (
        <>
            <div className="bg-white/70 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 backdrop-blur-lg shadow-lg flex flex-col md:flex-row md:items-center gap-4">
                {/* Header/Title Section */}
                <div className="w-full md:w-auto flex-shrink-0 flex items-center justify-between md:justify-start gap-2 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 pb-3 md:pb-0 md:pr-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                            <AlertTriangleIcon className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div>
                            <h3 className="text-md font-bold leading-tight">Circulation List</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{circulationListReports.length} Active</p>
                        </div>
                    </div>
                     <div className="flex md:hidden items-center gap-2">
                        <button onClick={onQuickAdd} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" title="Quick Add to List">
                            <PlusIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Main Content: Search and Scrollable List */}
                <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 min-w-0 w-full">
                    {/* Add & Search */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button onClick={onQuickAdd} className="hidden md:flex flex-shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" title="Quick Add to List">
                            <PlusIcon className="w-4 h-4" />
                        </button>
                        <div className="relative flex-grow sm:flex-grow-0">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="w-4 h-4 text-gray-400" /></div>
                            <input 
                                type="text" 
                                placeholder="Search list..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="w-full sm:w-32 bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg py-2 pl-9 pr-2 text-sm focus:w-48 transition-all duration-300" 
                            />
                        </div>
                    </div>
                    
                    {/* Horizontal Scroll List */}
                    <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-2 -mb-2 w-full">
                        {loading ? (
                            <div className="text-sm text-gray-500">Loading...</div>
                        ) : filteredReports.length === 0 ? (
                            <div className="text-sm text-gray-500 text-center w-full">No active vehicles on the circulation list.</div>
                        ) : (
                            filteredReports.map(report => (
                                <div key={report.id} className="flex-shrink-0 w-60 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-2">
                                    <div>
                                        <p className="font-mono font-bold text-lg text-gray-800 dark:text-gray-200 truncate">{report.license_plate}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{report.vehicle_make} {report.vehicle_model} ({report.vehicle_color})</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => onSelectReport(report.id)} className="w-full px-2 py-1 text-xs font-semibold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">View</button>
                                        <button onClick={() => setReportToResolve(report)} className="w-full px-2 py-1 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700">Resolve</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
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
