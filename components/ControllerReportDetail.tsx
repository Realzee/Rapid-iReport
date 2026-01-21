import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Report, Profile, VehicleReport, ReportStatus, Responder, ReportUpdate, ResponderStatus, AssignmentLog, Company, UserRole } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '../utils/supabase';
import { CheckCircleIcon, AssignResponderIcon, ZapIcon, PrintIcon, TrashIcon } from './icons';
import PrintableReport from './PrintableReport';
import { useToast } from '../contexts/ToastContext';
import IncidentChat from './IncidentChat';
import ConfirmModal from './ConfirmModal';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const DetailField: React.FC<{ label: string, children: React.ReactNode, className?: string }> = ({ label, children, className }) => (
    <div className={className}>
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <div className="mt-1 text-sm">{children}</div>
    </div>
);

const TimelineItem: React.FC<{
    icon: React.ReactNode;
    children: React.ReactNode;
    author?: string | null;
    time: string;
}> = ({ icon, children, author, time }) => (
    <div className="flex gap-4 relative">
        <div className="absolute left-4 top-10 -bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700 last:hidden"></div>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center ring-4 ring-white dark:ring-gray-900/80 z-10">
            {icon}
        </div>
        <div className="flex-grow pb-2">
            <div className="text-sm text-gray-800 dark:text-gray-200">{children}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {author && <span className="font-semibold">{author}</span>}
                {author && ' · '}
                <span>{time}</span>
            </div>
        </div>
    </div>
);


