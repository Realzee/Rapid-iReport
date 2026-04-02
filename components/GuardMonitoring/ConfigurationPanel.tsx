import React, { useState } from 'react';

const ConfigurationPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'sites' | 'guards' | 'routes' | 'supervisors'>('sites');
    const [formData, setFormData] = useState<any>({});

    const tabs = [
        { id: 'sites', label: 'Sites', fields: ['name', 'location', 'boundary', 'company_id'] },
        { id: 'guards', label: 'Guards', fields: ['profile_id', 'site_id', 'status'] },
        { id: 'routes', label: 'Routes', fields: ['name', 'site_id'] },
        { id: 'supervisors', label: 'Supervisors', fields: ['profile_id', 'site_id'] },
    ] as const;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const action = `add-${activeTab.slice(0, -1)}`;
        
        const payload = { action, ...formData }; 
        console.log('Sending payload:', payload);
        
        try {
            const response = await fetch('/api/guard-monitoring', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add');
            }
            alert(`${activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(0, -1).slice(1)} added successfully!`);
            setFormData({});
        } catch (error: any) {
            console.error(error);
            alert(`Error adding item: ${error.message}`);
        }
    };

    const renderForm = () => {
        const currentTab = tabs.find(t => t.id === activeTab);
        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                {currentTab?.fields.map(field => (
                    <div key={field}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{field.replace('_', ' ')}</label>
                        <input 
                            placeholder={field.replace('_', ' ')}
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                            value={formData[field] || ''}
                            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                            required
                        />
                    </div>
                ))}
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
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
                        onClick={() => { setActiveTab(tab.id); setFormData({}); }}
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
