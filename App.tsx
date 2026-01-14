

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AuthPage from './pages/AuthPage';
import UsersPage from './pages/UsersPage';
import CompaniesPage from './pages/CompaniesPage';
import MapPage from './pages/MapPage';
import ReportsPage from './pages/ReportsPage';
import { supabase } from './utils/supabase';
import { Session } from '@supabase/supabase-js';
import { Profile, UserRole } from './types';

type View = 'dashboard' | 'reports' | 'map' | 'users' | 'companies';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('dashboard');
  
  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  useEffect(() => {
    let presenceInterval: number | undefined;

    if (session?.user) {
        const setupPresence = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', session.user.id)
                .select()
                .single();

            if (error) {
                console.error('Error setting up presence and fetching profile:', error);
                if (error.message.includes('security policy')) {
                    console.error(
                        '%c[SECURITY POLICY ERROR]',
                        'color: yellow; font-weight: bold;',
                        `The operation was blocked by your database's Row Level Security. Please ensure you have run the full script in DATABASE_SETUP.md, specifically STEP C which configures policies for the 'profiles' table.`
                    );
                }
            } else {
                setProfile(data);
            }

            presenceInterval = window.setInterval(async () => {
                await supabase
                    .from('profiles')
                    .update({ last_seen_at: new Date().toISOString() })
                    .eq('id', session.user.id);
            }, 60000);
        };
        setupPresence();
    } else {
        setProfile(null);
    }

    return () => {
        if (presenceInterval) {
            clearInterval(presenceInterval);
        }
    };
  }, [session]);

  useEffect(() => {
    if (profile) {
      const isAdminView = view === 'users' || view === 'companies';
      const canAccessAdminViews = [UserRole.ADMIN, UserRole.MODERATOR].includes(profile.role);

      if (isAdminView && !canAccessAdminViews) {
        setView('dashboard');
      }
    }
  }, [view, profile]);

  const renderView = () => {
    if (!profile) return null;
    switch(view) {
      case 'dashboard':
        return <Dashboard profile={profile} />;
      case 'reports':
        return <ReportsPage />;
      case 'map':
        return <MapPage />;
      case 'users':
        return <UsersPage />;
      case 'companies':
        return <CompaniesPage />;
      default:
        return <Dashboard profile={profile} />;
    }
  }

  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
             <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white via-gray-50 to-white dark:from-black dark:via-indigo-900/60 dark:to-black z-0 transition-all duration-500 ease-in-out"></div>
      <div 
        className="absolute top-[20%] left-[10%] w-72 h-72 bg-blue-400/30 dark:bg-blue-400/60 rounded-full filter blur-3xl opacity-100 dark:opacity-20 animate-pulse"
        style={{ animationDuration: '8s' }}
      ></div>
      <div 
        className="absolute bottom-[5%] right-[5%] w-96 h-96 bg-red-400/30 dark:bg-indigo-600/60 rounded-full filter blur-3xl opacity-100 dark:opacity-20 animate-pulse"
        style={{ animationDuration: '10s' }}
      ></div>
      
      <div className="relative z-10">
        {session && profile ? (
          <>
            <Header currentView={view} setView={setView} profile={profile} />
            <main className="pt-24 px-4 sm:px-6 lg:px-8 pb-8">
              {renderView()}
            </main>
          </>
        ) : (
          <AuthPage />
        )}
      </div>
    </div>
  );
};

export default App;