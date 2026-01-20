import React, { useState, useMemo, useEffect } from 'react';
import { Report, Profile, Responder, ResponderStatus, UserRole } from '../types';
import LiveEventStack from '../components/LiveEventStack';
import ResponderStack from '../components/ResponderStack';
import MapView from '../components/MapView';
import { supabase } from '../utils/supabase';
import ControllerReportDetail from '../components/ControllerReportDetail';
import { ZapIcon, UsersIcon } from '../components/icons';

interface ControllerPageProps {
    profile: Profile;
}

type ControllerTab = 'events' | 'responders';

const ControllerPage: React.FC<ControllerPageProps> = ({ profile }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ControllerTab>('events');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            const [
                { data: vehicleData, error: vError },
                { data: crimeData, error: cError },
                { data: usersData, error: uError }
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*').order('reported_at', { ascending: false }).limit(100),
                supabase.from('crime_reports').select('*').order('reported_at', { ascending: false }).limit(100),
                supabase.from('profiles').select('*')
            ]);

            if (vError) console.error('Error fetching vehicle reports:', vError);
            if (cError) console.error('Error fetching crime reports:', cError);
            if (uError) console.error('Error fetching users:', uError);

            const combinedReports = [
                ...(vehicleData || []).map(r => ({ ...r, type: 'vehicle' })),
                ...(crimeData || []).map(r => ({ ...r, type: 'crime' })),
            ];

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
                    if (currentReports.some(r => r.id === newReport.id)) return currentReports;
                    return [newReport, ...currentReports];
                }
                if (payload.eventType === 'UPDATE') {
                    const updatedReport = { ...payload.new, type: reportType };
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

        const reportsChannel = supabase.channel('controller-page-reports')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, handleReportChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, handleReportChange)
            .subscribe();
            
        const profilesChannel = supabase.channel('controller-page-profiles')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleProfileChange)
            .subscribe();

        return () => {
            supabase.removeChannel(reportsChannel);
            supabase.removeChannel(profilesChannel);
        };
    }, []);

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

    useEffect(() => {
        const sortedReports = reports.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
        if (!selectedReportId && sortedReports.length > 0) {
            setSelectedReportId(sortedReports[0].id);
        }
        if (selectedReportId && !reports.some(r => r.id === selectedReportId)) {
            setSelectedReportId(sortedReports.length > 0 ? sortedReports[0].id : null);
        }
    }, [reports, selectedReportId]);

    const sortedReports = useMemo(() => {
        return reports.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
    }, [reports]);

    const selectedReport = useMemo(() => {
        return reports.find(r => r.id === selectedReportId);
    }, [reports, selectedReportId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const tabButtonClasses = (tabName: ControllerTab) => 
        `w-1/2 py-3 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
            activeTab === tabName 
            ? 'bg-blue-600 text-white' 
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'
        }`;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-3">
                 <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col backdrop-blur-lg max-h-[calc(100vh-8rem)]">
                    <div className="flex-shrink-0 mb-4 p-1 bg-gray-100 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex">
                            <button onClick={() => setActiveTab('events')} className={tabButtonClasses('events')}><ZapIcon className="w-5 h-5" /> Live Events</button>
                            <button onClick={() => setActiveTab('responders')} className={tabButtonClasses('responders')}><UsersIcon className="w-5 h-5" /> Responders</button>
                        </div>
                    </div>
                    
                    {activeTab === 'events' ? (
                        <LiveEventStack
                            reports={sortedReports}
                            responders={responders}
                            onReportSelect={(id) => setSelectedReportId(id)}
                            selectedReportId={selectedReportId}
                        />
                    ) : (
                        <ResponderStack
                            responders={responders}
                            reports={reports}
                        />
                    )}
                 </div>
            </div>

            <div className="lg:col-span-9">
                 <div className="lg:sticky lg:top-24">
                     <div className="grid grid-cols-1 lg:grid-cols-9 gap-4">
                        <div className="lg:col-span-6 min-h-[50vh] lg:h-[calc(100vh-8rem)]">
                            <MapView
                                reports={reports}
                                responders={responders}
                                selectedReportId={selectedReportId}
                            />
                        </div>
                        <div className="lg:col-span-3 min-h-[50vh] lg:h-[calc(100vh-8rem)]">
                            {selectedReport ? (
                                <ControllerReportDetail
                                    key={selectedReport.id}
                                    report={selectedReport}
                                    responders={responders}
                                    profile={profile}
                                />
                            ) : (
                                <div className="h-full bg-white/70 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg flex items-center justify-center">
                                    <p className="text-gray-500 dark:text-gray-400">No reports available or selected.</p>
                                </div>
                            )}
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default ControllerPage;