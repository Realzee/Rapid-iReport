

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Report, UserRole, Profile, Responder, ResponderStatus, VehicleReport, ReportStatus, Company, ReportShare, ACTIVE_REPORT_STATUSES, TERMINAL_REPORT_STATUSES } from '../types';
import StatCard from './StatCard';
import ReportList from './ReportList';
import MapView from './MapView';
import ReportModal from './ReportModal';
import ArchiveReportModal from './ArchiveReportModal';
import ReportDetailCard from './ReportDetailCard';
import MapModal from './MapModal';
import { CheckCircleIcon, AlertTriangleIcon, ZapIcon, PlusIcon, ChatAlt2Icon, CarIcon, CrimeIcon, WrenchIcon, ShareIcon } from './icons';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import { useChat } from '../contexts/ChatContext';
import { CONTROLLER_CHANNEL_REPORT } from '../constants';
import { isSameDay, parseISO } from 'date-fns';
import { CorporateSharingModal } from './CorporateSharingModal';

interface DashboardProps {
    profile: Profile;
    initialReportId?: string | null;
    onInitialReportHandled?: () => void;
    setView?: (view: any) => void;
}

const ACTIVE_STATUSES = ACTIVE_REPORT_STATUSES;

const Dashboard: React.FC<DashboardProps> = ({ profile, initialReportId, onInitialReportHandled, setView }) => {
    const [reports, setReports] = useState<Report[]>(() => {
        try {
            const cached = localStorage.getItem(`dashboard_reports_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [responders, setResponders] = useState<Responder[]>([]);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    const [allUsers, setAllUsers] = useState<Profile[]>(() => {
        try {
            const cached = localStorage.getItem(`dashboard_users_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const allUsersRef = useRef<Profile[]>([]);
    const [companies, setCompanies] = useState<Company[]>(() => {
        try {
            const cached = localStorage.getItem(`dashboard_companies_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(() => {
        try {
            const cached = localStorage.getItem(`dashboard_reports_${profile.id}`);
            return !cached;
        } catch {
            return true;
        }
    });
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [reportToEdit, setReportToEdit] = useState<Report | null>(() => {
        const savedId = localStorage.getItem('editing-report-id');
        return null;
    });
    const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
    const hasRestoredEditRef = useRef(false);
    const { addToast } = useToast();
    const { openChat } = useChat();

    const [pendingShares, setPendingShares] = useState<ReportShare[]>([]);
    const [isSharingModalOpen, setIsSharingModalOpen] = useState(false);

    const [myStatus, setMyStatus] = useState<ResponderStatus>(profile.responder_status || ResponderStatus.OFF_DUTY);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // Dynamic state synchronization with profiles real-time changes
    useEffect(() => {
        const matchedUser = allUsers.find(u => u.id === profile.id);
        if (matchedUser && matchedUser.responder_status) {
            setMyStatus(matchedUser.responder_status);
        } else if (profile.responder_status) {
            setMyStatus(profile.responder_status);
        }
    }, [allUsers, profile]);

    const handleMyStatusChange = async (newStatus: ResponderStatus) => {
        setIsUpdatingStatus(true);
        try {
            const response = await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: profile.id,
                    updates: { responder_status: newStatus }
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Failed to update status');
            }

            addToast(`Operational status updated to ${newStatus.replace(/_/g, ' ')}.`, 'success');
            setMyStatus(newStatus);
            
            // Trigger fetch to reload counts/responders list immediately
            fetchData();
        } catch (err: any) {
            console.error("Failed to update status:", err);
            addToast(`Failed to update status: ${err.message}`, 'error');
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    useEffect(() => {
        if (!profile || !profile.company_id) return;

        const loadPendingShares = async () => {
            try {
                const { data, error } = await supabase
                    .from('report_shares')
                    .select('*')
                    .eq('target_company_id', profile.company_id)
                    .eq('status', 'pending');
                if (error) console.error("Error loading pending shares on Dashboard:", error);
                else setPendingShares(data || []);
            } catch (err) {
                console.error("Dashboard: Error fetching pending shares:", err);
            }
        };

        loadPendingShares();

        const channel = supabase
            .channel(`dashboard-shares-${profile.company_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'report_shares' }, () => {
                loadPendingShares();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile]);

    useEffect(() => {
        if (hasRestoredEditRef.current) return;
        if (reports.length > 0) {
            const savedId = localStorage.getItem('editing-report-id');
            if (savedId) {
                const report = reports.find(r => r.id === savedId);
                if (report) {
                    setReportToEdit(report);
                    setIsReportModalOpen(true);
                } else {
                    localStorage.removeItem('editing-report-id');
                }
            }
            hasRestoredEditRef.current = true;
        }
    }, [reports]);

    useEffect(() => {
        allUsersRef.current = allUsers;
    }, [allUsers]);

    const isGlobalAdmin = profile.role === UserRole.ADMIN && 
        (profile.company?.name?.toLowerCase().includes('rapid911') || false);

    const [reportCounts, setReportCounts] = useState(() => {
        try {
            const cached = localStorage.getItem(`dashboard_report_counts_${profile.id}`);
            return cached ? JSON.parse(cached) : { vehicle: 0, crime: 0, emergency: 0 };
        } catch {
            return { vehicle: 0, crime: 0, emergency: 0 };
        }
    });

    // Stale-While-Revalidate Cache persistence effect
    useEffect(() => {
        if (!profile?.id) return;
        try {
            if (reports.length > 0) {
                localStorage.setItem(`dashboard_reports_${profile.id}`, JSON.stringify(reports));
            }
        } catch (e) {
            console.warn("Error caching dashboard reports:", e);
        }
    }, [reports, profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;
        try {
            if (allUsers.length > 0) {
                localStorage.setItem(`dashboard_users_${profile.id}`, JSON.stringify(allUsers));
            }
        } catch (e) {
            console.warn("Error caching dashboard users:", e);
        }
    }, [allUsers, profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;
        try {
            if (companies.length > 0) {
                localStorage.setItem(`dashboard_companies_${profile.id}`, JSON.stringify(companies));
            }
        } catch (e) {
            console.warn("Error caching dashboard companies:", e);
        }
    }, [companies, profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;
        try {
            localStorage.setItem(`dashboard_report_counts_${profile.id}`, JSON.stringify(reportCounts));
        } catch (e) {
            console.warn("Error caching dashboard report counts:", e);
        }
    }, [reportCounts, profile?.id]);

    const fetchData = useCallback(async () => {
        if (reports.length === 0) {
            setLoading(true);
        }

        let allowedReporterIds: string[] | null = null;

        if (!isGlobalAdmin && profile.company_id) {
            const { data: companyUsers } = await supabase
                .from('profiles')
                .select('id')
                .eq('company_id', profile.company_id);
            
            if (companyUsers && companyUsers.length > 0) {
                allowedReporterIds = companyUsers.map(u => u.id);
            } else {
                allowedReporterIds = [profile.id];
            }
        } else if (!isGlobalAdmin) {
            allowedReporterIds = [profile.id];
        }

        const profilesQuery = supabase.from('profiles').select('*');
        if (!isGlobalAdmin && profile.company_id) {
            profilesQuery.eq('company_id', profile.company_id);
        }

        let vehicleQuery = supabase.from('vehicle_reports').select('*');
        let crimeQuery = supabase.from('crime_reports').select('*');
        let emergencyQuery = supabase.from('emergency_reports').select('*');

        let vehicleCountQuery = supabase.from('vehicle_reports').select('*', { count: 'exact', head: true });
        let crimeCountQuery = supabase.from('crime_reports').select('*', { count: 'exact', head: true });
        let emergencyCountQuery = supabase.from('emergency_reports').select('*', { count: 'exact', head: true });

        if (!isGlobalAdmin && profile.company_id) {
            const filterStr = `company_id.eq.${profile.company_id},is_global.eq.true,shared_with_company_ids.cs.{"${profile.company_id}"}`;
            vehicleQuery = vehicleQuery.or(filterStr);
            crimeQuery = crimeQuery.or(filterStr);
            emergencyQuery = emergencyQuery.or(filterStr);

            vehicleCountQuery = vehicleCountQuery.or(filterStr);
            crimeCountQuery = crimeCountQuery.or(filterStr);
            emergencyCountQuery = emergencyCountQuery.or(filterStr);
        } else if (allowedReporterIds) {
            vehicleQuery = vehicleQuery.in('reported_by', allowedReporterIds);
            crimeQuery = crimeQuery.in('reported_by', allowedReporterIds);
            emergencyQuery = emergencyQuery.in('reported_by', allowedReporterIds);
            
            vehicleCountQuery = vehicleCountQuery.in('reported_by', allowedReporterIds);
            crimeCountQuery = crimeCountQuery.in('reported_by', allowedReporterIds);
            emergencyCountQuery = emergencyCountQuery.in('reported_by', allowedReporterIds);
        }

        const [
            { data: vehicleData, error: vError }, 
            { data: crimeData, error: cError },
            { data: emergencyData, error: aError },
            { data: usersData, error: uError },
            { data: companiesData, error: companiesError },
            { count: vCount },
            { count: cCount },
            { count: aCount }
        ] = await Promise.all([
            vehicleQuery.order('reported_at', { ascending: false }).limit(100),
            crimeQuery.order('reported_at', { ascending: false }).limit(100),
            emergencyQuery.order('reported_at', { ascending: false }).limit(100),
            profilesQuery,
            supabase.from('companies').select('*'),
            vehicleCountQuery,
            crimeCountQuery,
            emergencyCountQuery
        ]);
        if (vError || cError || aError || uError || companiesError) console.error('Data fetch error:', vError || cError || aError || uError || companiesError);

        const companiesMap = new Map((companiesData || []).map(c => [c.id, c.name]));

        const combinedReports = [
            ...(vehicleData || []).map(r => ({
                ...r, 
                type: 'vehicle' as const,
                company_name: r.company_id ? companiesMap.get(r.company_id) : undefined
            })), 
            ...(crimeData || []).map(r => ({
                ...r, 
                type: 'crime' as const,
                company_name: r.company_id ? companiesMap.get(r.company_id) : undefined
            })),
            ...(emergencyData || []).map(r => ({
                ...r, 
                type: 'emergency' as const,
                company_name: r.company_id ? companiesMap.get(r.company_id) : undefined
            }))
        ];
        
        setReports(combinedReports);
        setReportCounts({
            vehicle: vCount || 0,
            crime: cCount || 0,
            emergency: aCount || 0
        });
        
        // Ensure we have profiles for all reporters, even if they are outside the user's company scope
        const reporterIds = Array.from(new Set(combinedReports.map(r => r.reported_by)));
        const loadedUserIds = new Set((usersData || []).map(u => u.id));
        const missingReporterIds = reporterIds.filter(id => !loadedUserIds.has(id));
        
        let additionalProfiles: Profile[] = [];
        if (missingReporterIds.length > 0) {
                const { data: missingProfiles } = await supabase.from('profiles').select('*').in('id', missingReporterIds);
                if (missingProfiles) additionalProfiles = missingProfiles;
        }
        
        setAllUsers([...(usersData || []), ...additionalProfiles]);
        setCompanies(companiesData || []);
        setLoading(false);
    }, [isGlobalAdmin, profile.company_id]);

    useEffect(() => {
        fetchData();

        const handleReportChange = async (payload: any) => {
            const reportType = payload.table === 'vehicle_reports' ? 'vehicle' : (payload.table === 'emergency_reports' ? 'emergency' : 'crime');
            const newReport = { ...payload.new, type: reportType };

            // Filter incoming reports for non-global admins
            if (!isGlobalAdmin && profile.company_id) {
                // Check if reporter is in our loaded users list
                let reporter = allUsersRef.current.find(u => u.id === newReport.reported_by);
                
                if (!reporter) {
                    // Fetch reporter if not found locally
                    const { data } = await supabase.from('profiles').select('*').eq('id', newReport.reported_by).single();
                    if (data) {
                        reporter = data;
                        // Optimistically add to allUsers to avoid re-fetching
                        setAllUsers(prev => [...prev, data]);
                    }
                }

                if (!reporter || reporter.company_id !== profile.company_id) {
                    return; // Ignore report from other company
                }
            }

            if (payload.eventType === 'INSERT') {
                setReportCounts(prev => ({
                    ...prev,
                    [reportType]: prev[reportType as keyof typeof prev] + 1
                }));
            } else if (payload.eventType === 'DELETE') {
                setReportCounts(prev => ({
                    ...prev,
                    [reportType]: Math.max(0, prev[reportType as keyof typeof prev] - 1)
                }));
            }

            setReports(currentReports => {
                if (payload.eventType === 'INSERT') {
                    if (currentReports.some(r => r.id === newReport.id)) {
                        return currentReports;
                    }
                    return [newReport, ...currentReports];
                }
                
                if (payload.eventType === 'UPDATE') {
                    const updatedReport = { ...payload.new, type: reportType };
                    const wasInList = currentReports.some(r => r.id === updatedReport.id);

                    if (wasInList) {
                        return currentReports.map(r => r.id === updatedReport.id ? updatedReport : r);
                    } else {
                        return [updatedReport, ...currentReports];
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
                    // Avoid duplicates from race conditions
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

        const channelId = `dashboard-reports-${isGlobalAdmin ? 'global' : profile.company_id}`;
        const reportsChannel = supabase.channel(channelId, {
            config: { broadcast: { self: true } },
        });

        if (isGlobalAdmin) {
            reportsChannel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, handleReportChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, handleReportChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, handleReportChange);
        } else if (profile.company_id) {
            reportsChannel
                .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, handleReportChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, handleReportChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, handleReportChange);
        }
        reportsChannel.subscribe();
            
        const profilesChannel = supabase.channel('public:profiles-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleProfileChange)
            .subscribe();

        return () => { 
            supabase.removeChannel(reportsChannel);
            supabase.removeChannel(profilesChannel);
        };
    }, [profile]);

    // Effect to fetch missing reporters for real-time updates
    useEffect(() => {
        const fetchMissingReporters = async () => {
             const reporterIds = new Set(reports.map(r => r.reported_by));
             const loadedUserIds = new Set(allUsers.map(u => u.id));
             const missingReporterIds = Array.from(reporterIds).filter(id => !loadedUserIds.has(id));
             
             if (missingReporterIds.length > 0) {
                 const { data: missingProfiles } = await supabase.from('profiles').select('*').in('id', missingReporterIds);
                 if (missingProfiles && missingProfiles.length > 0) {
                     setAllUsers(prev => {
                         const existingIds = new Set(prev.map(u => u.id));
                         const newProfiles = missingProfiles.filter(p => !existingIds.has(p.id));
                         if (newProfiles.length === 0) return prev;
                         return [...prev, ...newProfiles];
                     });
                 }
             }
        };
        
        const timeoutId = setTimeout(() => {
            if (reports.length > 0) {
                fetchMissingReporters();
            }
        }, 1000);
        
        return () => clearTimeout(timeoutId);
    }, [reports, allUsers]);

    const handleReportSelect = useCallback((reportId: string) => {
        setSelectedReportId(prevId => {
            const nextId = prevId === reportId ? null : reportId;
            if (nextId && window.innerWidth < 1024) {
                setMobileTab('list');
            }
            return nextId;
        });
    }, []);

    useEffect(() => {
        if (initialReportId && onInitialReportHandled && reports.some(r => r.id === initialReportId)) {
            setSelectedReportId(initialReportId);
            onInitialReportHandled();
        }
    }, [initialReportId, onInitialReportHandled, reports]);
    
    // Effect to derive responders from allUsers, ensuring a single source of truth
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

    const sortedReports = useMemo(() => [...reports].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()), [reports]);
    const selectedReport = useMemo(() => reports.find(r => r.id === selectedReportId), [reports, selectedReportId]);
    
    const handleOpenNewReportModal = useCallback(() => { setReportToEdit(null); setIsReportModalOpen(true); }, []);
    const handleOpenEditReportModal = useCallback((report: Report) => {
        setReportToEdit(report);
        localStorage.setItem('editing-report-id', report.id);
        setIsReportModalOpen(true);
    }, []);
    const handleCloseReportModal = useCallback(() => {
        setIsReportModalOpen(false);
        setReportToEdit(null);
        localStorage.removeItem('editing-report-id');
    }, []);
    const handleOpenDeleteReportModal = useCallback((report: Report) => setReportToDelete(report), []);
    
    const confirmDeleteReport = useCallback(async () => {
        if (!reportToDelete) return;
        const tableName = reportToDelete.type === 'vehicle' ? 'vehicle_reports' : (reportToDelete.type === 'emergency' ? 'emergency_reports' : 'crime_reports');
        const { error } = await supabase.from(tableName).update({ 
            status: ReportStatus.DELETED,
            deleted_by: profile.id,
            deleted_at: new Date().toISOString()
        }).eq('id', reportToDelete.id);
        
        if (error) {
            addToast(`Error deleting report: ${error.message}`, 'error');
        } else {
            addToast('Report successfully moved to archives.', 'success');
            if (selectedReportId === reportToDelete.id) {
                setSelectedReportId(null);
            }
        }
        setReportToDelete(null);
    }, [reportToDelete, addToast, selectedReportId, profile.id]);
    
    const handleStatusUpdate = useCallback(async (reportId: string, newStatus: ReportStatus, reportType: 'vehicle' | 'crime' | 'emergency') => {
        const tableName = reportType === 'vehicle' ? 'vehicle_reports' : (reportType === 'emergency' ? 'emergency_reports' : 'crime_reports');
        const reportToUpdate = reports.find(r => r.id === reportId);
        if (!reportToUpdate) return;
    
        const isTerminalStatus = [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED].includes(newStatus);
        
        const updatePayload: { status: ReportStatus; assigned_to?: string | null; completed_at?: string | null } = { status: newStatus };
    
        if (isTerminalStatus) {
            updatePayload.completed_at = new Date().toISOString();
            if (reportToUpdate.assigned_to) {
                updatePayload.assigned_to = null;
            }
        } else {
            updatePayload.completed_at = null;
        }
    
        const { error: updateError } = await supabase.from(tableName).update(updatePayload).eq('id', reportId);
    
        if (updateError) {
            addToast("Failed to update status: " + updateError.message, 'error');
            return;
        }

        if (isTerminalStatus && reportToUpdate.assigned_to) {
            await supabase.from('assignment_logs').insert({
                report_id: reportId,
                assigned_from: reportToUpdate.assigned_to,
                assigned_to: null,
                assigned_by: profile.id
            });
        }
    
        await supabase.from('report_updates').insert({
            report_id: reportId,
            user_id: profile.id,
            content: `Status changed to: ${newStatus.replace(/_/g, ' ')}`
        });
        
        await fetchData();
    
        if (isTerminalStatus && reportToUpdate.assigned_to) {
            const responderId = reportToUpdate.assigned_to;
            
            const { count: activeVehicleAssignments } = await supabase
                .from('vehicle_reports')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', responderId)
                .in('status', ACTIVE_REPORT_STATUSES);
            
            const { count: activeCrimeAssignments } = await supabase
                .from('crime_reports')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', responderId)
                .in('status', ACTIVE_REPORT_STATUSES);

            const { count: activeEmergencyAssignments } = await supabase
                .from('emergency_reports')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', responderId)
                .in('status', ACTIVE_REPORT_STATUSES);
    
            if ((activeVehicleAssignments === null || activeVehicleAssignments === 0) && 
                (activeCrimeAssignments === null || activeCrimeAssignments === 0) &&
                (activeEmergencyAssignments === null || activeEmergencyAssignments === 0)) {
                try {
                    const response = await fetch('/api/update-profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: responderId,
                            updates: { responder_status: ResponderStatus.AVAILABLE }
                        }),
                    });

                    const contentType = response.headers.get('content-type');
                    let result;
                    if (contentType && contentType.includes('application/json')) {
                        result = await response.json();
                    } else {
                        const text = await response.text();
                        console.error('Non-JSON response received from /api/update-profile (responder status update):', text);
                        // We don't throw here to avoid breaking the main flow, but we log it
                        result = { error: `Server returned non-JSON response (${response.status})` };
                    }

                    if (!response.ok) {
                        console.warn("Report status updated, but failed to update responder status:", result?.error || `Status: ${response.status}`);
                    }
                } catch (err) {
                    console.warn("Report status updated, but failed to update responder status (network error):", err);
                }
            }
        }
        
        // Refresh data to ensure UI is up to date
        await fetchData();
    }, [reports, profile.id, addToast, fetchData]);


    const [showIdleReports, setShowIdleReports] = useState(false);

    const { liveReports, idleReports } = useMemo(() => {
        const live: Report[] = [];
        const idle: Report[] = [];
        
        sortedReports.forEach((report) => {
            if (report.status === ReportStatus.DELETED) {
                idle.push(report);
            } else if (live.length < 20) {
                live.push(report);
            } else {
                idle.push(report);
            }
        });
        
        return { liveReports: live, idleReports: idle };
    }, [sortedReports]);

    const displayReports = showIdleReports ? sortedReports : liveReports;

    if (loading) return <div className="flex justify-center items-center h-full"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="container mx-auto flex flex-col px-1 sm:px-4 py-2 sm:py-6">
            <div className="flex-shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 sm:mb-6">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                            {isMobile ? "Operations Hub" : "Operational Control Platform"}
                        </h2>
                        {!isMobile && (
                            <p className="text-gray-500 dark:text-gray-400 mt-1">Live operational overview of community safety.</p>
                        )}
                    </div>
                    <div className="mt-3 md:mt-0 flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={() => openChat(CONTROLLER_CHANNEL_REPORT)}
                            className={`${isMobile ? 'flex-1 justify-center px-3 py-2 text-xs font-bold' : 'px-6 py-3.5 text-sm font-bold'} bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl shadow-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-300 flex items-center space-x-2`}
                            title="Open staff communication channel"
                        >
                            <ChatAlt2Icon className="w-4 h-4" />
                            <span>Staff Channel</span>
                        </button>
                        <button 
                            onClick={handleOpenNewReportModal} 
                            className={`${isMobile ? 'flex-1 justify-center px-3 py-2 text-xs font-bold' : 'px-6 py-3.5 text-sm font-bold'} bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl shadow-xs hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-300 flex items-center space-x-2`}
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>New Report</span>
                        </button>
                    </div>
                </div>

                {/* My Operational Status Manager */}
                <div className={`${isMobile ? 'p-2.5 mb-3 rounded-lg text-xs' : 'p-4 mb-6 rounded-xl'} bg-white/85 dark:bg-gray-950/80 border-l-4 shadow-xs backdrop-blur-md flex flex-row items-center justify-between gap-2 transition-all duration-300 ${
                    myStatus === ResponderStatus.AVAILABLE ? 'border-emerald-500' :
                    myStatus === ResponderStatus.EN_ROUTE ? 'border-blue-500' :
                    myStatus === ResponderStatus.ON_SCENE ? 'border-amber-500' : 'border-gray-300 dark:border-gray-750'
                }`}>
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="relative flex-shrink-0">
                            <div className={`w-2.5 h-2.5 rounded-full ${
                                myStatus === ResponderStatus.AVAILABLE ? 'bg-emerald-500 animate-pulse' :
                                myStatus === ResponderStatus.EN_ROUTE ? 'bg-blue-500 animate-pulse' :
                                myStatus === ResponderStatus.ON_SCENE ? 'bg-amber-500 animate-pulse' : 'bg-gray-400'
                            }`} />
                            {isUpdatingStatus && (
                                <div className="absolute inset-0 bg-white/50 rounded-full flex items-center justify-center">
                                    <div className="w-2.5 h-2.5 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            {isMobile ? (
                                <p className="font-bold text-gray-800 dark:text-white truncate">
                                    Status: <span className="capitalize text-blue-600 dark:text-blue-400">{myStatus.replace(/_/g, ' ')}</span>
                                </p>
                            ) : (
                                <>
                                    <span className="text-[10px] font-bold tracking-wider uppercase text-gray-400 dark:text-gray-500">
                                        My Operational Presence
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-extrabold text-sm text-gray-800 dark:text-white capitalize">
                                            {myStatus.replace(/_/g, ' ')}
                                        </h3>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                            • {profile.first_name} {profile.surname} ({profile.role.toUpperCase()})
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!isMobile && <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Duty Status:</span>}
                        <div className="relative">
                            <select
                                value={myStatus}
                                onChange={(e) => handleMyStatusChange(e.target.value as ResponderStatus)}
                                disabled={isUpdatingStatus}
                                className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg py-1 px-2 text-[11px] font-bold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition disabled:opacity-75 appearance-none cursor-pointer pr-6"
                            >
                                <option value={ResponderStatus.AVAILABLE}>🟢 Available</option>
                                <option value={ResponderStatus.EN_ROUTE}>🔵 En Route</option>
                                <option value={ResponderStatus.ON_SCENE}>🟡 On Scene</option>
                                <option value={ResponderStatus.OFF_DUTY}>⚪ Off Duty</option>
                            </select>
                            <div className="absolute top-1/2 right-2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {pendingShares.length > 0 && (
                    <div className="bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/25 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 shadow-sm animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center font-bold">
                          <ShareIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">Pending Corporate Sharing Approvals</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">You have {pendingShares.length} incoming report sharing solicitation(s) requiring response authorization.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsSharingModalOpen(true)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                      >
                        Review Share Requests
                      </button>
                    </div>
                )}

                {isMobile ? (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <StatCard title="Active Incidents" value={reports.filter(r => r.status === 'active' || r.status === 'in_progress').length.toString()} icon={<AlertTriangleIcon className="w-4 h-4" />} color="red" />
                        <StatCard title="Total Reports" value={(reportCounts.vehicle + reportCounts.crime + reportCounts.emergency).toString()} icon={<ZapIcon className="w-4 h-4" />} color="primary" />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <StatCard title="Total Reports" value={(reportCounts.vehicle + reportCounts.crime + reportCounts.emergency).toString()} icon={<ZapIcon />} color="primary" />
                            <StatCard title="Vehicle" value={reportCounts.vehicle.toString()} icon={<CarIcon />} color="yellow" />
                            <StatCard title="Crime" value={reportCounts.crime.toString()} icon={<CrimeIcon />} color="red" />
                            <StatCard title="Emergency" value={reportCounts.emergency.toString()} icon={<AlertTriangleIcon />} color="orange" />
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            <StatCard title="Active Incidents" value={reports.filter(r => r.status === 'active' || r.status === 'in_progress').length.toString()} icon={<AlertTriangleIcon />} color="red" />
                            <StatCard title="Resolved Today" value={reports.filter(r => (r.status === 'resolved' || r.status === 'recovered' || r.status === 'closed') && r.completed_at && isSameDay(parseISO(r.completed_at), new Date())).length.toString()} icon={<CheckCircleIcon />} color="green" />
                            <div className="col-span-2 sm:col-span-1">
                                <StatCard title="Available Responders" value={responders.filter(r => r.status === 'available').length.toString()} icon={<ZapIcon />} color="yellow" />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {isMobile && (
                <div className="flex p-1 bg-gray-100 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-750 rounded-xl mb-4">
                    <button
                        onClick={() => setMobileTab('list')}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                            mobileTab === 'list'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                    >
                        Incidents ({displayReports.length})
                    </button>
                    <button
                        onClick={() => setMobileTab('map')}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                            mobileTab === 'map'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                    >
                        Live Map
                    </button>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                {(!isMobile || mobileTab === 'list') && (
                    <div className={`lg:flex-shrink-0 flex flex-col transition-all duration-300 ${selectedReport ? 'lg:w-[500px] lg:h-fit lg:min-h-[calc(100vh-8.5rem-4.5rem-1.5rem)]' : 'lg:w-[400px] lg:h-[calc(100vh-8.5rem-4.5rem-1.5rem)]'}`}>
                        <div className="flex justify-between items-center mb-2 px-1">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                {showIdleReports ? 'Showing archives' : 'Showing live stack (top 20)'}
                            </span>
                            <button
                                onClick={() => setShowIdleReports(!showIdleReports)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            >
                                {showIdleReports ? 'Show Live Only' : 'Load Archives'}
                            </button>
                        </div>
                        {selectedReport ? (
                            <ReportDetailCard report={selectedReport} onClose={() => setSelectedReportId(null)} profile={profile} onEdit={handleOpenEditReportModal} onDelete={handleOpenDeleteReportModal} onViewOnMap={() => { if (isMobile) { setMobileTab('map'); } else { setIsMapModalOpen(true); } }} allUsers={allUsers} />
                        ) : (
                            <ReportList reports={displayReports} onReportSelect={handleReportSelect} selectedReportId={selectedReportId} profile={profile} allUsers={allUsers} onStatusUpdate={handleStatusUpdate} companies={companies} />
                        )}
                    </div>
                )}
                {(!isMobile || mobileTab === 'map') && (
                    <div className="flex-1 min-w-0">
                        <div className="h-[60vh] lg:h-[calc(100vh-8.5rem-4.5rem-1.5rem)] lg:sticky lg:top-20">
                            <MapView 
                                reports={displayReports} 
                                responders={responders} 
                                selectedReportId={selectedReportId} 
                                profile={profile} 
                                onReportSelect={handleReportSelect}
                                allUsers={allUsers}
                            />
                        </div>
                    </div>
                )}
            </div>
            <ReportModal isOpen={isReportModalOpen} onClose={handleCloseReportModal} reportToEdit={reportToEdit} onReportSubmitted={fetchData} />
            <ArchiveReportModal isOpen={!!reportToDelete} onClose={() => setReportToDelete(null)} onConfirm={confirmDeleteReport} reportIdentifier={reportToDelete ? (reportToDelete.type === 'vehicle' ? (reportToDelete as any).license_plate : reportToDelete.title) : ''} />
            <MapModal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} report={selectedReport} />
            <CorporateSharingModal isOpen={isSharingModalOpen} onClose={() => setIsSharingModalOpen(false)} profile={profile} onUpdate={fetchData} />
        </div>
    );
};

export default Dashboard;