import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { TechJob, Profile, TechChatMessage, UserRole, UserStatus } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { format, formatDistanceToNow } from 'date-fns';
import { 
    WrenchIcon, 
    SearchIcon, 
    PlusIcon, 
    ClockIcon, 
    MapIcon, 
    BuildingIcon, 
    CheckIcon, 
    ChevronDownIcon, 
    RadioTowerIcon, 
    BellIcon,
    CarIcon
} from '../components/icons';
import TechDispatchModal from '../components/TechDispatchModal';
import TechJobDetail from '../components/TechJobDetail';

const TechOpsPage: React.FC = () => {
    const { addToast } = useToast();
    const { theme } = useTheme();

    const [jobs, setJobs] = useState<TechJob[]>([]);
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all_active');
    const [severityFilter, setSeverityFilter] = useState<string>('all');
    const [techFilter, setTechFilter] = useState<string>('all');
    const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'jobs' | 'techs'>('jobs'); // mobile tab toggle

    // Fetch jobs & users
    const fetchData = useCallback(async () => {
        try {
            // Get users list
            const { data: usersData, error: usersError } = await supabase
                .from('profiles')
                .select('*, company:companies(*)');
            
            if (usersError) throw usersError;
            setAllUsers(usersData as Profile[] || []);

            // Get tech jobs list
            const { data: jobsData, error: jobsError } = await supabase
                .from('tech_jobs')
                .select('*')
                .order('created_at', { ascending: false });

            if (jobsError) throw jobsError;
            const typedJobs = (jobsData as TechJob[] || []).map(job => {
                const assigned_to_profile = (usersData || []).find(u => u.id === job.assigned_to);
                return {
                    ...job,
                    assigned_to_profile: assigned_to_profile ? {
                        first_name: assigned_to_profile.first_name,
                        surname: assigned_to_profile.surname,
                        email: assigned_to_profile.email
                    } : undefined
                };
            });

            setJobs(typedJobs);

            // Set first job if none selected and jobs exist
            if (typedJobs.length > 0 && !selectedJobId) {
                setSelectedJobId(typedJobs[0].id);
            }
        } catch (e: any) {
            console.error('Error fetching Tech Ops data:', e);
            addToast('Failed to sync Tech Ops database records.', 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedJobId, addToast]);

    // Setup realtime subscription
    useEffect(() => {
        fetchData();

        const channel = supabase
            .channel('realtime_tech_ops')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tech_jobs' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Filter jobs
    const filteredJobs = jobs.filter(job => {
        const matchesSearch = 
            job.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (job.description && job.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (job.location && job.location.toLowerCase().includes(searchQuery.toLowerCase()));

        let matchesStatus = true;
        if (statusFilter === 'all_active') {
            matchesStatus = job.status !== 'completed' && job.status !== 'cancelled';
        } else if (statusFilter !== 'all') {
            matchesStatus = job.status === statusFilter;
        }

        const matchesSeverity = severityFilter === 'all' || job.severity === severityFilter;
        const matchesTech = techFilter === 'all' || job.assigned_to === techFilter;

        return matchesSearch && matchesStatus && matchesSeverity && matchesTech;
    });

    const technicians = allUsers.filter(u => u.role === UserRole.TECHNICIAN);
    const selectedJob = jobs.find(j => j.id === selectedJobId);

    // Calculate live telemetry metrics
    const totalActiveJobs = jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled').length;
    const criticalJobsCount = jobs.filter(j => j.severity === 'critical' && j.status !== 'completed' && j.status !== 'cancelled').length;
    const pendingJobsCount = jobs.filter(j => j.status === 'pending').length;
    const onlineTechsCount = technicians.filter(t => t.status === UserStatus.ACTIVE).length;

    const getStatusStyle = (status: TechJob['status']) => {
        switch (status) {
            case 'in_progress':
                return 'bg-yellow-50 text-yellow-800 border-yellow-250 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30';
            case 'completed':
                return 'bg-green-50 text-green-800 border-green-250 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30';
            case 'assigned':
                return 'bg-blue-50 text-blue-800 border-blue-250 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30';
            case 'cancelled':
                return 'bg-red-50 text-red-800 border-red-250 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30';
            default:
                return 'bg-gray-50 text-gray-800 border-gray-250 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50';
        }
    };

    const getSeverityStyle = (severity: TechJob['severity']) => {
        switch (severity) {
            case 'critical': return 'bg-red-500/10 text-red-600 border-red-200 dark:text-red-400 dark:border-red-900/30';
            case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-200 dark:text-orange-400 dark:border-orange-900/30';
            case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:text-yellow-400 dark:border-yellow-905/30';
            default: return 'bg-green-500/10 text-green-600 border-green-200 dark:text-green-450 dark:border-green-900/30';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 flex flex-col">
            
            {/* Top Stats Banner */}
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
                                <WrenchIcon className="w-5 h-5" />
                            </span>
                            <div>
                                <h1 className="text-xl font-extrabold tracking-tight">Technical Operations Management</h1>
                                <p className="text-xs text-gray-505 dark:text-gray-400">Dispatch, tracking and coordination center for on-scene engineers & technicians.</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsDispatchModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-750 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/15 transition-all text-center self-stretch md:self-auto"
                    >
                        <PlusIcon className="w-4 h-4" /> Dispatch Technical Order
                    </button>
                </div>

                {/* KPI Metrics Dashboard Section */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white dark:bg-gray-900/40 p-4 border border-gray-200 dark:border-gray-800/80 rounded-2xl">
                        <span className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest block mb-1">
                            Active Work Orders
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{totalActiveJobs}</span>
                            <span className="text-[10px] font-medium text-gray-500">outstanding tasks</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900/40 p-4 border border-gray-200 dark:border-gray-800/80 rounded-2xl">
                        <span className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest block mb-1">
                            Critical Failures
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-2xl font-extrabold ${criticalJobsCount > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{criticalJobsCount}</span>
                            <span className="text-[10px] font-medium text-gray-500">escalated status</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900/40 p-4 border border-gray-200 dark:border-gray-800/80 rounded-2xl">
                        <span className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest block mb-1">
                            Pending Dispatch
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-extrabold text-amber-500">{pendingJobsCount}</span>
                            <span className="text-[10px] font-medium text-gray-500">draft queue</span>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900/40 p-4 border border-gray-200 dark:border-gray-800/80 rounded-2xl">
                        <span className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-widest block mb-1">
                            Technicians Duty
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-extrabold text-teal-500">{onlineTechsCount}</span>
                            <span className="text-[10px] font-medium text-gray-500">active engineers</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile View tab switcher */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 px-4 md:hidden gap-4 text-sm font-semibold mb-3">
                <button 
                    onClick={() => setActiveTab('jobs')}
                    className={`pb-2.5 pt-1 border-b-2 transition-all ${activeTab === 'jobs' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500'}`}
                >
                    Work Orders ({filteredJobs.length})
                </button>
                <button 
                    onClick={() => setActiveTab('techs')}
                    className={`pb-2.5 pt-1 border-b-2 transition-all ${activeTab === 'techs' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500'}`}
                >
                    Technicians ({technicians.length})
                </button>
            </div>

            {/* Main Application Interface */}
            <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-12 flex-grow grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[60vh]">
                
                {/* COLUMN 1: LEFT SIDEBAR - FILTER & JOB LISTING (span 4) */}
                <div className={`md:col-span-4 flex flex-col gap-4 text-left ${activeTab === 'jobs' ? 'block' : 'hidden md:block'}`}>
                    <div className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800/80 rounded-2xl p-4 flex flex-col gap-3">
                        <h2 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Queue Filters & Config
                        </h2>
                        
                        {/* Search Input */}
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search work orders, site, tech..."
                                className="w-full text-xs bg-gray-50 dark:bg-gray-900 border border-gray-250 dark:border-gray-800 rounded-xl px-10 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                        </div>

                        {/* Status Filters */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 dark:text-gray-550 uppercase mb-1">Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-250 dark:border-gray-800 rounded-lg text-xs"
                                >
                                    <option value="all">All statuses</option>
                                    <option value="all_active">Active only</option>
                                    <option value="pending">Pending</option>
                                    <option value="assigned">Assigned</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 dark:text-gray-550 uppercase mb-1">Severity / Urgency</label>
                                <select
                                    value={severityFilter}
                                    onChange={e => setSeverityFilter(e.target.value)}
                                    className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-250 dark:border-gray-800 rounded-lg text-xs"
                                >
                                    <option value="all">All Severities</option>
                                    <option value="critical">Critical Only</option>
                                    <option value="high">High Range</option>
                                    <option value="medium">Medium Range</option>
                                    <option value="low">Low Range</option>
                                </select>
                            </div>
                        </div>

                        {/* Route Filter assigned technician */}
                        <div>
                            <label className="block text-[9px] font-bold text-gray-400 dark:text-gray-550 uppercase mb-1">Filter by Tech</label>
                            <select
                                value={techFilter}
                                onChange={e => setTechFilter(e.target.value)}
                                className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-250 dark:border-gray-800 rounded-lg text-xs"
                            >
                                <option value="all">All Technicians</option>
                                {technicians.map(t => (
                                    <option key={t.id} value={t.id}>{t.first_name} {t.surname}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Jobs Listing Stack container */}
                    <div className="flex-grow overflow-y-auto max-h-[60vh] pr-1 flex flex-col gap-2.5 custom-scrollbar">
                        <div className="flex justify-between items-center text-xs text-gray-500 font-bold px-1">
                            <span>Work Order History</span>
                            <span>{filteredJobs.length} matches</span>
                        </div>

                        {loading ? (
                            <div className="bg-white dark:bg-gray-900/25 border border-gray-200 dark:border-gray-850 p-8 rounded-2xl flex flex-col items-center justify-center">
                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                <span className="text-xs text-gray-500">Accessing Job Queue...</span>
                            </div>
                        ) : filteredJobs.length === 0 ? (
                            <div className="bg-white dark:bg-gray-900/25 border border-gray-200 dark:border-gray-850 text-center py-12 px-6 rounded-2xl">
                                <WrenchIcon className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">No Jobs Found</h3>
                                <p className="text-xs text-gray-500 mt-1">Refine your search parameter or filters, or dispatch a new order.</p>
                            </div>
                        ) : (
                            filteredJobs.map(job => {
                                const isSelected = selectedJobId === job.id;
                                const assignee = technicians.find(t => t.id === job.assigned_to);
                                
                                return (
                                    <div
                                        key={job.id}
                                        onClick={() => setSelectedJobId(job.id)}
                                        className={`p-4 border rounded-2xl text-left cursor-pointer transition-all ${
                                            isSelected
                                                ? 'bg-blue-50/60 border-blue-400 dark:bg-blue-950/20 dark:border-blue-800 shadow-md'
                                                : 'bg-white dark:bg-gray-900/20 border-gray-205 dark:border-gray-850 hover:bg-gray-100 dark:hover:bg-gray-850/40'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2.5 mb-2">
                                            <h4 className="font-extrabold text-xs text-gray-900 dark:text-white line-clamp-1">
                                                {job.title}
                                            </h4>
                                            <span className={`text-[8px] font-mono tracking-wider uppercase font-extrabold px-2 py-0.5 rounded-md border ${getStatusStyle(job.status)}`}>
                                                {job.status.replace('_', ' ')}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mb-3 line-clamp-2">
                                            {job.description || 'No work description narrative specified.'}
                                        </p>

                                        {job.location && (
                                            <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mb-3 flex items-center gap-1">
                                                <span>📍</span> <span className="line-clamp-1">{job.location}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center text-[10px] text-gray-450 dark:text-gray-500 font-semibold border-t border-gray-100 dark:border-gray-800/50 pt-2.5">
                                            <div className="flex items-center gap-1.5">
                                                {assignee?.avatar_url ? (
                                                    <img referrerPolicy="no-referrer" src={assignee.avatar_url} className="w-4 h-4 rounded-full object-cover" alt="avatar" />
                                                ) : (
                                                    <span>👤</span>
                                                )}
                                                <span className="font-bold">
                                                    {assignee ? `${assignee.first_name} ${assignee.surname}` : 'Unassigned Draft'}
                                                </span>
                                            </div>
                                            <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded border ${getSeverityStyle(job.severity)}`}>
                                                {job.severity.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* COLUMN 2: MIDDLE - SELECTED JOB DETAIL AND ACTIVE COMMUNICATOR SECTION (span 5) */}
                <div className={`md:col-span-5 h-full ${activeTab === 'jobs' && selectedJobId ? 'block' : 'hidden md:block'}`}>
                    {selectedJobId && selectedJob ? (
                        <div className="h-full">
                            <TechJobDetail
                                job={selectedJob}
                                allUsers={allUsers}
                                onRefresh={fetchData}
                            />
                        </div>
                    ) : (
                        <div className="bg-white/50 dark:bg-gray-900/20 border border-dashed border-gray-300 dark:border-gray-800 rounded-3xl p-12 h-full flex flex-col justify-center items-center text-center">
                            <WrenchIcon className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4 animate-pulse" />
                            <h3 className="text-md font-extrabold text-gray-900 dark:text-white">No Job Selected</h3>
                            <p className="text-xs text-gray-500 mt-1 max-w-sm">
                                Select any technician work order from the records sidebar queue to deploy controls, logs or live correspondence chat.
                            </p>
                        </div>
                    )}
                </div>

                {/* COLUMN 3: RIGHT - TECHNICIAN ROSTER & GPS LOCALIZATION (span 3 / block) */}
                <div className={`md:col-span-3 flex flex-col gap-4 text-left ${activeTab === 'techs' ? 'block' : 'hidden md:block'}`}>
                    <div className="bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800/80 rounded-2xl p-4 flex flex-col gap-3 min-h-[40vh] h-full">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                            <h2 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                <CarIcon className="w-4 h-4 text-teal-500" /> Technician Dispatch Duty
                            </h2>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md font-extrabold text-teal-600 dark:text-teal-400">
                                {technicians.length}
                            </span>
                        </div>

                        {/* List of active technicians */}
                        <div className="divide-y divide-gray-100/85 dark:divide-gray-800/60 overflow-y-auto max-h-[70vh] flex-grow pr-1.5 custom-scrollbar">
                            {technicians.length === 0 ? (
                                <p className="text-xs text-gray-500 text-center py-10">No technicians registered in the database.</p>
                            ) : (
                                technicians.map(tech => {
                                    const techActiveJobs = jobs.filter(j => j.assigned_to === tech.id && j.status !== 'completed' && j.status !== 'cancelled');
                                    const isOnline = tech.status === UserStatus.ACTIVE;
                                    
                                    return (
                                        <div key={tech.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col gap-1.5 text-xs text-left">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {tech.avatar_url ? (
                                                        <img referrerPolicy="no-referrer" src={tech.avatar_url} className="w-7 h-7 rounded-full object-cover" alt={tech.first_name} />
                                                    ) : (
                                                        <div className="w-7 h-7 bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold rounded-full">
                                                            {tech.first_name[0]}{tech.surname[0]}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <h4 className="font-extrabold text-xs text-gray-900 dark:text-white leading-tight">
                                                            {tech.first_name} {tech.surname}
                                                        </h4>
                                                        <span className="text-[9px] text-gray-400 block">{tech.email}</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${isOnline ? 'bg-green-500 shadow-sm shadow-green-500/40' : 'bg-gray-300 dark:bg-gray-700'}`} />
                                                    <span className="text-[8px] text-gray-400 dark:text-gray-500 capitalize">{tech.status}</span>
                                                </div>
                                            </div>

                                            {/* Details for dispatching availability */}
                                            <div className="bg-gray-50/70 dark:bg-gray-850 p-2 rounded-xl border border-gray-100/50 dark:border-gray-800/40 mt-1 space-y-1.5 text-[10px]">
                                                {techActiveJobs.length > 0 ? (
                                                    <div className="text-gray-600 dark:text-gray-300">
                                                        💼 Assigned Task: <strong className="text-blue-600 dark:text-blue-400 font-bold line-clamp-1">{techActiveJobs[0].title}</strong>
                                                        <span className="text-[8px] tracking-wider uppercase font-black text-gray-400 dark:text-gray-550 block mt-0.5">
                                                            {techActiveJobs.length} Job(s) total on deck
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                                                        🟢 Standby - Dispatcher Ready
                                                    </span>
                                                )}
                                                
                                                {tech.last_seen_at && (
                                                    <div className="text-[9px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800/40 pt-1.5 flex items-center gap-1">
                                                        <ClockIcon className="w-3 h-3 text-gray-400" />
                                                        <span>Checked In: {formatDistanceToNow(new Date(tech.last_seen_at))} ago</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Tech job creation dispatcher modal */}
            <TechDispatchModal
                isOpen={isDispatchModalOpen}
                onClose={() => setIsDispatchModalOpen(false)}
                allUsers={allUsers}
                onJobDispatched={fetchData}
            />

        </div>
    );
};

export default TechOpsPage;
