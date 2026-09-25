import React, { useState, useEffect } from 'react';
import { AlarmReportDetails, isAlarmMuted, toggleAlarmMute, playLoudReportAlarm } from '../utils/notificationUtils';
import { Volume2, VolumeX, AlertTriangle, Radio, X, ExternalLink, ShieldAlert } from 'lucide-react';

interface LoudAlarmBannerProps {
  onViewReport?: (reportId: string) => void;
}

export const LoudAlarmBanner: React.FC<LoudAlarmBannerProps> = ({ onViewReport }) => {
  const [alarmActive, setAlarmActive] = useState(false);
  const [reportDetails, setReportDetails] = useState<AlarmReportDetails | null>(null);
  const [muted, setMuted] = useState(isAlarmMuted());

  useEffect(() => {
    const handleAlarmEvent = (e: CustomEvent<AlarmReportDetails>) => {
      setReportDetails(e.detail || null);
      setAlarmActive(true);

      // Auto-hide after 8 seconds
      const timer = setTimeout(() => {
        setAlarmActive(false);
      }, 8000);

      return () => clearTimeout(timer);
    };

    const handleMuteChange = (e: CustomEvent<{ muted: boolean }>) => {
      setMuted(e.detail.muted);
    };

    window.addEventListener('new-report-alarm' as any, handleAlarmEvent);
    window.addEventListener('alarm-mute-changed' as any, handleMuteChange);

    return () => {
      window.removeEventListener('new-report-alarm' as any, handleAlarmEvent);
      window.removeEventListener('alarm-mute-changed' as any, handleMuteChange);
    };
  }, []);

  const handleToggleMute = () => {
    const newMuted = toggleAlarmMute();
    setMuted(newMuted);
  };

  const handleDismiss = () => {
    setAlarmActive(false);
  };

  if (!alarmActive) return null;

  const obNumber = reportDetails?.ob_number || 'NEW DISPATCH';
  const title = reportDetails?.title || reportDetails?.category || 'Incoming Incident Report';
  const type = reportDetails?.type || 'incident';
  const location = reportDetails?.location;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[95%] max-w-xl animate-in slide-in-from-top-4 duration-300">
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white rounded-2xl p-4 shadow-2xl border-2 border-white/30 flex items-center justify-between gap-3 relative overflow-hidden ring-4 ring-red-500/30">
        {/* Pulsing Alert Background Glow */}
        <div className="absolute inset-0 bg-red-500/20 animate-ping pointer-events-none" />

        {/* Alarm Siren Icon & Soundwaves */}
        <div className="flex items-center gap-3 relative z-10 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/40 shadow-inner">
            <ShieldAlert className="w-6 h-6 text-white animate-bounce" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-black/40 text-amber-300 font-mono">
                🚨 LOUD ALARM • {obNumber}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 hidden sm:inline">
                {type}
              </span>
            </div>
            <p className="text-sm font-black text-white truncate drop-shadow-sm mt-0.5">
              {title}
            </p>
            {location && (
              <p className="text-[11px] text-white/90 truncate font-mono">
                📍 {location}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 relative z-10 shrink-0">
          {/* Mute / Unmute Button */}
          <button
            onClick={handleToggleMute}
            title={muted ? 'Unmute Alarm' : 'Silence / Mute Alarm'}
            className="p-2 rounded-xl bg-black/20 hover:bg-black/40 text-white transition-colors border border-white/20"
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-200" /> : <Volume2 className="w-4 h-4 text-green-200 animate-pulse" />}
          </button>

          {/* View Details Button */}
          {onViewReport && reportDetails?.id && (
            <button
              onClick={() => {
                onViewReport(reportDetails.id!);
                handleDismiss();
              }}
              className="px-3 py-1.5 rounded-xl bg-white text-red-700 hover:bg-red-50 font-bold text-xs transition-colors shadow-sm flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View</span>
            </button>
          )}

          {/* Dismiss Button */}
          <button
            onClick={handleDismiss}
            title="Dismiss Alert"
            className="p-2 rounded-xl bg-black/20 hover:bg-black/40 text-white transition-colors border border-white/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoudAlarmBanner;
