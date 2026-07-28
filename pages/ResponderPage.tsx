
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Report, ReportStatus, Profile, ResponderStatus, VehicleReport, EmergencyReport, ReportUpdate, Profile as UserProfile, UserRole, ACTIVE_REPORT_STATUSES, TERMINAL_REPORT_STATUSES } from '../types';
import { supabase } from '../utils/supabase';
import { safeFormatDistanceToNow } from '../utils/dateUtils';
import StatusBadge from '../components/StatusBadge';
import { NavigationIcon, CameraIcon, ScanIcon, XIcon, ChatAlt2Icon, PlusIcon, AlertTriangleIcon } from '../components/icons';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ResponderMapView from '../components/ResponderMapView';
import LookoutScanner from '../components/LookoutScanner';
import CirculationListManager from '../components/CirculationListManager';
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
const isEmergencyReport = (report: Report): report is EmergencyReport => 'emergency_type' in report;

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
    const [assignedReports, setAssignedReports] = useState<Report[]>(() => {
        try {
            const cached = localStorage.getItem(`responder_assigned_reports_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [circulationReports, setCirculationReports] = useState<VehicleReport[]>(() => {
        try {
            const cached = localStorage.getItem(`responder_circulation_reports_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
        try {
            const cached = localStorage.getItem(`responder_users_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(() => {
        try {
            const cached = localStorage.getItem(`responder_assigned_reports_${profile.id}`);
            return !cached;
        } catch {
            return true;
        }
    });

    useEffect(() => {
        if (!profile?.id) return;
        try {
            if (assignedReports.length > 0) {
                localStorage.setItem(`responder_assigned_reports_${profile.id}`, JSON.stringify(assignedReports));
            }
        } catch (e) {
            console.warn("Error caching responder assigned reports:", e);
        }
    }, [assignedReports, profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;
        try {
            if (circulationReports.length > 0) {
                localStorage.setItem(`responder_circulation_reports_${profile.id}`, JSON.stringify(circulationReports));
            }
        } catch (e) {
            console.warn("Error caching responder circulation reports:", e);
        }
    }, [circulationReports, profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;
        try {
            if (allUsers.length > 0) {
                localStorage.setItem(`responder_users_${profile.id}`, JSON.stringify(allUsers));
            }
        } catch (e) {
            console.warn("Error caching responder users:", e);
        }
    }, [allUsers, profile?.id]);

    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(() => {
        const hasDraft = !!localStorage.getItem('new-report');
        const wasOpen = localStorage.getItem('responder_report_modal_open') === 'true';
        return hasDraft || wasOpen;
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
    const [localConfirmModal, setLocalConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);

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
        assignedReports.some(r => !TERMINAL_REPORT_STATUSES.includes(r.status)),
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

    const fetchData = useCallback(async () => {
        setLoading(true);
        const isGlobalAdmin = profile.role === UserRole.ADMIN && (profile.company?.name?.toLowerCase().includes('rapid911') || false);

        // Fetch assigned reports OR reported by me
        const { data: vData, error: vError } = await supabase.from('vehicle_reports').select('*').or(`assigned_to.eq.${profile.id},reported_by.eq.${profile.id}`).order('reported_at', { ascending: false }).limit(100);
        const { data: cData, error: cError } = await supabase.from('crime_reports').select('*').or(`assigned_to.eq.${profile.id},reported_by.eq.${profile.id}`).order('reported_at', { ascending: false }).limit(100);
        const { data: aData, error: aError } = await supabase.from('emergency_reports').select('*').or(`assigned_to.eq.${profile.id},reported_by.eq.${profile.id}`).order('reported_at', { ascending: false }).limit(100);
        const { data: usersData, error: usersError } = await supabase.from('profiles').select('*').eq('company_id', profile.company_id);

        // Fetch Circulation List (Active Vehicle Reports)
        const activeStatuses = ACTIVE_REPORT_STATUSES;
        let circQuery = supabase.from('vehicle_reports').select('*').in('status', activeStatuses);
        
        if (!isGlobalAdmin && profile.company_id) {
            circQuery = circQuery.or(`is_global.eq.true,company_id.eq.${profile.company_id},shared_with_company_ids.cs.{"${profile.company_id}"},assigned_to.eq.${profile.id}`);
        }
        const { data: circData, error: circError } = await circQuery.order('reported_at', { ascending: false }).limit(100);

        if (vError || cError || aError) console.error("Error fetching reports:", vError || cError || aError);
        else {
            const combined = [...(vData || []), ...(cData || []), ...(aData || [])].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
            setAssignedReports(combined);
            if (combined.length > 0) setSelectedReportId(currentId => currentId || combined[0].id);
        }
        
        if (circError) console.error("Error fetching circulation list:", circError);
        else setCirculationReports(circData || []);

        if(usersError) console.error("Error fetching company users:", usersError);
        else setAllUsers(usersData || []);

        setLoading(false);
        isInitialLoad.current = false;
    }, [profile.id, profile.company_id, profile.role, profile.company?.name]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
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

        const handleCirculationUpdate = (payload: any) => {
            const newReport = payload.new as VehicleReport;
            const oldReport = payload.old as VehicleReport;
            const eventType = payload.eventType;

            const activeStatuses = ACTIVE_REPORT_STATUSES;
            
            const isGlobalAdmin = profile.role === UserRole.ADMIN && (profile.company?.name?.toLowerCase().includes('rapid911') || false);
            const isRelevant = (report: VehicleReport) => {
                if (isGlobalAdmin) return true;
                if (report.is_global) return true;
                if (report.company_id === profile.company_id) return true;
                if (report.shared_with_company_ids?.includes(profile.company_id!)) return true;
                if (report.assigned_to === profile.id) return true;
                return false;
            };

            setCirculationReports(prev => {
                if (eventType === 'DELETE') {
                    return prev.filter(r => r.id !== oldReport.id);
                }

                if (eventType === 'INSERT') {
                    if (activeStatuses.includes(newReport.status) && isRelevant(newReport)) {
                        if (prev.some(r => r.id === newReport.id)) return prev;
                        return [newReport, ...prev].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
                    }
                    return prev;
                }

                if (eventType === 'UPDATE') {
                    const wasInList = prev.some(r => r.id === newReport.id);
                    const shouldBeInList = activeStatuses.includes(newReport.status) && isRelevant(newReport);

                    if (wasInList && !shouldBeInList) {
                        return prev.filter(r => r.id !== newReport.id);
                    } else if (!wasInList && shouldBeInList) {
                        return [newReport, ...prev].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
                    } else if (wasInList && shouldBeInList) {
                        return prev.map(r => r.id === newReport.id ? newReport : r);
                    }
                }
                return prev;
            });
        };

        const channel = supabase.channel(`responder-reports-${profile.id}`)
            // Listen for changes where assigned_to is us
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports', filter: `assigned_to=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports', filter: `assigned_to=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports', filter: `assigned_to=eq.${profile.id}` }, handleUpsert)
            // Listen for changes where reported_by is us
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports', filter: `reported_by=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports', filter: `reported_by=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports', filter: `reported_by=eq.${profile.id}` }, handleUpsert)
            // Listen for all changes to handle unassignments, deletions, and circulation updates
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, (payload) => {
                handlePotentialUnassignmentOrDelete(payload);
                handleCirculationUpdate(payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, handlePotentialUnassignmentOrDelete)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, handlePotentialUnassignmentOrDelete)
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
        fetch('/api/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: profile.id, location_coords: null })
        }).catch(err => console.warn("Could not clear location on stop:", err));
    };

    const startLocationSharing = () => {
        if (navigator.geolocation && locationWatchId.current === null) {
            setIsSharingLocation(true); // Optimistically set UI
            locationWatchId.current = navigator.geolocation.watchPosition(
                async (position) => {
                    setIsSyncing(true);
                    setLocationError(null);
                    const { latitude, longitude } = position.coords;
                    
                    // Throttle updates: only sync if at least 15 seconds passed since last sync
                    const now = new Date();
                    if (lastSyncTimestamp && now.getTime() - lastSyncTimestamp.getTime() < 15000) {
                        setIsSyncing(false);
                        return;
                    }

                    if (typeof latitude === 'number' && !isNaN(latitude) && typeof longitude === 'number' && !isNaN(longitude)) {
                        try {
                            const response = await fetch('/api/update-profile', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    userId: profile.id, 
                                    location_coords: { lat: latitude, lng: longitude } 
                                })
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Failed to sync location');
                            }

                            setLastSyncTimestamp(new Date());
                        } catch (error: any) {
                            console.error("Failed to update location:", error);
                            setLocationError(`Failed to sync location: ${error.message}`);
                            stopLocationSharing();
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
    
        try {
            const response = await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: profile.id, ...updatePayload })
            });

            const contentType = response.headers.get('content-type');
            let result;
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`);
            }

            if (!response.ok) {
                throw new Error(result?.error || 'Failed to update duty status');
            }

            if (result) {
                setProfile(result);
            }
        } catch (error: any) {
            console.error("Failed to update duty status:", error);
            setLocationError(`Failed to update duty status: ${error.message || 'Network error'}`);
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
    
    const activeAssignments = useMemo(() => {
        const activeStatuses = ACTIVE_REPORT_STATUSES;
        return assignedReports.filter(r => activeStatuses.includes(r.status));
    }, [assignedReports]);

    const selectedReport = useMemo(() => 
        assignedReports.find(r => r.id === selectedReportId) || 
        circulationReports.find(r => r.id === selectedReportId), 
    [assignedReports, circulationReports, selectedReportId]);

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

    const handleSelfAssign = (report: Report) => {
        if (report.assigned_to === profile.id) {
            addToast('You are already assigned to this incident.', 'info');
            setAnprFoundReport(null);
            return;
        }

        setLocalConfirmModal({
            isOpen: true,
            title: 'Assign Incident to Yourself',
            message: `Are you sure you want to assign the incident (OB: ${report.ob_number || report.id.slice(0, 8)}) to yourself?`,
            onConfirm: async () => {
                setLocalConfirmModal(null);
                const tableName = isVehicleReport(report) ? 'vehicle_reports' : (isEmergencyReport(report) ? 'emergency_reports' : 'crime_reports');

                const { error } = await supabase
                    .from(tableName)
                    .update({ 
                        assigned_to: profile.id,
                        status: ReportStatus.ASSIGNED 
                    })
                    .eq('id', report.id);

                if (error) {
                    addToast(`Failed to assign report: ${error.message}`, 'error');
                } else {
                    addToast('Incident successfully assigned to you.', 'success');
                    // Log assignment (fire and catch so RLS issues don't block assignment)
                    supabase.from('assignment_logs').insert({
                        report_id: report.id,
                        assigned_from: report.assigned_to,
                        assigned_to: profile.id,
                        assigned_by: profile.id
                    }).then(({ error }) => {
                        if (error) console.warn("Assignment log insert skipped:", error.message);
                    });
                    // Add update
                    await supabase.from('report_updates').insert({
                        report_id: report.id,
                        user_id: profile.id,
                        content: `Responder ${profile.first_name} ${profile.surname} self-assigned to this incident.`
                    });
                    
                    setAnprFoundReport(null);
                    setSelectedReportId(report.id);
                    fetchData();
                }
            }
        });
    };

    return (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Duty Status & Assignments */}
            <div className="lg:col-span-4 space-y-6">
                 {/* Duty Status Card */}
                 <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm sticky top-24 z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Duty Status</h3>
                        {profile.responder_status && <ResponderStatusBadge status={profile.responder_status} />}
                    </div>
                    
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Active Duty</span>
                        <label className="relative inline-flex items-center cursor-pointer" title={isEngaged ? "You must resolve active incidents to go off-duty." : "Toggle duty status"}>
                            <input type="checkbox" checked={isOnDuty} onChange={handleDutyToggle} className="sr-only peer" disabled={isEngaged} />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/30 peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-md disabled:opacity-50"></div>
                        </label>
                    </div>

                    {isEngaged && (
                        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-xs text-yellow-700 dark:text-yellow-400">
                                ⚠️ Resolve active assignments before going off-duty.
                            </p>
                        </div>
                    )}

                    {isOnDuty && (
                        <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${isSharingLocation ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Location Sharing</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={isSharingLocation} onChange={handleLocationToggle} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500/30 peer-checked:bg-green-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-md"></div>
                                </label>
                            </div>
                            
                            {locationError && (
                                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-800">
                                    {locationError}
                                </p>
                            )}
                            
                            {isSharingLocation && lastSyncTimestamp && (
                                <p className="text-xs text-right text-gray-400 dark:text-gray-500">
                                    Synced {safeFormatDistanceToNow(lastSyncTimestamp, { addSuffix: true })}
                                </p>
                            )}
                        </div>
                    )}
                </div>
                
                {isOnDuty && (
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => openChat(CONTROLLER_CHANNEL_REPORT)} className="flex flex-col items-center justify-center gap-2 p-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors shadow-sm">
                            <ChatAlt2Icon className="w-6 h-6" />
                            <span className="text-xs">Staff Chat</span>
                        </button>
                        <button onClick={() => setIsReportModalOpen(true)} className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                            <PlusIcon className="w-6 h-6" />
                            <span className="text-xs">New Report</span>
                        </button>
                    </div>
                )}
                
                {isOnDuty && <LookoutScanner profile={profile} onReportHit={handleAnprHit} />}

                <div className="space-y-3">
                    <CirculationListManager 
                        profile={profile} 
                        reports={circulationReports} 
                        loading={loading}
                        onSelectReport={setSelectedReportId}
                    />
                    
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Dispatch Queue</h2>
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold px-2 py-1 rounded-full">{activeAssignments.length}</span>
                    </div>
                    
                    <div className="space-y-3 lg:h-[calc(100vh-32rem)] lg:overflow-y-auto pr-1 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center items-center h-32">
                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : activeAssignments.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                <p className="text-gray-500 dark:text-gray-400 text-sm">No active assignments.</p>
                                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Stand by for dispatch.</p>
                            </div>
                        ) : (
                            activeAssignments.map(report => (
                                <div key={report.id} onClick={() => setSelectedReportId(report.id)} 
                                    className={`group relative p-4 cursor-pointer rounded-xl border transition-all duration-200 ${selectedReportId === report.id 
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-md transform scale-[1.02]' 
                                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm'}`}>
                                    
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${report.severity === 'critical' ? 'bg-red-500 animate-pulse' : report.severity === 'high' ? 'bg-orange-500' : 'bg-blue-500'}`}></span>
                                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{report.ob_number}</span>
                                        </div>
                                        <StatusBadge status={report.status} />
                                    </div>
                                    
                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1 truncate">
                                        {isVehicleReport(report) ? report.license_plate : report.title}
                                    </h3>
                                    
                                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mb-3">
                                        {isVehicleReport(report) ? `${report.vehicle_make} ${report.vehicle_model}` : (isEmergencyReport(report) ? report.emergency_type : report.crime_type)}
                                    </p>
                                    
                                    <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-2 mt-2">
                                        <span>{safeFormatDistanceToNow(report.reported_at, { addSuffix: true })}</span>
                                        <span className="group-hover:text-blue-500 transition-colors">View Details →</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column: Detail View & Map */}
            <div className="lg:col-span-8 lg:sticky lg:top-24 space-y-6">
                <div className="h-[35vh] rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800 relative group">
                    <ResponderMapView report={selectedReport} responderProfile={profile} />
                    {/* Map overlay gradient for better text visibility if needed, or controls */}
                </div>
                
                {selectedReport ? (
                    <ResponderReportDetail 
                        key={selectedReport.id} 
                        report={selectedReport} 
                        profile={profile} 
                        allUsers={allUsers} 
                        fetchData={fetchData} 
                        onSelfAssign={() => handleSelfAssign(selectedReport)}
                    />
                ) : (
                    <div className="h-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <NavigationIcon className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Ready for Assignment</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md">
                            Select an incident from the dispatch queue to view full details and manage your response.
                        </p>
                    </div>
                )}
            </div>
        </div>

        {anprFoundReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setAnprFoundReport(null)}>
                <div className="relative w-full max-w-lg flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                    <div className="absolute -top-3 -right-3 z-10">
                        <button onClick={() => setAnprFoundReport(null)} className="p-2 bg-gray-800/80 rounded-full text-white hover:bg-gray-700 transition">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 bg-red-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertTriangleIcon className="w-6 h-6" />
                                <h3 className="font-bold">LOOKOUT ALERT</h3>
                            </div>
                            <span className="text-xs font-mono bg-white/20 px-2 py-1 rounded">{anprFoundReport.license_plate}</span>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto">
                            <UserReportDetail report={anprFoundReport} profile={profile} onEdit={() => {}} allUsers={allUsers} onRefresh={fetchData} />
                        </div>
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                            <button 
                                onClick={() => setAnprFoundReport(null)}
                                className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                            >
                                Dismiss
                            </button>
                            <button 
                                onClick={() => handleSelfAssign(anprFoundReport)}
                                className="flex-1 py-3 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition"
                            >
                                Self-Assign
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <ReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            reportToEdit={null}
            onReportSubmitted={fetchData}
        />

        {localConfirmModal && (
            <ConfirmModal
                isOpen={!!localConfirmModal}
                onClose={() => setLocalConfirmModal(null)}
                onConfirm={() => {
                    localConfirmModal.onConfirm();
                    setLocalConfirmModal(null);
                }}
                title={localConfirmModal.title}
                message={localConfirmModal.message}
                confirmText="Self Assign"
                confirmVariant="primary"
            />
        )}

        </>
    );
};

const ResponderReportDetail: React.FC<{ report: Report, profile: Profile, allUsers: Profile[], fetchData: () => Promise<void>, onSelfAssign: () => void }> = ({ report, profile, allUsers, fetchData, onSelfAssign }) => {
    const [updates, setUpdates] = useState<ReportUpdate[]>([]);
    const [newUpdate, setNewUpdate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState<ReportStatus | 'stand_down' | null>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const { addToast } = useToast();
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, confirmText: string, confirmVariant: 'danger' | 'primary' } | null>(null);
    const { openChat } = useChat();

    const isAssignedToMe = report.assigned_to === profile.id;

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
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : (isEmergencyReport(report) ? 'emergency_reports' : 'crime_reports');
    
        const updatePromises: PromiseLike<any>[] = [];
    
        const isResolving = status === ReportStatus.RESOLVED || status === ReportStatus.RECOVERED || status === ReportStatus.CLOSED;
    
        const reportUpdatePayload: { status: ReportStatus; assigned_to?: null; completed_at?: string | null } = { status };
        if (isResolving) {
            reportUpdatePayload.assigned_to = null;
            reportUpdatePayload.completed_at = new Date().toISOString();
            supabase.from('assignment_logs').insert({
                report_id: report.id,
                assigned_from: profile.id,
                assigned_to: null,
                assigned_by: profile.id
            }).then(({ error }) => {
                if (error) console.warn("Assignment log insert skipped:", error.message);
            });
        }
    
        updatePromises.push(supabase.from(tableName).update(reportUpdatePayload).eq('id', report.id));
        updatePromises.push(supabase.from('report_updates').insert({ report_id: report.id, user_id: profile.id, content: `Status changed to: ${status.replace(/_/g, ' ')}` }));
    
        let newResponderStatus: ResponderStatus | null = null;
        if (status === ReportStatus.IN_PROGRESS) {
            newResponderStatus = ResponderStatus.EN_ROUTE;
        } else if (status === ReportStatus.ON_SCENE) {
            newResponderStatus = ResponderStatus.ON_SCENE;
        } else if (isResolving) {
            const { count: vehicleCount } = await supabase.from('vehicle_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', ACTIVE_REPORT_STATUSES);
            const { count: crimeCount } = await supabase.from('crime_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', ACTIVE_REPORT_STATUSES);
            const { count: emergencyCount } = await supabase.from('emergency_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', ACTIVE_REPORT_STATUSES);
            
            const hasOtherActiveAssignments = (vehicleCount !== null && vehicleCount > 0) || (crimeCount !== null && crimeCount > 0) || (emergencyCount !== null && emergencyCount > 0);
            if (!hasOtherActiveAssignments) {
                newResponderStatus = ResponderStatus.AVAILABLE;
            }
        }
    
        if (newResponderStatus && profile.responder_status !== newResponderStatus) {
            updatePromises.push(fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: profile.id, responder_status: newResponderStatus })
            }).then(res => res.ok ? { error: null } : res.json().then(data => ({ error: { message: data.error } }))));
        }
        
        const results = await Promise.all(updatePromises);
        const errors = results.map((r: any) => r.error).filter(Boolean);
        if (errors.length > 0) {
            addToast('An error occurred while updating status. Please check the console.', 'error');
            console.error('Status update errors:', errors);
        } else {
            addToast(`Status updated to ${status.replace(/_/g, ' ')}.`, 'success');
            await fetchData();
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
                    const tableName = isVehicleReport(report) ? 'vehicle_reports' : (isEmergencyReport(report) ? 'emergency_reports' : 'crime_reports');
                    const updatePromises: PromiseLike<any>[] = [];
                    updatePromises.push(supabase.from(tableName).update({ assigned_to: null, status: ReportStatus.ACTIVE }).eq('id', report.id));
                    
                    // Log assignment change separately so any DB RLS policy issue does not block stand down
                    supabase.from('assignment_logs').insert({
                        report_id: report.id,
                        assigned_from: profile.id,
                        assigned_to: null,
                        assigned_by: profile.id
                    }).then(({ error }) => {
                        if (error) console.warn("Assignment log insert skipped:", error.message);
                    });

                    updatePromises.push(supabase.from('report_updates').insert({ report_id: report.id, user_id: profile.id, content: `Responder ${profile.first_name} ${profile.surname} has stood down.` }));

                    const { count: vehicleCount } = await supabase.from('vehicle_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', ACTIVE_REPORT_STATUSES);
                    const { count: crimeCount } = await supabase.from('crime_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', ACTIVE_REPORT_STATUSES);
                    const { count: emergencyCount } = await supabase.from('emergency_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', ACTIVE_REPORT_STATUSES);

                    const hasOtherActiveAssignments = (vehicleCount !== null && vehicleCount > 0) || (crimeCount !== null && crimeCount > 0) || (emergencyCount !== null && emergencyCount > 0);
                    if (!hasOtherActiveAssignments) {
                        updatePromises.push(fetch('/api/update-profile', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: profile.id, responder_status: ResponderStatus.AVAILABLE })
                        }).then(res => res.ok ? { error: null } : res.json().then(data => ({ error: { message: data.error } }))));
                    }
                    const results = await Promise.all(updatePromises);
                    const errors = results.map((r: any) => r.error).filter(Boolean);
                    if (errors.length > 0) throw new Error(errors.map(e => e.message).join('\n'));

                    addToast('Successfully stood down from the incident.', 'info');
                    await fetchData();
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
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : (isEmergencyReport(report) ? 'emergency_reports' : 'crime_reports');
        await supabase.from(tableName).update({ evidence_images: updatedImages }).eq('id', report.id);
        addToast("Evidence uploaded successfully.", 'success');
        setIsUploading(false);
    };

    const isTerminalStatus = report.status === ReportStatus.RESOLVED || report.status === ReportStatus.RECOVERED || report.status === ReportStatus.CLOSED;
    const Spinner = () => <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>;
    
    return (
        <>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
            {/* Header Section */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {isVehicleReport(report) ? report.license_plate : report.title}
                            </h2>
                            <StatusBadge status={report.status} />
                        </div>
                        <p className="font-mono text-sm text-gray-500 dark:text-gray-400">OB: {report.ob_number}</p>
                    </div>
                    <div className="flex items-center gap-2">
                         <button onClick={() => openChat(report)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium text-sm">
                            <ChatAlt2Icon className="w-4 h-4" />
                            Live Chat
                        </button>
                        {isAssignedToMe ? (
                            <button onClick={handleStandDown} disabled={isTerminalStatus || !!isActionLoading} className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium text-sm disabled:opacity-50">
                                {isActionLoading === 'stand_down' ? <Spinner /> : 'Stand Down'}
                            </button>
                        ) : (
                            <button onClick={onSelfAssign} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm shadow-lg shadow-blue-600/20">
                                Self-Assign Incident
                            </button>
                        )}
                    </div>
                </div>

                {/* Primary Action Bar */}
                {isAssignedToMe && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <button 
                            onClick={() => handleStatusUpdate(ReportStatus.IN_PROGRESS)} 
                            disabled={isTerminalStatus || !!isActionLoading || report.status === ReportStatus.IN_PROGRESS} 
                            className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
                                ${report.status === ReportStatus.IN_PROGRESS 
                                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-gray-900' 
                                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'}`}
                        >
                            {isActionLoading === ReportStatus.IN_PROGRESS ? <Spinner /> : 'En Route'}
                        </button>
                        
                        <button 
                            onClick={() => handleStatusUpdate(ReportStatus.ON_SCENE)} 
                            disabled={isTerminalStatus || !!isActionLoading || report.status === ReportStatus.ON_SCENE} 
                            className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
                                ${report.status === ReportStatus.ON_SCENE 
                                    ? 'bg-yellow-500 text-white shadow-md ring-2 ring-yellow-500 ring-offset-2 dark:ring-offset-gray-900' 
                                    : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40'}`}
                        >
                            {isActionLoading === ReportStatus.ON_SCENE ? <Spinner /> : 'On Scene'}
                        </button>
                        
                        <button 
                            onClick={() => handleStatusUpdate(ReportStatus.RESOLVED)} 
                            disabled={isTerminalStatus || !!isActionLoading} 
                            className="py-3 px-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
                        >
                            {isActionLoading === ReportStatus.RESOLVED ? <Spinner /> : 'Resolve'}
                        </button>
                        
                        {isVehicleReport(report) && (
                            <button 
                                onClick={() => handleStatusUpdate(ReportStatus.RECOVERED)} 
                                disabled={isTerminalStatus || !!isActionLoading} 
                                className="py-3 px-4 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
                            >
                                {isActionLoading === ReportStatus.RECOVERED ? <Spinner /> : 'Recovered'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-800">
                
                {/* Left Panel: Details & Evidence */}
                <div className="p-6 space-y-6">
                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Incident Details</h4>
                        <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                <span className="text-xs text-gray-500 block mb-1">Location</span>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    {isVehicleReport(report) ? report.last_seen_location : report.location}
                                </p>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                <span className="text-xs text-gray-500 block mb-1">Description</span>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {report.description}
                                </p>
                            </div>

                            {isVehicleReport(report) && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500 block mb-1">Vehicle</span>
                                        <p className="font-medium">{report.vehicle_color} {report.vehicle_make}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500 block mb-1">Model</span>
                                        <p className="font-medium">{report.vehicle_model}</p>
                                    </div>
                                </div>
                            )}
                            
                            {isEmergencyReport(report) && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500 block mb-1">Type</span>
                                        <p className="font-medium">{report.emergency_type}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500 block mb-1">Vehicles</span>
                                        <p className="font-medium">{report.vehicles_involved}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500 block mb-1">Injuries</span>
                                        <p className={`font-medium ${report.injuries_reported ? 'text-red-500' : 'text-gray-700'}`}>
                                            {report.injuries_reported ? 'Yes' : 'None'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500 block mb-1">Fatalities</span>
                                        <p className={`font-medium ${report.fatalities_reported ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                                            {report.fatalities_reported ? 'Yes' : 'None'}
                                        </p>
                                    </div>
                                    {report.emergency_type === 'Kidnapping (taken with vehicle)' && (
                                        <>
                                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                                <span className="text-xs text-gray-500 block mb-1">License Plate</span>
                                                <p className="font-medium">{(report as any).license_plate || 'N/A'}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                                <span className="text-xs text-gray-500 block mb-1">Vehicle Make</span>
                                                <p className="font-medium">{(report as any).vehicle_make || 'N/A'}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                                <span className="text-xs text-gray-500 block mb-1">Vehicle Model</span>
                                                <p className="font-medium">{(report as any).vehicle_model || 'N/A'}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                                <span className="text-xs text-gray-500 block mb-1">Vehicle Color</span>
                                                <p className="font-medium">{(report as any).vehicle_color || 'N/A'}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Evidence</h4>
                            {isAssignedToMe && (
                                <label htmlFor="evidence-upload" className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1">
                                    <CameraIcon className="w-3 h-3" />
                                    {isUploading ? "Uploading..." : "Add Photo"}
                                    <input id="evidence-upload" type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                                </label>
                            )}
                        </div>
                        
                        {report.evidence_images && report.evidence_images.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                                {report.evidence_images.map((img, index) => (
                                    <button 
                                        key={index} 
                                        onClick={() => setPreviewImageUrl(img)}
                                        className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <img src={img} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" alt={`Evidence ${index + 1}`} />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <span className="text-white opacity-0 group-hover:opacity-100 font-semibold text-xs bg-black/50 px-2 py-1 rounded backdrop-blur-sm">View</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                                <CameraIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                                <p className="text-xs text-gray-400">No evidence uploaded</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Incident Log */}
                <div className="p-6 flex flex-col h-full min-h-[400px]">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Incident Log</h4>
                    
                    <div className="flex-grow bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-lg p-4 mb-4 overflow-y-auto custom-scrollbar space-y-3 max-h-[500px]">
                        {updates.length === 0 ? (
                            <p className="text-center text-gray-400 text-xs italic py-4">No updates yet.</p>
                        ) : (
                            updates.map(u => (
                                <div key={u.id} className="flex flex-col">
                                    <div className="flex items-baseline justify-between mb-1">
                                        <span className="font-semibold text-xs text-gray-700 dark:text-gray-300">{u.user_full_name}</span>
                                        <span className="text-[10px] text-gray-400 font-mono">{safeFormatDistanceToNow(u.created_at, {addSuffix: true})}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700/50 shadow-sm">
                                        {u.content}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                    
                    {isAssignedToMe && (
                        <form onSubmit={handlePostUpdate} className="flex gap-2">
                            <input 
                                type="text" 
                                value={newUpdate} 
                                onChange={e => setNewUpdate(e.target.value)} 
                                placeholder="Type an update..." 
                                className="flex-grow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                            />
                            <button 
                                type="submit" 
                                disabled={isSubmitting || !newUpdate.trim()} 
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Post
                            </button>
                        </form>
                    )}
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
