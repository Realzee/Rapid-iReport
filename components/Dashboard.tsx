

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Report, UserRole, Profile, Responder, ResponderStatus, VehicleReport, ReportStatus, Company } from '../types';
import StatCard from './StatCard';
import ReportList from './ReportList';
import MapView from './MapView';
import ReportModal from './ReportModal';
import ArchiveReportModal from './ArchiveReportModal';
import ReportDetailCard from './ReportDetailCard';
import MapModal from './MapModal';
import { CheckCircleIcon, AlertTriangleIcon, ZapIcon, PlusIcon, ChatAlt2Icon, CarIcon, CrimeIcon } from './icons';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import { useChat } from '../contexts/ChatContext';
import { CONTROLLER_CHANNEL_REPORT } from '../constants';
import { isSameDay, parseISO } from 'date-fns';

interface DashboardProps {
    profile: Profile;
    initialReportId?: string | null;
    onInitialReportHandled?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ profile, initialReportId, onInitialReportHandled }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
    const allUsersRef = useRef<Profile[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [reportToEdit, setReportToEdit] = useState<Report | null>(null);
    const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
    const { addToast } = useToast();
    const { openChat } = useChat();

    useEffect(() => {
        allUsersRef.current = allUsers;
    }, [allUsers]);

    const isGlobalAdmin = profile.role === UserRole.ADMIN && 
        (profile.company?.name?.toLowerCase().includes('rapid911') || false);

    const ACTIVE_STATUSES = [
        ReportStatus.PENDING,
        ReportStatus.ACTIVE,
        ReportStatus.ASSIGNED,
        ReportStatus.IN_PROGRESS,
        ReportStatus.ON_SCENE,
    ];

    const fetchData = useCallback(async () => {
        setLoading(true);

        let allowedReporterIds: string[] | null = null;

        if (!isGlobalAdmin && profile.company_id) {
            const { data: companyUsers } = await supabase
                .from('profiles')
                .select('id')
                .eq('company_id', profile.company_id);
            
            if (companyUsers) {
                allowedReporterIds = companyUsers.map(u => u.id);
            }
        }

        const profilesQuery = supabase.from('profiles').select('*');
        if (!isGlobalAdmin && profile.company_id) {
            profilesQuery.eq('company_id', profile.company_id);
        }

        let vehicleQuery = supabase.from('vehicle_reports').select('*');
        let crimeQuery = supabase.from('crime_reports').select('*');
        let emergencyQuery = supabase.from('emergency_reports').select('*');

        let resolvedVehicleQuery = supabase.from('vehicle_reports').select('*');
        let resolvedCrimeQuery = supabase.from('crime_reports').select('*');
        let resolvedEmergencyQuery = supabase.from('emergency_reports').select('*');

        if (allowedReporterIds) {
            vehicleQuery = vehicleQuery.in('reported_by', allowedReporterIds);
            crimeQuery = crimeQuery.in('reported_by', allowedReporterIds);
            emergencyQuery = emergencyQuery.in('reported_by', allowedReporterIds);
            resolvedVehicleQuery = resolvedVehicleQuery.in('reported_by', allowedReporterIds);
            resolvedCrimeQuery = resolvedCrimeQuery.in('reported_by', allowedReporterIds);
            resolvedEmergencyQuery = resolvedEmergencyQuery.in('reported_by', allowedReporterIds);
        }

        const [
            { data: vehicleData, error: vError }, 
            { data: crimeData, error: cError },
            { data: emergencyData, error: aError },
            { data: resolvedVehicleData, error: rvError },
            { data: resolvedCrimeData, error: rcError },
            { data: resolvedEmergencyData, error: reError },
            { data: usersData, error: uError },
            { data: companiesData, error: companiesError }
        ] = await Promise.all([
            vehicleQuery.in('status', ACTIVE_STATUSES).order('reported_at', { ascending: false }).limit(100),
            crimeQuery.in('status', ACTIVE_STATUSES).order('reported_at', { ascending: false }).limit(100),
            emergencyQuery.in('status', ACTIVE_STATUSES).order('reported_at', { ascending: false }).limit(100),
            resolvedVehicleQuery.in('status', [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED]).gte('completed_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
            resolvedCrimeQuery.in('status', [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED]).gte('completed_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
            resolvedEmergencyQuery.in('status', [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED]).gte('completed_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
            profilesQuery,
            supabase.from('companies').select('*')
        ]);
        if (vError || cError || aError || rvError || rcError || reError || uError || companiesError) console.error('Data fetch error:', vError || cError || aError || rvError || rcError || reError || uError || companiesError);

        const combinedReports = [
            ...(vehicleData || []).map(r => ({...r, type: 'vehicle' as const})), 
            ...(crimeData || []).map(r => ({...r, type: 'crime' as const})),
            ...(emergencyData || []).map(r => ({...r, type: 'emergency' as const})),
            ...(resolvedVehicleData || []).map(r => ({...r, type: 'vehicle' as const})),
            ...(resolvedCrimeData || []).map(r => ({...r, type: 'crime' as const})),
            ...(resolvedEmergencyData || []).map(r => ({...r, type: 'emergency' as const}))
        ];
        
        // Ensure we have profiles for all reporters, even if they are outside the user's company scope
        const reporterIds = Array.from(new Set(combinedReports.map(r => r.reported_by)));
        const loadedUserIds = new Set((usersData || []).map(u => u.id));
        const missingReporterIds = reporterIds.filter(id => !loadedUserIds.has(id));
        
        let additionalProfiles: Profile[] = [];
        if (missingReporterIds.length > 0) {
                const { data: missingProfiles } = await supabase.from('profiles').select('*').in('id', missingReporterIds);
                if (missingProfiles) additionalProfiles = missingProfiles;
        }
        
        setReports(combinedReports);
        setAllUsers([...(usersData || []), ...additionalProfiles]);
        setCompanies(companiesData || []);
        setLoading(false);
    }, [isGlobalAdmin, profile.company_id]);

    useEffect(() => {
        fetchData();

        const handleReportChange = async (payload: any) => {
            const reportType = payload.table === 'vehicle_reports' ? 'vehicle' : (payload.table === 'emergency_reports' ? 'emergency' : 'crime');
            const newReport = { ...payload.new, type: reportType };

            // Filter incoming reports for non-global admins
            if (!isGlobalAdmin && profile.company_id) {
                // Check if reporter is in our loaded users list
                let reporter = allUsersRef.current.find(u => u.id === newReport.reported_by);
                
                if (!reporter) {
                    // Fetch reporter if not found locally
                    const { data } = await supabase.from('profiles').select('*').eq('id', newReport.reported_by).single();
                    if (data) {
                        reporter = data;
                        // Optimistically add to allUsers to avoid re-fetching
                        setAllUsers(prev => [...prev, data]);
                    }
                }

                if (!reporter || reporter.company_id !== profile.company_id) {
                    return; // Ignore report from other company
                }
            }

            setReports(currentReports => {
                if (payload.eventType === 'INSERT') {
                    if (ACTIVE_STATUSES.includes(newReport.status)) {
                        if (currentReports.some(r => r.id === newReport.id)) {
                            return currentReports;
                        }
                        return [newReport, ...currentReports];
                    }
                    return currentReports;
                }
                
                if (payload.eventType === 'UPDATE') {
                    const updatedReport = { ...payload.new, type: reportType };
                    const wasInList = currentReports.some(r => r.id === updatedReport.id);
                    const isNowActive = ACTIVE_STATUSES.includes(updatedReport.status);

                    if (isNowActive) {
                        if (wasInList) {
                            return currentReports.map(r => r.id === updatedReport.id ? updatedReport : r);
                        } else {
                            return [updatedReport, ...currentReports];
                        }
                    } else {
                        if (wasInList) {
                            return currentReports.filter(r => r.id !== updatedReport.id);
                        }
                        return currentReports;
                    }
                }
                
                if (payload.eventType === 'DELETE') {
                    return currentReports.filter(r => r.id !== payload.old.id);
                }
                
                return currentReports;
            });
        };
        
        const handleProfileChange = (payload: any) => {
            setAllUsers(currentUsers => {
                 if (payload.eventType === 'INSERT') {
                    // Avoid duplicates from race conditions
                    if (currentUsers.some(u => u.id === payload.new.id)) return currentUsers;
                    return [...currentUsers, payload.new as Profile];
                }
                if (payload.eventType === 'UPDATE') {
                    return currentUsers.map(u => u.id === payload.new.id ? payload.new as Profile : u);
                }
                if (payload.eventType === 'DELETE') {
                    return currentUsers.filter(u => u.id !== payload.old.id);
                }
                return currentUsers;
            });
        };

        const channelId = `dashboard-reports-${isGlobalAdmin ? 'global' : profile.company_id}`;
        const reportsChannel = supabase.channel(channelId, {
            config: { broadcast: { self: true } },
        });

        if (isGlobalAdmin) {
            reportsChannel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, handleReportChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, handleReportChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, handleReportChange);
        } else if (profile.company_id) {
            reportsChannel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, handleReportChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, handleReportChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, handleReportChange);
        }
        reportsChannel.subscribe();
            
        const profilesChannel = supabase.channel('public:profiles-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleProfileChange)
            .subscribe();

        return () => { 
            supabase.removeChannel(reportsChannel);
            supabase.removeChannel(profilesChannel);
        };
    }, [profile]);

    // Effect to fetch missing reporters for real-time updates
    useEffect(() => {
        const fetchMissingReporters = async () => {
             const reporterIds = new Set(reports.map(r => r.reported_by));
             const loadedUserIds = new Set(allUsers.map(u => u.id));
             const missingReporterIds = Array.from(reporterIds).filter(id => !loadedUserIds.has(id));
             
             if (missingReporterIds.length > 0) {
                 const { data: missingProfiles } = await supabase.from('profiles').select('*').in('id', missingReporterIds);
                 if (missingProfiles && missingProfiles.length > 0) {
                     setAllUsers(prev => {
                         const existingIds = new Set(prev.map(u => u.id));
                         const newProfiles = missingProfiles.filter(p => !existingIds.has(p.id));
                         if (newProfiles.length === 0) return prev;
                         return [...prev, ...newProfiles];
                     });
                 }
             }
        };
        
        const timeoutId = setTimeout(() => {
            if (reports.length > 0) {
                fetchMissingReporters();
            }
        }, 1000);
        
        return () => clearTimeout(timeoutId);
    }, [reports, allUsers]);

    const handleReportSelect = useCallback((reportId: string) => setSelectedReportId(prevId => prevId === reportId ? null : reportId), []);

    useEffect(() => {
        if (initialReportId && onInitialReportHandled && reports.some(r => r.id === initialReportId)) {
            setSelectedReportId(initialReportId);
            onInitialReportHandled();
        }
    }, [initialReportId, onInitialReportHandled, reports]);
    
    // Effect to derive responders from allUsers, ensuring a single source of truth
    useEffect(() => {
        const responderProfiles = allUsers.filter(p => p.role === UserRole.RESPONDER);
        const mappedResponders: Responder[] = responderProfiles.map(p => ({
            id: p.id,
            first_name: p.first_name,
            surname: p.surname,
            status: p.responder_status || ResponderStatus.OFF_DUTY,
            location_coords: p.location_coords || undefined,
        }));
        setResponders(mappedResponders);
    }, [allUsers]);

    const sortedReports = useMemo(() => [...reports].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()), [reports]);
    const selectedReport = useMemo(() => reports.find(r => r.id === selectedReportId), [reports, selectedReportId]);
    
    const handleOpenNewReportModal = useCallback(() => { setReportToEdit(null); setIsReportModalOpen(true); }, []);
    const handleOpenEditReportModal = useCallback((report: Report) => { setReportToEdit(report); setIsReportModalOpen(true); }, []);
    const handleOpenDeleteReportModal = useCallback((report: Report) => setReportToDelete(report), []);
    
    const confirmDeleteReport = useCallback(async () => {
        if (!reportToDelete) return;
        const tableName = reportToDelete.type === 'vehicle' ? 'vehicle_reports' : (reportToDelete.type === 'emergency' ? 'emergency_reports' : 'crime_reports');
        const { error } = await supabase.from(tableName).update({ 
            status: ReportStatus.DELETED,
            deleted_by: profile.id,
            deleted_at: new Date().toISOString()
        }).eq('id', reportToDelete.id);
        
        if (error) {
            addToast(`Error deleting report: ${error.message}`, 'error');
        } else {
            addToast('Report successfully moved to archives.', 'success');
            if (selectedReportId === reportToDelete.id) {
                setSelectedReportId(null);
            }
        }
        setReportToDelete(null);
    }, [reportToDelete, addToast, selectedReportId, profile.id]);
    
    const handleStatusUpdate = useCallback(async (reportId: string, newStatus: ReportStatus, reportType: 'vehicle' | 'crime' | 'emergency') => {
        const tableName = reportType === 'vehicle' ? 'vehicle_reports' : (reportType === 'emergency' ? 'emergency_reports' : 'crime_reports');
        const reportToUpdate = reports.find(r => r.id === reportId);
        if (!reportToUpdate) return;
    
        const isTerminalStatus = [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED].includes(newStatus);
        
        const updatePayload: { status: ReportStatus; assigned_to?: string | null; completed_at?: string | null } = { status: newStatus };
    
        if (isTerminalStatus) {
            updatePayload.completed_at = new Date().toISOString();
            if (reportToUpdate.assigned_to) {
                updatePayload.assigned_to = null;
            }
        } else {
            updatePayload.completed_at = null;
        }
    
        const { error: updateError } = await supabase.from(tableName).update(updatePayload).eq('id', reportId);
    
        if (updateError) {
            addToast("Failed to update status: " + updateError.message, 'error');
            return;
        }
    
        await supabase.from('report_updates').insert({
            report_id: reportId,
            user_id: profile.id,
            content: `Status changed to: ${newStatus.replace(/_/g, ' ')}`
        });
        
        await fetchData();
    
        if (isTerminalStatus && reportToUpdate.assigned_to) {
            const responderId = reportToUpdate.assigned_to;
            
            const { count: activeVehicleAssignments } = await supabase
                .from('vehicle_reports')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', responderId)
                .in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
            
            const { count: activeCrimeAssignments } = await supabase
                .from('crime_reports')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', responderId)
                .in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);

            const { count: activeEmergencyAssignments } = await supabase
                .from('emergency_reports')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', responderId)
                .in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
    
            if ((activeVehicleAssignments === null || activeVehicleAssignments === 0) && 
                (activeCrimeAssignments === null || activeCrimeAssignments === 0) &&
                (activeEmergencyAssignments === null || activeEmergencyAssignments === 0)) {
                const { error: profileUpdateError } = await supabase.from('profiles').update({ responder_status: ResponderStatus.AVAILABLE }).eq('id', responderId);
                if(profileUpdateError) console.warn("Report status updated, but failed to update responder status:", profileUpdateError.message);
            }
        }
        
        // Refresh data to ensure UI is up to date
        await fetchData();
    }, [reports, profile.id, addToast, fetchData]);


    if (loading) return <div className="flex justify-center items-center h-full"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="container mx-auto flex flex-col">
            <div className="flex-shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Control Center</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Live operational overview of community safety.</p>
                    </div>
                    <div className="mt-4 md:mt-0 flex items-center gap-4">
                        <button
                            onClick={() => openChat(CONTROLLER_CHANNEL_REPORT)}
                            className="px-6 py-3.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold rounded-xl shadow-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-300 flex items-center space-x-2"
                            title="Open staff communication channel"
                        >
                            <ChatAlt2Icon className="w-5 h-5" />
                            <span>Staff Channel</span>
                        </button>
                        <button 
                            onClick={handleOpenNewReportModal} 
                            className="px-6 py-3.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold rounded-xl shadow-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-300 flex items-center space-x-2"
                        >
                            <PlusIcon className="w-5 h-5" />
                            <span>New Report</span>
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <StatCard title="Total Reports" value={reports.length.toString()} icon={<ZapIcon />} color="primary" />
                    <StatCard title="Vehicle" value={reports.filter(r => r.type === 'vehicle').length.toString()} icon={<CarIcon />} color="yellow" />
                    <StatCard title="Crime" value={reports.filter(r => r.type === 'crime').length.toString()} icon={<CrimeIcon />} color="red" />
                    <StatCard title="Emergency" value={reports.filter(r => r.type === 'emergency').length.toString()} icon={<AlertTriangleIcon />} color="orange" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <StatCard title="Active Incidents" value={reports.filter(r => r.status === 'active' || r.status === 'in_progress').length.toString()} icon={<AlertTriangleIcon />} color="red" />
                    <StatCard title="Resolved Today" value={reports.filter(r => (r.status === 'resolved' || r.status === 'recovered' || r.status === 'closed') && r.completed_at && isSameDay(parseISO(r.completed_at), new Date())).length.toString()} icon={<CheckCircleIcon />} color="green" />
                    <StatCard title="Available Responders" value={responders.filter(r => r.status === 'available').length.toString()} icon={<ZapIcon />} color="yellow" />
                </div>
            </div>
            <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:w-[400px] lg:flex-shrink-0 lg:h-[calc(100vh-8.5rem-4.5rem-1.5rem)]">
                    {selectedReport ? (
                        <ReportDetailCard report={selectedReport} onClose={() => setSelectedReportId(null)} profile={profile} onEdit={handleOpenEditReportModal} onDelete={handleOpenDeleteReportModal} onViewOnMap={() => setIsMapModalOpen(true)} allUsers={allUsers} />
                    ) : (
                        <ReportList reports={sortedReports} onReportSelect={handleReportSelect} selectedReportId={selectedReportId} profile={profile} allUsers={allUsers} onStatusUpdate={handleStatusUpdate} companies={companies} />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="h-[60vh] lg:h-[calc(100vh-8.5rem-4.5rem-1.5rem)] lg:sticky lg:top-20">
                        <MapView 
                            reports={reports} 
                            responders={responders} 
                            selectedReportId={selectedReportId} 
                            profile={profile} 
                            onReportSelect={handleReportSelect}
                            allUsers={allUsers}
                        />
                    </div>
                </div>
            </div>
            <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} reportToEdit={reportToEdit} onReportSubmitted={() => window.location.reload()} />
            <ArchiveReportModal isOpen={!!reportToDelete} onClose={() => setReportToDelete(null)} onConfirm={confirmDeleteReport} reportIdentifier={reportToDelete ? (reportToDelete.type === 'vehicle' ? (reportToDelete as any).license_plate : reportToDelete.title) : ''} />
            <MapModal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} report={selectedReport} />
        </div>
    );
};

export default Dashboard;