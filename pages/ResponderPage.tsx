

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Report, ReportStatus, Profile, ResponderStatus, VehicleReport, ReportUpdate } from '../types';
import { supabase } from '../utils/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import StatusBadge from '../components/StatusBadge';
import { NavigationIcon, CameraIcon } from '../components/icons';

interface ResponderPageProps {
    profile: Profile;
    setProfile: (profile: Profile) => void;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const ResponderStatusBadge: React.FC<{ status: ResponderStatus }> = ({ status }) => {
    const styles: Record<ResponderStatus, string> = {
        [ResponderStatus.AVAILABLE]: 'bg-green-500/20 text-green-400 border-green-500/30',
        [ResponderStatus.EN_ROUTE]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        [ResponderStatus.ON_SCENE]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        [ResponderStatus.OFF_DUTY]: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return (
        <span className={`px-3 py-1 text-xs font-bold rounded-full capitalize border ${styles[status] || styles.off_duty}`}>
            {status.replace(/_/g, ' ')}
        </span>
    );
};

// Main page component
const ResponderPage: React.FC<ResponderPageProps> = ({ profile, setProfile }) => {
    const [assignedReports, setAssignedReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const locationWatchId = useRef<number | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isSharingLocation, setIsSharingLocation] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTimestamp, setLastSyncTimestamp] = useState<Date | null>(null);

    const isOnDuty = profile.responder_status !== ResponderStatus.OFF_DUTY;
    const isEngaged = profile.responder_status === ResponderStatus.EN_ROUTE || profile.responder_status === ResponderStatus.ON_SCENE;


    useEffect(() => {
        const fetchAssignedReports = async () => {
            setLoading(true);
            const { data: vData, error: vError } = await supabase.from('vehicle_reports').select('*').eq('assigned_to', profile.id);
            const { data: cData, error: cError } = await supabase.from('crime_reports').select('*').eq('assigned_to', profile.id);
            if (vError || cError) console.error("Error fetching reports:", vError || cError);
            else {
                const combined = [...(vData || []), ...(cData || [])].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
                setAssignedReports(combined);
                if (combined.length > 0 && !selectedReportId) setSelectedReportId(combined[0].id);
            }
            setLoading(false);
        };
        fetchAssignedReports();
    }, [profile.id]);
    
    useEffect(() => {
        const handleUpsert = (payload: any) => {
            const newReport = payload.new as Report;
            if (newReport.assigned_to !== profile.id) {
                setAssignedReports(prev => prev.filter(r => r.id !== newReport.id));
                return;
            };
            setAssignedReports(prev => {
                const exists = prev.some(r => r.id === newReport.id);
                if (exists) return prev.map(r => r.id === newReport.id ? newReport : r);
                const updatedReports = [newReport, ...prev];
                if (!selectedReportId) setSelectedReportId(newReport.id);
                return updatedReports;
            });
        };
        const handleDelete = (payload: any) => setAssignedReports(prev => prev.filter(r => r.id !== payload.old.id));

        const channel = supabase.channel('responder-reports')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports', filter: `assigned_to=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports', filter: `assigned_to=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, (payload) => { if ((payload.old as Report)?.assigned_to === profile.id) handleDelete(payload)})
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, (payload) => { if ((payload.old as Report)?.assigned_to === profile.id) handleDelete(payload)})
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [profile.id, selectedReportId]);

     const stopLocationSharing = () => {
        if (locationWatchId.current !== null) {
            navigator.geolocation.clearWatch(locationWatchId.current);
            locationWatchId.current = null;
        }
        setIsSharingLocation(false);
        // Clear location from DB for privacy when sharing is explicitly stopped
        supabase.from('profiles').update({ location_coords: null }).eq('id', profile.id).then(({ error }) => {
            if (error) console.warn("Could not clear location on stop:", error.message);
        });
    };

    const startLocationSharing = () => {
        if (navigator.geolocation && locationWatchId.current === null) {
            setIsSharingLocation(true); // Optimistically set UI
            locationWatchId.current = navigator.geolocation.watchPosition(
                async (position) => {
                    setIsSyncing(true);
                    setLocationError(null);
                    const { latitude, longitude } = position.coords;
                    const { error } = await supabase.from('profiles').update({ location_coords: { lat: latitude, lng: longitude } }).eq('id', profile.id);

                    if (error) {
                        console.error("Failed to update location:", error);
                        setLocationError(`Failed to sync location: ${error.message}`);
                        stopLocationSharing();
                    } else {
                        setLastSyncTimestamp(new Date());
                    }
                    setIsSyncing(false);
                },
                (geoError) => {
                    console.warn(`Location sharing error:`, geoError);
                    setLocationError(`Location Error: ${geoError.message}. Please enable location services.`);
                    stopLocationSharing(); // Stop if there's a geo error
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
            );
        }
    };

    const handleDutyToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDutyStatus = e.target.checked;
        
        const newResponderStatus = newDutyStatus ? ResponderStatus.AVAILABLE : ResponderStatus.OFF_DUTY;
        setLastSyncTimestamp(null);
        setLocationError(null);
    
        const updatePayload: { responder_status: ResponderStatus; location_coords?: null } = {
            responder_status: newResponderStatus,
        };
    
        // If going off-duty, stop sharing location and clear coordinates in the same atomic update.
        if (!newDutyStatus) {
            if (locationWatchId.current !== null) {
                navigator.geolocation.clearWatch(locationWatchId.current);
                locationWatchId.current = null;
            }
            setIsSharingLocation(false);
            updatePayload.location_coords = null;
        }
    
        const { data: updatedProfile, error } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', profile.id)
            .select()
            .single();

        if (error) {
            console.error("Failed to update duty status:", error);
            setLocationError(`Failed to update duty status: ${error.message}`);
        } else if (updatedProfile) {
            setProfile(updatedProfile);
        }
    };
    
    const handleLocationToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const shouldShare = e.target.checked;
        if (shouldShare) {
            startLocationSharing();
        } else {
            stopLocationSharing();
        }
    };

    useEffect(() => {
        // This effect ensures location sharing stops if the component unmounts for any reason.
        return () => {
            if (locationWatchId.current !== null) {
                navigator.geolocation.clearWatch(locationWatchId.current);
            }
        };
    }, []);
    
    const selectedReport = useMemo(() => assignedReports.find(r => r.id === selectedReportId), [assignedReports, selectedReportId]);

    return (
        <div className="space-y-6">
            <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg sticky top-24 z-10">
                <h3 className="text-lg font-bold mb-2">On-Duty Manager</h3>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer" title={isEngaged ? "You must resolve active incidents to go off-duty." : "Toggle duty status"}>
                            <input type="checkbox" checked={isOnDuty} onChange={handleDutyToggle} className="sr-only peer" disabled={isEngaged} />
                            <div className="w-14 h-8 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-green-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"></div>
                        </label>
                        <span className="font-semibold text-lg">{isOnDuty ? 'On Duty' : 'Off Duty'}</span>
                    </div>
                    {profile.responder_status && <ResponderStatusBadge status={profile.responder_status} />}
                </div>
                 {isEngaged && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                        You are on an active assignment. Resolve it before going off-duty.
                    </p>
                )}
                 {isOnDuty && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
                        <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={isSharingLocation} onChange={handleLocationToggle} className="sr-only peer" />
                                    <div className="w-14 h-8 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                                <span className="font-semibold text-lg">Share Location</span>
                            </div>
                            <div className="text-sm">
                                {locationError ? (
                                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                        <span className="relative flex h-3 w-3"><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
                                        <span>Error</span>
                                    </div>
                                ) : isSharingLocation ? (
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-2">
                                            <span className="relative flex h-3 w-3">
                                                {isSyncing && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>}
                                                <span className={`relative inline-flex rounded-full h-3 w-3 ${isSyncing ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                                            </span>
                                            <span className="text-green-600 dark:text-green-400">Active</span>
                                        </div>
                                        {lastSyncTimestamp && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Last sync: {formatDistanceToNow(lastSyncTimestamp, { addSuffix: true })}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                        <span className="relative flex h-3 w-3"><span className="relative inline-flex rounded-full h-3 w-3 bg-gray-500"></span></span>
                                        <span>Inactive</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {locationError && <div className="bg-red-500/10 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-r-lg" role="alert"><p className="font-bold">System Error</p><p>{locationError}</p></div>}
            
            {loading ? <div className="flex justify-center items-center h-64"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
            : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="lg:col-span-1 space-y-3 lg:h-[calc(100vh-22rem)] lg:overflow-y-auto">
                        <h2 className="text-xl font-bold px-1">Assigned Incidents ({assignedReports.length})</h2>
                        {assignedReports.length === 0 ? <p className="text-center py-10 text-gray-500 dark:text-gray-400">Stand by for assignments.</p> 
                        : assignedReports.map(report => (
                            <div key={report.id} onClick={() => setSelectedReportId(report.id)} 
                                className={`p-3 cursor-pointer rounded-lg border-2 transition-all ${selectedReportId === report.id ? 'bg-blue-500/10 border-blue-500' : 'bg-white/70 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600'}`}>
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-md truncate pr-2">{isVehicleReport(report) ? report.license_plate : report.title}</h3>
                                    <StatusBadge status={report.status} />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{isVehicleReport(report) ? `${report.vehicle_make} ${report.vehicle_model}` : report.crime_type}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">{formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}</p>
                            </div>
                        ))}
                    </div>

                    <div className="lg:col-span-2 lg:sticky lg:top-24">
                        {selectedReport ? <ResponderReportDetail key={selectedReport.id} report={selectedReport} profile={profile} /> : 
                        <div className="h-full bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg flex items-center justify-center min-h-[50vh]">
                            <p className="text-gray-500 dark:text-gray-400">Select an incident to view details.</p>
                        </div>}
                    </div>
                </div>
            )}
        </div>
    );
};

const ResponderReportDetail: React.FC<{ report: Report, profile: Profile }> = ({ report, profile }) => {
    const [updates, setUpdates] = useState<ReportUpdate[]>([]);
    const [newUpdate, setNewUpdate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const fetchUpdates = async () => { 
            const { data } = await supabase.from('report_updates').select('*, profile:profiles(full_name)').eq('report_id', report.id).order('created_at');
            setUpdates(data?.map(u => ({...u, user_full_name: (u.profile as any)?.full_name || 'System'})) || []);
        };
        fetchUpdates();
        const channel = supabase.channel(`updates-${report.id}`).on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'report_updates', filter: `report_id=eq.${report.id}`}, () => fetchUpdates()).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [report.id]);

    const handleStatusUpdate = async (status: ReportStatus) => {
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
    
        // FIX: Supabase client methods return a "thenable" builder, not a raw Promise.
        // To fix the TypeScript error, the `updatePromises` array should be typed to accept `PromiseLike<any>`.
        const updatePromises: PromiseLike<any>[] = [];
    
        const isResolving = status === ReportStatus.RESOLVED || status === ReportStatus.RECOVERED;
    
        const reportUpdatePayload: { status: ReportStatus; assigned_to?: null } = { status };
        if (isResolving) {
            // When resolving or recovering, unassign the responder from the report.
            reportUpdatePayload.assigned_to = null;
        }
    
        // 1. Update the report's status (and assignment if resolving)
        updatePromises.push(supabase.from(tableName).update(reportUpdatePayload).eq('id', report.id));
    
        // 2. Log the status change in the incident log
        updatePromises.push(supabase.from('report_updates').insert({ report_id: report.id, user_id: profile.id, content: `Status changed to: ${status.replace(/_/g, ' ')}` }));
    
        // 3. Update the responder's own status in the profiles table
        let newResponderStatus: ResponderStatus | null = null;
        if (status === ReportStatus.IN_PROGRESS) {
            newResponderStatus = ResponderStatus.EN_ROUTE;
        } else if (status === ReportStatus.ON_SCENE) {
            newResponderStatus = ResponderStatus.ON_SCENE;
        } else if (isResolving) {
            // When resolving, check if there are any other active assignments.
            // If not, the responder becomes available again.
            const { count: vehicleCount, error: vError } = await supabase
                .from('vehicle_reports')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', profile.id)
                .neq('id', report.id)
                .in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
    
            const { count: crimeCount, error: cError } = await supabase
                .from('crime_reports')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', profile.id)
                .neq('id', report.id)
                .in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
            
            if (vError || cError) {
                console.error("Could not check for other active reports:", vError || cError);
                // Fail gracefully - don't change responder status if we can't verify.
            } else {
                const hasOtherActiveAssignments = (vehicleCount !== null && vehicleCount > 0) || (crimeCount !== null && crimeCount > 0);
                if (!hasOtherActiveAssignments) {
                    newResponderStatus = ResponderStatus.AVAILABLE;
                }
            }
        }
    
        if (newResponderStatus && profile.responder_status !== newResponderStatus) {
            updatePromises.push(supabase.from('profiles').update({ responder_status: newResponderStatus }).eq('id', profile.id));
        }
        
        // Execute all updates
        const results = await Promise.all(updatePromises);
        const errors = results.map(r => r.error).filter(Boolean);
        if (errors.length > 0) {
            alert('An error occurred while updating status. Please check the console.');
            console.error('Status update errors:', errors);
        }
    };
    

    const handlePostUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUpdate.trim()) return;
        setIsSubmitting(true);
        await supabase.from('report_updates').insert({ report_id: report.id, user_id: profile.id, content: newUpdate });
        setNewUpdate('');
        setIsSubmitting(false);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        setIsUploading(true);
        const file = e.target.files[0];
        const filePath = `${report.id}/${file.name}-${Date.now()}`;
        const { error: uploadError } = await supabase.storage.from('evidence').upload(filePath, file);
        if (uploadError) { alert("Upload failed: " + uploadError.message); setIsUploading(false); return; }

