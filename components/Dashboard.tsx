
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Report, UserRole, Profile, Responder, ResponderStatus, VehicleReport, ReportStatus, Company } from '../types';
import StatCard from './StatCard';
import ReportList from './ReportList';
import MapView from './MapView';
import ReportModal from './ReportModal';
import ArchiveReportModal from './ArchiveReportModal';
import ReportDetailCard from './ReportDetailCard';
import MapModal from './MapModal';
import { CheckCircleIcon, AlertTriangleIcon, ZapIcon, PlusIcon } from './icons';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';

interface DashboardProps {
    profile: Profile;
    initialReportId?: string | null;
    onInitialReportHandled?: () => void;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const Dashboard: React.FC<DashboardProps> = ({ profile, initialReportId, onInitialReportHandled }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [reportToEdit, setReportToEdit] = useState<Report | null>(null);
    const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
    const { addToast } = useToast();

    useEffect(() => {
        const activeStatuses = [
            ReportStatus.PENDING,
            ReportStatus.ACTIVE,
            ReportStatus.ASSIGNED,
            ReportStatus.IN_PROGRESS,
            ReportStatus.ON_SCENE,
        ];

        const fetchData = async () => {
            setLoading(true);

            const profilesQuery = supabase.from('profiles').select('*');
            if (profile.role !== UserRole.ADMIN && profile.company_id) {
                profilesQuery.eq('company_id', profile.company_id);
            }

            const [
                { data: vehicleData, error: vError }, 
                { data: crimeData, error: cError },
                { data: usersData, error: uError },
                { data: companiesData, error: companiesError }
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*').in('status', activeStatuses).order('reported_at', { ascending: false }).limit(100),
                supabase.from('crime_reports').select('*').in('status', activeStatuses).order('reported_at', { ascending: false }).limit(100),
                profilesQuery,
                supabase.from('companies').select('*')
            ]);
            if (vError || cError || uError || companiesError) console.error('Data fetch error:', vError || cError || uError || companiesError);

            const combinedReports = [...(vehicleData || []).map(r => ({...r, type: 'vehicle'})), ...(crimeData || []).map(r => ({...r, type: 'crime'}))];
            
            setReports(combinedReports);
            setAllUsers(usersData || []);
            setCompanies(companiesData || []);
            setLoading(false);
        };
        fetchData();

        const handleReportChange = (payload: any) => {
            const reportType = payload.table === 'vehicle_reports' ? 'vehicle' : 'crime';

            setReports(currentReports => {
                if (payload.eventType === 'INSERT') {
                    const newReport = { ...payload.new, type: reportType };
                    if (activeStatuses.includes(newReport.status)) {
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
                    const isNowActive = activeStatuses.includes(updatedReport.status);

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

        const channelId = `dashboard-reports-${profile.role === UserRole.ADMIN ? 'global' : profile.company_id}`;
        const reportsChannel = supabase.channel(channelId, {
            config: { broadcast: { self: true } },
        });

        if (profile.role === UserRole.ADMIN) {
            reportsChannel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, handleReportChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, handleReportChange);
        } else if (profile.company_id) {
            reportsChannel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports', filter: `company_id=eq.${profile.company_id}` }, handleReportChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports', filter: `company_id=eq.${profile.company_id}` }, handleReportChange);
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
        const tableName = isVehicleReport(reportToDelete) ? 'vehicle_reports' : 'crime_reports';
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
    
    const handleStatusUpdate = useCallback(async (reportId: string, newStatus: ReportStatus, reportType: 'vehicle' | 'crime') => {
        const tableName = reportType === 'vehicle' ? 'vehicle_reports' : 'crime_reports';
        const reportToUpdate = reports.find(r => r.id === reportId);
        if (!reportToUpdate) return;
    
        const isTerminalStatus = [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED, ReportStatus.REJECTED].includes(newStatus);
        
        const updatePayload: { status: ReportStatus; assigned_to?: string | null } = { status: newStatus };
    
        if (isTerminalStatus && reportToUpdate.assigned_to) {
            updatePayload.assigned_to = null;
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
    
            if ((activeVehicleAssignments === null || activeVehicleAssignments === 0) && (activeCrimeAssignments === null || activeCrimeAssignments === 0)) {
                const { error: profileUpdateError } = await supabase.from('profiles').update({ responder_status: ResponderStatus.AVAILABLE }).eq('id', responderId);
                if(profileUpdateError) console.warn("Report status updated, but failed to update responder status:", profileUpdateError.message);
            }
        }
    }, [reports, profile.id, addToast]);


    if (loading) return <div className="flex justify-center items-center h-full"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="container mx-auto flex flex-col">
            <div className="flex-shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Control Center</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Live operational overview of community safety.</p>
                    </div>
                    <button onClick={handleOpenNewReportModal} className="mt-4 md:mt-0 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2"><PlusIcon className="w-5 h-5" /><span>New Report</span></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <StatCard title="Total Reports" value={reports.length.toString()} icon={<ZapIcon />} color="blue" />
                    <StatCard title="Active Incidents" value={reports.filter(r => r.status === 'active' || r.status === 'in_progress').length.toString()} icon={<AlertTriangleIcon />} color="red" />
                    <StatCard title="Resolved Today" value={reports.filter(r => r.status === 'resolved' || r.status === 'recovered').length.toString()} icon={<CheckCircleIcon />} color="green" />
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
            <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} reportToEdit={reportToEdit} />
            <ArchiveReportModal isOpen={!!reportToDelete} onClose={() => setReportToDelete(null)} onConfirm={confirmDeleteReport} reportIdentifier={reportToDelete ? (isVehicleReport(reportToDelete) ? reportToDelete.license_plate : reportToDelete.title) : ''} />
            <MapModal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} report={selectedReport} />
        </div>
    );
};

export default Dashboard;
