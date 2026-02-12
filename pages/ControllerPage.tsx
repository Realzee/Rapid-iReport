import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Report, Profile, Responder, ResponderStatus, UserRole, Severity, ReportStatus } from '../types';
import LiveEventStack from '../components/LiveEventStack';
import ResponderStack from '../components/ResponderStack';
import MapView from '../components/MapView';
import { supabase } from '../utils/supabase';
import ControllerReportDetail from '../components/ControllerReportDetail';
import { ZapIcon, UsersIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import ReportModal from '../components/ReportModal';
import SoughtListManager from '../components/BlacklistManager';

interface ControllerPageProps {
    profile: Profile;
    initialReportId?: string | null;
    onInitialReportHandled?: () => void;
}

type ControllerTab = 'events' | 'responders';

const ControllerPage: React.FC<ControllerPageProps> = ({ profile, initialReportId, onInitialReportHandled }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ControllerTab>('events');
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
    const [reportToEdit, setReportToEdit] = useState<Report | null>(null);
    const [isDetailsVisible, setIsDetailsVisible] = useState(true);

    const isInitialLoad = useRef(true);
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        // Initialize AudioContext on mount. Browsers may require a user gesture to start it.
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }, []);

    const playAlertSound = () => {
        const context = audioContextRef.current;
        if (!context) return;
        
        // Resume context if it was suspended by browser policy
        if (context.state === 'suspended') {
            context.resume();
        }

        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, context.currentTime); // A sharp A5 note
        gainNode.gain.setValueAtTime(0.5, context.currentTime);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.2); // Play for 200ms
    };

    useEffect(() => {
        const activeStatuses = [
            ReportStatus.PENDING,
            ReportStatus.ACTIVE,
            ReportStatus.ASSIGNED,
            ReportStatus.IN_PROGRESS,
            ReportStatus.ON_SCENE,
        ];

        const fetchData = async () => {
            setLoading(true);

            const usersQuery = supabase.from('profiles').select('*');
            if (profile.role !== UserRole.ADMIN && profile.company_id) {
                usersQuery.eq('company_id', profile.company_id);
            }

            const [
                { data: vehicleData, error: vError },
                { data: crimeData, error: cError },
                { data: usersData, error: uError }
            ] = await Promise.all([
                supabase.from('vehicle_reports').select('*').in('status', activeStatuses).order('reported_at', { ascending: false }).limit(100),
                supabase.from('crime_reports').select('*').in('status', activeStatuses).order('reported_at', { ascending: false }).limit(100),
                usersQuery
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
            isInitialLoad.current = false;
        };

        fetchData();

        const handleReportChange = (payload: any) => {
            const reportType = payload.table === 'vehicle_reports' ? 'vehicle' : 'crime';
            const newReport = payload.new as Report;

            if (payload.eventType === 'INSERT' && !isInitialLoad.current) {
                if (newReport.severity === Severity.CRITICAL || newReport.severity === Severity.HIGH) {
                    playAlertSound();
                }
            }

            setReports(currentReports => {
                if (payload.eventType === 'INSERT') {
                    const newReportWithMeta = { ...newReport, type: reportType };
                    if (activeStatuses.includes(newReportWithMeta.status)) {
                        if (currentReports.some(r => r.id === newReportWithMeta.id)) return currentReports;
                        return [newReportWithMeta, ...currentReports];
                    }
                    return currentReports;
                }
                if (payload.eventType === 'UPDATE') {
                    const updatedReport = { ...newReport, type: reportType };
                    const wasInList = currentReports.some(r => r.id === updatedReport.id);
                    const isNowActive = activeStatuses.includes(updatedReport.status);

                    if (isNowActive) {
                        if (wasInList) {
                            return currentReports.map(r => r.id === updatedReport.id ? updatedReport : r);
                        } else {
                            return [updatedReport, ...currentReports];
                        }
                    } else {
                        if (wasInList) {
                            return currentReports.filter(r => r.id !== updatedReport.id);
                        }
                        return currentReports;
                    }
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
    }, [profile]);

    useEffect(() => {
        const responderProfiles = allUsers.filter(p => p.role === UserRole.RESPONDER);
        const mappedResponders: Responder[] = responderProfiles.map(p => ({
            id: p.id,
            // FIX: Property 'full_name' does not exist on type 'Profile'.
            first_name: p.first_name,
            surname: p.surname,
            status: p.responder_status || ResponderStatus.OFF_DUTY,
            location_coords: p.location_coords || undefined,
        }));
        setResponders(mappedResponders);
    }, [allUsers]);
    
    const sortedReports = useMemo(() => {
        // FIX: Use spread operator `[...]` to create a new array for sorting, preventing state mutation.
        return [...reports].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
    }, [reports]);

    useEffect(() => {
        if (initialReportId && onInitialReportHandled && reports.some(r => r.id === initialReportId)) {
            setSelectedReportId(initialReportId);
            onInitialReportHandled();
        }
    }, [initialReportId, onInitialReportHandled, reports]);
    
    // FIX: This effect now safely manages the selected report without mutating state, preventing an infinite loop.
    useEffect(() => {
        if (loading) return; // Don't run on initial load

        // If no report is selected, but there are reports available, select the latest one.
        if (!selectedReportId && sortedReports.length > 0) {
            setSelectedReportId(sortedReports[0].id);
        }
        
        // If a report is currently selected, but it has been removed from the list (e.g., resolved/deleted),
        // then select the new latest report, or null if the list is empty.
        if (selectedReportId && !sortedReports.some(r => r.id === selectedReportId)) {
            setSelectedReportId(sortedReports.length > 0 ? sortedReports[0].id : null);
        }
    }, [sortedReports, selectedReportId, loading]);

    const handleOpenNewReportModal = () => {
        setReportToEdit(null);
        setIsReportModalOpen(true);
    };
    
    const handleOpenQuickAddModal = () => {
        setIsQuickAddModalOpen(true);
    };

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
        <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Live Controller</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time incident management and dispatch.</p>
                </div>
                <button
                    onClick={handleOpenNewReportModal}
                    className="mt-4 md:mt-0 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>New Report</span>
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-3 print:hidden">
                    <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col backdrop-blur-lg">
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

                <div className="lg:col-span-9 flex flex-col gap-4">
                    <div className="grid grid-cols-1 lg:grid-cols-9 gap-4">
                        <div className={`
                            lg:sticky lg:top-24 h-[60vh] lg:h-[calc(100vh-12rem)] print:hidden relative transition-all duration-300
                            ${isDetailsVisible ? 'lg:col-span-5' : 'lg:col-span-9'}
                        `}>
                            <MapView
                                reports={reports}
                                responders={responders}
                                selectedReportId={selectedReportId}
                                profile={profile}
                                onReportSelect={(id) => setSelectedReportId(id)}
                                allUsers={allUsers}
                            />
                            <button
                                onClick={() => setIsDetailsVisible(!isDetailsVisible)}
                                className="absolute top-1/2 -right-4 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 p-1.5 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all hidden lg:flex"
                                title={isDetailsVisible ? 'Hide Details' : 'Show Details'}
                            >
                                {isDetailsVisible ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
                            </button>
                        </div>
                        {isDetailsVisible && (
                             <div className="lg:col-span-4 space-y-4">
                                {selectedReport ? (
                                    <ControllerReportDetail
                                        key={selectedReport.id}
                                        report={selectedReport}
                                        responders={responders}
                                        profile={profile}
                                        allUsers={allUsers}
                                    />
                                ) : (
                                    <div className="h-full bg-white/70 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg flex items-center justify-center print:hidden min-h-[40vh]">
                                        <p className="text-gray-500 dark:text-gray-400">Select an incident to view details.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                     <SoughtListManager 
                        onSelectReport={setSelectedReportId}
                        onQuickAdd={handleOpenQuickAddModal}
                    />
                </div>
            </div>
            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                reportToEdit={reportToEdit}
            />
             <ReportModal
                isOpen={isQuickAddModalOpen}
                onClose={() => setIsQuickAddModalOpen(false)}
                reportToEdit={null}
                isQuickAdd={true}
            />
        </>
    );
};

export default ControllerPage;
