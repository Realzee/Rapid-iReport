
import React, { useState, useMemo, useEffect } from 'react';
// FIX: Import VehicleReport to be used in the type guard.
import { Report, ReportStatus, UserRole, Profile, Responder, ResponderStatus, VehicleReport } from '../types';
import StatCard from './StatCard';
import ReportList from './ReportList';
import MapView from './MapView';
import ReportModal from './ReportModal';
import DeleteReportModal from './DeleteReportModal';
import ReportDetailCard from './ReportDetailCard';
import MapModal from './MapModal';
import { CheckCircleIcon, AlertTriangleIcon, ZapIcon, PlusIcon } from './icons';
import { supabase } from '../utils/supabase';

interface DashboardProps {
    profile: Profile;
}

// FIX: Update isVehicleReport to be a type guard, enabling type narrowing.
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

    const isResponder = profile.role === UserRole.RESPONDER;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            let vehicleQuery = supabase.from('vehicle_reports').select('*').order('reported_at', { ascending: false }).limit(100);
            let crimeQuery = supabase.from('crime_reports').select('*').order('reported_at', { ascending: false }).limit(100);

            if (isResponder) {
                vehicleQuery = vehicleQuery.eq('assigned_to', profile.id);
                crimeQuery = crimeQuery.eq('assigned_to', profile.id);
            }
            
            const [
                { data: vehicleData, error: vError },
                { data: crimeData, error: cError },
                { data: respondersData, error: rError },
                { data: usersData, error: uError }
            ] = await Promise.all([
                vehicleQuery,
                crimeQuery,
                supabase.from('profiles').select('*').eq('role', UserRole.RESPONDER),
                supabase.from('profiles').select('*')
            ]);

            if (vError) console.error('Error fetching vehicle reports:', vError);
            if (cError) console.error('Error fetching crime reports:', cError);
            if (rError) console.error('Error fetching responders:', rError);
            if (uError) console.error('Error fetching users:', uError);

            const combinedReports = [
                ...(vehicleData || []).map(r => ({...r, type: 'vehicle'})),
                ...(crimeData || []).map(r => ({...r, type: 'crime'})),
            ];

            const mappedResponders: Responder[] = (respondersData || []).map((profile, index) => ({
                id: profile.id,
                full_name: profile.full_name,
                status: [ResponderStatus.AVAILABLE, ResponderStatus.ON_SCENE, ResponderStatus.OFF_DUTY][index % 3],
                location_coords: { 
                    lat: -1.286389 + (Math.random() - 0.5) * 0.1, 
                    lng: 36.817223 + (Math.random() - 0.5) * 0.1,
                },
            }));

            setReports(combinedReports);
            setResponders(mappedResponders);
            setAllUsers(usersData || []);
            setLoading(false);
        };
        
        fetchData();

        // --- REALTIME SUBSCRIPTIONS ---
        const handleNewReport = (payload: any, type: 'vehicle' | 'crime') => {
             const newReport = { ...payload.new, type };
             if(isResponder && newReport.assigned_to !== profile.id) {
                return;
             }
             setReports(prevReports => [newReport, ...prevReports]);
        };
        
        const handleReportUpdate = (payload: any) => {
            const updatedReport = { ...payload.new, type: payload.table === 'vehicle_reports' ? 'vehicle' : 'crime' };
            setReports(prev => {
                const reportExists = prev.some(r => r.id === updatedReport.id);
                if (isResponder) {
                    if (updatedReport.assigned_to !== profile.id) {
                        return prev.filter(r => r.id !== updatedReport.id);
                    }
                    if (!reportExists && updatedReport.assigned_to === profile.id) {
                        return [...prev, updatedReport];
                    }
                }
                return prev.map(r => r.id === updatedReport.id ? updatedReport : r);
            });
        };
        
        const handleReportDelete = (payload: any) => {
            setReports(prev => prev.filter(r => r.id !== payload.old.id));
            if (selectedReportId === payload.old.id) {
                setSelectedReportId(null);
            }
        };

        const reportsChannels = supabase
          .channel('public:reports')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vehicle_reports' }, (payload) => handleNewReport(payload, 'vehicle'))
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crime_reports' }, (payload) => handleNewReport(payload, 'crime'))
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicle_reports' }, handleReportUpdate)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crime_reports' }, handleReportUpdate)
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'vehicle_reports' }, handleReportDelete)
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'crime_reports' }, handleReportDelete)
          .subscribe();

        return () => {
          supabase.removeChannel(reportsChannels);
        };
    }, [isResponder, profile.id, selectedReportId]);

    const sortedReports = useMemo(() => {
        return reports.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
    }, [reports]);

    const selectedReport = useMemo(() => {
        return reports.find(r => r.id === selectedReportId);
    }, [reports, selectedReportId]);

    const handleReportSelect = (reportId: string) => {
        setSelectedReportId(prevId => prevId === reportId ? null : reportId);
    };

    const handleOpenNewReportModal = () => {
        setReportToEdit(null);
        setIsReportModalOpen(true);
    };

    const handleOpenEditReportModal = (report: Report) => {
        setReportToEdit(report);
        setIsReportModalOpen(true);
    };

    const handleOpenDeleteReportModal = (report: Report) => {
        setReportToDelete(report);
    };

    const handleStatusUpdate = async (reportId: string, newStatus: ReportStatus, reportType: 'vehicle' | 'crime') => {
        const tableName = reportType === 'vehicle' ? 'vehicle_reports' : 'crime_reports';
        const { error } = await supabase
            .from(tableName)
            .update({ status: newStatus })
            .eq('id', reportId);
        if (error) {
            alert(`Failed to update status: ${error.message}`);
        }
    };

    const confirmDeleteReport = async () => {
        if (!reportToDelete) return;
        
        const tableName = isVehicleReport(reportToDelete) ? 'vehicle_reports' : 'crime_reports';
        const { error } = await supabase.from(tableName).delete().eq('id', reportToDelete.id);

        if (error) {
            alert("Error deleting report: " + error.message);
        } else {
            // Optimistic UI update, though realtime should also catch it.
            setReports(prev => prev.filter(r => r.id !== reportToDelete.id));
            if (selectedReportId === reportToDelete.id) {
                setSelectedReportId(null);
            }
        }
        setReportToDelete(null);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto h-full flex flex-col">
            <div className="flex-shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{isResponder ? "Responder Dashboard" : "Control Center"}</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            {isResponder ? "Live view of your assigned incidents." : "Live operational overview of community safety."}
                        </p>
                    </div>
                     {!isResponder && (
                        <div className="flex items-center space-x-4 mt-4 md:mt-0">
                            <button 
                                onClick={handleOpenNewReportModal}
                                className="px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2"
                            >
                                <PlusIcon className="w-5 h-5" />
                                <span>New Report</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <StatCard title={isResponder ? "Assigned Reports" : "Total Reports"} value={reports.length.toString()} icon={<ZapIcon />} color="blue" />
                    <StatCard title="Active Incidents" value={reports.filter(r => r.status === 'active' || r.status === 'in_progress').length.toString()} icon={<AlertTriangleIcon />} color="red" />
                    <StatCard title="Resolved Today" value={reports.filter(r => r.status === 'resolved' || r.status === 'recovered').length.toString()} icon={<CheckCircleIcon />} color="green" />
                    <StatCard title="Available Responders" value={responders.filter(r => r.status === 'available').length.toString()} icon={<ZapIcon />} color="yellow" />
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
                <div className="lg:w-[400px] lg:flex-shrink-0 h-[50vh] lg:h-full">
                     {selectedReport ? (
                        <ReportDetailCard 
                            report={selectedReport}
                            onClose={() => setSelectedReportId(null)}
                            profile={profile}
                            onEdit={handleOpenEditReportModal}
                            onDelete={handleOpenDeleteReportModal}
                            onViewOnMap={() => setIsMapModalOpen(true)}
                        />
                    ) : (
                        <ReportList 
                            reports={sortedReports}
                            onReportSelect={handleReportSelect}
                            selectedReportId={selectedReportId}
                            profile={profile}
                            allUsers={allUsers}
                            onStatusUpdate={handleStatusUpdate}
                        />
                    )}
                </div>
                <div className="flex-1 min-w-0 h-[60vh] lg:h-full">
                    <MapView 
                        reports={reports} 
                        responders={responders}
                        selectedReportId={selectedReportId}
                    />
                </div>
            </div>

            <ReportModal 
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                reportToEdit={reportToEdit}
            />
            
            <DeleteReportModal
                isOpen={!!reportToDelete}
                onClose={() => setReportToDelete(null)}
                onConfirm={confirmDeleteReport}
                reportIdentifier={reportToDelete ? (isVehicleReport(reportToDelete) ? reportToDelete.license_plate : reportToDelete.title) : ''}
            />

            <MapModal
                isOpen={isMapModalOpen}
                onClose={() => setIsMapModalOpen(false)}
                report={selectedReport}
            />
        </div>
    );
};

export default Dashboard;