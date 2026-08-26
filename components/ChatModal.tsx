import React, { useMemo } from 'react';
import { Report, Profile } from '../types';
import { XIcon, ChevronDownIcon } from './icons';
import IncidentChat from './IncidentChat';
import { useChat } from '../contexts/ChatContext';

const ChatWidget: React.FC<{
    report: Report;
    profile: Profile;
    allUsers: Profile[];
    onClose: () => void;
    onMinimize: () => void;
}> = ({ report, profile, allUsers, onClose, onMinimize }) => {
    const reportTitle = report.type === 'vehicle' ? (report as any).license_plate : report.title;

    return (
        <div className="bg-white dark:bg-gray-900 border-t-2 border-blue-500 rounded-t-2xl shadow-2xl w-full max-w-md h-[70vh] flex flex-col transform transition-transform duration-300 ease-out">
            <header className="flex-shrink-0 p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700/50">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{reportTitle}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {report.type === 'roadside' ? `Card No: ${(report as any).card_number || report.ob_number}` : report.ob_number}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onMinimize} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white transition-colors" title="Minimize">
                        <ChevronDownIcon className="w-6 h-6" />
                    </button>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white transition-colors" title="Close">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
            </header>
            <div className="flex-grow p-4 overflow-hidden">
                <IncidentChat
                    reportId={report.id}
                    currentUserProfile={profile}
                    allUsers={allUsers}
                />
            </div>
        </div>
    );
};

const ChatHead: React.FC<{
    report: Report;
    unreadCount: number;
    onClick: () => void;
}> = ({ report, unreadCount, onClick }) => {
    const reportTitle = report.type === 'vehicle' ? (report as any).license_plate : report.title;
    return (
        <button 
            onClick={onClick}
            className="relative bg-white dark:bg-gray-800 rounded-t-lg shadow-lg px-4 py-2 flex items-center gap-2 w-56 border-t-2 border-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
            <p className="font-bold text-sm truncate flex-1 text-left text-gray-800 dark:text-gray-100">{reportTitle}</p>
            {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full text-xs flex items-center justify-center text-white font-bold">{unreadCount}</span>
            )}
        </button>
    );
};

const ChatManager: React.FC = () => {
    const { 
        activeChats, 
        expandedChatId, 
        unreadCounts, 
        expandChat, 
        closeChat, 
        minimizeChat, 
        profile, 
        allUsers 
    } = useChat();
    
    const expandedReport = useMemo(() => activeChats.find(c => c.id === expandedChatId), [activeChats, expandedChatId]);

    return (
        <div className="fixed bottom-0 right-4 z-[80] flex items-end gap-3 pointer-events-none">
            {/* Wrapper to allow pointer events on children */}
            <div className="flex items-end gap-3 pointer-events-auto">
                {/* Minimized Chat Heads */}
                {activeChats.filter(c => c.id !== expandedChatId).map(report => (
                    <ChatHead 
                        key={report.id}
                        report={report}
                        unreadCount={unreadCounts[report.id] || 0}
                        onClick={() => expandChat(report.id)}
                    />
                ))}

                {/* Expanded Chat Widget */}
                {expandedReport && profile && (
                    <ChatWidget
                        report={expandedReport}
                        profile={profile}
                        allUsers={allUsers}
                        onClose={() => closeChat(expandedReport.id)}
                        onMinimize={minimizeChat}
                    />
                )}
            </div>
        </div>
    );
};

export default ChatManager;
