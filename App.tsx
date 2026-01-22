import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AuthPage from './pages/AuthPage';
import UsersPage from './pages/UsersPage';
import CompaniesPage from './pages/CompaniesPage';
import MapPage from './pages/MapPage';
import ReportsPage from './pages/ReportsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import ControllerPage from './pages/ControllerPage';
import ResponderPage from './pages/ResponderPage';
import UserDashboardPage from './pages/UserDashboardPage';
import { supabase } from './utils/supabase';
// FIX: Changed to `import type` for better compatibility with modern TypeScript module resolution for Supabase v2. This may resolve downstream type inference issues.
import type { Session } from '@supabase/supabase-js';
import { Profile, UserRole, Notification } from './types';
import { checkDatabaseSchema } from './utils/schemaCheck';
import GlobalSchemaErrorModal from './components/GlobalSchemaErrorModal';
import { ToastContainer } from './components/ToastContainer';

type View = 'dashboard' | 'archives' | 'analytics' | 'map' | 'users' | 'companies' | 'profile' | 'controller';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('dashboard');
  
  const [schemaState, setSchemaState] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [initialReportId, setInitialReportId] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      // 1. Check schema first. This is critical and runs for all users.
      const schemaResult = await checkDatabaseSchema();
      if (schemaResult.status === 'invalid') {
        setSchemaError(schemaResult.error || 'An unknown schema error occurred.');
        setSchemaState('invalid');
        setLoading(false); // Stop loading to show the error modal.
        return;
      }
      setSchemaState('valid');
  
      // 2. If schema is valid, fetch the initial session.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError(`Cannot reach authentication server: ${sessionError.message}`);
      } else {
        setSession(session);
      }
      setLoading(false); // Initial load (schema + session) is complete.
    };
  
    initializeApp();
  
    // 3. Set up a listener for subsequent auth state changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setError(null); // Clear errors on auth state change
      if (!session) {
        setProfile(null);
      }
    });
  
    return () => subscription.unsubscribe();
  }, []);
  
  useEffect(() => {
    let presenceInterval: number | undefined;

    const setupPresence = (userId: string) => {
        supabase
            .from('profiles')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', userId)
            .then(({ error }) => {
                if (error) console.warn("Could not update presence:", error.message);
            });

        presenceInterval = window.setInterval(async () => {
            await supabase
                .from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', userId);
        }, 60000);
    };

    if (session?.user) {
        const loadProfile = async () => {
            const { data, error } = await supabase.from('profiles').select('*, company:companies(*)').eq('id', session.user.id).single();

            if (error) {
                setError(`Failed to load your profile. Please check your connection and Row Level Security policies. Error: ${error.message}`);
                setProfile(null);
            } else {
                setProfile(data);
                setError(null);
                setupPresence(session.user.id);
            }
        };

        loadProfile();
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
      const adminPages: View[] = ['users', 'companies'];
      if (adminPages.includes(view) && ![UserRole.ADMIN, UserRole.MODERATOR].includes(profile.role)) {
        setView('dashboard');
      }
      if (view === 'controller' && ![UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER].includes(profile.role)) {
        setView('dashboard');
      }
    }
  }, [view, profile]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
    }

    switch (notification.type) {
        case 'new_report':
            if (notification.reference_id) {
                if (profile && [UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER].includes(profile.role)) {
                    setView('controller');
                } else {
                    setView('dashboard');
                }
                setInitialReportId(notification.reference_id);
            }
            break;
        case 'new_user':
            setView('users');
            break;
        default:
            break;
    }
  };

  const renderView = () => {
    if (!profile) return null;

    if (profile.role === UserRole.RESPONDER) {
        return view === 'profile' 
            ? <ProfilePage profile={profile} setProfile={setProfile} />
            : <ResponderPage profile={profile} setProfile={setProfile} />;
    }
    
    if (profile.role === UserRole.USER) {
        return view === 'profile'
            ? <ProfilePage profile={profile} setProfile={setProfile} />
            : <UserDashboardPage profile={profile} />;
    }
    
    const onInitialReportHandled = () => setInitialReportId(null);

    switch(view) {
      case 'dashboard': return <Dashboard profile={profile} initialReportId={initialReportId} onInitialReportHandled={onInitialReportHandled} />;
      case 'controller': return <ControllerPage profile={profile} initialReportId={initialReportId} onInitialReportHandled={onInitialReportHandled} />;
      case 'archives': return <ReportsPage profile={profile} />;
      case 'analytics': return <AnalyticsPage />;
      case 'map': return <MapPage profile={profile} />;
      case 'users': return <UsersPage />;
      case 'companies': return <CompaniesPage />;
      case 'profile': return <ProfilePage profile={profile} setProfile={setProfile} />;
      default: return <Dashboard profile={profile} initialReportId={initialReportId} onInitialReportHandled={onInitialReportHandled} />;
    }
  }

  if (loading) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black">
             <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
             <p className="mt-4 text-gray-500 dark:text-gray-400">Initializing Application...</p>
        </div>
    )
  }
  
  if (schemaState === 'invalid') {
    return <GlobalSchemaErrorModal checkError={schemaError} />;
  }

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

  if (!session) {
      return <AuthPage />;
  }
  
  if (session && !profile) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Loading your workspace...</p>
        </div>
    );
  }

  const isFullWidthView = view === 'controller' || view === 'map' || profile?.role === UserRole.RESPONDER;
  const isUserView = profile?.role === UserRole.USER;
  
  const mainClasses = isFullWidthView
    ? 'pt-20 pb-8 px-4 sm:px-6 lg:px-8'
    : `container mx-auto pt-20 px-4 sm:px-6 lg:px-8 pb-8 ${isUserView ? 'max-w-7xl' : ''}`;

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white via-gray-50 to-white dark:from-black dark:via-indigo-900/60 dark:to-black z-0 transition-all duration-500 ease-in-out"></div>
      <div className="absolute top-[20%] left-[10%] w-72 h-72 bg-blue-400/30 dark:bg-blue-400/60 rounded-full filter blur-3xl opacity-100 dark:opacity-20 animate-pulse" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-[5%] right-[5%] w-96 h-96 bg-red-400/30 dark:bg-indigo-600/60 rounded-full filter blur-3xl opacity-100 dark:opacity-20 animate-pulse" style={{ animationDuration: '10s' }}></div>
      
      <ToastContainer />

      <div className="relative z-10">
        {profile ? (
          <div className="flex flex-col min-h-screen">
            <Header 
              currentView={view} 
              setView={setView} 
              profile={profile}
              onNotificationClick={handleNotificationClick}
            />
            <main className={`${mainClasses} flex-grow`}>
              {renderView()}
            </main>
            <footer className="text-center py-4 text-xs text-gray-500 dark:text-gray-400 print:hidden">
                Copyright &copy; {new Date().getFullYear()} Rapid 911 Rapid Rescue PTY (Ltd)
            </footer>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default App;
