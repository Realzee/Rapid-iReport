import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Report, ReportStatus, Profile, Company } from '../types';
import ReportListItem from './ReportListItem';
import { ChevronUpIcon } from './icons';

interface ReportListProps {
  reports: Report[];
  selectedReportId: string | null;
  onReportSelect: (id: string) => void;
  profile: Profile;
  allUsers: Profile[];
  onStatusUpdate: (reportId: string, newStatus: ReportStatus, reportType: 'vehicle' | 'crime') => Promise<void>;
  companies: Company[];
}

const statusFilters: (ReportStatus | 'all')[] = ['all', ReportStatus.ACTIVE, ReportStatus.IN_PROGRESS, ReportStatus.PENDING];

const ReportList: React.FC<ReportListProps> = ({ reports, selectedReportId, onReportSelect, profile, allUsers, onStatusUpdate, companies }) => {
    const [activeFilter, setActiveFilter] = useState<ReportStatus | 'all'>('all');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showUnreadIndicator, setShowUnreadIndicator] = useState(false);
    const prevFilteredReportsLengthRef = useRef(0);
    const prevFilterRef = useRef(activeFilter);
    
    const userMap = useMemo(() => {
        return allUsers.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {} as Record<string, Profile>);
    }, [allUsers]);

    const companyMap = useMemo(() => {
        return companies.reduce((acc, company) => {
            acc[company.id] = company;
            return acc;
        }, {} as Record<string, Company>);
    }, [companies]);

    const filteredReports = useMemo(() => reports.filter(report => 
        activeFilter === 'all' ? true : report.status === activeFilter
    ), [reports, activeFilter]);
    
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
    
        if (prevFilterRef.current !== activeFilter) {
            container.scrollTo({ top: 0, behavior: 'auto' });
            setShowUnreadIndicator(false);
        } else {
            const isNewReportAdded = filteredReports.length > (prevFilteredReportsLengthRef.current || 0);
            if (isNewReportAdded) {
                if (container.scrollTop > 50) {
                    setShowUnreadIndicator(true);
                } else {
                    container.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        }
    
        prevFilteredReportsLengthRef.current = filteredReports.length;
        prevFilterRef.current = activeFilter;
    
    }, [filteredReports, activeFilter]);

    const handleScroll = () => {
        if (scrollContainerRef.current && scrollContainerRef.current.scrollTop < 50) {
            setShowUnreadIndicator(false);
        }
    };

    const scrollToTop = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            setShowUnreadIndicator(false);
        }
    };


  return (
    <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg dark:shadow-none transition-colors duration-300 flex flex-col h-full">
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

        <div className="relative flex-grow min-h-0">
            {showUnreadIndicator && (
                <button 
                    onClick={scrollToTop}
                    className="absolute top-0 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-lg text-sm flex items-center gap-1 animate-bounce"
                >
                    <ChevronUpIcon className="w-4 h-4" />
                    New Reports
                </button>
            )}
            <div ref={scrollContainerRef} onScroll={handleScroll} className="space-y-3 overflow-y-auto h-full pr-2 -mr-2">
                {filteredReports.map((report) => {
                    const reporter = userMap[report.reported_by];
                    const reporterName = reporter ? `${reporter.first_name} ${reporter.surname}` : 'Unknown User';
                    const company = reporter?.company_id ? companyMap[reporter.company_id] : undefined;
                    const companyLogoUrl = company?.logo_url;

                    return (
                        <ReportListItem 
                            key={report.id} 
                            report={report} 
                            isSelected={report.id === selectedReportId}
                            onClick={() => onReportSelect(report.id)}
                            profile={profile}
                            reporterName={reporterName}
                            onStatusUpdate={onStatusUpdate}
                            companyLogoUrl={companyLogoUrl}
                        />
                    )
                })}
            </div>
        </div>
    </div>
  );
};

export default ReportList;