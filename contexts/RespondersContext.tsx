import React, { createContext, useContext, useState, useEffect } from 'react';
import { Responder, ResponderStatus, UserRole, Profile } from '../types';
import { supabase } from '../utils/supabase';

interface RespondersContextType {
    responders: Responder[];
    loading: boolean;
}

const RespondersContext = createContext<RespondersContextType>({ responders: [], loading: true });

const isResponderRole = (role?: string) => {
    if (!role) return false;
    const r = String(role).toLowerCase();
    return r === 'responder' || r === 'ras_driver' || r === 'roadside_driver' || r === 'driver' || r === 'supervisor' || r === 'guard';
};

export const RespondersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [responders, setResponders] = useState<Responder[]>(() => {
        try {
            const cached = localStorage.getItem('cached_responders_data');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        let retryTimer: any = null;

        const fetchResponders = async (retryCount = 0) => {
            if (!supabase) {
                if (isMounted) setLoading(false);
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*');

                if (error) {
                    console.warn('Notice: Responders fetch notice:', error.message || error);
                    if (retryCount < 3 && isMounted) {
                        retryTimer = setTimeout(() => fetchResponders(retryCount + 1), 3000);
                    }
                } else if (data && isMounted) {
                    const responderProfiles = data.filter((p: Profile) => isResponderRole(p.role));
                    const mappedResponders: Responder[] = responderProfiles.map((p: Profile) => ({
                        id: p.id,
                        first_name: p.first_name,
                        surname: p.surname,
                        status: p.responder_status || ResponderStatus.OFF_DUTY,
                        location_coords: p.location_coords || undefined,
                    }));
                    setResponders(mappedResponders);
                    try {
                        localStorage.setItem('cached_responders_data', JSON.stringify(mappedResponders));
                    } catch (e) {
                        // Ignore quota issues
                    }
                }
            } catch (err: any) {
                console.warn("Transient network issue in fetchResponders:", err?.message || err);
                if (retryCount < 3 && isMounted) {
                    retryTimer = setTimeout(() => fetchResponders(retryCount + 1), 3000);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchResponders();

        if (!supabase) return;

        const channel = supabase.channel('public:profiles-responders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload: any) => {
                const p = (payload.new || payload.old) as Profile;
                if (p && !isResponderRole(p.role)) return;

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
            isMounted = false;
            if (retryTimer) clearTimeout(retryTimer);
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
