

import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AuthPage from './pages/AuthPage';
import UsersPage from './pages/UsersPage';
import CompaniesPage from './pages/CompaniesPage';
import GlobalMapModal from './components/GlobalMapModal';
import ReportsPage from './pages/ReportsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import ControllerPage from './pages/ControllerPage';
import ResponderPage from './pages/ResponderPage';
import UserDashboardPage from './pages/UserDashboardPage';
import PublicDashboardPage from './pages/PublicDashboardPage';
import AboutPage from './pages/AboutPage';
import GuardMonitoringPage from './pages/GuardMonitoringPage';
import GateAccessPage from './pages/GateAccessPage';
import AnnouncementsBanner from './components/AnnouncementsBanner';
import { supabase } from './utils/supabase';
import type { AuthSession as Session } from '@supabase/supabase-js';
import { Profile, UserRole, Notification, UserStatus } from './types';
import { ToastContainer } from './components/ToastContainer';
import { checkDatabaseSchema } from './utils/schemaCheck';
import GlobalSchemaErrorModal from './components/GlobalSchemaErrorModal';
import { useSettings } from './contexts/SettingsContext';
import { ChatProvider } from './contexts/ChatContext';
import { RespondersProvider } from './contexts/RespondersContext';
import { EventsProvider } from './contexts/EventsContext';
import { AlertTriangleIcon, ClockIcon } from './components/icons';
import { useToast } from './contexts/ToastContext';
import UserActivityPage from './pages/UserActivityPage';
import GlobalSearchPage from './pages/GlobalSearchPage';
import { useTheme } from './contexts/ThemeContext';
import MatrixRain from './components/MatrixRain';

type View = 'dashboard' | 'archives' | 'analytics' | 'map' | 'users' | 'companies' | 'profile' | 'controller' | 'activity_logs' | 'guard_monitoring' | 'global_search' | 'gate_access';

