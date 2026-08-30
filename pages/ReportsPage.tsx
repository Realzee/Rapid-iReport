
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { Report, ReportStatus, Severity, VehicleReport, EmergencyReport, CrimeReport, Profile, Responder, UserRole, ResponderStatus, Company, ReportShare, TERMINAL_REPORT_STATUSES } from '../types';
import { format } from 'date-fns';
import { CarIcon, CrimeIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon, AlertTriangleIcon, GlobeIcon, UsersIcon, HistoryIcon, ShareIcon } from '../components/icons';
import ReportDetailModal from '../components/ReportDetailModal';
import ReportModal from '../components/ReportModal';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import { logUserAction } from '../utils/logger';
import { BulkShareModal } from '../components/BulkShareModal';
import { safeFormat } from '../utils/dateUtils';
import IncidentReportPreviewModal from '../components/IncidentReportPreviewModal';
import { FileText, Printer } from 'lucide-react';

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
    const [reports, setReports] = useState<(Report & {type: 'vehicle' | 'crime' | 'emergency' | 'roadside'})[]>(() => {
        try {
            const cached = localStorage.getItem(`reports_page_reports_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [users, setUsers] = useState<Profile[]>(() => {
        try {
            const cached = localStorage.getItem(`reports_page_users_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [companies, setCompanies] = useState<Company[]>(() => {
        try {
            const cached = localStorage.getItem(`reports_page_companies_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [responders, setResponders] = useState<Responder[]>(() => {
        try {
            const cached = localStorage.getItem(`reports_page_responders_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(() => {
        try {
            const cached = localStorage.getItem(`reports_page_reports_${profile.id}`);
            return !cached;
        } catch {
            return true;
        }
    });

    useEffect(() => {
        if (!profile?.id) return;
        try {
            if (reports.length > 0) {
                localStorage.setItem(`reports_page_reports_${profile.id}`, JSON.stringify(reports));
            }
        } catch (e) {
            console.warn("Error caching reports page reports:", e);
        }
    }, [reports, profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;
        try {
            if (users.length > 0) {
                localStorage.setItem(`reports_page_users_${profile.id}`, JSON.stringify(users));
            }
        } catch (e) {
            console.warn("Error caching reports page users:", e);
        }
    }, [users, profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;
        try {
            if (companies.length > 0) {
                localStorage.setItem(`reports_page_companies_${profile.id}`, JSON.stringify(companies));
            }
        } catch (e) {
            console.warn("Error caching reports page companies:", e);
        }
    }, [companies, profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;
        try {
            if (responders.length > 0) {
                localStorage.setItem(`reports_page_responders_${profile.id}`, JSON.stringify(responders));
            }
        } catch (e) {
            console.warn("Error caching reports page responders:", e);
        }
    }, [responders, profile?.id]);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<{ type: 'all' | 'vehicle' | 'crime' | 'emergency' | 'roadside', severity: Severity | 'all' }>({
        type: 'all',
        severity: 'all'
    });
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'reported_at', direction: 'descending' });

    const [detailModalReport, setDetailModalReport] = useState<Report | null>(null);
    const [incidentReportModalReport, setIncidentReportModalReport] = useState<Report | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(() => {
        return !!localStorage.getItem('new-report');
    });
    const [reportToEdit, setReportToEdit] = useState<Report | null>(() => {
        const savedId = localStorage.getItem('editing-report-id');
        return null;
    });

    const hasRestoredEditRef = useRef(false);

    useEffect(() => {
        if (hasRestoredEditRef.current) return;
        if (reports.length > 0) {
            const savedId = localStorage.getItem('editing-report-id');
            if (savedId) {
                const report = reports.find(r => r.id === savedId);
                if (report) {
                    setReportToEdit(report);
                    setIsReportModalOpen(true);
                } else {
                    localStorage.removeItem('editing-report-id');
                }
            }
            hasRestoredEditRef.current = true;
        }
    }, [reports]);
    const [reportToRestore, setReportToRestore] = useState<Report | null>(null);
    const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
    const [incomingShares, setIncomingShares] = useState<ReportShare[]>([]);
    const { addToast } = useToast();

    const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
    const [isBulkShareOpen, setIsBulkShareOpen] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(15);

    const fetchData = async () => {
        if (reports.length === 0) {
            setLoading(true);
        }

        const usersQuery = supabase.from('profiles').select('*');
        const respondersQuery = supabase.from('profiles').select('*').eq('role', UserRole.RESPONDER);
        const terminalStatuses = TERMINAL_REPORT_STATUSES;

        const isGlobalAdminValue = profile.role === UserRole.ADMIN && (profile.company?.name?.toLowerCase().includes('rapid911') || false);

        if (!isGlobalAdminValue && profile.company_id) {
            usersQuery.eq('company_id', profile.company_id);
            respondersQuery.eq('company_id', profile.company_id);
        }

        let vehicleQuery = supabase.from('vehicle_reports').select('*').in('status', terminalStatuses);
        let crimeQuery = supabase.from('crime_reports').select('*').in('status', terminalStatuses);
        let emergencyQuery = supabase.from('emergency_reports').select('*').in('status', terminalStatuses);

        if (!isGlobalAdminValue && profile.company_id) {
            const filterStr = `company_id.eq.${profile.company_id},is_global.eq.true,shared_with_company_ids.cs.{"${profile.company_id}"}`;
            vehicleQuery = vehicleQuery.or(filterStr);
            crimeQuery = crimeQuery.or(filterStr);
            emergencyQuery = emergencyQuery.or(filterStr);
        }

        const [
            { data: vehicleData, error: vError },
            { data: crimeData, error: cError },
            { data: emergencyData, error: aError },
            { data: usersData, error: uError },
            { data: respondersData, error: rError },
            { data: companiesData, error: compError },
            { data: sharesData, error: sharesError }
        ] = await Promise.all([
            vehicleQuery.order('reported_at', { ascending: false }).limit(200),
            crimeQuery.order('reported_at', { ascending: false }).limit(200),
            emergencyQuery.order('reported_at', { ascending: false }).limit(200),
            usersQuery,
            respondersQuery,
            supabase.from('companies').select('*'),
            profile.company_id 
                ? supabase.from('report_shares').select('*').eq('target_company_id', profile.company_id).eq('status', 'pending')
                : supabase.from('report_shares').select('*').eq('status', 'non-existent')
        ]);

        if (vError || cError || aError || uError || rError || compError || sharesError) {
            console.error("Error fetching data:", vError || cError || aError || uError || rError || compError || sharesError);
        } else {
            const combined = [
                ...(vehicleData || []).map(r => ({ ...r, type: 'vehicle' as const })),
                ...(crimeData || []).map(r => ({ ...r, type: 'crime' as const })),
                ...(emergencyData || []).map(r => ({
                    ...r,
                    type: (r.emergency_type === 'Roadside Assistance' ? 'roadside' : 'emergency') as ('roadside' | 'emergency')
                }))
            ] as (Report & {type: 'vehicle' | 'crime' | 'emergency' | 'roadside'})[];
            setReports(combined);
            setIncomingShares(sharesData || []);
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

    const approveShareRequest = async (share: ReportShare) => {
        try {
            const { error: shareError } = await supabase
                .from('report_shares')
                .update({ status: 'approved', updated_at: new Date().toISOString() })
                .eq('id', share.id);
                
            if (shareError) throw shareError;
            
            const tableName = share.report_type === 'vehicle' 
                ? 'vehicle_reports' 
                : share.report_type === 'emergency' 
                    ? 'emergency_reports' 
                    : 'crime_reports';
                    
            const { data: reportData, error: fetchError } = await supabase
                .from(tableName)
                .select('shared_with_company_ids')
                .eq('id', share.report_id)
                .single();
                
            if (fetchError) throw fetchError;
            
            const currentSharedIds = reportData.shared_with_company_ids || [];
            if (!currentSharedIds.includes(share.target_company_id)) {
                const updatedSharedIds = [...currentSharedIds, share.target_company_id];
                const { error: updateError } = await supabase
                    .from(tableName)
                    .update({ shared_with_company_ids: updatedSharedIds })
                    .eq('id', share.report_id);
                    
                if (updateError) throw updateError;
            }
            
            addToast('Sharing request approved successfully.', 'success');
            logUserAction(profile.id, 'APPROVE_REPORT_SHARE', `Approved report sharing of ${share.report_id} to company ${share.target_company_id}`);
            fetchData();
        } catch (err: any) {
            console.error("Failed to approve share:", err);
            addToast('Failed to approve sharing request: ' + err.message, 'error');
        }
    };

    const rejectShareRequest = async (share: ReportShare) => {
        try {
            const { error } = await supabase
                .from('report_shares')
                .update({ status: 'rejected', updated_at: new Date().toISOString() })
                .eq('id', share.id);
                
            if (error) throw error;
            
            addToast('Sharing request declined.', 'success');
            logUserAction(profile.id, 'REJECT_REPORT_SHARE', `Declined report sharing of ${share.report_id} to company ${share.target_company_id}`);
            fetchData();
        } catch (err: any) {
            console.error("Failed to decline share:", err);
            addToast('Failed to decline sharing request: ' + err.message, 'error');
        }
    };

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
                const cardNumber = (report as any).car_number || (report as any).card_number || '';
                const searchMatch = searchTerm === '' ||
                    report.ob_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    cardNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

    const selectedReports = useMemo(() => {
        return reports.filter(r => selectedReportIds.includes(r.id));
    }, [reports, selectedReportIds]);

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

    const handleEditClick = (report: Report) => {
        setReportToEdit(report);
        localStorage.setItem('editing-report-id', report.id);
        setIsReportModalOpen(true);
        setDetailModalReport(null); // Close detail modal if open
    };

    const handleCloseReportModal = () => {
        setIsReportModalOpen(false);
        setReportToEdit(null);
        localStorage.removeItem('editing-report-id');
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
            logUserAction(profile.id, 'RESTORE_REPORT', `Restored report ${reportToRestore.ob_number} (${reportToRestore.id})`);
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
            logUserAction(profile.id, 'DELETE_REPORT', `Permanently deleted report ${reportToDelete.ob_number} (${reportToDelete.id})`);
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
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                        <HistoryIcon className="w-8 h-8 text-blue-600" /> Incident Archives
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">This section contains all resolved, recovered, closed, and deleted reports for historical record-keeping.</p>
                </div>
                <button onClick={fetchData} className="mt-4 md:mt-0 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                    Refresh Archives
                </button>
             </div>

             {/* Incoming Share Requests Inbox (Admins and Moderators only) */}
             {(profile.role === UserRole.ADMIN || profile.role === UserRole.MODERATOR) && incomingShares.length > 0 && (
                 <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 shadow-sm backdrop-blur-md">
                     <div className="flex items-center gap-2 mb-3">
                         <span className="relative flex h-3 w-3">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                         </span>
                         <h3 className="font-bold text-lg text-amber-800 dark:text-amber-400">Incoming Share Requests ({incomingShares.length})</h3>
                     </div>
                     <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">The following external security companies are requesting to share live incident reports with your command center. Approve to add to your feed.</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {incomingShares.map(share => {
                             const sourceCompany = companies.find(c => c.id === share.source_company_id);
                             return (
                                 <div key={share.id} className="bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                                     <div className="mb-3">
                                         <div className="flex items-center gap-2 mb-1.5">
                                             {sourceCompany?.logo_url ? (
                                                 <img src={sourceCompany.logo_url} alt={sourceCompany.name} className="w-5 h-5 object-contain rounded" />
                                             ) : (
                                                 <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-center text-xs font-bold leading-5">C</span>
                                             )}
                                             <span className="text-xs font-bold text-gray-500 dark:text-gray-400 font-mono tracking-wide">{sourceCompany?.name || 'External Company'}</span>
                                         </div>
                                         <span className="text-xs font-medium text-gray-500 dark:text-gray-400">wants to share:</span>
                                         <div className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1 flex items-center gap-1.5">
                                             <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-[10px] font-bold uppercase">{share.report_type}</span>
                                             <span className="truncate max-w-[150px]">ID: {share.report_id.slice(0, 8)}...</span>
                                         </div>
                                     </div>
                                     <div className="flex gap-2">
                                         <button onClick={() => approveShareRequest(share)} className="flex-1 py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg transition-colors shadow">
                                             Approve
                                         </button>
                                         <button onClick={() => rejectShareRequest(share)} className="flex-1 py-1.5 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-lg transition-colors border border-gray-200 dark:border-gray-700">
                                             Decline
                                         </button>
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                 </div>
             )}
             
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
                            <option value="roadside">Roadside</option>
                            <option value="crime">Crime</option>
                            <option value="emergency">Emergency</option>
                        </select>
                     </div>
                      <div>
                        <select value={filters.severity} onChange={e => handleFilterChange('severity', e.target.value)} className={`${filterInputClasses} w-full uppercase font-bold`}>
                            <option value="all" className="uppercase font-bold">ALL SEVERITIES</option>
                            {Object.values(Severity).map(s => <option key={s} value={s} className="uppercase font-bold">{s.toUpperCase()}</option>)}
                        </select>
                     </div>
                </div>
             </div>
            
             <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left w-10">
                                    <input 
                                        type="checkbox" 
                                        checked={paginatedReports.length > 0 && paginatedReports.every(r => selectedReportIds.includes(r.id))}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const paginatedIds = paginatedReports.map(r => r.id);
                                                setSelectedReportIds(prev => Array.from(new Set([...prev, ...paginatedIds])));
                                            } else {
                                                const paginatedIds = paginatedReports.map(r => r.id);
                                                setSelectedReportIds(prev => prev.filter(id => !paginatedIds.includes(id)));
                                            }
                                        }}
                                        className="rounded border-gray-300 dark:border-gray-750 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    />
                                </th>
                                <SortableHeader label="Type" sortKey="type" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="OB / Car No / Title" sortKey="ob_number" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Company" sortKey="company_name" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Severity" sortKey="severity" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Reported At" sortKey="reported_at" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Reported By" sortKey="reported_by_name" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Final Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                                <SortableHeader label="Date Achieved" sortKey="achieved_at" sortConfig={sortConfig} onSort={handleSort} />
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                            {paginatedReports.map(report => {
                                const isRecoveredOrDeleted = report.status === ReportStatus.RECOVERED || report.status === ReportStatus.DELETED || report.status === ReportStatus.RESOLVED || report.status === 'recovered' || report.status === 'deleted' || report.status === 'resolved';
                                const isGreenStamp = report.status === 'recovered' || report.status === 'resolved' || report.status === ReportStatus.RECOVERED || report.status === ReportStatus.RESOLVED;
                                return (
                                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                    <td className={`px-4 py-4 whitespace-nowrap w-10 ${isRecoveredOrDeleted ? 'opacity-40 grayscale blur-[0.5px]' : ''}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedReportIds.includes(report.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedReportIds(prev => [...prev, report.id]);
                                                } else {
                                                    setSelectedReportIds(prev => prev.filter(id => id !== report.id));
                                                }
                                            }}
                                            className="rounded border-gray-300 dark:border-gray-750 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                        />
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap ${isRecoveredOrDeleted ? 'opacity-40 grayscale blur-[0.5px]' : ''}`}>
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
                                            {profile.company_id && report.company_id && report.company_id !== profile.company_id && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800 leading-none flex-shrink-0" title={`Shared by ${(report as any).company_name || 'Partner Company'}`}>
                                                    Shared
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap relative min-w-[200px]">
                                        {isRecoveredOrDeleted && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 select-none bg-black/5 dark:bg-black/10">
                                                <div className={`border-4 border-double ${
                                                    isGreenStamp 
                                                        ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 bg-emerald-50/95 dark:bg-emerald-950/95 shadow-emerald-500/10' 
                                                        : 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400 bg-rose-50/95 dark:bg-rose-950/95 shadow-rose-500/10'
                                                    } font-black text-xs tracking-widest px-3 py-1 uppercase rounded-md transform -rotate-6 shadow-2xl ring-2 ring-offset-2 ${
                                                    isGreenStamp 
                                                        ? 'ring-emerald-500/20 dark:ring-emerald-400/20 ring-offset-emerald-50 dark:ring-offset-emerald-950' 
                                                        : 'ring-rose-500/20 dark:ring-rose-400/20 ring-offset-rose-50 dark:ring-offset-rose-950'
                                                    } font-mono`}
                                                >
                                                    {report.status.replace(/_/g, ' ')}
                                                </div>
                                            </div>
                                        )}
                                        <div className={isRecoveredOrDeleted ? 'opacity-40 grayscale blur-[0.5px]' : ''}>
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{isVehicleReport(report) ? report.license_plate : report.title}</div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                                {report.type === 'roadside' ? `CAR: ${(report as any).car_number || (report as any).card_number || report.ob_number}` : report.ob_number}
                                            </div>
                                        </div>
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium ${isRecoveredOrDeleted ? 'opacity-40 grayscale blur-[0.5px]' : ''}`}>
                                        {(report as any).company_name || <span className="text-gray-400 text-xs italic">Unknown</span>}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap ${isRecoveredOrDeleted ? 'opacity-40 grayscale blur-[0.5px]' : ''}`}>
                                        <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full capitalize border ${severityStyles[report.severity]}`}>
                                            {report.severity}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${isRecoveredOrDeleted ? 'opacity-40 grayscale blur-[0.5px]' : ''}`}>{safeFormat(report.reported_at, 'MMM d, yyyy HH:mm')}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${isRecoveredOrDeleted ? 'opacity-40 grayscale blur-[0.5px]' : ''}`}>{(report as any).reported_by_name}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase ${isRecoveredOrDeleted ? 'opacity-40 grayscale blur-[0.5px]' : ''}`}>{report.status.replace(/_/g, ' ').toUpperCase()}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${isRecoveredOrDeleted ? 'opacity-40 grayscale' : ''}`}>
                                        {safeFormat((report as any).achieved_at, 'MMM d, yyyy HH:mm', 'N/A')}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${isRecoveredOrDeleted ? 'opacity-40 grayscale' : ''}`}>
                                        <div className="flex items-center justify-end space-x-3">
                                            <button 
                                                onClick={() => setIncidentReportModalReport(report)} 
                                                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 font-medium"
                                                title="Preview and Print Incident Information Report"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                <span>Report</span>
                                            </button>
                                            <button onClick={() => setDetailModalReport(report)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">View</button>
                                            <button onClick={() => handleRestoreClick(report)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300">Restore</button>
                                            <button onClick={() => handleDeleteClick(report)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
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
                onEdit={handleEditClick}
            />

            <ReportModal
                isOpen={isReportModalOpen}
                onClose={handleCloseReportModal}
                reportToEdit={reportToEdit}
                onReportSubmitted={fetchData}
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

            {/* Floating Bulk Actions Bar */}
            {selectedReportIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900/95 dark:bg-gray-950/95 text-white rounded-full px-6 py-3 border border-gray-800 shadow-2xl flex items-center gap-6 animate-fade-in-up backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-white font-black text-xs px-2.5 py-1 rounded-full">{selectedReportIds.length}</span>
                        <span className="text-xs font-bold tracking-wide text-gray-200">Incident report{selectedReportIds.length > 1 ? 's' : ''} selected</span>
                    </div>
                    <div className="flex items-center gap-2.5 border-l border-gray-800 pl-4">
                        <button 
                            type="button"
                            onClick={() => setIsBulkShareOpen(true)} 
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black px-4.5 py-2 rounded-full transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                        >
                            <ShareIcon className="w-3.5 h-3.5" /> Share Selected
                        </button>
                        <button 
                            type="button"
                            onClick={() => setSelectedReportIds([])} 
                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-extrabold px-4 py-2 rounded-full transition-all border border-gray-700 cursor-pointer"
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>
            )}

            <BulkShareModal
                isOpen={isBulkShareOpen}
                onClose={() => {
                    setIsBulkShareOpen(false);
                    setSelectedReportIds([]);
                }}
                selectedReports={selectedReports}
                profile={profile}
                onBulkShared={fetchData}
            />

            <IncidentReportPreviewModal
                isOpen={!!incidentReportModalReport}
                onClose={() => setIncidentReportModalReport(null)}
                report={incidentReportModalReport}
                company={profile.company}
            />
        </div>
    );
};

export default ReportsPage;
