import React, { useState } from 'react';

const ConfigurationPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'sites' | 'guards' | 'routes' | 'supervisors'>('sites');

    const tabs = [
        { id: 'sites', label: 'Sites' },
        { id: 'guards', label: 'Guards' },
        { id: 'routes', label: 'Routes' },
        { id: 'supervisors', label: 'Supervisors' },
    ] as const;

    const renderForm = () => {
        switch (activeTab) {
            case 'sites': return <form className="space-y-2"><input placeholder="Site Name" className="w-full p-2 border rounded" /><button className="px-4 py-2 bg-blue-600 text-white rounded">Add Site</button></form>;
            case 'guards': return <form className="space-y-2"><input placeholder="Guard Name" className="w-full p-2 border rounded" /><button className="px-4 py-2 bg-blue-600 text-white rounded">Add Guard</button></form>;
            case 'routes': return <form className="space-y-2"><input placeholder="Route Name" className="w-full p-2 border rounded" /><button className="px-4 py-2 bg-blue-600 text-white rounded">Add Route</button></form>;
            case 'supervisors': return <form className="space-y-2"><input placeholder="Supervisor Name" className="w-full p-2 border rounded" /><button className="px-4 py-2 bg-blue-600 text-white rounded">Add Supervisor</button></form>;
        }
    };

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
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 capitalize">Add New {activeTab}</h3>
                {renderForm()}
            </div>
        </div>
    );
};

export default ConfigurationPanel;
