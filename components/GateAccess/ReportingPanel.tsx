import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { GateAccessLog } from '../../types';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ChartBarIcon, DownloadIcon, AlertTriangleIcon } from '../icons';

const ReportingPanel: React.FC<{ profileId: string, companyId?: string }> = ({ profileId, companyId }) => {
    const [logs, setLogs] = useState<GateAccessLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'today' | '7days' | '30days'>('today');

    useEffect(() => {
        fetchReportData();
    }, [dateRange, companyId]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            let startDate = startOfDay(new Date());
            
            if (dateRange === '7days') startDate = subDays(new Date(), 7);
            if (dateRange === '30days') startDate = subDays(new Date(), 30);

            let query = supabase
                .from('gate_access_logs')
                .select('*')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endOfDay(new Date()).toISOString());
                
            if (companyId) {
                query = query.eq('company_id', companyId);
            }

            const { data, error } = await query;
            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error("Error fetching report data:", error);
        } finally {
            setLoading(false);
        }
    };

    const totalEntries = logs.filter(l => l.direction === 'entry').length;
    const totalExits = logs.filter(l => l.direction === 'exit').length;
    const wantedVehicles = logs.filter(l => l.is_wanted).length;
    const uniqueVehicles = new Set(logs.map(l => l.license_plate)).size;

    const handleExportCSV = () => {
        if (!logs.length) return;
        const headers = ['Time', 'Plate', 'Gate', 'Action', 'Is Wanted', 'Logged by User ID'];
        const csvRows = [headers.join(',')];
        
        for (const log of logs) {
            const time = format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss');
            const row = [
                time,
                log.license_plate,
                `"${log.gate_name.replace(/"/g, '""')}"`,
                log.direction,
                log.is_wanted ? 'Yes' : 'No',
                log.logged_by
            ];
            csvRows.push(row.join(','));
        }
        
        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `gate_access_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                    <ChartBarIcon className="w-6 h-6 text-blue-500" />
                    Site Activity Reports
                </h3>
                
                <div className="flex items-center gap-2">
                    <select 
                        value={dateRange} 
                        onChange={(e) => setDateRange(e.target.value as any)}
                        className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="today">Today</option>
                        <option value="7days">Last 7 Days</option>
                        <option value="30days">Last 30 Days</option>
                    </select>
                    <button 
                        onClick={handleExportCSV}
                        disabled={logs.length === 0}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Export to CSV
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                            <p className="text-sm text-gray-500 font-medium">Total Entries</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{totalEntries}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                            <p className="text-sm text-gray-500 font-medium">Total Exits</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{totalExits}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                            <p className="text-sm text-gray-500 font-medium">Unique Vehicles</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{uniqueVehicles}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-5 shadow-sm">
                            <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                <AlertTriangleIcon className="w-4 h-4" />
                                Wanted Vehicles Scanned
                            </p>
                            <p className="text-3xl font-black text-red-700 dark:text-red-300 mt-1">{wantedVehicles}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                            <h4 className="font-bold text-gray-900 dark:text-white">Access Logs ({logs.length})</h4>
                        </div>
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            {logs.length > 0 ? (
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Time</th>
                                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Plate</th>
                                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Gate</th>
                                            <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {logs.slice(0, 100).map((log) => (
                                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                <td className="px-6 py-3 text-sm text-gray-500 whitespace-nowrap">
                                                    {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm')}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className="font-mono font-bold text-gray-900 dark:text-white">{log.license_plate}</span>
                                                    {log.is_wanted && <span className="ml-2 text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded font-bold">WANTED</span>}
                                                </td>
                                                <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">{log.gate_name}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`inline-flex px-2 py-1 rounded text-xs font-bold uppercase ${log.direction === 'entry' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                                                        {log.direction}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="py-12 text-center text-gray-500">
                                    No access logs found for the selected period.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ReportingPanel;
