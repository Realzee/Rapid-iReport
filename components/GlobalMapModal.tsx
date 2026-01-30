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
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !profile) {
            return;
        }

        setLoading(true);

        const fetchData = async () => {
            const usersQuery = supabase.from('profiles').select('*');
            if (profile.role !== UserRole.ADMIN && profile.company_id) {
                usersQuery.eq('company_id', profile.company_id);
            }

            const [
                { data: vehicleData, error: vError },
                { data: crimeData, error: cError },
                { data: usersData, error: uError }
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*'),
                supabase.from('crime_reports').select('*'),
                usersQuery
            ]);

            if (vError) console.error('Error fetching vehicle reports:', vError);
            if (cError) console.error('Error fetching crime reports:', cError);
            if (uError) console.error('Error fetching users:', uError);

            const combinedReports = [
                ...(vehicleData || []).map(r => ({...r, type: 'vehicle'})),
                ...(crimeData || []).map(r => ({...r, type: 'crime'})),
            ];
            
            setAllUsers(usersData || []);
            setReports(combinedReports);
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
        
        const handleProfileUpdate = (payload: any) => {
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

        const profilesChannel = supabase
          .channel('public:profiles-map-modal')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleProfileUpdate)
          .subscribe();


        return () => {
          supabase.removeChannel(reportsChannels);
          supabase.removeChannel(profilesChannel);
        };
    }, [isOpen, profile]);

    useEffect(() => {
        const mappedResponders: Responder[] = allUsers
            .filter(p => p.role === UserRole.RESPONDER)
            .map((p: Profile) => ({
                id: p.id,
                full_name: p.full_name,
                status: p.responder_status || ResponderStatus.OFF_DUTY,
                location_coords: p.location_coords || undefined,
            }));
        setResponders(mappedResponders);
    }, [allUsers]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" aria-labelledby="map-modal-title" role="dialog" aria-modal="true">
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl w-full h-full sm:rounded-2xl sm:w-11/12 sm:max-w-6xl sm:h-[90vh] flex flex-col">
                <header className="flex-shrink-0 p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                    <h3 id="map-modal-title" className="text-lg font-bold text-gray-900 dark:text-white truncate">
                        Global Incident Map
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>
                <div className="flex-grow relative min-h-0">
                    {loading ? (
                         <div className="absolute inset-0 flex justify-center items-center">
                            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="absolute inset-0">
                             <MapView reports={reports} responders={responders} selectedReportId={null} profile={profile ?? undefined} allUsers={allUsers} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default GlobalMapModal;