const ControllerReportDetail: React.FC<{ report: Report; responders: Responder[]; profile: Profile }> = ({ report, responders, profile }) => {
    const [updates, setUpdates] = useState<ReportUpdate[]>([]);
    const [assignmentHistory, setAssignmentHistory] = useState<AssignmentLog[]>([]);
    const [reporter, setReporter] = useState<Profile | null>(null);
    const [newUpdate, setNewUpdate] = useState('');
    const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<ReportStatus>(report.status);
    const [selectedResponder, setSelectedResponder] = useState<string>(report.assigned_to || '');
    const [archiveModalOpen, setArchiveModalOpen] = useState(false);
    const { addToast } = useToast();

    const timelineEndRef = useRef<HTMLDivElement>(null);

    const isTerminalStatus = useMemo(() => {
        return [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED, ReportStatus.REJECTED].includes(report.status);
    }, [report.status]);
    
    const canManageReport = useMemo(() => [UserRole.ADMIN, UserRole.MODERATOR].includes(profile.role), [profile.role]);

    const scrollToBottom = () => {
        timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        setSelectedStatus(report.status);
        setSelectedResponder(report.assigned_to || '');

        const fetchDetails = async () => {
            const [
                { data: updatesData, error: updatesError },
                { data: historyData, error: historyError },
                { data: reporterData, error: reporterError }
            ] = await Promise.all([
                supabase.from('report_updates').select('*, profile:profiles(full_name)').eq('report_id', report.id).order('created_at', { ascending: true }),
                supabase.from('assignment_logs').select(`*, assigned_from_profile:profiles!assignment_logs_assigned_from_fkey(full_name), assigned_to_profile:profiles!assignment_logs_assigned_to_fkey(full_name), assigned_by_profile:profiles!assignment_logs_assigned_by_fkey(full_name)`).eq('report_id', report.id).order('created_at', { ascending: false }),
                supabase.from('profiles').select('full_name').eq('id', report.reported_by).single()
            ]);

            if (updatesError) console.error("Error fetching report updates:", updatesError);
            else setUpdates(updatesData?.map(u => ({...u, user_full_name: (u.profile as any)?.full_name || 'System'})) || []);

            if (historyError) console.error("Error fetching assignment history:", historyError);
            else if (historyData) {
                const formattedHistory = historyData.map((log: any) => ({
                    ...log,
                    assigned_from_name: log.assigned_from_profile?.full_name || null,
                    assigned_to_name: log.assigned_to_profile?.full_name || null,
                    assigned_by_name: log.assigned_by_profile?.full_name || 'System',
                }));
                setAssignmentHistory(formattedHistory);
            }
            
            if (reporterError) console.error("Error fetching reporter:", reporterError);
            else setReporter(reporterData as any);
        };
        
        fetchDetails();

        const updatesChannel = supabase
            .channel(`report-updates-${report.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'report_updates', filter: `report_id=eq.${report.id}`}, 
            async (payload) => {
                const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', payload.new.user_id).single();
                const newUpdateWithUser = { ...payload.new, user_full_name: profileData?.full_name || 'System' };
                setUpdates(prev => [...prev, newUpdateWithUser as ReportUpdate]);
            })
            .subscribe();
            
        const historyChannel = supabase
            .channel(`report-history-${report.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assignment_logs', filter: `report_id=eq.${report.id}`}, 
            async () => {
                const { data: historyData, error: historyError } = await supabase.from('assignment_logs').select(`*, assigned_from_profile:profiles!assignment_logs_assigned_from_fkey(full_name), assigned_to_profile:profiles!assignment_logs_assigned_to_fkey(full_name), assigned_by_profile:profiles!assignment_logs_assigned_by_fkey(full_name)`).eq('report_id', report.id).order('created_at', { ascending: false });
                if (!historyError && historyData) {
                    const formattedHistory = historyData.map((log: any) => ({ ...log, assigned_from_name: log.assigned_from_profile?.full_name || null, assigned_to_name: log.assigned_to_profile?.full_name || null, assigned_by_name: log.assigned_by_profile?.full_name || 'System' }));
                    setAssignmentHistory(formattedHistory);
                }
            })
            .subscribe();

        return () => { 
            supabase.removeChannel(updatesChannel); 
            supabase.removeChannel(historyChannel);
        };
    }, [report.id, report.status, report.assigned_to, report.reported_by]);
    
    const timelineEvents = useMemo(() => {
        const combined = [
            ...updates.map(u => ({
                id: u.id,
                type: 'update' as const,
                content: u.content,
                author: u.user_full_name,
                created_at: u.created_at,
            })),
            ...assignmentHistory.map(h => ({
                id: h.id,
                type: 'assignment' as const,
                content: h.assigned_to_name
                    ? `Assigned to ${h.assigned_to_name}`
                    : `Unassigned from ${h.assigned_from_name}`,
                author: h.assigned_by_name,
                created_at: h.created_at,
            }))
        ];
        const sorted = combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return sorted;
    }, [updates, assignmentHistory]);

    useEffect(() => {
        scrollToBottom();
    }, [timelineEvents]);

    const handleUpdateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUpdate.trim() || isTerminalStatus) return;

        setIsSubmittingUpdate(true);
        const { error } = await supabase.from('report_updates').insert({
            report_id: report.id,
            user_id: profile.id,
            content: newUpdate,
        });

        if (error) {
            addToast('Failed to post update: ' + error.message, 'error');
        } else {
            setNewUpdate('');
        }
        setIsSubmittingUpdate(false);
    };

    const handleStatusUpdate = async (newStatus: ReportStatus) => {
        if (isTerminalStatus) return;
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        const isNowTerminal = [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED, ReportStatus.REJECTED].includes(newStatus);
    
        const updatePayload: { status: ReportStatus; assigned_to?: string | null } = { status: newStatus };
    
        if (isNowTerminal && report.assigned_to) {
            updatePayload.assigned_to = null;
        }
    
        const { error: updateError } = await supabase.from(tableName).update(updatePayload).eq('id', report.id);
        if (updateError) {
            addToast("Failed to update status: " + updateError.message, 'error');
            return;
        }
    
        await supabase.from('report_updates').insert({
            report_id: report.id,
            user_id: profile.id,
            content: `Status changed to: ${newStatus.replace(/_/g, ' ')}`
        });
    
        if (isNowTerminal && report.assigned_to) {
            const responderId = report.assigned_to;
            
            const { count: activeVehicleAssignments } = await supabase
                .from('vehicle_reports')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', responderId)
                .in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
            
            const { count: activeCrimeAssignments } = await supabase
                .from('crime_reports')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', responderId)
                .in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
    
            if ((activeVehicleAssignments === null || activeVehicleAssignments === 0) && (activeCrimeAssignments === null || activeCrimeAssignments === 0)) {
                const { error: profileUpdateError } = await supabase.from('profiles').update({ responder_status: ResponderStatus.AVAILABLE }).eq('id', responderId);
                if(profileUpdateError) console.warn("Report status updated, but failed to update responder status:", profileUpdateError.message);
            }
        }
    };

    const handleDispatchResponder = async (responderId: string) => {
        if (isTerminalStatus) return;
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        const oldResponderId = report.assigned_to;
    
        const { error: reportUpdateError } = await supabase.from(tableName).update({ 
            assigned_to: responderId || null,
            status: responderId ? ReportStatus.IN_PROGRESS : ReportStatus.ACTIVE 
        }).eq('id', report.id);
    
        if (reportUpdateError) {
            addToast("Failed to dispatch responder: " + reportUpdateError.message, 'error');
            return;
        }
    
        const responderStatusUpdates: PromiseLike<any>[] = [];
    
        if (oldResponderId && oldResponderId !== responderId) {
            const { count: otherVehicleAssignments, error: vError } = await supabase.from('vehicle_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', oldResponderId).neq('id', report.id).in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
            const { count: otherCrimeAssignments, error: cError } = await supabase.from('crime_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', oldResponderId).neq('id', report.id).in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
    
            if (!vError && !cError) {
                const hasOtherActiveAssignments = (otherVehicleAssignments !== null && otherVehicleAssignments > 0) || (otherCrimeAssignments !== null && otherCrimeAssignments > 0);
                if (!hasOtherActiveAssignments) {
                    responderStatusUpdates.push(
                        supabase.from('profiles').update({ responder_status: ResponderStatus.AVAILABLE }).eq('id', oldResponderId)
                    );
                }
            } else {
                console.warn("Could not check for other active reports when unassigning:", vError || cError);
            }
        }
        
        if (responderId && oldResponderId !== responderId) {
            responderStatusUpdates.push(
                supabase.from('profiles').update({ responder_status: ResponderStatus.EN_ROUTE }).eq('id', responderId)
            );
        }
    
        if (responderStatusUpdates.length > 0) {
            Promise.all(responderStatusUpdates).then(results => {
                const updateError = results.find(res => res.error);
                if (updateError) {
                    console.warn("Report was dispatched, but failed to update a responder's status:", updateError.error.message);
                }
            });
        }
    };
    
    const handlePrint = () => {
        window.print();
    };

    const handleConfirmArchive = async () => {
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        const { error } = await supabase.from(tableName).update({ status: ReportStatus.DELETED }).eq('id', report.id);
        if (error) {
            addToast(`Error archiving report: ${error.message}`, 'error');
        } else {
            addToast('Report archived successfully.', 'success');
        }
        setArchiveModalOpen(false);
    };
    
    const availableResponders = responders.filter(r => r.status === ResponderStatus.AVAILABLE);
    const currentlyAssignedResponder = report.assigned_to ? responders.find(r => r.id === report.assigned_to) : undefined;
    const responderOptions = [...availableResponders];
    if (currentlyAssignedResponder && !availableResponders.some(r => r.id === currentlyAssignedResponder.id)) {
        responderOptions.push(currentlyAssignedResponder);
    }
    const statusOptions = [ReportStatus.PENDING, ReportStatus.ASSIGNED, ReportStatus.ON_SCENE, ReportStatus.RESOLVED, ReportStatus.CLOSED];

    return (
        <>
            <div className="bg-white/70 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl h-full flex flex-col text-gray-900 dark:text-white backdrop-blur-lg shadow-lg print:hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700/50 flex-shrink-0 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold">Report Details: {report.ob_number}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {isVehicleReport(report) ? 'Stolen Vehicle' : report.title} - {format(new Date(report.reported_at), 'MM/dd/yyyy, hh:mm a')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {canManageReport && (
                            <button onClick={() => setArchiveModalOpen(true)} disabled={isTerminalStatus} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Archive Report">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={handlePrint} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50 rounded-full transition-colors" title="Print Report">
                            <PrintIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-4 flex-grow overflow-y-auto space-y-6 print:overflow-visible">
                     <div className="grid grid-cols-2 gap-4">
                        <DetailField label="Severity"><p className="font-semibold text-md capitalize">{report.severity}</p></DetailField>
                        <DetailField label="Status"><span className="px-3 py-1 text-xs font-bold rounded-full capitalize border bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">{report.status.replace(/_/g, ' ')}</span></DetailField>
                    </div>
                    
                    <DetailField label="Description"><p className="whitespace-pre-wrap">{report.description}</p></DetailField>
                    
                    {isVehicleReport(report) && (
                        <DetailField label="Vehicle Details">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-gray-800 dark:text-white bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-xs">{report.license_plate}</span>
                                <span>{report.vehicle_color} {report.vehicle_make} {report.vehicle_model}</span>
                            </div>
                        </DetailField>
                    )}

                     <DetailField label="Incident Timeline">
                        <div className="space-y-1">
                            {timelineEvents.length === 0 ? (
                                <div className="text-center py-8">
                                   <p className="text-sm text-gray-500">No updates or assignments yet.</p>
                                </div>
                            ) : (
                                timelineEvents.map(event => (
                                    <TimelineItem
                                        key={`${event.type}-${event.id}`}
                                        time={formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                                        author={event.author}
                                        icon={event.type === 'assignment' ? <AssignResponderIcon className="w-4 h-4 text-gray-500" /> : <ZapIcon className="w-4 h-4 text-gray-500" />}
                                    >
                                        <p>{event.content}</p>
                                    </TimelineItem>
                                ))
                            )}
                            <div ref={timelineEndRef} />
                        </div>
                    </DetailField>
                    <DetailField label="Live Communication">
                        <IncidentChat reportId={report.id} currentUserProfile={profile} disabled={isTerminalStatus} />
                    </DetailField>
                </div>

                <div className={`p-4 border-t border-gray-200 dark:border-gray-700/50 space-y-4 flex-shrink-0 bg-white/50 dark:bg-gray-900/50 ${isTerminalStatus ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <form onSubmit={handleUpdateSubmit} className="flex-shrink-0">
                         <div className="relative">
                            <textarea value={newUpdate} onChange={(e) => setNewUpdate(e.target.value)} placeholder={isTerminalStatus ? "This incident is closed. No new updates can be added." : "Type an update..."} rows={2} disabled={isTerminalStatus} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 pl-3 pr-10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:cursor-not-allowed"/>
                            <button type="submit" disabled={isSubmittingUpdate || isTerminalStatus} className="absolute top-2 right-2 p-2 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                            </button>
                        </div>
                    </form>

                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Update Status</label>
                         <div className="flex items-center gap-2">
                            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as ReportStatus)} disabled={isTerminalStatus} className="flex-grow bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 capitalize disabled:cursor-not-allowed">
                                {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                            </select>
                             <button onClick={() => handleStatusUpdate(selectedStatus)} disabled={isTerminalStatus} className="p-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:cursor-not-allowed">
                                <CheckCircleIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            </button>
                        </div>
                    </div>
                     <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Dispatch Responder</label>
                        <div className="flex items-center gap-2">
                            <select value={selectedResponder} onChange={(e) => setSelectedResponder(e.target.value)} disabled={isTerminalStatus} className="flex-grow bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed">
                                <option value="">{report.assigned_to ? 'Unassign' : (availableResponders.length > 0 ? 'Select Responder...' : 'No responders available')}</option>
                                {responderOptions.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.full_name}
                                        {r.status !== ResponderStatus.AVAILABLE ? ` (${r.status.replace(/_/g, ' ')})` : ''}
                                    </option>
                                ))}
                            </select>
                            <button onClick={() => handleDispatchResponder(selectedResponder)} disabled={isTerminalStatus} className="p-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:cursor-not-allowed">
                                <AssignResponderIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <PrintableReport
                report={report}
                timelineEvents={timelineEvents}
                reporterName={reporter?.full_name}
                company={profile.company}
            />
            {archiveModalOpen && (
                <ConfirmModal
                    isOpen={archiveModalOpen}
                    onClose={() => setArchiveModalOpen(false)}
                    onConfirm={handleConfirmArchive}
                    title="Archive Incident Report"
                    message={`Are you sure you want to archive this report? It will be removed from all active views but remain in the archives.`}
                    confirmText="Confirm Archive"
                    confirmVariant="danger"
                />
            )}
        </>
    );
};

export default ControllerReportDetail;
