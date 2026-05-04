import React, { useState, useEffect } from 'react';
import GuardStatusDashboard from '../components/GuardMonitoring/GuardStatusDashboard';
import GuardMapView from '../components/GuardMonitoring/GuardMapView';
import ConfigurationPanel from '../components/GuardMonitoring/ConfigurationPanel';
import ReportingPanel from '../components/GuardMonitoring/ReportingPanel';
import AnalyticsPanel from '../components/GuardMonitoring/AnalyticsPanel';
import GateAccessPage from './GateAccessPage';
import { useResponders } from '../contexts/RespondersContext';
import { Profile } from '../types';
import { ScanIcon, MapIcon, BuildingIcon, ClipboardCheckIcon, ChartBarIcon } from '../components/icons';

interface GuardMonitoringPageProps {
    profile: Profile;
}

const GuardMonitoringPage: React.FC<GuardMonitoringPageProps> = ({ profile }) => {
    const { responders, loading } = useResponders();
    const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'reporting' | 'analytics' | 'gate_access'>('gate_access');
    const [data, setData] = useState<any>({ sites: [], guards: [], routes: [], supervisors: [], checkpoints: [] });

    useEffect(() => {
        const fetchData = async () => {
            const tables = ['sites', 'guards', 'routes', 'supervisors', 'checkpoints', 'patrol_logs'];
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
        { id: 'gate_access', label: 'Gate Access Control', icon: ScanIcon },
        { id: 'overview', label: 'Overview', icon: MapIcon },
        { id: 'config', label: 'Configuration', icon: BuildingIcon },
        { id: 'reporting', label: 'Reporting', icon: ClipboardCheckIcon },
        { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
    ] as const;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Guarding</h1>
                <nav className="flex space-x-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                                    : 'text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-6">
                {Object.entries(data).map(([table, items]: [string, any]) => (
                    <div key={table} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                        <h3 className="font-bold capitalize mb-2">{table} ({items?.length || 0})</h3>
                        <ul className="text-sm">
                            {items?.map((item: any) => (
                                <li key={item.id} className="flex items-center gap-2">
                                    {item.logo_url && <img src={item.logo_url} alt="" className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />}
                                    {item.profile_pic_url && <img src={item.profile_pic_url} alt="" className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />}
                                    <span>{item.name || 'Unnamed'}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {activeTab === 'gate_access' && <GateAccessPage profile={profile} />}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <GuardStatusDashboard responders={responders} data={data} />
                    <GuardMapView responders={responders} sites={data.sites} />
                </div>
            )}
            {activeTab === 'config' && <ConfigurationPanel sites={data.sites} />}
            {activeTab === 'reporting' && <ReportingPanel data={data} />}
            {activeTab === 'analytics' && <AnalyticsPanel />}
        </div>
    );
};

export default GuardMonitoringPage;