        const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(filePath);
        const updatedImages = [...(report.evidence_images || []), publicUrl];
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        await supabase.from(tableName).update({ evidence_images: updatedImages }).eq('id', report.id);
        setIsUploading(false);
    };

    const actionButtonClasses = "w-full text-center py-3 px-4 font-semibold rounded-lg transition-transform duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed";
    const isTerminalStatus = report.status === ReportStatus.RESOLVED || report.status === ReportStatus.RECOVERED || report.status === ReportStatus.CLOSED;
    
    return (
        <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg">
            <h2 className="text-2xl font-bold">{isVehicleReport(report) ? report.license_plate : report.title}</h2>
            <p className="font-mono text-sm text-gray-500 dark:text-gray-400 mb-4">{report.ob_number}</p>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => handleStatusUpdate(ReportStatus.IN_PROGRESS)} disabled={isTerminalStatus || report.status === ReportStatus.IN_PROGRESS} className={`${actionButtonClasses} bg-blue-600 text-white`}>En Route</button>
                <button onClick={() => handleStatusUpdate(ReportStatus.ON_SCENE)} disabled={isTerminalStatus || report.status === ReportStatus.ON_SCENE} className={`${actionButtonClasses} bg-yellow-500 text-white`}>On Scene</button>
                <button onClick={() => handleStatusUpdate(ReportStatus.RESOLVED)} disabled={isTerminalStatus} className={`${actionButtonClasses} bg-green-600 text-white`}>Resolve</button>
                {isVehicleReport(report) && (
                    <button onClick={() => handleStatusUpdate(ReportStatus.RECOVERED)} disabled={isTerminalStatus} className={`${actionButtonClasses} bg-teal-500 text-white`}>
                        Recovered
                    </button>
                )}
            </div>

            <a href={`https://www.google.com/maps/search/?api=1&query=${report.location_coords?.lat},${report.location_coords?.lng}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full text-center py-3 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors mb-4"><NavigationIcon className="w-5 h-5"/> Navigate to Scene</a>

            <div className="space-y-4">
                <div><h4 className="font-bold">Location</h4><p>{isVehicleReport(report) ? report.last_seen_location : report.location}</p></div>
                <div><h4 className="font-bold">Description</h4><p className="whitespace-pre-wrap">{report.description}</p></div>
                {isVehicleReport(report) && <div><h4 className="font-bold">Vehicle</h4><p>{report.vehicle_color} {report.vehicle_make} {report.vehicle_model}</p></div>}
                
                <div>
                    <h4 className="font-bold mb-2">Evidence</h4>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        {report.evidence_images?.map(img => <img key={img} src={img} className="w-full h-24 object-cover rounded-md" alt="Evidence" />)}
                    </div>
                    <label htmlFor="evidence-upload" className="w-full flex items-center justify-center gap-2 cursor-pointer py-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors">
                        <CameraIcon className="w-5 h-5" /> {isUploading ? "Uploading..." : "Add Evidence"}
                        <input id="evidence-upload" type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                    </label>
                </div>

                <div>
                    <h4 className="font-bold mb-2">Incident Log</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-100 dark:bg-gray-800/50 p-2 rounded-md mb-2">
                        {updates.map(u => <div key={u.id} className="text-sm"><p>{u.content}</p><p className="text-xs text-gray-500 text-right">- {u.user_full_name} ({formatDistanceToNow(new Date(u.created_at), {addSuffix: true})})</p></div>)}
                    </div>
                    <form onSubmit={handlePostUpdate} className="flex gap-2">
                        <input type="text" value={newUpdate} onChange={e => setNewUpdate(e.target.value)} placeholder="Post an update..." className="flex-grow bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md p-2 text-sm" />
                        <button type="submit" disabled={isSubmitting} className="px-4 bg-blue-600 text-white rounded-md font-semibold disabled:opacity-50">Post</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ResponderPage;
