import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { VehicleReport, ReportStatus } from '../types';
import { useToast } from '../contexts/ToastContext';
import { CarIcon, PlusIcon, SearchIcon, AlertTriangleIcon } from './icons';
import ConfirmModal from './ConfirmModal';

interface SoughtListManagerProps {
    onSelectReport: (reportId: string) => void;
    onQuickAdd: () => void;
}

const SoughtListManager: React.FC<SoughtListManagerProps> = ({ onSelectReport, onQuickAdd }) => {
    const [soughtListReports, setSoughtListReports] = useState<VehicleReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [reportToResolve, setReportToResolve] = useState<VehicleReport | null>(null);
    const { addToast } = useToast();

    useEffect(() => {
        const activeStatuses = [ReportStatus.PENDING, ReportStatus.ACTIVE, ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE];

        const fetchSoughtList = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('vehicle_reports')
                .select('*')
                .in('status', activeStatuses)
                .order('reported_at', { ascending: false });
            
            if (error) {
                addToast('Failed to load vehicle sought list.', 'error');
                console.error(error);
            } else {
                setSoughtListReports(data as VehicleReport[]);
            }
            setLoading(false);
        };

        fetchSoughtList();

        const channel = supabase.channel('blacklist-manager-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, (payload) => {
                 setSoughtListReports(currentList => {
                    const newReport = payload.new as VehicleReport;
                    // FIX: Cast payload.old to inform TypeScript that it may contain an 'id' property.
                    const oldId = (payload.old as Partial<VehicleReport>)?.id;
                    const isNowActive = newReport && activeStatuses.includes(newReport.status);

                    if (payload.eventType === 'INSERT' && isNowActive) {
                        return [newReport, ...currentList];
                    }
                    if (payload.eventType === 'UPDATE') {
                        const exists = currentList.some(r => r.id === newReport.id);
                        if (isNowActive) {
                            return exists ? currentList.map(r => r.id === newReport.id ? newReport : r) : [newReport, ...currentList];
                        } else {
                            return currentList.filter(r => r.id !== newReport.id);
                        }
                    }
                    if (payload.eventType === 'DELETE') {
                        return currentList.filter(r => r.id !== oldId);
                    }
                    return currentList;
                 });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [addToast]);
    
    const filteredReports = useMemo(() => {
        const lowercasedTerm = searchTerm.toLowerCase();
        if (!lowercasedTerm) return soughtListReports;
        return soughtListReports.filter(report =>
            report.license_plate.toLowerCase().includes(lowercasedTerm) ||
            report.vehicle_make.toLowerCase().includes(lowercasedTerm) ||
            report.vehicle_model.toLowerCase().includes(lowercasedTerm)
        );
    }, [soughtListReports, searchTerm]);
    
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
            <div className="bg-white/70 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Vehicle Sought List</h3>
                    <button onClick={onQuickAdd} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
                        <PlusIcon className="w-4 h-4" /> Add to List
                    </button>
                </div>
                 <div className="relative mb-4">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="w-5 h-5 text-gray-400" /></div>
                    <input type="text" placeholder="Search by plate or make..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg py-2 pl-10 pr-4" />
                 </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {loading ? <p>Loading sought list...</p> : filteredReports.length === 0 ? (
                        <div className="text-center py-8">
                            <CarIcon className="w-12 h-12 mx-auto text-gray-400" />
                            <p className="mt-2 text-sm text-gray-500">No vehicles on the active sought list.</p>
                        </div>
                    ) : filteredReports.map(report => (
                        <div key={report.id} className="p-2 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <div className="flex-1 min-w-0">
                                    <p className="font-mono font-bold text-lg text-gray-800 dark:text-gray-200 truncate">{report.license_plate}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{report.vehicle_make} {report.vehicle_model} ({report.vehicle_color})</p>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-2">
                                    <button onClick={() => onSelectReport(report.id)} className="px-3 py-1 text-xs font-semibold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">View</button>
                                    <button onClick={() => setReportToResolve(report)} className="px-3 py-1 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700">Resolve</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
             {reportToResolve && (
                <ConfirmModal
                    isOpen={!!reportToResolve}
                    onClose={() => setReportToResolve(null)}
                    onConfirm={handleResolve}
                    title="Resolve Incident"
                    message={`Are you sure you want to mark the report for vehicle <strong>${reportToResolve.license_plate}</strong> as resolved? This will remove it from the active sought list.`}
                    confirmText="Confirm Resolution"
                    confirmVariant="primary"
                />
            )}
        </>
    );
};

export default SoughtListManager;