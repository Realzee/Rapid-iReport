import React, { useState } from 'react';
import { Report, ReportStatus } from '../types';
import ReportListItem from './ReportListItem';
import { SearchIcon } from './icons';

interface ReportListProps {
  reports: Report[];
  selectedReportId: string | null;
  onReportSelect: (id: string) => void;
}

const statusFilters: (ReportStatus | 'all')[] = ['all', ReportStatus.ACTIVE, ReportStatus.IN_PROGRESS, ReportStatus.PENDING];

const ReportList: React.FC<ReportListProps> = ({ reports, selectedReportId, onReportSelect }) => {
    const [activeFilter, setActiveFilter] = useState<ReportStatus | 'all'>('all');
    
    const filteredReports = reports.filter(report => 
        activeFilter === 'all' ? true : report.status === activeFilter
    );

  return (
    <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-2xl p-4 backdrop-blur-sm h-full flex flex-col shadow-lg dark:shadow-none">
        <div className="flex-shrink-0">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Live Feed</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Showing {filteredReports.length} reports.</p>
            
            <div className="flex space-x-2 mb-4">
                {statusFilters.map(filter => (
                    <button 
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        className={`px-3 py-1 text-xs font-bold rounded-full capitalize border transition-all duration-200 ${
                            activeFilter === filter 
                            ? 'bg-blue-600 text-white border-blue-500' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {filter.replace('_', ' ')}
                    </button>
                ))}
            </div>
        </div>

      <div className="overflow-y-auto space-y-3 pr-1 -mr-1">
        {filteredReports.map((report) => (
            <ReportListItem 
                key={report.id} 
                report={report} 
                isSelected={report.id === selectedReportId}
                onClick={() => onReportSelect(report.id)}
            />
        ))}
      </div>
    </div>
  );
};

export default ReportList;