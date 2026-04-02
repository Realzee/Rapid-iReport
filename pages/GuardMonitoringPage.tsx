import React from 'react';
import GuardStatusDashboard from '../components/GuardMonitoring/GuardStatusDashboard';
import GuardMapView from '../components/GuardMonitoring/GuardMapView';
import { useResponders } from '../contexts/RespondersContext';

const GuardMonitoringPage: React.FC = () => {
    const { responders, loading } = useResponders();

    if (loading) return <div className="p-6">Loading...</div>;

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Guard Monitoring</h1>
            <GuardStatusDashboard responders={responders} />
            <GuardMapView responders={responders} />
            {/* Other features will be added here */}
        </div>
    );
};

export default GuardMonitoringPage;
