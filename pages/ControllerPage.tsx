
import React, { useState, useMemo, useEffect } from 'react';
import { Report, Profile, Responder, ResponderStatus, UserRole } from '../types';
import LiveEventStack from '../components/LiveEventStack';
import MapView from '../components/MapView';
import { supabase } from '../utils/supabase';
import ControllerReportDetail from '../components/ControllerReportDetail';

interface ControllerPageProps {
    profile: Profile;
}

const ControllerPage: React.FC<ControllerPageProps> = ({ profile }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [
                { data: vehicleData, error: vError },
                { data: crimeData, error: cError },
                { data: respondersData, error: rError }
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*').order('reported_at', { ascending: false }).limit(100),
                supabase.from('crime_reports').select('*').order('reported_at', { ascending: false }).limit(100),
                supabase.from('profiles').select('*').eq('role', 'responder')
            ]);

            if (vError) console.error('Error fetching vehicle reports:', vError);
            if (cError) console.error('Error fetching crime reports:', cError);
            if (rError) console.error('Error fetching responders:', rError);

            const combinedReports = [
                ...(vehicleData || []).map(r => ({ ...r, type: 'vehicle' })),
                ...(crimeData || []).map(r => ({ ...r, type: 'crime' })),
            ];

            const mappedResponders: Responder[] = (respondersData || []).map((profile: Profile) => ({
                id: profile.id,
                full_name: profile.full_name,
                status: profile.responder_status || ResponderStatus.OFF_DUTY,
                location_coords: profile.location_coords || undefined,
            }));

            setReports(combinedReports);
            setResponders(mappedResponders);
            setLoading(false);
        };

        fetchData();

        const handleUpsert = (payload: any) => {
            const newReport = { ...payload.new, type: payload.table === 'vehicle_reports' ? 'vehicle' : 'crime' };
            setReports(prev => {
                const existing = prev.find(r => r.id === newReport.id);
                if (existing) {
                    return prev.map(r => r.id === newReport.id ? newReport : r);
                }
                return [newReport, ...prev];
            });
        };

        const handleDelete = (payload: any) => {
            setReports(prev => prev.filter(r => r.id !== payload.old.id));
            if (selectedReportId === payload.old.id) {
                setSelectedReportId(null);
            }
        };
        
        const handleResponderUpdate = (payload: any) => {
            if (payload.eventType === 'DELETE') {
                setResponders(prev => prev.filter(r => r.id !== payload.old.id));
                return;
            }

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
        };


        const reportsChannels = supabase
            .channel('public:reports:controller')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vehicle_reports' }, handleUpsert)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crime_reports' }, handleUpsert)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicle_reports' }, handleUpsert)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crime_reports' }, handleUpsert)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'vehicle_reports' }, handleDelete)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'crime_reports' }, handleDelete)
            .subscribe();

        const respondersChannel = supabase
          .channel('public:profiles-controller')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `role=eq.${UserRole.RESPONDER}` }, handleResponderUpdate)
          .subscribe();

        return () => {
            supabase.removeChannel(reportsChannels);
            supabase.removeChannel(respondersChannel);
        };
    }, []);

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

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column (scrolls with page) */}
            <div className="lg:col-span-3">
                <LiveEventStack
                    reports={sortedReports}
                    responders={responders}
                    onReportSelect={(id) => setSelectedReportId(id)}
                    selectedReportId={selectedReportId}
                />
            </div>

            {/* Right container for Map and Details */}
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
