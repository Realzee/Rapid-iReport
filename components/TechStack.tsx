import React, { useState } from 'react';
import { TechJob, Profile, UserRole } from '../types';
import { format } from 'date-fns';

interface TechStackProps {
    jobs: TechJob[];
    allUsers: Profile[];
    onSelectJob: (jobId: string) => void;
    selectedJobId: string | null;
    onCreateJobClick: () => void;
}

const TechStack: React.FC<TechStackProps> = ({
    jobs = [],
    allUsers = [],
    onSelectJob,
    selectedJobId,
    onCreateJobClick
}) => {
    const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');

    // Filter jobs
    const filteredJobs = jobs.filter(job => {
        if (filter === 'active') return job.status !== 'completed' && job.status !== 'cancelled';
        if (filter === 'completed') return job.status === 'completed';
        return true;
    });

    const getStatusStyle = (status: TechJob['status']) => {
        switch (status) {
            case 'in_progress':
                return 'bg-yellow-100 text-yellow-850 dark:bg-yellow-905/30 dark:text-yellow-400 border-yellow-700/20';
            case 'completed':
                return 'bg-green-100 text-green-850 dark:bg-green-905/30 dark:text-green-400 border-green-700/20';
            case 'assigned':
                return 'bg-blue-100 text-blue-850 dark:bg-blue-905/30 dark:text-blue-400 border-blue-700/20';
            case 'cancelled':
                return 'bg-red-100 text-red-800 dark:bg-red-900/10 dark:text-red-400';
            default:
                return 'bg-gray-100 text-gray-750 dark:bg-gray-800 dark:text-gray-300';
        }
    };

    const getSeverityStyle = (severity: TechJob['severity']) => {
        switch (severity) {
            case 'critical': return 'text-red-500 font-extrabold';
            case 'high': return 'text-orange-500 font-bold';
            default: return 'text-green-500 font-medium';
        }
    };

    return (
        <div className="flex flex-col h-full text-left">
            {/* Action buttons */}
            <div className="mb-4 flex gap-1.5 flex-shrink-0">
                <button
                    onClick={onCreateJobClick}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-500/15 transition-all text-center"
                >
                    + Dispatch Tech
                </button>
            </div>

            {/* Quick status filters */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg mb-4 text-[10px] font-bold">
                <button
                    onClick={() => setFilter('active')}
                    className={`flex-1 py-1.5 rounded-md transition-all ${filter === 'active' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-950 dark:text-white' : 'text-gray-400 hover:text-gray-950'}`}
                >
                    Active
                </button>
                <button
                    onClick={() => setFilter('completed')}
                    className={`flex-1 py-1.5 rounded-md transition-all ${filter === 'completed' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-950 dark:text-white' : 'text-gray-400 hover:text-gray-950'}`}
                >
                    Completed
                </button>
                <button
                    onClick={() => setFilter('all')}
                    className={`flex-1 py-1.5 rounded-md transition-all ${filter === 'all' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-950 dark:text-white' : 'text-gray-400 hover:text-gray-950'}`}
                >
                    All
                </button>
            </div>

            {/* Scrollable list */}
            <div className="flex-grow overflow-y-auto space-y-2.5 max-h-[50vh] pr-1.5 custom-scrollbar">
                {filteredJobs.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-xs">
                        No technical jobs recorded.
                    </div>
                ) : (
                    filteredJobs.map(job => {
                        const isSelected = selectedJobId === job.id;
                        const assignee = allUsers.find(u => u.id === job.assigned_to);

                        return (
                            <div
                                key={job.id}
                                onClick={() => onSelectJob(job.id)}
                                className={`p-3.5 border rounded-xl text-left cursor-pointer transition-all ${
                                    isSelected
                                    ? 'bg-blue-50/75 border-blue-400 dark:bg-blue-950/20 dark:border-blue-700'
                                    : 'bg-white dark:bg-gray-900/30 hover:bg-gray-100 dark:hover:bg-gray-850/40 border-gray-200 dark:border-gray-800'
                                }`}
                            >
                                <div className="flex items-start justify-between mb-1.5">
                                    <h4 className="font-bold text-xs text-gray-900 dark:text-white line-clamp-1">
                                        {job.title}
                                    </h4>
                                    <span className={`text-[8px] tracking-wider uppercase font-extrabold px-1.5 py-0.5 rounded-md border ${getStatusStyle(job.status)}`}>
                                        {job.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-450 dark:text-gray-450 line-clamp-2 leading-relaxed mb-2">
                                    {job.description || 'No job instructions specified.'}
                                </p>

                                <div className="flex justify-between items-center text-[9px] text-gray-400 dark:text-gray-500 font-semibold border-t border-gray-100 dark:border-gray-800/60 pt-2">
                                    <span>
                                        👤 {assignee ? `${assignee.first_name} ${assignee.surname}` : 'Unassigned'}
                                    </span>
                                    <span className={getSeverityStyle(job.severity)}>
                                        PR: {job.severity.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default TechStack;
