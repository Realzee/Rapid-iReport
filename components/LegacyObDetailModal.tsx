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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors z-10">
                    <XIcon className="w-6 h-6" />
                </button>
                
                <div className="flex items-center gap-3 mb-4">
                    <DatabaseIcon className="w-6 h-6 text-blue-500"/>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Legacy OB Log Entry</h3>
                </div>
                
                <div className="space-y-4">
                    <DetailItem label="OB Number" value={<p className="font-mono text-lg">{entry.obNumber}</p>} />
                    <DetailItem label="Timestamp" value={entry.timestamp} />
                    <DetailItem label="Details" value={<p className="whitespace-pre-wrap">{entry.details}</p>} />
                </div>
            </div>
        </div>
    );
};

export default LegacyObDetailModal;