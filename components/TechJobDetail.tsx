import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { TechJob, Profile, TechChatMessage, UserRole } from '../types';
import { safeFormat, safeFormatDistanceToNow } from '../utils/dateUtils';
import { useToast } from '../contexts/ToastContext';

interface TechJobDetailProps {
    job: TechJob;
    allUsers: Profile[];
    onRefresh: () => void;
}

const TechJobDetail: React.FC<TechJobDetailProps> = ({
    job,
    allUsers,
    onRefresh
}) => {
    const { addToast } = useToast();
    const [submitting, setSubmitting] = useState(false);
    const [assignedTo, setAssignedTo] = useState(job.assigned_to || '');

    // Chat sub-module state
    const [messages, setMessages] = useState<TechChatMessage[]>([]);
    const [newMsgText, setNewMsgText] = useState('');
    const [sendingMsg, setSendingMsg] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Active Tab in detail panel: 'status' | 'materials' | 'chat'
    const [activeTab, setActiveTab] = useState<'status' | 'materials' | 'chat'>('status');

    // Filter to technicians
    const technicians = allUsers.filter(u => u.role === UserRole.TECHNICIAN);

    useEffect(() => {
        setAssignedTo(job.assigned_to || '');
    }, [job]);

    // Fetch Chat messages
    const fetchChatMessages = async () => {
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
                .eq('job_id', job.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data as TechChatMessage[] || []);
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch (e: any) {
            console.error('Error fetching chat messages:', e);
        }
    };

    useEffect(() => {
        fetchChatMessages();

        const channel = supabase
            .channel(`controller_tech_chat_${job.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tech_chat_messages', filter: `job_id=eq.${job.id}` }, () => {
                fetchChatMessages();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [job.id]);

    const handleAssignChange = async (techId: string) => {
        setAssignedTo(techId);
        setSubmitting(true);
        try {
            const statusUpdate = techId ? 'assigned' : 'pending';
            const { error } = await supabase
                .from('tech_jobs')
                .update({ 
                    assigned_to: techId || null, 
                    status: statusUpdate,
                    updated_at: new Date().toISOString()
                })
                .eq('id', job.id);

            if (error) throw error;

            addToast('Technician assigned successfully!', 'success');
            onRefresh();
        } catch (err: any) {
            console.error('Error updating assignee:', err);
            addToast('Failed to assign technician.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateStatus = async (status: TechJob['status']) => {
        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('tech_jobs')
                .update({ 
                    status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', job.id);

            if (error) throw error;

            addToast(`Work order marked ${status}!`, 'success');
            onRefresh();
        } catch (err: any) {
            console.error('Error updating status:', err);
            addToast('Failed to update work order status.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSendMsg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMsgText.trim() || sendingMsg) return;

        setSendingMsg(true);
        try {
            const { error } = await supabase
                .from('tech_chat_messages')
                .insert({
                    job_id: job.id,
                    sender_id: allUsers.find(u => u.role === UserRole.ADMIN || u.role === UserRole.CONTROLLER)?.id || job.reported_by,
                    content: newMsgText.trim()
                });

            if (error) throw error;
            setNewMsgText('');
            fetchChatMessages();
        } catch (e: any) {
            console.error('Error sending chat message:', e);
            addToast('Failed to send message.', 'error');
        } finally {
            setSendingMsg(false);
        }
    };

    const assignedProfile = allUsers.find(u => u.id === job.assigned_to);

    return (
        <div className="bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-6 backdrop-blur-lg flex flex-col h-full text-left">
            {/* Header info */}
            <div className="border-b border-gray-150 dark:border-gray-800 pb-4 mb-4">
                <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-blue-600 dark:text-blue-400">
                    Technical Work Order Info
                </span>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                    {job.title}
                </h3>
                <p className="text-xs text-gray-500 mt-2 whitespace-pre-wrap">
                    {job.description || 'No instruction narrative provided for this technician task.'}
                </p>
                {job.location && (
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-3 font-medium">
                        📍 Location Context: <strong className="text-gray-800 dark:text-gray-300">{job.location}</strong>
                    </div>
                )}
            </div>

            {/* Quick tab controls */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl text-xs font-bold mb-5 flex-shrink-0">
                <button
                    onClick={() => setActiveTab('status')}
                    className={`flex-grow py-2 rounded-lg transition-all ${activeTab === 'status' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-950 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                    Dispatch Controls
                </button>
                <button
                    onClick={() => setActiveTab('materials')}
                    className={`flex-grow py-2 rounded-lg transition-all ${activeTab === 'materials' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-950 dark:text-white' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                    Logged Parts
                </button>
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex-grow py-2 rounded-lg transition-all ${activeTab === 'chat' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-950 dark:text-white' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                >
                    Live Chat
                </button>
            </div>

            {/* TAB CONTENT GRID */}
            <div className="flex-grow">
                
                {/* 1. Status Controls */}
                {activeTab === 'status' && (
                    <div className="space-y-5 text-xs text-left">
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-850 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                            <div>
                                <span className="block text-gray-400 dark:text-gray-500 mb-1">State Progress</span>
                                <span className="font-extrabold uppercase text-xs tracking-wider text-blue-600 dark:text-blue-400">
                                    {job.status.replace('_', ' ')}
                                </span>
                            </div>
                            <div>
                                <span className="block text-gray-400 dark:text-gray-500 mb-1">Created Time</span>
                                <span className="font-semibold text-gray-800 dark:text-gray-300">
                                    {safeFormatDistanceToNow(job.created_at)} ago
                                </span>
                            </div>
                        </div>

                        {/* Assign technician selection */}
                        <div className="space-y-1.5">
                            <label className="block font-bold text-gray-750 dark:text-gray-300 uppercase text-[10px]">
                                Re-route / Reassess Technical Assignee
                            </label>
                            <select
                                value={assignedTo}
                                disabled={submitting}
                                onChange={e => handleAssignChange(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                            >
                                <option value="">Draft (Unassigned)</option>
                                {technicians.map(tech => (
                                    <option key={tech.id} value={tech.id}>
                                        {tech.first_name} {tech.surname} (Online)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Complete work buttons */}
                        <div className="pt-2 border-t border-gray-150 dark:border-gray-800 space-y-2">
                            <span className="block font-bold text-gray-750 dark:text-gray-300 uppercase text-[10px]">
                                Force State Operations
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {job.status !== 'completed' && (
                                    <button
                                        onClick={() => handleUpdateStatus('completed')}
                                        disabled={submitting}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition"
                                    >
                                        Seal Completed
                                    </button>
                                )}
                                {job.status !== 'cancelled' && (
                                    <button
                                        onClick={() => handleUpdateStatus('cancelled')}
                                        disabled={submitting}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-red-500 hover:bg-red-500 hover:text-white font-bold rounded-lg transition border border-red-500/20"
                                    >
                                        Abort / Cancel Job
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Logged Materials */}
                {activeTab === 'materials' && (
                    <div className="space-y-4 text-xs text-left">
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">Logged Parts List</h4>
                        <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 font-extrabold uppercase text-[9px]">
                                    <tr>
                                        <th className="px-4 py-2.5">Item Description</th>
                                        <th className="px-4 py-2.5 text-center">Qty</th>
                                        <th className="px-4 py-2.5 text-right font-mono">Cost</th>
                                        <th className="px-4 py-2.5 text-right font-mono">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-150 dark:divide-gray-800 text-gray-800 dark:text-gray-200">
                                    {!job.parts_logged || job.parts_logged.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 font-semibold">
                                                No parts logged by the technician for this job yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        job.parts_logged.map((p, idx) => (
                                            <tr key={p.id || idx}>
                                                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                                                <td className="px-4 py-2.5 text-center font-mono">{p.qty}</td>
                                                <td className="px-4 py-2.5 text-right font-mono">R {(p.cost || 0).toFixed(2)}</td>
                                                <td className="px-4 py-2.5 text-right font-mono">R {((p.qty || 0) * (p.cost || 0)).toFixed(2)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {job.parts_logged && job.parts_logged.length > 0 && (
                                <div className="p-3 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-800 flex justify-between font-bold text-xs text-gray-900 dark:text-white">
                                    <span>Materials Sum Total:</span>
                                    <span className="font-mono text-blue-600 dark:text-blue-400">
                                        R {job.parts_logged.reduce((sum, item) => sum + ((item.qty || 0) * (item.cost || 0)), 0).toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. Live 1:1 Job Chatroom */}
                {activeTab === 'chat' && (
                    <div className="flex flex-col h-[320px] border border-gray-200 dark:border-gray-850 rounded-2xl bg-gray-50/25 dark:bg-gray-900/10 overflow-hidden text-xs">
                        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
                            {messages.length === 0 ? (
                                <div className="my-auto text-center px-4">
                                    <p className="text-gray-400 dark:text-gray-500 font-medium">
                                        No correspondence recorded. Send a quick guideline to the technician.
                                    </p>
                                </div>
                            ) : (
                                messages.map(msg => {
                                    const isMe = msg.sender_id !== job.assigned_to;
                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex flex-col max-w-[85%] text-left p-2.5 rounded-2xl relative ${
                                                isMe
                                                ? 'ml-auto bg-blue-600 text-white rounded-br-none'
                                                : 'mr-auto bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-none'
                                            }`}
                                        >
                                            <span className="text-[9px] font-bold opacity-75 mb-0.5 block">
                                                {msg.profile?.first_name || 'Dispatch'}
                                            </span>
                                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                            <span className="text-[7px] opacity-60 text-right mt-1 block">
                                                {safeFormat(msg.created_at, 'HH:mm')}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <form onSubmit={handleSendMsg} className="p-2 border-t border-gray-200 dark:border-gray-850 bg-white dark:bg-gray-900 flex gap-1.5 items-center">
                            <input
                                type="text"
                                value={newMsgText}
                                onChange={e => setNewMsgText(e.target.value)}
                                placeholder="Write dispatcher instruction..."
                                className="flex-grow px-3 py-1.5 bg-gray-55 or-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-750 rounded-lg focus:outline-none"
                            />
                            <button
                                type="submit"
                                disabled={sendingMsg || !newMsgText.trim()}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
                            >
                                Send
                            </button>
                        </form>
                    </div>
                )}

            </div>
        </div>
    );
};

export default TechJobDetail;
