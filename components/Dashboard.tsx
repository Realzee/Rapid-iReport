import React, { useState, useMemo, useEffect } from 'react';
import { Report, UserRole, Profile, Responder, ResponderStatus, VehicleReport, ReportStatus } from '../types';
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
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [reportToEdit, setReportToEdit] = useState<Report | null>(null);
    const [reportToArchive, setReportToArchive] = useState<Report | null>(null);
    const { addToast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [
                { data: vehicleData, error: vError }, 
                { data: crimeData, error: cError },
                { data: usersData, error: uError }
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*').neq('status', ReportStatus.DELETED).order('reported_at', { ascending: false }).limit(100),
                supabase.from('crime_reports').select('*').neq('status', ReportStatus.DELETED).order('reported_at', { ascending: false }).limit(100),
                supabase.from('profiles').select('*')
            ]);
            if (vError || cError || uError) console.error('Data fetch error:', vError || cError || uError);

            const combinedReports = [...(vehicleData || []).map(r => ({...r, type: 'vehicle'})), ...(crimeData || []).map(r => ({...r, type: 'crime'}))];
            
            setReports(combinedReports);
            setAllUsers(usersData || []);
            setLoading(false);
        };
        fetchData();

        const handleReportChange = (payload: any) => {
            const reportType = payload.table === 'vehicle_reports' ? 'vehicle' : 'crime';

            setReports(currentReports => {
                if (payload.eventType === 'INSERT') {
                    const newReport = { ...payload.new, type: reportType };
                    if (currentReports.some(r => r.id === newReport.id)) {
                        return currentReports;
                    }
                    return [newReport, ...currentReports];
                }
                
                if (payload.eventType === 'UPDATE') {
                    const updatedReport = { ...payload.new, type: reportType };
                    if (updatedReport.status === ReportStatus.DELETED) {
                        return currentReports.filter(r => r.id !== updatedReport.id);
                    }
                    return currentReports.map(r => r.id === updatedReport.id ? updatedReport : r);
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

        const reportsChannel = supabase.channel('public:reports-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, handleReportChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, handleReportChange)
            .subscribe();
            
        const profilesChannel = supabase.channel('public:profiles-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleProfileChange)
            .subscribe();

        return () => { 
            supabase.removeChannel(reportsChannel);
            supabase.removeChannel(profilesChannel);
        };
    }, []);

    const handleReportSelect = (reportId: string) => setSelectedReportId(prevId => prevId === reportId ? null : reportId);

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
            full_name: p.full_name,
            status: p.responder_status || ResponderStatus.OFF_DUTY,
            location_coords: p.location_coords || undefined,
        }));
        setResponders(mappedResponders);
    }, [allUsers]);

    const sortedReports = useMemo(() => reports.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()), [reports]);
    const selectedReport = useMemo(() => reports.find(r => r.id === selectedReportId), [reports, selectedReportId]);
    
    const handleOpenNewReportModal = () => { setReportToEdit(null); setIsReportModalOpen(true); };
    const handleOpenEditReportModal = (report: Report) => { setReportToEdit(report); setIsReportModalOpen(true); };
    const handleOpenArchiveReportModal = (report: Report) => setReportToArchive(report);
    const confirmArchiveReport = async () => {
        if (!reportToArchive) return;
        const tableName = isVehicleReport(reportToArchive) ? 'vehicle_reports' : 'crime_reports';
        const { error } = await supabase.from(tableName).update({ status: ReportStatus.DELETED }).eq('id', reportToArchive.id);
        
        if (error) {
            addToast(`Error archiving report: ${error.message}`, 'error');
        } else {
            addToast('Report successfully archived.', 'success');
            if (selectedReportId === reportToArchive.id) {
                setSelectedReportId(null);
            }
        }
        setReportToArchive(null);
    };
    
    const handleStatusUpdate = async (reportId: string, newStatus: ReportStatus, reportType: 'vehicle' | 'crime') => {
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
                <div className="lg:w-[400px] lg:flex-shrink-0">
                    {selectedReport ? (
                        <ReportDetailCard report={selectedReport} onClose={() => setSelectedReportId(null)} profile={profile} onEdit={handleOpenEditReportModal} onArchive={handleOpenArchiveReportModal} onViewOnMap={() => setIsMapModalOpen(true)} />
                    ) : (
                        <ReportList reports={sortedReports} onReportSelect={handleReportSelect} selectedReportId={selectedReportId} profile={profile} allUsers={allUsers} onStatusUpdate={handleStatusUpdate} />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="h-[60vh] lg:h-[calc(100vh-8.5rem)] lg:sticky lg:top-20">
                        <MapView reports={reports} responders={responders} selectedReportId={selectedReportId} profile={profile} />
                    </div>
                </div>
            </div>
            <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} reportToEdit={reportToEdit} />
            <ArchiveReportModal isOpen={!!reportToArchive} onClose={() => setReportToArchive(null)} onConfirm={confirmArchiveReport} reportIdentifier={reportToArchive ? (isVehicleReport(reportToArchive) ? reportToArchive.license_plate : reportToArchive.title) : ''} />
            <MapModal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} report={selectedReport} />
        </div>
    );
};

export default Dashboard;