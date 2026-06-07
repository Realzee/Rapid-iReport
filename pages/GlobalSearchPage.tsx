import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { VehicleReport, ReportStatus } from '../types';
import { useToast } from '../contexts/ToastContext';
import { SearchIcon, CarIcon, MapPinIcon, CheckCircleIcon } from '../components/icons';
import { format } from 'date-fns';
import ReportDetailModal from '../components/ReportDetailModal';
import AddLegacyReportModal from '../components/AddLegacyReportModal';

const GlobalSearchPage: React.FC<{ profile: any; isGlobalAdmin: boolean }> = ({ profile, isGlobalAdmin }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<VehicleReport[]>([]);
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();
    const [selectedReport, setSelectedReport] = useState<VehicleReport | null>(null);
    const [showLegacyAdd, setShowLegacyAdd] = useState(false);
    const [editingLegacyReport, setEditingLegacyReport] = useState<VehicleReport | null>(null);

    const [totalVehicles, setTotalVehicles] = useState<number | null>(null);

    useEffect(() => {
        // Fetch total global vehicle count
        const fetchTotalCount = async () => {
            try {
                const res = await fetch('/api/legacy-api?action=count');
                if (res.ok) {
                    const data = await res.json();
                    setTotalVehicles(data.total);
                }
            } catch (err) {
                console.error("Failed to fetch total vehicles count:", err);
            }
        };
        fetchTotalCount();
    }, []);

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return;

        setLoading(true);
        try {
            // Race the internal search and the legacy external search
            const [supabaseResult, legacyResult] = await Promise.allSettled([
                (async () => {
                    const { data, error } = await supabase
                       .from('vehicle_reports')
                       .select('*')
                       .or(`license_plate.ilike.%${query}%,vehicle_make.ilike.%${query}%,vehicle_model.ilike.%${query}%,cas_number.ilike.%${query}%`);
                    
                    if (error) throw error;
                    return data;
                })(),
                fetch('/api/legacy-api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'search', query })
                }).then(async res => {
                    if (!res.ok) {
                        let msg = 'Legacy search failed';
                        try {
                            const data = await res.json();
                            msg = data.message || data.error || msg;
                        } catch (e) {
                            const text = await res.text().catch(() => '');
                            if (text && text.length < 500) msg = text.replace(/<[^>]*>/g, ' ').substring(0, 200).trim();
                        }
                        throw new Error(msg);
                    }
                    return res.json();
                })
            ]);

            let mergedResults: VehicleReport[] = [];

            // Process Supabase internal results
            if (supabaseResult.status === 'fulfilled' && supabaseResult.value) {
                mergedResults = [...mergedResults, ...supabaseResult.value.map(r => ({ ...r, type: 'vehicle' as const }))];
            } else if (supabaseResult.status === 'rejected') {
                console.log("Global search RPC not installed, using fallback standard query...");
                // Fallback to standard query if RPC doesn't exist yet
                let dbQuery = supabase.from('vehicle_reports').select('*');
                dbQuery = dbQuery.or(`license_plate.ilike.%${query}%,cas_number.ilike.%${query}%,vin_number.ilike.%${query}%,engine_number.ilike.%${query}%,ob_number.ilike.%${query}%,vehicle_make.ilike.%${query}%,vehicle_model.ilike.%${query}%`);
                const fallbackResult = await dbQuery.order('reported_at', { ascending: false }).limit(100);
                if (fallbackResult.data) {
                    mergedResults = [...mergedResults, ...fallbackResult.data.map((r: any) => ({ ...r, type: 'vehicle' as const }))];
                }
            }

            // Process legacy system results
            if (legacyResult.status === 'fulfilled' && legacyResult.value) {
                const legacyDataArray = Array.isArray(legacyResult.value) ? legacyResult.value : (legacyResult.value.data || []);
                const legacyItems = legacyDataArray.map((item: any) => {
                    const obMatch = item.reason?.match(/OB NUMBER:\s*(.*?)\)/i) || item.description?.match(/OB NUMBER:\s*(.*?)\)/i);
                    const parsedOb = obMatch ? obMatch[1] : `LEG-OBS-${item.id}`;
                    
                    return {
                        id: String(item.id).startsWith('legacy-') ? item.id : `legacy-${item.id}`,
                        ob_number: parsedOb,
                        license_plate: item.vehicle_registration || item.license_plate || '',
                        vehicle_make: item.make || item.vehicle_make || '',
                        vehicle_model: item.model || item.vehicle_model || '',
                        vehicle_color: item.color || item.vehicle_color || '',
                        last_seen_location: item.station_reported_at || item.station_name || 'Unknown Location',
                        description: `[LEGACY SYSTEM REPORT]\n${item.reason || item.description || ''}`,
                        cas_number: item.case_number || item.cas_number || '',
                        station_name: item.station_reported_at || item.station_name || '',
                        cos_name: item.cos_name || item.cos_name || '',
                        cos_contact_number: item.cos_contact_number || '',
                        io_name: item.io_name || '',
                        io_contact: item.io_contact || '',
                        has_tracker: typeof item.has_tracker === 'boolean' ? item.has_tracker : (item.tracker && item.tracker.toLowerCase() !== 'unknown' ? true : false),
                        status: item.status ? (item.status.toUpperCase() === 'RECOVERED' ? ReportStatus.RECOVERED : ReportStatus.ACTIVE) : (item.recovered ? ReportStatus.RECOVERED : ReportStatus.ACTIVE),
                        severity: 'high' as any,
                        reported_at: (() => {
                            const rawDate = item.reported_at || item.date_of_incident;
                            if (!rawDate) return new Date().toISOString();
                            const d = new Date(rawDate);
                            return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
                        })(),
                        reported_by: 'system',
                        is_legacy: true,
                        type: 'vehicle' as const
                    };
                });
                mergedResults = [...mergedResults, ...legacyItems];
            } else if (legacyResult.status === 'rejected') {
                console.error("Legacy search API failed:", legacyResult.reason);
            }

            setResults(mergedResults as VehicleReport[]);
            if (mergedResults.length === 0) {
                addToast('No vehicles found matching that query across platforms.', 'info');
            }
        } catch (error: any) {
            console.error('Search error:', error);
            addToast('Error performing search.', 'error');
        } finally {
            setLoading(false);
        }
    }, [query, addToast]);

    const handleEditReport = (report: VehicleReport) => {
        if ((report as any).is_legacy || report.id.startsWith('legacy-')) {
            setEditingLegacyReport(report);
            setSelectedReport(null);
        } else {
            addToast('Editing internal reports is not supported from this page yet.', 'info');
        }
    };

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
                {typeof totalVehicles === 'number' && (
                    <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-lg flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Database Records</span>
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{totalVehicles.toLocaleString()}</span>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-between items-center bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-900/30">
                    <div className="text-sm text-red-800 dark:text-red-400 font-medium">
                        Need to register a new vehicle into the legacy system?
                    </div>
                    <button
                        onClick={() => setShowLegacyAdd(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors whitespace-nowrap text-sm shadow-sm flex items-center gap-2"
                    >
                        <CarIcon className="w-4 h-4" />
                        ADD NEW LEGACY ENTRY
                    </button>
                </div>
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
                    <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Found <span className="font-bold text-gray-900 dark:text-white">{results.length}</span> matching records
                        </span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-800/20">
                        {results.map((report) => (
                            <div 
                                key={report.id} 
                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col" 
                                onClick={() => setSelectedReport(report)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1 min-w-0 pr-2">
                                       <div className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2 truncate">
                                           {report.license_plate || 'Unknown Reg'}
                                           {(report as any).is_legacy && (
                                               <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                                                   LEGACY DB
                                               </span>
                                           )}
                                       </div>
                                       <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                           {report.vehicle_make} {report.vehicle_model} {report.vehicle_color ? `• ${report.vehicle_color}` : ''}
                                       </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                         {report.status === ReportStatus.RECOVERED ? (
                                             <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                                                 <CheckCircleIcon className="w-3 h-3 mr-1" /> Recovered
                                             </span>
                                         ) : (
                                             <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 capitalize border border-gray-200 dark:border-gray-600">
                                                 {report.status.replace('_', ' ')}
                                             </span>
                                         )}
                                         {report.has_tracker && (
                                             <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                                 Has Tracker
                                             </span>
                                         )}
                                    </div>
                                </div>

                                <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 min-h-[2.5rem] flex-grow">
                                    {report.description || 'No description provided.'}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700/50">
                                    <div className="truncate pr-2 border-r border-gray-200 dark:border-gray-700">
                                        <span className="block font-semibold text-gray-700 dark:text-gray-300 text-[10px] uppercase tracking-wider mb-0.5">COS</span>
                                        <div className="truncate">{report.cos_name || '-'}</div>
                                        <div className="truncate">{report.cos_contact_number || '-'}</div>
                                    </div>
                                    <div className="truncate pl-1">
                                        <span className="block font-semibold text-gray-700 dark:text-gray-300 text-[10px] uppercase tracking-wider mb-0.5">IO</span>
                                        <div className="truncate">{report.io_name || '-'}</div>
                                        <div className="truncate">{report.io_contact || '-'}</div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-col min-w-0 pr-2">
                                         <span className="font-semibold text-gray-700 dark:text-gray-300 truncate">{report.cas_number || 'No Case'}</span>
                                         <span className="flex items-center gap-1 truncate"><MapPinIcon className="w-3 h-3 flex-shrink-0"/> <span className="truncate">{report.station_name || 'N/A'}</span></span>
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 font-medium flex-shrink-0 whitespace-nowrap">
                                         {(() => {
                                             if (!report.reported_at) return 'Unknown Date';
                                             const d = new Date(report.reported_at);
                                             if (isNaN(d.getTime())) return 'Invalid Date';
                                             return format(d, 'MMM d, yyyy');
                                         })()}
                                    </div>
                                </div>
                            </div>
                        ))}
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
                    onEdit={handleEditReport as any}
                />
            )}

            <AddLegacyReportModal
                isOpen={showLegacyAdd || !!editingLegacyReport}
                onClose={() => {
                    setShowLegacyAdd(false);
                    setEditingLegacyReport(null);
                }}
                report={editingLegacyReport}
                profile={profile}
                onSuccess={() => {
                    addToast(editingLegacyReport ? 'Vehicle successfully updated in Legacy Database!' : 'Vehicle successfully added to Legacy Database!', 'success');
                    handleSearch(); // Refresh search if a user is actively searching
                }}
            />
        </div>
    );
};

export default GlobalSearchPage;
