import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { ChatMessage, Profile } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface IncidentChatProps {
    reportId: string;
    currentUserProfile: Profile;
    disabled?: boolean;
    noInternalScroll?: boolean;
}

const IncidentChat: React.FC<IncidentChatProps> = ({ reportId, currentUserProfile, disabled = false, noInternalScroll = false }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (!noInternalScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*, profile:profiles(full_name, avatar_url)')
                .eq('report_id', reportId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Error fetching chat messages:", error);
            } else {
                setMessages(data as any);
            }
        };

        fetchMessages();

        if (disabled) return;

        const channel = supabase
            .channel(`chat-${reportId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `report_id=eq.${reportId}`
            }, async (payload) => {
                const { data: profileData } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', payload.new.user_id).single();
                const newMsg = { ...payload.new, profile: profileData } as ChatMessage;
                setMessages(prev => [...prev, newMsg]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [reportId, disabled]);

    useEffect(() => {
        scrollToBottom();
    }, [messages.length, noInternalScroll]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || disabled) return;

        setLoading(true);
        const { error } = await supabase.from('chat_messages').insert({
            report_id: reportId,
            user_id: currentUserProfile.id,
            content: newMessage.trim(),
        });

        if (error) {
            console.error("Error sending message:", error);
        } else {
            setNewMessage('');
        }
        setLoading(false);
    };

    return (
        <div className={!noInternalScroll ? 'flex flex-col h-full' : ''}>
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Live Chat</h4>
            <div 
                className={`bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 space-y-3 border border-gray-200 dark:border-gray-700/50 ${!noInternalScroll ? 'flex-grow overflow-y-auto' : ''}`}
                style={!noInternalScroll ? { minHeight: '150px' } : {}}
            >
                {messages.length === 0 && <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">No messages yet.</p>}
                {messages.map(msg => (
                    <div key={msg.id} className={`flex items-start gap-2.5 ${msg.user_id === currentUserProfile.id ? 'justify-end' : ''}`}>
                        {msg.user_id !== currentUserProfile.id && (
                             <img className="w-8 h-8 rounded-full" src={msg.profile?.avatar_url || `https://i.pravatar.cc/32?u=${msg.user_id}`} alt="avatar" />
                        )}
                        <div className={`flex flex-col max-w-[80%] ${msg.user_id === currentUserProfile.id ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                {msg.user_id !== currentUserProfile.id && (
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{msg.profile?.full_name || 'Unknown'}</span>
                                )}
                                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                            </div>
                            <div className={`leading-1.5 p-3 border-gray-200 ${msg.user_id === currentUserProfile.id ? 'bg-blue-600 rounded-s-xl rounded-se-xl' : 'bg-gray-200 dark:bg-gray-700 rounded-e-xl rounded-es-xl'}`}>
                                <p className={`text-sm font-normal ${msg.user_id === currentUserProfile.id ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{msg.content}</p>
                            </div>
                        </div>
                         {msg.user_id === currentUserProfile.id && (
                             <img className="w-8 h-8 rounded-full" src={currentUserProfile.avatar_url || `https://i.pravatar.cc/32?u=${currentUserProfile.id}`} alt="avatar" />
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="mt-2 flex space-x-2">
                <input 
                    type="text" 
                    placeholder={disabled ? "Chat is closed for this incident." : "Type a message..."}
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={disabled}
                    className="flex-grow bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all disabled:cursor-not-allowed disabled:opacity-70"
                />
                <button type="submit" disabled={loading || disabled} className="px-4 bg-blue-600 text-white font-semibold rounded-lg text-sm hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                     {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Send'}
                </button>
            </form>
        </div>
    );
};

export default IncidentChat;
