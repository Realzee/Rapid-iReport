import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Announcement, AnnouncementType } from '../types';
import { XIcon, MegaphoneIcon, AlertTriangleIcon, LightbulbIcon } from './icons';

interface AnnouncementsBannerProps {
    onVisibilityChange: (isVisible: boolean) => void;
}

const typeStyles = {
    [AnnouncementType.ALERT]: {
        bg: 'bg-red-500/10 dark:bg-red-500/20',
        border: 'border-red-500/30',
        icon: <AlertTriangleIcon className="w-6 h-6 text-red-500" />,
        iconBg: 'bg-red-500/10'
    },
    [AnnouncementType.NOTICE]: {
        bg: 'bg-blue-500/10 dark:bg-blue-500/20',
        border: 'border-blue-500/30',
        icon: <MegaphoneIcon className="w-6 h-6 text-blue-500" />,
        iconBg: 'bg-blue-500/10'
    },
    [AnnouncementType.SAFETY_TIP]: {
        bg: 'bg-yellow-500/10 dark:bg-yellow-500/20',
        border: 'border-yellow-500/30',
        icon: <LightbulbIcon className="w-6 h-6 text-yellow-500" />,
        iconBg: 'bg-yellow-500/10'
    },
};

const AnnouncementsBanner: React.FC<AnnouncementsBannerProps> = ({ onVisibilityChange }) => {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const fetchAnnouncement = async () => {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .or('expires_at.is.null,expires_at.gt.now()')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            
            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
                console.error("Error fetching announcement:", error);
            } else if (data) {
                const dismissed = localStorage.getItem(`announcement_dismissed_${data.id}`);
                if (!dismissed) {
                    setAnnouncement(data);
                    setIsVisible(true);
                }
            }
        };
        fetchAnnouncement();
    }, []);
    
    useEffect(() => {
        onVisibilityChange(isVisible);
    }, [isVisible, onVisibilityChange]);

    const handleDismiss = () => {
        if (announcement) {
            localStorage.setItem(`announcement_dismissed_${announcement.id}`, 'true');
        }
        setIsVisible(false);
    };

    if (!isVisible || !announcement) {
        return null;
    }
    
    const styles = typeStyles[announcement.type] || typeStyles[AnnouncementType.NOTICE];

    return (
        <div className={`fixed top-20 left-0 right-0 z-40 p-4 h-24 transition-transform duration-300 ${styles.bg} border-b ${styles.border} print:hidden flex items-center`}>
            <div className="container mx-auto flex items-center gap-4">
                {announcement.image_url && (
                    <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-gray-200 dark:bg-gray-700">
                        <img src={announcement.image_url} alt={announcement.title} className="w-full h-full object-cover" />
                    </div>
                )}
                {!announcement.image_url && (
                     <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${styles.iconBg}`}>
                        {styles.icon}
                    </div>
                )}
                <div className="flex-grow">
                    <h4 className="font-bold text-gray-900 dark:text-white">{announcement.title}</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{announcement.content}</p>
                </div>
                <button onClick={handleDismiss} className="flex-shrink-0 p-1.5 rounded-full text-gray-500 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                    <XIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default AnnouncementsBanner;