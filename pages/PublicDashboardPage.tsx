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
        
        const channel = supabase.channel('public-data')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <header className="flex-shrink-0 bg-white/85 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800/50 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img 
                            src={mainLogoUrl} 
                            alt="Logo" 
                            className="w-auto h-14 object-contain transition-opacity duration-300" 
                            onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} 
                        />
                        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent hidden sm:block">
                            Community Safety Portal
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <button 
                            onClick={onBackToLogin} 
                            className="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 active:scale-95 transition-all duration-200"
                        >
                            Operator Login
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-grow flex items-center justify-center p-4 sm:p-6 md:p-8">
                <div className="w-full max-w-2xl bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden flex flex-col md:min-h-[500px]">
                    <div className="flex-grow p-6 sm:p-8 flex flex-col">
                        {loading ? (
                            <div className="flex-grow flex flex-col items-center justify-center py-12">
                                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 font-medium">Loading community notices...</p>
                            </div>
                        ) : announcements.length === 0 ? (
                            <div className="flex-grow flex flex-col items-center justify-center text-center py-12 px-4 my-auto">
                                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-6 animate-pulse">
                                    <ZapIcon className="w-8 h-8 text-blue-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-950 dark:text-white">All Systems Clear</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm">
                                    There are currently no active safety notices, alerts, or general announcements in our database.
                                </p>
                            </div>
                        ) : (
                            <div className="flex-grow">
                                <AnnouncementsPanel announcements={announcements} />
                            </div>
                        )}
                    </div>
                    
                    <div className="p-6 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-400/10 text-center">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                            These status bulletins are verified and published by authorized security personnel.
                            <span className="block mt-1 font-semibold text-red-500 dark:text-red-400">
                                In case of active emergencies, please dial and contact your local authorities directly.
                            </span>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PublicDashboardPage;
