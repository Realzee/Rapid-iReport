import React, { useState } from 'react';

interface ConfigurationPanelProps {
    sites: any[];
}

const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ sites }) => {
    const [activeTab, setActiveTab] = useState<'sites' | 'guards' | 'routes' | 'supervisors'>('sites');
    const [formData, setFormData] = useState<any>({});

    const tabs = [
        { 
            id: 'sites', 
            label: 'Sites', 
            fields: [
                { name: 'name', label: 'Site Name', type: 'text' },
                { name: 'address', label: 'Address', type: 'text' },
                { name: 'contact_person', label: 'Contact Person', type: 'text' },
                { name: 'contact_number', label: 'Contact Number', type: 'text' },
                { name: 'logo_url', label: 'Site Logo URL', type: 'text' }
            ] 
        },
        { 
            id: 'guards', 
            label: 'Guards', 
            fields: [
                { name: 'name', label: 'Guard Name', type: 'text' },
                { name: 'profile_pic_url', label: 'Profile Pic URL', type: 'text' },
                { name: 'contact_number', label: 'Contact Number', type: 'text' },
                { name: 'psira_number', label: 'PSIRA Number', type: 'text' },
                { name: 'psira_expiry_date', label: 'PSIRA Expiry Date', type: 'date' },
                { name: 'next_of_kin_contact', label: 'Next of Kin Contact Number', type: 'text' },
                { name: 'site_id', label: 'Assign to Site', type: 'select', options: sites.map(s => ({ value: s.id, label: s.name })) }
            ] 
        },
        { 
            id: 'routes', 
            label: 'Routes', 
            fields: [
                { name: 'name', label: 'Route Name', type: 'text' },
                { name: 'coordinates', label: 'Coordinates (JSON array of {lat, lng})', type: 'text' },
                { name: 'site_id', label: 'Site', type: 'select', options: sites.map(s => ({ value: s.id, label: s.name })) }
            ] 
        },
        { 
            id: 'supervisors', 
            label: 'Supervisors', 
            fields: [
                { name: 'name', label: 'Supervisor Name', type: 'text' },
                { name: 'profile_pic_url', label: 'Profile Pic URL', type: 'text' },
                { name: 'contact_number', label: 'Contact Number', type: 'text' },
                { name: 'site_id', label: 'Site', type: 'select', options: sites.map(s => ({ value: s.id, label: s.name })) }
            ] 
        },
    ] as const;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const action = `add-${activeTab.slice(0, -1)}`;
        
        let payload = { ...formData };
        if (payload.coordinates) {
            try {
                payload.coordinates = JSON.parse(payload.coordinates);
            } catch (e) {
                alert('Invalid coordinates JSON');
                return;
            }
        }
        
        const finalPayload = { action, ...payload }; 
        console.log('Sending payload:', finalPayload);
        
        try {
            const response = await fetch('/api/guard-monitoring', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalPayload),
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
                    <div key={field.name}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</label>
                        {field.type === 'select' ? (
                            <select
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={formData[field.name] || ''}
                                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                                required
                            >
                                <option value="">Select Option</option>
                                {field.options?.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        ) : (
                            <input 
                                type={field.type}
                                placeholder={field.label}
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                value={formData[field.name] || ''}
                                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                                required
                            />
                        )}
                    </div>
                ))}
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition shadow-md">
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
