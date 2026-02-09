import React from 'react';
import { LegacyObEntry } from '../types';
import { XIcon, DatabaseIcon } from './icons';

interface LegacyObDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: LegacyObEntry | null;
}

const DetailItem: React.FC<{ label: string; value?: string | React.ReactNode }> = ({ label, value }) => (
    <div>
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <div className="text-gray-800 dark:text-gray-200">{value || 'N/A'}</div>
    </div>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DetailItem label="OB Number" value={<p className="font-mono text-lg">{entry.obNumber}</p>} />
                            <DetailItem label="Case Number" value={entry.caseNumber} />
                            <DetailItem label="Date of Incident" value={entry.dateOfIncident} />
                            <DetailItem label="Station Reported At" value={entry.stationReportedAt} />
                             <DetailItem label="Timestamp" value={entry.timestamp} />
                        </div>
                    </div>

                    {/* Vehicle Info */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">Vehicle Info</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DetailItem label="Vehicle Registration" value={<p className="font-mono">{entry.vehicleRegistration}</p>} />
                            <DetailItem label="Make" value={entry.make} />
                            <DetailItem label="Model" value={entry.model} />
                            <DetailItem label="Color" value={entry.color} />
                        </div>
                    </div>
                    
                    {/* Case Details */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">Case Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DetailItem label="Investigating Officer" value={entry.ioName} />
                            <DetailItem label="IO Contact" value={entry.ioContact} />
                        </div>
                        <div className="mt-4">
                            <DetailItem label="Details" value={<p className="whitespace-pre-wrap">{entry.details}</p>} />
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">Status</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DetailItem label="Recovered" value={typeof entry.recovered === 'boolean' ? (entry.recovered ? 'Yes' : 'No') : entry.recovered} />
                            <DetailItem label="Tracker" value={typeof entry.tracker === 'boolean' ? (entry.tracker ? 'Yes' : 'No') : entry.tracker} />
                        </div>
                    </div>

                    {/* Client Info */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">Client Info</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DetailItem label="COS Name" value={entry.cosName} />
                            <DetailItem label="COS Contact" value={entry.cosContact} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LegacyObDetailModal;