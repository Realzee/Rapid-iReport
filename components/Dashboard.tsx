import React, { useState, useMemo, useEffect } from 'react';
import { Report, ReportStatus, UserRole, Profile, Responder, ResponderStatus } from '../types';
import StatCard from './StatCard';
import ReportList from './ReportList';
import MapView from './MapView';
import NewReportModal from './NewReportModal';
import ReportDetailCard from './ReportDetailCard';
import { CheckCircleIcon, AlertTriangleIcon, ZapIcon, PlusIcon } from './icons';
import { supabase } from '../utils/supabase';

interface DashboardProps {
    profile: Profile;
}

const Dashboard: React.FC<DashboardProps> = ({ profile }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isNewReportModalOpen, setIsNewReportModalOpen] = useState(false);
    
    const isResponder = profile.role === UserRole.RESPONDER;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            let vehicleQuery = supabase.from('vehicle_reports').select('*');
            let crimeQuery = supabase.from('crime_reports').select('*');

            // If the user is a responder, only fetch reports assigned to them.
            if (isResponder) {
                vehicleQuery = vehicleQuery.eq('assigned_to', profile.id);
                crimeQuery = crimeQuery.eq('assigned_to', profile.id);
            }
            
            const { data: vehicleData, error: vError } = await vehicleQuery;
            const { data: crimeData, error: cError } = await crimeQuery;
            
            const { data: respondersData, error: rError } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', UserRole.RESPONDER);

            if (vError) console.error('Error fetching vehicle reports:', vError);
            if (cError) console.error('Error fetching crime reports:', cError);
            if (rError) console.error('Error fetching responders:', rError);

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
            setLoading(false);
        };
        
        fetchData();

        // --- REALTIME SUBSCRIPTIONS ---
        const handleNewReport = (payload: any, type: 'vehicle' | 'crime') => {
             const newReport = { ...payload.new, type };
             // If responder, only add the new report if it's assigned to them.
             if(isResponder && newReport.assigned_to !== profile.id) {
                return;
             }
             setReports(prevReports => [newReport, ...prevReports]);
        };
        
        const handleReportUpdate = (payload: any) => {
            const updatedReport = payload.new;
            // If responder, check if they are still assigned.
            if(isResponder && updatedReport.assigned_to !== profile.id) {
                // If they are no longer assigned, remove the report from their list.
                setReports(prev => prev.filter(r => r.id !== updatedReport.id));
            } else {
                 setReports(prev => prev.map(r => r.id === updatedReport.id ? {...r, ...updatedReport} : r));
            }
        };

        const reportsChannels = supabase
          .channel('public:reports')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'vehicle_reports' },
            (payload) => handleNewReport(payload, 'vehicle')
          )
           .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'crime_reports' },
            (payload) => handleNewReport(payload, 'crime')
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'vehicle_reports' },
            handleReportUpdate
          )
           .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'crime_reports' },
            handleReportUpdate
          )
          .subscribe();


        // Cleanup function to remove subscriptions on component unmount
        return () => {
          supabase.removeChannel(reportsChannels);
        };
    }, [isResponder, profile.id]);

    const sortedReports = useMemo(() => {
        return reports.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
    }, [reports]);

    const selectedReport = useMemo(() => {
        return reports.find(r => r.id === selectedReportId);
    }, [reports, selectedReportId]);

    const handleReportSelect = (reportId: string) => {
        setSelectedReportId(prevId => prevId === reportId ? null : reportId);
    };

    const handleReportCreated = (newReport: Report) => {
        setReports(prevReports => [newReport, ...prevReports]);
        setIsNewReportModalOpen(false);
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white">{isResponder ? "Responder Dashboard" : "Control Center"}</h2>
                    <p className="text-gray-400 mt-1">
                        {isResponder ? "Live view of your assigned incidents." : "Live operational overview of community safety."}
                    </p>
                </div>
                 {!isResponder && (
                    <div className="flex items-center space-x-4 mt-4 md:mt-0">
                        <button 
                            onClick={() => setIsNewReportModalOpen(true)}
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

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:w-[400px] lg:h-[70vh] flex flex-col">
                     {selectedReport ? (
                        <ReportDetailCard 
                            report={selectedReport}
                            onClose={() => setSelectedReportId(null)}
                        />
                    ) : (
                        <ReportList 
                            reports={sortedReports}
                            onReportSelect={handleReportSelect}
                            selectedReportId={selectedReportId}
                        />
                    )}
                </div>
                <div className="flex-1 lg:h-[70vh]">
                    <MapView 
                        reports={reports} 
                        responders={responders}
                        selectedReportId={selectedReportId}
                    />
                </div>
            </div>

            <NewReportModal 
                isOpen={isNewReportModalOpen}
                onClose={() => setIsNewReportModalOpen(false)}
                onReportCreated={handleReportCreated}
            />
        </div>
    );
};

export default Dashboard;