import React, { useState, useEffect } from 'react';
import ImagePicker from './ImagePicker';
import { Edit, Trash2, Plus, X } from 'lucide-react';

interface ConfigurationPanelProps {
    sites: any[];
    profile: any;
}

const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ sites, profile }) => {
    const [activeTab, setActiveTab] = useState<'sites' | 'guards' | 'routes' | 'supervisors' | 'checkpoints'>('sites');
    const [formData, setFormData] = useState<any>({});
    const [items, setItems] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const tabs = [
        { 
            id: 'sites', 
            label: 'Sites', 
            fields: [
                { name: 'name', label: 'Site Name', type: 'text' },
                { name: 'contact_person', label: 'Contact Person', type: 'text' },
                { name: 'contact_number', label: 'Contact Number', type: 'text' },
                { name: 'logo_url', label: 'Site Logo', type: 'image' }
            ] 
        },
        { 
            id: 'guards', 
            label: 'Guards', 
            fields: [
                { name: 'name', label: 'Guard Name', type: 'text' },
                { name: 'profile_id', label: 'Link to Account', type: 'select', options: users.map(u => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''} (${u.email})` })) },
                { name: 'profile_pic_url', label: 'Profile Pic', type: 'image' },
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
                { name: 'coordinates', label: 'Coordinates (JSON array)', type: 'text' },
                { name: 'site_id', label: 'Site', type: 'select', options: sites.map(s => ({ value: s.id, label: s.name })) }
            ] 
        },
        { 
            id: 'supervisors', 
            label: 'Supervisors', 
            fields: [
                { name: 'name', label: 'Supervisor Name', type: 'text' },
                { name: 'profile_id', label: 'Link to Account', type: 'select', options: users.map(u => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''} (${u.email})` })) },
                { name: 'profile_pic_url', label: 'Profile Pic', type: 'image' },
                { name: 'contact_number', label: 'Contact Number', type: 'text' },
                { name: 'site_id', label: 'Site', type: 'select', options: sites.map(s => ({ value: s.id, label: s.name })) }
            ] 
        },
        { 
            id: 'checkpoints', 
            label: 'Checkpoints', 
            fields: [
                { name: 'name', label: 'Checkpoint Name', type: 'text' },
                { name: 'qr_code', label: 'QR Code/ID', type: 'text' },
                { name: 'site_id', label: 'Site', type: 'select', options: sites.map(s => ({ value: s.id, label: s.name })) }
            ] 
        },
    ] as const;

    useEffect(() => {
        fetchItems();
        fetchUsers();
    }, [activeTab]);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/profiles');
            if (res.ok) {
                const data = await res.json();
                // Filter by company if needed
                const filtered = profile.role === 'admin' ? data : data.filter((u: any) => u.company_id === profile.company_id);
                setUsers(filtered);
            }
        } catch (e) {
            console.error('Fetch users error:', e);
        }
    };

    const fetchItems = async () => {
        setLoading(true);
        setItems([]); // Clear items before fetching new ones
        try {
            const url = profile?.company_id 
                ? `/api/guard-monitoring?table=${activeTab}&company_id=${profile.company_id}`
                : `/api/guard-monitoring?table=${activeTab}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setItems(data);
            }
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item: any) => {
        setFormData({ ...item, coordinates: item.coordinates ? JSON.stringify(item.coordinates) : undefined });
        setEditingId(item.id);
        setIsEditing(true);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this item?')) return;
        
        try {
            const action = `delete-${activeTab.slice(0, -1)}`;
            const res = await fetch('/api/guard-monitoring', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, id })
            });

            if (res.ok) {
                fetchItems();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (e) {
            alert('Deletion failed');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const action = isEditing ? `update-${activeTab.slice(0, -1)}` : `add-${activeTab.slice(0, -1)}`;
        
        let payload = { ...formData };
        if (isEditing) payload.id = editingId;
        
        if (profile?.company_id) {
            payload.company_id = profile.company_id;
        }
        
        if (payload.coordinates && typeof payload.coordinates === 'string') {
            try {
                payload.coordinates = JSON.parse(payload.coordinates);
            } catch (e) {
                alert('Invalid coordinates JSON');
                return;
            }
        }
        
        const finalPayload = { action, ...payload }; 
        
        try {
            const response = await fetch('/api/guard-monitoring', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalPayload),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Operation failed');
            }
            setFormData({});
            setIsEditing(false);
            setEditingId(null);
            setShowForm(false);
            fetchItems();
        } catch (error: any) {
            console.error(error);
            alert(`Error: ${error.message}`);
        }
    };

    const currentTab = tabs.find(t => t.id === activeTab);

    const filteredItems = items.filter(item => 
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.contact_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Configuration</h2>
                {!showForm && (
                    <button 
                        onClick={() => { setShowForm(true); setIsEditing(false); setFormData({}); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md"
                    >
                        <Plus size={18} />
                        Add {activeTab.slice(0, -1)}
                    </button>
                )}
            </div>

            <nav className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex space-x-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => { setActiveTab(tab.id); setFormData({}); setShowForm(false); setIsEditing(false); setSearchTerm(''); }}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                                activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                {!showForm && (
                    <div className="relative w-full md:w-64">
                        <input 
                            type="text"
                            placeholder={`Search ${activeTab}...`}
                            className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}
            </nav>

            {showForm ? (
                <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white capitalize">
                            {isEditing ? 'Edit' : 'Add New'} {activeTab.slice(0, -1)}
                        </h3>
                        <button 
                            onClick={() => { setShowForm(false); setIsEditing(false); setFormData({}); }}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {currentTab?.fields.map(field => (
                            <div key={field.name} className={field.type === 'image' ? 'md:col-span-2' : ''}>
                                {field.type === 'image' ? (
                                    <ImagePicker 
                                        label={field.label}
                                        value={formData[field.name]}
                                        onChange={(val) => setFormData({ ...formData, [field.name]: val })}
                                    />
                                ) : field.type === 'select' ? (
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</label>
                                        <select
                                            className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData[field.name] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const selectedUser = users.find(u => u.id === val);
                                                const newFormData = { ...formData, [field.name]: val };
                                                if (field.name === 'profile_id' && selectedUser && !formData.name) {
                                                    newFormData.name = `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim();
                                                }
                                                setFormData(newFormData);
                                            }}
                                            required
                                        >
                                            <option value="">Select {field.label}</option>
                                            {field.options?.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</label>
                                        <input 
                                            type={field.type}
                                            placeholder={field.label}
                                            className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={formData[field.name] || ''}
                                            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                                            required={field.name === 'name'}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                        <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                            <button 
                                type="button"
                                onClick={() => { setShowForm(false); setIsEditing(false); setFormData({}); }}
                                className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition font-medium"
                            >
                                Cancel
                            </button>
                            <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md font-medium">
                                {isEditing ? 'Save Changes' : `Add ${activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(0, -1).slice(1)}`}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">Name</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">Details</th>
                                    <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr><td colSpan={3} className="px-6 py-10 text-center text-gray-500 italic">Loading items...</td></tr>
                                ) : filteredItems.length === 0 ? (
                                    <tr><td colSpan={3} className="px-6 py-10 text-center text-gray-500 italic">{searchTerm ? 'No matches found.' : `No ${activeTab} found.`} Click "Add" to create one.</td></tr>
                                ) : filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                                            {item.id && <div className="text-xs text-gray-400 font-mono mt-0.5">{item.id.slice(0, 8)}...</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                {item.contact_number && <div>Ph: {item.contact_number}</div>}
                                                {item.qr_code && <div>QR: {item.qr_code}</div>}
                                                {item.psira_number && <div>PSIRA: {item.psira_number}</div>}
                                                {item.profile_id && (
                                                    <div className="text-xs text-blue-500 mt-1">
                                                        Linked: {users.find(u => u.id === item.profile_id)?.email || 'User Account'}
                                                    </div>
                                                )}
                                                {item.site_id && (
                                                    <div className="text-xs mt-1 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded inline-block">
                                                        Site: {sites.find(s => s.id === item.site_id)?.name || 'Assigned'}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleEdit(item)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                                                    title="Edit"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConfigurationPanel;
