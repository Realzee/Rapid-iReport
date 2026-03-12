import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import ThemeToggle from '../components/ThemeToggle';

interface AboutPageProps {
    onBackToLogin: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onBackToLogin }) => {
    const { mainLogoUrl } = useSettings();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100">
            <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <img src={mainLogoUrl} alt="Rapid911 Logo" className="h-10 w-auto" />
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <button 
                            onClick={onBackToLogin}
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 pt-24 pb-12">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl font-bold mb-8">About Rapid911</h1>
                    
                    <section className="mb-12">
                        <h2 className="text-2xl font-semibold mb-4">How it Works</h2>
                        <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                            Rapid911 is a comprehensive incident management and community safety platform. 
                            It connects responders, controllers, and the community to ensure rapid response 
                            to emergencies, crimes, and vehicle-related incidents.
                        </p>
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                                <h3 className="font-bold mb-2">1. Report</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Users can report incidents quickly with location and evidence.</p>
                            </div>
                            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                                <h3 className="font-bold mb-2">2. Manage</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Controllers dispatch responders and manage incident workflows.</p>
                            </div>
                            <div className="p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                                <h3 className="font-bold mb-2">3. Resolve</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Responders track and resolve incidents in real-time.</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-6">Platform Highlights</h2>
                        <div className="space-y-8">
                            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-900">
                                <img 
                                    src="https://placehold.co/600x400?text=Incident+Dashboard" 
                                    alt="Real-time Incident Dashboard" 
                                    className="w-full h-auto rounded-lg shadow-lg mb-4"
                                />
                                <h3 className="text-xl font-bold mb-2">Real-time Incident Dashboard</h3>
                                <p className="text-gray-600 dark:text-gray-400">Monitor all active incidents on a single, intuitive interface.</p>
                            </div>
                            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-900">
                                <div className="aspect-video bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-500 mb-4">
                                    [Screenshot: Responder Map]
                                </div>
                                <h3 className="text-xl font-bold mb-2">Responder Map View</h3>
                                <p className="text-gray-600 dark:text-gray-400">Track responder locations and incident proximity in real-time.</p>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default AboutPage;
