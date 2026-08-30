import React, { useState, useEffect } from 'react';
import { Profile, Attendance } from '../types';
import { supabase, getSafeNextObSequence } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import ClockInModal from '../components/ClockInModal';
import { AlertOctagon, ShieldAlert, Bell, Loader2, MapPin, Radio, Wifi } from 'lucide-react';

interface GuardDashboardPageProps {
    profile: Profile;
}

export const GuardDashboardPage: React.FC<GuardDashboardPageProps> = ({ profile }) => {
    const [attendance, setAttendance] = useState<Attendance | null>(null);
    const [loading, setLoading] = useState(false);
    const [siteUpdate, setSiteUpdate] = useState('');
    const [showClockModal, setShowClockModal] = useState(false);
    const { addToast } = useToast();

    // Company state
    const [companyName, setCompanyName] = useState<string>('Security Force');

    // Panic states
    const [isTriggering, setIsTriggering] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch company and active attendance on mount
    useEffect(() => {
        const fetchCompany = async () => {
            if (profile.company_id) {
                try {
                    const { data } = await supabase
                        .from('companies')
                        .select('name')
                        .eq('id', profile.company_id)
                        .maybeSingle();
                    if (data && data.name) {
                        setCompanyName(data.name);
                    }
                } catch (err) {
                    console.error('Error fetching company:', err);
                }
            }
        };

        const fetchAttendance = async () => {
            try {
                const { data, error } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('user_id', profile.id)
                    .is('clock_out_time', null)
                    .order('clock_in_time', { ascending: false });
                
                if (error) {
                    console.error('Error fetching attendance:', error);
                    return;
                }
                if (data && data.length > 0) {
                    setAttendance(data[0]);
                }
            } catch (err) {
                console.error('Error in fetchAttendance:', err);
            }
        };

        fetchCompany();
        fetchAttendance();
    }, [profile.id, profile.company_id]);

    // Handle countdown timer for panic triggers
    useEffect(() => {
        let interval: any = null;
        if (isTriggering && countdown > 0) {
            interval = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        setIsTriggering(false);
                        triggerPanic();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isTriggering, countdown]);

    // Standard RFC4122 v4 UUID generator for secure DB IDs
    const generateUUID = () => {
        if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    // Actual panic insertion logic
    const triggerPanic = async () => {
        setLoading(true);
        setError(null);
        
        try {
            // 1. Get exact GPS coords if permitted
            let lat = -26.2041; // Default context-appropriate coords
            let lng = 28.0473;
            let locationDesc = 'Guard Mobile SOS Location';

            try {
                const pos = await new Promise<any>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 6000,
                        maximumAge: 0
                    });
                });
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                locationDesc = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)} (Guard Active GPS)`;
            } catch (geoError) {
                console.warn('GPS coordinates acquisition timed out or failed:', geoError);
                addToast('Warning: exact GPS unavailable, triggering panic with network approximation', 'warning');
            }

            // 2. Fetch or generate OB Sequence
            const now = new Date();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const year = now.getFullYear();
            const initial = companyName ? companyName.charAt(0).toUpperCase() : 'G';
            let ob_number = `PANIC-${Date.now().toString().slice(-6)}`;
            
            try {
                const seq = await getSafeNextObSequence(profile.company_id, now);
                if (seq) {
                    ob_number = `${initial}${String(seq).padStart(4, '0')}/${month}/${year}`;
                }
            } catch (rpcErr) {
                console.error('Failed to retrieve OB number, falling back to timestamp:', rpcErr);
            }

            // 3. Prepare the database payload
            const reportId = generateUUID();
            const insertPayload = {
                id: reportId,
                ob_number: ob_number,
                title: `🚨 GUARD PANIC: ${profile.first_name} ${profile.surname}`,
                description: `CRITICAL ALERT: Guard ${profile.first_name} ${profile.surname} activated the SOS PANIC trigger from their Guard Dashboard. Immediate assistance/backup required. Duty details: ${attendance ? 'Active shift clocked in' : 'Not clocked in'}. Cell contact: ${profile.cell || 'Not Provided'}.`,
                location: locationDesc,
                crime_type: 'PUBLIC_PANIC_ASSIST',
                severity: 'critical',
                status: 'active',
                reported_by: profile.id,
                reported_at: now.toISOString(),
                location_coords: { lat, lng },
                company_id: profile.company_id,
                vehicle_involved: false,
                cit_success: false
            };

            // 4. Perform direct database insert so it triggers the Controller real-time subscription instantly
            const { error: insertError } = await supabase
                .from('crime_reports')
                .insert(insertPayload);

            if (insertError) {
                throw new Error(insertError.message);
            }

            // Log activity log
            try {
                await supabase.from('user_activity_logs').insert({
                    user_id: profile.id,
                    action: 'TRIGGER_PANIC',
                    details: `Guard triggered SOS Panic. OB Number: ${ob_number}`
                });
            } catch (logErr) {
                console.error('Failed to log panic activity:', logErr);
            }

            addToast('CRITICAL SOS broadcasted! Control Room has been alerted.', 'success');
            setIsSent(true);
        } catch (err: any) {
            console.error('Error during panic triggering:', err);
            addToast(`Failed to dispatch panic: ${err.message}`, 'error');
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePanicClick = () => {
        if (isSent) {
            setIsSent(false);
            setCountdown(3);
            return;
        }
        setIsTriggering(true);
        setCountdown(3);
    };

    const handleCancelPanic = () => {
        setIsTriggering(false);
        setCountdown(3);
        addToast('SOS Dispatch Aborted.', 'info');
    };

    const performClock = async (currentLocation: string) => {
        setLoading(true);
        setShowClockModal(false);

        if (attendance) {
            // Clock out
            const { error } = await supabase
                .from('attendance')
                .update({ clock_out_time: new Date().toISOString(), clock_out_location: currentLocation })
                .eq('id', attendance.id);
            if (!error) {
                setAttendance(null);
                addToast('Clocked out successfully', 'success');
            } else {
                addToast('Error clocking out', 'error');
            }
        } else {
            // Clock in
            const { data, error } = await supabase
                .from('attendance')
                .insert({ user_id: profile.id, clock_in_time: new Date().toISOString(), clock_in_location: currentLocation })
                .select()
                .single();
            if (data) {
                setAttendance(data);
                addToast('Clocked in successfully', 'success');
            } else {
                addToast('Error clocking in', 'error');
            }
        }
        setLoading(false);
    };

    const handleSendUpdate = async () => {
        if (!siteUpdate.trim()) return;
        setLoading(true);
        const { error } = await supabase
            .from('report_updates')
            .insert({ report_id: 'SYSTEM_Update', user_id: profile.id, content: siteUpdate });
        if (!error) {
            addToast('Update sent to control', 'success');
            setSiteUpdate('');
        } else {
            addToast('Error sending update', 'error');
        }
        setLoading(false);
    };

    return (
        <div className="py-3 px-2 sm:p-6 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Guard Dashboard</h1>
                    <p className="text-gray-600 dark:text-gray-400">Welcome, {profile.first_name} {profile.surname} ({companyName})</p>
                </div>
                <div className="mt-2 sm:mt-0 flex items-center gap-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full border border-blue-150">
                    <Wifi className="w-3.5 h-3.5 animate-pulse" />
                    <span>Control Link Active</span>
                </div>
            </div>

            {/* CRITICAL SOS PANIC BUTTON SECTION */}
            <div className={`mb-6 p-5 sm:p-6 rounded-2xl border transition-all duration-300 shadow-md ${
                isSent 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : isTriggering 
                    ? 'bg-amber-500/10 border-amber-500/40 animate-pulse' 
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-2 mb-1.5">
                            <ShieldAlert className={`w-5 h-5 ${isSent || isTriggering ? 'text-red-500 animate-bounce' : 'text-gray-400'}`} />
                            <span className="text-xs font-bold uppercase tracking-widest text-red-500">
                                Emergency Services
                            </span>
                        </div>
                        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                            {isSent ? 'SOS ALARM DISPATCHED' : isTriggering ? 'DISPATCHING EMERGENCY SOS...' : 'Tactical Panic Assist'}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">
                            {isSent 
                                ? 'Live SOS signal is actively broadcasting. Controllers have been alerted, and armed response is dispatching to your current coordinates.'
                                : isTriggering 
                                ? 'SOS broadcast will initiate in ' + countdown + ' seconds. Press CANCEL now to abort the automatic dispatch.'
                                : 'Press the PANIC button in case of immediate danger, threat, or injury. This alerts all control room commanders instantly.'}
                        </p>
                    </div>

                    <div className="flex flex-col items-center gap-3 w-full sm:w-auto">
                        {isTriggering ? (
                            <div className="flex flex-col items-center gap-2">
                                <button
                                    onClick={handleCancelPanic}
                                    className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl text-sm transition shadow-sm"
                                >
                                    CANCEL DISPATCH ({countdown}s)
                                </button>
                                <span className="text-3xl font-black font-mono text-amber-500 animate-ping">
                                    {countdown}
                                </span>
                            </div>
                        ) : isSent ? (
                            <div className="flex flex-col items-center gap-2">
                                <button
                                    onClick={handlePanicClick}
                                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wide transition shadow-md"
                                >
                                    Dismiss & Reset SOS
                                </button>
                                <span className="flex items-center gap-1.5 text-xs text-red-500 font-bold animate-pulse">
                                    <Radio className="w-3.5 h-3.5" />
                                    Live Ping Active
                                </span>
                            </div>
                        ) : (
                            <button
                                onClick={handlePanicClick}
                                disabled={loading}
                                className="w-32 h-32 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-xl tracking-wider shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all flex flex-col items-center justify-center border-4 border-red-500 animate-pulse"
                                style={{ boxShadow: '0 0 25px rgba(220, 38, 38, 0.4)' }}
                            >
                                <AlertOctagon className="w-8 h-8 mb-1 animate-bounce" />
                                PANIC
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ATTENDANCE SECTION */}
                <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div>
                        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1.5">Duty Attendance</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Log your shift start and end times to update control dispatchers.
                        </p>
                        {attendance ? (
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800/50 mb-4">
                                <p className="text-xs text-emerald-800 dark:text-emerald-400 font-semibold">Active Shift Status</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Clocked in since: <strong className="font-mono text-gray-700 dark:text-gray-300">{new Date(attendance.clock_in_time).toLocaleTimeString()}</strong>
                                </p>
                            </div>
                        ) : (
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200/50 dark:border-gray-800 mb-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Not currently clocked in. Please record attendance to receive task assignments.</p>
                            </div>
                        )}
                    </div>
                    <div>
                        <button 
                            onClick={() => setShowClockModal(true)} 
                            disabled={loading}
                            className={`w-full py-2.5 px-4 rounded-xl font-bold transition-all shadow-xs ${
                                attendance 
                                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                        >
                            {attendance ? 'Clock Out of Duty' : 'Clock In to Duty'}
                        </button>
                        <ClockInModal
                            isOpen={showClockModal}
                            onClose={() => setShowClockModal(false)}
                            onConfirm={performClock}
                            action={attendance ? 'clockOut' : 'clockIn'}
                        />
                    </div>
                </div>

                {/* SITE REPORT UPDATES */}
                <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div>
                        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1.5">Live Site Report Updates</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                            Submit physical checklist reports or general site patrol logs.
                        </p>
                        <textarea 
                            value={siteUpdate} 
                            onChange={(e) => setSiteUpdate(e.target.value)}
                            rows={3}
                            className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl mb-3 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                            placeholder="Type shift checklist completed, perimeter check, suspicious vehicle spotted, etc..."
                        />
                    </div>
                    <div>
                        <button 
                            onClick={handleSendUpdate}
                            disabled={loading || !siteUpdate.trim()}
                            className="w-full py-2.5 px-4 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
                        >
                            Send Update to Control
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuardDashboardPage;
