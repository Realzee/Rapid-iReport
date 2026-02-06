import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { ChatMessage, Profile, UserRole } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { TrashIcon, CheckIcon, CheckAllIcon } from './icons';
import ConfirmModal from './ConfirmModal';
import { useToast } from '../contexts/ToastContext';

interface IncidentChatProps {
    reportId: string;
    currentUserProfile: Profile;
    allUsers: Profile[];
    disabled?: boolean;
    noInternalScroll?: boolean;
}

const ChatMessageItem: React.FC<{
    msg: ChatMessage;
    isCurrentUser: boolean;
    currentUserProfile: Profile;
}> = ({ msg, isCurrentUser, currentUserProfile }) => {
    const msgRef = useRef<HTMLDivElement>(null);
    const hasBeenMarked = useRef(false);

    useEffect(() => {
        // Only observe incoming messages
        if (!isCurrentUser && msgRef.current) {
            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting && !hasBeenMarked.current) {
                        const alreadyMarkedInDB = msg.read_by?.includes(currentUserProfile.id);
                        if (!alreadyMarkedInDB) {
                            hasBeenMarked.current = true;
                            supabase.rpc('mark_message_as_read', { 
                                message_id: msg.id, 
                                reader_id: currentUserProfile.id 
                            }).then(({ error }) => {
                                if (error) {
                                    console.error("Failed to mark message as read:", error.message);
                                    hasBeenMarked.current = false; // Allow retry on error
                                }
                            });
                        }
                        observer.disconnect();
                    }
                },
                { threshold: 0.8 }
            );

            observer.observe(msgRef.current);
            return () => observer.disconnect();
        }
    }, [msg, isCurrentUser, currentUserProfile.id]);

    const isReadByOthers = msg.read_by && msg.read_by.length > 0;
    const timeAgo = formatDistanceToNow(new Date(msg.created_at), { addSuffix: true });

    return (
        <div ref={msgRef} className={`flex items-start gap-2.5 ${isCurrentUser ? 'justify-end' : ''}`}>
            {!isCurrentUser && (
                <img className="w-8 h-8 rounded-full" src={msg.profile?.avatar_url || `https://i.pravatar.cc/32?u=${msg.user_id}`} alt="avatar" />
            )}
            <div className={`flex flex-col max-w-[80%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    {!isCurrentUser && (
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{msg.profile?.full_name || 'Unknown'}</span>
                    )}
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{!isCurrentUser ? timeAgo : ''}</span>
                </div>
                <div className={`leading-1.5 p-3 border-gray-200 ${isCurrentUser ? 'bg-blue-600 rounded-s-xl rounded-se-xl' : 'bg-gray-200 dark:bg-gray-700 rounded-e-xl rounded-es-xl'}`}>
                    <p className={`text-sm font-normal ${isCurrentUser ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{msg.content}</p>
                </div>
                {isCurrentUser && (
                    <div className="mt-1 flex items-center justify-end space-x-1.5">
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{timeAgo}</span>
                        {isReadByOthers ? (
                            <CheckAllIcon className="w-4 h-4 text-blue-500" />
                        ) : (
                            <CheckIcon className="w-4 h-4 text-gray-400" />
                        )}
                    </div>
                )}
            </div>
            {isCurrentUser && (
                <img className="w-8 h-8 rounded-full" src={currentUserProfile.avatar_url || `https://i.pravatar.cc/32?u=${currentUserProfile.id}`} alt="avatar" />
            )}
        </div>
    );
};

const IncidentChat: React.FC<IncidentChatProps> = ({ reportId, currentUserProfile, allUsers, disabled = false, noInternalScroll = false }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
    const { addToast } = useToast();
    const audioContextRef = useRef<AudioContext | null>(null);

    const canClearChat = useMemo(() => {
        return [UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER].includes(currentUserProfile.role);
    }, [currentUserProfile.role]);

    const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers]);

    const scrollToBottom = () => {
        if (!noInternalScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        }
    };

    useEffect(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        return () => {
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, []);

    const playNotificationSound = () => {
        const context = audioContextRef.current;
        if (!context) return;
        if (context.state === 'suspended') context.resume();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1200, context.currentTime);
        gainNode.gain.setValueAtTime(0.1, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.1);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.1);
    };

    useEffect(() => {
        const initializeChat = async () => {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('report_id', reportId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Error fetching chat messages:", error);
                setMessages([]);
            } else {
                const messagesWithProfiles = data.map(msg => ({
                    ...msg,
                    profile: userMap.get(msg.user_id) ? { full_name: userMap.get(msg.user_id)!.full_name, avatar_url: userMap.get(msg.user_id)!.avatar_url } : { full_name: 'Unknown User' }
                }));
                setMessages(messagesWithProfiles as ChatMessage[]);
            }

            if (disabled) return;

            const handleMessageChange = (payload: any) => {
                if (payload.eventType === 'INSERT') {
                    if (payload.new.user_id !== currentUserProfile.id) playNotificationSound();
                    setMessages(prev => {
                        if (prev.some(msg => msg.id === payload.new.id)) return prev;
                        const userProfile = userMap.get(payload.new.user_id);
                        return [...prev, {
                            ...payload.new,
                            profile: userProfile ? { full_name: userProfile.full_name, avatar_url: userProfile.avatar_url } : { full_name: 'Unknown User', avatar_url: undefined }
                        } as ChatMessage];
                    });
                } else if (payload.eventType === 'UPDATE') {
                    setMessages(prev => prev.map(msg => 
                        msg.id === payload.new.id ? { ...msg, read_by: payload.new.read_by } : msg
                    ));
                } else if (payload.eventType === 'DELETE') {
                    setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
                }
            };

            const channel = supabase
                .channel(`chat-${reportId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `report_id=eq.${reportId}` }, handleMessageChange)
                .subscribe();
            channelRef.current = channel;
        };

        initializeChat();
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [reportId, disabled, userMap, currentUserProfile.id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, noInternalScroll]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || disabled) return;

        setLoading(true);
        const content = newMessage.trim();
        setNewMessage('');

        const { data: newDbMessage, error } = await supabase.from('chat_messages').insert({
            report_id: reportId,
            user_id: currentUserProfile.id,
            content: content,
        }).select().single();

        if (error) {
            console.error("Error sending message:", error);
            setNewMessage(content);
            addToast('Failed to send message: ' + error.message, 'error');
        } else if (newDbMessage) {
            const newUIMessage: ChatMessage = {
                ...newDbMessage,
                profile: { full_name: currentUserProfile.full_name, avatar_url: currentUserProfile.avatar_url }
            };
            setMessages(prevMessages => [...prevMessages, newUIMessage]);
        }
        
        setLoading(false);
    };

    const handleClearChat = async () => {
        setIsConfirmClearOpen(false);
        const { error: deleteError } = await supabase.from('chat_messages').delete().eq('report_id', reportId);
        if (deleteError) {
            addToast(`Failed to clear chat: ${deleteError.message}`, 'error');
            return;
        }
        await supabase.from('report_updates').insert({
            report_id: reportId,
            user_id: currentUserProfile.id,
            content: `Chat history for this incident was cleared.`
        });
        addToast('Chat history cleared successfully.', 'success');
        setMessages([]);
    };

    return (
        <>
            <div className={!noInternalScroll ? 'flex flex-col h-full' : ''}>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Live Chat</h4>
                    {canClearChat && !disabled && messages.length > 0 && (
                        <button onClick={() => setIsConfirmClearOpen(true)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Clear chat history">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className={`bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 space-y-3 border border-gray-200 dark:border-gray-700/50 ${!noInternalScroll ? 'flex-grow overflow-y-auto' : ''}`} style={!noInternalScroll ? { minHeight: '150px' } : {}}>
                    {messages.length === 0 && <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">No messages yet.</p>}
                    {messages.map(msg => (
                        <ChatMessageItem
                            key={msg.id}
                            msg={msg}
                            isCurrentUser={msg.user_id === currentUserProfile.id}
                            currentUserProfile={currentUserProfile}
                        />
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="mt-2 flex space-x-2">
                    <input 
                        type="text" 
                        placeholder={disabled ? "Chat is closed for this incident." : "Type a message..."}
                        value={newMessage} 
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={disabled || loading}
                        className="flex-grow bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    <button type="submit" disabled={loading || disabled} className="px-4 bg-blue-600 text-white font-semibold rounded-lg text-sm hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Send'}
                    </button>
                </form>
            </div>

            <ConfirmModal
                isOpen={isConfirmClearOpen}
                onClose={() => setIsConfirmClearOpen(false)}
                onConfirm={handleClearChat}
                title="Clear Chat History"
                message="Are you sure you want to permanently delete all messages in this chat? This action cannot be undone."
                confirmText="Clear Chat"
                confirmVariant="danger"
            />
        </>
    );
};

export default IncidentChat;