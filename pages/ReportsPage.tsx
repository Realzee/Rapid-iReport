
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { Report, ReportStatus, Severity, VehicleReport, EmergencyReport, CrimeReport, Profile, Responder, UserRole, ResponderStatus, Company } from '../types';
import { format } from 'date-fns';
import { CarIcon, CrimeIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon, AlertTriangleIcon, GlobeIcon, UsersIcon } from '../components/icons';
import ReportDetailModal from '../components/ReportDetailModal';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;
const isEmergencyReport = (report: Report): report is EmergencyReport => 'emergency_type' in report;

const severityStyles: Record<Severity, string> = {
    [Severity.CRITICAL]: 'bg-red-500/20 text-red-400 border-red-500/30',
    [Severity.HIGH]: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    [Severity.MEDIUM]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    [Severity.LOW]: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const severityOrder: Record<Severity, number> = {
    [Severity.CRITICAL]: 0,
    [Severity.HIGH]: 1,
    [Severity.MEDIUM]: 2,
    [Severity.LOW]: 3,
};

type SortKey = keyof VehicleReport | keyof CrimeReport | keyof EmergencyReport | 'type' | 'reported_by_name' | 'deleted_by_name' | 'achieved_at' | 'company_name';

const SortableHeader: React.FC<{
    label: string;
    sortKey: SortKey;
    sortConfig: { key: SortKey; direction: string } | null;
    onSort: (key: SortKey) => void;
}> = ({ label, sortKey, sortConfig, onSort }) => {
    const isSorting = sortConfig?.key === sortKey;
    const directionIcon = isSorting ? (sortConfig.direction === 'ascending' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />) : null;
    
    return (
        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => onSort(sortKey)}>
            <div className="flex items-center gap-1">{label} {directionIcon}</div>
        </th>
    );
};

