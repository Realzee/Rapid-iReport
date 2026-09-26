import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { BellIcon, ChevronDownIcon, MenuIcon, XIcon, GlobeIcon, RadioTowerIcon, BuildingIcon, HistoryIcon, SearchIcon, ChartBarIcon, MapIcon, UsersIcon, ClipboardCheckIcon, ScanIcon, WrenchIcon, ShareIcon, CarIcon, AmbulanceIcon, HeartPulseIcon } from './icons';
import { Profile, UserRole, Notification } from '../types';
import { supabase } from '../utils/supabase';
import { useSettings } from '../contexts/SettingsContext';
import ThemeToggle from './ThemeToggle';
import NotificationsPanel from './NotificationsPanel';
import PTTModal from './PTTModal';
import LedClock from './LedClock';
import { updateFaviconBadge, updateDocumentTitle, playNotificationSound, playLoudReportAlarm, isAlarmMuted, toggleAlarmMute } from '../utils/notificationUtils';
import { Volume2, VolumeX, Siren } from 'lucide-react';
import { logUserAction } from '../utils/logger';
import { CorporateSharingModal } from './CorporateSharingModal';
import ChangeLogModal from './ChangeLogModal';

interface HeaderProps {
    currentView: string;
    setView: (view: 'dashboard' | 'archives' | 'analytics' | 'map' | 'users' | 'companies' | 'profile' | 'controller' | 'activity_logs' | 'guard_monitoring' | 'gate_access' | 'global_search' | 'patrol_scanner' | 'technician_dashboard' | 'tech_ops' | 'attendance' | 'about' | 'roadside_driver' | 'ems_dispatch' | 'ems_responder') => void;
    profile: Profile;
    onNotificationClick: (notification: Notification) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView, profile, onNotificationClick }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPTTModalOpen, setIsPTTModalOpen] = useState(false);
  const [pendingSharesCount, setPendingSharesCount] = useState(0);
  const [isSharingModalOpen, setIsSharingModalOpen] = useState(false);
  const [isChangeLogOpen, setIsChangeLogOpen] = useState(false);
  const [alarmMuted, setAlarmMutedState] = useState(() => isAlarmMuted());
  const { mainLogoUrl, faviconUrl, defaultLogoUrl } = useSettings();

  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const prevUnreadCount = useRef(0);
  
  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);
  const canAccessAdminPages = [UserRole.ADMIN, UserRole.MODERATOR].includes(profile.role);

  // Subscribe and fetch pending report shares count dynamically
  useEffect(() => {
    if (!profile || !profile.company_id) return;
    
    const fetchPendingShares = async () => {
        try {
            const { data, error } = await supabase
                .from('report_shares')
                .select('id')
                .eq('target_company_id', profile.company_id)
                .eq('status', 'pending');
            if (error) console.error("Error fetching pending shares in Header:", error);
            else setPendingSharesCount(data ? data.length : 0);
        } catch (err) {
            console.error("Header: Error fetching pending shares:", err);
        }
    };
    
    fetchPendingShares();

    if (!supabase) return;

    const sharesChannel = supabase
        .channel(`shares-${profile.company_id}`)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'report_shares'
        }, () => {
            fetchPendingShares();
        })
        .subscribe();

    return () => {
        if (supabase) {
            supabase.removeChannel(sharesChannel);
        }
    };
  }, [profile]);

  // Sync mute state on custom events
  useEffect(() => {
    const handleMuteSync = (e: any) => {
      if (e.detail && typeof e.detail.muted === 'boolean') {
        setAlarmMutedState(e.detail.muted);
      }
    };
    window.addEventListener('alarm-mute-changed' as any, handleMuteSync);
    return () => window.removeEventListener('alarm-mute-changed' as any, handleMuteSync);
  }, []);

  // Global Real-time Dispatch Alarm: Trigger loud siren whenever any new report is filed across the network
  useEffect(() => {
    if (!profile || !supabase) return;

    const handleIncomingReport = (payload: any, reportType: 'crime' | 'vehicle' | 'emergency') => {
      const newReport = payload.new;
      if (!newReport) return;

      // Do not re-alarm if filed directly by this active user session (already played on submit)
      if (newReport.reported_by === profile.id) return;

      // Check relevancy for non-global admin
      const isGlobalAdmin = profile.role === UserRole.ADMIN && (profile.company?.name?.toLowerCase().includes('rapid911') || false);
      const isRelevant = isGlobalAdmin || 
                         newReport.is_global || 
                         newReport.company_id === profile.company_id ||
                         (newReport.shared_with_company_ids && newReport.shared_with_company_ids.includes(profile.company_id)) ||
                         newReport.assigned_to === profile.id ||
                         profile.role === UserRole.CONTROLLER;

      if (!isRelevant) return;

      // Sound loud tactical emergency alarm
      playLoudReportAlarm({
        id: newReport.id,
        ob_number: newReport.ob_number,
        title: newReport.title || newReport.license_plate || newReport.emergency_type || newReport.crime_type || 'Incoming Incident Report',
        type: reportType,
        location: newReport.location || newReport.last_seen_location,
        severity: newReport.severity,
      });
    };

    const globalAlarmChannel = supabase.channel(`global-alarm-reports-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crime_reports' }, p => handleIncomingReport(p, 'crime'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vehicle_reports' }, p => handleIncomingReport(p, 'vehicle'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emergency_reports' }, p => handleIncomingReport(p, 'emergency'))
      .subscribe();

    return () => {
      supabase.removeChannel(globalAlarmChannel);
    };
  }, [profile]);

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
       document.title = 'Rapid Report';
    };
  }, [faviconUrl]);

  useEffect(() => {
    if (!profile) return;
    
    const fetchInitialData = async () => {
        if (!supabase) return;
        try {
            const { data: notificationsData, error: notificationsError } = await supabase
                .from('notifications')
                .select('*')
                .eq('recipient_user_id', profile.id)
                .order('created_at', { ascending: false })
                .limit(30);
            if (notificationsError) console.error("Error fetching notifications:", notificationsError);
            else setNotifications(notificationsData || []);
        } catch (err) {
            console.error("Header: Error fetching notifications:", err);
        }
    };
    
    fetchInitialData();

    if (!supabase) return;

    const handleNotificationChange = (payload: any) => {
        setNotifications(currentNotifications => {
            if (payload.eventType === 'INSERT') {
                const newNotification = payload.new as Notification;
                // Avoid duplicates from race conditions
                if (currentNotifications.some(n => n.id === newNotification.id)) return currentNotifications;
                return [newNotification, ...currentNotifications.slice(0, 29)];
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
        if (supabase) {
            supabase.removeChannel(notificationsChannel);
        }
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

  const navLinkClasses = (view: string) => {
    const isActive = currentView === view;
    return `relative inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wider uppercase whitespace-nowrap flex-shrink-0 transition-all duration-200 cursor-pointer ${
      isActive 
        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 dark:bg-blue-600 dark:text-white dark:shadow-blue-500/30 scale-[1.02]' 
        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-gray-800/60'
    }`;
  };
      
  const mobileNavLinkClasses = (view: string) => {
    const isActive = currentView === view;
    return `flex items-center w-full text-left text-xs font-black tracking-wider uppercase px-4 py-3 rounded-xl transition-all duration-200 ${
      isActive 
        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/70'
    }`;
  };

  const handleLogout = async () => {
    if (profile) {
      await logUserAction(profile.id, 'USER_SIGNOUT', `User ${profile.email} signed out`);
    }
    if (supabase) {
        await supabase.auth.signOut();
    }
    setMobileMenuOpen(false);
  };

  const handleMobileLinkClick = (view: 'dashboard' | 'archives' | 'analytics' | 'map' | 'users' | 'companies' | 'profile' | 'controller' | 'activity_logs' | 'guard_monitoring' | 'gate_access' | 'global_search' | 'patrol_scanner' | 'attendance' | 'technician_dashboard' | 'tech_ops' | 'about' | 'roadside_driver' | 'ems_dispatch' | 'ems_responder') => {
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
    if (unreadIds.length > 0 && supabase) {
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
    const clickHandler = (view: any) => mobile ? handleMobileLinkClick(view) : setView(view);
    const classGetter = mobile ? mobileNavLinkClasses : navLinkClasses;

    const isModuleAllowed = (modId: string): boolean => {
      if ([UserRole.ADMIN, UserRole.MODERATOR].includes(profile.role)) return true;
      if (!profile.company) return true;
      const isRapid911 = profile.company.name?.toLowerCase().includes('rapid911') || false;
      if (isRapid911) return true;
      
      if (!profile.company.allowed_modules || profile.company.allowed_modules.length === 0) return true;
      if (profile.company.allowed_modules.includes(modId)) return true;
      if (modId === 'roadside_driver') {
        return profile.company.allowed_modules.includes('roadside') ||
               profile.company.allowed_modules.includes('roadside_driver') ||
               profile.company.allowed_modules.includes('roadside_assistance') ||
               profile.role === UserRole.CONTROLLER;
      }
      return false;
    };

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
          {isModuleAllowed('gate_access') && (
            <button onClick={() => clickHandler('gate_access')} className={classGetter('gate_access')}>
              <ClipboardCheckIcon className="w-4 h-4 mr-2" /> Gate Access
            </button>
          )}
          {isModuleAllowed('guard_monitoring') && (
            <button onClick={() => clickHandler('patrol_scanner')} className={classGetter('patrol_scanner')}>
              <ScanIcon className="w-4 h-4 mr-2" /> Patrolling
            </button>
          )}
        </>
      );
    }

    if (profile.role === UserRole.CONTROLLER) {
      return (
        <>
          {isModuleAllowed('controller') && (
            <button onClick={() => clickHandler('controller')} className={classGetter('controller')}>
              <RadioTowerIcon className="w-4 h-4 mr-2" /> Controller
            </button>
          )}
          {isModuleAllowed('ems_dispatch') && (
            <button onClick={() => clickHandler('ems_dispatch')} className={classGetter('ems_dispatch')}>
              <AmbulanceIcon className="w-4 h-4 mr-2 text-red-500 dark:text-red-400" /> EMS Dispatch
            </button>
          )}
          {isModuleAllowed('ems_dispatch') && (
            <button onClick={() => clickHandler('ems_responder')} className={classGetter('ems_responder')}>
              <HeartPulseIcon className="w-4 h-4 mr-2 text-rose-500 dark:text-rose-400" /> EMS Responder
            </button>
          )}
          {isModuleAllowed('roadside_driver') && (
            <button onClick={() => clickHandler('roadside_driver')} className={classGetter('roadside_driver')}>
              <WrenchIcon className="w-4 h-4 mr-2 text-amber-500 dark:text-amber-400" /> Roadside Driver
            </button>
          )}
          {isModuleAllowed('tech_ops') && (
            <button onClick={() => clickHandler('tech_ops')} className={classGetter('tech_ops')}>
              <WrenchIcon className="w-4 h-4 mr-2 text-teal-400" /> Tech Ops
            </button>
          )}
          {isModuleAllowed('guard_monitoring') && (
            <button onClick={() => clickHandler('guard_monitoring')} className={classGetter('guard_monitoring')}>
              <BuildingIcon className="w-4 h-4 mr-2" /> Guarding
            </button>
          )}
          {isModuleAllowed('attendance') && (
            <button onClick={() => clickHandler('attendance')} className={classGetter('attendance')}>
              <ClipboardCheckIcon className="w-4 h-4 mr-2" /> Attendance
            </button>
          )}
          <button onClick={() => clickHandler('global_search')} className={classGetter('global_search')}>
            <SearchIcon className="w-4 h-4 mr-2" /> Global Search
          </button>
        </>
      );
    }

    if (profile.role === UserRole.EMS_RESPONDER || (profile.role as string) === 'ems_responder') {
      return (
        <>
          <button onClick={() => clickHandler('ems_dispatch')} className={classGetter('ems_dispatch')}>
            <AmbulanceIcon className="w-4 h-4 mr-2 text-red-500 dark:text-red-400" /> Dispatch Queue
          </button>
          <button onClick={() => clickHandler('ems_responder')} className={classGetter('ems_responder')}>
            <HeartPulseIcon className="w-4 h-4 mr-2 text-rose-500 dark:text-rose-400" /> EMS Responder
          </button>
        </>
      );
    }

    if (profile.role === UserRole.RESPONDER) {
      return (
        <>
          <button onClick={() => clickHandler('ems_dispatch')} className={classGetter('ems_dispatch')}>
            <AmbulanceIcon className="w-4 h-4 mr-2 text-red-500 dark:text-red-400" /> Dispatch Queue
          </button>
          <button onClick={() => clickHandler('ems_responder')} className={classGetter('ems_responder')}>
            <HeartPulseIcon className="w-4 h-4 mr-2 text-rose-500 dark:text-rose-400" /> Responder Console
          </button>
        </>
      );
    }

    if (profile.role === UserRole.EMS_CONTROLLER || (profile.role as string) === 'ems_controller') {
      return (
        <>
          <button onClick={() => clickHandler('ems_dispatch')} className={classGetter('ems_dispatch')}>
            <AmbulanceIcon className="w-4 h-4 mr-2 text-red-500 dark:text-red-400" /> EMS Dispatch
          </button>
        </>
      );
    }

    if (profile.role === UserRole.RAS_DRIVER || (profile.role as string) === 'roadside_driver' || (profile.role as string) === 'driver') {
      return (
        <>
          <button onClick={() => clickHandler('roadside_driver')} className={classGetter('roadside_driver')}>
            <WrenchIcon className="w-4 h-4 mr-2 text-teal-500" /> Roadside Operations
          </button>
        </>
      );
    }

    if (profile.role === UserRole.TECHNICIAN) {
      return (
        <>
          <button onClick={() => clickHandler('technician_dashboard')} className={classGetter('technician_dashboard')}>
            <WrenchIcon className="w-4 h-4 mr-2" /> Tech Ops
          </button>
        </>
      );
    }
  
    // For Admin/Moderator
    return (
      <>
        <button onClick={() => clickHandler('dashboard')} className={classGetter('dashboard')}>
          <GlobeIcon className="w-4 h-4 mr-2" /> Dashboard
        </button>
        {isModuleAllowed('controller') && (
          <button onClick={() => clickHandler('controller')} className={classGetter('controller')}>
            <RadioTowerIcon className="w-4 h-4 mr-2" /> Controller
          </button>
        )}
        {isModuleAllowed('ems_dispatch') && (
          <button onClick={() => clickHandler('ems_dispatch')} className={classGetter('ems_dispatch')}>
            <AmbulanceIcon className="w-4 h-4 mr-2 text-red-500 dark:text-red-400" /> EMS Dispatch
          </button>
        )}
        {isModuleAllowed('ems_dispatch') && (
          <button onClick={() => clickHandler('ems_responder')} className={classGetter('ems_responder')}>
            <HeartPulseIcon className="w-4 h-4 mr-2 text-rose-500 dark:text-rose-400" /> EMS Responder
          </button>
        )}
        {isModuleAllowed('roadside_driver') && (
          <button onClick={() => clickHandler('roadside_driver')} className={classGetter('roadside_driver')}>
            <WrenchIcon className="w-4 h-4 mr-2 text-amber-500 dark:text-amber-400" /> Roadside Driver
          </button>
        )}
        {isModuleAllowed('tech_ops') && (
          <button onClick={() => clickHandler('tech_ops')} className={classGetter('tech_ops')}>
            <WrenchIcon className="w-4 h-4 mr-2 text-teal-400" /> Tech Ops
          </button>
        )}
        {isModuleAllowed('guard_monitoring') && (
          <button onClick={() => clickHandler('guard_monitoring')} className={classGetter('guard_monitoring')}>
            <BuildingIcon className="w-4 h-4 mr-2" /> Guarding
          </button>
        )}
        {isModuleAllowed('attendance') && (
          <button onClick={() => clickHandler('attendance')} className={classGetter('attendance')}>
            <ClipboardCheckIcon className="w-4 h-4 mr-2" /> Attendance
          </button>
        )}
        {isModuleAllowed('archives') && (
          <button onClick={() => clickHandler('archives')} className={classGetter('archives')}>
            <HistoryIcon className="w-4 h-4 mr-2" /> Archives
          </button>
        )}
        <button onClick={() => clickHandler('global_search')} className={classGetter('global_search')}>
          <SearchIcon className="w-4 h-4 mr-2" /> Global Search
        </button>
        {isModuleAllowed('analytics') && (
          <button onClick={() => clickHandler('analytics')} className={classGetter('analytics')}>
            <ChartBarIcon className="w-4 h-4 mr-2" /> Analytics
          </button>
        )}
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

  const isDriver = profile.role === UserRole.RAS_DRIVER || (profile.role as string) === 'roadside_driver' || (profile.role as string) === 'driver';
  const headerContainerClasses = currentView === 'controller' || currentView === 'roadside_driver' || profile.role === UserRole.RESPONDER || isDriver || profile.role === UserRole.USER
    ? "px-4 sm:px-6 lg:px-8" // Full-width views
    : "container mx-auto px-4 sm:px-6 lg:px-8"; // Centered for others

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/70 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700/50 transition-colors duration-300 print:hidden">
      <div className={headerContainerClasses}>
          <div className="flex items-center justify-between min-h-[3rem] sm:min-h-[4rem] py-0.5">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            <img 
              src={profile.company?.logo_url || mainLogoUrl || defaultLogoUrl} 
              alt="Logo" 
              className="main-logo w-auto min-w-[50px] sm:min-w-[60px] h-8 sm:h-20 object-contain transition-all duration-300 opacity-0" 
              onLoad={(e) => { e.currentTarget.style.opacity = '1'; }}
              onError={(e) => { 
                  e.currentTarget.style.opacity = '1';
                  if (e.currentTarget.src !== (mainLogoUrl || defaultLogoUrl)) {
                      e.currentTarget.src = mainLogoUrl || defaultLogoUrl;
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
          
          <div className="flex items-center space-x-2.5 sm:space-x-4 flex-shrink-0">
            <div className="hidden lg:block scale-75 xl:scale-90 origin-right mr-1">
              <LedClock />
            </div>
            <ThemeToggle />
            {profile.company_id && (
                <button onClick={() => setIsPTTModalOpen(true)} className="relative text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors duration-300" title="Push-to-Talk">
                  <RadioTowerIcon className="w-6.5 h-6.5 sm:w-10 sm:h-10" />
                </button>
            )}
            {profile.company_id && (
                <button 
                  onClick={() => setIsSharingModalOpen(true)} 
                  className={`relative p-1 rounded-xl transition-all duration-350 ${
                    pendingSharesCount > 0 
                      ? 'text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 animate-pulse' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/40'
                  }`} 
                  title="Corporate Sharing Hub (Incoming Requests & Approvals)"
                >
                  <ShareIcon className="w-4.5 h-4.5 sm:w-6.5 sm:h-6.5" />
                  {pendingSharesCount > 0 && (
                     <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-600 rounded-full text-[8px] flex items-center justify-center text-white font-black">{pendingSharesCount}</span>
                  )}
                </button>
            )}
            {/* Loud Report Alarm Status & Quick Control */}
            <div className="relative flex items-center">
              <button
                onClick={() => {
                  const newMuted = toggleAlarmMute();
                  setAlarmMutedState(newMuted);
                }}
                className={`relative p-1.5 sm:p-2 rounded-xl transition-all duration-300 flex items-center gap-1.5 ${
                  alarmMuted
                    ? 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100/60 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800'
                    : 'text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 shadow-xs'
                }`}
                title={alarmMuted ? 'Loud Dispatch Alarm: MUTED (Click to activate siren)' : 'Loud Dispatch Alarm: ACTIVE (Click to mute)'}
              >
                {alarmMuted ? (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                ) : (
                  <div className="flex items-center">
                    <Siren className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400 animate-pulse" />
                    <span className="hidden xl:inline text-[10px] font-black uppercase tracking-wider ml-1 text-red-700 dark:text-red-300">
                      Alarm
                    </span>
                  </div>
                )}
              </button>
            </div>

            <div ref={notificationsRef} className="relative">
                <button onClick={toggleNotifications} className="relative text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors duration-300">
                  <BellIcon className="w-4.5 h-4.5 sm:w-6 h-6" />
                  {unreadCount > 0 && (
                     <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full text-[8px] flex items-center justify-center text-white">{unreadCount}</span>
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
                  className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 transition"
                />
                <span className="hidden sm:inline text-gray-900 dark:text-white text-xs lg:text-sm font-medium truncate max-w-[60px] lg:max-w-[120px]">{`${profile.first_name} ${profile.surname}`}</span>
                <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white/90 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 py-1">
                  <button onClick={() => { setView('profile'); setDropdownOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-black dark:hover:text-white">Profile</button>
                  <button onClick={() => { setIsChangeLogOpen(true); setDropdownOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-between">
                    <span>System Change Log</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">v3.6.0</span>
                  </button>
                  <button onClick={() => { setView('about'); setDropdownOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-black dark:hover:text-white">User Manual</button>
                  <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-black dark:hover:text-white">Settings</a>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-700 dark:hover:text-red-300">Logout</button>
                </div>
              )}
            </div>
            <div className="md:hidden">
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    {mobileMenuOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
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
                 <button onClick={() => { setIsChangeLogOpen(true); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-3 text-lg font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md">System Change Log (v3.6.0)</button>
                 <button onClick={() => handleMobileLinkClick('about')} className={mobileNavLinkClasses('about' as any)}>User Manual</button>
                 <button onClick={handleLogout} className="block w-full text-left px-4 py-3 text-lg text-red-500 dark:text-red-400 hover:bg-red-500/10 rounded-md">Logout</button>
            </div>
          </nav>
      </div>
    </header>
    <PTTModal isOpen={isPTTModalOpen} onClose={() => setIsPTTModalOpen(false)} profile={profile} />
    <CorporateSharingModal isOpen={isSharingModalOpen} onClose={() => setIsSharingModalOpen(false)} profile={profile} />
    <ChangeLogModal isOpen={isChangeLogOpen} onClose={() => setIsChangeLogOpen(false)} />
    </>
  );
};

export default memo(Header);