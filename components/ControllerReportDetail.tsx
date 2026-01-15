import React, { useState, useEffect, useRef } from 'react';
import { Report, Profile, VehicleReport, ReportStatus, Responder, ReportUpdate, ResponderStatus } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '../utils/supabase';
import { CheckCircleIcon, AssignResponderIcon } from './icons';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const ControllerReportDetail: React.FC<{ report: Report; responders: Responder[]; profile: Profile }> = ({ report, responders, profile }) => {
    const [updates, setUpdates] = useState<ReportUpdate[]>([]);
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

        const fetchUpdates = async () => {
            const { data: updatesData, error: updatesError } = await supabase
                .from('report_updates')
                .select('*')
                .eq('report_id', report.id)
                .order('created_at', { ascending: true });

            if (updatesError) {
                console.error("Error fetching report updates:", updatesError);
                setUpdates([]);
                return;
            }

            if (updatesData) {
                const updatesWithNames = await Promise.all(
                    updatesData.map(async (update) => {
                        const { data: profileData } = await supabase
                            .from('profiles')
                            .select('full_name')
                            .eq('id', update.user_id)
                            .single();
                        return {
                            ...update,
                            user_full_name: profileData?.full_name || 'System'
                        };
                    })
                );
                setUpdates(updatesWithNames as ReportUpdate[]);
            }
        };
        fetchUpdates();

        const updatesChannel = supabase
            .channel(`report-updates-${report.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'report_updates', filter: `report_id=eq.${report.id}`}, 
            async (payload) => {
                const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', payload.new.user_id).single();
                const newUpdateWithUser = { ...payload.new, user_full_name: profileData?.full_name || 'System' };
                setUpdates(prev => [...prev, newUpdateWithUser as ReportUpdate]);
            })
            .subscribe();
        
        return () => { supabase.removeChannel(updatesChannel); };
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
        const { error } = await supabase.from(tableName).update({ 
            assigned_to: responderId || null,
            status: responderId ? ReportStatus.ASSIGNED : ReportStatus.PENDING
        }).eq('id', report.id);

        if (error) alert("Failed to dispatch responder: " + error.message);
    };
    
    const availableResponders = responders.filter(r => r.status === ResponderStatus.AVAILABLE);
    const statusOptions = [ReportStatus.PENDING, ReportStatus.ASSIGNED, ReportStatus.ON_SCENE, ReportStatus.RESOLVED, ReportStatus.CLOSED];

    return (
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl h-full flex flex-col text-white backdrop-blur-lg">
            <div className="p-4 border-b border-gray-700/50 flex-shrink-0">
                <h3 className="text-lg font-bold">Report Details: {report.ob_number}</h3>
                <p className="text-sm text-gray-400">
                    {isVehicleReport(report) ? 'Stolen Vehicle' : report.title} - {format(new Date(report.reported_at), 'MM/dd/yyyy, hh:mm a')}
                </p>
            </div>

            <div className="p-4 flex-grow overflow-y-auto">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Live Feed</h4>
                <div className="space-y-3 h-48 overflow-y-auto bg-black/30 rounded p-2 border border-gray-700/50">
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
            </div>

            <form onSubmit={handleUpdateSubmit} className="p-4 flex-shrink-0">
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

            <div className="p-4 border-t border-gray-700/50 space-y-4 flex-shrink-0">
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
                            {availableResponders.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
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