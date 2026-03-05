
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Report, ReportStatus, Profile, ResponderStatus, VehicleReport, AccidentReport, ReportUpdate, Profile as UserProfile } from '../types';
import { supabase } from '../utils/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import StatusBadge from '../components/StatusBadge';
import { NavigationIcon, CameraIcon, ScanIcon, XIcon, ChatAlt2Icon, PlusIcon } from '../components/icons';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ResponderMapView from '../components/ResponderMapView';
import ANPRScanner from '../components/ANPRScanner';
import UserReportDetail from '../components/UserReportDetail';
import { useChat } from '../contexts/ChatContext';
import { CONTROLLER_CHANNEL_REPORT } from '../constants';
import { useWakeLock } from '../hooks/useWakeLock';
import ReportModal from '../components/ReportModal';
import ImagePreviewModal from '../components/ImagePreviewModal';

interface ResponderPageProps {
    profile: Profile;
    setProfile: (profile: Profile) => void;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;
const isAccidentReport = (report: Report): report is AccidentReport => 'accident_type' in report;

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
    const { requestWakeLock, releaseWakeLock } = useWakeLock();
    const [assignedReports, setAssignedReports] = useState<Report[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(() => {
        return localStorage.getItem('responder_report_modal_open') === 'true';
    });
    
    useEffect(() => {
        localStorage.setItem('responder_report_modal_open', String(isReportModalOpen));
    }, [isReportModalOpen]);

    const locationWatchId = useRef<number | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isSharingLocation, setIsSharingLocation] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTimestamp, setLastSyncTimestamp] = useState<Date | null>(null);
    const [anprFoundReport, setAnprFoundReport] = useState<VehicleReport | null>(null);

    const isInitialLoad = useRef(true);
    const audioContextRef = useRef<AudioContext | null>(null);
    const { addToast } = useToast();
    const { openChat } = useChat();

    const isOnDuty = profile.responder_status !== ResponderStatus.OFF_DUTY;

    useEffect(() => {
        if (isOnDuty) {
            requestWakeLock();
        } else {
            releaseWakeLock();
        }
        return () => {
            releaseWakeLock();
        };
    }, [isOnDuty, requestWakeLock, releaseWakeLock]);

    // A responder is "engaged" if they have any reports that are not in a terminal state.
    const isEngaged = useMemo(() => 
        assignedReports.some(r => ![
            ReportStatus.RESOLVED,
            ReportStatus.RECOVERED,
            ReportStatus.CLOSED,
            ReportStatus.REJECTED,
        ].includes(r.status)),
    [assignedReports]);

    useEffect(() => {
        // Initialize AudioContext on mount.
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }, []);

    const playAssignmentSound = () => {
        const context = audioContextRef.current;
        if (!context) return;
        if (context.state === 'suspended') {
            context.resume();
        }
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.type = 'sawtooth'; // A more urgent sound
        oscillator.frequency.setValueAtTime(660, context.currentTime); // E5 note
        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.15); // Short and sharp
    };

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            // Fetch assigned reports OR reported by me
            const { data: vData, error: vError } = await supabase.from('vehicle_reports').select('*').or(`assigned_to.eq.${profile.id},reported_by.eq.${profile.id}`);
            const { data: cData, error: cError } = await supabase.from('crime_reports').select('*').or(`assigned_to.eq.${profile.id},reported_by.eq.${profile.id}`);
            const { data: aData, error: aError } = await supabase.from('accident_reports').select('*').or(`assigned_to.eq.${profile.id},reported_by.eq.${profile.id}`);
            const { data: usersData, error: usersError } = await supabase.from('profiles').select('*').eq('company_id', profile.company_id);

            if (vError || cError || aError) console.error("Error fetching reports:", vError || cError || aError);
            else {
                const combined = [...(vData || []), ...(cData || []), ...(aData || [])].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
                setAssignedReports(combined);
                if (combined.length > 0 && !selectedReportId) setSelectedReportId(combined[0].id);
            }
            if(usersError) console.error("Error fetching company users:", usersError);
            else setAllUsers(usersData || []);

            setLoading(false);
            isInitialLoad.current = false;
        };
        fetchInitialData();
    }, [profile.id, profile.company_id]);
    
    useEffect(() => {
        const handleUpsert = (payload: any) => {
            const newReport = payload.new as Report;
            // Check if relevant to us (assigned OR reported by)
            if (newReport.assigned_to !== profile.id && newReport.reported_by !== profile.id) return;

            setAssignedReports(prev => {
                const exists = prev.some(r => r.id === newReport.id);
                if (exists) { // UPDATE
                    return prev.map(r => r.id === newReport.id ? newReport : r);
                }
                
                // NEW assignment. Play sound if assigned to us and not initial load.
                if (!isInitialLoad.current && newReport.assigned_to === profile.id) {
                    playAssignmentSound();
                }

                const updatedReports = [newReport, ...prev];
                setSelectedReportId(currentId => currentId ? currentId : newReport.id);
                return updatedReports;
            });
        };
        
        const handlePotentialUnassignmentOrDelete = (payload: any) => {
            const oldReport = payload.old as Report;
            const newReport = payload.new as Report | undefined;
            
            // If it was assigned to us or reported by us, we might need to remove it
            // But wait, if we reported it, we should still see it even if unassigned.
            // So we only remove if:
            // 1. It was deleted.
            // 2. It was unassigned AND we didn't report it.
            
            // However, payload.old doesn't always have all fields in some Supabase configs (though usually it does for RLS).
            // But let's assume we check the new state.
            
            if (payload.eventType === 'DELETE') {
                 setAssignedReports(prev => prev.filter(r => r.id !== oldReport.id));
                 setSelectedReportId(currentId => currentId === oldReport.id ? null : currentId);
                 return;
            }

            if (payload.eventType === 'UPDATE' && newReport) {
                if (newReport.assigned_to !== profile.id && newReport.reported_by !== profile.id) {
                    // No longer relevant
                    setAssignedReports(prev => prev.filter(r => r.id !== newReport.id));
                    setSelectedReportId(currentId => currentId === newReport.id ? null : currentId);
                }
            }
        };

        const channel = supabase.channel(`responder-reports-${profile.id}`)
            // Listen for changes where assigned_to is us
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports', filter: `assigned_to=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports', filter: `assigned_to=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'accident_reports', filter: `assigned_to=eq.${profile.id}` }, handleUpsert)
            // Listen for changes where reported_by is us
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports', filter: `reported_by=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports', filter: `reported_by=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'accident_reports', filter: `reported_by=eq.${profile.id}` }, handleUpsert)
            
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, handlePotentialUnassignmentOrDelete)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, handlePotentialUnassignmentOrDelete)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'accident_reports' }, handlePotentialUnassignmentOrDelete)
            .subscribe();
        
        return () => { supabase.removeChannel(channel); };
    }, [profile.id]);

    // ... (existing functions)

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
                    
                    if (typeof latitude === 'number' && !isNaN(latitude) && typeof longitude === 'number' && !isNaN(longitude)) {
                        const { error } = await supabase.from('profiles').update({ location_coords: { lat: latitude, lng: longitude } }).eq('id', profile.id);

                        if (error) {
                            console.error("Failed to update location:", error);
                            setLocationError(`Failed to sync location: ${error.message}`);
                            stopLocationSharing();
                        } else {
                            setLastSyncTimestamp(new Date());
                        }
                    } else {
                        console.warn("Invalid coordinates received:", latitude, longitude);
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

    const handleAnprHit = async (reportId: string) => {
        const { data, error } = await supabase
            .from('vehicle_reports')
            .select('*')
            .eq('id', reportId)
            .single();

        if (data) {
            setAnprFoundReport(data as VehicleReport);
        } else {
            addToast('Could not fetch details for the flagged vehicle.', 'error');
            console.error(error);
        }
    };


    return (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-1 space-y-6">
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
                
                {isOnDuty && (
                    <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg space-y-3">
                        <button onClick={() => openChat(CONTROLLER_CHANNEL_REPORT)} className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors">
                            <ChatAlt2Icon className="w-5 h-5" />
                            <span>Open Staff Channel</span>
                        </button>
                        <button onClick={() => setIsReportModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            <PlusIcon className="w-5 h-5" />
                            <span>Create New Report</span>
                        </button>
                    </div>
                )}
                
                {isOnDuty && <ANPRScanner onReportHit={handleAnprHit} />}

                <div className="space-y-3 lg:h-[calc(100vh-22rem)] lg:overflow-y-auto pr-2">
                    <h2 className="text-xl font-bold px-1">Assigned Incidents ({assignedReports.length})</h2>
                     {loading ? <div className="flex justify-center items-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                    : assignedReports.length === 0 ? <p className="text-center py-10 text-gray-500 dark:text-gray-400">Stand by for assignments.</p> 
                    : assignedReports.map(report => (
                        <div key={report.id} onClick={() => setSelectedReportId(report.id)} 
                            className={`p-3 cursor-pointer rounded-lg border-2 transition-all ${selectedReportId === report.id ? 'bg-blue-500/10 border-blue-500' : 'bg-white/70 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600'}`}>
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-md truncate pr-2">{isVehicleReport(report) ? report.license_plate : report.title}</h3>
                                <StatusBadge status={report.status} />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{isVehicleReport(report) ? `${report.vehicle_make} ${report.vehicle_model}` : (isAccidentReport(report) ? report.accident_type : report.crime_type)}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">{formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-2 lg:sticky lg:top-24">
                <div className="space-y-6">
                    <div className="h-[40vh] rounded-2xl overflow-hidden">
                       <ResponderMapView report={selectedReport} responderProfile={profile} />
                    </div>
                    {selectedReport ? <ResponderReportDetail key={selectedReport.id} report={selectedReport} profile={profile} allUsers={allUsers} /> : 
                    <div className="h-full bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg flex items-center justify-center min-h-[50vh]">
                        <p className="text-gray-500 dark:text-gray-400">Select an incident to view details.</p>
                    </div>}
                </div>
            </div>
        </div>

        {anprFoundReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setAnprFoundReport(null)}>
                <div className="relative w-full max-w-lg" onClick={e => e.stopPropagation()}>
                    <div className="absolute -top-3 -right-3 z-10">
                        <button onClick={() => setAnprFoundReport(null)} className="p-2 bg-gray-800/80 rounded-full text-white hover:bg-gray-700 transition">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <UserReportDetail report={anprFoundReport} profile={profile} onEdit={() => {}} allUsers={allUsers} />
                </div>
            </div>
        )}

        <ReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            reportToEdit={null}
        />

        </>
    );
};

const ResponderReportDetail: React.FC<{ report: Report, profile: Profile, allUsers: Profile[] }> = ({ report, profile, allUsers }) => {
    const [updates, setUpdates] = useState<ReportUpdate[]>([]);
    const [newUpdate, setNewUpdate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState<ReportStatus | 'stand_down' | null>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const { addToast } = useToast();
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, confirmText: string, confirmVariant: 'danger' | 'primary' } | null>(null);
    const { openChat } = useChat();

    useEffect(() => {
        const fetchUpdates = async () => { 
            const { data } = await supabase.from('report_updates').select('*, profile:profiles(first_name, surname)').eq('report_id', report.id).order('created_at');
            setUpdates(data?.map(u => {
                const profile = u.profile as { first_name: string, surname: string } | null;
                return {...u, user_full_name: profile ? `${profile.first_name} ${profile.surname}` : 'System'};
            }) || []);
        };
        fetchUpdates();
        const channel = supabase.channel(`updates-${report.id}`).on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'report_updates', filter: `report_id=eq.${report.id}`}, fetchUpdates).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [report.id]);

    const handleStatusUpdate = async (status: ReportStatus) => {
        setIsActionLoading(status);
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : (isAccidentReport(report) ? 'accident_reports' : 'crime_reports');
    
        const updatePromises: PromiseLike<any>[] = [];
    
        const isResolving = status === ReportStatus.RESOLVED || status === ReportStatus.RECOVERED;
    
        const reportUpdatePayload: { status: ReportStatus; assigned_to?: null; completed_at?: string | null } = { status };
        if (isResolving) {
            reportUpdatePayload.assigned_to = null;
            reportUpdatePayload.completed_at = new Date().toISOString();
        }
    
        updatePromises.push(supabase.from(tableName).update(reportUpdatePayload).eq('id', report.id));
        updatePromises.push(supabase.from('report_updates').insert({ report_id: report.id, user_id: profile.id, content: `Status changed to: ${status.replace(/_/g, ' ')}` }));
    
        let newResponderStatus: ResponderStatus | null = null;
        if (status === ReportStatus.IN_PROGRESS) {
            newResponderStatus = ResponderStatus.EN_ROUTE;
        } else if (status === ReportStatus.ON_SCENE) {
            newResponderStatus = ResponderStatus.ON_SCENE;
        } else if (isResolving) {
            const { count: vehicleCount } = await supabase.from('vehicle_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
            const { count: crimeCount } = await supabase.from('crime_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
            
            const hasOtherActiveAssignments = (vehicleCount !== null && vehicleCount > 0) || (crimeCount !== null && crimeCount > 0);
            if (!hasOtherActiveAssignments) {
                newResponderStatus = ResponderStatus.AVAILABLE;
            }
        }
    
        if (newResponderStatus && profile.responder_status !== newResponderStatus) {
            updatePromises.push(supabase.from('profiles').update({ responder_status: newResponderStatus }).eq('id', profile.id));
        }
        
        const results = await Promise.all(updatePromises);
        const errors = results.map((r: any) => r.error).filter(Boolean);
        if (errors.length > 0) {
            addToast('An error occurred while updating status. Please check the console.', 'error');
            console.error('Status update errors:', errors);
        } else {
            addToast(`Status updated to ${status.replace(/_/g, ' ')}.`, 'success');
        }
        setIsActionLoading(null);
    };

    const handleStandDown = () => {
        setConfirmModalState({
            isOpen: true,
            title: 'Stand Down from Incident',
            message: 'Are you sure you want to stand down from this incident? The report will be returned to the active queue.',
            onConfirm: async () => {
                setConfirmModalState(null);
                setIsActionLoading('stand_down');
                try {
                    const tableName = isVehicleReport(report) ? 'vehicle_reports' : (isAccidentReport(report) ? 'accident_reports' : 'crime_reports');
                    const updatePromises: PromiseLike<any>[] = [];
                    updatePromises.push(supabase.from(tableName).update({ assigned_to: null, status: ReportStatus.ACTIVE }).eq('id', report.id));
                    updatePromises.push(supabase.from('report_updates').insert({ report_id: report.id, user_id: profile.id, content: `Responder ${profile.first_name} ${profile.surname} has stood down.` }));

                    const { count: vehicleCount } = await supabase.from('vehicle_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
                    const { count: crimeCount } = await supabase.from('crime_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);

                    const hasOtherActiveAssignments = (vehicleCount !== null && vehicleCount > 0) || (crimeCount !== null && crimeCount > 0);
                    if (!hasOtherActiveAssignments) {
                        updatePromises.push(supabase.from('profiles').update({ responder_status: ResponderStatus.AVAILABLE }).eq('id', profile.id));
                    }
                    const results = await Promise.all(updatePromises);
                    const errors = results.map((r: any) => r.error).filter(Boolean);
                    if (errors.length > 0) throw new Error(errors.map(e => e.message).join('\n'));

                    addToast('Successfully stood down from the incident.', 'info');
                } catch (e: any) {
                    addToast('An error occurred while standing down: ' + e.message, 'error');
                } finally {
                    setIsActionLoading(null);
                }
            },
            confirmText: 'Confirm Stand Down',
            confirmVariant: 'danger'
        });
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
        if (uploadError) { addToast("Upload failed: " + uploadError.message, 'error'); setIsUploading(false); return; }

        const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(filePath);
        const updatedImages = [...(report.evidence_images || []), publicUrl];
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : (isAccidentReport(report) ? 'accident_reports' : 'crime_reports');
        await supabase.from(tableName).update({ evidence_images: updatedImages }).eq('id', report.id);
        addToast("Evidence uploaded successfully.", 'success');
        setIsUploading(false);
    };

    const actionButtonClasses = "w-full text-center py-3 px-4 font-semibold rounded-lg transition-transform duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";
    const isTerminalStatus = report.status === ReportStatus.RESOLVED || report.status === ReportStatus.RECOVERED || report.status === ReportStatus.CLOSED;
    const Spinner = () => <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>;
    
    return (
        <>
        <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg">
            <h2 className="text-2xl font-bold">{isVehicleReport(report) ? report.license_plate : report.title}</h2>
            <p className="font-mono text-sm text-gray-500 dark:text-gray-400 mb-4">{report.ob_number}</p>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => handleStatusUpdate(ReportStatus.IN_PROGRESS)} disabled={isTerminalStatus || !!isActionLoading} className={`${actionButtonClasses} bg-blue-600 text-white`}>{isActionLoading === ReportStatus.IN_PROGRESS ? <Spinner /> : 'En Route'}</button>
                <button onClick={() => handleStatusUpdate(ReportStatus.ON_SCENE)} disabled={isTerminalStatus || !!isActionLoading} className={`${actionButtonClasses} bg-yellow-500 text-white`}>{isActionLoading === ReportStatus.ON_SCENE ? <Spinner /> : 'On Scene'}</button>
                <button onClick={() => handleStatusUpdate(ReportStatus.RESOLVED)} disabled={isTerminalStatus || !!isActionLoading} className={`${actionButtonClasses} bg-green-600 text-white`}>{isActionLoading === ReportStatus.RESOLVED ? <Spinner /> : 'Resolve'}</button>
                {isVehicleReport(report) && (
                    <button onClick={() => handleStatusUpdate(ReportStatus.RECOVERED)} disabled={isTerminalStatus || !!isActionLoading} className={`${actionButtonClasses} bg-teal-500 text-white`}>{isActionLoading === ReportStatus.RECOVERED ? <Spinner /> : 'Recovered'}</button>
                )}
            </div>

            <button onClick={handleStandDown} disabled={isTerminalStatus || !!isActionLoading} className={`${actionButtonClasses} bg-orange-500 text-white mb-4`}>
                {isActionLoading === 'stand_down' ? <Spinner /> : 'Stand Down'}
            </button>


            <div className="space-y-4">
                <div><h4 className="font-bold">Location</h4><p>{isVehicleReport(report) ? report.last_seen_location : report.location}</p></div>
                <div><h4 className="font-bold">Description</h4><p className="whitespace-pre-wrap">{report.description}</p></div>
                {isVehicleReport(report) && <div><h4 className="font-bold">Vehicle</h4><p>{report.vehicle_color} {report.vehicle_make} {report.vehicle_model}</p></div>}
                
                {isAccidentReport(report) && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase">Accident Type</h4>
                            <p className="text-sm">{report.accident_type}</p>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase">Vehicles</h4>
                            <p className="text-sm">{report.vehicles_involved}</p>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase">Injuries</h4>
                            <p className="text-sm">{report.injuries_reported ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase">Fatalities</h4>
                            <p className="text-sm">{report.fatalities_reported ? 'Yes' : 'No'}</p>
                        </div>
                    </div>
                )}
                
                <div>
                    <h4 className="font-bold mb-2">Evidence</h4>
                    {report.evidence_images && report.evidence_images.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            {report.evidence_images.map((img, index) => (
                                <button 
                                    key={index} 
                                    onClick={() => setPreviewImageUrl(img)}
                                    className="relative group w-full h-24 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <img src={img} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" alt={`Evidence ${index + 1}`} />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <span className="text-white opacity-0 group-hover:opacity-100 font-semibold text-xs bg-black/50 px-2 py-1 rounded">View</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 italic">No evidence images uploaded yet.</p>
                    )}
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
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700/50">
                    <button onClick={() => openChat(report)} className="w-full py-2 px-4 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900 transition">
                        Open Live Chat
                    </button>
                </div>
            </div>
        </div>
        {confirmModalState && (
                <ConfirmModal 
                    isOpen={confirmModalState.isOpen}
                    onClose={() => setConfirmModalState(null)}
                    onConfirm={confirmModalState.onConfirm}
                    title={confirmModalState.title}
                    message={confirmModalState.message}
                    confirmText={confirmModalState.confirmText}
                    confirmVariant={confirmModalState.confirmVariant}
                />
            )}
            <ImagePreviewModal isOpen={!!previewImageUrl} onClose={() => setPreviewImageUrl(null)} imageUrl={previewImageUrl} />
        </>
    );
};

export default ResponderPage;
