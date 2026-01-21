
import React, { useState } from 'react';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import { logoUrl } from '../assets/logo';
import ThemeToggle from '../components/ThemeToggle';

const AuthPage: React.FC = () => {
    const [isLoginView, setIsLoginView] = useState(true);

    return (
        <div className="min-h-screen flex flex-col relative">
            <div className="absolute top-6 right-6 z-20">
              <ThemeToggle />
            </div>

            <main className="flex-grow flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                   <img src={logoUrl} alt="RAPID REPORTING Logo" className="w-auto h-24" />
                </div>

                <div className="w-full max-w-md p-8 space-y-8 bg-white/80 dark:bg-gray-950/60 backdrop-blur-2xl border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-2xl transition-colors duration-300 dark:ring-1 dark:ring-white/10">
                    {isLoginView ? (
                        <LoginForm 
                            onSwitchToRegister={() => setIsLoginView(false)} 
                        />
                    ) : (
                        <RegisterForm 
                            onSwitchToLogin={() => setIsLoginView(true)} 
                        />
                    )}
                </div>
            </main>
            <footer className="text-center py-4 text-xs text-gray-500 dark:text-gray-400">
                Copyright &copy; {new Date().getFullYear()} Rapid 911 Rapid Rescue PTY (Ltd)
            </footer>
        </div>
    );
};

export default AuthPage;