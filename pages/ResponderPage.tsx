
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Report, ReportStatus, Profile, ResponderStatus, VehicleReport, EmergencyReport, ReportUpdate, Profile as UserProfile, UserRole, ACTIVE_REPORT_STATUSES, TERMINAL_REPORT_STATUSES } from '../types';
import { supabase } from '../utils/supabase';
import { safeFormatDistanceToNow } from '../utils/dateUtils';
import StatusBadge from '../components/StatusBadge';
import { NavigationIcon, CameraIcon, ScanIcon, XIcon, ChatAlt2Icon, PlusIcon, AlertTriangleIcon, HeartPulseIcon } from '../components/icons';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import ResponderMapView from '../components/ResponderMapView';
import LookoutScanner from '../components/LookoutScanner';
import CirculationListManager from '../components/CirculationListManager';
import UserReportDetail from '../components/UserReportDetail';
import { useChat } from '../contexts/ChatContext';
import { CONTROLLER_CHANNEL_REPORT } from '../constants';
import { useWakeLock } from '../hooks/useWakeLock';
import ReportModal from '../components/ReportModal';
import ImagePreviewModal from '../components/ImagePreviewModal';
import { EMSReportGenerator } from './EMSReportGenerator';
import { safeSetStorage } from '../utils/storage';

