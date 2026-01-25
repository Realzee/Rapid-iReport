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
        <div className="p-4 border-t border-gray-200 dark:border-gray-700/50">
            <h2 className="font-bold text-lg mb-4">Community Notices</h2>
            {announcements.length === 0 ? (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">No active community notices at this time.</p>
            ) : (
                <div className="space-y-4">
                    {announcements.map(announcement => (
                        <div key={announcement.id} className="flex items-start gap-4">
                            <AnnouncementIcon type={announcement.type} />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{announcement.title}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{announcement.content}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
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
