import React, { useState } from 'react';
import { BellIcon, ChevronDownIcon, SunIcon, MoonIcon } from './icons';
import { Profile, UserRole } from '../types';
import { supabase } from '../utils/supabase';
import { logoUrl } from '../assets/logo';

interface HeaderProps {
    currentView: string;
    setView: (view: 'dashboard' | 'reports' | 'map' | 'users' | 'companies') => void;
    profile: Profile;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView, profile, theme, toggleTheme }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navLinkClasses = (view: string) => 
      `text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors duration-300 px-3 py-2 rounded-md ${
        currentView === view ? 'bg-gray-200 dark:bg-gray-700/50 text-black dark:text-white' : ''
      }`;

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error logging out:', error);
    }
  };

  const canAccessAdminPages = [UserRole.ADMIN, UserRole.MODERATOR].includes(profile.role);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/30 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-2">
            <img src={logoUrl} alt="RAPID REPORTING Logo" className="w-auto h-10" />
          </div>
          <nav className="hidden md:flex items-center space-x-2">
            <button onClick={() => setView('dashboard')} className={navLinkClasses('dashboard')}>Dashboard</button>
            <button onClick={() => setView('reports')} className={navLinkClasses('reports')}>Reports</button>
            <button onClick={() => setView('map')} className={navLinkClasses('map')}>Map</button>
            {canAccessAdminPages && (
              <>
                <button onClick={() => setView('users')} className={navLinkClasses('users')}>Users</button>
                <button onClick={() => setView('companies')} className={navLinkClasses('companies')}>Companies</button>
              </>
            )}
          </nav>
          <div className="flex items-center space-x-4">
            <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-300">
                {theme === 'dark' ? <SunIcon className="w-6 h-6 text-yellow-400" /> : <MoonIcon className="w-6 h-6 text-gray-700" />}
            </button>
            <button className="relative text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors duration-300">
              <BellIcon className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-xs flex items-center justify-center text-white">3</span>
            </button>
            <div className="relative">
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
                <div className="absolute right-0 mt-2 w-48 bg-white/90 dark:bg-gray-800/80 backdrop-blur-lg rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 py-1">
                  <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-black dark:hover:text-white">Profile</a>
                  <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-black dark:hover:text-white">Settings</a>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-700 dark:hover:text-red-300">Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;