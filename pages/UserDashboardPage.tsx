
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { Profile, Report, VehicleReport, EmergencyReport, ReportStatus } from '../types';
import { PlusIcon, ZapIcon, CarIcon, CrimeIcon, AlertTriangleIcon, GlobeIcon, UsersIcon } from '../components/icons';
import ReportModal from '../components/ReportModal';
import UserReportDetail from '../components/UserReportDetail';
import StatusBadge from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;
const isEmergencyReport = (report: Report): report is EmergencyReport => 'emergency_type' in report;

const UserDashboardPage: React.FC<{ profile: Profile }> = ({ profile }) => {
    const [myReports, setMyReports] = useState<Report[]>([]);
    const [companyUsers, setCompanyUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportToEdit, setReportToEdit] = useState<Report | null>(null);

    const fetchMyData = async () => {
        setLoading(true);

        // RLS now handles company-level filtering, so we can fetch all reports the user has access to.
        const reportPromises = [
            supabase.from('vehicle_reports').select('*').neq('status', ReportStatus.DELETED),
            supabase.from('crime_reports').select('*').neq('status', ReportStatus.DELETED),
            supabase.from('emergency_reports').select('*').neq('status', ReportStatus.DELETED)
        ];

        const usersPromise = profile.company_id 
            ? supabase.from('profiles').select('*').eq('company_id', profile.company_id)
            : Promise.resolve({ data: [profile], error: null });
        
        const [
            { data: vData, error: vError }, 
            { data: cData, error: cError },
            { data: aData, error: aError },
            { data: usersData, error: uError }
        ] = await Promise.all([...reportPromises, usersPromise]);
        
        if (vError || cError || aError) {
            console.error("Error fetching user reports:", vError || cError || aError);
        } else {
            const combined = [
                ...(vData || []).map(r => ({ ...r, type: 'vehicle' as const })),
                ...(cData || []).map(r => ({ ...r, type: 'crime' as const })),
                ...(aData || []).map(r => ({ ...r, type: 'emergency' as const }))
            ].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
            setMyReports(combined);
            if (combined.length > 0 && !selectedReportId) {
                setSelectedReportId(combined[0].id);
            }
        }

        if (uError) {
             console.error("Error fetching company users:", uError);
        } else {
             setCompanyUsers(usersData as Profile[] || [profile]);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchMyData();
    }, [profile.id, profile.company_id, selectedReportId]);

    useEffect(() => {
        const handleUpsert = (payload: any) => {
            const reportType = payload.table === 'vehicle_reports' ? 'vehicle' : (payload.table === 'emergency_reports' ? 'emergency' : 'crime');
            const newReport = { ...payload.new, type: reportType } as Report;

            setMyReports(prev => {
                if (newReport.status === ReportStatus.DELETED) {
                    return prev.filter(r => r.id !== newReport.id);
                }

                const exists = prev.some(r => r.id === newReport.id);
                const updatedReports = exists 
                    ? prev.map(r => r.id === newReport.id ? newReport : r) 
                    : [newReport, ...prev];
                
                const sorted = updatedReports.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());

                if (!selectedReportId && sorted.length > 0) {
                    setSelectedReportId(sorted[0].id);
                }
                
                return sorted;
            });
        };
        
        if (!profile.company_id) return;

        const channel = supabase.channel(`company-reports-${profile.company_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, handleUpsert)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [profile.id, profile.company_id, selectedReportId]);
    
    const selectedReport = useMemo(() => myReports.find(r => r.id === selectedReportId), [myReports, selectedReportId]);

    const handleOpenNewReport = () => {
        setReportToEdit(null);
        setIsReportModalOpen(true);
    };
    
    const handleOpenEditReport = (report: Report) => {
        setReportToEdit(report);
        setIsReportModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsReportModalOpen(false);
        setReportToEdit(null);
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    return (
        <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Community Reports</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">View and track incidents reported by your community.</p>
                </div>
                <button onClick={handleOpenNewReport} className="mt-4 md:mt-0 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2"><PlusIcon className="w-5 h-5" /><span>File a New Report</span></button>
            </div>

            {myReports.length === 0 ? (
                <div className="text-center py-20 bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl">
                     <ZapIcon className="w-16 h-16 mx-auto text-gray-400"/>
                     <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">No Reports Found</h3>
                     <p className="mt-2 text-gray-500 dark:text-gray-400">There are no active reports in your community network yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="lg:col-span-1 space-y-3 lg:h-[calc(100vh-12rem)] lg:overflow-y-auto pr-2">
                        {myReports.map(report => (
                            <div key={report.id} onClick={() => setSelectedReportId(report.id)} 
                                className={`p-3 cursor-pointer rounded-lg border-2 transition-all ${selectedReportId === report.id ? 'bg-blue-500/10 border-blue-500' : 'bg-white/70 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2 truncate pr-2">
                                        <div className={`p-1.5 rounded-full flex-shrink-0 ${report.type === 'vehicle' ? 'bg-yellow-500/20 text-yellow-600' : (report.type === 'emergency' ? 'bg-orange-500/20 text-orange-600' : 'bg-red-500/20 text-red-600')}`}>
                                            {report.type === 'vehicle' ? <CarIcon className="w-4 h-4" /> : (report.type === 'emergency' ? <AlertTriangleIcon className="w-4 h-4" /> : <CrimeIcon className="w-4 h-4" />)}
                                        </div>
                                        <h3 className="font-bold text-md truncate">{isVehicleReport(report) ? report.license_plate : report.title}</h3>
                                        {report.is_global && (
                                            <GlobeIcon className="w-4 h-4 text-blue-500 flex-shrink-0" title="Global Report" />
                                        )}
                                        {!report.is_global && report.shared_with_company_ids && report.shared_with_company_ids.length > 0 && (
                                            <UsersIcon className="w-4 h-4 text-blue-500 flex-shrink-0" title="Shared with specific companies" />
                                        )}
                                    </div>
                                    <StatusBadge status={report.status} />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{isVehicleReport(report) ? `${report.vehicle_make} ${report.vehicle_model}` : (isEmergencyReport(report) ? report.emergency_type : report.crime_type)}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">{formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}</p>
                            </div>
                        ))}
                    </div>

                    <div className="lg:col-span-2 lg:sticky lg:top-24">
                        {selectedReport ? <UserReportDetail key={selectedReport.id} report={selectedReport} profile={profile} onEdit={handleOpenEditReport} allUsers={companyUsers} onRefresh={fetchMyData} /> : 
                        <div className="h-full bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg flex items-center justify-center min-h-[50vh]">
                            <p className="text-gray-500 dark:text-gray-400">Select a report to view details.</p>
                        </div>}
                    </div>
                </div>
            )}
            <ReportModal 
                isOpen={isReportModalOpen} 
                onClose={handleCloseModal} 
                reportToEdit={reportToEdit} 
                onReportSubmitted={fetchMyData}
            />
        </>
    );
};
export default UserDashboardPage;
