import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Announcement, AnnouncementType } from '../types';
import { MegaphoneIcon, AlertTriangleIcon, LightbulbIcon, XIcon } from './icons';

interface AnnouncementsBannerProps {
    onVisibilityChange: (isVisible: boolean) => void;
}

const typeStyles = {
    [AnnouncementType.ALERT]: {
        icon: <AlertTriangleIcon className="w-5 h-5 text-red-500" />,
    },
    [AnnouncementType.NOTICE]: {
        icon: <MegaphoneIcon className="w-5 h-5 text-blue-500" />,
    },
    [AnnouncementType.SAFETY_TIP]: {
        icon: <LightbulbIcon className="w-5 h-5 text-yellow-500" />,
    },
};

const AnnouncementCard: React.FC<{ announcement: Announcement }> = ({ announcement }) => {
    const styles = typeStyles[announcement.type] || typeStyles[AnnouncementType.NOTICE];
    return (
        <div className="flex items-center gap-3 bg-white/10 dark:bg-black/20 backdrop-blur-sm rounded-md px-3 py-2 border border-white/10 dark:border-black/20 flex-shrink-0 w-80">
            {announcement.image_url ? (
                <img src={announcement.image_url} alt={announcement.title} className="w-10 h-10 object-cover rounded-md flex-shrink-0" />
            ) : (
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gray-500/10">
                    {styles.icon}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{announcement.title}</p>
                <p className="text-xs opacity-80 truncate">{announcement.content}</p>
            </div>
        </div>
    );
};


const AnnouncementsBanner: React.FC<AnnouncementsBannerProps> = ({ onVisibilityChange }) => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const fetchAnnouncements = async () => {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .or('expires_at.is.null,expires_at.gt.now()')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error("Error fetching announcements:", error);
                setAnnouncements([]);
            } else if (data) {
                setAnnouncements(data);
                setIsDismissed(false); // Re-show banner when new announcements are fetched
            }
        };
        fetchAnnouncements();

        const channel = supabase
            .channel('public:announcements')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements'}, fetchAnnouncements)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);
    
    useEffect(() => {
        onVisibilityChange(announcements.length > 0 && !isDismissed);
    }, [announcements, isDismissed, onVisibilityChange]);

    if (announcements.length === 0 || isDismissed) {
        return null;
    }

    if (isMobile) {
        const latestAnnouncement = announcements[0];
        if (!latestAnnouncement) return null;
        const styles = typeStyles[latestAnnouncement.type] || typeStyles[AnnouncementType.NOTICE];
        
        return (
            <div className="fixed top-16 left-0 right-0 z-40 bg-gray-100/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800/50 text-gray-800 dark:text-gray-200 py-1.5 px-4 print:hidden h-12 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="flex-shrink-0">{styles.icon}</span>
                    <span className="text-xs truncate max-w-[80vw] font-medium text-gray-700 dark:text-gray-300">
                        <strong className="font-extrabold text-gray-900 dark:text-white mr-1">{latestAnnouncement.title}:</strong>
                        <span>{latestAnnouncement.content}</span>
                    </span>
                </div>
                <button
                    onClick={() => setIsDismissed(true)}
                    className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10 transition-colors ml-2 flex-shrink-0"
                    aria-label="Dismiss announcement"
                >
                    <XIcon className="w-4 h-4" />
                </button>
            </div>
        );
    }
    
    // Duplicate for seamless marquee effect, ensure there's enough content to scroll
    const duplicatedAnnouncements = announcements.length > 3 ? [...announcements, ...announcements] : [...announcements, ...announcements, ...announcements, ...announcements];
    const animationDuration = Math.max(40, announcements.length * 15);
    const animationStyle = { animation: `marquee ${animationDuration}s linear infinite` };
    
    return (
        <div className={`fixed top-16 left-0 right-0 z-40 bg-gray-100/50 dark:bg-gray-900/50 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800/50 text-gray-800 dark:text-gray-200 overflow-hidden py-2 print:hidden h-14 flex items-center relative`}>
            <div className={`flex w-max`} style={animationStyle}>
                {duplicatedAnnouncements.map((announcement, index) => (
                    <div key={`${announcement.id}-${index}`} className="mx-2">
                        <AnnouncementCard announcement={announcement} />
                    </div>
                ))}
            </div>
            <button
                onClick={() => setIsDismissed(true)}
                className="absolute top-1/2 right-4 -translate-y-1/2 p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                aria-label="Dismiss announcements"
            >
                <XIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

export default AnnouncementsBanner;