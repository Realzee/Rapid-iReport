
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
            <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 dark:bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
            
            {/* Subtle High-Tech Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_80%,transparent_100%)] pointer-events-none" />

            <main className="flex-grow flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 z-10">
                <div className="mb-8 text-center">
                   <img 
                       src={mainLogoUrl} 
                       alt="Rapid911 Logo" 
                       className="w-auto h-64 sm:h-80 max-w-[340px] sm:max-w-md mx-auto transition-all duration-500 hover:scale-[1.03] drop-shadow-2xl filter dark:drop-shadow-[0_15px_25px_rgba(0,0,0,0.7)]" 
                       onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} 
                   />
                   <h2 className="mt-6 text-lg font-extrabold tracking-wider uppercase text-slate-500 dark:text-slate-400 sm:text-xl">
                       Designed For Global Professionals
                   </h2>
                </div>

                <div className="w-full max-w-md p-8 bg-white/75 dark:bg-gray-950/60 backdrop-blur-3xl border border-gray-200 dark:border-gray-800/80 rounded-3xl shadow-2xl transition-all duration-300 dark:ring-1 dark:ring-white/5">
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
                <img src={mainLogoUrl} alt="Rapid911 Mini Logo" className="w-auto h-4 opacity-80" onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} />
                <span>Copyright &copy; {new Date().getFullYear()} Rapid 911 Rapid Rescue PTY (Ltd)</span>
            </footer>
        </div>
    );
};

export default AuthPage;