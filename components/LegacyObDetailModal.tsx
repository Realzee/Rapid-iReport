import React from 'react';
import { LegacyObEntry } from '../types';
import { XIcon, DatabaseIcon } from './icons';

interface LegacyObDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: LegacyObEntry | null;
}

const DetailRow: React.FC<{ label: string; value?: string | React.ReactNode; isMono?: boolean }> = ({ label, value, isMono = false }) => (
    <>
        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
        <dd className={`text-sm text-gray-900 dark:text-white ${isMono ? 'font-mono' : ''}`}>{value || 'N/A'}</dd>
    </>
);

const LegacyObDetailModal: React.FC<LegacyObDetailModalProps> = ({ isOpen, onClose, entry }) => {
    if (!isOpen || !entry) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors z-10">
                    <XIcon className="w-6 h-6" />
                </button>
                
                <div className="flex items-center gap-3 mb-4">
                    <DatabaseIcon className="w-6 h-6 text-blue-500"/>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Legacy OB Log Entry</h3>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-6">
                    {/* Incident Info */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">Incident Info</h4>
                        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-3 items-center">
                            <DetailRow label="OB Number" value={entry.obNumber} isMono />
                            <DetailRow label="Case Number" value={entry.caseNumber} isMono />
                            <DetailRow label="Date of Incident" value={entry.dateOfIncident} />
                            <DetailRow label="Station Reported At" value={entry.stationReportedAt} />
                            <DetailRow label="Timestamp" value={entry.timestamp} />
                        </dl>
                    </div>

                    {/* Vehicle Info */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">Vehicle Info</h4>
                         <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-3 items-center">
                            <DetailRow label="Vehicle Registration" value={entry.vehicleRegistration} isMono />
                            <DetailRow label="Make" value={entry.make} />
                            <DetailRow label="Model" value={entry.model} />
                            <DetailRow label="Color" value={entry.color} />
                        </dl>
                    </div>
                    
                    {/* Case Details */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">Case Details</h4>
                        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-3 items-center">
                            <DetailRow label="Investigating Officer" value={entry.ioName} />
                            <DetailRow label="IO Contact" value={entry.ioContact} />
                        </dl>
                    </div>

                    {/* Status */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">Status</h4>
                        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-3 items-center">
                             <DetailRow label="Recovered" value={typeof entry.recovered === 'boolean' ? (entry.recovered ? 'Yes' : 'No') : entry.recovered} />
                             <DetailRow label="Tracker" value={typeof entry.tracker === 'boolean' ? (entry.tracker ? 'Yes' : 'No') : entry.tracker} />
                        </dl>
                    </div>

                    {/* Client Info */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">Client Info</h4>
                        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-3 items-center">
                            <DetailRow label="COS Name" value={entry.cosName} />
                            <DetailRow label="COS Contact" value={entry.cosContact} />
                        </dl>
                    </div>

                    {/* Full Details */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">Full Details</h4>
                        <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 mt-2">{entry.details || 'N/A'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LegacyObDetailModal;