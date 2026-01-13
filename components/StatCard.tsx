import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactElement;
  color: 'blue' | 'red' | 'green' | 'yellow';
}

const colorClasses = {
  blue: 'text-blue-400',
  red: 'text-red-400',
  green: 'text-green-400',
  yellow: 'text-yellow-400',
};

const iconBgClasses = {
  blue: 'bg-blue-500/10',
  red: 'bg-red-500/10',
  green: 'bg-green-500/10',
  yellow: 'bg-yellow-500/10',
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 flex items-center space-x-4">
       <div className={`p-3 rounded-lg ${iconBgClasses[color]}`}>
          {React.cloneElement(icon as React.ReactElement<{ className: string }>, { className: `w-6 h-6 ${colorClasses[color]}` })}
      </div>
      <div>
        <p className="text-gray-400 text-sm font-medium">{title}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
};

export default StatCard;
