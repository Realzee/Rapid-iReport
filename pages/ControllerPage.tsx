
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Report, Profile, Responder, ResponderStatus, UserRole, Severity, ReportStatus, CrimeReport } from '../types';
import LiveEventStack from '../components/LiveEventStack';
import ResponderStack from '../components/ResponderStack';
import MapView from '../components/MapView';
import { supabase } from '../utils/supabase';
import ControllerReportDetail from '../components/ControllerReportDetail';
import { ZapIcon, UsersIcon, PlusIcon, ChevronLeftIcon, ChevronRightIcon, MapIcon, ChatAlt2Icon } from '../components/icons';
import ReportModal from '../components/ReportModal';
import SoughtListManager from '../components/BlacklistManager';
import { useChat } from '../contexts/ChatContext';
import { useToast } from '../contexts/ToastContext';
import { CONTROLLER_CHANNEL_REPORT } from '../constants';
import { useWakeLock } from '../hooks/useWakeLock';

interface ControllerPageProps {
    profile: Profile;
    initialReportId?: string | null;
    onInitialReportHandled?: () => void;
}

type ControllerTab = 'events' | 'responders';

const ControllerPage: React.FC<ControllerPageProps> = ({ profile, initialReportId, onInitialReportHandled }) => {
    const { requestWakeLock, releaseWakeLock } = useWakeLock();
    const [reports, setReports] = useState<Report[]>([]);
    const [allUsers, setAllUsers] = useState<Profile[]>([]);

    useEffect(() => {
        requestWakeLock();
        return () => {
            releaseWakeLock();
        };
    }, [requestWakeLock, releaseWakeLock]);
    const [responders, setResponders] = useState<Responder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ControllerTab>('events');
    const [isReportModalOpen, setIsReportModalOpen] = useState(() => {
        return localStorage.getItem('controller_report_modal_open') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('controller_report_modal_open', String(isReportModalOpen));
    }, [isReportModalOpen]);

    const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
    const [reportToEdit, setReportToEdit] = useState<Report | null>(null);
    const [isDetailsVisible, setIsDetailsVisible] = useState(true);
    const { openChat } = useChat();
    const { addToast } = useToast();
    const [newPanicReportId, setNewPanicReportId] = useState<string | null>(null);

    const isInitialLoad = useRef(true);
    const audioContextRef = useRef<AudioContext | null>(null);
    const alertLoopRef = useRef<number | null>(null);

    useEffect(() => {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }, []);

    const playAlertSound = () => {
        const context = audioContextRef.current;
        if (!context) return;
        if (context.state === 'suspended') {
            context.resume();
        }

        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, context.currentTime);
        gainNode.gain.setValueAtTime(0.5, context.currentTime);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.2);
    };

    const startAlertLoop = () => {
        if (alertLoopRef.current) return;
        playAlertSound();
        alertLoopRef.current = window.setInterval(playAlertSound, 1000);
    };

    const stopAlertLoop = () => {
        if (alertLoopRef.current) {
            clearInterval(alertLoopRef.current);
            alertLoopRef.current = null;
        }
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
                const crimeReport = newReport as CrimeReport;
                if (crimeReport.crime_type === 'PUBLIC_PANIC_ASSIST') {
                    setNewPanicReportId(crimeReport.id);
                    startAlertLoop();
                } else if (newReport.severity === Severity.CRITICAL || newReport.severity === Severity.HIGH) {
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

        const channelId = `controller-page-reports-${profile.role === UserRole.ADMIN ? 'global' : profile.company_id}`;
        const reportsChannel = supabase.channel(channelId, {
            config: { broadcast: { self: true } },
        });

        if (profile.role === UserRole.ADMIN) {
            reportsChannel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, handleReportChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, handleReportChange);
        } else if (profile.company_id) {
            reportsChannel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports', filter: `company_id=eq.${profile.company_id}` }, handleReportChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports', filter: `company_id=eq.${profile.company_id}` }, handleReportChange);
        }
        reportsChannel.subscribe();
            
        const profilesChannel = supabase.channel('controller-page-profiles', {
            config: { broadcast: { self: true } },
        })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleProfileChange)
            .subscribe();

        return () => {
            supabase.removeChannel(reportsChannel);
            supabase.removeChannel(profilesChannel);
            stopAlertLoop();
        };
    }, [profile]);

    useEffect(() => {
        const responderProfiles = allUsers.filter(p => p.role === UserRole.RESPONDER);
        const mappedResponders: Responder[] = responderProfiles.map(p => ({
            id: p.id,
            first_name: p.first_name,
            surname: p.surname,
            status: p.responder_status || ResponderStatus.OFF_DUTY,
            location_coords: p.location_coords || undefined,
        }));
        setResponders(mappedResponders);
    }, [allUsers]);
    
    const sortedReports = useMemo(() => {
        return [...reports].sort((a, b) => {
            const aIsPanic = (a as CrimeReport).crime_type === 'PUBLIC_PANIC_ASSIST';
            const bIsPanic = (b as CrimeReport).crime_type === 'PUBLIC_PANIC_ASSIST';
            if (aIsPanic && !bIsPanic) return -1;
            if (!aIsPanic && bIsPanic) return 1;
            return new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime();
        });
    }, [reports]);

    useEffect(() => {
        if (initialReportId && onInitialReportHandled && reports.some(r => r.id === initialReportId)) {
            setSelectedReportId(initialReportId);
            onInitialReportHandled();
        }
    }, [initialReportId, onInitialReportHandled, reports]);
    
    useEffect(() => {
        if (loading) return;
        if (selectedReportId && !sortedReports.some(r => r.id === selectedReportId)) {
            setSelectedReportId(sortedReports.length > 0 ? sortedReports[0].id : null);
        }
    }, [sortedReports, selectedReportId, loading]);

    const handleReportSelect = (id: string) => {
        setSelectedReportId(prevId => prevId === id ? null : id);
        if (id === newPanicReportId) {
            setNewPanicReportId(null);
            stopAlertLoop();
        }
    };

    const handleOpenNewReportModal = () => {
        setReportToEdit(null);
        setIsReportModalOpen(true);
    };
    
    const handleOpenQuickAddModal = () => {
        setIsQuickAddModalOpen(true);
    };

    const handleEditReport = (report: Report) => {
        setReportToEdit(report);
        setIsReportModalOpen(true);
    };

    const selectedReport = useMemo(() => {
        return reports.find(r => r.id === selectedReportId);
    }, [reports, selectedReportId]);

    const handleAssignResponder = async (responderId: string) => {
        if (!selectedReportId || !selectedReport) return;

        const tableName = selectedReport.type === 'vehicle' ? 'vehicle_reports' : 'crime_reports';
        const responder = responders.find(r => r.id === responderId);
        
        if (!responder) return;

        const { error } = await supabase
            .from(tableName)
            .update({ 
                assigned_to: responderId,
                status: ReportStatus.ASSIGNED
            })
            .eq('id', selectedReportId);

        if (error) {
            addToast('Failed to assign responder: ' + error.message, 'error');
        } else {
            addToast(`Assigned ${responder.first_name} ${responder.surname} to incident ${selectedReport.ob_number}`, 'success');
            // Log the assignment
            await supabase.from('report_updates').insert({
                report_id: selectedReportId,
                user_id: profile.id,
                content: `Assigned responder: ${responder.first_name} ${responder.surname}`
            });

            // Create notification for responder
            await supabase.from('notifications').insert({
                recipient_user_id: responderId,
                type: 'new_report',
                title: 'New Incident Assigned',
                message: `You have been assigned to incident ${selectedReport.ob_number}: ${selectedReport.type === 'vehicle' ? (selectedReport as any).license_plate : (selectedReport as any).title}`,
                reference_id: selectedReportId
            });
        }
    };

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
                <div className="mt-4 md:mt-0 flex items-center gap-4">
                    <button
                        onClick={() => openChat(CONTROLLER_CHANNEL_REPORT)}
                        className="px-5 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2"
                        title="Open staff communication channel"
                    >
                        <ChatAlt2Icon className="w-5 h-5" />
                        <span>Staff Channel</span>
                    </button>
                    <button
                        onClick={handleOpenNewReportModal}
                        className="px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg shadow-md hover:scale-105 transition-transform duration-300 flex items-center space-x-2"
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span>New Report</span>
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-3 print:hidden lg:h-[calc(100vh-12rem)]">
                    <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col backdrop-blur-lg h-full">
                        <div className="flex-shrink-0 mb-4 p-1 bg-gray-100 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <div className="flex">
                                <button onClick={() => setActiveTab('events')} className={tabButtonClasses('events')}><ZapIcon className="w-5 h-5" /> Live Events</button>
                                <button onClick={() => setActiveTab('responders')} className={tabButtonClasses('responders')}><UsersIcon className="w-5 h-5" /> Responders</button>
                            </div>
                        </div>
                        
                        {activeTab === 'events' ? (
                            <>
                                <button 
                                    onClick={() => setSelectedReportId(null)}
                                    disabled={!selectedReportId}
                                    className="w-full mb-4 px-3 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 bg-gray-200 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <MapIcon className="w-5 h-5" /> Show All Incidents
                                </button>
                                <LiveEventStack
                                    reports={sortedReports}
                                    responders={responders}
                                    onReportSelect={handleReportSelect}
                                    selectedReportId={selectedReportId}
                                    allUsers={allUsers}
                                    newPanicReportId={newPanicReportId}
                                />
                            </>
                        ) : (
                            <ResponderStack
                                responders={responders}
                                reports={reports}
                                selectedReportId={selectedReportId}
                                onAssign={handleAssignResponder}
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
                                onReportSelect={handleReportSelect}
                                onAssignResponder={handleAssignResponder}
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
                             <div className="lg:col-span-4 space-y-4 lg:h-[calc(100vh-12rem)]">
                                {selectedReport ? (
                                    <ControllerReportDetail
                                        key={selectedReport.id}
                                        report={selectedReport}
                                        responders={responders}
                                        profile={profile}
                                        allUsers={allUsers}
                                        onEdit={handleEditReport}
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
