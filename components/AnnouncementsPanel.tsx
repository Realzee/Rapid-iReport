import React from 'react';
import { Announcement, AnnouncementType } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { MegaphoneIcon, AlertTriangleIcon, LightbulbIcon } from './icons';

interface AnnouncementsPanelProps {
    announcements: Announcement[];
}

const AnnouncementIcon: React.FC<{ type: AnnouncementType }> = ({ type }) => {
    switch (type) {
        case AnnouncementType.ALERT:
            return <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0"><AlertTriangleIcon className="w-5 h-5 text-red-500" /></div>;
        case AnnouncementType.NOTICE:
            return <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0"><MegaphoneIcon className="w-5 h-5 text-blue-500" /></div>;
        case AnnouncementType.SAFETY_TIP:
            return <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0"><LightbulbIcon className="w-5 h-5 text-yellow-500" /></div>;
        default:
            return <div className="w-8 h-8 rounded-full bg-gray-500/10 flex items-center justify-center flex-shrink-0"><MegaphoneIcon className="w-5 h-5 text-gray-500" /></div>;
    }
};


const AnnouncementsPanel: React.FC<AnnouncementsPanelProps> = ({ announcements }) => {
    return (
        <div className="p-1">
            <h2 className="font-bold text-2xl mb-6 text-gray-950 dark:text-white tracking-tight">Community Notices</h2>
            {announcements.length === 0 ? (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">No active community notices at this time.</p>
            ) : (
                <div className="space-y-4">
                    {announcements.map(announcement => (
                        <div 
                            key={announcement.id} 
                            className="flex items-start gap-4 p-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/40 hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200 shadow-sm"
                        >
                            <AnnouncementIcon type={announcement.type} />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-base text-gray-900 dark:text-gray-100">{announcement.title}</p>
                                <p className="text-sm text-gray-650 dark:text-gray-300 mt-1.5 leading-relaxed">{announcement.content}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                                    {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AnnouncementsPanel;
