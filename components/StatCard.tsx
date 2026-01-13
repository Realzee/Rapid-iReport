import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactElement;
  color: 'blue' | 'red' | 'green' | 'yellow';
}

const colorClasses = {
  blue: 'text-blue-500 dark:text-blue-400',
  red: 'text-red-500 dark:text-red-400',
  green: 'text-green-500 dark:text-green-400',
  yellow: 'text-yellow-500 dark:text-yellow-400',
};

const iconBgClasses = {
  blue: 'bg-blue-500/10',
  red: 'bg-red-500/10',
  green: 'bg-green-500/10',
  yellow: 'bg-yellow-500/10',
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="bg-white/80 dark:bg-gray-900/50 backdrop-blur-md p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-blue-500/50 transition-all duration-300 flex items-center space-x-4 shadow-sm dark:shadow-none">
       <div className={`p-3 rounded-lg ${iconBgClasses[color]}`}>
          {React.cloneElement(icon as React.ReactElement<{ className: string }>, { className: `w-6 h-6 ${colorClasses[color]}` })}
      </div>
      <div>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
};

export default StatCard;