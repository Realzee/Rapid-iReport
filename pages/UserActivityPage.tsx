import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { UserActivityLog, UserRole, Profile } from '../types';
import { safeFormat } from '../utils/dateUtils';
import { DownloadIcon, FilterIcon, ClockIcon, SearchIcon } from '../components/icons';
import { useToast } from '../contexts/ToastContext';

interface UserActivityPageProps {
    profile: Profile;
}

const UserActivityPage: React.FC<UserActivityPageProps> = ({ profile }) => {
    const [logs, setLogs] = useState<UserActivityLog[]>(() => {
        try {
            const cached = localStorage.getItem(`user_activity_logs_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(() => {
        try {
            const cached = localStorage.getItem(`user_activity_logs_${profile.id}`);
            return !cached;
        } catch {
            return true;
        }
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('all');
    const { addToast } = useToast();

    useEffect(() => {
        try {
            if (logs.length > 0) {
                localStorage.setItem(`user_activity_logs_${profile.id}`, JSON.stringify(logs));
            }
        } catch (e) {
            console.warn("Error caching user activity logs:", e);
        }
    }, [logs, profile.id]);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const isGlobalAdmin = profile?.role === UserRole.ADMIN && (profile.company?.name?.toLowerCase().includes('rapid911') || false);

            let query = supabase
                .from('user_activity_logs')
                .select(`
                    *,
                    profile:profiles!inner(
                        first_name, 
                        surname, 
                        email, 
                        role,
                        company_id,
                        company:companies(name)
                    )
                `);

            if (!isGlobalAdmin && profile?.company_id) {
                query = query.eq('profile.company_id', profile.company_id);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(250);

            if (error) {
                console.error('Error fetching logs:', error);
                addToast(`Error fetching activity logs: ${error.message}. Please ensure the table exists and RLS policies allow access.`, 'error');
                setLogs([]);
            } else {
                setLogs(data || []);
            }
        } catch (err: any) {
            console.error('Exception fetching logs:', err);
            addToast(`Fatal error fetching logs: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = 
            (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.profile?.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.profile?.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.profile?.surname || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesAction = actionFilter === 'all' || log.action === actionFilter;

        return matchesSearch && matchesAction;
    });

    const handleExportCSV = () => {
        const headers = ['ID', 'User', 'Email', 'Role', 'Company', 'Action', 'Details', 'Timestamp'];
        const csvContent = [
            headers.join(','),
            ...filteredLogs.map(log => {
                const company = log.profile?.company;
                const companyName = Array.isArray(company) ? (company[0] as any)?.name : (company as any)?.name;
                
                return [
                    log.id,
                    `"${log.profile?.first_name || ''} ${log.profile?.surname || ''}"`,
                    `"${log.profile?.email || ''}"`,
                    `"${log.profile?.role || ''}"`,
                    `"${companyName || ''}"`,
                    `"${log.action}"`,
                    `"${(log.details || '').replace(/"/g, '""')}"`,
                    `"${log.created_at}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `user_activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <ClockIcon className="w-8 h-8 text-blue-600 dark:text-blue-400"/> User Activity Logs
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Monitor user actions and system events.</p>
                </div>
                 <div className="flex gap-2">
                    <button 
                        onClick={fetchLogs}
                        disabled={loading}
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                    >
                        <FilterIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                    <button 
                        onClick={handleExportCSV}
                        className="px-4 py-2 bg-blue-600 border border-transparent text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>Export CSV</span>
                    </button>
                 </div>
            </div>

            {/* Controls */}
            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-grow">
                        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search by user, action, or details..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                        />
                    </div>
                    <div className="min-w-[200px]">
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                        >
                            <option value="all">All Actions</option>
                            <option value="CREATE_REPORT">Create Report</option>
                            <option value="UPDATE_REPORT">Update Report</option>
                            <option value="DELETE_REPORT">Delete Report</option>
                            <option value="USER_LOGIN">User Login</option>
                            <option value="USER_SIGNOUT">User Signout</option>
                            <option value="UPDATE_SETTING">Update Setting</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-500 dark:text-gray-400">Loading activity data...</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="py-20 text-center">
                            <ClockIcon className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No actions found</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">Try adjusting your filters or search term.</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                            <thead className="bg-gray-50 dark:bg-gray-800/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                                {filteredLogs.map((log) => {
                                    const company = log.profile?.company;
                                    const companyName = Array.isArray(company) ? (company[0] as any)?.name : (company as any)?.name;
                                    
                                    return (
                                        <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                                {log.created_at ? safeFormat(log.created_at, 'MMM d, HH:mm:ss') : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                        {log.profile ? `${log.profile.first_name} ${log.profile.surname}` : 'Unknown User'}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        {log.profile?.email || log.user_id}
                                                    </span>
                                                    {companyName && (
                                                        <span className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                                                            {companyName}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider
                                                    ${log.action.includes('DELETE') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                                                      log.action.includes('CREATE') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                                                      log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 
                                                      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                    {log.action.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-md truncate" title={log.details}>
                                                {log.details}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserActivityPage;
