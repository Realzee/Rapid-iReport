import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AuthPage from './pages/AuthPage';
import UsersPage from './pages/UsersPage';
import CompaniesPage from './pages/CompaniesPage';
import { supabase } from './utils/supabase';
import { Session } from '@supabase/supabase-js';
import { Profile } from './types';

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
    if (session?.user) {
        const fetchProfile = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
            
            if (error) {
                console.error('Error fetching profile:', error);
            } else {
                setProfile(data);
            }
        };
        fetchProfile();
    } else {
        setProfile(null);
    }
  }, [session]);


  const renderView = () => {
    switch(view) {
      case 'dashboard':
        return <Dashboard />;
      case 'users':
        return <UsersPage />;
      case 'companies':
        return <CompaniesPage />;
      default:
        return <Dashboard />;
    }
  }

  if (loading) {
    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
             <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-black via-gray-900/50 to-black z-0"></div>
      <div 
        className="absolute top-[20%] left-[10%] w-72 h-72 bg-blue-600/50 rounded-full filter blur-3xl opacity-20 animate-pulse"
        style={{ animationDuration: '8s' }}
      ></div>
      <div 
        className="absolute bottom-[5%] right-[5%] w-96 h-96 bg-red-600/50 rounded-full filter blur-3xl opacity-20 animate-pulse"
        style={{ animationDuration: '10s' }}
      ></div>
      
      <div className="relative z-10">
        {session && profile ? (
          <>
            <Header currentView={view} setView={setView} profile={profile} />
            <main className="pt-24 px-4 sm:px-6 lg:px-8">
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