
import React, { useState } from 'react';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import { logoUrl } from '../assets/logo';
import ThemeToggle from '../components/ThemeToggle';

const AuthPage: React.FC = () => {
    const [isLoginView, setIsLoginView] = useState(true);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
            <div className="absolute top-6 right-6 z-20">
              <ThemeToggle />
            </div>

            <div className="mb-8">
               <img src={logoUrl} alt="RAPID REPORTING Logo" className="w-auto h-24" />
            </div>

            <div className="w-full max-w-md p-8 space-y-8 bg-white/80 dark:bg-gray-900/30 backdrop-blur-lg border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-2xl">
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
        </div>
    );
};

export default AuthPage;
