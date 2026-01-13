import React, { useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AuthPage from './pages/AuthPage';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-black via-gray-900/50 to-black z-0"></div>
      <div 
        className="absolute top-[20%] left-[10%] w-72 h-72 bg-blue-600/50 rounded-full filter blur-3xl opacity-20 animate-pulse"
        style={{ animationDuration: '8s' }}
      ></div>
      <div 
        className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-red-600/50 rounded-full filter blur-3xl opacity-20 animate-pulse"
        style={{ animationDuration: '10s' }}
      ></div>
      
      <div className="relative z-10">
        {isAuthenticated ? (
          <>
            <Header />
            <main className="pt-24 px-4 sm:px-6 lg:px-8">
              <Dashboard />
            </main>
          </>
        ) : (
          <AuthPage onLoginSuccess={handleLogin} />
        )}
      </div>
    </div>
  );
};

export default App;
