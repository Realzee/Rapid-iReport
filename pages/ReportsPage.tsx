import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { Report, ReportStatus, Severity, VehicleReport, CrimeReport, Profile, Responder, UserRole, ResponderStatus } from '../types';
import { format } from 'date-fns';
import { CarIcon, CrimeIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon } from '../components/icons';
import StatusBadge from '../components/StatusBadge';
import ReportDetailModal from '../components/ReportDetailModal';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

type SortKey = keyof VehicleReport | keyof CrimeReport | 'type' | 'reported_by_name';

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
    const [reports, setReports] = useState<(Report & {type: 'vehicle' | 'crime'})[]>([]);
    const [users, setUsers] = useState<Pick<Profile, 'id' | 'full_name'>[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<{ type: 'all' | 'vehicle' | 'crime', severity: Severity | 'all' }>({
        type: 'all',
        severity: 'all'
    });
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'reported_at', direction: 'descending' });

    const [detailModalReport, setDetailModalReport] = useState<Report | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(15);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [
                { data: vehicleData, error: vError },
                { data: crimeData, error: cError },
                { data: usersData, error: uError },
                { data: respondersData, error: rError }
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*').eq('status', ReportStatus.DELETED),
                supabase.from('crime_reports').select('*').eq('status', ReportStatus.DELETED),
                supabase.from('profiles').select('id, full_name'),
                supabase.from('profiles').select('*').eq('role', UserRole.RESPONDER)
            ]);

            if (vError || cError || uError || rError) console.error("Error fetching data:", vError || cError || uError || rError);
            else {
                const combined = [
                    ...(vehicleData || []).map(r => ({ ...r, type: 'vehicle' })),
                    ...(crimeData || []).map(r => ({ ...r, type: 'crime' }))
                ] as (Report & {type: 'vehicle' | 'crime'})[];
                setReports(combined);
                setUsers(usersData || []);
                setResponders((respondersData || []).map(p => ({
                    id: p.id,
                    full_name: p.full_name,
                    status: p.responder_status || ResponderStatus.OFF_DUTY,
                    location_coords: p.location_coords || undefined,
                })));
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    const userMap = useMemo(() => new Map(users.map(u => [u.id, u.full_name])), [users]);

    const processedReports = useMemo(() => {
        let filtered = reports
            .map(r => ({ ...r, reported_by_name: userMap.get(r.reported_by) || 'Unknown' }))
            .filter(report => {
                const searchMatch = searchTerm === '' ||
                    report.ob_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (isVehicleReport(report) && report.license_plate.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (!isVehicleReport(report) && report.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    report.description.toLowerCase().includes(searchTerm.toLowerCase());
                
                const typeMatch = filters.type === 'all' || report.type === filters.type;
                const severityMatch = filters.severity === 'all' || report.severity === filters.severity;

                return searchMatch && typeMatch && severityMatch;
            });
        
        if (sortConfig !== null) {
            filtered.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof typeof a];
                const bValue = b[sortConfig.key as keyof typeof b];
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
    
    const filterInputClasses = "bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md py-2 px-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500";

    if (loading) {
        return <div className="flex justify-center items-center h-full"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    return (
        <div className="container mx-auto">
             <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Incident Archives</h2>
             <p className="text-gray-500 dark:text-gray-400 mb-6">This section contains all deleted and archived incident reports for historical record-keeping.</p>
             
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
                        </select>
                     </div>
                      <div>
                        <select value={filters.severity} onChange={e => handleFilterChange('severity', e.target.value)} className={`${filterInputClasses} w-full capitalize`}>
                            <option value="all">All Severities</option>
                            {Object.values(Severity).map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                        </select>
                     </div>
                 </div>
             </div>

             <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl backdrop-blur-lg shadow-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                            <SortableHeader label="Title / Plate" sortKey={'title'} sortConfig={sortConfig} onSort={handleSort} />
                            <SortableHeader label="OB Number" sortKey="ob_number" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableHeader label="Severity" sortKey="severity" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableHeader label="Reported At" sortKey="reported_at" sortConfig={sortConfig} onSort={handleSort} />
                            <SortableHeader label="Reported By" sortKey="reported_by_name" sortConfig={sortConfig} onSort={handleSort} />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {paginatedReports.map(report => (
                            <tr key={report.id} onClick={() => setDetailModalReport(report)} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer">
                                <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center gap-2 text-sm">{isVehicleReport(report) ? <CarIcon className="w-5 h-5 text-yellow-500" /> : <CrimeIcon className="w-5 h-5 text-red-500"/>} <span className="capitalize">{report.type}</span></div></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{isVehicleReport(report) ? report.license_plate : report.title}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">{report.ob_number}</td>
                                <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={report.status} /></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">{report.severity}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{format(new Date(report.reported_at), 'yyyy-MM-dd HH:mm')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{(report as any).reported_by_name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
             
             <div className="mt-6 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600 dark:text-gray-400 gap-4">
                 <p>Showing <span className="font-bold">{processedReports.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}</span> to <span className="font-bold">{Math.min(currentPage * itemsPerPage, processedReports.length)}</span> of <span className="font-bold">{processedReports.length}</span> results</p>
                 <div className="flex items-center gap-2">
                     <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Previous</button>
                     <span className="px-2">Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
                     <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Next</button>
                 </div>
             </div>
             <ReportDetailModal 
                isOpen={!!detailModalReport}
                onClose={() => setDetailModalReport(null)}
                report={detailModalReport}
                responders={responders}
                profile={profile}
            />
        </div>
    );
};

export default ReportsPage;