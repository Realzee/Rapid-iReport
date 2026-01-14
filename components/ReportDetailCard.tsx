
import React, { useState, useEffect } from 'react';
import { Report, Profile, VehicleReport, UserRole, ReportStatus, Responder, ResponderStatus } from '../types';
import StatusBadge from './StatusBadge';
// FIX: Import the missing CheckCircleIcon component.
import { MapPinIcon, XIcon, CheckCircleIcon } from './icons';
import { format } from 'date-fns';
import { supabase } from '../utils/supabase';

interface ReportDetailCardProps {
    report: Report;
    onClose: () => void;
    profile: Profile;
    responders: Responder[];
    onEdit: (report: Report) => void;
    onDelete: (report: Report) => void;
    onViewOnMap: () => void;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const ReportDetailCard: React.FC<ReportDetailCardProps> = ({ report, onClose, profile, responders, onEdit, onDelete, onViewOnMap }) => {
    const [reporter, setReporter] = useState<Profile | null>(null);
    const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
    const [selectedResponder, setSelectedResponder] = useState<string>('');
    const [updateMessage, setUpdateMessage] = useState('');

    useEffect(() => {
        const fetchReporter = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', report.reported_by)
                .single();
            if (error) console.error("Error fetching reporter:", error);
            else setReporter(data);
        };
        fetchReporter();
        setSelectedResponder(report.assigned_to || '');
    }, [report]);

    const handleStatusUpdate = async (newStatus: ReportStatus) => {
        setStatusUpdateLoading(true);
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        const { error } = await supabase
            .from(tableName)
            .update({ status: newStatus })
            .eq('id', report.id);

        if (error) {
            alert('Failed to update status: ' + error.message);
        }
        setStatusUpdateLoading(false);
    };
    
    const handleResponderDispatch = async () => {
        if (!selectedResponder) return;

        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        const { error } = await supabase
            .from(tableName)
            .update({ assigned_to: selectedResponder, status: ReportStatus.ACTIVE })
            .eq('id', report.id);
        
        if (error) {
            alert('Failed to dispatch responder: ' + error.message);
        } else {
            alert('Responder dispatched successfully!');
        }
    };
    
    const availableResponders = responders.filter(r => r.status === ResponderStatus.AVAILABLE);

    return (
        <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl backdrop-blur-lg shadow-lg flex flex-col h-full overflow-hidden">
            <header className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-2">Report Details: {report.ob_number}</h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{isVehicleReport(report) ? 'Stolen Vehicle' : report.title} - {format(new Date(report.reported_at), 'MM/dd/yyyy, HH:mm:ss')}</p>
            </header>

            <main className="flex-grow p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Severity</p>
                        <p className="font-semibold text-gray-900 dark:text-white capitalize">{report.severity}</p>
                    </div>
                     <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Status</p>
                         <StatusBadge status={report.status} />
                    </div>
                </div>

                <div>
                     <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">{isVehicleReport(report) ? 'Last Seen Location' : 'Location'}</p>
                     <p className="text-gray-900 dark:text-white flex items-center gap-2 text-sm"><MapPinIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"/> {isVehicleReport(report) ? report.last_seen_location : report.location}</p>
                </div>

                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Description</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{report.description}</p>
                </div>
                
                 {isVehicleReport(report) && (
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Vehicle Details</p>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="bg-gray-200 dark:bg-gray-700 font-mono px-3 py-1 rounded-md text-sm font-bold">{report.license_plate}</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{report.vehicle_color} {report.vehicle_make} {report.vehicle_model}</span>
                        </div>
                    </div>
                )}
                
                 {reporter && (
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Reported By</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{reporter.full_name}</p>
                    </div>
                 )}
                 
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-2">Live Feed</p>
                    <div className="h-24 bg-gray-100 dark:bg-gray-800/50 rounded-md p-2 text-center text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center">
                        No updates for this incident yet.
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        <input
                            type="text"
                            value={updateMessage}
                            onChange={(e) => setUpdateMessage(e.target.value)}
                            placeholder="Type an update..."
                            className="flex-grow bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </div>
                </div>
            </main>

            <footer className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
                <div>
                     <label htmlFor="update-status" className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">Update Status</label>
                     <div className="flex items-center gap-2">
                         <select
                            id="update-status"
                            value={report.status}
                            onChange={(e) => handleStatusUpdate(e.target.value as ReportStatus)}
                            disabled={statusUpdateLoading}
                            className="w-full bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-70"
                        >
                            {Object.values(ReportStatus).map(s => <option key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</option>)}
                        </select>
                        <button onClick={() => handleStatusUpdate(report.status)} disabled={statusUpdateLoading} className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                             {statusUpdateLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CheckCircleIcon className="w-5 h-5"/>}
                        </button>
                     </div>
                </div>
                 <div>
                     <label htmlFor="dispatch-responder" className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">Dispatch Responder</label>
                     <div className="flex items-center gap-2">
                        <select 
                            id="dispatch-responder"
                            value={selectedResponder}
                            onChange={(e) => setSelectedResponder(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        >
                            <option value="">{availableResponders.length > 0 ? 'Select a responder...' : 'No responders available'}</option>
                            {availableResponders.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                        </select>
                        <button onClick={handleResponderDispatch} disabled={!selectedResponder} className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ReportDetailCard;
