import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { BellIcon, ChevronDownIcon, MenuIcon, XIcon, GlobeIcon, RadioTowerIcon, BuildingIcon, HistoryIcon, SearchIcon, ChartBarIcon, MapIcon, UsersIcon, ClipboardCheckIcon, ScanIcon } from './icons';
import { Profile, UserRole, Notification } from '../types';
import { supabase } from '../utils/supabase';
import { useSettings } from '../contexts/SettingsContext';
import ThemeToggle from './ThemeToggle';
import NotificationsPanel from './NotificationsPanel';
import PTTModal from './PTTModal';
import LedClock from './LedClock';
import { updateFaviconBadge, updateDocumentTitle, playNotificationSound } from '../utils/notificationUtils';

interface HeaderProps {
    currentView: string;
    setView: (view: 'dashboard' | 'archives' | 'analytics' | 'map' | 'users' | 'companies' | 'profile' | 'controller' | 'activity_logs' | 'guard_monitoring' | 'gate_access' | 'global_search' | 'patrol_scanner') => void;
    profile: Profile;
    onNotificationClick: (notification: Notification) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView, profile, onNotificationClick }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPTTModalOpen, setIsPTTModalOpen] = useState(false);
  const { mainLogoUrl, faviconUrl, defaultLogoUrl } = useSettings();

  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const prevUnreadCount = useRef(0);
  
  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);
  const canAccessAdminPages = [UserRole.ADMIN, UserRole.MODERATOR].includes(profile.role);

  // Handle notification enhancements (Favicon, Title, Sound)
  useEffect(() => {
    // Update Document Title
    updateDocumentTitle(unreadCount);

    // Update Favicon Badge
    if (faviconUrl) {
        updateFaviconBadge(unreadCount, faviconUrl);
    }

    // Play Sound on new unread notifications
    if (unreadCount > prevUnreadCount.current) {
        playNotificationSound();
    }
    
    prevUnreadCount.current = unreadCount;
  }, [unreadCount, faviconUrl]);

  // Cleanup on unmount (e.g. logout)
  useEffect(() => {
    return () => {
       if (faviconUrl) {
           const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
           if (link) link.href = faviconUrl;
       }
       document.title = 'Rapid iReport';
    };
  }, [faviconUrl]);

  useEffect(() => {
    if (!profile) return;
    
    const fetchInitialData = async () => {
        const { data: notificationsData, error: notificationsError } = await supabase
            .from('notifications')
            .select('*')
            .eq('recipient_user_id', profile.id)
            .order('created_at', { ascending: false });
        if (notificationsError) console.error("Error fetching notifications:", notificationsError);
        else setNotifications(notificationsData || []);
    };
    
    fetchInitialData();

    const handleNotificationChange = (payload: any) => {
        setNotifications(currentNotifications => {
            if (payload.eventType === 'INSERT') {
                const newNotification = payload.new as Notification;
                // Avoid duplicates from race conditions
                if (currentNotifications.some(n => n.id === newNotification.id)) return currentNotifications;
                return [newNotification, ...currentNotifications];
            }
            if (payload.eventType === 'UPDATE') {
                return currentNotifications.map(n => n.id === payload.new.id ? payload.new as Notification : n);
            }
            if (payload.eventType === 'DELETE') {
                return currentNotifications.filter(n => n.id !== payload.old.id);
            }
            return currentNotifications;
        });
    };

    const notificationsChannel = supabase
        .channel(`notifications-${profile.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${profile.id}`}, 
            handleNotificationChange
        )
        .subscribe();
        
    return () => {
        supabase.removeChannel(notificationsChannel);
    };
  }, [profile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) setIsNotificationsOpen(false);
        if (profileRef.current && !profileRef.current.contains(event.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinkClasses = (view: string) => 
      `relative text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors duration-300 px-3 py-2 rounded-md whitespace-nowrap flex-shrink-0 ${
        currentView === view ? 'bg-gray-200 dark:bg-gray-700/50 text-black dark:text-white' : ''
      }`;
      
  const mobileNavLinkClasses = (view: string) => 
      `block w-full text-left text-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-300 px-4 py-3 rounded-md ${
        currentView === view ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300' : ''
      }`;

  const handleLogout = async () => {
    // FIX: Using bracket notation to bypass potential SupabaseAuthClient type errors.
    await supabase.auth['signOut']();
    setMobileMenuOpen(false);
  };

  const handleMobileLinkClick = (view: 'dashboard' | 'archives' | 'analytics' | 'map' | 'users' | 'companies' | 'profile' | 'controller' | 'activity_logs' | 'guard_monitoring' | 'gate_access' | 'global_search' | 'patrol_scanner' | 'attendance') => {
      setView(view);
      setMobileMenuOpen(false);
  }
  
  useEffect(() => {
    if (mobileMenuOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [mobileMenuOpen]);

  const toggleNotifications = () => { setIsNotificationsOpen(prev => !prev); setDropdownOpen(false); };
  const toggleUserDropdown = () => { setDropdownOpen(prev => !prev); setIsNotificationsOpen(false); };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
        setNotifications(prev => prev.map(n => ({...n, is_read: true})));
        await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    }
  };

  const handleNotificationItemClick = (notification: Notification) => {
    // Optimistically update UI for instant feedback
    if (!notification.is_read) {
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
    }
    // Close the panel
    setIsNotificationsOpen(false);
    
    // Trigger the actual DB update and navigation logic in App.tsx
    onNotificationClick(notification);
  };

  const NavLinks: React.FC<{mobile?: boolean}> = ({ mobile = false}) => {
    const clickHandler = (view: 'dashboard' | 'archives' | 'analytics' | 'map' | 'users' | 'companies' | 'profile' | 'controller' | 'activity_logs' | 'guard_monitoring' | 'global_search' | 'gate_access' | 'attendance' | 'patrol_scanner') => mobile ? handleMobileLinkClick(view as any) : setView(view as any);
    const classGetter = mobile ? mobileNavLinkClasses : navLinkClasses;

    if (profile.role === UserRole.USER) {
      return (
        <>
          <button onClick={() => clickHandler('dashboard')} className={classGetter('dashboard')}>
            <GlobeIcon className="w-4 h-4 mr-2" /> My Reports
          </button>
          <button onClick={() => clickHandler('global_search')} className={classGetter('global_search')}>
            <SearchIcon className="w-4 h-4 mr-2" /> Global Search
          </button>
        </>
      );
    }

    if (profile.role === UserRole.GUARD) {
      return (
        <>
          <button onClick={() => clickHandler('dashboard')} className={classGetter('dashboard')}>
            <GlobeIcon className="w-4 h-4 mr-2" /> Dashboard
          </button>
          <button onClick={() => clickHandler('gate_access')} className={classGetter('gate_access')}>
            <ClipboardCheckIcon className="w-4 h-4 mr-2" /> Gate Access
          </button>
          <button onClick={() => clickHandler('patrol_scanner')} className={classGetter('patrol_scanner')}>
            <ScanIcon className="w-4 h-4 mr-2" /> Patrolling
          </button>
        </>
      );
    }

    if (profile.role === UserRole.CONTROLLER) {
      return (
        <>
          <button onClick={() => clickHandler('controller')} className={classGetter('controller')}>
            <RadioTowerIcon className="w-4 h-4 mr-2" /> Controller
          </button>
          <button onClick={() => clickHandler('guard_monitoring')} className={classGetter('guard_monitoring')}>
            <BuildingIcon className="w-4 h-4 mr-2" /> Guarding
          </button>
          <button onClick={() => clickHandler('attendance')} className={classGetter('attendance')}>
            <ClipboardCheckIcon className="w-4 h-4 mr-2" /> Attendance
          </button>
          <button onClick={() => clickHandler('global_search')} className={classGetter('global_search')}>
            <SearchIcon className="w-4 h-4 mr-2" /> Global Search
          </button>
        </>
      );
    }

    if (profile.role === UserRole.RESPONDER) {
      return null;
    }
  
    // For Admin/Moderator
    return (
      <>
        <button onClick={() => clickHandler('dashboard')} className={classGetter('dashboard')}>
          <GlobeIcon className="w-4 h-4 mr-2" /> Dashboard
        </button>
        <button onClick={() => clickHandler('controller')} className={classGetter('controller')}>
          <RadioTowerIcon className="w-4 h-4 mr-2" /> Controller
        </button>
        <button onClick={() => clickHandler('guard_monitoring')} className={classGetter('guard_monitoring')}>
          <BuildingIcon className="w-4 h-4 mr-2" /> Guarding
        </button>
        <button onClick={() => clickHandler('attendance')} className={classGetter('attendance')}>
          <ClipboardCheckIcon className="w-4 h-4 mr-2" /> Attendance
        </button>
        <button onClick={() => clickHandler('archives')} className={classGetter('archives')}>
          <HistoryIcon className="w-4 h-4 mr-2" /> Archives
        </button>
        <button onClick={() => clickHandler('global_search')} className={classGetter('global_search')}>
          <SearchIcon className="w-4 h-4 mr-2" /> Global Search
        </button>
        <button onClick={() => clickHandler('analytics')} className={classGetter('analytics')}>
          <ChartBarIcon className="w-4 h-4 mr-2" /> Analytics
        </button>
        <button onClick={() => clickHandler('map')} className={classGetter('map')}>
          <MapIcon className="w-4 h-4 mr-2" /> Map
        </button>
        {canAccessAdminPages && (
          <>
            <button onClick={() => clickHandler('users')} className={classGetter('users')}>
              <UsersIcon className="w-4 h-4 mr-2" /> Users
            </button>
            <button onClick={() => clickHandler('activity_logs')} className={classGetter('activity_logs')}>
              <ClipboardCheckIcon className="w-4 h-4 mr-2" /> Logs
            </button>
            <button onClick={() => clickHandler('companies')} className={classGetter('companies')}>
              <BuildingIcon className="w-4 h-4 mr-2" /> Settings
            </button>
          </>
        )}
      </>
    );
  }

  const headerContainerClasses = currentView === 'controller' || profile.role === UserRole.RESPONDER || profile.role === UserRole.USER
    ? "px-4 sm:px-6 lg:px-8" // Full-width views
    : "container mx-auto px-4 sm:px-6 lg:px-8"; // Centered for others

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/70 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700/50 transition-colors duration-300 print:hidden">
      <div className={headerContainerClasses}>
          <div className="flex items-center justify-between min-h-[4rem] py-0.5">
          <div className="flex items-center space-x-3 flex-shrink-0">
            <img 
              src={profile.company?.logo_url || mainLogoUrl} 
              alt="Company Logo" 
              className="main-logo w-auto min-w-[60px] h-12 sm:h-20 object-contain transition-all duration-300 opacity-0" 
              onLoad={(e) => { e.currentTarget.style.opacity = '1'; }}
              onError={(e) => { 
                  e.currentTarget.style.opacity = '1';
                  if (e.currentTarget.src !== defaultLogoUrl) {
                      e.currentTarget.src = defaultLogoUrl;
                  }
              }} 
            />
          </div>

          <div className="hidden md:flex flex-grow px-1 overflow-hidden relative group">
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white dark:from-gray-950 to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white dark:from-gray-950 to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <nav className="flex items-center space-x-1 overflow-x-auto custom-scrollbar max-w-full w-full justify-start px-2 py-1">
                <NavLinks />
            </nav>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            <div className="hidden lg:block scale-75 xl:scale-90 origin-right mr-1">
              <LedClock />
            </div>
            <ThemeToggle />
            {profile.company_id && (
                <button onClick={() => setIsPTTModalOpen(true)} className="relative text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors duration-300" title="Push-to-Talk">
                  <RadioTowerIcon className="w-8 h-8 sm:w-10 sm:h-10" />
                </button>
            )}
            <div ref={notificationsRef} className="relative">
                <button onClick={toggleNotifications} className="relative text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors duration-300">
                  <BellIcon className="w-5 h-5 sm:w-6 h-6" />
                  {unreadCount > 0 && (
                     <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 rounded-full text-[10px] flex items-center justify-center text-white">{unreadCount}</span>
                  )}
                </button>
                 {isNotificationsOpen && (
                    <NotificationsPanel 
                        notifications={notifications}
                        onNotificationClick={handleNotificationItemClick}
                        onMarkAllAsRead={handleMarkAllAsRead}
                        onClose={() => setIsNotificationsOpen(false)}
                    />
                )}
            </div>
            <div ref={profileRef} className="flex relative items-center">
              <button onClick={toggleUserDropdown} className="flex items-center space-x-1 lg:space-x-2">
                <img 
                  src={profile.avatar_url || `https://i.pravatar.cc/40?u=${profile.id}`} 
                  alt="User Avatar"
                  className="w-8 h-8 lg:w-9 lg:h-9 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 transition"
                />
                <span className="hidden sm:inline text-gray-900 dark:text-white text-xs lg:text-sm font-medium truncate max-w-[60px] lg:max-w-[120px]">{`${profile.first_name} ${profile.surname}`}</span>
                <ChevronDownIcon className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white/90 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 py-1">
                  <button onClick={() => { setView('profile'); setDropdownOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-black dark:hover:text-white">Profile</button>
                  <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-black dark:hover:text-white">Settings</a>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-700 dark:hover:text-red-300">Logout</button>
                </div>
              )}
            </div>
            <div className="md:hidden">
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    {mobileMenuOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
                </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      <div className={`md:hidden absolute top-full left-0 right-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md shadow-lg transition-transform duration-300 ease-in-out max-h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar ${mobileMenuOpen ? 'translate-y-0' : '-translate-y-[150%]'}`}>
          <nav className="flex flex-col p-4 space-y-2">
            <NavLinks mobile={true} />
            <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-2 space-y-2">
                 <button onClick={() => handleMobileLinkClick('profile')} className={mobileNavLinkClasses('profile')}>Profile</button>
                 <button onClick={handleLogout} className="block w-full text-left px-4 py-3 text-lg text-red-500 dark:text-red-400 hover:bg-red-500/10 rounded-md">Logout</button>
            </div>
          </nav>
      </div>
    </header>
    <PTTModal isOpen={isPTTModalOpen} onClose={() => setIsPTTModalOpen(false)} profile={profile} />
    </>
  );
};

export default memo(Header);