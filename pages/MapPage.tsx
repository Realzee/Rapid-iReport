import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Report, Responder, ResponderStatus, Profile, UserRole } from '../types';
import MapView from '../components/MapView';

interface MapPageProps {
    profile: Profile | null;
}

const MapPage: React.FC<MapPageProps> = ({ profile }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile) {
            return;
        }

        const fetchData = async () => {
            setLoading(true);

            const respondersQuery = supabase.from('profiles').select('*').eq('role', 'responder');
            if (profile.role !== UserRole.ADMIN && profile.company_id) {
                respondersQuery.eq('company_id', profile.company_id);
            }

            const [
                { data: vehicleData, error: vError },
                { data: crimeData, error: cError },
                { data: respondersData, error: rError }
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*'),
                supabase.from('crime_reports').select('*'),
                respondersQuery
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

        const respondersChannel = supabase
          .channel('public:profiles-map-page')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `role=eq.${UserRole.RESPONDER}` }, handleResponderUpdate)
          .subscribe();


        return () => {
          supabase.removeChannel(reportsChannels);
          supabase.removeChannel(respondersChannel);
        };
    }, [profile]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-8.5rem)]">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }
    
    return (
        <div className="h-[calc(100vh-8.5rem)] w-full -my-8">
            <MapView reports={reports} responders={responders} selectedReportId={null} profile={profile ?? undefined} />
        </div>
    );
};

export default MapPage;