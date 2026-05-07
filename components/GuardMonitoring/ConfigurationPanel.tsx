import React, { useState, useEffect } from 'react';
import ImagePicker from './ImagePicker';
import { supabase } from '../../utils/supabase';
import { Edit, Trash2, Plus, X, Settings, AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    type?: 'info' | 'error' | 'confirm' | 'success';
    onConfirm?: () => void;
    confirmLabel?: string;
    loading?: boolean;
}

const UIModal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, type = 'info', onConfirm, confirmLabel = 'Confirm', loading }) => {
    if (!isOpen) return null;

    const iconMap = {
        info: <Info className="text-blue-500" size={24} />,
        error: <AlertCircle className="text-red-500" size={24} />,
        confirm: <AlertCircle className="text-amber-500" size={24} />,
        success: <CheckCircle2 className="text-green-500" size={24} />
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        {iconMap[type]}
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                    </div>
                    <div className="text-gray-600 dark:text-gray-300 mb-6">
                        {children}
                    </div>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition font-medium"
                        >
                            {type === 'confirm' ? 'Cancel' : 'Close'}
                        </button>
                        {onConfirm && (
                            <button 
                                onClick={onConfirm}
                                disabled={loading}
                                className={`px-6 py-2 rounded-lg text-white font-medium shadow-md transition ${
                                    type === 'error' ? 'bg-red-600 hover:bg-red-700' : 
                                    type === 'confirm' ? 'bg-amber-600 hover:bg-amber-700' : 
                                    'bg-blue-600 hover:bg-blue-700'
                                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {loading ? 'Processing...' : confirmLabel}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ConfigurationPanelProps {
    sites: any[];
    profile: any;
}

const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ sites, profile }) => {
    const [activeTab, setActiveTab] = useState<'sites' | 'guards' | 'routes' | 'supervisors' | 'checkpoints'>('sites');
    const [formData, setFormData] = useState<any>({});
    const [items, setItems] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [repairing, setRepairing] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal states
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        type: 'info' | 'error' | 'confirm' | 'success';
        onConfirm?: () => void;
        confirmLabel?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (title: string, message: string, type: 'info' | 'error' | 'success' = 'info') => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            type,
            confirmLabel: 'OK',
            onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
        });
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            type: 'confirm',
            confirmLabel: 'Yes, Delete',
            onConfirm: () => {
                onConfirm();
                setModalConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

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
                { name: 'email', label: 'Login Email', type: 'email' },
                { name: 'password', label: 'Login Password', type: 'text' },
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
                { name: 'email', label: 'Login Email', type: 'email' },
                { name: 'password', label: 'Login Password', type: 'text' },
                { name: 'profile_pic_url', label: 'Profile Pic', type: 'image' },
                { name: 'contact_number', label: 'Contact Number', type: 'text' },
                { name: 'site_ids', label: 'Managed Sites', type: 'multi-select', options: sites.map(s => ({ value: s.id, label: s.name })) }
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
        fetchCompanies();
    }, [activeTab]);

    const fetchCompanies = async () => {
        try {
            const { data, error } = await supabase.from('companies').select('id, name');
            if (data && !error) {
                setCompanies(data);
            }
        } catch (e) {
            console.error('Fetch companies error:', e);
        }
    };

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
            const url = (profile?.company_id && profile?.role !== 'admin') 
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

    const handleRepair = async () => {
        setRepairing(true);
        try {
            const res = await fetch('/api/guard-monitoring', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'fix-schema' })
            });
            if (res.ok) {
                showAlert('Success', 'Database schema updated successfully.', 'success');
                fetchItems();
            } else {
                const err = await res.json();
                showAlert('Repair Failed', err.error || 'Unknown error', 'error');
            }
        } catch (e) {
            showAlert('Error', 'An error occurred during repair.', 'error');
        } finally {
            setRepairing(false);
        }
    };

    const handleEdit = (item: any) => {
        setFormData({ 
            ...item, 
            coordinates: item.coordinates ? JSON.stringify(item.coordinates) : undefined,
            site_ids: item.site_ids || (item.site_id ? [item.site_id] : [])
        });
        setEditingId(item.id);
        setIsEditing(true);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        showConfirm(
            'Confirm Delete', 
            'Are you sure you want to delete this item? This action cannot be undone.',
            async () => {
                try {
                    const action = `delete-${activeTab.slice(0, -1)}`;
                    const res = await fetch('/api/guard-monitoring', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action, id })
                    });

                    if (res.ok) {
                        fetchItems();
                        showAlert('Deleted', 'Item removed successfully.', 'success');
                    } else {
                        const err = await res.json();
                        showAlert('Error', err.error || 'Deletion failed', 'error');
                    }
                } catch (e) {
                    showAlert('Error', 'Connection failed', 'error');
                }
            }
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const currentTabConfig = tabs.find(t => t.id === activeTab);
        const action = isEditing ? `update-${activeTab.slice(0, -1)}` : `add-${activeTab.slice(0, -1)}`;
        
        let payload: any = {};
        if (currentTabConfig) {
            currentTabConfig.fields.forEach(field => {
                if (formData[field.name] !== undefined) {
                    payload[field.name] = formData[field.name];
                }
            });
        }
        
        if (isEditing) payload.id = editingId;
        
        if (profile?.company_id) {
            payload.company_id = profile.company_id;
        }
        
        if (payload.coordinates && typeof payload.coordinates === 'string') {
            try {
                payload.coordinates = JSON.parse(payload.coordinates);
            } catch (e) {
                showAlert('Error', 'Invalid coordinates JSON format', 'error');
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
            showAlert('Success', `${activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(0, -1).slice(1)} saved successfully!`, 'success');
        } catch (error: any) {
            console.error(error);
            showAlert('Error', error.message, 'error');
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
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Configuration</h2>
                    {profile.role === 'admin' && (
                        <button 
                            onClick={handleRepair}
                            disabled={repairing}
                            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border ${
                                repairing 
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition'
                            }`}
                            title="Fix missing database columns"
                        >
                            <Settings size={14} className={repairing ? 'animate-spin' : ''} />
                            {repairing ? 'Repairing...' : 'Repair DB'}
                        </button>
                    )}
                </div>
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
                                ) : field.type === 'select' || field.type === 'multi-select' ? (
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</label>
                                        {field.type === 'multi-select' ? (
                                            <div className="p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg max-h-40 overflow-y-auto space-y-2">
                                                {field.options?.map(opt => (
                                                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded transition">
                                                        <input 
                                                            type="checkbox"
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            checked={formData[field.name]?.includes(opt.value)}
                                                            onChange={(e) => {
                                                                const current = formData[field.name] || [];
                                                                const next = e.target.checked 
                                                                    ? [...current, opt.value]
                                                                    : current.filter((v: any) => v !== opt.value);
                                                                setFormData({ ...formData, [field.name]: next });
                                                            }}
                                                        />
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                                                    </label>
                                                ))}
                                                {(!field.options || field.options.length === 0) && (
                                                    <div className="text-xs text-gray-500 italic">No options available</div>
                                                )}
                                            </div>
                                        ) : (
                                            <select
                                                className="w-full p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={formData[field.name] || ''}
                                                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                                                required={field.name === 'site_id' || field.name === 'profile_id'}
                                            >
                                                <option value="">Select {field.label}</option>
                                                {field.options?.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        )}
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
                                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                {item.contact_number && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 w-12">Phone:</span>
                                                        <span className="text-gray-900 dark:text-gray-200">{item.contact_number}</span>
                                                    </div>
                                                )}
                                                {item.qr_code && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 w-12">QR:</span>
                                                        <span className="font-mono text-xs">{item.qr_code}</span>
                                                    </div>
                                                )}
                                                {item.psira_number && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 w-12">PSIRA:</span>
                                                        <span className="text-gray-900 dark:text-gray-200">{item.psira_number}</span>
                                                    </div>
                                                )}
                                                {item.profile_id && (
                                                    <div className="flex items-center gap-1.5 text-blue-500">
                                                        <span className="text-[10px] uppercase font-bold opacity-70 w-12">Email:</span>
                                                        <span className="text-xs truncate max-w-[120px]">{users.find(u => u.id === item.profile_id)?.email || 'Account Linked'}</span>
                                                    </div>
                                                )}
                                                {item.company_id && (
                                                    <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                                                        <span className="text-[10px] uppercase font-bold opacity-70 w-12">Company:</span>
                                                        <span className="text-xs truncate max-w-[120px]">{companies.find(c => c.id === item.company_id)?.name || 'Unknown Company'}</span>
                                                    </div>
                                                )}
                                                {(item.site_id || (item.site_ids && item.site_ids.length > 0)) && (
                                                    <div className="flex items-start gap-1.5 pt-1">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 w-12 mt-1">Sites:</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {(item.site_ids && item.site_ids.length > 0) ? (
                                                                item.site_ids.map((sid: string) => (
                                                                    <span key={sid} className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                                                                        {sites.find(s => s.id === sid)?.name || sid.slice(0, 5)}
                                                                    </span>
                                                                ))
                                                            ) : item.site_id ? (
                                                                <span className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                                                                    {sites.find(s => s.id === item.site_id)?.name || 'Assigned'}
                                                                </span>
                                                            ) : null}
                                                        </div>
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

            <UIModal 
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                title={modalConfig.title}
                type={modalConfig.type}
                confirmLabel={modalConfig.confirmLabel}
                onConfirm={modalConfig.onConfirm}
            >
                {modalConfig.message}
            </UIModal>
        </div>
    );
};

export default ConfigurationPanel;
