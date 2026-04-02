import React, { useState } from 'react';
import { Site, Route, Checkpoint, Supervisor } from '../../types/guard_monitoring';

const ConfigurationPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'sites' | 'guards' | 'routes' | 'supervisors'>('sites');

    const tabs = [
        { id: 'sites', label: 'Sites' },
        { id: 'guards', label: 'Guards' },
        { id: 'routes', label: 'Routes' },
        { id: 'supervisors', label: 'Supervisors' },
    ] as const;

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Configuration</h2>
            <nav className="flex space-x-2 mb-4">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                            activeTab === tab.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-gray-600 dark:text-gray-400">Manage {activeTab} here.</p>
                {/* Add forms/tables for each entity here */}
            </div>
        </div>
    );
};

export default ConfigurationPanel;
