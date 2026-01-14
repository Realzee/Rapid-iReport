
import React, { useState, useEffect, useMemo } from 'react';
import { Profile, Report, UserRole, ReportStatus, VehicleReport } from '../types';
import { supabase } from '../utils/supabase';
import { PlusIcon, ZapIcon } from '../components/icons';
import ReportModal from './ReportModal';
import MapView from './MapView';
import ReportListItem from './ReportListItem';
import DeleteReportModal from './DeleteReportModal';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const UserDashboard: React.FC<{ profile: Profile }> = ({ profile }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportToEdit, setReportToEdit] = useState<Report | null>(null);
    const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    // FIX: Changed the type of `allUsers` to match the partial data being fetched.
    const [allUsers, setAllUsers] = useState<Pick<Profile, 'id' | 'full_name'>[]>([]); // For reporter name

    const isUserRole = profile.role === UserRole.USER;
    const isResponderRole = profile.role === UserRole.RESPONDER;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const filterColumn = isUserRole ? 'reported_by' : 'assigned_to';

            let vehicleQuery = supabase.from('vehicle_reports').select('*').order('reported_at', { ascending: false });
            let crimeQuery = supabase.from('crime_reports').select('*').order('reported_at', { ascending: false });

            if (isUserRole || isResponderRole) {
                vehicleQuery = vehicleQuery.eq(filterColumn, profile.id);
                crimeQuery = crimeQuery.eq(filterColumn, profile.id);
            }
            
            const [
                { data: vehicleData, error: vError },
                { data: crimeData, error: cError },
                { data: usersData, error: uError }
            ] = await Promise.all([vehicleQuery, crimeQuery, supabase.from('profiles').select('id, full_name')]);

            if (vError) console.error(vError);
            if (cError) console.error(cError);
            if (uError) console.error(uError);

            const combinedReports = [
                ...(vehicleData || []).map(r => ({ ...r, type: 'vehicle' })),
                ...(crimeData || []).map(r => ({ ...r, type: 'crime' })),
            ];
            
            setReports(combinedReports);
            setAllUsers(usersData || []);
            setLoading(false);
        };
        fetchData();

        // Realtime subscriptions
        const handleUpsert = (payload: any) => {
            const newReport = { ...payload.new, type: payload.table === 'vehicle_reports' ? 'vehicle' : 'crime' };
            const filterColumn = isUserRole ? 'reported_by' : 'assigned_to';

            if (newReport[filterColumn] === profile.id) {
                setReports(prev => {
                    const existing = prev.find(r => r.id === newReport.id);
                    if (existing) {
                        return prev.map(r => r.id === newReport.id ? newReport : r);
                    }
                    return [newReport, ...prev];
                });
            } else {
                // If an update caused the report to no longer match the filter, remove it
                setReports(prev => prev.filter(r => r.id !== newReport.id));
            }
        };

        const handleDelete = (payload: any) => {
            setReports(prev => prev.filter(r => r.id !== payload.old.id));
        };

        const reportsChannels = supabase
            .channel(`public:reports:${profile.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, (payload) => {
                if(payload.eventType === 'DELETE') handleDelete(payload); else handleUpsert(payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, (payload) => {
                if(payload.eventType === 'DELETE') handleDelete(payload); else handleUpsert(payload);
            })
            .subscribe();

        return () => { supabase.removeChannel(reportsChannels); };
    }, [profile.id, isUserRole, isResponderRole]);

    const sortedReports = useMemo(() => {
        return reports.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
    }, [reports]);

    const handleOpenNewReportModal = () => {
        setReportToEdit(null);
        setIsReportModalOpen(true);
    };

    const handleStatusUpdate = async (reportId: string, newStatus: ReportStatus, reportType: 'vehicle' | 'crime') => {
        const tableName = reportType === 'vehicle' ? 'vehicle_reports' : 'crime_reports';
        const { error } = await supabase.from(tableName).update({ status: newStatus }).eq('id', reportId);
        if (error) alert('Error updating status: ' + error.message);
    };

    const userMap = useMemo(() => {
        return allUsers.reduce((acc, user) => {
            acc[user.id] = user.full_name;
            return acc;
        }, {} as Record<string, string>);
    }, [allUsers]);

    const title = isUserRole ? "My Reports" : "My Assignments";
    const subTitle = isUserRole ? "View and manage all incidents you have reported." : "View and manage all incidents assigned to you.";

    if (loading) {
        return <div className="flex justify-center items-center h-full"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    return (
        <div className="container mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3"><ZapIcon className="w-8 h-8"/> {title}</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{subTitle}</p>
                </div>
                <button 
                    onClick={handleOpenNewReportModal}
                    className="mt-4 md:mt-0 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>File New Report</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg h-[calc(100vh-14rem)] flex flex-col">
                    <h3 className="text-lg font-bold flex-shrink-0 mb-4">Incidents ({sortedReports.length})</h3>
                    <div className="flex-grow space-y-3 overflow-y-auto pr-1">
                        {sortedReports.length > 0 ? sortedReports.map(report => (
                            <ReportListItem 
                                key={report.id} 
                                report={report} 
                                isSelected={report.id === selectedReportId}
                                onClick={() => setSelectedReportId(report.id)}
                                profile={profile}
                                reporterName={userMap[report.reported_by] || 'Unknown'}
                                onStatusUpdate={handleStatusUpdate}
                            />
                        )) : (
                            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                                <p>{isUserRole ? "You haven't reported any incidents yet." : "You have no assigned incidents."}</p>
                            </div>
                        )}
                    </div>
                </div>
                 <div className="h-[calc(100vh-14rem)]">
                    <MapView reports={reports} responders={[]} selectedReportId={selectedReportId} />
                </div>
            </div>

            <ReportModal 
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                reportToEdit={reportToEdit}
            />
        </div>
    );
};

export default UserDashboard;
