
import React, { useState, useEffect } from 'react';
import { supabase, supabaseAnonKey } from '../utils/supabase';
import { RegistrationRequest, RequestStatus } from '../types';
import { ClipboardCheckIcon, UserIcon, MailIcon, PhoneIcon, BuildingIcon } from '../components/icons';
import { format, formatDistanceToNow } from 'date-fns';

const RequestCard: React.FC<{ request: RegistrationRequest; onApprove: (id: string) => void; onReject: (id: string) => void; processingId: string | null }> = ({ request, onApprove, onReject, processingId }) => {
    const isProcessing = processingId === request.id;
    return (
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md transition-all duration-300 hover:shadow-lg hover:border-blue-500/50">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{request.full_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">has requested an account.</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {/* Personal Details */}
                <div className="space-y-3">
                    <div className="flex items-center gap-3"><MailIcon className="w-5 h-5 text-gray-400"/><a href={`mailto:${request.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">{request.email}</a></div>
                    {request.phone_number && <div className="flex items-center gap-3"><PhoneIcon className="w-5 h-5 text-gray-400"/><span>{request.phone_number}</span></div>}
                </div>
                 {/* Company Details */}
                <div className="space-y-3">
                    {request.company_name ? (
                        <div className="flex items-start gap-3"><BuildingIcon className="w-5 h-5 text-gray-400 mt-0.5"/><div><p className="font-semibold">{request.company_name}</p></div></div>
                    ) : (
                         <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 italic"><BuildingIcon className="w-5 h-5 text-gray-400"/>No company specified</div>
                    )}
                </div>
                {/* Message */}
                {request.message && (
                    <div className="md:col-span-2 mt-2 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-md border border-gray-200 dark:border-gray-700/50">
                        <p className="text-gray-600 dark:text-gray-300">{request.message}</p>
                    </div>
                )}
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700/50 flex justify-end items-center gap-3 rounded-b-lg">
                <button 
                    onClick={() => onReject(request.id)}
                    disabled={isProcessing}
                    className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                    Reject
                </button>
                 <button 
                    onClick={() => onApprove(request.id)}
                    disabled={isProcessing}
                    className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 rounded-md hover:scale-105 transition-transform duration-300 disabled:opacity-50 disabled:cursor-wait flex items-center gap-2"
                >
                    {isProcessing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    {isProcessing ? 'Approving...' : 'Approve'}
                </button>
            </div>
        </div>
    );
};

const RequestsPage: React.FC = () => {
    const [requests, setRequests] = useState<RegistrationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        const fetchRequests = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('registration_requests')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) console.error("Error fetching requests:", error);
            else setRequests(data || []);
            setLoading(false);
        };
        fetchRequests();

        const channel = supabase
            .channel('public:registration_requests:admin')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registration_requests'},
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setRequests(prev => [...prev, payload.new as RegistrationRequest]);
                    } else if (payload.eventType === 'UPDATE') {
                        setRequests(prev => prev.map(r => r.id === payload.new.id ? payload.new as RegistrationRequest : r));
                    } else if (payload.eventType === 'DELETE') {
                        setRequests(prev => prev.filter(r => r.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleApprove = async (requestId: string) => {
        if (!window.confirm("Are you sure you want to approve this user? This will create an account and send them an invitation email.")) return;
        
        setProcessingId(requestId);
        try {
            const { error } = await supabase.functions.invoke('approve-registration', {
                body: { requestId },
            });
            if (error) throw error;
            alert('User approved successfully! They will receive an email to set their password.');
        } catch (error: any) {
            alert(`Failed to approve request: ${error.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (requestId: string) => {
        if (!window.confirm("Are you sure you want to reject this request?")) return;

        setProcessingId(requestId);
        const { error } = await supabase
            .from('registration_requests')
            .update({ status: RequestStatus.REJECTED })
            .eq('id', requestId);

        if (error) alert(`Failed to reject request: ${error.message}`);
        setProcessingId(null);
    };
    
    const pendingRequests = requests.filter(r => r.status === RequestStatus.PENDING);

    return (
        <div className="container mx-auto">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <ClipboardCheckIcon className="w-8 h-8"/> Access Requests
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Review and manage new user account submissions.</p>
                </div>
            </div>
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : pendingRequests.length > 0 ? (
                <div className="space-y-6">
                    {pendingRequests.map(req => (
                        <RequestCard key={req.id} request={req} onApprove={handleApprove} onReject={handleReject} processingId={processingId}/>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl">
                     <ClipboardCheckIcon className="w-16 h-16 mx-auto text-gray-400"/>
                     <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">All caught up!</h3>
                     <p className="mt-2 text-gray-500 dark:text-gray-400">There are no pending registration requests.</p>
                </div>
            )}
        </div>
    );
};

export default RequestsPage;
