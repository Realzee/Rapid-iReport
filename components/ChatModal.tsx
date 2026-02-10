import React from 'react';
import { Report, Profile, VehicleReport } from '../types';
import { XIcon } from './icons';
import IncidentChat from './IncidentChat';

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: Report | null;
    profile: Profile;
    allUsers: Profile[];
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, report, profile, allUsers }) => {
    if (!isOpen || !report) {
        return null;
    }

    const reportTitle = isVehicleReport(report) ? report.license_plate : report.title;
    
    // Use opacity and transform for smooth enter/exit controlled by the isOpen prop
    const modalContainerClasses = `fixed inset-0 z-[80] flex items-end justify-end bg-black/30 backdrop-blur-sm p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;
    const modalBodyClasses = `relative bg-white dark:bg-gray-900 border-t-2 border-blue-500 rounded-t-2xl shadow-2xl w-full max-w-md h-[70vh] flex flex-col transform transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`;

    return (
        <div 
            className={modalContainerClasses}
            aria-labelledby="chat-modal-title" 
            role="dialog" 
            aria-modal="true"
            onClick={onClose}
        >
            <div 
                className={modalBodyClasses}
                onClick={e => e.stopPropagation()}
            >
                <header className="flex-shrink-0 p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700/50">
                    <div>
                        <h3 id="chat-modal-title" className="text-lg font-bold text-gray-900 dark:text-white truncate">
                            Live Chat: {reportTitle}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{report.ob_number}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>
                <div className="flex-grow p-4 overflow-hidden">
                    <IncidentChat
                        reportId={report.id}
                        currentUserProfile={profile}
                        allUsers={allUsers}
                    />
                </div>
            </div>
        </div>
    );
};

export default ChatModal;