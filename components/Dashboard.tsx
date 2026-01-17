
import React, { useState, useMemo, useEffect } from 'react';
import { Report, UserRole, Profile, Responder, ResponderStatus, VehicleReport } from '../types';
import StatCard from './StatCard';
import ReportList from './ReportList';
import MapView from './MapView';
import ReportModal from './NewReportModal';
import DeleteReportModal from './DeleteReportModal';
import ReportDetailCard from './ReportDetailCard';
import MapModal from './MapModal';
import { CheckCircleIcon, AlertTriangleIcon, ZapIcon, PlusIcon } from './icons';
import { supabase } from '../utils/supabase';

interface DashboardProps {
    profile: Profile;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const Dashboard: React.FC<DashboardProps> = ({ profile }) => {
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

        const refetchReports = async () => {
            const [{ data: vehicleData }, { data: crimeData }] = await Promise.all([
                supabase.from('vehicle_reports').select('*').order('reported_at', { ascending: false }).limit(100),
                supabase.from('crime_reports').select('*').order('reported_at', { ascending: false }).limit(100),
            ]);
            const combinedReports = [...(vehicleData || []).map(r => ({...r, type: 'vehicle'})), ...(crimeData || []).map(r => ({...r, type: 'crime'}))];
            setReports(combinedReports);
        };
        
        const handleResponderUpdate = (payload: any) => {
            const updatedProfile = payload.new as Profile;
            const newResponderData: Responder = {
                id: updatedProfile.id,
                full_name: updatedProfile.full_name,
                status: updatedProfile.responder_status || ResponderStatus.OFF_DUTY,
                location_coords: updatedProfile.location_coords || undefined,
            };

            setResponders(prev => {
                const index = prev.findIndex(r => r.id === updatedProfile.id);
                if (index > -1) {
                    const newResponders = [...prev];
                    newResponders[index] = newResponderData;
                    return newResponders;
                }
                return [...prev, newResponderData];
            });

            setAllUsers(prev => prev.map(u => u.id === updatedProfile.id ? updatedProfile : u));
        };

        const channel = supabase.channel('public:reports-and-responders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, refetchReports)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, refetchReports)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `role=eq.${UserRole.RESPONDER}` }, handleResponderUpdate)
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

export default Dashboard;
