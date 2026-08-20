
import React, { useState, useEffect } from 'react';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import ThemeToggle from '../components/ThemeToggle';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../utils/supabase';
import { Company } from '../types';

interface AuthPageProps {
    onViewAbout: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onViewAbout }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [companies, setCompanies] = useState<Company[]>([]);
    const { mainLogoUrl, defaultLogoUrl } = useSettings();

    useEffect(() => {
        const fetchCompanies = async () => {
            if (!supabase) return;
            const { data, error } = await supabase.from('companies').select('*').order('name');
            if (error) {
                console.error('Error fetching companies:', error);
            } else {
                setCompanies(data || []);
            }
        };
        fetchCompanies();
    }, []);

    return (
        <div className="min-h-screen flex flex-col relative bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
            {/* Theme Toggle Selector on Login/Register Page */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50">
                <ThemeToggle />
            </div>

            {/* Professional Ambient Glow Elements */}
            <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-600/15 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-green-500/10 dark:bg-green-600/15 rounded-full blur-[100px] pointer-events-none" />
            
            {/* Subtle High-Tech Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b9810a_1px,transparent_1px),linear-gradient(to_bottom,#10b9810a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_80%,transparent_100%)] pointer-events-none" />

            <main className="flex-grow flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 z-10">
                <div className="mb-8 text-center">
                   <img 
                       src={mainLogoUrl} 
                       alt="Vigilix Logo" 
                       className="w-auto h-64 sm:h-80 max-w-[340px] sm:max-w-md mx-auto transition-all duration-500 hover:scale-[1.03] drop-shadow-2xl filter dark:drop-shadow-[0_15px_25px_rgba(0,255,102,0.2)]" 
                       onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} 
                   />
                   <h2 className="mt-4 text-sm sm:text-base font-extrabold tracking-widest uppercase text-emerald-600 dark:text-emerald-400 font-mono">
                       SECURITY • TECHNOLOGY • SPEED
                   </h2>
                </div>

                <div className="w-full max-w-md p-8 bg-white/80 dark:bg-gray-950/70 backdrop-blur-3xl border border-emerald-500/20 dark:border-emerald-500/30 rounded-3xl shadow-2xl transition-all duration-300 dark:ring-1 dark:ring-emerald-500/20">
                    {isLoginView ? (
                        <LoginForm 
                            onSwitchToRegister={() => setIsLoginView(false)} 
                        />
                    ) : (
                        <RegisterForm 
                            onSwitchToLogin={() => setIsLoginView(true)} 
                            companies={companies}
                        />
                    )}
                </div>
            </main>
            <footer className="text-center py-6 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2 z-10 border-t border-slate-200/50 dark:border-slate-800/30 bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-md">
                <img src={mainLogoUrl} alt="Vigilix Mini Logo" className="w-auto h-4 opacity-80" onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} />
                <span>Copyright &copy; {new Date().getFullYear()} Vigilix Security Monitoring System (Pty) Ltd</span>
            </footer>
        </div>
    );
};

export default AuthPage;