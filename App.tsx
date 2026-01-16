import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AuthPage from './pages/AuthPage';
import UsersPage from './pages/UsersPage';
import CompaniesPage from './pages/CompaniesPage';
import RequestsPage from './pages/RequestsPage';
import MapPage from './pages/MapPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import ControllerPage from './pages/ControllerPage';
import { supabase } from './utils/supabase';
import { Session } from '@supabase/supabase-js';
import { Profile, UserRole } from './types';

type View = 'dashboard' | 'reports' | 'map' | 'users' | 'companies' | 'profile' | 'controller' | 'requests';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('dashboard');
  
  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError(`Cannot reach authentication server: ${sessionError.message}`);
      } else {
        setSession(session);
      }
      setLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setError(null); // Clear errors on auth state change
    });

    return () => subscription.unsubscribe();
  }, []);
  
  useEffect(() => {
    let presenceInterval: number | undefined;

    if (session?.user) {
        const setupPresence = async () => {
            const { data, error: profileError } = await supabase
                .from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', session.user.id)
                .select()
                .single();

            if (profileError) {
                console.error('Error setting up presence and fetching profile:', profileError);
                setError(`Failed to load your profile. Please check your connection and Row Level Security policies. Error: ${profileError.message}`);
                setProfile(null);
                if (profileError.message.includes('security policy')) {
                    console.error(
                        '%c[SECURITY POLICY ERROR]',
                        'color: yellow; font-weight: bold;',
                        `The operation was blocked by your database's Row Level Security. Please ensure you have run the full script in DATABASE_SETUP.md, specifically STEP C which configures policies for the 'profiles' table.`
                    );
                }
            } else {
                setProfile(data);
                setError(null);
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
      const adminPages: View[] = ['users', 'companies', 'requests'];
      const currentViewIsAdmin = adminPages.includes(view);
      const canAccessAdminPages = [UserRole.ADMIN, UserRole.MODERATOR].includes(profile.role);
      
      if (currentViewIsAdmin && !canAccessAdminPages) {
        setView('dashboard');
      }

      const controllerView = view === 'controller';
      const canAccessController = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER].includes(profile.role);
      if (controllerView && !canAccessController) {
        setView('dashboard');
      }
    }
  }, [view, profile]);

  const renderView = () => {
    if (!profile) return null;
    switch(view) {
      case 'dashboard':
        return <Dashboard profile={profile} />;
      case 'controller':
        return <ControllerPage profile={profile} />;
      case 'reports':
        return <ReportsPage />;
      case 'map':
        return <MapPage />;
      case 'users':
        return <UsersPage />;
      case 'companies':
        return <CompaniesPage />;
      case 'requests':
        return <RequestsPage />;
      case 'profile':
        return <ProfilePage profile={profile} setProfile={setProfile} />;
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

  const mainClasses = view === 'controller'
    ? 'pt-20 pb-8 px-4 sm:px-6 lg:px-8' // Aligned pt with header, added padding here for full-width view
    : 'container mx-auto pt-20 px-4 sm:px-6 lg:px-8 pb-8'; // Aligned pt with header
    
  if (session && error) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4">
              <div className="text-center bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg max-w-lg">
                  <h2 className="text-2xl font-bold mb-2 text-red-600 dark:text-red-400">Application Error</h2>
                  <p className="mb-4">{error}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This can happen due to network issues or incorrect database permissions (Row Level Security). Please check the console for more details.</p>
                  <button onClick={() => supabase.auth.signOut()} className="mt-6 px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors">
                      Logout and Try Again
                  </button>
              </div>
          </div>
      );
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
            <main className={mainClasses}>
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