const isProfileComplete = (profile: Profile) => {
    if (profile.role !== UserRole.CONTROLLER && profile.role !== UserRole.RESPONDER) return true;
    if (profile.status !== UserStatus.ACTIVE) return true;
    
    return !!(
        profile.first_name &&
        profile.surname &&
        profile.home_address &&
        profile.work_address &&
        profile.cell &&
        profile.ice_no &&
        profile.medical_aid &&
        profile.medical_aid_policy_number &&
        profile.allergies &&
        profile.insurance_company &&
        profile.insurance_policy_number &&
        profile.insurance_type &&
        profile.insurance_contact &&
        profile.vehicles && profile.vehicles.length > 0
    );
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('dashboard');
  
  const [initialReportId, setInitialReportId] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [showPublicView, setShowPublicView] = useState(false);
  const [showAboutPage, setShowAboutPage] = useState(false);
  const { mainLogoUrl, faviconUrl, defaultLogoUrl } = useSettings();
  const [isGlobalMapModalOpen, setIsGlobalMapModalOpen] = useState(false);
  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(false);
  const { addToast } = useToast();
  const { theme } = useTheme();

  useEffect(() => {
    const runSchemaCheck = async () => {
        const result = await checkDatabaseSchema();
        if (result.status === 'invalid') {
            setSchemaError(result.error || 'An unknown schema error occurred.');
            setLoading(false);
            return false;
        }
        return true;
    };
    
    const initializeApp = async () => {
      const isSchemaValid = await runSchemaCheck();
      if (!isSchemaValid) return;

      const { data: { session } } = await supabase.auth['getSession']();
      setSession(session);
      setLoading(false);
    };
  
    initializeApp();
  
    const { data: { subscription } } = supabase.auth['onAuthStateChange']((_event, session) => {
      setSession(session);
      setError(null);
      if (!session) {
        setProfile(null);
      }
    });
  
    return () => subscription.unsubscribe();
  }, []);
  
  useEffect(() => {
    let presenceInterval: number | undefined;

    const setupPresence = async (userId: string) => {
        try {
            const response = await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, last_seen_at: new Date().toISOString() })
            });
            
            if (!response.ok) {
                const text = await response.text();
                console.warn(`Presence update failed with status ${response.status}: ${text.substring(0, 100)}`);
            }
        } catch (err) {
            console.warn("Could not update presence:", err);
        }

        presenceInterval = window.setInterval(async () => {
            try {
                const response = await fetch('/api/update-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, last_seen_at: new Date().toISOString() })
                });
                
                if (!response.ok) {
                    const text = await response.text();
                    console.warn(`Presence interval update failed with status ${response.status}: ${text.substring(0, 100)}`);
                }
            } catch (error) {
                console.warn('Error updating presence interval:', error);
            }
        }, 60000);
    };

    if (session?.user) {
        const loadProfile = async () => {
            setProfileLoading(true);
            try {
                const { data, error: fetchError } = await supabase
                    .from('profiles')
                    .select('*, company:companies(*)')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (fetchError) {
                    setError(`Failed to load your profile. Please check your connection and Row Level Security policies. Error: ${fetchError.message}`);
                    setProfile(null);
                } else if (data) {
                    setProfile(data);
                    if (data.role === UserRole.CONTROLLER) {
                        setView('controller');
                    }
                    setError(null);
                    setupPresence(session.user.id);
                } else {
                    const { user } = session;
                    const { user_metadata } = user;
                    
                    console.log("Profile not found, attempting to auto-create from auth metadata...");
                    const profileDataToInsert = {
                        id: user.id,
                        email: user.email,
                        first_name: user_metadata?.first_name || 'New',
                        surname: user_metadata?.surname || 'User (Please Update)',
                        company_id: user_metadata?.company_id || null,
                        cell: user_metadata?.cell || null,
                        vehicle_reg: user_metadata?.vehicle_reg || null,
                        home_address: user_metadata?.home_address || null,
                        ice_no: user_metadata?.ice_no || null,
                        medical_aid: user_metadata?.medical_aid || null,
                        psira_number: user_metadata?.psira_number || null,
                        role: UserRole.USER,
                        status: UserStatus.PENDING,
                    };
                    
                    const { data: newProfile, error: insertError } = await supabase
                        .from('profiles')
                        .insert(profileDataToInsert)
                        .select('*, company:companies(*)')
                        .single();
                    
                    if (insertError) {
                        console.error("Failed to auto-create profile:", insertError);
                        if (insertError.code === '23505') { // duplicate key violation
                            console.log("Profile likely created by a race condition. Re-fetching profile.");
                            loadProfile(); // Re-run the entire load process.
                            return; // Important: exit here to avoid finally block setting loading to false too early
                        }
                        setError(`Your profile data is missing and could not be automatically repaired. Please contact support. Error: ${insertError.message}`);
                        setProfile(null);
                    } else if (newProfile) {
                        console.log("Profile self-healed successfully.");
                        addToast("Your profile was repaired. Please review your details.", "success");
                        setProfile(newProfile);
                        if (newProfile.role === UserRole.CONTROLLER) {
                            setView('controller');
                        }
                        setError(null);
                        setupPresence(user.id);
                    }
                }
            } catch (e: any) {
                console.error("Critical error in loadProfile", e);
                setError("A critical error occurred while loading your profile.");
                setProfile(null);
            } finally {
                 setProfileLoading(false);
            }
        };

        loadProfile();
    } else {
        setProfile(null);
        setProfileLoading(false);
    }

    return () => {
        if (presenceInterval) {
            clearInterval(presenceInterval);
        }
    };
  }, [session, addToast]);

  useEffect(() => {
    if (profile) {
      if (!isProfileComplete(profile) && view !== 'profile') {
        setView('profile');
        addToast("Please complete your profile details before continuing.", "warning");
        return;
      }

      if (profile.role === UserRole.CONTROLLER && view !== 'controller' && view !== 'profile') {
        setView('controller');
        return;
      }
      
      const adminPages: View[] = ['users', 'companies'];
      if (adminPages.includes(view) && ![UserRole.ADMIN, UserRole.MODERATOR].includes(profile.role)) {
        setView('dashboard');
      }
      if (view === 'controller' && ![UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER].includes(profile.role)) {
        setView('dashboard');
      }
    }
  }, [view, profile]);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (link) {
      link.href = faviconUrl;
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = faviconUrl;
      document.head.appendChild(newLink);
    }
  }, [faviconUrl]);

  const handleNotificationClick = useCallback(async (notification: Notification) => {
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
  }, [profile]);

  const handleSetView = (newView: View) => {
    if (profile && !isProfileComplete(profile) && newView !== 'profile') {
        addToast("Please complete your profile details before continuing.", "warning");
        return;
    }

    if (newView === 'map') {
        setIsGlobalMapModalOpen(true);
    } else {
        if (isGlobalMapModalOpen) setIsGlobalMapModalOpen(false);
        setView(newView);
    }
  };

  const renderView = () => {
    if (!profile) return null;

    const onInitialReportHandled = () => setInitialReportId(null);

    if (profile.role === UserRole.RESPONDER) {
        return view === 'profile' 
            ? <ProfilePage profile={profile} setProfile={setProfile} />
            : <ResponderPage profile={profile} setProfile={setProfile} />;
    }
    
    if (profile.role === UserRole.USER) {
        if (view === 'global_search') return <GlobalSearchPage profile={profile} isGlobalAdmin={false} />;
        return view === 'profile'
            ? <ProfilePage profile={profile} setProfile={setProfile} />
            : <UserDashboardPage profile={profile} />;
    }
    
    if (profile.role === UserRole.CONTROLLER) {
      if (view === 'global_search') return <GlobalSearchPage profile={profile} isGlobalAdmin={false} />;
      return view === 'profile'
          ? <ProfilePage profile={profile} setProfile={setProfile} />
          : <ControllerPage profile={profile} initialReportId={initialReportId} onInitialReportHandled={onInitialReportHandled} />;
    }
    
    const isGlobalAdmin = profile.role === UserRole.ADMIN && (profile.company?.name?.toLowerCase().includes('rapid911') || false);

    switch(view) {
      case 'dashboard': return <Dashboard profile={profile} initialReportId={initialReportId} onInitialReportHandled={onInitialReportHandled} />;
      case 'controller': return <ControllerPage profile={profile} initialReportId={initialReportId} onInitialReportHandled={onInitialReportHandled} />;
      case 'archives': return <ReportsPage profile={profile} />;
      case 'global_search': return <GlobalSearchPage profile={profile} isGlobalAdmin={isGlobalAdmin} />;
      case 'analytics': return <AnalyticsPage />;
      case 'users': return <UsersPage />;
      case 'activity_logs': return <UserActivityPage />;
      case 'companies': return <CompaniesPage />;
      case 'guard_monitoring': return <GuardMonitoringPage />;
      case 'gate_access': return <GateAccessPage profile={profile} />;
      case 'profile': return <ProfilePage profile={profile} setProfile={setProfile} />;
      case 'map':
      default: return <Dashboard profile={profile} initialReportId={initialReportId} onInitialReportHandled={onInitialReportHandled} />;
    }
  }

  if (schemaError) {
    return <GlobalSchemaErrorModal checkError={schemaError} />;
  }

  if (loading || (session && profileLoading)) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black">
             <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
             <p className="mt-4 text-gray-500 dark:text-gray-400">Loading your workspace...</p>
        </div>
    )
  }
  
  if (session && error) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4">
              <div className="text-center bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg max-w-lg">
                  <h2 className="text-2xl font-bold mb-2 text-red-600 dark:text-red-400">Application Error</h2>
                  <p className="mb-4">{error}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This can happen due to network issues or incorrect database permissions (Row Level Security). Please check the console for more details.</p>
                  <button onClick={() => supabase.auth['signOut']()} className="mt-6 px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors">
                      Logout and Try Again
                  </button>
              </div>
          </div>
      );
  }

  if (!session) {
      if (showPublicView) {
        return <PublicDashboardPage onBackToLogin={() => setShowPublicView(false)} />;
      }
      if (showAboutPage) {
        return <AboutPage onBackToLogin={() => setShowAboutPage(false)} />;
      }
      return <AuthPage onViewPublicDashboard={() => setShowPublicView(true)} onViewAbout={() => setShowAboutPage(true)} />;
  }
  
  if (session && !profile && !profileLoading && !error) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 p-4">
            <div className="text-center bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg max-w-lg">
                <AlertTriangleIcon className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-yellow-700 dark:text-yellow-300">Profile Not Found</h2>
                <p className="mb-4 text-gray-600 dark:text-gray-300">
                    Your user account exists, but your profile data is missing. This can happen if the initial setup was interrupted.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    To fix this, please log out and sign up again. If the issue persists, contact administrator support.
                </p>
                <button onClick={() => supabase.auth['signOut']()} className="mt-6 px-5 py-2.5 bg-yellow-600 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-700 transition-colors">
                    Logout
                </button>
            </div>
        </div>
    );
  }
  
  if (profile && profile.status === UserStatus.PENDING) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 p-4">
            <div className="text-center bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg max-w-lg">
                <ClockIcon className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-yellow-700 dark:text-yellow-300">Account Pending Approval</h2>
                <p className="mb-4 text-gray-600 dark:text-gray-300">Thank you for registering. Your account is currently awaiting review by an administrator. You will be notified once it has been approved.</p>
                <button onClick={() => supabase.auth['signOut']()} className="mt-6 px-5 py-2.5 bg-yellow-600 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-700 transition-colors">
                    Logout
                </button>
            </div>
        </div>
    );
  }

  if (profile && profile.status === UserStatus.SUSPENDED) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4">
            <div className="text-center bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg max-w-lg">
                <AlertTriangleIcon className="w-12 h-12 mx-auto text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-red-600 dark:text-red-400">Account Suspended</h2>
                <p className="mb-4 text-gray-600 dark:text-gray-300">Your access to the system has been revoked. Please contact an administrator for assistance.</p>
                <button onClick={() => supabase.auth['signOut']()} className="mt-6 px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors">
                    Logout
                </button>
            </div>
        </div>
    );
  }

  const isFullWidthView = view === 'controller' || profile?.role === UserRole.RESPONDER;
  const isUserView = profile?.role === UserRole.USER;
  
  const mainPaddingTopClass = isAnnouncementVisible ? 'pt-40' : 'pt-24';

  const mainClasses = isFullWidthView
    ? `pb-8 px-4 sm:px-6 lg:px-8`
    : `container mx-auto px-4 sm:px-6 lg:px-8 pb-8 ${isUserView ? 'max-w-7xl' : ''}`;

  return (
    <div className={`min-h-screen relative overflow-x-hidden ${theme === 'matrix' ? 'matrix' : ''}`}>
      <MatrixRain />
      <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white via-gray-50 to-white dark:from-black dark:via-gray-900/60 dark:to-black z-0 transition-all duration-500 ease-in-out print:hidden ${theme === 'matrix' ? 'hidden' : ''}`}></div>
      <div className={`absolute top-[20%] left-[10%] w-72 h-72 bg-blue-400/30 dark:bg-blue-400/60 rounded-full filter blur-3xl opacity-100 dark:opacity-20 animate-pulse print:hidden ${theme === 'matrix' ? 'hidden' : ''}`} style={{ animationDuration: '8s' }}></div>
      <div className={`absolute bottom-[5%] right-[5%] w-96 h-96 bg-indigo-400/30 dark:bg-indigo-600/60 rounded-full filter blur-3xl opacity-100 dark:opacity-20 animate-pulse print:hidden ${theme === 'matrix' ? 'hidden' : ''}`} style={{ animationDuration: '10s' }}></div>
      
      <ToastContainer />

      <div className="relative z-10">
        {profile ? (
          <ChatProvider profile={profile}>
            <RespondersProvider>
              <EventsProvider>
                <div className="flex flex-col min-h-screen">
                  <Header 
                    currentView={isGlobalMapModalOpen ? 'map' : view}
                    setView={handleSetView} 
                    profile={profile}
                    onNotificationClick={handleNotificationClick}
                  />
                  <AnnouncementsBanner onVisibilityChange={setIsAnnouncementVisible} />
                  <main className={`${mainClasses} ${mainPaddingTopClass} flex-grow flex flex-col`}>
                    {renderView()}
                  </main>
                  <footer className="text-center py-4 text-xs text-gray-500 dark:text-gray-400 print:hidden flex items-center justify-center gap-2">
                      <img src={mainLogoUrl} alt="Rapid911 Mini Logo" className="w-auto h-4" onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} />
                      <span>Copyright &copy; {new Date().getFullYear()} Rapid 911 Rapid Rescue PTY (Ltd)</span>
                  </footer>
                </div>
              </EventsProvider>
            </RespondersProvider>
          </ChatProvider>
        ) : null}
      </div>
      {isGlobalMapModalOpen && <GlobalMapModal isOpen={isGlobalMapModalOpen} onClose={() => setIsGlobalMapModalOpen(false)} profile={profile} />}
    </div>
  );
};

export default App;