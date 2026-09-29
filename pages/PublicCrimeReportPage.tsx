import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Company, Announcement } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import ThemeToggle from '../components/ThemeToggle';
import { LoadingSpinner } from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import AnnouncementsPanel from '../components/AnnouncementsPanel';
import { 
  CrimeIcon, 
  CheckIcon, 
  SearchIcon, 
  LockIcon, 
  UserIcon, 
  ZapIcon,
  ClockIcon
} from '../components/icons';
import { ArrowRight, ShieldCheck, PhoneCall } from 'lucide-react';

interface PublicCrimeReportPageProps {
  onBackToLogin: () => void;
  onGoToRegister?: () => void;
  initialTab?: 'report' | 'bulletins' | 'track';
}

export const PublicCrimeReportPage: React.FC<PublicCrimeReportPageProps> = ({ onBackToLogin, onGoToRegister, initialTab = 'report' }) => {
  const [activeTab, setActiveTab] = useState<'report' | 'bulletins' | 'track'>(initialTab);
  const { mainLogoUrl, defaultLogoUrl } = useSettings();
  const { addToast } = useToast();

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  // Tracking Search State
  const [trackQuery, setTrackQuery] = useState('');
  const [isSearchingTrack, setIsSearchingTrack] = useState(false);
  const [trackedReport, setTrackedReport] = useState<any | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  const loadBulletins = async () => {
    setLoadingAnnouncements(true);
    try {
      if (supabase) {
        const { data: announcementsData } = await supabase
          .from('announcements')
          .select('*')
          .or('expires_at.is.null,expires_at.gt.now()')
          .order('created_at', { ascending: false })
          .limit(15);
        setAnnouncements(announcementsData || []);
      }
    } catch (e) {
      console.warn('Error loading public announcements:', e);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bulletins') {
      loadBulletins();
    }
  }, [activeTab]);

  // Track Report Search Handler
  const handleTrackSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!trackQuery.trim()) {
      addToast('Please enter an OB reference number.', 'warning');
      return;
    }

    setIsSearchingTrack(true);
    setTrackError(null);
    setTrackedReport(null);

    try {
      const res = await fetch(`/api/public-report?ob_number=${encodeURIComponent(trackQuery.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setTrackError(data.error || 'No report found matching this reference code.');
      } else {
        setTrackedReport(data.report);
      }
    } catch (err: any) {
      setTrackError('Failed to communicate with tracking service. Please check your connection.');
    } finally {
      setIsSearchingTrack(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300 relative">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-blue-500/5 dark:bg-cyan-500/5 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-1/3 right-10 w-80 h-80 bg-indigo-500/5 dark:bg-blue-600/5 blur-3xl pointer-events-none rounded-full" />

      {/* Emergency Hotline Header Banner */}
      <div className="bg-red-600 text-white text-xs font-semibold py-2 px-4 shadow-md flex items-center justify-between flex-wrap gap-2 z-30">
        <div className="flex items-center gap-2 max-w-4xl mx-auto w-full justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span>PUBLIC SAFETY EMERGENCY DISPATCH PORTAL</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <a href="tel:10111" className="hover:underline flex items-center gap-1 font-bold bg-white/20 px-2 py-0.5 rounded">
              <PhoneCall className="w-3 h-3 inline" /> Police: 10111
            </a>
            <a href="tel:112" className="hover:underline flex items-center gap-1 font-bold bg-white/20 px-2 py-0.5 rounded">
              <PhoneCall className="w-3 h-3 inline" /> Emergency: 112
            </a>
          </div>
        </div>
      </div>

      {/* Main Top Navigation */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <img
              src={mainLogoUrl}
              alt="Rapid911 Logo"
              className="h-12 sm:h-14 w-auto object-contain cursor-pointer"
              onClick={() => setActiveTab('report')}
              onError={(e) => {
                e.currentTarget.src = defaultLogoUrl;
              }}
            />
            <div className="border-l border-gray-300 dark:border-gray-700 pl-3 sm:pl-4">
              <h1 className="text-base sm:text-lg font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                COMMUNITY CRIME DESK
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-mono">
                Rapid Incident & Tip-off Network
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <button
              onClick={onBackToLogin}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-all flex items-center gap-1.5 border border-gray-300/60 dark:border-gray-700"
            >
              <LockIcon className="w-3.5 h-3.5" />
              <span>Operator Login</span>
            </button>
          </div>
        </div>

        {/* Tab Selector Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 sm:space-x-4 border-t border-gray-100 dark:border-gray-850 pt-2 pb-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'report'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <CrimeIcon className="w-4 h-4" />
            <span>Report a Crime / Incident</span>
          </button>

          <button
            onClick={() => setActiveTab('track')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'track'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <SearchIcon className="w-4 h-4" />
            <span>Track Incident Status</span>
          </button>

          <button
            onClick={() => setActiveTab('bulletins')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'bulletins'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <ZapIcon className="w-4 h-4" />
            <span>Community Bulletins</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 z-10">

        {/* ----------------- VIEW 1: MANDATORY COMMUNITY REGISTRATION REQUIREMENT ----------------- */}
        {activeTab === 'report' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
              {/* Top ambient color bar */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 via-blue-600 to-indigo-600" />
              
              <div className="text-center max-w-2xl mx-auto space-y-5">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 text-blue-600 dark:text-cyan-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <ShieldCheck className="w-10 h-10 animate-pulse" />
                </div>

                <div>
                  <span className="px-3.5 py-1.5 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 font-mono font-black text-[11px] rounded-full uppercase tracking-wider border border-red-200 dark:border-red-900 inline-flex items-center gap-1.5">
                    <span>🔒</span> MANDATORY COMMUNITY REGISTRATION REQUIRED
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-3 tracking-tight">
                    Register Before Submitting Incident Reports
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                    To eliminate false reporting, protect community safety, and ensure emergency response units are dispatched immediately with verified details, all community members and residents must create an account before reporting.
                  </p>
                </div>

                {/* 3 Core Security & Response Pillars */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-left pt-2">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                    <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-base mb-2.5">
                      🛡️
                    </div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white">
                      Anti-Hoax Protection
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-normal">
                      Verified member profiles prevent fake or prank alarms, ensuring priority response from armed patrol and emergency units.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base mb-2.5">
                      ⚡
                    </div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white">
                      Live Telemetry & GPS
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-normal">
                      Receive real-time tactical dispatch telemetry, officer ETA updates, and direct encrypted chat with control room dispatchers.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base mb-2.5">
                      📑
                    </div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-900 dark:text-white">
                      Official OB Logbook
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-normal">
                      Automated official OB reference numbers, digital photo evidence vault, and instant PDF extracts for insurance or SAPS.
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onGoToRegister || onBackToLogin}
                    className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-blue-600/25 transition-all flex items-center justify-center gap-2.5 transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <UserIcon className="w-5 h-5" />
                    <span>Create Community Account</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={onBackToLogin}
                    className="w-full sm:w-auto px-6 py-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 border border-gray-300/60 dark:border-gray-700"
                  >
                    <LockIcon className="w-4 h-4" />
                    <span>Sign In to Existing Account</span>
                  </button>
                </div>

                {/* Additional navigation shortcuts */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <button
                    type="button"
                    onClick={() => setActiveTab('track')}
                    className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors flex items-center gap-1"
                  >
                    🔍 Track an Existing Case by OB Number
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('bulletins')}
                    className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors flex items-center gap-1"
                  >
                    📢 Read Community Safety Bulletins
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- VIEW 2: TRACK A REPORT ----------------- */}
        {activeTab === 'track' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                Track Incident Status
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Enter your OB Reference Number (e.g. <span className="font-mono font-bold">PUB0001/09/2026</span>) to view current response progress.
              </p>

              <form onSubmit={handleTrackSearch} className="mt-6 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-grow">
                  <SearchIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={trackQuery}
                    onChange={(e) => setTrackQuery(e.target.value.toUpperCase())}
                    placeholder="Enter Reference (e.g. PUB0024/09/2026)"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-2xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase tracking-wider"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingTrack}
                  className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSearchingTrack ? <LoadingSpinner size="xs" variant="white" /> : <SearchIcon className="w-4 h-4" />}
                  <span>Check Status</span>
                </button>
              </form>

              {trackError && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-red-600 dark:text-red-400 text-sm">
                  {trackError}
                </div>
              )}

              {trackedReport && (
                <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 space-y-6">
                  {/* Status Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-2xl">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-widest text-blue-600 dark:text-cyan-400 font-bold">
                        Incident Reference
                      </span>
                      <h3 className="text-2xl font-mono font-black text-gray-900 dark:text-white">
                        {trackedReport.ob_number}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Reported: {new Date(trackedReport.reported_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="sm:text-right flex flex-col sm:items-end gap-1">
                      <StatusBadge status={trackedReport.status} size="lg" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                        {trackedReport.responding_agency}
                      </p>
                    </div>
                  </div>

                  {/* Visual Progress Stepper */}
                  <div className="p-6 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Response Progression</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      {[
                        { step: 1, title: '1. Logged & Dispatched' },
                        { step: 2, title: '2. Units En Route / Lookout' },
                        { step: 3, title: '3. Investigation on Scene' },
                        { step: 4, title: '4. Resolved & Concluded' },
                      ].map((s) => {
                        const isDone = trackedReport.status_info.stage >= s.step;
                        return (
                          <div
                            key={s.step}
                            className={`p-3 rounded-xl border transition-all ${
                              isDone
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold'
                                : 'bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 text-gray-400'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1 mb-1">
                              {isDone ? <CheckIcon className="w-4 h-4 text-emerald-500" /> : <ClockIcon className="w-3.5 h-3.5" />}
                              <span className="text-[10px] font-mono">STAGE {s.step}</span>
                            </div>
                            <p className="text-xs">{s.title}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Incident Details Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-1">
                      <span className="text-xs text-gray-400">Incident Category:</span>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{trackedReport.type}</p>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-1">
                      <span className="text-xs text-gray-400">Location Area:</span>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{trackedReport.location}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    💡 <span className="font-bold">Status Detail:</span> {trackedReport.status_info.description}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- VIEW 3: COMMUNITY SAFETY BULLETINS ----------------- */}
        {activeTab === 'bulletins' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <ZapIcon className="w-6 h-6 text-blue-600" />
                    <span>Live Community Safety Bulletins</span>
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Official crime alerts, security notices, and safety announcements from authorized personnel.
                  </p>
                </div>
                <button
                  onClick={loadBulletins}
                  disabled={loadingAnnouncements}
                  className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline"
                >
                  Refresh Feed
                </button>
              </div>

              {loadingAnnouncements ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <LoadingSpinner size="lg" variant="tactical" label="Loading bulletins feed..." />
                </div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">All Clear in Your Area</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
                    There are no active critical security warnings or high-priority lookouts right now.
                  </p>
                </div>
              ) : (
                <AnnouncementsPanel announcements={announcements} />
              )}
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 dark:border-gray-800/80 bg-white/70 dark:bg-gray-950/70 py-6 px-4 text-center text-xs text-gray-500 dark:text-gray-400 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={mainLogoUrl} alt="Rapid911 Logo" className="h-5 w-auto opacity-70" onError={(e) => { e.currentTarget.src = defaultLogoUrl; }} />
            <span>&copy; {new Date().getFullYear()} Rapid Emergency Incident & Crime Response Network</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <button onClick={() => { setActiveTab('report'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:underline">
              Report Crime
            </button>
            <button onClick={() => { setActiveTab('track'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:underline">
              Track Reference
            </button>
            <button onClick={onBackToLogin} className="hover:underline font-bold text-blue-600 dark:text-cyan-400">
              Operator Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicCrimeReportPage;
