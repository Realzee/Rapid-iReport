
import React, { useState, useEffect } from 'react';
import { BellIcon, ChevronDownIcon, MenuIcon, XIcon } from './icons';
import { Profile, UserRole } from '../types';
import { supabase } from '../utils/supabase';
import { logoUrl } from '../assets/logo';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
    currentView: string;
    setView: (view: 'dashboard' | 'reports' | 'map' | 'users' | 'companies' | 'profile') => void;
    profile: Profile;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView, profile }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Define which roles see the "Controller" view vs the regular "Dashboard"
  const isControllerRole = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER].includes(profile.role);
  const dashboardLinkText = isControllerRole ? 'Controller' : 'Dashboard';

  const navLinkClasses = (view: string) => 
      `text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors duration-300 px-3 py-2 rounded-md ${
        currentView === view ? 'bg-gray-200 dark:bg-gray-700/50 text-black dark:text-white' : ''
      }`;
      
  const mobileNavLinkClasses = (view: string) => 
      `block w-full text-left text-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-300 px-4 py-3 rounded-md ${
        currentView === view ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300' : ''
      }`;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMobileMenuOpen(false);
  };

  const handleMobileLinkClick = (view: 'dashboard' | 'reports' | 'map' | 'users' | 'companies' | 'profile') => {
      setView(view);
      setMobileMenuOpen(false);
  }
  
  // Disable body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [mobileMenuOpen]);

  const canAccessAdminPages = [UserRole.ADMIN, UserRole.MODERATOR].includes(profile.role);

  const NavLinks: React.FC<{mobile?: boolean}> = ({ mobile = false}) => (
    <>
      <button onClick={() => mobile ? handleMobileLinkClick('dashboard') : setView('dashboard')} className={mobile ? mobileNavLinkClasses('dashboard') : navLinkClasses('dashboard')}>{dashboardLinkText}</button>
      <button onClick={() => mobile ? handleMobileLinkClick('reports') : setView('reports')} className={mobile ? mobileNavLinkClasses('reports') : navLinkClasses('reports')}>Reports</button>
      <button onClick={() => mobile ? handleMobileLinkClick('map') : setView('map')} className={mobile ? mobileNavLinkClasses('map') : navLinkClasses('map')}>Map</button>
      {canAccessAdminPages && (
        <>
          <button onClick={() => mobile ? handleMobileLinkClick('users') : setView('users')} className={mobile ? mobileNavLinkClasses('users') : navLinkClasses('users')}>Users</button>
          <button onClick={() => mobile ? handleMobileLinkClick('companies') : setView('companies')} className={mobile ? mobileNavLinkClasses('companies') : navLinkClasses('companies')}>Companies</button>
        </>
      )}
    </>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/70 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700/50 transition-colors duration-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-2">
            <img src={logoUrl} alt="RAPID REPORTING Logo" className="w-auto h-10" />
          </div>
          <nav className="hidden md:flex items-center space-x-2">
            <NavLinks />
          </nav>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <button className="relative text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors duration-300">
              <BellIcon className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-xs flex items-center justify-center text-white">3</span>
            </button>
            <div className="hidden md:flex relative">
              <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center space-x-2">
                <img 
                  src={profile.avatar_url || `https://i.pravatar.cc/40?u=${profile.id}`} 
                  alt="User Avatar"
                  className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 transition"
                />
                <span className="hidden sm:inline text-gray-900 dark:text-white">{profile.full_name}</span>
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
  );
};

export default Header;
