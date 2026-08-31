import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    Report,
    ReportStatus,
    Profile,
    ResponderStatus,
    ReportUpdate,
    UserRole,
    ACTIVE_REPORT_STATUSES,
    TERMINAL_REPORT_STATUSES,
} from '../types';
import { supabase } from '../utils/supabase';
import { CONTROLLER_CHANNEL_REPORT } from '../constants';
import { safeFormatDistanceToNow } from '../utils/dateUtils';
import { useToast } from '../contexts/ToastContext';
import { useChat } from '../contexts/ChatContext';
import { useWakeLock } from '../hooks/useWakeLock';
import RoadsideDriverMapView from '../components/RoadsideDriverMapView';
import RoadsideInspectionModal from '../components/RoadsideInspectionModal';
import RoadsideCompletionModal from '../components/RoadsideCompletionModal';
import RoadsideQuickReportModal from '../components/RoadsideQuickReportModal';
import IncidentReportPreviewModal from '../components/IncidentReportPreviewModal';
import ConfirmModal from '../components/ConfirmModal';
import {
    Wrench,
    Truck,
    Navigation,
    Phone,
    MessageSquare,
    CheckCircle2,
    Clock,
    MapPin,
    AlertTriangle,
    Shield,
    Camera,
    FileText,
    Plus,
    Radio,
    Sparkles,
    Send,
    RefreshCw,
    Compass,
    Eye,
    Printer,
    ArrowUpRight,
    Car,
    BatteryCharging,
    Key,
    Fuel,
    CheckSquare,
    Square,
    AlertCircle,
    User,
    Check,
} from 'lucide-react';

interface RoadsideDriverPageProps {
    profile: Profile;
    setProfile: (profile: Profile) => void;
}

