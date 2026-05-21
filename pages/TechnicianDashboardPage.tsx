import React, { useState, useEffect, useRef } from 'react';
import { Profile, TechJob, TechChatMessage, UserRole } from '../types';
import { supabase } from '../utils/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useToast } from '../contexts/ToastContext';
import { WrenchIcon } from '../components/icons';
import { logUserAction } from '../utils/logger';
import { useWakeLock } from '../hooks/useWakeLock';

interface TechnicianDashboardPageProps {
    profile: Profile;
}

const TechnicianDashboardPage: React.FC<TechnicianDashboardPageProps> = ({ profile }) => {
    const { addToast } = useToast();
    const { requestWakeLock, releaseWakeLock } = useWakeLock();
    
    const [jobs, setJobs] = useState<TechJob[]>([]);
    const [selectedJob, setSelectedJob] = useState<TechJob | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'assigned' | 'in_progress' | 'completed'>('all');
    
    // Parts Logger State
    const [parts, setParts] = useState<{ id: string; name: string; qty: number; cost: number }[]>([]);
    const [newPartName, setNewPartName] = useState('');
    const [newPartQty, setNewPartQty] = useState(1);
    const [newPartCost, setNewPartCost] = useState(0);
    const [savingParts, setSavingParts] = useState(false);

    // Chat State
    const [messages, setMessages] = useState<TechChatMessage[]>([]);
    const [newMsgText, setNewMsgText] = useState('');
    const [sendingMsg, setSendingMsg] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Active Tab for Job Panel: 'details' | 'materials' | 'chat' | 'map'
    const [activeJobTab, setActiveJobTab] = useState<'details' | 'materials' | 'chat' | 'map'>('details');

    const defaultPosition: [number, number] = [-26.2041, 28.0473]; // Joburg center

    // Enable wakelock when working to keep technician logged in/on map
    useEffect(() => {
        requestWakeLock();
        return () => releaseWakeLock();
    }, [requestWakeLock, releaseWakeLock]);

    // Fetch jobs and bind realtime update polls
    const fetchJobs = async () => {
        try {
            setLoading(true);
            // Fetch jobs with joined profiles
            const { data, error } = await supabase
                .from('tech_jobs')
                .select(`
                    *,
                    assigned_to_profile:profiles!tech_jobs_assigned_to_fkey (
                        first_name,
                        surname,
                        email
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setJobs(data as TechJob[] || []);
        } catch (e: any) {
            console.error('Error loading technical jobs:', e);
            addToast('Could not load technical jobs.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();

        // Realtime subscription
        const channel = supabase
            .channel('realtime_tech_jobs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tech_jobs' }, () => {
                fetchJobs();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Refresh selected job data if it changes
    useEffect(() => {
        if (selectedJob) {
            const freshJob = jobs.find(j => j.id === selectedJob.id);
            if (freshJob) {
                setSelectedJob(freshJob);
                setParts(freshJob.parts_logged || []);
            }
        }
    }, [jobs]);

    // Fetch chat messages for selected job
    const fetchChatMessages = async (jobId: string) => {
        try {
            const { data, error } = await supabase
                .from('tech_chat_messages')
                .select(`
                    *,
                    profile:profiles (
                        first_name,
                        surname,
                        avatar_url
                    )
                `)
                .eq('job_id', jobId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data as TechChatMessage[] || []);
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (e: any) {
            console.error('Error fetching chat messages:', e);
        }
    };

    useEffect(() => {
        if (selectedJob?.id) {
            fetchChatMessages(selectedJob.id);

            // Chat real-time poll/listen
            const chatChannel = supabase
                .channel(`tech_chat_${selectedJob.id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tech_chat_messages', filter: `job_id=eq.${selectedJob.id}` }, () => {
                    fetchChatMessages(selectedJob.id);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(chatChannel);
            };
        }
    }, [selectedJob?.id]);

    const handleSelectJob = (job: TechJob) => {
        setSelectedJob(job);
        setParts(job.parts_logged || []);
        setActiveJobTab('details');
    };

    // Filtered Jobs
    const filteredJobs = jobs.filter(job => {
        if (filter === 'assigned') return job.assigned_to === profile.id;
        if (filter === 'in_progress') return job.assigned_to === profile.id && job.status === 'in_progress';
        if (filter === 'completed') return job.status === 'completed';
        return true;
    });

    // Update job status
    const updateJobStatus = async (jobId: string, status: TechJob['status']) => {
        try {
            const { error } = await supabase
                .from('tech_jobs')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', jobId);

            if (error) throw error;

            addToast(`Job status updated to ${status.replace('_', ' ')}.`, 'success');
            logUserAction(profile.id, 'TECH_JOB_STATUS_UPDATE', `Updated job ${jobId} status to ${status}`);
            fetchJobs();
        } catch (e: any) {
            console.error('Error updating status:', e);
            addToast('Failed to update job status.', 'error');
        }
    };

    // Parts / Materials logs submit
    const addPartRow = () => {
        if (!newPartName.trim()) {
            addToast('Please enter an item or part name.', 'warning');
            return;
        }

        const newRow = {
            id: crypto.randomUUID(),
            name: newPartName.trim(),
            qty: Math.max(1, newPartQty),
            cost: Math.max(0, newPartCost)
        };

        setParts(prev => [...prev, newRow]);
        setNewPartName('');
        setNewPartQty(1);
        setNewPartCost(0);
    };

    const removePartRow = (id: string) => {
        setParts(prev => prev.filter(p => p.id !== id));
    };

    const handleSaveParts = async () => {
        if (!selectedJob) return;
        setSavingParts(true);
        try {
            const { error } = await supabase
                .from('tech_jobs')
                .update({ parts_logged: parts, updated_at: new Date().toISOString() })
                .eq('id', selectedJob.id);

            if (error) throw error;
            addToast('Parts and materials logged successfully.', 'success');
            logUserAction(profile.id, 'TECH_JOB_PARTS_UPDATE', `Logged ${parts.length} parts on job ${selectedJob.id}`);
            fetchJobs();
        } catch (e: any) {
            console.error('Error saving parts log:', e);
            addToast('Failed to save parts list.', 'error');
        } finally {
            setSavingParts(false);
        }
    };

    // Chat send button
    const handleSendMsg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMsgText.trim() || !selectedJob || sendingMsg) return;

        setSendingMsg(true);
        try {
            const { error } = await supabase
                .from('tech_chat_messages')
                .insert({
                    job_id: selectedJob.id,
                    sender_id: profile.id,
                    content: newMsgText.trim()
                });

            if (error) throw error;
            setNewMsgText('');
            fetchChatMessages(selectedJob.id);
        } catch (e: any) {
            console.error('Error sending chat message:', e);
            addToast('Failed to send message.', 'error');
        } finally {
            setSendingMsg(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl pt-24 min-h-screen">
            {/* Upper Info Banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-150 dark:border-gray-800 pb-6">
                <div>
                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                        Technical Operations Console
                    </span>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mt-2 flex items-center gap-3">
                        <WrenchIcon className="w-8 h-8 text-blue-600" /> Technician Room
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Welcome, {profile.first_name} {profile.surname} — Track work orders and communicate directly with the Control Room.
                    </p>
                </div>
            </div>

            {/* Dashboard grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left side: JOB ROSTER */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    <div className="bg-white/85 dark:bg-gray-905 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-4 backdrop-blur-md">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Job List &amp; History</h2>
                        
                        {/* Quick filter tabs */}
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4 text-xs font-bold font-sans">
                            <button
                                onClick={() => setFilter('all')}
                                className={`flex-1 py-2 rounded-lg transition-all ${filter === 'all' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter('assigned')}
                                className={`flex-1 py-2 rounded-lg transition-all ${filter === 'assigned' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                Assigned to Me
                            </button>
                            <button
                                onClick={() => setFilter('in_progress')}
                                className={`flex-1 py-2 rounded-lg transition-all ${filter === 'in_progress' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                In Progress
                            </button>
                            <button
                                onClick={() => setFilter('completed')}
                                className={`flex-1 py-2 rounded-lg transition-all ${filter === 'completed' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                            >
                                Completed
                            </button>
                        </div>

                        {/* List container */}
                        {loading && jobs.length === 0 ? (
                            <div className="flex justify-center items-center py-12">
                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : filteredJobs.length === 0 ? (
                            <div className="text-center py-12 px-4">
                                <p className="text-gray-400 dark:text-gray-500">No work orders match this filter.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
                                {filteredJobs.map(job => {
                                    const isAssignedToMe = job.assigned_to === profile.id;
                                    const isSelected = selectedJob?.id === job.id;
                                    
                                    let statusColor = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
                                    if (job.status === 'in_progress') statusColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-700/20';
                                    if (job.status === 'completed') statusColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-700/20';
                                    if (job.status === 'assigned') statusColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-700/20';
                                    if (job.status === 'cancelled') statusColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';

                                    let severityColor = 'text-green-500';
                                    if (job.severity === 'high') severityColor = 'text-orange-500';
                                    if (job.severity === 'critical') severityColor = 'text-red-500 font-bold';

                                    return (
                                        <div
                                            key={job.id}
                                            onClick={() => handleSelectJob(job)}
                                            className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                                                isSelected 
                                                ? 'bg-blue-50/70 border-blue-400 dark:bg-blue-950/20 dark:border-blue-700' 
                                                : 'bg-gray-50/50 hover:bg-gray-150 border-gray-200 dark:bg-gray-800/40 dark:hover:bg-gray-800 dark:border-gray-800'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{job.title}</h3>
                                                <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${statusColor}`}>
                                                    {job.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{job.description}</p>
                                            
                                            <div className="flex justify-between items-center text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                                                <span>📅 {format(new Date(job.created_at), 'yyyy/MM/dd HH:mm')}</span>
                                                <span className="flex items-center gap-1 font-bold">
                                                    Priority: <span className={severityColor}>{job.severity.toUpperCase()}</span>
                                                </span>
                                            </div>

                                            {isAssignedToMe && (
                                                <div className="mt-2.5 pt-2 border-t border-gray-200/55 dark:border-gray-700/50 flex justify-between items-center">
                                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold flex items-center gap-1">
                                                        ⚡ Assigned to You
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right side: JOB CONTROL PANEL */}
                <div className="lg:col-span-7">
                    {selectedJob ? (
                        <div className="bg-white/85 dark:bg-gray-905 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-md overflow-hidden backdrop-blur-md">
                            
                            {/* Panel Header */}
                            <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold font-mono">
                                        JOB_ID: {selectedJob.id.slice(0, 8).toUpperCase()}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs uppercase font-extrabold px-3 py-1 rounded-full border ${
                                            selectedJob.status === 'in_progress' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                            selectedJob.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            selectedJob.status === 'assigned' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                        }`}>
                                            Status: {selectedJob.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                                
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{selectedJob.title}</h2>
                                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{selectedJob.description}</p>
                                
                                {selectedJob.location && (
                                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                        📍 <strong>Location:</strong> {selectedJob.location}
                                    </p>
                                )}
                            </div>

                            {/* Job Status Transition Controls */}
                            {selectedJob.assigned_to === profile.id && (
                                <div className="p-4 bg-blue-50/30 dark:bg-blue-950/10 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Quick Operations:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedJob.status === 'assigned' && (
                                            <button
                                                onClick={() => updateJobStatus(selectedJob.id, 'in_progress')}
                                                className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-yellow-500/25 transition-all flex items-center gap-1.5"
                                            >
                                                Start Work
                                            </button>
                                        )}
                                        {selectedJob.status === 'in_progress' && (
                                            <button
                                                onClick={() => updateJobStatus(selectedJob.id, 'completed')}
                                                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-green-600/25 transition-all flex items-center gap-1.5"
                                            >
                                                Mark Completed
                                            </button>
                                        )}
                                        {selectedJob.status !== 'completed' && selectedJob.status !== 'cancelled' && (
                                            <button
                                                onClick={() => updateJobStatus(selectedJob.id, 'cancelled')}
                                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-red-500 font-bold text-xs rounded-xl transition-all"
                                            >
                                                Cancel Job
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Subpanel Tab bar: Details, Parts logging, Dispatch Chat, Map view */}
                            <div className="flex border-b border-gray-200 dark:border-gray-800 text-sm font-bold bg-gray-50/30 dark:bg-gray-900/10">
                                <button
                                    onClick={() => setActiveJobTab('details')}
                                    className={`flex-1 py-3 text-center transition-all ${activeJobTab === 'details' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900/30' : 'text-gray-500 hover:text-gray-950 dark:hover:text-white'}`}
                                >
                                    Details
                                </button>
                                <button
                                    onClick={() => setActiveJobTab('materials')}
                                    className={`flex-1 py-3 text-center transition-all ${activeJobTab === 'materials' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900/30' : 'text-gray-500 hover:text-gray-950 dark:hover:text-white'}`}
                                >
                                    Materials {parts.length > 0 && `(${parts.length})`}
                                </button>
                                <button
                                    onClick={() => setActiveJobTab('chat')}
                                    className={`flex-1 py-3 text-center transition-all ${activeJobTab === 'chat' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900/30' : 'text-gray-500 hover:text-gray-950 dark:hover:text-white'}`}
                                >
                                    Chat Dispatch
                                </button>
                                <button
                                    onClick={() => setActiveJobTab('map')}
                                    className={`flex-1 py-3 text-center transition-all ${activeJobTab === 'map' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900/30' : 'text-gray-500 hover:text-gray-950 dark:hover:text-white'}`}
                                >
                                    Site Map
                                </button>
                            </div>

                            {/* TAB CONTENTS */}
                            <div className="p-6">
                                
                                {/* 1. Details Pane */}
                                {activeJobTab === 'details' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                        <div className="space-y-4">
                                            <h3 className="font-extrabold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Work Metadata</h3>
                                            <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2.5 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 dark:text-gray-500">Reported</span>
                                                    <span className="font-semibold text-gray-900 dark:text-white">
                                                        {formatDistanceToNow(new Date(selectedJob.created_at))} ago
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 dark:text-gray-500">Severity/Priority</span>
                                                    <span className={`font-bold capitalize ${
                                                        selectedJob.severity === 'critical' ? 'text-red-500' :
                                                        selectedJob.severity === 'high' ? 'text-orange-500' : 'text-green-500'
                                                    }`}>{selectedJob.severity}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400 dark:text-gray-500">Assigned Tech</span>
                                                    <span className="font-semibold text-gray-900 dark:text-white">
                                                        {selectedJob.assigned_to_profile 
                                                            ? `${selectedJob.assigned_to_profile.first_name} ${selectedJob.assigned_to_profile.surname}`
                                                            : 'Unassigned'
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="font-extrabold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Contact Dispatch Info</h3>
                                            <div className="bg-gray-55 or-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                                                <p className="text-gray-600 dark:text-gray-300">
                                                    Need tools or backup? Use the <strong>Chat Dispatch</strong> tab to inform the control operators. Standard emergency contacts are also live using your push-to-talk system on the navigation bar.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 2. Materials Logs Pane */}
                                {activeJobTab === 'materials' && (
                                    <div className="space-y-6 text-left">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-bold text-gray-950 dark:text-white">Parts &amp; Materials Used</h3>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                Total Items: {parts.length}
                                            </span>
                                        </div>

                                        {/* Row Addition Form */}
                                        {selectedJob.status !== 'completed' && selectedJob.status !== 'cancelled' && (
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-gray-50 dark:bg-gray-900/20 p-4 border border-gray-100 dark:border-gray-800 rounded-xl">
                                                <div className="md:col-span-5">
                                                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Item/Part Name</label>
                                                    <input
                                                        type="text"
                                                        value={newPartName}
                                                        onChange={e => setNewPartName(e.target.value)}
                                                        placeholder="e.g. RJ45 Connectors / CCTV Cable"
                                                        className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Qty</label>
                                                    <input
                                                        type="number"
                                                        value={newPartQty}
                                                        onChange={e => setNewPartQty(parseInt(e.target.value) || 1)}
                                                        className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                                                    />
                                                </div>
                                                <div className="md:col-span-3">
                                                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Estimated Unit Cost (R)</label>
                                                    <input
                                                        type="number"
                                                        value={newPartCost}
                                                        onChange={e => setNewPartCost(parseFloat(e.target.value) || 0)}
                                                        className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                                                    />
                                                </div>
                                                <div className="md:col-span-2 flex items-end">
                                                    <button
                                                        type="button"
                                                        onClick={addPartRow}
                                                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all"
                                                    >
                                                        Add Row
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Parts List */}
                                        <div className="border border-gray-200 dark:border-gray-850 rounded-xl overflow-hidden text-xs">
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500 font-bold uppercase text-[10px]">
                                                    <tr>
                                                        <th className="px-4 py-3">Part Description</th>
                                                        <th className="px-4 py-3 text-center">Qty</th>
                                                        <th className="px-4 py-3 text-right">Unit Price</th>
                                                        <th className="px-4 py-3 text-right">Amount</th>
                                                        <th className="px-4 py-3 text-center"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-gray-800 dark:text-gray-200">
                                                    {parts.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
                                                                No parts logged for this job yet.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        parts.map(p => (
                                                            <tr key={p.id}>
                                                                <td className="px-4 py-3 font-medium">{p.name}</td>
                                                                <td className="px-4 py-3 text-center font-mono">{p.qty}</td>
                                                                <td className="px-4 py-3 text-right font-mono">R {p.cost.toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-right font-mono">R {(p.qty * p.cost).toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-center">
                                                                    {selectedJob.status !== 'completed' && selectedJob.status !== 'cancelled' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removePartRow(p.id)}
                                                                            className="text-red-500 hover:text-red-700 font-bold"
                                                                        >
                                                                            Remove
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                            
                                            {/* Subtotal block */}
                                            {parts.length > 0 && (
                                                <div className="bg-gray-50 dark:bg-gray-900/20 p-4 border-t border-gray-250 dark:border-gray-800 flex justify-between items-center text-sm font-bold">
                                                    <span className="text-gray-500">Total Materials Value:</span>
                                                    <span className="text-blue-600 dark:text-blue-400 font-mono">
                                                        R {parts.reduce((sum, item) => sum + (item.qty * item.cost), 0).toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Save action */}
                                        {selectedJob.status !== 'completed' && selectedJob.status !== 'cancelled' && (
                                            <div className="flex justify-end pt-2">
                                                <button
                                                    type="button"
                                                    onClick={handleSaveParts}
                                                    disabled={savingParts}
                                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-1.5"
                                                >
                                                    {savingParts ? 'Saving...' : 'Save Materials Logs'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 3. Chat Room with Dispatch */}
                                {activeJobTab === 'chat' && (
                                    <div className="flex flex-col h-[450px] border border-gray-200 dark:border-gray-850 rounded-2xl bg-gray-50/20 dark:bg-gray-900/5 overflow-hidden">
                                        
                                        {/* Message Feed grid */}
                                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                                            {messages.length === 0 ? (
                                                <div className="my-auto text-center px-4">
                                                    <p className="text-gray-400 dark:text-gray-500 text-sm">
                                                        No messages yet. Send a note to start communicating with Dispatch.
                                                    </p>
                                                </div>
                                            ) : (
                                                messages.map(msg => {
                                                    const isMe = msg.sender_id === profile.id;
                                                    return (
                                                        <div
                                                            key={msg.id}
                                                            className={`flex flex-col max-w-[80%] text-left p-3 rounded-2xl text-xs relative ${
                                                                isMe
                                                                ? 'ml-auto bg-blue-600 text-white rounded-br-none'
                                                                : 'mr-auto bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-150 dark:border-gray-700 rounded-bl-none'
                                                            }`}
                                                        >
                                                            <span className="text-[10px] font-bold opacity-75 mb-1 block">
                                                                {msg.profile?.first_name || 'Dispatch'}
                                                            </span>
                                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                                            <span className="text-[8px] opacity-60 text-right mt-1.5 block">
                                                                {format(new Date(msg.created_at), 'HH:mm')}
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                            <div ref={chatEndRef} />
                                        </div>

                                        {/* Form typing control */}
                                        <form onSubmit={handleSendMsg} className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-850 flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newMsgText}
                                                onChange={e => setNewMsgText(e.target.value)}
                                                placeholder="Write update or message for dispatch..."
                                                className="flex-grow px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                                            />
                                            <button
                                                type="submit"
                                                disabled={sendingMsg || !newMsgText.trim()}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all flex items-center"
                                            >
                                                Send
                                            </button>
                                        </form>
                                    </div>
                                )}

                                {/* 4. Site Map utilizing Leaflet */}
                                {activeJobTab === 'map' && (
                                    <div className="space-y-4 text-left">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-bold text-gray-950 dark:text-white">Job Site Location</h3>
                                            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold font-mono">
                                                COORDS: {selectedJob.location_coords?.lat.toFixed(4)}, {selectedJob.location_coords?.lng.toFixed(4)}
                                            </span>
                                        </div>
                                        
                                        <div className="h-[350px] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-lg">
                                            <MapContainer
                                                center={selectedJob.location_coords ? [selectedJob.location_coords.lat, selectedJob.location_coords.lng] : defaultPosition}
                                                zoom={13}
                                                scrollWheelZoom={true}
                                                style={{ height: '100%', width: '100%', backgroundColor: '#f0f0f0' }}
                                            >
                                                <TileLayer
                                                    attribution='&copy; OpenStreetMap contributors'
                                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                />
                                                <Marker position={selectedJob.location_coords ? [selectedJob.location_coords.lat, selectedJob.location_coords.lng] : defaultPosition}>
                                                    <Popup>
                                                        <div className="text-xs text-left p-1">
                                                            <h4 className="font-bold text-gray-900">{selectedJob.title}</h4>
                                                            <p className="text-gray-500 mt-1">{selectedJob.location}</p>
                                                        </div>
                                                    </Popup>
                                                </Marker>
                                            </MapContainer>
                                        </div>
                                    </div>
                                )}

                            </div>

                        </div>
                    ) : (
                        <div className="h-[60vh] bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-805 rounded-2xl p-6 backdrop-blur-lg shadow-sm flex flex-col items-center justify-center text-center">
                            <WrenchIcon className="w-16 h-16 text-gray-300 dark:text-gray-700 mb-4 animate-pulse" />
                            <h3 className="font-bold text-gray-900 dark:text-white text-xl mb-1">Select a Work Order</h3>
                            <p className="text-gray-400 dark:text-gray-500 max-w-sm text-sm">
                                Please choose a technical operational assignment from the left job roster to review logs, parts checklist, or active chat.
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default TechnicianDashboardPage;
