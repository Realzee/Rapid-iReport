import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Announcement } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import ThemeToggle from '../components/ThemeToggle';
import { ZapIcon } from '../components/icons';
import AnnouncementsPanel from '../components/AnnouncementsPanel';

const PublicDashboardPage: React.FC<{ onBackToLogin: () => void }> = ({ onBackToLogin }) => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const { mainLogoUrl, defaultLogoUrl } = useSettings();

    const fetchData = async () => {
        if (!supabase) return;
        const { data: announcementsData, error: aError } = await supabase
            .from('announcements')
            .select('*')
            .or('expires_at.is.null,expires_at.gt.now()')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (aError) console.error("Public fetch error (announcements):", aError.message);

        setAnnouncements(announcementsData || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        
        if (!supabase) return;
        const channel = supabase.channel('public-announcements-data')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <header className="flex-shrink-0 bg-white/80 dark:bg-gray-950/70 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800/50 z-20">
                <div className="px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img src={mainLogoUrl} alt="Logo" className="w-auto h-14 object-contain" onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} />
                        <h1 className="text-xl font-bold hidden sm:block">Community Notices</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <button onClick={onBackToLogin} className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors">
                            Operator Login
                        </button>
                    </div>
                </div>
            </header>
            
            <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col justify-start">
                <div className="bg-white/90 dark:bg-gray-950/70 backdrop-blur-lg border border-gray-250/60 dark:border-gray-800/80 rounded-2xl overflow-hidden shadow-lg mt-4 flex flex-col">
                    <div className="p-6 md:p-8 flex-grow">
                        {loading ? (
                            <div className="space-y-4 animate-pulse">
                                <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-6"></div>
                                <div className="h-24 bg-gray-100 dark:bg-gray-900/50 rounded-xl"></div>
                                <div className="h-24 bg-gray-100 dark:bg-gray-900/50 rounded-xl"></div>
                                <div className="h-24 bg-gray-100 dark:bg-gray-900/50 rounded-xl"></div>
                            </div>
                        ) : (
                            <>
                                <AnnouncementsPanel announcements={announcements} />
                                
                                {announcements.length === 0 && (
                                    <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                                        <ZapIcon className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
                                        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No active community notices</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Check back later for any safety announcements or updates.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    
                    <div className="p-4 md:p-6 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-150 dark:border-gray-800/80 text-center">
                        <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed max-w-lg mx-auto">
                            This portal displays official community notices and safety alerts.
                            In case of an active emergency, please contact your local security company or state authorities immediately.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PublicDashboardPage;
