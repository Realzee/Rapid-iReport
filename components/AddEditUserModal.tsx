import React, { useState, useEffect } from 'react';
import { Profile, Company, UserRole, UserStatus } from '../types';
import { XIcon } from './icons';

interface AddEditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: Profile, password?: string) => void;
    user: Profile | null;
    companies: Company[];
}

const AddEditUserModal: React.FC<AddEditUserModalProps> = ({ isOpen, onClose, onSave, user, companies }) => {
    const [formData, setFormData] = useState<Partial<Profile>>({});
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (user) {
            setFormData(user);
        } else {
            setFormData({
                full_name: '',
                email: '',
                role: UserRole.USER,
                status: UserStatus.PENDING,
                company_id: undefined,
            });
        }
        setPassword('');
    }, [user, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as Profile, password);
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 w-full bg-gray-50 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                <h3 id="modal-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{user ? 'Edit User' : 'Add New User'}</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="full_name" className={labelClasses}>Full Name</label>
                        <input type="text" name="full_name" id="full_name" value={formData.full_name || ''} onChange={handleChange} required className={inputClasses}/>
                    </div>
                    <div>
                        <label htmlFor="email" className={labelClasses}>Email</label>
                        <input type="email" name="email" id="email" value={formData.email || ''} onChange={handleChange} required disabled={!!user} className={`${inputClasses} disabled:opacity-50`}/>
                    </div>
                     <div>
                        <label htmlFor="password_add" className={labelClasses}>New Password</label>
                        <input 
                            type="password" 
                            name="password" 
                            id="password_add" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required={!user} 
                            minLength={6} 
                            className={inputClasses}
                            placeholder={user ? "Leave blank to keep current password" : "••••••••"}
                        />
                    </div>
                    <div>
                        <label htmlFor="role" className={labelClasses}>Role</label>
                        <select name="role" id="role" value={formData.role || ''} onChange={handleChange} className={inputClasses}>
                            {Object.values(UserRole).map(role => <option key={role} value={role} className="capitalize">{role}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="status" className={labelClasses}>Status</label>
                        <select name="status" id="status" value={formData.status || ''} onChange={handleChange} className={inputClasses}>
                            {Object.values(UserStatus).map(status => <option key={status} value={status} className="capitalize">{status}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="company_id" className={labelClasses}>Company</label>
                        <select name="company_id" id="company_id" value={formData.company_id || ''} onChange={handleChange} className={inputClasses}>
                            <option value="">None</option>
                            {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                        </select>
                    </div>
                    <div className="pt-6 flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-md hover:scale-105 transition-transform duration-300">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddEditUserModal;