
import React, { useState, useMemo, useEffect } from 'react';
import { Report, ReportStatus, UserRole, Profile, Responder, ResponderStatus, VehicleReport } from '../types';
import StatCard from './StatCard';
import LiveEventStack from './LiveEventStack';
import MapView from './MapView';
import ReportModal from './ReportModal';
import DeleteReportModal from './DeleteReportModal';
import ReportDetailCard from './ReportDetailCard';
import MapModal from './MapModal';
import { CheckCircleIcon, AlertTriangleIcon, ZapIcon, PlusIcon, CarIcon, CrimeIcon } from './icons';
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
                    lat: -26.23 + (Math.random() - 0.5) * 0.1, 
                    lng: 27.85 + (Math.random() - 0.5) * 0.1,
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
    
    // Select the first report by default if none is selected
    useEffect(() => {
        if (!selectedReportId && reports.length > 0) {
            setSelectedReportId(reports[0].id);
        }
    }, [reports, selectedReportId]);

    const sortedReports = useMemo(() => {
        return reports.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
    }, [reports]);

    const selectedReport = useMemo(() => {
        return reports.find(r => r.id === selectedReportId);
    }, [reports, selectedReportId]);

    const handleReportSelect = (reportId: string) => {
        setSelectedReportId(reportId);
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

    const handleCloseDetailCard = () => {
        setSelectedReportId(null);
    };

    const confirmDeleteReport = async () => {
        if (!reportToDelete) return;
        
        const tableName = isVehicleReport(reportToDelete) ? 'vehicle_reports' : 'crime_reports';
        const { error } = await supabase.from(tableName).delete().eq('id', reportToDelete.id);

        if (error) {
            alert("Error deleting report: " + error.message);
        } else {
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
        <div className="container mx-auto flex flex-col h-[calc(100vh-8.5rem)]">
            <div className="flex-shrink-0">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <StatCard title="Active Reports" value={reports.filter(r => r.status === 'active' || r.status === 'in_progress').length.toString()} icon={<ZapIcon />} color="blue" />
                    <StatCard title="Vehicle Alerts" value={reports.filter(r => isVehicleReport(r)).length.toString()} icon={<CarIcon />} color="red" />
                    <StatCard title="Crime Reports" value={reports.filter(r => !isVehicleReport(r)).length.toString()} icon={<CrimeIcon />} color="yellow" />
                    <StatCard title="Active Dispatch" value={reports.filter(r => !!r.assigned_to).length.toString()} icon={<CheckCircleIcon />} color="green" />
                </div>
            </div>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
                {/* Left Column */}
                <div className="lg:col-span-3 flex flex-col min-h-0">
                    <LiveEventStack
                        reports={sortedReports}
                        onReportSelect={handleReportSelect}
                        selectedReportId={selectedReportId}
                    />
                </div>
                
                {/* Center Column */}
                <div className="lg:col-span-5 min-h-[40vh] lg:min-h-0">
                     <MapView 
                        reports={reports} 
                        responders={responders}
                        selectedReportId={selectedReportId}
                    />
                </div>

                {/* Right Column */}
                <div className="lg:col-span-4 min-h-0">
                     {selectedReport ? (
                        <ReportDetailCard 
                            key={selectedReport.id}
                            report={selectedReport}
                            onClose={handleCloseDetailCard}
                            profile={profile}
                            responders={responders}
                            onEdit={handleOpenEditReportModal}
                            onDelete={handleOpenDeleteReportModal}
                            onViewOnMap={() => setIsMapModalOpen(true)}
                        />
                    ) : (
                        <div className="h-full bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg flex items-center justify-center">
                            <p className="text-gray-500 dark:text-gray-400">Select a report to view details.</p>
                        </div>
                    )}
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
