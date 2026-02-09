import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { BellIcon, ChevronDownIcon, MenuIcon, XIcon, RadioTowerIcon } from './icons';
import { Profile, UserRole, Notification } from '../types';
import { supabase } from '../utils/supabase';
import { useSettings } from '../contexts/SettingsContext';
import ThemeToggle from './ThemeToggle';
import NotificationsPanel from './NotificationsPanel';
import PTTModal from './PTTModal';
import LedClock from './LedClock';

interface HeaderProps {
    currentView: string;
    setView: (view: 'dashboard' | 'archives' | 'analytics' | 'map' | 'users' | 'companies' | 'profile' | 'controller') => void;
    profile: Profile;
    onNotificationClick: (notification: Notification) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView, profile, onNotificationClick }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPTTModalOpen, setIsPTTModalOpen] = useState(false);
  const { mainLogoUrl } = useSettings();

  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  
  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);
  const canAccessAdminPages = [UserRole.ADMIN, UserRole.MODERATOR].includes(profile.role);

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
      `relative text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors duration-300 px-3 py-2 rounded-md ${
        currentView === view ? 'bg-gray-200 dark:bg-gray-700/50 text-black dark:text-white' : ''
      }`;
      
  const mobileNavLinkClasses = (view: string) => 
      `block w-full text-left text-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-300 px-4 py-3 rounded-md ${
        currentView === view ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300' : ''
      }`;

  const handleLogout = async () => {
    // @ts-ignore - FIX: The `signOut` method is not found on the type, using bracket notation to bypass the incorrect type.
    await supabase.auth['signOut']();
    setMobileMenuOpen(false);
  };

  const handleMobileLinkClick = (view: 'dashboard' | 'archives' | 'analytics' | 'map' | 'users' | 'companies' | 'profile' | 'controller') => {
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
        await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    }
  };

  const NavLinks: React.FC<{mobile?: boolean}> = ({ mobile = false}) => {
    const clickHandler = (view: 'dashboard' | 'archives' | 'analytics' | 'map' | 'users' | 'companies' | 'profile' | 'controller') => mobile ? handleMobileLinkClick(view) : setView(view);
    const classGetter = mobile ? mobileNavLinkClasses : navLinkClasses;

    if (profile.role === UserRole.USER) {
      return (
        <button onClick={() => clickHandler('dashboard')} className={classGetter('dashboard')}>
          My Reports
        </button>
      );
    }

    if (profile.role === UserRole.CONTROLLER) {
      return (
        <button onClick={() => clickHandler('controller')} className={classGetter('controller')}>
            Controller
        </button>
      );
    }

    if (profile.role === UserRole.RESPONDER) {
      return null; // Responders do not have main navigation items.
    }
  
    // For Admin/Moderator
    return (
      <>
        <button onClick={() => clickHandler('dashboard')} className={classGetter('dashboard')}>Dashboard</button>
        <button onClick={() => clickHandler('controller')} className={classGetter('controller')}>Controller</button>
        <button onClick={() => clickHandler('archives')} className={classGetter('archives')}>Archives</button>
        <button onClick={() => clickHandler('analytics')} className={classGetter('analytics')}>Analytics</button>
        <button onClick={() => clickHandler('map')} className={classGetter('map')}>Map</button>
        {canAccessAdminPages && (
          <>
            <button onClick={() => clickHandler('users')} className={classGetter('users')}>Users</button>
            <button onClick={() => clickHandler('companies')} className={classGetter('companies')}>Settings</button>
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
        <div className="flex items-center justify-between h-20 relative">
          <div className="flex items-center space-x-2">
            <img src={profile.company?.logo_url || mainLogoUrl} alt="Company Logo" className="w-auto h-14 object-contain" />
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-1">
            <nav className="flex items-center space-x-2">
                <NavLinks />
            </nav>
            <LedClock />
          </div>
          
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            {profile.company_id && (
                <button onClick={() => setIsPTTModalOpen(true)} className="relative text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors duration-300" title="Push-to-Talk">
                  <RadioTowerIcon className="w-6 h-6" />
                </button>
            )}
            <div ref={notificationsRef} className="relative">
                <button onClick={toggleNotifications} className="relative text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors duration-300">
                  <BellIcon className="w-6 h-6" />
                  {unreadCount > 0 && (
                     <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-xs flex items-center justify-center text-white">{unreadCount}</span>
                  )}
                </button>
                 {isNotificationsOpen && (
                    <NotificationsPanel 
                        notifications={notifications}
                        onNotificationClick={(notification) => {
                          onNotificationClick(notification);
                          setIsNotificationsOpen(false);
                        }}
                        onMarkAllAsRead={handleMarkAllAsRead}
                        onClose={() => setIsNotificationsOpen(false)}
                    />
                )}
            </div>
            <div ref={profileRef} className="hidden md:flex relative">
              <button onClick={toggleUserDropdown} className="flex items-center space-x-2">
                <img 
                  src={profile.avatar_url || `https://i.pravatar.cc/40?u=${profile.id}`} 
                  alt="User Avatar"
                  className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 transition"
                />
                <span className="hidden sm:inline text-gray-900 dark:text-white">{`${profile.first_name} ${profile.surname}`}</span>
                <ChevronDownIcon className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-12 w-48 bg-white/90 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 py-1">
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
      <div className={`md:hidden absolute top-20 left-0 right-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md shadow-lg transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-y-0' : '-translate-y-[150%]'}`}>
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