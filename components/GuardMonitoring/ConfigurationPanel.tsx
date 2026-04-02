import React from 'react';

const ConfigurationPanel: React.FC = () => (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Configuration</h2>
        <p className="text-gray-600 dark:text-gray-400">Manage sites, guards, routes, and supervisors here.</p>
    </div>
);

export default ConfigurationPanel;
