import React, { createContext, useContext, useState, useEffect } from 'react';
import { Responder, ResponderStatus, UserRole, Profile } from '../types';
import { supabase } from '../utils/supabase';

interface RespondersContextType {
    responders: Responder[];
    loading: boolean;
}

const RespondersContext = createContext<RespondersContextType>({ responders: [], loading: true });

export const RespondersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [responders, setResponders] = useState<Responder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchResponders = async () => {
            if (!supabase) {
                setLoading(false);
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('role', UserRole.RESPONDER);

                if (error) {
                    console.error('Error fetching responders:', error);
                } else if (data) {
                    const mappedResponders: Responder[] = data.map((p: Profile) => ({
                        id: p.id,
                        first_name: p.first_name,
                        surname: p.surname,
                        status: p.responder_status || ResponderStatus.OFF_DUTY,
                        location_coords: p.location_coords || undefined,
                    }));
                    setResponders(mappedResponders);
                }
            } catch (err) {
                console.error("Error in fetchResponders:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchResponders();

        if (!supabase) return;

        const channel = supabase.channel('public:profiles-responders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'role=eq.responder' }, (payload: any) => {
                // Save database quota by updating local state directly from the realtime payload instead of executing fetch queries
                if (payload.eventType === 'INSERT') {
                    const p = payload.new as Profile;
                    const newR: Responder = {
                        id: p.id,
                        first_name: p.first_name,
                        surname: p.surname,
                        status: p.responder_status || ResponderStatus.OFF_DUTY,
                        location_coords: p.location_coords || undefined,
                    };
                    setResponders(prev => {
                        if (prev.some(r => r.id === newR.id)) return prev;
                        return [...prev, newR];
                    });
                } else if (payload.eventType === 'UPDATE') {
                    const p = payload.new as Profile;
                    setResponders(prev => prev.map(r => {
                        if (r.id === p.id) {
                            return {
                                ...r,
                                first_name: p.first_name || r.first_name,
                                surname: p.surname || r.surname,
                                status: p.responder_status || r.status || ResponderStatus.OFF_DUTY,
                                location_coords: p.location_coords || r.location_coords,
                            };
                        }
                        return r;
                    }));
                } else if (payload.eventType === 'DELETE') {
                    const oldId = payload.old?.id;
                    if (oldId) {
                        setResponders(prev => prev.filter(r => r.id !== oldId));
                    }
                }
            })
            .subscribe();

        return () => {
            if (supabase) {
                supabase.removeChannel(channel);
            }
        };
    }, []);

    return (
        <RespondersContext.Provider value={{ responders, loading }}>
            {children}
        </RespondersContext.Provider>
    );
};

export const useResponders = () => useContext(RespondersContext);
