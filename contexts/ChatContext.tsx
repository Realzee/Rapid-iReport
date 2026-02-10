import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { Report, Profile, ChatMessage, UserRole, VehicleReport } from '../types';
import { supabase } from '../utils/supabase';
import { useToast } from './ToastContext';
import ChatModal from '../components/ChatModal';

interface ChatContextType {
  openChat: (report: Report) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

export const ChatProvider: React.FC<{ children: ReactNode; profile: Profile | null }> = ({ children, profile }) => {
    const [chatReport, setChatReport] = useState<Report | null>(null);
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
    const { addToast } = useToast();

    // Fetch and subscribe to allUsers list, as it's needed by the chat modal
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

    const openChat = useCallback((report: Report) => setChatReport(report), []);
    const closeChat = useCallback(() => setChatReport(null), []);

    useEffect(() => {
        if (!profile) return;

        const handleNewMessage = (payload: any) => {
            const newMessage = payload.new as ChatMessage;

            if (newMessage.user_id === profile.id || chatReport?.id === newMessage.report_id) {
                return;
            }
            
            const fetchReportInfoAndNotify = async () => {
                let reportTitle = `report ${newMessage.report_id.substring(0, 8)}...`;
                let foundReport: Report | null = null;
                
                const { data: vData } = await supabase.from('vehicle_reports').select('*').eq('id', newMessage.report_id).single();
                if (vData) {
                    foundReport = vData as Report;
                    reportTitle = vData.license_plate || vData.ob_number;
                } else {
                    const { data: cData } = await supabase.from('crime_reports').select('*').eq('id', newMessage.report_id).single();
                    if(cData) {
                        foundReport = cData as Report;
                        reportTitle = cData.title || cData.ob_number;
                    }
                }

                if (foundReport) {
                    addToast(
                        `New chat message in: ${reportTitle}`,
                        'info',
                        () => openChat(foundReport!)
                    );
                }
            }
            
            fetchReportInfoAndNotify();
        };

        const chatChannel = supabase
            .channel(`chat-notifications-listener-${profile.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages' },
                handleNewMessage
            )
            .subscribe();

        return () => {
            supabase.removeChannel(chatChannel);
        };
    }, [profile, chatReport, addToast, openChat]);

    return (
        <ChatContext.Provider value={{ openChat }}>
            {children}
            {profile && (
                <ChatModal
                    isOpen={!!chatReport}
                    onClose={closeChat}
                    report={chatReport}
                    profile={profile}
                    allUsers={allUsers}
                />
            )}
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