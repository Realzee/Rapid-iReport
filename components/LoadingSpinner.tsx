import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type SpinnerVariant = 'themed' | 'tactical' | 'white' | 'current' | 'danger' | 'warning' | 'emerald';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
  label?: string;
  showRadarPulse?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'themed',
  className = '',
  label,
  showRadarPulse = false,
}) => {
  let theme: 'light' | 'dark' | 'matrix' = 'dark';
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
  } catch {
    // ThemeContext fallback if used outside provider
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'matrix') {
        theme = savedTheme;
      }
    }
  }

  // Dimension mapping
  const sizeMap: Record<SpinnerSize, { ring: string; inner: string; stroke: string; container: string }> = {
    xs: { ring: 'w-3.5 h-3.5', inner: 'w-2 h-2', stroke: 'border-2', container: 'gap-1.5' },
    sm: { ring: 'w-4 h-4', inner: 'w-2.5 h-2.5', stroke: 'border-2', container: 'gap-2' },
    md: { ring: 'w-6 h-6', inner: 'w-3.5 h-3.5', stroke: 'border-2', container: 'gap-2.5' },
    lg: { ring: 'w-9 h-9', inner: 'w-5 h-5', stroke: 'border-[3px]', container: 'gap-3' },
    xl: { ring: 'w-12 h-12', inner: 'w-7 h-7', stroke: 'border-4', container: 'gap-3.5' },
    '2xl': { ring: 'w-16 h-16', inner: 'w-9 h-9', stroke: 'border-4', container: 'gap-4' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  // Determine dynamic ring colors based on variant & theme
  const getSpinnerStyles = () => {
    if (variant === 'white') {
      return {
        outerBorder: 'border-white/25 border-t-white border-r-white/80',
        innerBorder: 'border-white/15 border-b-white border-l-white/60',
        glow: 'drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]',
        centerDot: 'bg-white',
        text: 'text-white font-medium',
      };
    }

    if (variant === 'danger') {
      return {
        outerBorder: 'border-red-500/25 border-t-red-500 border-r-red-400',
        innerBorder: 'border-red-500/15 border-b-red-400 border-l-red-500/60',
        glow: 'drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]',
        centerDot: 'bg-red-500',
        text: 'text-red-500 dark:text-red-400 font-semibold',
      };
    }

    if (variant === 'warning') {
      return {
        outerBorder: 'border-amber-500/25 border-t-amber-500 border-r-amber-400',
        innerBorder: 'border-amber-500/15 border-b-amber-400 border-l-amber-500/60',
        glow: 'drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]',
        centerDot: 'bg-amber-500',
        text: 'text-amber-500 dark:text-amber-400 font-semibold',
      };
    }

    if (variant === 'emerald') {
      return {
        outerBorder: 'border-emerald-500/25 border-t-emerald-500 border-r-emerald-400',
        innerBorder: 'border-emerald-500/15 border-b-emerald-400 border-l-emerald-500/60',
        glow: 'drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]',
        centerDot: 'bg-emerald-400',
        text: 'text-emerald-500 dark:text-emerald-400 font-semibold',
      };
    }

    if (variant === 'current') {
      return {
        outerBorder: 'border-current opacity-30 border-t-current opacity-100',
        innerBorder: 'border-current opacity-20 border-b-current opacity-90',
        glow: '',
        centerDot: 'bg-current',
        text: 'text-current font-medium',
      };
    }

    // Default 'themed' or 'tactical'
    if (theme === 'matrix') {
      return {
        outerBorder: 'border-emerald-950 border-t-[#00ff41] border-r-[#00ff41]/70',
        innerBorder: 'border-emerald-950/60 border-b-[#00ff41] border-l-[#00ff41]/50',
        glow: 'drop-shadow-[0_0_12px_rgba(0,255,65,0.65)]',
        centerDot: 'bg-[#00ff41]',
        text: 'text-[#00ff41] tracking-widest font-mono',
      };
    }

    if (theme === 'light') {
      return {
        outerBorder: 'border-blue-200 border-t-blue-600 border-r-indigo-500',
        innerBorder: 'border-indigo-100 border-b-indigo-600 border-l-blue-500',
        glow: 'drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]',
        centerDot: 'bg-blue-600',
        text: 'text-gray-700 font-medium tracking-wide',
      };
    }

    // Default 'dark' tactical mode
    return {
      outerBorder: 'border-blue-900/40 border-t-blue-400 border-r-cyan-400',
      innerBorder: 'border-cyan-900/30 border-b-cyan-400 border-l-blue-500',
      glow: 'drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]',
      centerDot: 'bg-cyan-400',
      text: 'text-gray-300 font-medium tracking-wide',
    };
  };

  const style = getSpinnerStyles();
  const isMultiRing = ['md', 'lg', 'xl', '2xl'].includes(size) || variant === 'tactical';

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Outer Counter-Rotating Pulse or Halo */}
        {showRadarPulse && (
          <div
            className={`absolute ${currentSize.ring} rounded-full scale-150 animate-ping opacity-25 ${style.centerDot}`}
          />
        )}

        {/* Outer Ring */}
        <div
          className={`${currentSize.ring} ${currentSize.stroke} ${style.outerBorder} ${style.glow} rounded-full animate-spin`}
          style={{ animationDuration: '0.85s' }}
        />

        {/* Dual Concentric Inner Counter-Rotating Ring */}
        {isMultiRing && (
          <div
            className={`absolute ${currentSize.inner} ${currentSize.stroke} ${style.innerBorder} rounded-full animate-spin`}
            style={{ animationDuration: '1.2s', animationDirection: 'reverse' }}
          />
        )}

        {/* Center glowing focal dot for large indicators */}
        {['lg', 'xl', '2xl'].includes(size) && (
          <div
            className={`absolute w-1.5 h-1.5 rounded-full ${style.centerDot} animate-pulse`}
          />
        )}
      </div>

      {label && (
        <span className={`mt-2 text-xs uppercase ${style.text}`}>
          {label}
        </span>
      )}
    </div>
  );
};

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
  logoUrl?: string;
  defaultLogoUrl?: string;
  fullscreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'INITIALIZING RAPID DISPATCH TELEMETRY',
  submessage = 'Synchronizing real-time security grid and tactical feeds...',
  logoUrl,
  defaultLogoUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co/storage/v1/object/public/app-assets/main-logo.png?t=1781074810952',
  fullscreen = true,
}) => {
  let theme: 'light' | 'dark' | 'matrix' = 'dark';
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
  } catch {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'matrix') {
        theme = savedTheme;
      }
    }
  }

  const isMatrix = theme === 'matrix';
  const isLight = theme === 'light';

  return (
    <div
      className={`${
        fullscreen ? 'fixed inset-0 z-[9999]' : 'w-full min-h-[400px]'
      } flex flex-col items-center justify-center overflow-hidden transition-colors duration-300 ${
        isMatrix
          ? 'bg-black text-[#00ff41]'
          : isLight
          ? 'bg-slate-50 text-gray-900'
          : 'bg-[#060913] text-white'
      }`}
    >
      {/* Background ambient tactical glow */}
      {!isMatrix && (
        <>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-blue-600/10 dark:bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] bg-indigo-500/10 dark:bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />
        </>
      )}

      {/* Brand Logo Container */}
      <div className="relative mb-6 px-4 flex flex-col items-center">
        <div className="relative">
          <img
            src={logoUrl || defaultLogoUrl}
            alt="Rapid Report Logo"
            className="max-w-[220px] sm:max-w-[280px] h-auto object-contain filter drop-shadow-md transition-all duration-300"
            onError={(e) => {
              e.currentTarget.src = defaultLogoUrl;
            }}
          />
        </div>
      </div>

      {/* Tactical Concentric Spinner */}
      <div className="relative my-3 flex items-center justify-center">
        <LoadingSpinner size="xl" variant="tactical" showRadarPulse={true} />
      </div>

      {/* Cyber/Tactical Status Feed */}
      <div className="mt-5 text-center px-4 max-w-md">
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <span
            className={`w-2 h-2 rounded-full animate-ping ${
              isMatrix
                ? 'bg-[#00ff41]'
                : isLight
                ? 'bg-blue-600'
                : 'bg-cyan-400'
            }`}
          />
          <h2
            className={`text-xs sm:text-sm font-bold tracking-widest uppercase font-mono ${
              isMatrix
                ? 'text-[#00ff41]'
                : isLight
                ? 'text-gray-900'
                : 'text-cyan-300'
            }`}
          >
            {message}
          </h2>
        </div>

        {submessage && (
          <p
            className={`text-[11px] sm:text-xs tracking-wider font-mono ${
              isMatrix
                ? 'text-emerald-600'
                : isLight
                ? 'text-gray-500'
                : 'text-gray-400'
            }`}
          >
            {submessage}
          </p>
        )}
      </div>

      {/* Animated Tactical HUD Progress / Sweep Line */}
      <div className="mt-6 w-48 sm:w-64 h-1 bg-gray-200 dark:bg-gray-800/80 rounded-full overflow-hidden relative">
        <div
          className={`h-full w-1/3 rounded-full animate-[marquee_1.8s_ease-in-out_infinite] ${
            isMatrix
              ? 'bg-[#00ff41] shadow-[0_0_8px_#00ff41]'
              : isLight
              ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]'
              : 'bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]'
          }`}
        />
      </div>
    </div>
  );
};

export default LoadingSpinner;
