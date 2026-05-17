import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { Report, PanicAlert, Shift } from '../types';

interface Event {
    id: string;
    type: 'report' | 'panic' | 'shift';
    data: Report | PanicAlert | Shift;
    created_at: string;
}

interface EventsContextType {
    events: Event[];
    loading: boolean;
}

const EventsContext = createContext<EventsContextType>({ events: [], loading: true });

export const EventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            if (!supabase) {
                setLoading(false);
                return;
            }
            setLoading(true);
            // Fetch reports, panic alerts, shifts
            try {
                const [reports, panics, shifts] = await Promise.all([
                    supabase.from('vehicle_reports').select('*'),
                    supabase.from('panic_alerts').select('*'),
                    supabase.from('shifts').select('*')
                ]);

                const allEvents: Event[] = [
                    ...(reports.data || []).map(r => ({ id: r.id, type: 'report' as const, data: r, created_at: r.reported_at })),
                    ...(panics.data || []).map(p => ({ id: p.id, type: 'panic' as const, data: p, created_at: p.created_at })),
                    ...(shifts.data || []).map(s => ({ id: s.id, type: 'shift' as const, data: s, created_at: s.created_at }))
                ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                setEvents(allEvents);
            } catch (err) {
                console.error("Error fetching events:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();

        // Real-time subscriptions would go here
    }, []);

    return (
        <EventsContext.Provider value={{ events, loading }}>
            {children}
        </EventsContext.Provider>
    );
};

export const useEvents = () => useContext(EventsContext);
