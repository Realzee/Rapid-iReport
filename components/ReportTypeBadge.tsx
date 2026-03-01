import React from 'react';
import { CarIcon, AlertTriangleIcon, CrimeIcon } from './icons';

interface ReportTypeBadgeProps {
  type: 'vehicle' | 'crime' | 'accident';
  className?: string;
  showText?: boolean;
}

const typeStyles = {
  vehicle: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-500/30',
    icon: CarIcon,
    label: 'Vehicle'
  },
  accident: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500/30',
    icon: AlertTriangleIcon,
    label: 'Accident'
  },
  crime: {
    bg: 'bg-red-500/20',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-500/30',
    icon: CrimeIcon,
    label: 'Crime'
  }
};

const ReportTypeBadge: React.FC<ReportTypeBadgeProps> = ({ type, className = '', showText = true }) => {
  const style = typeStyles[type];
  const Icon = style.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border} ${className}`}>
      <Icon className="w-3.5 h-3.5" />
      {showText && <span className="text-[10px] font-bold uppercase tracking-wider">{style.label}</span>}
    </div>
  );
};

export default ReportTypeBadge;
