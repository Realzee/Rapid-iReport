import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useMemo } from 'react';
import { Report, Profile, ChatMessage, UserRole, VehicleReport } from '../types';
import { supabase } from '../utils/supabase';
import { useToast } from './ToastContext';
import ChatManager from '../components/ChatModal';

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

            // Ignore own messages
            if (newMessage.user_id === profile.id) return;

            // Check if this message is for a chat that's currently active in the tray
            const activeChat = activeChats.find(c => c.id === newMessage.report_id);
            if (!activeChat) {
                // This is a message for a report the user doesn't have open in their tray.
                // The global notification bell system handles this, so we do nothing here.
                return;
            }

            // If the chat for this message is currently expanded, do nothing.
            // The message will appear live, and IncidentChat component handles marking as read.
            if (expandedChatId === newMessage.report_id) {
                return;
            }

            // The chat is active but minimized. Increment unread count and show a toast.
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
    }, [profile, activeChats, expandedChatId, addToast, expandChat]);

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
