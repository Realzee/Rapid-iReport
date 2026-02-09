import React, { useState, useEffect } from 'react';
import { Profile, Company, UserRole, UserStatus, ResponderStatus } from '../types';
import { XIcon, UploadCloudIcon, UserIcon } from './icons';

interface AddEditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: Profile, password?: string, avatarFile?: File | null) => void;
    user: Profile | null;
    companies: Company[];
}

const AddEditUserModal: React.FC<AddEditUserModalProps> = ({ isOpen, onClose, onSave, user, companies }) => {
    const [formData, setFormData] = useState<Partial<Profile>>({});
    const [password, setPassword] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);


    useEffect(() => {
        if (user) {
            setFormData(user);
            setAvatarPreview(user.avatar_url || null);
        } else {
            setFormData({
                first_name: '',
                surname: '',
                email: '',
                role: UserRole.USER,
                status: UserStatus.PENDING,
                company_id: undefined,
                responder_status: ResponderStatus.OFF_DUTY,
                cell: '',
                vehicle_reg: '',
                home_address: '',
                ice_no: '',
                medical_aid: '',
                psira_number: '',
            });
            setAvatarPreview(null);
        }
        setPassword('');
        setAvatarFile(null);
    }, [user, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!avatarPreview) {
            alert('A profile selfie is required for all users.');
            return;
        }
        onSave(formData as Profile, password, avatarFile);
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 w-full bg-gray-50 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                <h3 id="modal-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{user ? 'Edit User' : 'Add New User'}</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelClasses}>Profile Picture / Selfie</label>
                        <div className="mt-1 flex items-center gap-4">
                            <span className="h-20 w-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center border border-gray-300 dark:border-gray-700">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Selfie preview" className="h-full w-full object-cover" />
                                ) : (
                                    <UserIcon className="h-12 w-12 text-gray-400" />
                                )}
                            </span>
                            <label htmlFor="user-avatar-upload" className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                <UploadCloudIcon className="w-5 h-5"/>
                                <span>Upload Selfie</span>
                            </label>
                            <input id="user-avatar-upload" name="avatar-upload" type="file" className="sr-only" accept="image/*" onChange={handleAvatarChange} required={!user} />
                        </div>
                        {!avatarPreview && <p className="text-xs text-red-500 dark:text-red-400 mt-1">A profile selfie is required.</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="first_name" className={labelClasses}>First Name</label>
                            <input type="text" name="first_name" id="first_name" value={formData.first_name || ''} onChange={handleChange} required className={inputClasses}/>
                        </div>
                        <div>
                            <label htmlFor="surname" className={labelClasses}>Surname</label>
                            <input type="text" name="surname" id="surname" value={formData.surname || ''} onChange={handleChange} required className={inputClasses}/>
                        </div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>
                    {formData.role === UserRole.RESPONDER && (
                        <div>
                            <label htmlFor="responder_status" className={labelClasses}>Responder Status</label>
                            <select name="responder_status" id="responder_status" value={formData.responder_status || ''} onChange={handleChange} className={inputClasses}>
                                {Object.values(ResponderStatus).map(status => <option key={status} value={status} className="capitalize">{status.replace(/_/g, ' ')}</option>)}
                            </select>
                        </div>
                    )}
                     <div>
                        <label htmlFor="company_id" className={labelClasses}>Company</label>
                        <select name="company_id" id="company_id" value={formData.company_id || ''} onChange={handleChange} className={inputClasses}>
                            <option value="">None</option>
                            {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
                        </select>
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label htmlFor="cell" className={labelClasses}>Cell Number</label>
                                <input type="tel" name="cell" id="cell" value={formData.cell || ''} onChange={handleChange} className={inputClasses} />
                            </div>
                             <div>
                                <label htmlFor="ice_no" className={labelClasses}>ICE Number</label>
                                <input type="tel" name="ice_no" id="ice_no" value={formData.ice_no || ''} onChange={handleChange} className={inputClasses} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="home_address" className={labelClasses}>Home Address</label>
                        <input type="text" name="home_address" id="home_address" value={formData.home_address || ''} onChange={handleChange} className={inputClasses} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="vehicle_reg" className={labelClasses}>Vehicle Reg (Optional)</label>
                            <input type="text" name="vehicle_reg" id="vehicle_reg" value={formData.vehicle_reg || ''} onChange={handleChange} className={inputClasses} />
                        </div>
                         <div>
                            <label htmlFor="medical_aid" className={labelClasses}>Medical Aid (Optional)</label>
                            <input type="text" name="medical_aid" id="medical_aid" value={formData.medical_aid || ''} onChange={handleChange} className={inputClasses} />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="psira_number" className={labelClasses}>PSIRA Number (Optional)</label>
                        <input type="text" name="psira_number" id="psira_number" value={formData.psira_number || ''} onChange={handleChange} className={inputClasses} />
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