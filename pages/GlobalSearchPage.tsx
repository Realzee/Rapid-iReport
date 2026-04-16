import React, { useState, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { VehicleReport, ReportStatus } from '../types';
import { useToast } from '../contexts/ToastContext';
import { SearchIcon, CarIcon, MapPinIcon, CheckCircleIcon } from '../components/icons';
import { format } from 'date-fns';
import ReportDetailModal from '../components/ReportDetailModal';

const GlobalSearchPage: React.FC<{ profile: any; isGlobalAdmin: boolean }> = ({ profile, isGlobalAdmin }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<VehicleReport[]>([]);
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();
    const [selectedReport, setSelectedReport] = useState<VehicleReport | null>(null);

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return;

        setLoading(true);
        try {
            let dbQuery = supabase.from('vehicle_reports').select('*');

            // Constructing a search that covers license plate, cas_number, vin_number, engine_number, vehicle_make, vehicle_model
            // and ob_number since it acts as a global lookup.
            dbQuery = dbQuery.or(`license_plate.ilike.%${query}%,cas_number.ilike.%${query}%,vin_number.ilike.%${query}%,engine_number.ilike.%${query}%,ob_number.ilike.%${query}%,vehicle_make.ilike.%${query}%,vehicle_model.ilike.%${query}%`);

            // Admins can see specific scopes
            if (!isGlobalAdmin && profile.company_id) {
                dbQuery = dbQuery.eq('company_id', profile.company_id);
            }

            const { data, error } = await dbQuery.order('reported_at', { ascending: false }).limit(100);

            if (error) throw error;
            
            const reportsWithType = (data || []).map(r => ({ ...r, type: 'vehicle' as const }));
            setResults(reportsWithType as VehicleReport[]);
            if (reportsWithType.length === 0) {
                addToast('No vehicles found matching that query.', 'info');
            }
        } catch (error: any) {
            console.error('Search error:', error);
            addToast('Error performing search.', 'error');
        } finally {
            setLoading(false);
        }
    }, [query, isGlobalAdmin, profile.company_id, addToast]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SearchIcon className="w-6 h-6 text-blue-500" />
                        Global Vehicle Search
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Search vehicle reports by Registration, Make, Model, or Case Number.
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
                    className="flex items-center gap-2"
                >
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                            placeholder="Search by license plate, make, case number..."
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
                    >
                        {loading && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        Search
                    </button>
                </form>
            </div>

            {results.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reg / Make / Model</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Color</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">COS Info</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Case / Station</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">IO Info</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {results.map((report) => (
                                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-900 dark:text-white">{report.license_plate}</div>
                                            <div className="text-gray-500 dark:text-gray-400">{report.vehicle_make} {report.vehicle_model}</div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-900 dark:text-white capitalize">{report.vehicle_color}</td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate" title={report.description}>
                                            {report.description}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-gray-900 dark:text-white">{report.cos_name || '-'}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{report.cos_contact_number || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-gray-900 dark:text-white">{report.cas_number || '-'}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                <MapPinIcon className="w-3 h-3" />
                                                {report.station_name || '-'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-gray-900 dark:text-white">{report.io_name || '-'}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{report.io_contact || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                {report.status === ReportStatus.RECOVERED ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                        <CheckCircleIcon className="w-3 h-3 mr-1" /> Recovered
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 capitalize">
                                                        {report.status.replace('_', ' ')}
                                                    </span>
                                                )}
                                                {report.has_tracker && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                        Has Tracker
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {format(new Date(report.reported_at), 'MMM d, yyyy HH:mm')}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button 
                                                onClick={() => setSelectedReport(report)}
                                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedReport && (
                <ReportDetailModal
                    isOpen={!!selectedReport}
                    onClose={() => setSelectedReport(null)}
                    report={selectedReport as any}
                    responders={[]}
                    allUsers={[]}
                    profile={profile as any}
                    onRefresh={handleSearch}
                />
            )}
        </div>
    );
};

export default GlobalSearchPage;
