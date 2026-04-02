import React, { useState, useEffect } from 'react';
import GuardStatusDashboard from '../components/GuardMonitoring/GuardStatusDashboard';
import GuardMapView from '../components/GuardMonitoring/GuardMapView';
import ConfigurationPanel from '../components/GuardMonitoring/ConfigurationPanel';
import ReportingPanel from '../components/GuardMonitoring/ReportingPanel';
import AnalyticsPanel from '../components/GuardMonitoring/AnalyticsPanel';
import { useResponders } from '../contexts/RespondersContext';

const GuardMonitoringPage: React.FC = () => {
    const { responders, loading } = useResponders();
    const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'reporting' | 'analytics'>('overview');
    const [data, setData] = useState<any>({ site: [], guard: [], route: [], supervisor: [], checkpoint: [] });

    useEffect(() => {
        const fetchData = async () => {
            const tables = ['site', 'guard', 'route', 'supervisor', 'checkpoint'];
            const results: any = {};
            for (const table of tables) {
                const response = await fetch(`/api/guard-monitoring?table=${table}`);
                if (response.ok) results[table] = await response.json();
            }
            setData(results);
        };
        fetchData();
    }, []);

    if (loading) return <div className="p-6">Loading...</div>;

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'config', label: 'Configuration' },
        { id: 'reporting', label: 'Reporting' },
        { id: 'analytics', label: 'Analytics' },
    ] as const;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Guard Monitoring</h1>
                <nav className="flex space-x-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                                    : 'text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-6">
                {Object.entries(data).map(([table, items]: [string, any]) => (
                    <div key={table} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                        <h3 className="font-bold capitalize mb-2">{table}s ({items.length})</h3>
                        <ul className="text-sm">
                            {items.map((item: any) => <li key={item.id}>{item.name || 'Unnamed'}</li>)}
                        </ul>
                    </div>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <GuardStatusDashboard responders={responders} />
                    <GuardMapView responders={responders} />
                </div>
            )}
            {activeTab === 'config' && <ConfigurationPanel />}
            {activeTab === 'reporting' && <ReportingPanel />}
            {activeTab === 'analytics' && <AnalyticsPanel />}
        </div>
    );
};

export default GuardMonitoringPage;
