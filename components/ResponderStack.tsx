import React, { useMemo } from 'react';
import { Report, Responder, ResponderStatus } from '../types';
import { PhoneIcon, ClockIcon } from './icons';

const ResponderStatusBadge: React.FC<{ status: ResponderStatus }> = ({ status }) => {
    const styles: Record<ResponderStatus, { dot: string, text: string }> = {
        [ResponderStatus.AVAILABLE]: { dot: 'bg-green-500', text: 'text-green-700 dark:text-green-300' },
        [ResponderStatus.EN_ROUTE]: { dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' },
        [ResponderStatus.ON_SCENE]: { dot: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-300' },
        [ResponderStatus.OFF_DUTY]: { dot: 'bg-gray-500', text: 'text-gray-600 dark:text-gray-400' },
    };
    const style = styles[status] || styles.off_duty;
    return (
        <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`}></div>
            <span className={`text-sm font-semibold capitalize ${style.text}`}>{status.replace(/_/g, ' ')}</span>
        </div>
    );
};

interface ResponderCardProps {
    responder: Responder;
    assignedReport?: Report;
    selectedReportId?: string | null;
    selectedResponderId?: string | null;
    onAssign?: (responderId: string) => void;
    onResponderSelect?: (responderId: string) => void;
}
const ResponderCard: React.FC<ResponderCardProps> = ({ responder, assignedReport, selectedReportId, onAssign }) => {
    const canAssign = selectedReportId && !assignedReport && responder.status === ResponderStatus.AVAILABLE;

    return (
        <div className={`p-4 rounded-lg bg-white/50 dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/60 border shadow-sm transition-all ${canAssign ? 'border-blue-300 dark:border-blue-700 ring-1 ring-blue-500/20' : 'border-gray-200 dark:border-gray-700/50'}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <img src={`https://i.pravatar.cc/40?u=${responder.id}`} alt="avatar" className="w-10 h-10 rounded-full" />
                    <div className="flex flex-col">
                        <p className="font-bold text-gray-900 dark:text-white leading-tight">{responder.first_name} {responder.surname}</p>
                        <ResponderStatusBadge status={responder.status} />
                    </div>
                </div>
            </div>

            <div className="mt-4">
                <p className="text-xs font-bold text-gray-400 uppercase">Assignment</p>
                {assignedReport ? (
                    <p className="font-mono text-sm text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/20 px-2 py-1 rounded-md mt-1 truncate">
                        {assignedReport.ob_number}
                    </p>
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
                        {responder.status === ResponderStatus.AVAILABLE ? 'On Standby' : '—'}
                    </p>
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50 flex items-center justify-between gap-2">
                <div className="flex gap-2">
                    <button className="p-1.5 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700 transition" title="Contact Responder">
                        <PhoneIcon className="w-4 h-4" />
                    </button>
                    <button disabled className="p-1.5 text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700/50 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed" title="View Log">
                        <ClockIcon className="w-4 h-4" />
                    </button>
                </div>
                
                {canAssign && (
                    <button 
                        onClick={() => onAssign?.(responder.id)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition shadow-sm"
                    >
                        Assign to Incident
                    </button>
                )}
            </div>
        </div>
    );
};

interface ResponderStackProps {
    responders: Responder[];
    reports: Report[];
    selectedReportId?: string | null;
    selectedResponderId?: string | null;
    onAssign?: (responderId: string) => void;
    onResponderSelect?: (responderId: string) => void;
}
const ResponderStack: React.FC<ResponderStackProps> = ({ responders, reports, selectedReportId, selectedResponderId, onAssign, onResponderSelect }) => {
    const onDutyResponders = responders.filter(r => r.status !== ResponderStatus.OFF_DUTY);
    const availableResponders = onDutyResponders.filter(r => r.status === ResponderStatus.AVAILABLE).length;

    const assignmentMap = useMemo(() => {
        const map = new Map<string, Report>();
        reports.forEach(report => {
            if (report.assigned_to) {
                map.set(report.assigned_to, report);
            }
        });
        return map;
    }, [reports]);
    
    const sortedResponders = useMemo(() => {
        const statusOrder: Record<ResponderStatus, number> = {
            [ResponderStatus.AVAILABLE]: 1,
            [ResponderStatus.EN_ROUTE]: 2,
            [ResponderStatus.ON_SCENE]: 3,
            [ResponderStatus.OFF_DUTY]: 4,
        };
        return [...responders].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    }, [responders]);

    return (
        <>
            <div className="flex-shrink-0 mb-4 text-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Responder Units</h3>
                 <p className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-bold text-green-600 dark:text-green-400">{availableResponders} Available</span>
                    {' / '}
                    <span>{onDutyResponders.length} On Duty</span>
                </p>
            </div>
            <div className="space-y-3">
                {sortedResponders.map(responder => (
                    <ResponderCard
                        key={responder.id}
                        responder={responder}
                        assignedReport={assignmentMap.get(responder.id)}
                        selectedReportId={selectedReportId}
                        selectedResponderId={selectedResponderId}
                        onAssign={onAssign}
                        onResponderSelect={onResponderSelect}
                    />
                ))}
            </div>
        </>
    );
};

export default ResponderStack;