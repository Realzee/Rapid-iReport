
import React, { useState, useEffect, useRef } from 'react';
import { Report, Profile, VehicleReport, ReportStatus, Responder, ReportUpdate, ResponderStatus, AssignmentLog } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '../utils/supabase';
import { CheckCircleIcon, AssignResponderIcon } from './icons';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const DetailField = ({ label, children, className }: { label: string, children: React.ReactNode, className?: string }) => (
    <div className={className}>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <div className="mt-1 text-sm text-white">{children}</div>
    </div>
);

const ControllerReportDetail: React.FC<{ report: Report; responders: Responder[]; profile: Profile }> = ({ report, responders, profile }) => {
    const [updates, setUpdates] = useState<ReportUpdate[]>([]);
    const [assignmentHistory, setAssignmentHistory] = useState<AssignmentLog[]>([]);
    const [newUpdate, setNewUpdate] = useState('');
    const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<ReportStatus>(report.status);
    const [selectedResponder, setSelectedResponder] = useState<string>(report.assigned_to || '');

    const updatesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        updatesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        setSelectedStatus(report.status);
        setSelectedResponder(report.assigned_to || '');

        const fetchDetails = async () => {
            // Fetch Updates
            const { data: updatesData, error: updatesError } = await supabase
                .from('report_updates')
                .select('*, profile:profiles(full_name)')
                .eq('report_id', report.id)
                .order('created_at', { ascending: true });

            if (updatesError) console.error("Error fetching report updates:", updatesError);
            else setUpdates(updatesData?.map(u => ({...u, user_full_name: (u.profile as any)?.full_name || 'System'})) || []);

            // Fetch Assignment History
            const { data: historyData, error: historyError } = await supabase
                .from('assignment_logs')
                .select(`*, assigned_from_profile:profiles!assignment_logs_assigned_from_fkey(full_name), assigned_to_profile:profiles!assignment_logs_assigned_to_fkey(full_name), assigned_by_profile:profiles!assignment_logs_assigned_by_fkey(full_name)`)
                .eq('report_id', report.id)
                .order('created_at', { ascending: false });

            if (historyError) {
                 console.error("Error fetching assignment history:", historyError);
            } else if (historyData) {
                const formattedHistory = historyData.map((log: any) => ({
                    ...log,
                    assigned_from_name: log.assigned_from_profile?.full_name || null,
                    assigned_to_name: log.assigned_to_profile?.full_name || null,
                    assigned_by_name: log.assigned_by_profile?.full_name || 'System',
                }));
                setAssignmentHistory(formattedHistory);
            }
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
                // Refetch history on change
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
    }, [report.id, report.status, report.assigned_to]);
    
    useEffect(() => {
        scrollToBottom();
    }, [updates]);

    const handleUpdateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUpdate.trim()) return;

        setIsSubmittingUpdate(true);
        const { error } = await supabase.from('report_updates').insert({
            report_id: report.id,
            user_id: profile.id,
            content: newUpdate,
        });

        if (error) {
            alert('Failed to post update: ' + error.message);
        } else {
            setNewUpdate('');
        }
        setIsSubmittingUpdate(false);
    };

    const handleStatusUpdate = async (newStatus: ReportStatus) => {
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        const { error } = await supabase.from(tableName).update({ status: newStatus }).eq('id', report.id);
        if (error) alert("Failed to update status: " + error.message);
    };

    const handleDispatchResponder = async (responderId: string) => {
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        const oldResponderId = report.assigned_to;
    
        // 1. Update the report itself (the primary action)
        const { error: reportUpdateError } = await supabase.from(tableName).update({ 
            assigned_to: responderId || null,
            status: responderId ? ReportStatus.ASSIGNED : ReportStatus.PENDING
        }).eq('id', report.id);
    
        if (reportUpdateError) {
            alert("Failed to dispatch responder: " + reportUpdateError.message);
            return; // Stop if the primary action fails
        }
    
        // 2. Update responder statuses in the background
        const responderStatusUpdates = [];
    
        // If a responder was unassigned (and not immediately reassigned), set them back to available.
        if (oldResponderId && oldResponderId !== responderId) {
            responderStatusUpdates.push(
                supabase.from('profiles').update({ responder_status: ResponderStatus.AVAILABLE }).eq('id', oldResponderId)
            );
        }
        
        // If a new responder was assigned, set them to en_route.
        if (responderId && oldResponderId !== responderId) {
            responderStatusUpdates.push(
                supabase.from('profiles').update({ responder_status: ResponderStatus.EN_ROUTE }).eq('id', responderId)
            );
        }
    
        if (responderStatusUpdates.length > 0) {
            // We don't need to wait for these, but we should log if they fail.
            Promise.all(responderStatusUpdates).then(results => {
                const updateError = results.find(res => res.error);
                if (updateError) {
                    console.warn("Report was dispatched, but failed to update a responder's status:", updateError.error.message);
                }
            });
        }
    };
    
    const availableResponders = responders.filter(
        r => r.status === ResponderStatus.AVAILABLE
    );

    const currentlyAssignedResponder = report.assigned_to
        ? responders.find(r => r.id === report.assigned_to)
        : undefined;

    // The list of options should include all available responders.
    // If a responder is already assigned to this report, they must also be in the list
    // so the controller can see who is assigned, even if they aren't 'available'.
    const responderOptions = [...availableResponders];
    if (currentlyAssignedResponder && !availableResponders.some(r => r.id === currentlyAssignedResponder.id)) {
        responderOptions.push(currentlyAssignedResponder);
    }

    const statusOptions = [ReportStatus.PENDING, ReportStatus.ASSIGNED, ReportStatus.ON_SCENE, ReportStatus.RESOLVED, ReportStatus.CLOSED];

    return (
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl h-full flex flex-col text-white backdrop-blur-lg">
            <div className="p-4 border-b border-gray-700/50 flex-shrink-0">
                <h3 className="text-lg font-bold">Report Details: {report.ob_number}</h3>
                <p className="text-sm text-gray-400">
                    {isVehicleReport(report) ? 'Stolen Vehicle' : report.title} - {format(new Date(report.reported_at), 'MM/dd/yyyy, hh:mm a')}
                </p>
            </div>

            <div className="p-4 flex-grow overflow-y-auto space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <DetailField label="Severity">
                        <p className="font-semibold text-md capitalize">{report.severity}</p>
                    </DetailField>
                    <DetailField label="Status">
                        <span className="px-3 py-1 text-xs font-bold rounded-full capitalize border bg-gray-700 border-gray-600 text-gray-200">
                            {report.status.replace('_', ' ')}
                        </span>
                    </DetailField>
                </div>
                
                <DetailField label="Description">
                    <p>{report.description}</p>
                </DetailField>
                
                {isVehicleReport(report) && (
                    <DetailField label="Vehicle Details">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs">{report.license_plate}</span>
                            <span>{report.vehicle_color} {report.vehicle_make} {report.vehicle_model}</span>
                        </div>
                    </DetailField>
                )}

                 <DetailField label="Assignment History">
                    <div className="space-y-3 h-24 overflow-y-auto bg-black/30 rounded p-2 border border-gray-700/50">
                        {assignmentHistory.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                               <p className="text-sm text-gray-500">No assignment history.</p>
                            </div>
                        ) : (
                            assignmentHistory.map(log => (
                                <div key={log.id} className="text-xs">
                                    <p className="text-gray-300">
                                        <strong>{log.assigned_by_name}</strong>
                                        {log.assigned_to_name ? ` assigned ` : ` unassigned `}
                                        <strong>{log.assigned_to_name || log.assigned_from_name}</strong>.
                                    </p>
                                    <p className="text-gray-500 text-right">
                                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </DetailField>
                
                <DetailField label="Live Feed">
                    <div className="space-y-3 h-32 overflow-y-auto bg-black/30 rounded p-2 border border-gray-700/50">
                        {updates.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                               <p className="text-sm text-gray-500">No updates for this incident yet.</p>
                            </div>
                        ) : (
                            updates.map(update => (
                                <div key={update.id}>
                                    <p className="text-sm text-gray-200">{update.content}</p>
                                    <p className="text-xs text-gray-500 text-right">
                                        - {update.user_full_name} ({formatDistanceToNow(new Date(update.created_at), { addSuffix: true })})
                                    </p>
                                </div>
                            ))
                        )}
                        <div ref={updatesEndRef} />
                    </div>
                </DetailField>
            </div>

            <div className="p-4 border-t border-gray-700/50 space-y-4 flex-shrink-0">
                <form onSubmit={handleUpdateSubmit} className="flex-shrink-0">
                     <div className="relative">
                        <textarea
                            value={newUpdate}
                            onChange={(e) => setNewUpdate(e.target.value)}
                            placeholder="Type an update..."
                            rows={2}
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg py-2 pl-3 pr-10 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                        />
                        <button type="submit" disabled={isSubmittingUpdate} className="absolute top-2 right-2 p-2 text-blue-400 hover:text-blue-300 disabled:opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                        </button>
                    </div>
                </form>

                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Update Status</label>
                     <div className="flex items-center gap-2">
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value as ReportStatus)}
                            className="flex-grow bg-gray-800 border border-gray-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 capitalize"
                        >
                            {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                         <button onClick={() => handleStatusUpdate(selectedStatus)} className="p-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                            <CheckCircleIcon className="w-5 h-5 text-gray-300" />
                        </button>
                    </div>
                </div>
                 <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Dispatch Responder</label>
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedResponder}
                            onChange={(e) => setSelectedResponder(e.target.value)}
                            className="flex-grow bg-gray-800 border border-gray-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="">{report.assigned_to ? 'Unassign' : (availableResponders.length > 0 ? 'Select Responder...' : 'No responders available')}</option>
                            {responderOptions.map(r => (
                                <option key={r.id} value={r.id}>
                                    {r.full_name}
                                    {r.status !== ResponderStatus.AVAILABLE ? ` (${r.status.replace(/_/g, ' ')})` : ''}
                                </option>
                            ))}
                        </select>
                        <button onClick={() => handleDispatchResponder(selectedResponder)} className="p-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                            <AssignResponderIcon className="w-5 h-5 text-gray-300" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ControllerReportDetail;
    