
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Profile, GateAccessLog, VehicleReport, ReportStatus, Severity } from '../types';
import { useToast } from '../contexts/ToastContext';
import { SearchIcon, ScanIcon, LogOutIcon, LogInIcon, AlertTriangleIcon, CarIcon, ClockIcon, HistoryIcon, MapPinIcon, ChartBarIcon } from '../components/icons';
import { format } from 'date-fns';
import { logUserAction } from '../utils/logger';
import ReportingPanel from '../components/GateAccess/ReportingPanel';

const GateAccessPage: React.FC<{ profile: Profile }> = ({ profile }) => {
    const [activeTab, setActiveTab] = useState<'log' | 'reports'>('log');
    const [logs, setLogs] = useState<GateAccessLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [plate, setPlate] = useState('');
    const [gateName, setGateName] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<{ plate: string; wantedReport?: VehicleReport } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFixedLocation, setIsFixedLocation] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        fetchRecentLogs();
        const subscription = supabase
            .channel('gate_access_logs_changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gate_access_logs' }, () => {
                fetchRecentLogs();
            })
            .subscribe();

        const fetchAllocatedSite = async () => {
             try {
                // Check if guard first
                const { data: guardData, error: guardError } = await supabase
                    .from('guards')
                    .select('site_id, sites(name)')
                    .eq('profile_id', profile.id)
                    .single();
                
                if (guardData?.sites && (guardData.sites as any).name) {
                    setGateName((guardData.sites as any).name);
                    setIsFixedLocation(true);
                    return;
                }

                // Check if supervisor
                const { data: supData, error: supError } = await supabase
                    .from('supervisors')
                    .select('site_id, sites(name)')
                    .eq('profile_id', profile.id)
                    .single();
                
                if (supData?.sites && (supData.sites as any).name) {
                    setGateName((supData.sites as any).name);
                    setIsFixedLocation(true);
                }

             } catch (err) {
                console.error("Error fetching allocated site:", err);
             }
        };

        if (profile.id) {
            fetchAllocatedSite();
        }

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [profile.id]);

    const fetchRecentLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('gate_access_logs')
            .select(`
                *,
                wanted_report:vehicle_reports(*)
            `)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Error fetching logs:', error);
            addToast('Failed to load access logs', 'error');
        } else {
            setLogs(data || []);
        }
        setLoading(false);
    };

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!plate.trim()) return;

        setIsScanning(true);
        try {
            // Check for wanted reports
            const { data: wantedReports, error } = await supabase
                .from('vehicle_reports')
                .select('*')
                .eq('license_plate', plate.trim().toUpperCase())
                .in('status', [ReportStatus.PENDING, ReportStatus.ACTIVE, ReportStatus.IN_PROGRESS])
                .order('reported_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            setScanResult({
                plate: plate.trim().toUpperCase(),
                wantedReport: wantedReports && wantedReports.length > 0 ? wantedReports[0] : undefined
            });

            if (wantedReports && wantedReports.length > 0) {
                addToast('WANTED VEHICLE DETECTED!', 'error');
            }
        } catch (err: any) {
            addToast('Error checking vehicle: ' + err.message, 'error');
        } finally {
            setIsScanning(false);
        }
    };

    const handleLogAccess = async (direction: 'entry' | 'exit') => {
        if (!scanResult) return;
        setIsSubmitting(true);

        const logData = {
            license_plate: scanResult.plate,
            gate_name: gateName || 'Main Gate',
            direction,
            logged_by: profile.id,
            company_id: profile.company_id,
            created_at: new Date().toISOString(),
            is_wanted: !!scanResult.wantedReport,
            wanted_report_id: scanResult.wantedReport?.id || null
        };

        try {
            const promises: Promise<any>[] = [supabase.from('gate_access_logs').insert(logData)];

            if (logData.is_wanted) {
                const alertReport = {
                    title: `WANTED VEHICLE DETECTED AT ${logData.gate_name.toUpperCase()}`,
                    description: `WANTED VEHICLE DETECTED: A wanted vehicle with license plate ${scanResult.plate} has been scanned at ${logData.gate_name} moving ${direction.toUpperCase()}. ${scanResult.wantedReport ? `Original report OB: ${scanResult.wantedReport.ob_number}` : ''}. IMMEDIATE ATTENTION REQUIRED.`,
                    crime_type: 'WANTED_VEHICLE_ALERT',
                    severity: Severity.CRITICAL,
                    status: ReportStatus.ACTIVE,
                    reported_by: profile.id,
                    reported_at: new Date().toISOString(),
                    location: logData.gate_name,
                    ob_number: `WNTD-${Math.floor(1000 + Math.random() * 9000)}-${scanResult.plate.substring(0, 4)}`,
                    company_id: profile.company_id
                };
                promises.push(supabase.from('crime_reports').insert(alertReport));
            }

            const results = await Promise.all(promises);
            
            // Check for errors in results
            results.forEach((res, index) => {
                if (res.error) {
                    console.error("Error in access log / alert creation:", res.error);
                    throw new Error(res.error.message);
                }
            });

            addToast(`Successfully logged ${direction} for ${scanResult.plate}`, 'success');
            if (logData.is_wanted) {
                addToast('Alert dispatched to Control Room!', 'warning');
            }
            logUserAction(profile.id, 'LOG_GATE_ACCESS', `${direction.toUpperCase()} logged for ${scanResult.plate} at ${logData.gate_name}`);
            setScanResult(null);
            setPlate('');
        } catch (error: any) {
            addToast('Failed to log access: ' + error.message, 'error');
        }

        setIsSubmitting(false);
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto w-full px-4 py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                        <ScanIcon className="w-8 h-8 text-blue-600" />
                        Gate Access Control
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">Scan license plates and manage complex entries/exits</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800">
                <button
                    onClick={() => setActiveTab('log')}
                    className={`py-3 px-6 font-semibold text-sm border-b-2 transition-colors ${
                        activeTab === 'log'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <ScanIcon className="w-4 h-4" />
                        Log Entry
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('reports')}
                    className={`py-3 px-6 font-semibold text-sm border-b-2 transition-colors ${
                        activeTab === 'reports'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <ChartBarIcon className="w-4 h-4" />
                        Reports
                    </div>
                </button>
            </div>

            {activeTab === 'log' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
                    {/* Scanner Section */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <ScanIcon className="w-24 h-24" />
                            </div>
                            
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <CarIcon className="w-5 h-5 text-blue-500" />
                                New Scan
                            </h3>

                            <form onSubmit={handleSearch} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">License Plate</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={plate}
                                            onChange={(e) => setPlate(e.target.value)}
                                            placeholder="ABC 123 GP"
                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none uppercase font-bold"
                                        />
                                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gate Name / Location</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={gateName}
                                            onChange={(e) => setGateName(e.target.value)}
                                            placeholder="Main Entrance"
                                            readOnly={isFixedLocation}
                                            className={`w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${isFixedLocation ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        />
                                        <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isScanning || !plate.trim()}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isScanning ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <ScanIcon className="w-5 h-5" />
                                            Scan Vehicle
                                        </>
                                    )}
                                </button>
                            </form>

                            {scanResult && (
                                <div className={`mt-6 p-4 rounded-xl border animate-in slide-in-from-top-4 duration-300 ${scanResult.wantedReport ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'}`}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Result</p>
                                            <p className="text-xl font-black text-gray-900 dark:text-white">{scanResult.plate}</p>
                                        </div>
                                        {scanResult.wantedReport && (
                                            <div className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded flex items-center gap-1 animate-pulse">
                                                <AlertTriangleIcon className="w-3 h-3" />
                                                WANTED
                                            </div>
                                        )}
                                    </div>

                                    {scanResult.wantedReport && (
                                        <div className="mb-4 text-sm text-red-700 dark:text-red-300 bg-white/50 dark:bg-black/20 p-2 rounded border border-red-100 dark:border-red-900/50">
                                            <p className="font-bold">Match Found: {scanResult.wantedReport.ob_number}</p>
                                            <p className="text-xs opacity-80">{scanResult.wantedReport.vehicle_make} {scanResult.wantedReport.vehicle_model} ({scanResult.wantedReport.vehicle_color})</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => handleLogAccess('entry')}
                                            disabled={isSubmitting}
                                            className="py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors"
                                        >
                                            <LogInIcon className="w-4 h-4" />
                                            Entry
                                        </button>
                                        <button
                                            onClick={() => handleLogAccess('exit')}
                                            disabled={isSubmitting}
                                            className="py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors"
                                        >
                                            <LogOutIcon className="w-4 h-4" />
                                            Exit
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-blue-600 text-white p-6 rounded-2xl shadow-xl">
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                <AlertTriangleIcon className="w-5 h-5" />
                                Compliance Notice
                            </h3>
                            <p className="text-sm opacity-90 leading-relaxed">
                                Always verify the license plate manually before logging. If a WANTED vehicle is flagged, do not confront the driver. Notify your command center immediately.
                            </p>
                        </div>
                    </div>

                    {/* Logs Section */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <HistoryIcon className="w-5 h-5 text-gray-500" />
                                Recent Activity
                            </h3>
                            <button onClick={fetchRecentLogs} className="text-sm text-blue-600 hover:underline">Refresh</button>
                        </div>

                        {loading && logs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="mt-4 text-gray-500">Scanning history...</p>
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                                <ClockIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500">No logs for today yet.</p>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-lg">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Plate</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Gate</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Action</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {logs.map((log) => (
                                                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="font-mono font-black text-gray-900 dark:text-white px-2 py-1 bg-yellow-400/10 dark:bg-yellow-400/20 border border-yellow-400/30 rounded">
                                                            {log.license_plate}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{log.gate_name}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase ${log.direction === 'entry' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                                                            {log.direction === 'entry' ? <LogInIcon className="w-3 h-3" /> : <LogOutIcon className="w-3 h-3" />}
                                                            {log.direction}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {log.is_wanted ? (
                                                            <span className="inline-flex items-center gap-1 text-red-600 font-bold text-xs ring-1 ring-red-600/20 px-2 py-1 rounded-md bg-red-50 dark:bg-red-900/20">
                                                                <AlertTriangleIcon className="w-3 h-3" />
                                                                WANTED
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs italic">Cleared</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 text-right tabular-nums">
                                                        {format(new Date(log.created_at), 'HH:mm:ss')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <ReportingPanel profileId={profile.id} companyId={profile.company_id} />
            )}
        </div>
    );
};

export default GateAccessPage;
