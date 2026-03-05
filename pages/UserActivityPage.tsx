import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { UserActivityLog, UserRole } from '../types';
import { format } from 'date-fns';
import { DownloadIcon, FilterIcon, ClockIcon } from '../components/icons';
import { useToast } from '../contexts/ToastContext';

const UserActivityPage: React.FC = () => {
    const [logs, setLogs] = useState<UserActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
    const { addToast } = useToast();

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_activity_logs')
                .select(`
                    *,
                    profile:profiles(first_name, surname, email, role)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching logs:', error);
                // addToast('Error fetching activity logs. Please ensure the user_activity_logs table exists.', 'error');
            } else {
                setLogs(data || []);
            }
        } catch (err) {
            console.error('Exception fetching logs:', err);
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

        const matchesRole = roleFilter === 'all' || log.profile?.role === roleFilter;

        return matchesSearch && matchesRole;
    });

    const handleExportCSV = () => {
        const headers = ['ID', 'User', 'Email', 'Role', 'Action', 'Details', 'Timestamp'];
        const csvContent = [
            headers.join(','),
            ...filteredLogs.map(log => [
                log.id,
                `"${log.profile?.first_name || ''} ${log.profile?.surname || ''}"`,
                log.profile?.email || '',
                log.profile?.role || '',
                `"${log.action}"`,
                `"${log.details}"`,
                `"${log.created_at}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `user_activity_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <ClockIcon className="w-8 h-8"/> User Activity Logs
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Monitor user actions and system events.</p>
                </div>
                 <div className="flex gap-3">
                    <button 
                        onClick={handleExportCSV}
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>Export CSV</span>
                    </button>
                 </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search by user, action, or details..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg py-2 px-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                        />
                    </div>
                    <div className="relative min-w-[200px]">
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                        >
                            <option value="all">All Roles</option>
                            {Object.values(UserRole).map(role => (
                                <option key={role} value={role} className="capitalize">{role}</option>
                            ))}
                        </select>
                        <FilterIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <div className="flex justify-center">
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                        No logs found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {log.profile?.first_name} {log.profile?.surname}
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{log.profile?.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">
                                            {log.profile?.role}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full 
                                                ${log.action.includes('DELETE') ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 
                                                  log.action.includes('CREATE') ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 
                                                  log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 
                                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={log.details}>
                                            {log.details}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserActivityPage;
