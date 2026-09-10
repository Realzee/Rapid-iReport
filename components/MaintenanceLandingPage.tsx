import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Clock, 
  ShieldAlert, 
  Sparkles, 
  Server, 
  Zap, 
  Radio, 
  PhoneCall, 
  Lock, 
  CheckCircle2, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useSettings } from '../contexts/SettingsContext';
import { logoUrl as defaultLogoUrl } from '../assets/logo';

interface MaintenanceLandingPageProps {
  onBypass?: () => void;
  targetDate?: Date;
}

interface TimeRemaining {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export const MaintenanceLandingPage: React.FC<MaintenanceLandingPageProps> = ({ 
  onBypass,
  targetDate = new Date('2026-09-13T00:00:00')
}) => {
  const { mainLogoUrl } = useSettings();
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  // Calculate time remaining to 13/09/2026
  const calculateTimeRemaining = (): TimeRemaining => {
    const total = targetDate.getTime() - new Date().getTime();
    if (total <= 0) {
      return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return { total, days, hours, minutes, seconds, isExpired: false };
  };

  const [timeLeft, setTimeLeft] = useState<TimeRemaining>(calculateTimeRemaining);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const handleStaffUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    // Allow unlock with admin code or direct confirmation
    if (passcode.trim() === '911' || passcode.trim().toLowerCase() === 'admin' || passcode.trim().length > 0) {
      if (onBypass) onBypass();
    } else {
      setPasscodeError(true);
    }
  };

  const formattedTargetDate = targetDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }); // 13/09/2026

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden selection:bg-rose-500 selection:text-white font-sans">
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-rose-600/15 via-red-900/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[500px] h-[350px] bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-[400px] h-[300px] bg-amber-500/5 blur-3xl pointer-events-none" />
      
      {/* High-Tech Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b1a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b1a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Top Header Navigation */}
      <header className="relative z-20 border-b border-slate-800/60 bg-slate-950/60 backdrop-blur-xl px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src={mainLogoUrl || defaultLogoUrl} 
            alt="Rapid911 Logo" 
            className="h-10 sm:h-12 w-auto object-contain drop-shadow-md"
            onError={(e) => { e.currentTarget.src = defaultLogoUrl; }}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="w-2 h-2 rounded-full bg-rose-500 -ml-3" />
            System Upgrade Mode Active
          </div>
          <ThemeToggle />
          {onBypass && (
            <button
              onClick={() => setShowStaffModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-medium transition shadow-sm"
              title="Authorized Personnel Access"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Staff Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Center Content */}
      <main className="relative z-10 flex-grow flex flex-col items-center justify-center px-4 sm:px-6 py-12 max-w-5xl mx-auto w-full text-center">
        
        {/* Maintenance Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-blue-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-semibold mb-6 shadow-lg shadow-rose-950/30 animate-pulse">
          <Wrench className="w-4 h-4 text-rose-400" />
          <span>Scheduled Infrastructure Maintenance & Optimization</span>
        </div>

        {/* Primary Headline */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-4">
          App Under <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-red-500 to-amber-400">Maintenance</span>
        </h1>

        {/* Subtitle Message */}
        <p className="max-w-2xl text-slate-400 text-base sm:text-lg mb-10 leading-relaxed">
          We are currently upgrading the Rapid 911 dispatch backbone, optimizing cloud database infrastructure, and rolling out enhanced real-time community safety services.
        </p>

        {/* Countdown Timer Display */}
        <div className="w-full max-w-3xl mb-12">
          <div className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-4 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-rose-400" />
            <span>Estimated Service Resumption • Target: {formattedTargetDate}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Days Card */}
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 sm:p-6 backdrop-blur-md shadow-2xl relative overflow-hidden group hover:border-rose-500/40 transition duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-600" />
              <div className="text-4xl sm:text-6xl font-black text-white font-mono tracking-tight group-hover:scale-105 transition-transform duration-300">
                {String(timeLeft.days).padStart(2, '0')}
              </div>
              <div className="text-xs sm:text-sm font-bold tracking-widest uppercase text-slate-400 mt-2">
                Days
              </div>
            </div>

            {/* Hours Card */}
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 sm:p-6 backdrop-blur-md shadow-2xl relative overflow-hidden group hover:border-red-500/40 transition duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-amber-500" />
              <div className="text-4xl sm:text-6xl font-black text-white font-mono tracking-tight group-hover:scale-105 transition-transform duration-300">
                {String(timeLeft.hours).padStart(2, '0')}
              </div>
              <div className="text-xs sm:text-sm font-bold tracking-widest uppercase text-slate-400 mt-2">
                Hours
              </div>
            </div>

            {/* Minutes Card */}
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 sm:p-6 backdrop-blur-md shadow-2xl relative overflow-hidden group hover:border-amber-500/40 transition duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-500" />
              <div className="text-4xl sm:text-6xl font-black text-white font-mono tracking-tight group-hover:scale-105 transition-transform duration-300">
                {String(timeLeft.minutes).padStart(2, '0')}
              </div>
              <div className="text-xs sm:text-sm font-bold tracking-widest uppercase text-slate-400 mt-2">
                Minutes
              </div>
            </div>

            {/* Seconds Card */}
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 sm:p-6 backdrop-blur-md shadow-2xl relative overflow-hidden group hover:border-blue-500/40 transition duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-blue-500" />
              <div className="text-4xl sm:text-6xl font-black text-white font-mono tracking-tight text-rose-400 group-hover:scale-105 transition-transform duration-300">
                {String(timeLeft.seconds).padStart(2, '0')}
              </div>
              <div className="text-xs sm:text-sm font-bold tracking-widest uppercase text-slate-400 mt-2">
                Seconds
              </div>
            </div>
          </div>
        </div>

        {/* Upgrade Details & Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl text-left mb-10">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 text-rose-400" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Ultra-Low Latency Alerting</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Faster emergency broadcast dispatch engine with direct satellite and mobile push routing.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3">
              <Server className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Database Sharding & Egress Scale</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Expanding high-availability data layers and smart local caching to prevent rate limits.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
              <Radio className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">GIS Field Responder Tracking</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sub-second live patrol telemetry and roadside unit geolocation synchronization.
            </p>
          </div>
        </div>

        {/* Emergency Notice Footer Banner */}
        <div className="w-full max-w-4xl bg-rose-950/30 border border-rose-900/50 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0">
              <PhoneCall className="w-4 h-4 text-rose-400 animate-bounce" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white">24/7 Emergency Dispatch Center</p>
              <p className="text-xs text-slate-400">Emergency lines and roadside patrol radios remain operational without interruption.</p>
            </div>
          </div>
          <div className="text-xs font-mono font-bold text-rose-300 bg-rose-900/40 px-3 py-1.5 rounded-lg border border-rose-800/50 whitespace-nowrap">
            Priority Hotline Active
          </div>
        </div>

      </main>

      {/* Staff Bypass Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <Lock className="w-5 h-5 text-rose-500" />
                <span>Authorized Staff Access</span>
              </div>
              <button 
                onClick={() => {
                  setShowStaffModal(false);
                  setPasscodeError(false);
                }}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Enter your access passcode or proceed to the administrative login portal to bypass the maintenance landing page.
            </p>

            <form onSubmit={handleStaffUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Access Passcode / PIN
                </label>
                <input 
                  type="password"
                  placeholder="Enter passcode (e.g., 911)"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setPasscodeError(false);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500"
                  autoFocus
                />
                {passcodeError && (
                  <p className="text-xs text-rose-400 mt-1">Please enter a valid passcode or click proceed below.</p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2 px-4 rounded-lg text-sm transition flex items-center justify-center gap-1.5"
                >
                  <span>Unlock & Proceed</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onBypass) onBypass();
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-3 rounded-lg text-sm transition"
                >
                  Direct Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Footer */}
      <footer className="relative z-20 border-t border-slate-900 bg-slate-950/80 py-4 px-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <img src={mainLogoUrl || defaultLogoUrl} alt="Rapid911 Logo" className="w-auto h-3.5 opacity-60" onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} />
        <span>Copyright &copy; {new Date().getFullYear()} Rapid 911 Rapid Rescue PTY (Ltd). All rights reserved.</span>
      </footer>
    </div>
  );
};

export default MaintenanceLandingPage;
