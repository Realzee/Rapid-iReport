import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useMemo, useRef } from 'react';
import { Report, Profile, ChatMessage, UserRole, VehicleReport } from '../types';
import { supabase } from '../utils/supabase';
import { useToast } from './ToastContext';
import ChatManager from '../components/ChatModal';
import { CONTROLLER_CHANNEL_ID, CONTROLLER_CHANNEL_REPORT } from '../constants';

interface ChatContextType {
  activeChats: Report[];
  expandedChatId: string | null;
  unreadCounts: Record<string, number>;
  openChat: (report: Report) => void;
  closeChat: (reportId: string) => void;
  minimizeChat: () => void;
  expandChat: (reportId: string) => void;
  profile: Profile | null;
  allUsers: Profile[];
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

export const ChatProvider: React.FC<{ children: ReactNode; profile: Profile | null }> = ({ children, profile }) => {
    const [activeChats, setActiveChats] = useState<Report[]>([]);
    const [expandedChatId, setExpandedChatId] = useState<string | null>(null);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
    const { addToast } = useToast();
    const audioContextRef = useRef<AudioContext | null>(null);

    // Fetch and subscribe to allUsers list, as it's needed by the chat components
    useEffect(() => {
        if (!profile) return;

        const fetchAllUsers = async () => {
            const usersQuery = supabase.from('profiles').select('*');
            if (profile.role !== UserRole.ADMIN && profile.company_id) {
                usersQuery.eq('company_id', profile.company_id);
            }
            const { data, error } = await usersQuery;
            if (error) console.error("ChatContext: Failed to load users list:", error.message);
            else setAllUsers(data || []);
        };
        fetchAllUsers();
        
        const profilesChannel = supabase.channel('chat-context-profiles')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
                 setAllUsers(current => {
                    if (payload.eventType === 'INSERT') return [...current, payload.new as Profile];
                    if (payload.eventType === 'UPDATE') return current.map(u => u.id === payload.new.id ? payload.new as Profile : u);
                    if (payload.eventType === 'DELETE') return current.filter(u => u.id !== (payload.old as any).id);
                    return current;
                 });
            }).subscribe();
            
        return () => {
            supabase.removeChannel(profilesChannel);
        };
    }, [profile]);
    
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

    const playNotificationSound = useCallback((freq = 1200, duration = 0.1, volume = 0.1) => {
        const context = audioContextRef.current;
        if (!context) return;
        if (context.state === 'suspended') context.resume();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, context.currentTime);
        gainNode.gain.setValueAtTime(volume, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + duration);
    }, []);

    const openChat = useCallback((report: Report) => {
        setActiveChats(prev => {
            if (prev.some(c => c.id === report.id)) return prev;
            return [...prev, report];
        });
        setExpandedChatId(report.id);
        setUnreadCounts(prev => ({ ...prev, [report.id]: 0 }));
    }, []);

    const closeChat = useCallback((reportId: string) => {
        setActiveChats(prev => prev.filter(c => c.id !== reportId));
        if (expandedChatId === reportId) setExpandedChatId(null);
        setUnreadCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts[reportId];
            return newCounts;
        });
    }, [expandedChatId]);

    const minimizeChat = useCallback(() => {
        setExpandedChatId(null);
    }, []);

    const expandChat = useCallback((reportId: string) => {
        setExpandedChatId(reportId);
        setUnreadCounts(prev => ({ ...prev, [reportId]: 0 }));
    }, []);

    useEffect(() => {
        if (!profile) return;

        const handleNewMessage = (payload: any) => {
            const newMessage = payload.new as ChatMessage;
            if (newMessage.user_id === profile.id) return; // Ignore own messages

            // Special handling for the global Staff Channel
            if (newMessage.report_id === CONTROLLER_CHANNEL_ID) {
                if (expandedChatId !== CONTROLLER_CHANNEL_ID) {
                    playNotificationSound(1500, 0.15, 0.2); // A slightly different sound for staff chat
                    setUnreadCounts(prev => ({
                        ...prev,
                        [CONTROLLER_CHANNEL_ID]: (prev[CONTROLLER_CHANNEL_ID] || 0) + 1
                    }));
                    addToast(
                        `New message in Staff Channel`,
                        'info',
                        () => openChat(CONTROLLER_CHANNEL_REPORT)
                    );
                }
                return; // Stop further processing for staff channel messages
            }

            // Standard handling for regular report chats
            const activeChat = activeChats.find(c => c.id === newMessage.report_id);
            if (!activeChat) {
                // Not an open chat tray item, so the global bell notification will handle it.
                return;
            }

            if (expandedChatId === newMessage.report_id) {
                // Chat is already open and visible, so no extra notification needed.
                return;
            }

            // Chat is in the tray but minimized. Increment unread count and show a toast.
            playNotificationSound();
            setUnreadCounts(prev => ({
                ...prev,
                [newMessage.report_id]: (prev[newMessage.report_id] || 0) + 1
            }));
            
            const reportTitle = isVehicleReport(activeChat) ? activeChat.license_plate : activeChat.title;
            addToast(
                `New message in: ${reportTitle}`,
                'info',
                () => expandChat(activeChat.id)
            );
        };

        const chatChannel = supabase
            .channel(`chat-notifications-listener-${profile.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, handleNewMessage)
            .subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
        };
    }, [profile, activeChats, expandedChatId, addToast, expandChat, openChat, playNotificationSound]);

    const value = useMemo(() => ({
        activeChats,
        expandedChatId,
        unreadCounts,
        openChat,
        closeChat,
        minimizeChat,
        expandChat,
        profile,
        allUsers,
    }), [activeChats, expandedChatId, unreadCounts, openChat, closeChat, minimizeChat, expandChat, profile, allUsers]);

    return (
        <ChatContext.Provider value={value}>
            {children}
            {profile && <ChatManager />}
        </ChatContext.Provider>
    );
};

export const useChat = (): ChatContextType => {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};