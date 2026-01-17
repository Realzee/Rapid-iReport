
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
        const fetchData = async (isInitialLoad = false) => {
            if (isInitialLoad) setLoading(true);

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

            if (isInitialLoad) setLoading(false);
        };

        // Initial fetch
        fetchData(true);

        // This single subscription channel handles all updates by re-fetching data.
        // This is a more robust approach than trying to manage incremental state updates.
        const channel = supabase
            .channel('controller-page-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `role=eq.${UserRole.RESPONDER}` }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        // Auto-select the first report if none is selected
        if (!selectedReportId && reports.length > 0) {
            setSelectedReportId(reports[0].id);
        }
         // If the selected report is deleted, clear the selection
        if (selectedReportId && !reports.some(r => r.id === selectedReportId)) {
            setSelectedReportId(reports.length > 0 ? reports[0].id : null);
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
