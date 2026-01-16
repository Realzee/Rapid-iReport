
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Report, ReportStatus, UserRole, Profile, Responder, ResponderStatus, VehicleReport, ReportUpdate, LocationCoords } from '../types';
import StatCard from './StatCard';
import ReportList from './ReportList';
import MapView from './MapView';
import ReportModal from './NewReportModal';
import DeleteReportModal from './DeleteReportModal';
import ReportDetailCard from './ReportDetailCard';
import MapModal from './MapModal';
import { CheckCircleIcon, AlertTriangleIcon, ZapIcon, PlusIcon, NavigationIcon, CameraIcon, XIcon } from './icons';
import { supabase } from '../utils/supabase';
import { formatDistanceToNow, format } from 'date-fns';
import StatusBadge from './StatusBadge';

interface DashboardProps {
    profile: Profile;
    setProfile: (profile: Profile) => void;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

// --- RESPONDER DASHBOARD ---
const ResponderDashboard: React.FC<{ profile: Profile; setProfile: (profile: Profile) => void; }> = ({ profile, setProfile }) => {
    const [isOnDuty, setIsOnDuty] = useState(profile.responder_status !== ResponderStatus.OFF_DUTY);
    const [isSharingLocation, setIsSharingLocation] = useState(false);
    const [assignedReports, setAssignedReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const locationWatchId = useRef<number | null>(null);

    useEffect(() => {
        setIsOnDuty(profile.responder_status !== ResponderStatus.OFF_DUTY);
    }, [profile.responder_status]);

    // Fetch initial data
    useEffect(() => {
        const fetchAssignedReports = async () => {
            setLoading(true);
            const { data, error } = await supabase.from('vehicle_reports').select('*').eq('assigned_to', profile.id);
            const { data: crimeData, error: crimeError } = await supabase.from('crime_reports').select('*').eq('assigned_to', profile.id);

            if (error || crimeError) {
                console.error("Error fetching reports:", error || crimeError);
            } else {
                const combined = [...(data || []), ...(crimeData || [])].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
                setAssignedReports(combined);
            }
            setLoading(false);
        };
        fetchAssignedReports();
    }, [profile.id]);
    
    // Realtime subscriptions for reports
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
                return [newReport, ...prev];
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
    }, [profile.id]);

