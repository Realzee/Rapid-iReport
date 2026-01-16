
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Report, Responder, ResponderStatus, Profile, UserRole } from '../types';
import MapView from '../components/MapView';

const MapPage: React.FC = () => {
    const [reports, setReports] = useState<Report[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [
                { data: vehicleData, error: vError },
                { data: crimeData, error: cError },
                { data: respondersData, error: rError }
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*'),
                supabase.from('crime_reports').select('*'),
                supabase.from('profiles').select('*').eq('role', 'responder')
            ]);

            if (vError) console.error('Error fetching vehicle reports:', vError);
            if (cError) console.error('Error fetching crime reports:', cError);
            if (rError) console.error('Error fetching responders:', rError);

            const combinedReports = [
                ...(vehicleData || []).map(r => ({...r, type: 'vehicle'})),
                ...(crimeData || []).map(r => ({...r, type: 'crime'})),
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

        const handleNewReport = (payload: any, type: 'vehicle' | 'crime') => {
             const newReport = { ...payload.new, type };
             setReports(prevReports => [newReport, ...prevReports]);
        };
        
        const handleReportUpdate = (payload: any) => {
            const updatedReport = { ...payload.new, type: payload.table === 'vehicle_reports' ? 'vehicle' : 'crime' };
            setReports(prev => prev.map(r => r.id === updatedReport.id ? updatedReport : r));
        };
        
        const handleReportDelete = (payload: any) => {
            setReports(prev => prev.filter(r => r.id !== payload.old.id));
        };

        const reportsChannels = supabase
          .channel('public:reports-map-page')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vehicle_reports' }, (payload) => handleNewReport(payload, 'vehicle'))
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crime_reports' }, (payload) => handleNewReport(payload, 'crime'))
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicle_reports' }, handleReportUpdate)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crime_reports' }, handleReportUpdate)
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'vehicle_reports' }, handleReportDelete)
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'crime_reports' }, handleReportDelete)
          .subscribe();
        
        const handleResponderUpdate = (payload: any) => {
            const updatedProfile = payload.new as Profile;
            setResponders(prev => {
                const existingResponder = prev.find(r => r.id === updatedProfile.id);
                const newResponderData: Responder = {
                    id: updatedProfile.id,
                    full_name: updatedProfile.full_name,
                    status: updatedProfile.responder_status || ResponderStatus.OFF_DUTY,
                    location_coords: updatedProfile.location_coords || undefined,
                };

                if (existingResponder) {
                    return prev.map(r => r.id === updatedProfile.id ? newResponderData : r);
                }
                return [...prev, newResponderData];
            });
        };

        const respondersChannel = supabase
          .channel('public:profiles-map-page')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `role=eq.${UserRole.RESPONDER}` }, handleResponderUpdate)
          .subscribe();


        return () => {
          supabase.removeChannel(reportsChannels);
          supabase.removeChannel(respondersChannel);
        };
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-8rem)]">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex-shrink-0 mb-6">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Live Incidents Map</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time operational map of all reported incidents and responders.</p>
            </div>
            <div className="flex-grow min-h-0">
                 <div className="h-full">
                    <MapView 
                        reports={reports} 
                        responders={responders}
                        selectedReportId={null}
                    />
                </div>
            </div>
        </div>
    );
};

export default MapPage;