interface ReportsPageProps {
    profile: Profile;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ profile }) => {
    const [reports, setReports] = useState<(Report & {type: 'vehicle' | 'crime' | 'emergency'})[]>([]);
    const [users, setUsers] = useState<Profile[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<{ type: 'all' | 'vehicle' | 'crime' | 'emergency', severity: Severity | 'all' }>({
        type: 'all',
        severity: 'all'
    });
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'reported_at', direction: 'descending' });

    const [detailModalReport, setDetailModalReport] = useState<Report | null>(null);
    const [reportToRestore, setReportToRestore] = useState<Report | null>(null);
    const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
    const { addToast } = useToast();

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(15);

    const fetchData = async () => {
        setLoading(true);

        const usersQuery = supabase.from('profiles').select('*');
        const respondersQuery = supabase.from('profiles').select('*').eq('role', UserRole.RESPONDER);
        const terminalStatuses = [ReportStatus.RESOLVED, ReportStatus.REJECTED, ReportStatus.RECOVERED, ReportStatus.CLOSED, ReportStatus.DELETED];

        if (profile.role !== UserRole.ADMIN && profile.company_id) {
            usersQuery.eq('company_id', profile.company_id);
            respondersQuery.eq('company_id', profile.company_id);
        }

        const [
            { data: vehicleData, error: vError },
            { data: crimeData, error: cError },
            { data: emergencyData, error: aError },
            { data: usersData, error: uError },
            { data: respondersData, error: rError },
            { data: companiesData, error: compError }
        ] = await Promise.all([
            supabase.from('vehicle_reports').select('*').in('status', terminalStatuses),
            supabase.from('crime_reports').select('*').in('status', terminalStatuses),
            supabase.from('emergency_reports').select('*').in('status', terminalStatuses),
            usersQuery,
            respondersQuery,
            supabase.from('companies').select('*')
        ]);

        if (vError || cError || aError || uError || rError || compError) console.error("Error fetching data:", vError || cError || aError || uError || rError || compError);
        else {
            const combined = [
                ...(vehicleData || []).map(r => ({ ...r, type: 'vehicle' })),
                ...(crimeData || []).map(r => ({ ...r, type: 'crime' })),
                ...(emergencyData || []).map(r => ({ ...r, type: 'emergency' }))
            ] as (Report & {type: 'vehicle' | 'crime' | 'emergency'})[];
            setReports(combined);
            setUsers(usersData || []);
            setCompanies(companiesData || []);
            const companiesMap = new Map((companiesData || []).map(c => [c.id, c]));
            setResponders((respondersData || []).map(p => ({
                id: p.id,
                first_name: p.first_name,
                surname: p.surname,
                status: p.responder_status || ResponderStatus.OFF_DUTY,
                location_coords: p.location_coords || undefined,
                company_logo_url: p.company_id ? companiesMap.get(p.company_id)?.logo_url : undefined,
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [profile]);

    const userMap = useMemo(() => new Map(users.map(u => [u.id, `${u.first_name} ${u.surname}`])), [users]);
    const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);

    const isGlobalAdmin = useMemo(() => 
        profile.role === UserRole.ADMIN && (profile.company?.name?.toLowerCase().includes('rapid911') || false),
    [profile]);

    const processedReports = useMemo(() => {
        let filtered = reports
            .map(r => ({ 
                ...r,
                achieved_at: r.status === ReportStatus.DELETED ? r.deleted_at : r.completed_at,
                reported_by_name: userMap.get(r.reported_by) || 'Unknown',
                deleted_by_name: userMap.get(r.deleted_by || '') || 'N/A',
                company_name: companyMap.get(r.company_id || '') || 'N/A'
            }))
            .filter(report => {
                const searchMatch = searchTerm === '' ||
                    report.ob_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (isVehicleReport(report) && report.license_plate.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (isEmergencyReport(report) && report.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (!isVehicleReport(report) && !isEmergencyReport(report) && report.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    report.description.toLowerCase().includes(searchTerm.toLowerCase());
                
                const typeMatch = filters.type === 'all' || report.type === filters.type;
                const severityMatch = filters.severity === 'all' || report.severity === filters.severity;

                return searchMatch && typeMatch && severityMatch;
            });
        
        if (sortConfig !== null) {
            filtered.sort((a: any, b: any) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Logical sorting for severity
                if (sortConfig.key === 'severity') {
                    aValue = severityOrder[a.severity as Severity] ?? 99;
                    bValue = severityOrder[b.severity as Severity] ?? 99;
                }

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        
        return filtered;
    }, [reports, searchTerm, filters, sortConfig, userMap]);
    
    const paginatedReports = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return processedReports.slice(startIndex, startIndex + itemsPerPage);
    }, [processedReports, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(processedReports.length / itemsPerPage);

    const handleSort = (key: SortKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (filterType: 'type' | 'severity', value: string) => {
        setFilters(prev => ({ ...prev, [filterType]: value as any }));
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };
    
    const handleRestoreClick = (report: Report) => {
        setReportToRestore(report);
    };

    const handleConfirmRestore = async () => {
        if (!reportToRestore) return;

        let tableName = '';
        if (isVehicleReport(reportToRestore)) tableName = 'vehicle_reports';
        else if (isEmergencyReport(reportToRestore)) tableName = 'emergency_reports';
        else tableName = 'crime_reports';

        const { error } = await supabase
            .from(tableName)
            .update({ status: ReportStatus.PENDING, deleted_at: null, deleted_by: null, completed_at: null })
            .eq('id', reportToRestore.id);

        if (error) {
            addToast(`Error restoring report: ${error.message}`, 'error');
        } else {
            addToast('Report restored successfully. It has been moved to the active queue.', 'success');
            setReports(prev => prev.filter(r => r.id !== reportToRestore!.id));
        }
        setReportToRestore(null);
    };

    const handleDeleteClick = (report: Report) => {
        setReportToDelete(report);
    };

    const handleConfirmDelete = async () => {
        if (!reportToDelete) return;

        let tableName = '';
        if (isVehicleReport(reportToDelete)) tableName = 'vehicle_reports';
        else if (isEmergencyReport(reportToDelete)) tableName = 'emergency_reports';
        else tableName = 'crime_reports';

        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', reportToDelete.id);

        if (error) {
            addToast(`Error deleting report: ${error.message}`, 'error');
        } else {
            addToast('Report permanently deleted from archives.', 'success');
            setReports(prev => prev.filter(r => r.id !== reportToDelete!.id));
        }
        setReportToDelete(null);
    };

    const filterInputClasses = "bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500";

    if (loading) {
        return <div className="flex justify-center items-center h-full"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    return (
        <div className="container mx-auto">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Incident Archives</h2>
                    <p className="text-gray-500 dark:text-gray-400">This section contains all resolved, recovered, closed, and deleted reports for historical record-keeping.</p>
                </div>
                <button onClick={fetchData} className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                    Refresh Archives
                </button>
             </div>
             
             <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="w-5 h-5 text-gray-400" /></div>
                        <input type="text" placeholder="Search archives..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${filterInputClasses} w-full !pl-10`} />
                     </div>
                     <div>
                        <select value={filters.type} onChange={e => handleFilterChange('type', e.target.value)} className={`${filterInputClasses} w-full`}>
                            <option value="all">All Types</option>
                            <option value="vehicle">Vehicle</option>
                            <option value="crime">Crime</option>
                            <option value="emergency">Emergency</option>
                        </select>
                     </div>
                      <div>
                        <select value={filters.severity} onChange={e => handleFilterChange('severity', e.target.value)} className={`${filterInputClasses} w-full`}>
                            <option value="all">All Severities</option>
                            {Object.values(Severity).map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                        </select>
                     </div>
                </div>
             </div>
            
             <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                            <tr>
                                <SortableHeader label="Type" sortKey="type" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="OB Number / Title" sortKey="ob_number" sortConfig={sortConfig} onSort={handleSort} />
                                {isGlobalAdmin && <SortableHeader label="Company" sortKey="company_name" sortConfig={sortConfig} onSort={handleSort} />}
                                <SortableHeader label="Severity" sortKey="severity" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Reported At" sortKey="reported_at" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Reported By" sortKey="reported_by_name" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Final Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Date Achieved" sortKey="achieved_at" sortConfig={sortConfig} onSort={handleSort} />
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {paginatedReports.map(report => (
                                <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-full ${report.type === 'vehicle' ? 'bg-yellow-500/20' : (report.type === 'emergency' ? 'bg-orange-500/20' : 'bg-red-500/20')}`}>
                                                {report.type === 'vehicle' ? <CarIcon className="w-4 h-4 text-yellow-600" /> : (report.type === 'emergency' ? <AlertTriangleIcon className="w-4 h-4 text-orange-600" /> : <CrimeIcon className="w-4 h-4 text-red-600" />)}
                                            </div>
                                            <span className="text-sm capitalize">{report.type}</span>
                                            {report.is_global && (
                                                <GlobeIcon className="w-4 h-4 text-blue-500 ml-1" title="Global Report" />
                                            )}
                                            {!report.is_global && report.shared_with_company_ids && report.shared_with_company_ids.length > 0 && (
                                                <UsersIcon className="w-4 h-4 text-blue-500 ml-1" title="Shared with specific companies" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{isVehicleReport(report) ? report.license_plate : report.title}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">{report.ob_number}</div>
                                    </td>
                                    {isGlobalAdmin && (
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {(report as any).company_name}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full capitalize border ${severityStyles[report.severity]}`}>
                                            {report.severity}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{format(new Date(report.reported_at), 'MMM d, yyyy HH:mm')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{(report as any).reported_by_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">{report.status.replace(/_/g, ' ')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {(report as any).achieved_at ? format(new Date((report as any).achieved_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-4">
                                            <button onClick={() => setDetailModalReport(report)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">View</button>
                                            <button onClick={() => handleRestoreClick(report)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300">Restore</button>
                                            <button onClick={() => handleDeleteClick(report)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                 {/* Pagination */}
                 <nav className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6" aria-label="Pagination">
                    <div className="hidden sm:block">
                        <p className="text-sm text-gray-700 dark:text-gray-400">
                            Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, processedReports.length)}</span> of{' '}
                            <span className="font-medium">{processedReports.length}</span> results
                        </p>
                    </div>
                    <div className="flex-1 flex justify-between sm:justify-end">
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
                            Previous
                        </button>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
                            Next
                        </button>
                    </div>
                </nav>
            </div>
            
            <ReportDetailModal 
                isOpen={!!detailModalReport}
                onClose={() => setDetailModalReport(null)}
                report={detailModalReport}
                responders={responders}
                profile={profile}
                allUsers={users}
                onRefresh={fetchData}
            />

            {reportToRestore && (
                <ConfirmModal
                    isOpen={!!reportToRestore}
                    onClose={() => setReportToRestore(null)}
                    onConfirm={handleConfirmRestore}
                    title="Restore Incident Report"
                    message={`Are you sure you want to restore this report? It will be moved back to the active incident queue with a status of "Pending".`}
                    confirmText="Confirm Restore"
                    confirmVariant="primary"
                />
            )}

            {reportToDelete && (
                <ConfirmModal
                    isOpen={!!reportToDelete}
                    onClose={() => setReportToDelete(null)}
                    onConfirm={handleConfirmDelete}
                    title="Permanently Delete Report"
                    message={`Are you sure you want to PERMANENTLY delete this report? This action cannot be undone and the record will be removed from the database.`}
                    confirmText="Delete Permanently"
                    confirmVariant="danger"
                />
            )}
        </div>
    );
};

export default ReportsPage;
