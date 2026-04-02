import React, { useState } from 'react';

const ConfigurationPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'sites' | 'guards' | 'routes' | 'supervisors'>('sites');
    const [name, setName] = useState('');

    const tabs = [
        { id: 'sites', label: 'Sites' },
        { id: 'guards', label: 'Guards' },
        { id: 'routes', label: 'Routes' },
        { id: 'supervisors', label: 'Supervisors' },
    ] as const;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const endpoint = `/api/add-${activeTab.slice(0, -1)}`;
        
        // This is a simplified payload, you might need more fields depending on the table schema
        const payload = { name }; 
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            if (!response.ok) throw new Error('Failed to add');
            alert(`${activeTab.slice(0, -1)} added successfully!`);
            setName('');
        } catch (error) {
            console.error(error);
            alert('Error adding item');
        }
    };

    const renderForm = () => {
        return (
            <form onSubmit={handleSubmit} className="space-y-2">
                <input 
                    placeholder={`${activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(0, -1).slice(1)} Name`} 
                    className="w-full p-2 border rounded" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
                    Add {activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(0, -1).slice(1)}
                </button>
            </form>
        );
    };

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Configuration</h2>
            <nav className="flex space-x-2 mb-4">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setName(''); }}
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
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 capitalize">Add New {activeTab.slice(0, -1)}</h3>
                {renderForm()}
            </div>
        </div>
    );
};

export default ConfigurationPanel;