interface ResponderPageProps {
    profile: Profile;
    setProfile?: (profile: Profile) => void;
    isEmsMode?: boolean;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;
const isEmergencyReport = (report: Report): report is EmergencyReport => 'emergency_type' in report || (report as any).type === 'emergency' || 'caller_name' in report || 'patient_name' in report;

const ResponderStatusBadge: React.FC<{ status: ResponderStatus }> = ({ status }) => {
    const styles: Record<ResponderStatus, { bg: string, text: string, border: string, dot: string }> = {
        [ResponderStatus.AVAILABLE]: { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-500 shadow-emerald-500/50' },
        [ResponderStatus.EN_ROUTE]: { bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-cyan-300', border: 'border-blue-500/40', dot: 'bg-blue-500 shadow-blue-500/50' },
        [ResponderStatus.ON_SCENE]: { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/40', dot: 'bg-amber-500 shadow-amber-500/50' },
        [ResponderStatus.OFF_DUTY]: { bg: 'bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-500/20', dot: 'bg-gray-400' },
    };
    const s = styles[status] || styles[ResponderStatus.OFF_DUTY];
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full uppercase border transition-all duration-300 ${s.bg} ${s.text} ${s.border}`}>
            <span className="relative flex h-2 w-2">
                {status === ResponderStatus.EN_ROUTE && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                )}
                {status === ResponderStatus.AVAILABLE && (
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${s.dot}`}></span>
            </span>
            <span className="font-mono">{status.replace(/_/g, ' ')}</span>
        </span>
    );
};

// Main page component
const ResponderPage: React.FC<ResponderPageProps> = ({ profile, setProfile, isEmsMode = false }) => {
    const { requestWakeLock, releaseWakeLock } = useWakeLock();
    const [assignedReports, setAssignedReports] = useState<Report[]>(() => {
        try {
            const cached = localStorage.getItem(`responder_assigned_reports_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [circulationReports, setCirculationReports] = useState<VehicleReport[]>(() => {
        try {
            const cached = localStorage.getItem(`responder_circulation_reports_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
        try {
            const cached = localStorage.getItem(`responder_users_${profile.id}`);
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(() => {
        try {
            const cached = localStorage.getItem(`responder_assigned_reports_${profile.id}`);
            return !cached;
        } catch {
            return true;
        }
    });

    useEffect(() => {
        if (!profile?.id) return;
        if (assignedReports.length > 0) {
            safeSetStorage(`responder_assigned_reports_${profile.id}`, assignedReports);
        }
    }, [assignedReports, profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;
        if (circulationReports.length > 0) {
            safeSetStorage(`responder_circulation_reports_${profile.id}`, circulationReports);
        }
    }, [circulationReports, profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;
        if (allUsers.length > 0) {
            safeSetStorage(`responder_users_${profile.id}`, allUsers);
        }
    }, [allUsers, profile?.id]);

    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [emsReportToGenerate, setEmsReportToGenerate] = useState<Report | null>(null);

    const [claimedIds, setClaimedIds] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem(`responder_claimed_ids_${profile?.id}`);
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });

    useEffect(() => {
        if (!profile?.id) return;
        try {
            localStorage.setItem(`responder_claimed_ids_${profile.id}`, JSON.stringify(Array.from(claimedIds)));
        } catch (e) {
            console.warn('Could not save claimedIds:', e);
        }
    }, [claimedIds, profile?.id]);

    useEffect(() => {
        const handleLocalUpdate = (e: any) => {
            if (!e.detail) return;
            const { id, status, assigned_to } = e.detail;
            const isTerminal = status && (TERMINAL_REPORT_STATUSES.includes(status) || status === ReportStatus.RESOLVED || status === ReportStatus.RECOVERED || status === ReportStatus.CLOSED || status === 'completed');
            
            if (assigned_to === null || isTerminal) {
                setClaimedIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                setCirculationReports(prev => prev.filter(r => r.id !== id));
            } else if (assigned_to === profile.id) {
                setClaimedIds(prev => new Set(prev).add(id));
            }

            setAssignedReports(prev => prev.map(r => {
                if (r.id === id) {
                    return {
                        ...r,
                        status: status || r.status,
                        assigned_to: (isTerminal || assigned_to === null) ? null : (assigned_to !== undefined ? assigned_to : r.assigned_to)
                    };
                }
                return r;
            }));
        };

        window.addEventListener('update-local-report-status', handleLocalUpdate as EventListener);
        return () => {
            window.removeEventListener('update-local-report-status', handleLocalUpdate as EventListener);
        };
    }, [profile.id]);

    useEffect(() => {
        const handleOpenEmsModal = (e: any) => {
            if (e.detail) {
                setEmsReportToGenerate(e.detail);
            }
        };
        document.addEventListener('open-ems-modal', handleOpenEmsModal);
        return () => document.removeEventListener('open-ems-modal', handleOpenEmsModal);
    }, []);

    const [isReportModalOpen, setIsReportModalOpen] = useState(() => {
        const hasDraft = !!localStorage.getItem('new-report');
        const wasOpen = localStorage.getItem('responder_report_modal_open') === 'true';
        return hasDraft || wasOpen;
    });
    
    useEffect(() => {
        localStorage.setItem('responder_report_modal_open', String(isReportModalOpen));
    }, [isReportModalOpen]);

    const locationWatchId = useRef<number | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isSharingLocation, setIsSharingLocation] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTimestamp, setLastSyncTimestamp] = useState<Date | null>(null);
    const [anprFoundReport, setAnprFoundReport] = useState<VehicleReport | null>(null);
    const [localConfirmModal, setLocalConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);

    const [userLinkedUnit, setUserLinkedUnit] = useState<string>(() => {
        try {
            return profile.assigned_unit || localStorage.getItem(`ems_linked_unit_${profile.id}`) || 'Medic Alpha-1 (ALS)';
        } catch {
            return 'Medic Alpha-1 (ALS)';
        }
    });

    const [isUnitChangeModalOpen, setIsUnitChangeModalOpen] = useState(false);
    const [customUnitInput, setCustomUnitInput] = useState('');

    const availableUnits = useMemo(() => {
        try {
            const saved = localStorage.getItem('ems_fleet_units');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch {}
        return [
            { id: 'u1', name: 'Medic Alpha-1 (ALS)', type: 'Advanced Life Support', callSign: 'A-1', cert: 'ALS' },
            { id: 'u2', name: 'Ambulance Bravo-2 (ILS)', type: 'Intermediate Life Support', callSign: 'B-2', cert: 'ILS' },
            { id: 'u3', name: 'Medic Charlie-3 (ALS)', type: 'Rapid Response Vehicle', callSign: 'C-3', cert: 'ALS' },
            { id: 'u4', name: 'Ambulance Delta-4 (BLS)', type: 'Basic Life Support', callSign: 'D-4', cert: 'BLS' },
            { id: 'u5', name: 'Rescue Unit 1', type: 'Heavy Extrication', callSign: 'R-1', cert: 'RESCUE' },
        ];
    }, []);

    const handleSelectLinkedUnit = async (unitName: string) => {
        setUserLinkedUnit(unitName);
        localStorage.setItem(`ems_linked_unit_${profile.id}`, unitName);
        if (setProfile && profile) {
            setProfile({ ...profile, assigned_unit: unitName });
        }
        try {
            await supabase.from('profiles').update({ assigned_unit: unitName }).eq('id', profile.id);
            addToast(`EMS Unit linked to ${unitName}.`, 'success');
        } catch (e) {
            console.warn('Could not update assigned_unit in DB:', e);
        }
        setIsUnitChangeModalOpen(false);
    };

    const [emsShiftRole, setEmsShiftRole] = useState<'driver' | 'crew'>(() => {
        try {
            return (profile.ems_shift_role as any) || localStorage.getItem('ems_shift_role') || 'driver';
        } catch {
            return 'driver';
        }
    });

    const handleEmsRoleChange = async (newRole: 'driver' | 'crew') => {
        setEmsShiftRole(newRole);
        localStorage.setItem('ems_shift_role', newRole);
        if (setProfile && profile) {
            setProfile({ ...profile, ems_shift_role: newRole });
        }
        try {
            await supabase.from('profiles').update({ ems_shift_role: newRole }).eq('id', profile.id);
            addToast(`EMS Shift Position updated to ${newRole === 'driver' ? 'Driver 🚗' : 'Crew Member 🚑'}.`, 'info');
        } catch (e) {
            console.warn('Could not update ems_shift_role in DB:', e);
        }
    };

    const isInitialLoad = useRef(true);
    const audioContextRef = useRef<AudioContext | null>(null);
    const { addToast } = useToast();
    const { openChat } = useChat();

    const isOnDuty = profile.responder_status !== ResponderStatus.OFF_DUTY;

    useEffect(() => {
        if (isOnDuty) {
            requestWakeLock();
        } else {
            releaseWakeLock();
        }
        return () => {
            releaseWakeLock();
        };
    }, [isOnDuty, requestWakeLock, releaseWakeLock]);

    useEffect(() => {
        // Initialize AudioContext on mount.
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }, []);

    const playAssignmentSound = () => {
        const context = audioContextRef.current;
        if (!context) return;
        if (context.state === 'suspended') {
            context.resume();
        }
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.type = 'sawtooth'; // A more urgent sound
        oscillator.frequency.setValueAtTime(660, context.currentTime); // E5 note
        gainNode.gain.setValueAtTime(0.3, context.currentTime);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.15); // Short and sharp
    };

    const isEmsResponder = Boolean(
        isEmsMode || 
        profile.role === UserRole.EMS_RESPONDER || 
        (profile.role as string) === 'ems_responder' || 
        (profile.role as string) === 'responder' || 
        (profile.role as string) === 'driver' || 
        profile.assigned_unit || 
        localStorage.getItem(`ems_linked_unit_${profile.id}`)
    );

    const fetchData = useCallback(async () => {
        setLoading(true);
        const isGlobalAdmin = profile.role === UserRole.ADMIN && (profile.company?.name?.toLowerCase().includes('rapid911') || false);
        const isAdminOrController = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER].includes(profile.role);

        let vData: any[] = [];
        let cData: any[] = [];

        if (!isEmsResponder) {
            let vQuery = supabase.from('vehicle_reports').select('*');
            let cQuery = supabase.from('crime_reports').select('*');

            if (isAdminOrController) {
                if (!isGlobalAdmin && profile.company_id) {
                    vQuery = vQuery.or(`company_id.eq.${profile.company_id},is_global.eq.true,shared_with_company_ids.cs.{"${profile.company_id}"}`);
                    cQuery = cQuery.or(`company_id.eq.${profile.company_id},is_global.eq.true,shared_with_company_ids.cs.{"${profile.company_id}"}`);
                }
            } else {
                vQuery = vQuery.or(`assigned_to.eq.${profile.id},reported_by.eq.${profile.id}`);
                cQuery = cQuery.or(`assigned_to.eq.${profile.id},reported_by.eq.${profile.id}`);
            }

            const { data: vRes, error: vError } = await vQuery.order('reported_at', { ascending: false }).limit(50);
            const { data: cRes, error: cError } = await cQuery.order('reported_at', { ascending: false }).limit(50);
            if (vError || cError) console.error("Error fetching vehicle/crime reports:", vError || cError);
            vData = vRes || [];
            cData = cRes || [];
        }

        let aQuery = supabase.from('emergency_reports').select('*');
        if (isAdminOrController) {
            if (!isGlobalAdmin && profile.company_id) {
                aQuery = aQuery.or(`company_id.eq.${profile.company_id},is_global.eq.true,shared_with_company_ids.cs.{"${profile.company_id}"},assigned_to.eq.${profile.id},reported_by.eq.${profile.id}`);
            }
        } else if (!isEmsResponder) {
            aQuery = aQuery.or(`assigned_to.eq.${profile.id},reported_by.eq.${profile.id}`);
        }

        const { data: aData, error: aError } = await aQuery.order('reported_at', { ascending: false }).limit(50);
        
        let emsDispatchesMapped: any[] = [];
        try {
            const { data: emsData, error: emsErr } = await supabase
                .from('ems_dispatches')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (emsErr) {
                console.warn('EMS dispatches fetch error:', emsErr);
            }

            if (emsData && emsData.length > 0) {
                emsDispatchesMapped = emsData.map((d: any) => {
                    const rawUnit = d.assigned_unit || '';
                    const myUnit = (userLinkedUnit || profile.assigned_unit || '').toLowerCase();
                    const isUnitMatch = Boolean(
                        myUnit && rawUnit && (
                            rawUnit.toLowerCase().includes(myUnit) ||
                            myUnit.includes(rawUnit.toLowerCase()) ||
                            rawUnit.toLowerCase().includes((profile.first_name || '').toLowerCase()) ||
                            rawUnit.toLowerCase().includes((profile.surname || '').toLowerCase())
                        )
                    );

                    const dispatchId = String(d.id).startsWith('ems-') ? String(d.id) : `ems-${d.id}`;
                    const isClaimedLocally = claimedIds.has(dispatchId);

                    return {
                        id: dispatchId,
                        raw_id: d.id,
                        type: 'emergency',
                        ob_number: d.ob_number || `EMS-${String(d.id).slice(0, 6)}`,
                        title: d.chief_complaint || `EMS Medical Call (${d.triage_level || 'P2'})`,
                        emergency_type: d.chief_complaint || `EMS Call (${d.triage_level || 'P2'})`,
                        severity: d.triage_level === 'P1' ? 'critical' : d.triage_level === 'P2' ? 'high' : 'medium',
                        description: `${d.chief_complaint || 'Medical Emergency'}\nCaller: ${d.caller_name || 'Dispatch'} (${d.caller_phone || 'N/A'})\nAssigned Unit: ${d.assigned_unit || 'Unassigned'}\nFacility: ${d.receiving_facility || 'Pending'}\nNotes: ${d.dispatch_notes || 'None'}`,
                        location: d.location || 'Johannesburg',
                        location_coords: d.location_coords || { lat: -26.2041, lng: 28.0473 },
                        status: (d.status ? d.status.toLowerCase() : 'dispatched') as any,
                        reported_at: d.created_at || new Date().toISOString(),
                        reported_by: d.caller_name || 'EMS Dispatch Control',
                        company_id: profile.company_id || undefined,
                        assigned_unit: d.assigned_unit || '',
                        receiving_facility: d.receiving_facility || '',
                        triage_level: d.triage_level || 'P2',
                        caller_phone: d.caller_phone || '',
                        caller_name: d.caller_name || '',
                        is_ems_dispatch: true,
                        assigned_to: (isUnitMatch || isClaimedLocally) ? profile.id : undefined,
                    };
                });
            }
        } catch (err) {
            console.warn('Error fetching ems_dispatches:', err);
        }

        const { data: usersData, error: usersError } = await supabase
            .from('profiles')
            .select('id, first_name, surname, email, role, status, avatar_url, company_id, responder_status, location_coords, last_seen_at')
            .eq('company_id', profile.company_id)
            .limit(100);

        // Fetch Circulation List (Active Vehicle Reports) - Skip for EMS Responders
        let circData: VehicleReport[] = [];
        if (!isEmsResponder) {
            const activeStatuses = ACTIVE_REPORT_STATUSES;
            let circQuery = supabase.from('vehicle_reports').select('*').in('status', activeStatuses);
            
            if (!isGlobalAdmin && profile.company_id) {
                circQuery = circQuery.or(`is_global.eq.true,company_id.eq.${profile.company_id},shared_with_company_ids.cs.{"${profile.company_id}"},assigned_to.eq.${profile.id}`);
            }
            const { data: cDataRes, error: circError } = await circQuery.order('reported_at', { ascending: false }).limit(50);
            if (circError) console.error("Error fetching circulation list:", circError);
            else circData = cDataRes || [];
        }

        if (aError) console.error("Error fetching emergency reports:", aError);
        
        let combined = [...vData, ...cData, ...(aData || []), ...emsDispatchesMapped];
        if (isEmsResponder) {
            if (emsDispatchesMapped.length > 0) {
                combined = emsDispatchesMapped;
            } else {
                combined = combined.filter(r => 
                    String(r.id).startsWith('ems-') || 
                    ((r as any).type === 'emergency' && (
                        ((r as any).emergency_type && (
                            (r as any).emergency_type.toLowerCase().includes('medical') ||
                            (r as any).emergency_type.toLowerCase().includes('mva') ||
                            (r as any).emergency_type.toLowerCase().includes('ems') ||
                            (r as any).emergency_type.toLowerCase().includes('patient') ||
                            (r as any).emergency_type.toLowerCase().includes('cardiac') ||
                            (r as any).emergency_type.toLowerCase().includes('trauma') ||
                            (r as any).emergency_type.toLowerCase().includes('respiratory') ||
                            (r as any).emergency_type.toLowerCase().includes('collision') ||
                            (r as any).emergency_type.toLowerCase().includes('stroke')
                        )) ||
                        ((r as any).title && (
                            (r as any).title.toLowerCase().includes('p1') ||
                            (r as any).title.toLowerCase().includes('p2') ||
                            (r as any).title.toLowerCase().includes('p3') ||
                            (r as any).title.toLowerCase().includes('ems') ||
                            (r as any).title.toLowerCase().includes('mva') ||
                            (r as any).title.toLowerCase().includes('patient')
                        ))
                    ))
                );
            }
            if (combined.length === 0) {
                combined = [
                    {
                        id: 'ems-sample-1',
                        type: 'emergency',
                        ob_number: 'EMS-2026/0101',
                        title: 'MVA 2 Vehicles - Trapped Patient (P1 Critical)',
                        emergency_type: 'MVA 2 Vehicles - Trapped Patient (P1 Critical)',
                        severity: 'critical',
                        description: 'MVA 2 Vehicles with 1 patient trapped in vehicle. Jaws of Life requested. Severe hemorrhaging reported by caller John Maluleke (082 555 1234).',
                        location: 'M1 South & Riviera Rd Exit, Houghton',
                        location_coords: { lat: -26.1782, lng: 28.0480 },
                        status: 'open',
                        reported_at: new Date(Date.now() - 12 * 60000).toISOString(),
                        reported_by: 'EMS Dispatch Control',
                        company_id: profile.company_id || undefined,
                        assigned_unit: userLinkedUnit || 'Medic Alpha-1 (ALS)',
                        triage_level: 'P1'
                    },
                    {
                        id: 'ems-sample-2',
                        type: 'emergency',
                        ob_number: 'EMS-2026/0102',
                        title: 'Pedestrian Struck - Lower Limb Fracture (P2 High)',
                        emergency_type: 'Pedestrian Struck - Lower Limb Fracture (P2 High)',
                        severity: 'high',
                        description: 'Pedestrian struck by light motor vehicle outside Rosebank Mall. Patient conscious with obvious lower limb deformity. Caller Sarah Connor (071 999 8822).',
                        location: '45 Rosebank Mall, Oxford Rd, Rosebank',
                        location_coords: { lat: -26.1465, lng: 28.0435 },
                        status: 'open',
                        reported_at: new Date(Date.now() - 28 * 60000).toISOString(),
                        reported_by: 'EMS Dispatch Control',
                        company_id: profile.company_id || undefined,
                        assigned_unit: 'Ambulance Bravo-2 (ILS)',
                        triage_level: 'P2'
                    },
                    {
                        id: 'ems-sample-3',
                        type: 'emergency',
                        ob_number: 'EMS-2026/0103',
                        title: 'Acute Cardiac Distress / Chest Pain (P1 Critical)',
                        emergency_type: 'Acute Cardiac Distress / Chest Pain (P1 Critical)',
                        severity: 'critical',
                        description: '62yo Male presenting with acute crushing chest pain radiating to left jaw. Oxygen & ALS cardiac monitoring required urgently.',
                        location: '128 Rivonia Rd, Sandton',
                        location_coords: { lat: -26.1076, lng: 28.0567 },
                        status: 'open',
                        reported_at: new Date(Date.now() - 45 * 60000).toISOString(),
                        reported_by: 'Sandton Security Control',
                        company_id: profile.company_id || undefined,
                        assigned_unit: 'Medic Charlie-3 (ALS)',
                        triage_level: 'P1'
                    }
                ];
            }
        }
        combined.sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());

        // Preserve claimed report assignments so status updates or re-fetches do not return calls to queue
        combined = combined.map(r => {
            const isTerminal = TERMINAL_REPORT_STATUSES.includes(r.status) || r.status === ReportStatus.RESOLVED || r.status === ReportStatus.RECOVERED || r.status === ReportStatus.CLOSED || (r.status as any) === 'completed';
            if (isTerminal) {
                return {
                    ...r,
                    assigned_to: undefined
                };
            }
            if (claimedIds.has(r.id) || r.assigned_to === profile.id) {
                return {
                    ...r,
                    assigned_to: profile.id,
                    status: r.status === ReportStatus.ACTIVE ? ReportStatus.ASSIGNED : r.status
                };
            }
            return r;
        });

        setAssignedReports(combined);
        const activeCombined = combined.filter(r => ACTIVE_REPORT_STATUSES.includes(r.status));
        if (activeCombined.length > 0) setSelectedReportId(currentId => currentId && activeCombined.some(r => r.id === currentId) ? currentId : activeCombined[0].id);
        
        setCirculationReports(circData);

        if (usersError) console.error("Error fetching company users:", usersError);
        else setAllUsers(usersData || []);

        setLoading(false);
        isInitialLoad.current = false;
    }, [profile.id, profile.company_id, profile.role, profile.company?.name, isEmsResponder, claimedIds, profile.first_name, profile.surname]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    useEffect(() => {
        const handleUpsert = (payload: any) => {
            const newReport = payload.new as Report;
            if (isEmsResponder && !isEmergencyReport(newReport) && (newReport as any).type !== 'emergency') return;

            // Check if relevant
            let isRelevant = false;
            if (newReport.assigned_to === profile.id || newReport.reported_by === profile.id) {
                isRelevant = true;
            } else if (isEmsResponder) {
                const isGlobalAdmin = profile.role === UserRole.ADMIN && (profile.company?.name?.toLowerCase().includes('rapid911') || false);
                isRelevant = isGlobalAdmin ||
                             newReport.is_global ||
                             newReport.company_id === profile.company_id ||
                             (newReport.shared_with_company_ids && newReport.shared_with_company_ids.includes(profile.company_id!));
            }

            if (!isRelevant) return;

            setAssignedReports(prev => {
                const exists = prev.some(r => r.id === newReport.id);
                if (exists) { // UPDATE
                    return prev.map(r => {
                        if (r.id === newReport.id) {
                            const wasClaimedByMe = claimedIds.has(r.id) || r.assigned_to === profile.id;
                            const isResolving = newReport.status === ReportStatus.RESOLVED || newReport.status === ReportStatus.RECOVERED || newReport.status === ReportStatus.CLOSED;
                            return {
                                ...newReport,
                                assigned_to: (wasClaimedByMe && !isResolving) ? profile.id : newReport.assigned_to,
                                status: (wasClaimedByMe && newReport.status === ReportStatus.ACTIVE) ? ReportStatus.ASSIGNED : newReport.status
                            };
                        }
                        return r;
                    });
                }
                
                // NEW assignment or new queue dispatch. Play sound if not initial load.
                if (!isInitialLoad.current) {
                    playAssignmentSound();
                    if (isEmsResponder) {
                        addToast(`🚨 New EMS Dispatch in Queue: ${newReport.ob_number || (newReport as any).title || (newReport as any).emergency_type || 'Emergency Call'}`, 'info');
                    }
                }

                const updatedReports = [newReport, ...prev];
                setSelectedReportId(currentId => currentId ? currentId : newReport.id);
                return updatedReports;
            });
        };
        
        const handlePotentialUnassignmentOrDelete = (payload: any) => {
            const oldReport = payload.old as Report;
            const newReport = payload.new as Report | undefined;
            
            if (payload.eventType === 'DELETE') {
                 setAssignedReports(prev => prev.filter(r => r.id !== oldReport.id));
                 setSelectedReportId(currentId => currentId === oldReport.id ? null : currentId);
                 return;
            }

            if (payload.eventType === 'UPDATE' && newReport) {
                if (!isEmsResponder && newReport.assigned_to !== profile.id && newReport.reported_by !== profile.id) {
                    // No longer relevant for standard responder
                    setAssignedReports(prev => prev.filter(r => r.id !== newReport.id));
                    setSelectedReportId(currentId => currentId === newReport.id ? null : currentId);
                }
            }
        };

        const handleCirculationUpdate = (payload: any) => {
            if (isEmsResponder) return;

            const newReport = payload.new as VehicleReport;
            const oldReport = payload.old as VehicleReport;
            const eventType = payload.eventType;

            const activeStatuses = ACTIVE_REPORT_STATUSES;
            
            const isGlobalAdmin = profile.role === UserRole.ADMIN && (profile.company?.name?.toLowerCase().includes('rapid911') || false);
            const isRelevant = (report: VehicleReport) => {
                if (isGlobalAdmin) return true;
                if (report.is_global) return true;
                if (report.company_id === profile.company_id) return true;
                if (report.shared_with_company_ids?.includes(profile.company_id!)) return true;
                if (report.assigned_to === profile.id) return true;
                return false;
            };

            setCirculationReports(prev => {
                if (eventType === 'DELETE') {
                    return prev.filter(r => r.id !== oldReport.id);
                }

                if (eventType === 'INSERT') {
                    if (activeStatuses.includes(newReport.status) && isRelevant(newReport)) {
                        if (prev.some(r => r.id === newReport.id)) return prev;
                        return [newReport, ...prev].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
                    }
                    return prev;
                }

                if (eventType === 'UPDATE') {
                    const wasInList = prev.some(r => r.id === newReport.id);
                    const shouldBeInList = activeStatuses.includes(newReport.status) && isRelevant(newReport);

                    if (wasInList && !shouldBeInList) {
                        return prev.filter(r => r.id !== newReport.id);
                    } else if (!wasInList && shouldBeInList) {
                        return [newReport, ...prev].sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime());
                    } else if (wasInList && shouldBeInList) {
                        return prev.map(r => r.id === newReport.id ? newReport : r);
                    }
                }
                return prev;
            });
        };

        const channel = supabase.channel(`responder-reports-${profile.id}`)
            // Listen for changes where assigned_to is us
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports', filter: `assigned_to=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports', filter: `assigned_to=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports', filter: `assigned_to=eq.${profile.id}` }, handleUpsert)
            // Listen for changes where reported_by is us
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports', filter: `reported_by=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports', filter: `reported_by=eq.${profile.id}` }, handleUpsert)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports', filter: `reported_by=eq.${profile.id}` }, handleUpsert)
            // Listen for ALL changes to emergency_reports and ems_dispatches for live EMS dispatch queue updates
            .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reports' }, (payload) => {
                handleUpsert(payload);
                handlePotentialUnassignmentOrDelete(payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ems_dispatches' }, () => {
                fetchData();
            })
            // Listen for all changes to handle unassignments, deletions, and circulation updates
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_reports' }, (payload) => {
                handlePotentialUnassignmentOrDelete(payload);
                handleCirculationUpdate(payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'crime_reports' }, handlePotentialUnassignmentOrDelete)
            .subscribe();
        
        return () => { supabase.removeChannel(channel); };
    }, [profile.id, profile.company_id, profile.role, isEmsResponder, addToast]);

    // ... (existing functions)

    const stopLocationSharing = () => {
        if (locationWatchId.current !== null) {
            navigator.geolocation.clearWatch(locationWatchId.current);
            locationWatchId.current = null;
        }
        setIsSharingLocation(false);
        // Clear location from DB for privacy when sharing is explicitly stopped
        fetch('/api/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: profile.id, location_coords: null })
        }).catch(err => console.warn("Could not clear location on stop:", err));
    };

    const startLocationSharing = () => {
        if (navigator.geolocation && locationWatchId.current === null) {
            setIsSharingLocation(true); // Optimistically set UI
            locationWatchId.current = navigator.geolocation.watchPosition(
                async (position) => {
                    setIsSyncing(true);
                    setLocationError(null);
                    const { latitude, longitude } = position.coords;
                    
                    // Throttle updates: only sync if at least 15 seconds passed since last sync
                    const now = new Date();
                    if (lastSyncTimestamp && now.getTime() - lastSyncTimestamp.getTime() < 15000) {
                        setIsSyncing(false);
                        return;
                    }

                    if (typeof latitude === 'number' && !isNaN(latitude) && typeof longitude === 'number' && !isNaN(longitude)) {
                        try {
                            const response = await fetch('/api/update-profile', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    userId: profile.id, 
                                    location_coords: { lat: latitude, lng: longitude } 
                                })
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Failed to sync location');
                            }

                            setLastSyncTimestamp(new Date());
                        } catch (error: any) {
                            console.error("Failed to update location:", error);
                            setLocationError(`Failed to sync location: ${error.message}`);
                            stopLocationSharing();
                        }
                    } else {
                        console.warn("Invalid coordinates received:", latitude, longitude);
                    }
                    setIsSyncing(false);
                },
                (geoError) => {
                    console.warn(`Location sharing error:`, geoError);
                    setLocationError(`Location Error: ${geoError.message}. Please enable location services.`);
                    stopLocationSharing(); // Stop if there's a geo error
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
            );
        }
    };

    const handleDutyToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDutyStatus = e.target.checked;
        const newResponderStatus = newDutyStatus ? ResponderStatus.AVAILABLE : ResponderStatus.OFF_DUTY;
        
        setLastSyncTimestamp(null);
        setLocationError(null);
    
        // Optimistically update local profile state so toggle switch responds immediately
        setProfile(prev => ({ ...prev, responder_status: newResponderStatus }));

        const updatePayload: { responder_status: ResponderStatus; location_coords?: null } = {
            responder_status: newResponderStatus,
        };
    
        // If going off-duty, stop sharing location and clear coordinates in the same atomic update.
        if (!newDutyStatus) {
            if (locationWatchId.current !== null) {
                navigator.geolocation.clearWatch(locationWatchId.current);
                locationWatchId.current = null;
            }
            setIsSharingLocation(false);
            updatePayload.location_coords = null;
        }
    
        try {
            // Update client Supabase table
            await supabase.from('profiles').update(updatePayload).eq('id', profile.id);

            const response = await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: profile.id, ...updatePayload })
            });

            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const result = await response.json();
                    if (result && result.id) {
                        setProfile(result);
                    }
                }
            }
            addToast(`Duty status changed to ${newDutyStatus ? 'Active Duty (Available)' : 'Off Duty'}.`, 'success');
        } catch (error: any) {
            console.error("Failed to update duty status:", error);
            setLocationError(`Failed to update duty status: ${error.message || 'Network error'}`);
            addToast(`Failed to update duty status: ${error.message || 'Error'}`, 'error');
        }
    };
    
    const handleLocationToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const shouldShare = e.target.checked;
        if (shouldShare) {
            startLocationSharing();
        } else {
            stopLocationSharing();
        }
    };

    useEffect(() => {
        // This effect ensures location sharing stops if the component unmounts for any reason.
        return () => {
            if (locationWatchId.current !== null) {
                navigator.geolocation.clearWatch(locationWatchId.current);
            }
        };
    }, []);
    
    const activeAssignments = useMemo(() => {
        const terminalStatuses = ['completed', 'cancelled', 'refusal', 'not_transporting', 'closed', 'resolved', 'recovered'];
        return assignedReports.filter(r => {
            const rawStatus = String(r.status || '').toLowerCase();
            if (terminalStatuses.includes(rawStatus)) return false;

            if (isEmsResponder || (r as any).is_ems_dispatch) {
                return true;
            }

            const activeStatuses = [...ACTIVE_REPORT_STATUSES, 'dispatched', 'en_route', 'on_scene', 'transporting', 'at_hospital', 'pending', 'open', 'assigned', 'in_progress', 'active'];
            return activeStatuses.includes(rawStatus as any);
        });
    }, [assignedReports, isEmsResponder]);

    const myActiveAssignments = useMemo(() => {
        return activeAssignments.filter(r => {
            if (r.assigned_to === profile.id) return true;
            if (isEmsResponder && userLinkedUnit && (r as any).assigned_unit) {
                const callUnit = String((r as any).assigned_unit).toLowerCase();
                const myUnit = userLinkedUnit.toLowerCase();
                return callUnit.includes(myUnit) || myUnit.includes(callUnit);
            }
            return false;
        });
    }, [activeAssignments, profile.id, isEmsResponder, userLinkedUnit]);

    // A responder is "engaged" if they have active claimed calls assigned to them.
    const isEngaged = useMemo(() => 
        myActiveAssignments.length > 0,
    [myActiveAssignments]);

    const unassignedDispatchQueue = useMemo(() => {
        const queue = activeAssignments.filter(r => !myActiveAssignments.some(m => m.id === r.id));
        if (isEmsResponder && userLinkedUnit) {
            return [...queue].sort((a, b) => {
                const aUnit = (a as any).assigned_unit ? String((a as any).assigned_unit).toLowerCase() : '';
                const bUnit = (b as any).assigned_unit ? String((b as any).assigned_unit).toLowerCase() : '';
                const myUnit = userLinkedUnit.toLowerCase();
                const aMatch = aUnit && (aUnit.includes(myUnit) || myUnit.includes(aUnit)) ? 1 : 0;
                const bMatch = bUnit && (bUnit.includes(myUnit) || myUnit.includes(bUnit)) ? 1 : 0;
                return bMatch - aMatch;
            });
        }
        return queue;
    }, [activeAssignments, myActiveAssignments, isEmsResponder, userLinkedUnit]);

    const selectedReport = useMemo(() => {
        let report = activeAssignments.find(r => r.id === selectedReportId) || 
                     circulationReports.find(r => r.id === selectedReportId);
        if (!report) {
            report = myActiveAssignments[0] || unassignedDispatchQueue[0] || circulationReports[0];
        }
        if (report && isEmsResponder && !isEmergencyReport(report) && (report as any).type !== 'emergency') {
            return undefined;
        }
        return report;
    }, [activeAssignments, circulationReports, selectedReportId, isEmsResponder, myActiveAssignments, unassignedDispatchQueue]);

    useEffect(() => {
        if (selectedReport && selectedReport.id !== selectedReportId) {
            setSelectedReportId(selectedReport.id);
        } else if (!selectedReport && selectedReportId !== null) {
            setSelectedReportId(null);
        }
    }, [selectedReport, selectedReportId]);

    const handleAnprHit = async (reportId: string) => {
        const { data, error } = await supabase
            .from('vehicle_reports')
            .select('*')
            .eq('id', reportId)
            .single();

        if (data) {
            setAnprFoundReport(data as VehicleReport);
        } else {
            addToast('Could not fetch details for the flagged vehicle.', 'error');
            console.error(error);
        }
    };

    const handleSelfAssign = (report: Report) => {
        if (report.assigned_to === profile.id) {
            addToast('You are already assigned to this incident.', 'info');
            setAnprFoundReport(null);
            return;
        }

        setLocalConfirmModal({
            isOpen: true,
            title: 'Claim Dispatch Call',
            message: `Are you sure you want to claim dispatch call (OB: ${report.ob_number || report.id.slice(0, 8)})?`,
            confirmText: 'Claim Call',
            onConfirm: async () => {
                setLocalConfirmModal(null);

                // 1. Instantly update local state so the card moves immediately to My Claimed Calls
                setClaimedIds(prev => new Set(prev).add(report.id));
                setAssignedReports(prev => prev.map(r => {
                    if (r.id === report.id) {
                        return {
                            ...r,
                            assigned_to: profile.id,
                            status: ReportStatus.ASSIGNED
                        };
                    }
                    return r;
                }));

                setSelectedReportId(report.id);
                setAnprFoundReport(null);
                addToast('Dispatch call claimed! It is now in My Claimed Calls.', 'success');

                // 2. Persist to Database
                try {
                    if (report.id.startsWith('ems-sample-')) {
                        // In-memory sample report: state already updated
                    } else if (report.id.startsWith('ems-')) {
                        const cleanEmsId = report.id.replace('ems-', '');
                        await supabase
                            .from('ems_dispatches')
                            .update({
                                assigned_unit: `${profile.first_name} ${profile.surname}`,
                                status: 'EN_ROUTE'
                            })
                            .eq('id', cleanEmsId);
                    } else {
                        const tableName = isVehicleReport(report) ? 'vehicle_reports' : (isEmergencyReport(report) ? 'emergency_reports' : 'crime_reports');
                        await supabase
                            .from(tableName)
                            .update({ 
                                assigned_to: profile.id,
                                status: ReportStatus.ASSIGNED 
                            })
                            .eq('id', report.id);

                        await supabase.from('assignment_logs').insert({
                            report_id: report.id,
                            assigned_from: report.assigned_to || null,
                            assigned_to: profile.id,
                            assigned_by: profile.id
                        });

                        await supabase.from('report_updates').insert({
                            report_id: report.id,
                            user_id: profile.id,
                            content: `Responder ${profile.first_name} ${profile.surname} claimed call.`
                        });
                    }

                    // Update duty status to EN_ROUTE if needed
                    if (profile.responder_status !== ResponderStatus.EN_ROUTE && profile.responder_status !== ResponderStatus.ON_SCENE) {
                        fetch('/api/update-profile', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: profile.id, responder_status: ResponderStatus.EN_ROUTE })
                        }).catch(e => console.warn('Status update exception:', e));
                    }
                } catch (err: any) {
                    console.error('Error in handleSelfAssign DB update:', err);
                }
            }
        });
    };

    const handleUnassignSelf = (report: Report) => {
        if (report.assigned_to !== profile.id) {
            addToast('You are not assigned to this incident.', 'info');
            return;
        }

        setLocalConfirmModal({
            isOpen: true,
            title: 'Unassign Self from Incident',
            message: `Are you sure you want to unassign yourself from incident (OB: ${report.ob_number || report.id.slice(0, 8)})? The call will be returned to the dispatch queue.`,
            confirmText: 'Unassign Self',
            confirmVariant: 'danger',
            onConfirm: async () => {
                setLocalConfirmModal(null);

                // 1. Instantly update local state so the card moves back to Available Queue
                setClaimedIds(prev => {
                    const next = new Set(prev);
                    next.delete(report.id);
                    return next;
                });
                setAssignedReports(prev => prev.map(r => {
                    if (r.id === report.id) {
                        return {
                            ...r,
                            assigned_to: undefined,
                            status: ReportStatus.ACTIVE
                        };
                    }
                    return r;
                }));

                addToast('Unassigned self. Call returned to Available Queue.', 'success');

                // 2. Persist to Database
                try {
                    if (report.id.startsWith('ems-sample-')) {
                        // In-memory sample
                    } else if (report.id.startsWith('ems-')) {
                        const cleanEmsId = report.id.replace('ems-', '');
                        await supabase
                            .from('ems_dispatches')
                            .update({
                                assigned_unit: null,
                                status: 'PENDING'
                            })
                            .eq('id', cleanEmsId);
                    } else {
                        const tableName = isVehicleReport(report) ? 'vehicle_reports' : (isEmergencyReport(report) ? 'emergency_reports' : 'crime_reports');
                        await supabase.from(tableName).update({ assigned_to: null, status: ReportStatus.ACTIVE }).eq('id', report.id);
                        await supabase.from('assignment_logs').insert({
                            report_id: report.id,
                            assigned_from: profile.id,
                            assigned_to: null,
                            assigned_by: profile.id
                        });
                        await supabase.from('report_updates').insert({
                            report_id: report.id,
                            user_id: profile.id,
                            content: `Responder ${profile.first_name} ${profile.surname} unassigned self from call.`
                        });
                    }
                } catch (e: any) {
                    console.error('Error in handleUnassignSelf DB update:', e);
                }
            }
        });
    };

    if (emsReportToGenerate) {
        return <EMSReportGenerator report={emsReportToGenerate} profile={profile} onBack={() => setEmsReportToGenerate(null)} />;
    }

    return (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Duty Status & Assignments */}
            <div className="lg:col-span-4 space-y-6">
                 {/* Unit Linkage Banner */}
                 {isEmsResponder && (
                    <div className="bg-gradient-to-r from-red-950 via-rose-900 to-red-900 border border-red-500/40 rounded-2xl p-4 shadow-lg text-white space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shrink-0">
                                    <HeartPulseIcon className="w-6 h-6 text-red-400 animate-pulse" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-red-500/30 text-red-200 px-2 py-0.5 rounded-md border border-red-400/30">
                                            LINKED EMS UNIT
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live Dispatch Feed Active
                                        </span>
                                    </div>
                                    <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                                        <span className="text-amber-300 font-mono underline decoration-amber-400/50">{userLinkedUnit}</span>
                                    </h2>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsUnitChangeModalOpen(true)}
                                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                            >
                                🚑 Switch Unit
                            </button>
                        </div>

                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-red-100 flex-wrap gap-2">
                            <p className="flex items-center gap-1">
                                <span>📡 Linked to EMS Dispatch Control. All calls shared.</span>
                            </p>
                        </div>
                    </div>
                 )}

                 {/* Duty Status Card */}
                 <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                    {isEmsResponder && (
                        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3 flex items-center justify-between shadow-xs mb-2">
                            <div className="flex items-center gap-2.5">
                                <HeartPulseIcon className="w-5 h-5 text-rose-600 dark:text-rose-400 animate-pulse shrink-0" />
                                <div>
                                    <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider">EMS Medical Response</h4>
                                    <p className="text-[11px] text-rose-700 dark:text-rose-300">EMS Dispatched Calls Only</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-600 text-white rounded-full">
                                EMS ONLY
                            </span>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Duty Status</h3>
                        {profile.responder_status && <ResponderStatusBadge status={profile.responder_status} />}
                    </div>
                    
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Active Duty</span>
                        <label className="relative inline-flex items-center cursor-pointer" title={isEngaged ? "You must resolve active incidents to go off-duty." : "Toggle duty status"}>
                            <input type="checkbox" checked={isOnDuty} onChange={handleDutyToggle} className="sr-only peer" disabled={isEngaged} />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/30 peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-md disabled:opacity-50"></div>
                        </label>
                    </div>

                    {/* EMS Shift Position (Driver or Crew) */}
                    {isOnDuty && isEmsResponder && (
                        <div className="bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <span>🚑</span> Shift Position / Role
                                </span>
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-2xs">
                                    {emsShiftRole === 'driver' ? 'Driver 🚗' : 'Crew Member 🚑'}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => handleEmsRoleChange('driver')}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                        emsShiftRole === 'driver'
                                            ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500 ring-offset-1 dark:ring-offset-gray-900'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-gray-200 dark:border-gray-700'
                                    }`}
                                >
                                    <span>🚗</span> Driver
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleEmsRoleChange('crew')}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                        emsShiftRole === 'crew'
                                            ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500 ring-offset-1 dark:ring-offset-gray-900'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-gray-200 dark:border-gray-700'
                                    }`}
                                >
                                    <span>🚑</span> Crew
                                </button>
                            </div>
                        </div>
                    )}

                    {isEngaged && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-xs text-yellow-700 dark:text-yellow-400">
                                ⚠️ Resolve active assignments before going off-duty.
                            </p>
                        </div>
                    )}

                    {isOnDuty && (
                        <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${isSharingLocation ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Location Sharing</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={isSharingLocation} onChange={handleLocationToggle} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500/30 peer-checked:bg-green-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-md"></div>
                                </label>
                            </div>
                            
                            {locationError && (
                                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-800">
                                    {locationError}
                                </p>
                            )}
                            
                            {isSharingLocation && lastSyncTimestamp && (
                                <p className="text-xs text-right text-gray-400 dark:text-gray-500">
                                    Synced {safeFormatDistanceToNow(lastSyncTimestamp, { addSuffix: true })}
                                </p>
                            )}
                        </div>
                    )}
                </div>
                
                {isOnDuty && (
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => openChat(CONTROLLER_CHANNEL_REPORT)} className="flex flex-col items-center justify-center gap-2 p-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors shadow-sm">
                            <ChatAlt2Icon className="w-6 h-6" />
                            <span className="text-xs">Staff Chat</span>
                        </button>
                        <button onClick={() => setIsReportModalOpen(true)} className="flex flex-col items-center justify-center gap-2 p-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl transition-colors shadow-sm">
                            <PlusIcon className="w-6 h-6" />
                            <span className="text-xs">{isEmsResponder ? 'New EMS Call' : 'New Report'}</span>
                        </button>
                    </div>
                )}
                
                {isOnDuty && !isEmsResponder && <LookoutScanner profile={profile} onReportHit={handleAnprHit} />}

                <div className="space-y-5">
                    {!isEmsResponder && (
                        <CirculationListManager 
                            profile={profile} 
                            reports={circulationReports} 
                            loading={loading}
                            onSelectReport={setSelectedReportId}
                        />
                    )}
                    
                    {/* 1. My Claimed Calls Section */}
                    <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                                My Claimed Calls
                            </h2>
                            <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold px-2 py-0.5 rounded-full">
                                {myActiveAssignments.length}
                            </span>
                        </div>

                        {myActiveAssignments.length === 0 ? (
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-dashed border-gray-200 dark:border-gray-700/60 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400">No claimed calls assigned to you.</p>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Claim a call from the dispatch queue below.</p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {myActiveAssignments.map(report => (
                                    <div key={report.id} onClick={() => setSelectedReportId(report.id)} 
                                        className={`group relative p-3.5 cursor-pointer rounded-xl border transition-all duration-200 ${selectedReportId === report.id 
                                            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 shadow-sm' 
                                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-emerald-400 hover:shadow-xs'}`}>
                                        
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                                                    {report.type === 'roadside' ? `CAR: ${(report as any).car_number || (report as any).card_number || report.ob_number}` : report.ob_number}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold rounded">
                                                    CLAIMED
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUnassignSelf(report);
                                                    }}
                                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 hover:bg-red-200 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 transition-colors shadow-xs"
                                                    title="Unassign self from this call"
                                                >
                                                    Unassign
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-0.5 truncate">
                                            {isVehicleReport(report) ? report.license_plate : ((report as any).title || (report as any).emergency_type || 'Emergency Call')}
                                        </h3>
                                        
                                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mb-2">
                                            {isVehicleReport(report) ? `${report.vehicle_make} ${report.vehicle_model}` : (isEmergencyReport(report) ? report.emergency_type : report.crime_type)}
                                        </p>
                                        
                                        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-2 mt-2">
                                            <span>{safeFormatDistanceToNow(report.reported_at, { addSuffix: true })}</span>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-medium group-hover:underline">Active Incident →</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 2. Available Dispatch Queue Section */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                {isEmsResponder ? 'Available EMS Queue' : 'Available Dispatch Queue'}
                            </h2>
                            <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                {unassignedDispatchQueue.length}
                            </span>
                        </div>
                        
                        <div className="space-y-3 lg:max-h-[calc(100vh-38rem)] lg:overflow-y-auto pr-1 custom-scrollbar">
                            {loading ? (
                                <div className="flex justify-center items-center h-32">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : unassignedDispatchQueue.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">No pending calls in queue.</p>
                                    <p className="text-gray-400 dark:text-gray-500 text-[11px] mt-0.5">All calls claimed or standing by.</p>
                                </div>
                            ) : (
                                unassignedDispatchQueue.map(report => {
                                    const callUnit = (report as any).assigned_unit || '';
                                    const isForMyUnit = Boolean(
                                        isEmsResponder &&
                                        userLinkedUnit &&
                                        callUnit &&
                                        (callUnit.toLowerCase().includes(userLinkedUnit.toLowerCase()) || userLinkedUnit.toLowerCase().includes(callUnit.toLowerCase()))
                                    );

                                    return (
                                        <div key={report.id} onClick={() => setSelectedReportId(report.id)} 
                                            className={`group relative p-4 cursor-pointer rounded-xl border transition-all duration-200 ${
                                                isForMyUnit
                                                    ? 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-500 ring-2 ring-amber-400/50 shadow-md'
                                                    : selectedReportId === report.id 
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-md transform scale-[1.01]' 
                                                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm'
                                            }`}>
                                            
                                            <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${report.severity === 'critical' ? 'bg-red-500 animate-pulse' : report.severity === 'high' ? 'bg-orange-500' : 'bg-blue-500'}`}></span>
                                                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400 font-bold">
                                                        {report.type === 'roadside' ? `CAR: ${(report as any).car_number || (report as any).card_number || report.ob_number}` : report.ob_number}
                                                    </span>
                                                    {(report as any).triage_level && (
                                                        <span className={`px-1.5 py-0.5 text-[10px] font-black rounded ${
                                                            (report as any).triage_level === 'P1' ? 'bg-red-600 text-white' : (report as any).triage_level === 'P2' ? 'bg-amber-500 text-black' : 'bg-green-600 text-white'
                                                        }`}>
                                                            {(report as any).triage_level}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <StatusBadge status={report.status} />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSelfAssign(report);
                                                        }}
                                                        className={`px-2.5 py-1 rounded text-[11px] font-bold text-white transition-colors shadow-xs flex items-center gap-1 ${
                                                            isForMyUnit ? 'bg-amber-500 hover:bg-amber-600 text-gray-950 font-black' : 'bg-emerald-600 hover:bg-emerald-700'
                                                        }`}
                                                        title="Claim call from queue"
                                                    >
                                                        {isForMyUnit ? `Claim for ${userLinkedUnit.split(' ')[0]}` : 'Claim Call'}
                                                    </button>
                                                </div>
                                            </div>

                                            {isForMyUnit && (
                                                <div className="mb-2">
                                                    <span className="px-2 py-0.5 bg-amber-400 text-gray-950 font-black text-[10px] rounded-md shadow-xs flex items-center gap-1 w-max">
                                                        <span>🎯</span> ASSIGNED TO YOUR UNIT: {callUnit}
                                                    </span>
                                                </div>
                                            )}

                                            {!isForMyUnit && callUnit && (
                                                <div className="mb-2">
                                                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-bold text-[10px] rounded-md flex items-center gap-1 w-max">
                                                        <span>🚑</span> Assigned Unit: {callUnit}
                                                    </span>
                                                </div>
                                            )}

                                            <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1 truncate">
                                                {isVehicleReport(report) ? report.license_plate : ((report as any).title || (report as any).emergency_type || 'Emergency Call')}
                                            </h3>
                                            
                                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mb-3">
                                                {isVehicleReport(report) ? `${report.vehicle_make} ${report.vehicle_model}` : (isEmergencyReport(report) ? report.emergency_type : report.crime_type)}
                                            </p>
                                            
                                            <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 pt-2 mt-2">
                                                <span>{safeFormatDistanceToNow(report.reported_at, { addSuffix: true })}</span>
                                                <span className="group-hover:text-blue-500 transition-colors">View Details →</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Detail View & Map */}
            <div className="lg:col-span-8 lg:sticky lg:top-24 space-y-6">
                <div className="h-[35vh] rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800 relative group">
                    <ResponderMapView report={selectedReport} responderProfile={profile} />
                    {/* Map overlay gradient for better text visibility if needed, or controls */}
                </div>
                
                {selectedReport ? (
                    <ResponderReportDetail 
                        key={selectedReport.id} 
                        report={selectedReport} 
                        profile={profile} 
                        allUsers={allUsers} 
                        fetchData={fetchData} 
                        onSelfAssign={() => handleSelfAssign(selectedReport)}
                    />
                ) : (
                    <div className="h-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <NavigationIcon className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Ready for Assignment</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-md">
                            Select an incident from the dispatch queue to view full details and manage your response.
                        </p>
                    </div>
                )}
            </div>
        </div>

        {anprFoundReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setAnprFoundReport(null)}>
                <div className="relative w-full max-w-lg flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                    <div className="absolute -top-3 -right-3 z-10">
                        <button onClick={() => setAnprFoundReport(null)} className="p-2 bg-gray-800/80 rounded-full text-white hover:bg-gray-700 transition">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 bg-red-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertTriangleIcon className="w-6 h-6" />
                                <h3 className="font-bold">LOOKOUT ALERT</h3>
                            </div>
                            <span className="text-xs font-mono bg-white/20 px-2 py-1 rounded">{anprFoundReport.license_plate}</span>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto">
                            <UserReportDetail report={anprFoundReport} profile={profile} onEdit={() => {}} allUsers={allUsers} onRefresh={fetchData} />
                        </div>
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                            <button 
                                onClick={() => setAnprFoundReport(null)}
                                className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                            >
                                Dismiss
                            </button>
                            <button 
                                onClick={() => handleSelfAssign(anprFoundReport)}
                                className="flex-1 py-3 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition"
                            >
                                Self-Assign
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <ReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            reportToEdit={null}
            onReportSubmitted={fetchData}
        />

        {localConfirmModal && (
            <ConfirmModal
                isOpen={!!localConfirmModal}
                onClose={() => setLocalConfirmModal(null)}
                onConfirm={() => {
                    localConfirmModal.onConfirm();
                    setLocalConfirmModal(null);
                }}
                title={localConfirmModal.title}
                message={localConfirmModal.message}
                confirmText="Self Assign"
                confirmVariant="primary"
            />
        )}

        {/* Switch EMS Unit Modal */}
        {isUnitChangeModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setIsUnitChangeModalOpen(false)}>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-red-100 dark:bg-red-950/80 rounded-xl text-red-600 dark:text-red-400">
                                <HeartPulseIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">Switch Linked EMS Unit</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Select or enter unit call sign to view dispatch calls</p>
                            </div>
                        </div>
                        <button onClick={() => setIsUnitChangeModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                            Available Station Fleet Units
                        </label>
                        {availableUnits.map(unit => {
                            const isSelected = userLinkedUnit === unit.name || userLinkedUnit === unit.callSign;
                            return (
                                <button
                                    key={unit.id}
                                    type="button"
                                    onClick={() => handleSelectLinkedUnit(unit.name)}
                                    className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between ${
                                        isSelected
                                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500/30'
                                            : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white'
                                    }`}
                                >
                                    <div>
                                        <div className="font-bold text-sm">{unit.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{unit.type} • Call sign: {unit.callSign}</div>
                                    </div>
                                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-md ${
                                        unit.cert === 'ALS' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                                    }`}>
                                        {unit.cert}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                            Or Enter Custom Vehicle Call Sign
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={customUnitInput}
                                onChange={e => setCustomUnitInput(e.target.value)}
                                placeholder="e.g. Medic Echo-5"
                                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500 outline-none text-gray-900 dark:text-white"
                            />
                            <button
                                type="button"
                                disabled={!customUnitInput.trim()}
                                onClick={() => {
                                    if (customUnitInput.trim()) {
                                        handleSelectLinkedUnit(customUnitInput.trim());
                                        setCustomUnitInput('');
                                    }
                                }}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition"
                            >
                                Set Unit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        </>
    );
};

const ResponderReportDetail: React.FC<{ report: Report, profile: Profile, allUsers: Profile[], fetchData: () => Promise<void>, onSelfAssign: () => void }> = ({ report, profile, allUsers, fetchData, onSelfAssign }) => {
    const [updates, setUpdates] = useState<ReportUpdate[]>([]);
    const [newUpdate, setNewUpdate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState<ReportStatus | 'stand_down' | null>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const { addToast } = useToast();
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, confirmText: string, confirmVariant: 'danger' | 'primary' } | null>(null);
    const { openChat } = useChat();

    const isAssignedToMe = report.assigned_to === profile.id;

    useEffect(() => {
        const fetchUpdates = async () => { 
            const { data } = await supabase.from('report_updates').select('*, profile:profiles(first_name, surname)').eq('report_id', report.id).order('created_at');
            setUpdates(data?.map(u => {
                const profile = u.profile as { first_name: string, surname: string } | null;
                return {...u, user_full_name: profile ? `${profile.first_name} ${profile.surname}` : 'System'};
            }) || []);
        };
        fetchUpdates();
        const channel = supabase.channel(`updates-${report.id}`).on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'report_updates', filter: `report_id=eq.${report.id}`}, fetchUpdates).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [report.id]);

    const handleStatusUpdate = async (status: ReportStatus) => {
        setIsActionLoading(status);
        const isResolving = status === ReportStatus.RESOLVED || status === ReportStatus.RECOVERED || status === ReportStatus.CLOSED;

        // Immediately update local state so card stays in My Claimed Calls
        window.dispatchEvent(new CustomEvent('update-local-report-status', {
            detail: { id: report.id, status, assigned_to: isResolving ? null : profile.id }
        }));

        try {
            if (report.id.startsWith('ems-sample-')) {
                addToast(`Status updated to ${status.replace(/_/g, ' ')}.`, 'success');
                setIsActionLoading(null);
                return;
            }

            if (report.id.startsWith('ems-')) {
                const cleanEmsId = report.id.replace('ems-', '');
                const emsStatusMap: Record<string, string> = {
                    [ReportStatus.IN_PROGRESS]: 'EN_ROUTE',
                    [ReportStatus.ON_SCENE]: 'ON_SCENE',
                    [ReportStatus.RESOLVED]: 'COMPLETED',
                    [ReportStatus.CLOSED]: 'COMPLETED',
                };
                const newEmsStatus = emsStatusMap[status] || status;
                await supabase
                    .from('ems_dispatches')
                    .update({ 
                        status: newEmsStatus, 
                        assigned_unit: isResolving ? null : `${profile.first_name} ${profile.surname}` 
                    })
                    .eq('id', cleanEmsId);

                addToast(`Status updated to ${status.replace(/_/g, ' ')}.`, 'success');
                setIsActionLoading(null);
                return;
            }

            const tableName = isVehicleReport(report) ? 'vehicle_reports' : (isEmergencyReport(report) ? 'emergency_reports' : 'crime_reports');
            const updatePromises: PromiseLike<any>[] = [];

            const reportUpdatePayload: { status: ReportStatus; assigned_to?: string | null; completed_at?: string | null } = { status };
            if (isResolving) {
                reportUpdatePayload.assigned_to = null;
                reportUpdatePayload.completed_at = new Date().toISOString();
                updatePromises.push(supabase.from('assignment_logs').insert({
                    report_id: report.id,
                    assigned_from: profile.id,
                    assigned_to: null,
                    assigned_by: profile.id
                }));
            } else {
                reportUpdatePayload.assigned_to = profile.id;
            }

            updatePromises.push(supabase.from(tableName).update(reportUpdatePayload).eq('id', report.id));
            updatePromises.push(supabase.from('report_updates').insert({ report_id: report.id, user_id: profile.id, content: `Status changed to: ${status.replace(/_/g, ' ')}` }));

            let newResponderStatus: ResponderStatus | null = null;
            if (status === ReportStatus.IN_PROGRESS) {
                newResponderStatus = ResponderStatus.EN_ROUTE;
            } else if (status === ReportStatus.ON_SCENE) {
                newResponderStatus = ResponderStatus.ON_SCENE;
            } else if (isResolving) {
                const { count: vehicleCount } = await supabase.from('vehicle_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', ACTIVE_REPORT_STATUSES);
                const { count: crimeCount } = await supabase.from('crime_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', ACTIVE_REPORT_STATUSES);
                const { count: emergencyCount } = await supabase.from('emergency_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', ACTIVE_REPORT_STATUSES);
                
                const hasOtherActiveAssignments = (vehicleCount !== null && vehicleCount > 0) || (crimeCount !== null && crimeCount > 0) || (emergencyCount !== null && emergencyCount > 0);
                if (!hasOtherActiveAssignments) {
                    newResponderStatus = ResponderStatus.AVAILABLE;
                }
            }

            if (newResponderStatus && profile.responder_status !== newResponderStatus) {
                updatePromises.push(fetch('/api/update-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: profile.id, responder_status: newResponderStatus })
                }).then(res => res.ok ? { error: null } : res.json().then(data => ({ error: { message: data.error } }))));
            }
            
            const results = await Promise.all(updatePromises);
            const errors = results.map((r: any) => r.error).filter(Boolean);
            if (errors.length > 0) {
                addToast('An error occurred while updating status. Please check the console.', 'error');
                console.error('Status update errors:', errors);
            } else {
                addToast(`Status updated to ${status.replace(/_/g, ' ')}.`, 'success');
            }
        } catch (e: any) {
            console.error('Error updating status:', e);
            addToast('Failed to update status: ' + e.message, 'error');
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleStandDown = () => {
        setConfirmModalState({
            isOpen: true,
            title: 'Unassign Self from Incident',
            message: 'Are you sure you want to unassign yourself from this incident? The report will be returned to the active queue.',
            onConfirm: async () => {
                setConfirmModalState(null);
                setIsActionLoading('stand_down');

                window.dispatchEvent(new CustomEvent('update-local-report-status', {
                    detail: { id: report.id, status: ReportStatus.ACTIVE, assigned_to: null }
                }));

                try {
                    if (report.id.startsWith('ems-sample-')) {
                        addToast('Successfully unassigned yourself from the incident.', 'info');
                        setIsActionLoading(null);
                        return;
                    }

                    if (report.id.startsWith('ems-')) {
                        const cleanEmsId = report.id.replace('ems-', '');
                        await supabase
                            .from('ems_dispatches')
                            .update({ assigned_unit: null, status: 'PENDING' })
                            .eq('id', cleanEmsId);
                        addToast('Successfully unassigned yourself from the incident.', 'info');
                        setIsActionLoading(null);
                        return;
                    }

                    const tableName = isVehicleReport(report) ? 'vehicle_reports' : (isEmergencyReport(report) ? 'emergency_reports' : 'crime_reports');
                    const updatePromises: PromiseLike<any>[] = [];
                    updatePromises.push(supabase.from(tableName).update({ assigned_to: null, status: ReportStatus.ACTIVE }).eq('id', report.id));
                    updatePromises.push(supabase.from('assignment_logs').insert({
                        report_id: report.id,
                        assigned_from: profile.id,
                        assigned_to: null,
                        assigned_by: profile.id
                    }));
                    updatePromises.push(supabase.from('report_updates').insert({ report_id: report.id, user_id: profile.id, content: `Responder ${profile.first_name} ${profile.surname} unassigned self from this incident.` }));

                    const { count: vehicleCount } = await supabase.from('vehicle_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', ACTIVE_REPORT_STATUSES);
                    const { count: crimeCount } = await supabase.from('crime_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', ACTIVE_REPORT_STATUSES);
                    const { count: emergencyCount } = await supabase.from('emergency_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).neq('id', report.id).in('status', ACTIVE_REPORT_STATUSES);

                    const hasOtherActiveAssignments = (vehicleCount !== null && vehicleCount > 0) || (crimeCount !== null && crimeCount > 0) || (emergencyCount !== null && emergencyCount > 0);
                    if (!hasOtherActiveAssignments) {
                        updatePromises.push(fetch('/api/update-profile', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: profile.id, responder_status: ResponderStatus.AVAILABLE })
                        }).then(res => res.ok ? { error: null } : res.json().then(data => ({ error: { message: data.error } }))));
                    }
                    const results = await Promise.all(updatePromises);
                    const errors = results.map((r: any) => r.error).filter(Boolean);
                    if (errors.length > 0) throw new Error(errors.map(e => e.message).join('\n'));

                    addToast('Successfully unassigned yourself from the incident.', 'info');
                } catch (e: any) {
                    addToast('An error occurred while unassigning: ' + e.message, 'error');
                } finally {
                    setIsActionLoading(null);
                }
            },
            confirmText: 'Unassign Self',
            confirmVariant: 'danger'
        });
    };
    

    const handlePostUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUpdate.trim()) return;
        setIsSubmitting(true);
        await supabase.from('report_updates').insert({ report_id: report.id, user_id: profile.id, content: newUpdate });
        setNewUpdate('');
        setIsSubmitting(false);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        setIsUploading(true);
        const file = e.target.files[0];
        const filePath = `${report.id}/${file.name}-${Date.now()}`;
        const { error: uploadError } = await supabase.storage.from('evidence').upload(filePath, file);
        if (uploadError) { addToast("Upload failed: " + uploadError.message, 'error'); setIsUploading(false); return; }

        const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(filePath);
        const updatedImages = [...(report.evidence_images || []), publicUrl];
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : (isEmergencyReport(report) ? 'emergency_reports' : 'crime_reports');
        await supabase.from(tableName).update({ evidence_images: updatedImages }).eq('id', report.id);
        addToast("Evidence uploaded successfully.", 'success');
        setIsUploading(false);
    };

    const isTerminalStatus = report.status === ReportStatus.RESOLVED || report.status === ReportStatus.RECOVERED || report.status === ReportStatus.CLOSED;
    const Spinner = () => <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>;
    
    return (
        <>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
            {/* Header Section */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {isVehicleReport(report) ? report.license_plate : report.title}
                            </h2>
                            <StatusBadge status={report.status} />
                        </div>
                        <p className="font-mono text-sm text-gray-500 dark:text-gray-400">
                            {report.type === 'roadside' ? `Car No: ${(report as any).car_number || (report as any).card_number || report.ob_number}` : `OB: ${report.ob_number}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                         <button onClick={() => openChat(report)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium text-sm">
                            <ChatAlt2Icon className="w-4 h-4" />
                            Live Chat
                        </button>
                        {isAssignedToMe ? (
                            <button onClick={handleStandDown} disabled={isTerminalStatus || !!isActionLoading} className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium text-sm disabled:opacity-50 flex items-center gap-1.5">
                                {isActionLoading === 'stand_down' ? <Spinner /> : 'Unassign Self'}
                            </button>
                        ) : (
                            <button onClick={onSelfAssign} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm shadow-lg shadow-blue-600/20">
                                Self-Assign Incident
                            </button>
                        )}
                    </div>
                </div>

                {/* Primary Action Bar */}
                {isAssignedToMe && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <button 
                            onClick={() => handleStatusUpdate(ReportStatus.IN_PROGRESS)} 
                            disabled={isTerminalStatus || !!isActionLoading || report.status === ReportStatus.IN_PROGRESS} 
                            className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
                                ${report.status === ReportStatus.IN_PROGRESS 
                                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-gray-900' 
                                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'}`}
                        >
                            {isActionLoading === ReportStatus.IN_PROGRESS ? <Spinner /> : 'En Route'}
                        </button>
                        
                        <button 
                            onClick={() => handleStatusUpdate(ReportStatus.ON_SCENE)} 
                            disabled={isTerminalStatus || !!isActionLoading || report.status === ReportStatus.ON_SCENE} 
                            className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
                                ${report.status === ReportStatus.ON_SCENE 
                                    ? 'bg-yellow-500 text-white shadow-md ring-2 ring-yellow-500 ring-offset-2 dark:ring-offset-gray-900' 
                                    : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40'}`}
                        >
                            {isActionLoading === ReportStatus.ON_SCENE ? <Spinner /> : 'On Scene'}
                        </button>
                        
                        <button 
                            onClick={() => handleStatusUpdate(ReportStatus.RESOLVED)} 
                            disabled={isTerminalStatus || !!isActionLoading} 
                            className="py-3 px-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
                        >
                            {isActionLoading === ReportStatus.RESOLVED ? <Spinner /> : 'Resolve'}
                        </button>
                        
                        {isVehicleReport(report) && (
                            <button 
                                onClick={() => handleStatusUpdate(ReportStatus.RECOVERED)} 
                                disabled={isTerminalStatus || !!isActionLoading} 
                                className="py-3 px-4 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
                            >
                                {isActionLoading === ReportStatus.RECOVERED ? <Spinner /> : 'Recovered'}
                            </button>
                        )}
                        
                        {isEmergencyReport(report) && (
                            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => document.dispatchEvent(new CustomEvent('open-ems-modal', { detail: report }))}
                                    className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                                >
                                    📋 Add Scene Report & PCR
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setConfirmModalState({
                                            isOpen: true,
                                            title: "Record Refusal / Not Transporting",
                                            message: "Mark this EMS call as Patient Refusal of Transport or Treated on Scene (Not Transported)?",
                                            onConfirm: async () => {
                                                await handleStatusUpdate(ReportStatus.RESOLVED);
                                                await supabase.from('report_updates').insert([{
                                                    report_id: report.id,
                                                    user_id: profile.id,
                                                    content: `⚠️ PATIENT REFUSAL / NOT TRANSPORTING recorded by Medic (${(profile.ems_shift_role || 'crew').toUpperCase()}). Patient refused transport or treated on scene.`
                                                }]);
                                                addToast('Refusal / Not Transporting logged.', 'warning');
                                            }
                                        });
                                    }}
                                    className="py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2"
                                >
                                    🚫 Refusal / Not Transporting
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-800">
                
                {/* Left Panel: Details & Evidence */}
                <div className="p-6 space-y-6">
                    <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Incident Details</h4>
                        <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                <span className="text-xs text-gray-500 block mb-1">Location</span>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    {isVehicleReport(report) ? report.last_seen_location : report.location}
                                </p>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                <span className="text-xs text-gray-500 block mb-1">Description</span>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {report.description}
                                </p>
                            </div>

                            {isVehicleReport(report) && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500 block mb-1">Vehicle</span>
                                        <p className="font-medium">{report.vehicle_color} {report.vehicle_make}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500 block mb-1">Model</span>
                                        <p className="font-medium">{report.vehicle_model}</p>
                                    </div>
                                </div>
                            )}
                            
                            {isEmergencyReport(report) && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500 block mb-1">Type</span>
                                        <p className="font-medium">{report.emergency_type}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500 block mb-1">Vehicles</span>
                                        <p className="font-medium">{report.vehicles_involved}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500 block mb-1">Injuries</span>
                                        <p className={`font-medium ${report.injuries_reported ? 'text-red-500' : 'text-gray-700'}`}>
                                            {report.injuries_reported ? 'Yes' : 'None'}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <span className="text-xs text-gray-500 block mb-1">Fatalities</span>
                                        <p className={`font-medium ${report.fatalities_reported ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                                            {report.fatalities_reported ? 'Yes' : 'None'}
                                        </p>
                                    </div>
                                    {report.emergency_type === 'Kidnapping (taken with vehicle)' && (
                                        <>
                                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                                <span className="text-xs text-gray-500 block mb-1">License Plate</span>
                                                <p className="font-medium">{(report as any).license_plate || 'N/A'}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                                <span className="text-xs text-gray-500 block mb-1">Vehicle Make</span>
                                                <p className="font-medium">{(report as any).vehicle_make || 'N/A'}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                                <span className="text-xs text-gray-500 block mb-1">Vehicle Model</span>
                                                <p className="font-medium">{(report as any).vehicle_model || 'N/A'}</p>
                                            </div>
                                            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                                <span className="text-xs text-gray-500 block mb-1">Vehicle Color</span>
                                                <p className="font-medium">{(report as any).vehicle_color || 'N/A'}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Evidence</h4>
                            {isAssignedToMe && (
                                <label htmlFor="evidence-upload" className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1">
                                    <CameraIcon className="w-3 h-3" />
                                    {isUploading ? "Uploading..." : "Add Photo"}
                                    <input id="evidence-upload" type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                                </label>
                            )}
                        </div>
                        
                        {report.evidence_images && report.evidence_images.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                                {report.evidence_images.map((img, index) => (
                                    <button 
                                        key={index} 
                                        onClick={() => setPreviewImageUrl(img)}
                                        className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <img src={img} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" alt={`Evidence ${index + 1}`} />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <span className="text-white opacity-0 group-hover:opacity-100 font-semibold text-xs bg-black/50 px-2 py-1 rounded backdrop-blur-sm">View</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                                <CameraIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                                <p className="text-xs text-gray-400">No evidence uploaded</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Incident Log */}
                <div className="p-6 flex flex-col h-full min-h-[400px]">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Incident Log</h4>
                    
                    <div className="flex-grow bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-lg p-4 mb-4 overflow-y-auto custom-scrollbar space-y-3 max-h-[500px]">
                        {updates.length === 0 ? (
                            <p className="text-center text-gray-400 text-xs italic py-4">No updates yet.</p>
                        ) : (
                            updates.map(u => (
                                <div key={u.id} className="flex flex-col">
                                    <div className="flex items-baseline justify-between mb-1">
                                        <span className="font-semibold text-xs text-gray-700 dark:text-gray-300">{u.user_full_name}</span>
                                        <span className="text-[10px] text-gray-400 font-mono">{safeFormatDistanceToNow(u.created_at, {addSuffix: true})}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700/50 shadow-sm">
                                        {u.content}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                    
                    {isAssignedToMe && (
                        <form onSubmit={handlePostUpdate} className="flex gap-2">
                            <input 
                                type="text" 
                                value={newUpdate} 
                                onChange={e => setNewUpdate(e.target.value)} 
                                placeholder="Type an update..." 
                                className="flex-grow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                            />
                            <button 
                                type="submit" 
                                disabled={isSubmitting || !newUpdate.trim()} 
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Post
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
        {confirmModalState && (
                <ConfirmModal 
                    isOpen={confirmModalState.isOpen}
                    onClose={() => setConfirmModalState(null)}
                    onConfirm={confirmModalState.onConfirm}
                    title={confirmModalState.title}
                    message={confirmModalState.message}
                    confirmText={confirmModalState.confirmText}
                    confirmVariant={confirmModalState.confirmVariant}
                />
            )}
            <ImagePreviewModal isOpen={!!previewImageUrl} onClose={() => setPreviewImageUrl(null)} imageUrl={previewImageUrl} />
        </>
    );
};

export default ResponderPage;