    // Location Sharing Logic
    const startLocationSharing = () => {
        if (navigator.geolocation && locationWatchId.current === null) {
            setIsSharingLocation(true);
            locationWatchId.current = navigator.geolocation.watchPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    await supabase.from('profiles').update({ location_coords: { lat: latitude, lng: longitude } }).eq('id', profile.id);
                },
                (error) => {
                    console.warn(`Location sharing error: ${error.message}`);
                    setIsSharingLocation(false);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
            );
        }
    };
    const stopLocationSharing = () => {
        if (locationWatchId.current !== null) {
            navigator.geolocation.clearWatch(locationWatchId.current);
            locationWatchId.current = null;
        }
        setIsSharingLocation(false);
    };

    const handleDutyToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDutyStatus = e.target.checked;
        const newResponderStatus = newDutyStatus ? ResponderStatus.AVAILABLE : ResponderStatus.OFF_DUTY;

        const { data: updatedProfile, error } = await supabase
            .from('profiles')
            .update({ responder_status: newResponderStatus, location_coords: null })
            .eq('id', profile.id)
            .select()
            .single();

        if (error) {
            console.error("Failed to update duty status:", error);
            alert("Failed to update duty status. Please try again.");
        } else if (updatedProfile) {
            setProfile(updatedProfile);
            if (newDutyStatus) {
                startLocationSharing();
            } else {
                stopLocationSharing();
            }
        }
    };
    
    // Start sharing on mount if already on duty
    useEffect(() => {
        if (isOnDuty) startLocationSharing();
        return () => stopLocationSharing();
    }, [isOnDuty]);
    
    const selectedReport = useMemo(() => assignedReports.find(r => r.id === selectedReportId), [assignedReports, selectedReportId]);

    if (loading) {
        return <div className="flex justify-center items-center h-full"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }
    
    return (
        <div className="container mx-auto">
            {selectedReport ? (
                <ResponderReportDetail report={selectedReport} onBack={() => setSelectedReportId(null)} profile={profile} />
            ) : (
                <>
                    <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg dark:shadow-none mb-6">
                        <h3 className="text-lg font-bold mb-2">On-Duty Manager</h3>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={isOnDuty} onChange={handleDutyToggle} className="sr-only peer" />
                                    <div className="w-14 h-8 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                                </label>
                                <span className="font-semibold text-lg">{isOnDuty ? 'On Duty' : 'Off Duty'}</span>
                            </div>
                            {isOnDuty && (
                                <div className="flex items-center gap-2 text-sm">
                                    {isSharingLocation ? (
                                        <>
                                            <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span>
                                            <span className="text-green-600 dark:text-green-400">Location Active</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="relative flex h-3 w-3"><span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span></span>
                                            <span className="text-yellow-600 dark:text-yellow-400">Acquiring location...</span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold mb-4">Assigned Incidents</h2>
                    {assignedReports.length === 0 ? (
                        <p className="text-center py-10 text-gray-500 dark:text-gray-400">You have no active assignments. Stand by.</p>
                    ) : (
                        <div className="space-y-4">
                            {assignedReports.map(report => (
                                <div key={report.id} onClick={() => setSelectedReportId(report.id)} className="bg-white/70 dark:bg-gray-900/60 border-l-4 border-gray-300 dark:border-gray-600 rounded-r-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors shadow-sm">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-lg">{isVehicleReport(report) ? report.license_plate : report.title}</h3>
                                        <StatusBadge status={report.status} />
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{isVehicleReport(report) ? `${report.vehicle_make} ${report.vehicle_model}` : report.crime_type}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};


// --- CONTROL CENTER DASHBOARD ---
const ControlCenterDashboard: React.FC<{ profile: Profile }> = ({ profile }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [reportToEdit, setReportToEdit] = useState<Report | null>(null);
    const [reportToDelete, setReportToDelete] = useState<Report | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [
                { data: vehicleData, error: vError }, { data: crimeData, error: cError },
                { data: respondersData, error: rError }, { data: usersData, error: uError }
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*').order('reported_at', { ascending: false }).limit(100),
                supabase.from('crime_reports').select('*').order('reported_at', { ascending: false }).limit(100),
                supabase.from('profiles').select('*').eq('role', UserRole.RESPONDER),
                supabase.from('profiles').select('*')
            ]);
            if (vError || cError || rError || uError) console.error('Data fetch error');

            const combinedReports = [...(vehicleData || []).map(r => ({...r, type: 'vehicle'})), ...(crimeData || []).map(r => ({...r, type: 'crime'}))];
            const mappedResponders: Responder[] = (respondersData || []).map(p => ({ id: p.id, full_name: p.full_name, status: p.responder_status || ResponderStatus.OFF_DUTY, location_coords: p.location_coords || undefined }));
            
            setReports(combinedReports);
            setResponders(mappedResponders);
            setAllUsers(usersData || []);
            setLoading(false);
        };
        fetchData();

        const channel = supabase.channel('public:reports-and-responders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `role=eq.${UserRole.RESPONDER}` }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const sortedReports = useMemo(() => reports.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()), [reports]);
    const selectedReport = useMemo(() => reports.find(r => r.id === selectedReportId), [reports, selectedReportId]);

    const handleReportSelect = (reportId: string) => setSelectedReportId(prevId => prevId === reportId ? null : reportId);
    const handleOpenNewReportModal = () => { setReportToEdit(null); setIsReportModalOpen(true); };
    const handleOpenEditReportModal = (report: Report) => { setReportToEdit(report); setIsReportModalOpen(true); };
    const handleOpenDeleteReportModal = (report: Report) => setReportToDelete(report);
    const confirmDeleteReport = async () => {
        if (!reportToDelete) return;
        const tableName = isVehicleReport(reportToDelete) ? 'vehicle_reports' : 'crime_reports';
        await supabase.from(tableName).delete().eq('id', reportToDelete.id);
        setReportToDelete(null);
    };

    if (loading) return <div className="flex justify-center items-center h-full"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="container mx-auto flex flex-col">
            <div className="flex-shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Control Center</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Live operational overview of community safety.</p>
                    </div>
                    <button onClick={handleOpenNewReportModal} className="px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2"><PlusIcon className="w-5 h-5" /><span>New Report</span></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <StatCard title="Total Reports" value={reports.length.toString()} icon={<ZapIcon />} color="blue" />
                    <StatCard title="Active Incidents" value={reports.filter(r => r.status === 'active' || r.status === 'in_progress').length.toString()} icon={<AlertTriangleIcon />} color="red" />
                    <StatCard title="Resolved Today" value={reports.filter(r => r.status === 'resolved' || r.status === 'recovered').length.toString()} icon={<CheckCircleIcon />} color="green" />
                    <StatCard title="Available Responders" value={responders.filter(r => r.status === 'available').length.toString()} icon={<ZapIcon />} color="yellow" />
                </div>
            </div>
            <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:w-[400px] lg:flex-shrink-0">
                    {selectedReport ? (
                        <ReportDetailCard report={selectedReport} onClose={() => setSelectedReportId(null)} profile={profile} onEdit={handleOpenEditReportModal} onDelete={handleOpenDeleteReportModal} onViewOnMap={() => setIsMapModalOpen(true)} />
                    ) : (
                        <ReportList reports={sortedReports} onReportSelect={handleReportSelect} selectedReportId={selectedReportId} profile={profile} allUsers={allUsers} onStatusUpdate={() => Promise.resolve()} />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="h-[60vh] lg:h-[calc(100vh-8.5rem)] lg:sticky lg:top-20">
                        <MapView reports={reports} responders={responders} selectedReportId={selectedReportId} />
                    </div>
                </div>
            </div>
            <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} reportToEdit={reportToEdit} />
            <DeleteReportModal isOpen={!!reportToDelete} onClose={() => setReportToDelete(null)} onConfirm={confirmDeleteReport} reportIdentifier={reportToDelete ? (isVehicleReport(reportToDelete) ? reportToDelete.license_plate : reportToDelete.title) : ''} />
            <MapModal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} report={selectedReport} />
        </div>
    );
};


// --- Main Dashboard Component ---
const Dashboard: React.FC<DashboardProps> = ({ profile, setProfile }) => {
    if (profile.role === UserRole.RESPONDER) {
        return <ResponderDashboard profile={profile} setProfile={setProfile} />;
    }
    return <ControlCenterDashboard profile={profile} />;
};


// New Responder Incident Detail Component
const ResponderReportDetail: React.FC<{ report: Report, onBack: () => void, profile: Profile }> = ({ report, onBack, profile }) => {
    const [updates, setUpdates] = useState<ReportUpdate[]>([]);
    const [newUpdate, setNewUpdate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const fetchUpdates = async () => { /* Fetch and set updates */ 
            const { data } = await supabase.from('report_updates').select('*, profile:profiles(full_name)').eq('report_id', report.id).order('created_at');
            setUpdates(data?.map(u => ({...u, user_full_name: (u.profile as any)?.full_name || 'System'})) || []);
        };
        fetchUpdates();
        const channel = supabase.channel(`updates-${report.id}`).on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'report_updates', filter: `report_id=eq.${report.id}`}, () => fetchUpdates()).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [report.id]);

    const handleStatusUpdate = async (status: ReportStatus) => {
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        await supabase.from(tableName).update({ status }).eq('id', report.id);
        await supabase.from('report_updates').insert({ report_id: report.id, user_id: profile.id, content: `Status changed to: ${status.replace(/_/g, ' ')}` });
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
    
    return (
        <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg">
            <button onClick={onBack} className="text-blue-600 dark:text-blue-400 mb-4">&larr; Back to List</button>
            <h2 className="text-2xl font-bold">{isVehicleReport(report) ? report.license_plate : report.title}</h2>
            <p className="font-mono text-sm text-gray-500 dark:text-gray-400 mb-4">{report.ob_number}</p>
            
            <div className="grid grid-cols-3 gap-2 mb-4">
                <button onClick={() => handleStatusUpdate(ReportStatus.IN_PROGRESS)} disabled={report.status === ReportStatus.IN_PROGRESS} className={`${actionButtonClasses} bg-blue-600 text-white`}>En Route</button>
                <button onClick={() => handleStatusUpdate(ReportStatus.ON_SCENE)} disabled={report.status === ReportStatus.ON_SCENE} className={`${actionButtonClasses} bg-yellow-500 text-white`}>On Scene</button>
                <button onClick={() => handleStatusUpdate(ReportStatus.RESOLVED)} disabled={report.status === ReportStatus.RESOLVED} className={`${actionButtonClasses} bg-green-600 text-white`}>Resolve</button>
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


export default Dashboard;