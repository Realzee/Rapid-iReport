import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Profile, Company, UserRole, UserStatus, ResponderStatus } from '../types';
import { XIcon, UploadCloudIcon, UserIcon } from './icons';
import { useFormPersistence } from '../useFormPersistence';

interface AddEditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: Profile, password?: string, avatarFile?: File | null) => void;
    user: Profile | null;
    companies: Company[];
}

const AddEditUserModal: React.FC<AddEditUserModalProps> = ({ isOpen, onClose, onSave, user, companies }) => {
    
    const getInitialData = useCallback(() => {
        return user ? user : {
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
            work_address: '',
            ice_no: '',
            medical_aid: '',
            medical_aid_policy_number: '',
            allergies: '',
            insurance_company: '',
            insurance_policy_number: '',
            insurance_type: '',
            insurance_contact: '',
            vehicles: [],
            psira_number: '',
        };
    }, [user]);

    const [initialData, setInitialData] = useState<Partial<Profile>>(getInitialData);
    const [formData, setFormData] = useState<Partial<Profile>>(initialData);
    const [password, setPassword] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);


    useEffect(() => {
        if (isOpen) {
            const data = getInitialData();
            setInitialData(data);
            setFormData(data);
            setAvatarPreview(user?.avatar_url || null);
            setPassword('');
            setAvatarFile(null);
        }
    }, [user, isOpen, getInitialData]);

    const formId = useMemo(() => `user-form-${user?.id || 'new'}`, [user]);

    const { clearDraft, isDirty } = useFormPersistence(formId, {
        formData,
        setFormData,
        initialData,
        isEnabled: isOpen,
    });

    const isFormDirty = isDirty || password !== '' || avatarFile !== null;

    const handleClose = () => {
        if (isFormDirty) {
            if (window.confirm("You have unsaved changes. Are you sure you want to close? A draft will be saved.")) {
                onClose();
            }
        } else {
            clearDraft();
            onClose();
        }
    };


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const fieldsToUppercase = ['vehicle_reg', 'psira_number'];
        const processedValue = fieldsToUppercase.includes(name) ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: processedValue }));
    };

    const handleVehicleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updatedVehicles = [...(prev.vehicles || [])];
            updatedVehicles[index] = { ...updatedVehicles[index], [name]: value };
            return { ...prev, vehicles: updatedVehicles };
        });
    };

    const addVehicle = () => {
        setFormData(prev => ({
            ...prev,
            vehicles: [...(prev.vehicles || []), { make: '', model: '', reg: '', vin: '', engine_no: '', tracking_co: '', tracking_co_contact: '' }]
        }));
    };

    const removeVehicle = (index: number) => {
        setFormData(prev => {
            const updatedVehicles = [...(prev.vehicles || [])];
            updatedVehicles.splice(index, 1);
            return { ...prev, vehicles: updatedVehicles };
        });
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
        clearDraft();
        onSave(formData as Profile, password, avatarFile);
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 w-full bg-gray-50 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <button type="button" onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
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
                            <label 
                                htmlFor="user-avatar-upload" 
                                className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md shadow-sm hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                                onClick={(e) => e.stopPropagation()}
                            >
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
                    {(formData.role === UserRole.CONTROLLER || formData.role === UserRole.RESPONDER) && (
                        <div>
                            <label htmlFor="work_address" className={labelClasses}>Work Address</label>
                            <input type="text" name="work_address" id="work_address" value={formData.work_address || ''} onChange={handleChange} className={inputClasses} />
                        </div>
                    )}
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

                    {(formData.role === UserRole.CONTROLLER || formData.role === UserRole.RESPONDER) && (
                        <>
                            {/* Medical Details */}
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Medical Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="medical_aid_policy_number" className={labelClasses}>Policy Number</label>
                                        <input type="text" name="medical_aid_policy_number" id="medical_aid_policy_number" value={formData.medical_aid_policy_number || ''} onChange={handleChange} className={inputClasses} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label htmlFor="allergies" className={labelClasses}>Allergies</label>
                                        <textarea name="allergies" id="allergies" rows={2} value={formData.allergies || ''} onChange={handleChange} className={inputClasses} placeholder="Please stipulate any allergies" />
                                    </div>
                                </div>
                            </div>

                            {/* Insurance Details */}
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Insurance Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="insurance_company" className={labelClasses}>Company Name</label>
                                        <input type="text" name="insurance_company" id="insurance_company" value={formData.insurance_company || ''} onChange={handleChange} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label htmlFor="insurance_policy_number" className={labelClasses}>Policy Number</label>
                                        <input type="text" name="insurance_policy_number" id="insurance_policy_number" value={formData.insurance_policy_number || ''} onChange={handleChange} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label htmlFor="insurance_type" className={labelClasses}>Type Of Insurance</label>
                                        <input type="text" name="insurance_type" id="insurance_type" value={formData.insurance_type || ''} onChange={handleChange} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label htmlFor="insurance_contact" className={labelClasses}>Contact Details</label>
                                        <input type="text" name="insurance_contact" id="insurance_contact" value={formData.insurance_contact || ''} onChange={handleChange} className={inputClasses} />
                                    </div>
                                </div>
                            </div>

                            {/* Vehicle Details */}
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Vehicle Details</h4>
                                    <button type="button" onClick={addVehicle} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors">
                                        + Add Vehicle
                                    </button>
                                </div>
                                {formData.vehicles?.map((vehicle, index) => (
                                    <div key={index} className="p-4 mb-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 relative">
                                        <button type="button" onClick={() => removeVehicle(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 dark:hover:text-red-400">
                                            <XIcon className="w-5 h-5" />
                                        </button>
                                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Vehicle {index + 1}</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelClasses}>Make</label>
                                                <input type="text" name="make" value={vehicle.make} onChange={(e) => handleVehicleChange(index, e)} className={inputClasses} />
                                            </div>
                                            <div>
                                                <label className={labelClasses}>Model</label>
                                                <input type="text" name="model" value={vehicle.model} onChange={(e) => handleVehicleChange(index, e)} className={inputClasses} />
                                            </div>
                                            <div>
                                                <label className={labelClasses}>Reg</label>
                                                <input type="text" name="reg" value={vehicle.reg} onChange={(e) => handleVehicleChange(index, e)} className={inputClasses} />
                                            </div>
                                            <div>
                                                <label className={labelClasses}>Chassis No (Vin)</label>
                                                <input type="text" name="vin" value={vehicle.vin} onChange={(e) => handleVehicleChange(index, e)} className={inputClasses} />
                                            </div>
                                            <div>
                                                <label className={labelClasses}>Engine No</label>
                                                <input type="text" name="engine_no" value={vehicle.engine_no} onChange={(e) => handleVehicleChange(index, e)} className={inputClasses} />
                                            </div>
                                            <div>
                                                <label className={labelClasses}>Tracking Co</label>
                                                <input type="text" name="tracking_co" value={vehicle.tracking_co} onChange={(e) => handleVehicleChange(index, e)} className={inputClasses} />
                                            </div>
                                            <div>
                                                <label className={labelClasses}>Tracking Co Contact</label>
                                                <input type="text" name="tracking_co_contact" value={vehicle.tracking_co_contact} onChange={(e) => handleVehicleChange(index, e)} className={inputClasses} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                    <div className="pt-6 flex justify-end space-x-4">
                        <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-md hover:scale-105 transition-transform duration-300">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddEditUserModal;