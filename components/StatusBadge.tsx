import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ReportStatus } from '../types';

interface StatusBadgeProps {
  status: ReportStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showIcon?: boolean;
}

// Sophisticated themed visual styles for each incident status
const statusStyles: Record<ReportStatus, {
  container: string;
  dot: string;
  glow: string;
  iconType: 'pulse' | 'spin' | 'check' | 'alert' | 'idle';
}> = {
  [ReportStatus.PENDING]: {
    container: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 dark:border-amber-500/40',
    dot: 'bg-amber-500 shadow-amber-500/50',
    glow: 'rgba(245, 158, 11, 0.4)',
    iconType: 'pulse',
  },
  [ReportStatus.ACTIVE]: {
    container: 'bg-blue-500/15 text-blue-700 dark:text-cyan-300 border-blue-500/40 dark:border-cyan-500/50 shadow-sm shadow-blue-500/10',
    dot: 'bg-blue-500 dark:bg-cyan-400 shadow-cyan-500/50',
    glow: 'rgba(6, 182, 212, 0.5)',
    iconType: 'pulse',
  },
  [ReportStatus.ASSIGNED]: {
    container: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40 dark:border-purple-500/50',
    dot: 'bg-purple-500 shadow-purple-500/50',
    glow: 'rgba(168, 85, 247, 0.45)',
    iconType: 'spin',
  },
  [ReportStatus.IN_PROGRESS]: {
    container: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40 dark:border-indigo-500/50 ring-1 ring-indigo-500/20',
    dot: 'bg-indigo-500 dark:bg-indigo-400 shadow-indigo-500/50',
    glow: 'rgba(99, 102, 241, 0.5)',
    iconType: 'spin',
  },
  [ReportStatus.ON_SCENE]: {
    container: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40 dark:border-orange-500/50 ring-1 ring-orange-500/20',
    dot: 'bg-orange-500 dark:bg-orange-400 shadow-orange-500/50',
    glow: 'rgba(249, 115, 22, 0.5)',
    iconType: 'spin',
  },
  [ReportStatus.RESOLVED]: {
    container: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 dark:border-emerald-500/50 shadow-sm shadow-emerald-500/10',
    dot: 'bg-emerald-500 dark:bg-emerald-400 shadow-emerald-500/50',
    glow: 'rgba(16, 185, 129, 0.5)',
    iconType: 'check',
  },
  [ReportStatus.RECOVERED]: {
    container: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/40 dark:border-teal-500/50 shadow-sm shadow-teal-500/10',
    dot: 'bg-teal-500 dark:bg-teal-400 shadow-teal-500/50',
    glow: 'rgba(20, 184, 166, 0.5)',
    iconType: 'check',
  },
  [ReportStatus.REJECTED]: {
    container: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 dark:border-rose-500/50',
    dot: 'bg-rose-500 shadow-rose-500/50',
    glow: 'rgba(244, 63, 94, 0.45)',
    iconType: 'alert',
  },
  [ReportStatus.CLOSED]: {
    container: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-400/30 dark:border-slate-600/40',
    dot: 'bg-slate-500 shadow-slate-500/30',
    glow: 'rgba(100, 116, 139, 0.3)',
    iconType: 'idle',
  },
  [ReportStatus.DELETED]: {
    container: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-400/20 dark:border-gray-700/30',
    dot: 'bg-gray-400',
    glow: 'rgba(156, 163, 175, 0.2)',
    iconType: 'idle',
  },
  [ReportStatus.STOLEN]: {
    container: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/50 dark:border-red-500/60 font-black ring-1 ring-red-500/30',
    dot: 'bg-red-500 shadow-red-500/60',
    glow: 'rgba(239, 68, 68, 0.6)',
    iconType: 'alert',
  },
  [ReportStatus.SUSPICIOUS]: {
    container: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 dark:border-amber-500/50',
    dot: 'bg-amber-500 shadow-amber-500/50',
    glow: 'rgba(245, 158, 11, 0.45)',
    iconType: 'pulse',
  },
  [ReportStatus.BOLO]: {
    container: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/40 dark:border-pink-500/50 font-bold',
    dot: 'bg-pink-500 shadow-pink-500/50',
    glow: 'rgba(236, 72, 153, 0.5)',
    iconType: 'alert',
  },
  [ReportStatus.SOUGHT]: {
    container: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/40 dark:border-fuchsia-500/50 font-bold',
    dot: 'bg-fuchsia-500 shadow-fuchsia-500/50',
    glow: 'rgba(217, 70, 239, 0.5)',
    iconType: 'alert',
  },
  [ReportStatus.HIJACKED]: {
    container: 'bg-red-600/25 text-red-800 dark:text-red-200 border-red-600/60 dark:border-red-500/70 font-black ring-2 ring-red-500/40',
    dot: 'bg-red-600 shadow-red-600/70',
    glow: 'rgba(220, 38, 38, 0.7)',
    iconType: 'alert',
  },
  [ReportStatus.USED_IN_COMMISSION_OF_CRIME]: {
    container: 'bg-purple-600/20 text-purple-800 dark:text-purple-200 border-purple-500/50 dark:border-purple-500/60 font-bold',
    dot: 'bg-purple-500 shadow-purple-500/50',
    glow: 'rgba(147, 51, 234, 0.5)',
    iconType: 'alert',
  },
};

const sizeClasses = {
  xs: 'px-2 py-0.5 text-[10px] gap-1',
  sm: 'px-2.5 py-0.5 text-xs gap-1.5',
  md: 'px-3 py-1 text-xs gap-1.5',
  lg: 'px-3.5 py-1.5 text-sm gap-2',
};

const dotSizes = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  className = '',
  showIcon = true,
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionFlash, setTransitionFlash] = useState(false);
  const prevStatusRef = useRef<ReportStatus>(status);
  const isFirstRender = useRef(true);

  // Trigger smooth transition physics whenever status changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (prevStatusRef.current !== status) {
      prevStatusRef.current = status;
      setIsTransitioning(true);
      setTransitionFlash(true);

      const flashTimer = setTimeout(() => {
        setTransitionFlash(false);
      }, 500);

      const endTimer = setTimeout(() => {
        setIsTransitioning(false);
      }, 650);

      return () => {
        clearTimeout(flashTimer);
        clearTimeout(endTimer);
      };
    }
  }, [status]);

  const styleConfig = useMemo(() => {
    return statusStyles[status] || {
      container: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      dot: 'bg-gray-500',
      glow: 'rgba(100, 116, 139, 0.3)',
      iconType: 'idle' as const,
    };
  }, [status]);

  const formattedLabel = useMemo(() => {
    return (status || 'UNKNOWN').replace(/_/g, ' ').toUpperCase();
  }, [status]);

  return (
    <span
      className={`relative inline-flex items-center font-black rounded-full border tracking-wide uppercase select-none transition-all duration-300 ease-out transform-gpu ${sizeClasses[size]} ${styleConfig.container} ${
        isTransitioning ? 'animate-badge-pop scale-105' : 'scale-100'
      } ${className}`}
      style={{
        boxShadow: transitionFlash
          ? `0 0 16px 2px ${styleConfig.glow}, 0 2px 4px rgba(0,0,0,0.1)`
          : undefined,
      }}
    >
      {/* Expanding Ripple Ring on status state shift */}
      {transitionFlash && (
        <span
          className="absolute inset-0 rounded-full animate-ping pointer-events-none opacity-40"
          style={{ backgroundColor: styleConfig.glow }}
        />
      )}

      {/* Dynamic Animated Indicator Icon */}
      {showIcon && (
        <span className="relative flex items-center justify-center shrink-0">
          {styleConfig.iconType === 'pulse' && (
            <>
              {/* Radar pulse outer beacon */}
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${styleConfig.dot}`} />
              {/* Core beacon dot */}
              <span className={`relative inline-flex rounded-full ${dotSizes[size]} ${styleConfig.dot} shadow-xs`} />
            </>
          )}

          {styleConfig.iconType === 'spin' && (
            <span className="relative flex items-center justify-center">
              {/* Dual notch orbital spinner for in-progress / en-route / on-scene */}
              <svg
                className={`${dotSizes[size]} animate-spin text-current`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </span>
          )}

          {styleConfig.iconType === 'check' && (
            <span className="relative flex items-center justify-center animate-check-pop">
              {/* Crisp tactical checkmark icon for resolved / recovered */}
              <svg
                className={`${dotSizes[size]} text-current`}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
              </svg>
            </span>
          )}

          {styleConfig.iconType === 'alert' && (
            <>
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${styleConfig.dot}`} />
              <svg
                className={`${dotSizes[size]} text-current`}
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 1L1 14h14L8 1zm0 3.5c.4 0 .7.3.7.7v4.6c0 .4-.3.7-.7.7s-.7-.3-.7-.7V5.2c0-.4.3-.7.7-.7zm0 8.3c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9z" />
              </svg>
            </>
          )}

          {styleConfig.iconType === 'idle' && (
            <span className={`inline-flex rounded-full ${dotSizes[size]} ${styleConfig.dot} opacity-70`} />
          )}
        </span>
      )}

      {/* Status Text Label with Smooth Cross-Transition */}
      <span
        key={formattedLabel}
        className={`font-mono transition-opacity duration-200 ${
          isTransitioning ? 'opacity-90 font-black' : 'opacity-100'
        }`}
      >
        {formattedLabel}
      </span>
    </span>
  );
};

export default StatusBadge;
