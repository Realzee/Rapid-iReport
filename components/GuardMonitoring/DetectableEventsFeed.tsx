import React from 'react';
import { useEvents } from '../../contexts/EventsContext';

const DetectableEventsFeed: React.FC = () => {
    const { events, loading } = useEvents();

    if (loading) return <div className="p-4">Loading events...</div>;

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Detectable Events</h2>
            <div className="space-y-4">
                {events.map(event => (
                    <div key={event.id} className="p-3 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-bold uppercase">{event.type}</span>: {event.created_at}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DetectableEventsFeed;
