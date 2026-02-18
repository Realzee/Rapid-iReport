
import React, { useState, useEffect } from 'react';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import { useSettings } from '../contexts/SettingsContext';
import ThemeToggle from '../components/ThemeToggle';
import { supabase } from '../utils/supabase';
import { Company } from '../types';

interface AuthPageProps {
    onViewPublicDashboard: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onViewPublicDashboard }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [companies, setCompanies] = useState<Company[]>([]);
    const { mainLogoUrl } = useSettings();

    useEffect(() => {
        const fetchCompanies = async () => {
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
        <div className="min-h-screen flex flex-col relative">
            <div className="absolute top-6 right-6 z-20">
              <ThemeToggle />
            </div>

            <main className="flex-grow flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                   <img src={mainLogoUrl} alt="Rapid911 Logo" className="w-auto h-24" />
                </div>

                <div className="w-full max-w-md p-8 space-y-8 bg-white/80 dark:bg-gray-950/60 backdrop-blur-2xl border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-2xl transition-colors duration-300 dark:ring-1 dark:ring-white/10">
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

                <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Or,{' '}
                    <button onClick={onViewPublicDashboard} className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none">
                        view the public community map
                    </button>
                </p>
            </main>
            <footer className="text-center py-4 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                <img src={mainLogoUrl} alt="Rapid911 Mini Logo" className="w-auto h-4" />
                <span>Copyright &copy; {new Date().getFullYear()} Rapid 911 Rapid Rescue PTY (Ltd)</span>
            </footer>
        </div>
    );
};

export default AuthPage;