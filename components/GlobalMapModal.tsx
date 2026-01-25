import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Report, Responder, ResponderStatus, Profile, UserRole } from '../types';
import MapView from '../components/MapView';
import { XIcon } from './icons';

interface GlobalMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: Profile | null;
}

const GlobalMapModal: React.FC<GlobalMapModalProps> = ({ isOpen, onClose, profile }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !profile) {
            return;
        }

        setLoading(true);

        const fetchData = async () => {
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

            const mappedResponders: Responder[] = (respondersData || []).map((p: Profile) => ({
                id: p.id,
                full_name: p.full_name,
                status: p.responder_status || ResponderStatus.OFF_DUTY,
                location_coords: p.location_coords || undefined,
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
          .channel('public:reports-map-modal')
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
          .channel('public:profiles-map-modal')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `role=eq.${UserRole.RESPONDER}` }, handleResponderUpdate)
          .subscribe();


        return () => {
          supabase.removeChannel(reportsChannels);
          supabase.removeChannel(respondersChannel);
        };
    }, [isOpen, profile]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" aria-labelledby="map-modal-title" role="dialog" aria-modal="true">
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl w-full h-full sm:rounded-2xl sm:w-11/12 sm:max-w-6xl sm:h-auto sm:max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                    <h3 id="map-modal-title" className="text-lg font-bold text-gray-900 dark:text-white truncate">
                        Global Incident Map
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>
                <div className="flex-grow h-full w-full min-h-[70vh]">
                    {loading ? (
                         <div className="flex justify-center items-center h-full">
                            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                         <MapView reports={reports} responders={responders} selectedReportId={null} profile={profile ?? undefined} />
                    )}
                </div>
            </div>
        </div>
    );
};
export default GlobalMapModal;