export const RoadsideDriverPage: React.FC<RoadsideDriverPageProps> = ({ profile, setProfile }) => {
    const { addToast } = useToast();
    const { openChat } = useChat();
    const { requestWakeLock, releaseWakeLock } = useWakeLock();

    // Cache Keys
    const assignedReportsCacheKey = `roadside_assigned_reports_${profile.id}`;
    const allRoadsideReportsCacheKey = `roadside_all_reports_${profile.id}`;

    // Reports State
    const [assignedReports, setAssignedReports] = useState<Report[]>(() => {
        try {
            const cached = localStorage.getItem(assignedReportsCacheKey);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });

    const [allRoadsideReports, setAllRoadsideReports] = useState<Report[]>(() => {
        try {
            const cached = localStorage.getItem(allRoadsideReportsCacheKey);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dispatches' | 'map' | 'history' | 'safety'>('dispatches');
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

    // Modals State
    const [isQuickReportModalOpen, setIsQuickReportModalOpen] = useState(false);
    const [inspectingReport, setInspectingReport] = useState<Report | null>(null);
    const [completingReport, setCompletingReport] = useState<Report | null>(null);
    const [previewingReport, setPreviewingReport] = useState<Report | null>(null);
    const [isSosConfirmOpen, setIsSosConfirmOpen] = useState(false);

    // Live Geolocation State
    const [isGpsSharing, setIsGpsSharing] = useState(true);
    const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
    const [wakeLockActive, setWakeLockActive] = useState(false);
    const watchIdRef = useRef<number | null>(null);

    // Note / Comment input state per report
    const [newNotes, setNewNotes] = useState<{ [reportId: string]: string }>({});
    const [isPostingNote, setIsPostingNote] = useState<{ [reportId: string]: boolean }>({});

    // Audio chime for new callouts
    const playChime = useCallback(() => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.35);
        } catch (e) {
            console.warn('Audio chime error:', e);
        }
    }, []);

    // Screen WakeLock toggle
    const toggleWakeLock = async () => {
        if (wakeLockActive) {
            await releaseWakeLock();
            setWakeLockActive(false);
            addToast('Screen sleep lock released', 'info');
        } else {
            await requestWakeLock();
            setWakeLockActive(true);
            addToast('Screen will stay awake during shift', 'success');
        }
    };

    // Auto-request WakeLock on mount if on duty
    useEffect(() => {
        if (profile.responder_status !== ResponderStatus.OFF_DUTY) {
            requestWakeLock();
            setWakeLockActive(true);
        }
        return () => {
            releaseWakeLock();
        };
    }, [profile.responder_status, requestWakeLock, releaseWakeLock]);

    // Live GPS Location Tracking
    useEffect(() => {
        if (!isGpsSharing || !navigator.geolocation) return;

        const handlePosition = async (pos: GeolocationPosition) => {
            const { latitude, longitude, accuracy } = pos.coords;
            setGpsAccuracy(Math.round(accuracy));

            const newCoords = { lat: latitude, lng: longitude };
            const updatedProfile = {
                ...profile,
                location_coords: newCoords,
                last_seen_at: new Date().toISOString(),
            };
            setProfile(updatedProfile);

            if (supabase && profile.id) {
                try {
                    await supabase
                        .from('profiles')
                        .update({
                            location_coords: newCoords,
                            last_seen_at: new Date().toISOString(),
                        })
                        .eq('id', profile.id);
                } catch (e) {
                    console.warn('Error pushing GPS location to Supabase:', e);
                }
            }
        };

        const handleError = (err: GeolocationPositionError) => {
            console.warn('GPS position error:', err.message);
        };

        watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000,
        });

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [isGpsSharing, profile.id, setProfile]);

    // Fetch reports
    const fetchReports = useCallback(async () => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        try {
            // Fetch all roadside reports (emergency_type = 'Roadside Assistance' or type = 'roadside')
            const { data, error } = await supabase
                .from('emergency_reports')
                .select('*')
                .or(`emergency_type.eq.Roadside Assistance,type.eq.roadside`)
                .order('reported_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const assigned = data.filter(
                    (r: Report) =>
                        r.assigned_to === profile.id ||
                        (r.assigned_to === null && r.status === ReportStatus.PENDING)
                );

                setAssignedReports(assigned);
                setAllRoadsideReports(data);

                try {
                    localStorage.setItem(assignedReportsCacheKey, JSON.stringify(assigned));
                    localStorage.setItem(allRoadsideReportsCacheKey, JSON.stringify(data));
                } catch (e) {
                    console.warn('LocalStorage caching error:', e);
                }

                // If no report selected, select first active assigned report
                if (!selectedReportId && assigned.length > 0) {
                    const activeFirst = assigned.find(r => ACTIVE_REPORT_STATUSES.includes(r.status));
                    if (activeFirst) setSelectedReportId(activeFirst.id);
                }
            }
        } catch (err: any) {
            console.error('Error fetching roadside reports:', err);
        } finally {
            setLoading(false);
        }
    }, [profile.id, assignedReportsCacheKey, allRoadsideReportsCacheKey, selectedReportId]);

    // Initial Fetch & Realtime Postgres Changes Subscription
    useEffect(() => {
        fetchReports();

        if (!supabase) return;

        const channel = supabase
            .channel('roadside-driver-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'emergency_reports' },
                (payload) => {
                    const newReport = payload.new as any;
                    if (
                        newReport &&
                        (newReport.emergency_type === 'Roadside Assistance' || newReport.type === 'roadside')
                    ) {
                        if (payload.eventType === 'INSERT') {
                            playChime();
                            addToast(`🚨 New Roadside Callout: ${newReport.title || 'Assistance Required'}`, 'info');
                        }
                    }
                    fetchReports();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchReports, playChime, addToast]);

    // Active assigned callouts (non-terminal)
    const activeDispatches = useMemo(() => {
        return assignedReports.filter(r => ACTIVE_REPORT_STATUSES.includes(r.status));
    }, [assignedReports]);

    // Completed callouts
    const completedDispatches = useMemo(() => {
        return allRoadsideReports.filter(
            r => TERMINAL_REPORT_STATUSES.includes(r.status) && (r.assigned_to === profile.id || r.reported_by === profile.id)
        );
    }, [allRoadsideReports, profile.id]);

    // Selected Report Object
    const selectedReport = useMemo(() => {
        return (
            assignedReports.find(r => r.id === selectedReportId) ||
            allRoadsideReports.find(r => r.id === selectedReportId) ||
            activeDispatches[0] ||
            null
        );
    }, [selectedReportId, assignedReports, allRoadsideReports, activeDispatches]);

    // Change Driver Status
    const handleStatusChange = async (newStatus: ResponderStatus) => {
        const updatedProfile = { ...profile, responder_status: newStatus };
        setProfile(updatedProfile);

        if (supabase && profile.id) {
            try {
                await supabase
                    .from('profiles')
                    .update({ responder_status: newStatus })
                    .eq('id', profile.id);
                addToast(`Status updated to ${newStatus.replace(/_/g, ' ')}`, 'success');
            } catch (err: any) {
                console.error('Error updating driver status:', err);
                addToast('Failed to update status in cloud', 'error');
            }
        }
    };

    // Update Report Status Step
    const handleReportStatusStep = async (report: Report, nextStatus: ReportStatus, statusNote?: string) => {
        if (!supabase) return;

        try {
            const updates: any = {
                status: nextStatus,
                assigned_to: profile.id, // Ensure assigned to current driver
            };

            if (nextStatus === ReportStatus.ON_SCENE && !(report as any).on_scene_at) {
                updates.on_scene_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('emergency_reports')
                .update(updates)
                .eq('id', report.id);

            if (error) throw error;

            // Log update
            const noteText = statusNote || `Status changed to ${nextStatus.toUpperCase()} by Roadside Driver ${profile.first_name} ${profile.surname}`;
            await supabase.from('report_updates').insert({
                report_id: report.id,
                user_id: profile.id,
                content: noteText,
            });

            // If en route, update driver status as well
            if (nextStatus === ReportStatus.IN_PROGRESS && profile.responder_status !== ResponderStatus.EN_ROUTE) {
                handleStatusChange(ResponderStatus.EN_ROUTE);
            } else if (nextStatus === ReportStatus.ON_SCENE && profile.responder_status !== ResponderStatus.ON_SCENE) {
                handleStatusChange(ResponderStatus.ON_SCENE);
            }

            addToast(`Callout updated to ${nextStatus.replace(/_/g, ' ')}`, 'success');
            fetchReports();
        } catch (err: any) {
            console.error('Error updating report status:', err);
            addToast('Failed to update callout status', 'error');
        }
    };

    // Post Quick Driver Note to Report Feed
    const handlePostNote = async (reportId: string) => {
        const text = newNotes[reportId]?.trim();
        if (!text || !supabase) return;

        setIsPostingNote(prev => ({ ...prev, [reportId]: true }));
        try {
            await supabase.from('report_updates').insert({
                report_id: reportId,
                user_id: profile.id,
                content: `💬 [Driver Note]: ${text}`,
            });

            setNewNotes(prev => ({ ...prev, [reportId]: '' }));
            addToast('Driver note posted to docket', 'success');
            fetchReports();
        } catch (e: any) {
            console.error('Error posting note:', e);
            addToast('Failed to post note', 'error');
        } finally {
            setIsPostingNote(prev => ({ ...prev, [reportId]: false }));
        }
    };

    // Trigger Emergency Panic / SOS
    const handleTriggerSos = async () => {
        if (!supabase) return;
        try {
            const obNumber = `SOS-${Date.now().toString().slice(-6)}`;
            await supabase.from('emergency_reports').insert({
                title: `🚨 DRIVER PANIC SOS: ${profile.first_name} ${profile.surname} (${profile.vehicle_reg || 'Truck'})`,
                description: `EMERGENCY SOS ALERT triggered by Roadside Driver ${profile.first_name} ${profile.surname}. Immediate backup requested!`,
                location: profile.location_coords ? `${profile.location_coords.lat}, ${profile.location_coords.lng}` : 'Roadside Unit Location',
                location_coords: profile.location_coords,
                emergency_type: 'Officer in Distress / SOS',
                severity: 'critical',
                status: ReportStatus.ACTIVE,
                reported_by: profile.id,
                reported_at: new Date().toISOString(),
                company_id: profile.company_id || null,
                ob_number: obNumber,
            });

            addToast('🚨 EMERGENCY SOS SENT TO ALL CONTROLLERS!', 'error');
            setIsSosConfirmOpen(false);
        } catch (err: any) {
            console.error('Error sending SOS:', err);
            addToast('Failed to broadcast SOS', 'error');
        }
    };

    // Navigation Launcher
    const launchNavigation = (coords?: { lat: number; lng: number }, address?: string) => {
        if (coords?.lat && coords?.lng) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`, '_blank');
        } else if (address) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
        }
    };

    const launchWaze = (coords?: { lat: number; lng: number }) => {
        if (coords?.lat && coords?.lng) {
            window.open(`https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`, '_blank');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col pb-20 sm:pb-8 pt-16">
            {/* Top Telemetry & Shift Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-14 sm:top-16 z-30 px-3 sm:px-6 py-2.5">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
                    {/* Left: Driver Identity & Truck */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                            <img
                                src={
                                    profile.avatar_url ||
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                        profile.first_name || profile.surname || 'Driver'
                                    )}&background=0d9488&color=fff`
                                }
                                alt="Driver Profile"
                                className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border-2 border-teal-500/50 shadow"
                            />
                            <span
                                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 ${
                                    profile.responder_status === ResponderStatus.AVAILABLE
                                        ? 'bg-green-500'
                                        : profile.responder_status === ResponderStatus.EN_ROUTE
                                        ? 'bg-blue-500'
                                        : profile.responder_status === ResponderStatus.ON_SCENE
                                        ? 'bg-amber-500'
                                        : 'bg-gray-400'
                                }`}
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                                    {profile.first_name} {profile.surname}
                                </h2>
                                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-[10px] font-black uppercase tracking-wider">
                                    <Truck className="w-3 h-3" />
                                    <span>Roadside Driver</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {profile.vehicle_reg ? `Truck: ${profile.vehicle_reg}` : 'Roadside Unit'}
                                </span>
                                <span>•</span>
                                <span>{profile.company?.name || 'Assistance Fleet'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Middle: Shift Status Selector */}
                    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
                        <button
                            onClick={() => handleStatusChange(ResponderStatus.AVAILABLE)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                                profile.responder_status === ResponderStatus.AVAILABLE
                                    ? 'bg-green-600 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse"></span>
                            Available
                        </button>
                        <button
                            onClick={() => handleStatusChange(ResponderStatus.EN_ROUTE)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                                profile.responder_status === ResponderStatus.EN_ROUTE
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse"></span>
                            En Route
                        </button>
                        <button
                            onClick={() => handleStatusChange(ResponderStatus.ON_SCENE)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                                profile.responder_status === ResponderStatus.ON_SCENE
                                    ? 'bg-amber-600 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse"></span>
                            On Scene
                        </button>
                        <button
                            onClick={() => handleStatusChange(ResponderStatus.OFF_DUTY)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                                profile.responder_status === ResponderStatus.OFF_DUTY
                                    ? 'bg-gray-600 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            Off Duty
                        </button>
                    </div>

                    {/* Right Controls: WakeLock, GPS, SOS, New Callout, Chat */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* WakeLock Toggle */}
                        <button
                            onClick={toggleWakeLock}
                            className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-1 ${
                                wakeLockActive
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                                    : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500'
                            }`}
                            title={wakeLockActive ? 'Screen Awake Enabled' : 'Screen Awake Disabled'}
                        >
                            <Radio className={`w-4 h-4 ${wakeLockActive ? 'animate-pulse text-amber-500' : ''}`} />
                            <span className="hidden md:inline text-[11px]">{wakeLockActive ? 'Awake' : 'Sleep'}</span>
                        </button>

                        {/* Dispatch Chat */}
                        <button
                            onClick={() => openChat(selectedReport || CONTROLLER_CHANNEL_REPORT)}
                            className="p-2 sm:px-3 sm:py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold flex items-center gap-1.5 transition"
                            title="Chat with Control Room"
                        >
                            <MessageSquare className="w-4 h-4 text-blue-500" />
                            <span className="hidden sm:inline">Dispatch Chat</span>
                        </button>

                        {/* New Quick Callout */}
                        <button
                            onClick={() => setIsQuickReportModalOpen(true)}
                            className="px-3 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-500/20 flex items-center gap-1.5 transition"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Log Callout</span>
                        </button>

                        {/* Emergency SOS */}
                        <button
                            onClick={() => setIsSosConfirmOpen(true)}
                            className="px-2.5 sm:px-3 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-black tracking-wider flex items-center gap-1 shadow-md shadow-red-500/30 transition animate-pulse"
                            title="Emergency Panic Alert"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            <span>SOS</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 flex-grow flex flex-col gap-4">
                {/* KPI & Quick Status Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Assigned Calls
                            </p>
                            <p className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-0.5">
                                {activeDispatches.length}
                            </p>
                        </div>
                        <div className="p-3 bg-teal-500/10 text-teal-600 rounded-2xl">
                            <Wrench className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                En Route / On Scene
                            </p>
                            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                                {
                                    activeDispatches.filter(
                                        r => r.status === ReportStatus.IN_PROGRESS || r.status === ReportStatus.ON_SCENE
                                    ).length
                                }
                            </p>
                        </div>
                        <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl">
                            <Truck className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Completed Today
                            </p>
                            <p className="text-2xl font-black text-green-600 dark:text-green-400 mt-0.5">
                                {completedDispatches.length}
                            </p>
                        </div>
                        <div className="p-3 bg-green-500/10 text-green-600 rounded-2xl">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                GPS Telemetry
                            </p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white mt-1 truncate">
                                {gpsAccuracy ? `±${gpsAccuracy}m Accuracy` : 'GPS Live'}
                            </p>
                        </div>
                        <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-2xl">
                            <Compass className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* View Tabs Selector */}
                <div className="flex items-center gap-2 bg-gray-200/70 dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-300 dark:border-gray-800 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('dispatches')}
                        className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                            activeTab === 'dispatches'
                                ? 'bg-white dark:bg-gray-800 text-teal-600 dark:text-teal-400 shadow-sm border border-gray-200 dark:border-gray-700'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Wrench className="w-4 h-4" />
                        <span>Active Callouts ({activeDispatches.length})</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('map')}
                        className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                            activeTab === 'map'
                                ? 'bg-white dark:bg-gray-800 text-teal-600 dark:text-teal-400 shadow-sm border border-gray-200 dark:border-gray-700'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Navigation className="w-4 h-4" />
                        <span>Roadside Map & GPS</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                            activeTab === 'history'
                                ? 'bg-white dark:bg-gray-800 text-teal-600 dark:text-teal-400 shadow-sm border border-gray-200 dark:border-gray-700'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Clock className="w-4 h-4" />
                        <span>Completed History ({completedDispatches.length})</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('safety')}
                        className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                            activeTab === 'safety'
                                ? 'bg-white dark:bg-gray-800 text-teal-600 dark:text-teal-400 shadow-sm border border-gray-200 dark:border-gray-700'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Shield className="w-4 h-4" />
                        <span>Safety & Pre-Trip</span>
                    </button>
                </div>

                {/* TAB 1: ACTIVE DISPATCHES & CALLOUTS */}
                {activeTab === 'dispatches' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-grow items-start">
                        {/* Callouts List (Left Column) */}
                        <div className="lg:col-span-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                    Current Roadside Callouts ({activeDispatches.length})
                                </h3>
                                <button
                                    onClick={fetchReports}
                                    className="p-1.5 text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg transition"
                                    title="Refresh callouts"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>

                            {activeDispatches.length === 0 ? (
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 text-center">
                                    <div className="w-14 h-14 mx-auto rounded-3xl bg-teal-500/10 text-teal-600 flex items-center justify-center mb-3">
                                        <CheckCircle2 className="w-7 h-7" />
                                    </div>
                                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                        No Active Breakdowns
                                    </h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                                        You have no pending roadside callouts assigned. Stay on Available status to receive incoming dispatches.
                                    </p>
                                    <button
                                        onClick={() => setIsQuickReportModalOpen(true)}
                                        className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow transition"
                                    >
                                        Log New Callout
                                    </button>
                                </div>
                            ) : (
                                activeDispatches.map((report) => {
                                    const isSelected = selectedReport?.id === report.id;
                                    const carNum = (report as any).car_number || (report as any).card_number || report.ob_number;
                                    const assistanceType = (report as any).assistance_type || 'Roadside Callout';
                                    const memberName = (report as any).driver_name || 'Member';
                                    const cell = (report as any).cell || (report as any).contact_number || (report as any).phone;

                                    return (
                                        <div
                                            key={report.id}
                                            onClick={() => setSelectedReportId(report.id)}
                                            className={`bg-white dark:bg-gray-900 border rounded-3xl p-4 transition cursor-pointer shadow-sm relative overflow-hidden ${
                                                isSelected
                                                    ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-md'
                                                    : 'border-gray-200 dark:border-gray-800 hover:border-teal-300 dark:hover:border-teal-700'
                                            }`}
                                        >
                                            {/* Top Tag Strip */}
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="px-2.5 py-1 bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20 rounded-xl text-xs font-black">
                                                        CAR #{carNum}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-[10px] font-bold">
                                                        {assistanceType}
                                                    </span>
                                                </div>

                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        report.status === ReportStatus.IN_PROGRESS
                                                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                                            : report.status === ReportStatus.ON_SCENE
                                                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                                            : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                                    }`}
                                                >
                                                    {report.status.replace(/_/g, ' ')}
                                                </span>
                                            </div>

                                            {/* Title & Vehicle */}
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                {report.title}
                                            </h4>

                                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
                                                <User className="w-3.5 h-3.5 text-gray-400" />
                                                <span className="font-semibold text-gray-800 dark:text-gray-200">{memberName}</span>
                                                {(report as any).vehicle_make && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{(report as any).vehicle_make} {(report as any).vehicle_model}</span>
                                                    </>
                                                )}
                                                {(report as any).license_plate && (
                                                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono font-bold text-[10px]">
                                                        {(report as any).license_plate}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Location Pin */}
                                            <div className="flex items-start gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                <MapPin className="w-3.5 h-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
                                                <span className="truncate">{report.location}</span>
                                            </div>

                                            {/* Time elapsed */}
                                            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400">
                                                <span>{safeFormatDistanceToNow(report.reported_at, { addSuffix: true })}</span>
                                                <span className="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                                                    View Details & Actions
                                                    <ArrowUpRight className="w-3 h-3" />
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Selected Callout Detailed Operations Panel (Right Column) */}
                        <div className="lg:col-span-7">
                            {selectedReport ? (
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-6">
                                    {/* Callout Header & Docket Info */}
                                    <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-800">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-3 py-1 bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/30 rounded-xl text-xs font-black">
                                                    CAR #{(selectedReport as any).car_number || (selectedReport as any).card_number || selectedReport.ob_number}
                                                </span>
                                                <span className="px-2.5 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold">
                                                    {(selectedReport as any).assistance_type || 'Roadside Assistance'}
                                                </span>
                                                {(selectedReport as any).rollback && (
                                                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded-lg text-[10px] font-bold">
                                                        Rollback / Flatbed
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mt-2">
                                                {selectedReport.title}
                                            </h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                Ref OB: {selectedReport.ob_number || 'N/A'} • Logged: {new Date(selectedReport.reported_at).toLocaleString()}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setPreviewingReport(selectedReport)}
                                                className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs font-bold flex items-center gap-1.5 transition"
                                                title="Print Official Roadside Docket"
                                            >
                                                <Printer className="w-4 h-4 text-teal-600" />
                                                <span className="hidden sm:inline">Print Docket</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Action Workflow Controls (Step-by-step) */}
                                    <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            Driver Action Workflow
                                        </p>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {/* Accept / Start */}
                                            {selectedReport.status === ReportStatus.PENDING || selectedReport.status === ReportStatus.ACTIVE ? (
                                                <button
                                                    onClick={() => handleReportStatusStep(selectedReport, ReportStatus.IN_PROGRESS, 'Driver accepted callout and is en route.')}
                                                    className="col-span-2 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 active:scale-95"
                                                >
                                                    <Navigation className="w-4 h-4" />
                                                    Accept & Start Trip (En Route)
                                                </button>
                                            ) : selectedReport.status === ReportStatus.IN_PROGRESS ? (
                                                <button
                                                    onClick={() => handleReportStatusStep(selectedReport, ReportStatus.ON_SCENE, 'Driver arrived on scene at breakdown location.')}
                                                    className="col-span-2 py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2 active:scale-95"
                                                >
                                                    <MapPin className="w-4 h-4" />
                                                    Mark Arrived On Scene
                                                </button>
                                            ) : (
                                                <div className="col-span-2 py-2.5 px-3 bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 rounded-xl text-xs font-bold flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    <span>On Scene Confirmed</span>
                                                </div>
                                            )}

                                            {/* Pre-Tow Inspection */}
                                            <button
                                                onClick={() => setInspectingReport(selectedReport)}
                                                className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-1.5 active:scale-95"
                                            >
                                                <Shield className="w-3.5 h-3.5" />
                                                <span>Inspection Log</span>
                                            </button>

                                            {/* Complete / Sign-off */}
                                            <button
                                                onClick={() => setCompletingReport(selectedReport)}
                                                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-1.5 active:scale-95"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Complete & Sign</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Member & Contact Details */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Member Contact Card */}
                                        <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                    Member / Motorist
                                                </span>
                                                <User className="w-4 h-4 text-teal-600" />
                                            </div>
                                            <p className="text-base font-bold text-gray-900 dark:text-white">
                                                {(selectedReport as any).driver_name || 'Member'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                Contact: {(selectedReport as any).cell || (selectedReport as any).contact_number || (selectedReport as any).phone || 'N/A'}
                                            </p>

                                            {/* Quick Call & WhatsApp Action Buttons */}
                                            <div className="flex items-center gap-2 mt-3">
                                                {((selectedReport as any).cell || (selectedReport as any).contact_number || (selectedReport as any).phone) && (
                                                    <>
                                                        <a
                                                            href={`tel:${(selectedReport as any).cell || (selectedReport as any).contact_number || (selectedReport as any).phone}`}
                                                            className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow"
                                                        >
                                                            <Phone className="w-3.5 h-3.5" />
                                                            Call Member
                                                        </a>
                                                        <a
                                                            href={`https://wa.me/${((selectedReport as any).cell || (selectedReport as any).contact_number || (selectedReport as any).phone || '').replace(/[^0-9]/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow"
                                                        >
                                                            <MessageSquare className="w-3.5 h-3.5" />
                                                            WhatsApp
                                                        </a>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Vehicle Specs Card */}
                                        <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                    Breakdown Vehicle Specs
                                                </span>
                                                <Car className="w-4 h-4 text-teal-600" />
                                            </div>
                                            <p className="text-base font-bold text-gray-900 dark:text-white">
                                                {(selectedReport as any).vehicle_make || ''} {(selectedReport as any).vehicle_model || 'Unspecified Vehicle'}
                                            </p>
                                            <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-600 dark:text-gray-300">
                                                {(selectedReport as any).license_plate && (
                                                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded font-mono font-bold">
                                                        Plate: {(selectedReport as any).license_plate}
                                                    </span>
                                                )}
                                                {(selectedReport as any).vehicle_color && (
                                                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded font-medium">
                                                        Color: {(selectedReport as any).vehicle_color}
                                                    </span>
                                                )}
                                                {(selectedReport as any).vin && (
                                                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded font-mono text-[10px]">
                                                        VIN: {(selectedReport as any).vin}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Breakdown & Drop-off Locations with Turn-by-Turn */}
                                    <div className="space-y-3">
                                        {/* Scene Location */}
                                        <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex-shrink-0">
                                                    <MapPin className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                                                        Breakdown Scene Location
                                                    </span>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                                                        {selectedReport.location}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => launchNavigation(selectedReport.location_coords, selectedReport.location)}
                                                    className="flex-1 sm:flex-none px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition"
                                                >
                                                    <Navigation className="w-3.5 h-3.5" />
                                                    Google Maps
                                                </button>
                                                <button
                                                    onClick={() => launchWaze(selectedReport.location_coords)}
                                                    className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition"
                                                >
                                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                                    Waze
                                                </button>
                                            </div>
                                        </div>

                                        {/* Drop-off Destination (if any) */}
                                        {(selectedReport as any).drop_off_location && (
                                            <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                                                        <Navigation className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                                            Drop-off / Destination Workshop
                                                        </span>
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                                                            {(selectedReport as any).drop_off_location}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={() =>
                                                            launchNavigation(
                                                                (selectedReport as any).drop_off_location_coords,
                                                                (selectedReport as any).drop_off_location
                                                            )
                                                        }
                                                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition"
                                                    >
                                                        <Navigation className="w-3.5 h-3.5" />
                                                        Navigate to Drop-off
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Description / Fault Symptoms */}
                                    {selectedReport.description && (
                                        <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                                                Fault Symptoms & Breakdown Description
                                            </p>
                                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                                                {selectedReport.description}
                                            </p>
                                        </div>
                                    )}

                                    {/* Mini Embedded Map for Scene */}
                                    <div className="h-[280px] rounded-2xl overflow-hidden shadow-inner border border-gray-200 dark:border-gray-800">
                                        <RoadsideDriverMapView
                                            report={selectedReport}
                                            driverProfile={profile}
                                        />
                                    </div>

                                    {/* Post Quick Note & Updates Feed */}
                                    <div className="space-y-3 pt-2">
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            Post Driver Note / Progress Update
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder="e.g. Loading vehicle on flatbed, tire changed, or delayed in traffic..."
                                                value={newNotes[selectedReport.id] || ''}
                                                onChange={e => setNewNotes({ ...newNotes, [selectedReport.id]: e.target.value })}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handlePostNote(selectedReport.id);
                                                }}
                                                className="flex-grow px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                                            />
                                            <button
                                                onClick={() => handlePostNote(selectedReport.id)}
                                                disabled={isPostingNote[selectedReport.id] || !newNotes[selectedReport.id]?.trim()}
                                                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow"
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                                <span>Post</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 text-center text-gray-400">
                                    <Wrench className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                                    <p className="text-sm font-semibold">Select a roadside callout on the left to view docket actions.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: FULL ROADSIDE MAP & GPS */}
                {activeTab === 'map' && (
                    <div className="flex-grow w-full h-[650px] min-h-[500px]">
                        <RoadsideDriverMapView
                            report={selectedReport}
                            driverProfile={profile}
                            nearbyReports={activeDispatches}
                            onSelectReport={(r) => {
                                setSelectedReportId(r.id);
                                setActiveTab('dispatches');
                            }}
                        />
                    </div>
                )}

                {/* TAB 3: COMPLETED CALLOUT HISTORY */}
                {activeTab === 'history' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                Completed Roadside Callout Receipts ({completedDispatches.length})
                            </h3>
                            <button
                                onClick={fetchReports}
                                className="p-1.5 text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg transition"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>

                        {completedDispatches.length === 0 ? (
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 text-center">
                                <CheckCircle2 className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">No completed jobs yet</h4>
                                <p className="text-xs text-gray-400 mt-1">
                                    Resolved roadside jobs will appear here with customer sign-offs and printable dockets.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {completedDispatches.map((report) => (
                                    <div
                                        key={report.id}
                                        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm space-y-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="px-2.5 py-1 bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 rounded-xl text-xs font-black">
                                                CAR #{(report as any).car_number || (report as any).card_number || report.ob_number}
                                            </span>
                                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 rounded-full text-[10px] font-bold uppercase">
                                                RESOLVED
                                            </span>
                                        </div>

                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                            {report.title}
                                        </h4>

                                        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                            <p>Location: {report.location}</p>
                                            {(report as any).drop_off_location && (
                                                <p>Drop-off: {(report as any).drop_off_location}</p>
                                            )}
                                            <p>Completed: {report.completed_at ? new Date(report.completed_at).toLocaleString() : 'Done'}</p>
                                        </div>

                                        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                            <span className="text-[11px] text-gray-400">
                                                {(report as any).assistance_type || 'Roadside Assistance'}
                                            </span>
                                            <button
                                                onClick={() => setPreviewingReport(report)}
                                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                                            >
                                                <Printer className="w-3.5 h-3.5 text-teal-600" />
                                                <span>Print Docket</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 4: SAFETY PROTOCOLS & PRE-TRIP CHECKLIST */}
                {activeTab === 'safety' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Daily Pre-Trip Checklist */}
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm space-y-4">
                            <div className="flex items-center gap-2.5 text-teal-600 dark:text-teal-400">
                                <CheckSquare className="w-5 h-5" />
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                    Tow Truck & Equipment Pre-Trip
                                </h3>
                            </div>

                            <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
                                {[
                                    'Winch cable & remote controller inspected for fraying / damage',
                                    'Wheel straps, safety chains & ratchet tie-downs on board',
                                    'Emergency Amber roof beacon & strobe lights functional',
                                    'High-visibility reflective safety jacket worn by driver',
                                    'Heavy-duty jumpstarter pack fully charged (12V & 24V)',
                                    'Floor jack, lug wrench & locking nut master set available',
                                    '4x Reflective warning traffic cones loaded in vehicle',
                                    'Fire extinguisher charged & first aid kit inspected',
                                ].map((item, idx) => (
                                    <label key={idx} className="flex items-start gap-2.5 p-2 bg-gray-50 dark:bg-gray-800/40 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                                        <input type="checkbox" defaultChecked className="mt-0.5 rounded text-teal-600 focus:ring-teal-500" />
                                        <span>{item}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Roadside Safety & Highway Procedures */}
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm space-y-4">
                            <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-5 h-5" />
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                    Highway & Breakdown Safety Rules
                                </h3>
                            </div>

                            <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300">
                                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300">
                                    <p className="font-bold">1. Safe Positioning (The Fend-Off Angle)</p>
                                    <p className="mt-0.5">Park the tow truck 15-20 meters behind the breakdown vehicle, turned at a 20-degree angle towards the shoulder to create a protected safety pocket.</p>
                                </div>

                                <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-900 dark:text-teal-300">
                                    <p className="font-bold">2. Traffic Cone Deployment</p>
                                    <p className="mt-0.5">Place first cone 50 meters back on highway shoulder, tapering inward toward the recovery vehicle. Always face oncoming traffic while placing cones.</p>
                                </div>

                                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300">
                                    <p className="font-bold">3. Passenger Safety Zone</p>
                                    <p className="mt-0.5">Escort the motorist and passengers behind the roadside crash barrier / embankment while winch hookup or wheel change is executed.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* MODALS */}
            {/* 1. Quick Report Modal */}
            <RoadsideQuickReportModal
                isOpen={isQuickReportModalOpen}
                onClose={() => setIsQuickReportModalOpen(false)}
                driverProfile={profile}
                onReportCreated={() => {
                    fetchReports();
                    setActiveTab('dispatches');
                }}
            />

            {/* 2. Pre-Service Inspection Modal */}
            {inspectingReport && (
                <RoadsideInspectionModal
                    isOpen={!!inspectingReport}
                    onClose={() => setInspectingReport(null)}
                    report={inspectingReport}
                    driverProfile={profile}
                    onInspectionSaved={() => fetchReports()}
                />
            )}

            {/* 3. Job Completion Modal */}
            {completingReport && (
                <RoadsideCompletionModal
                    isOpen={!!completingReport}
                    onClose={() => setCompletingReport(null)}
                    report={completingReport}
                    driverProfile={profile}
                    onCompleted={() => {
                        fetchReports();
                        setActiveTab('history');
                    }}
                />
            )}

            {/* 4. Incident Docket Print Preview Modal */}
            {previewingReport && (
                <IncidentReportPreviewModal
                    isOpen={!!previewingReport}
                    onClose={() => setPreviewingReport(null)}
                    report={previewingReport}
                    company={profile.company}
                />
            )}

            {/* 5. SOS Panic Confirmation */}
            <ConfirmModal
                isOpen={isSosConfirmOpen}
                onClose={() => setIsSosConfirmOpen(false)}
                onConfirm={handleTriggerSos}
                title="🚨 TRIGGER EMERGENCY SOS / PANIC?"
                message="This will instantly broadcast a CRITICAL EMERGENCY distress beacon to all controllers and response units with your live GPS coordinates. Only trigger in genuine danger."
                confirmText="BROADCAST SOS NOW"
                confirmButtonClass="bg-red-600 hover:bg-red-700 text-white font-black"
            />
        </div>
    );
};

export default RoadsideDriverPage;
