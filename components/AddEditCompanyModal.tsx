import React, { useState, useEffect, useMemo } from 'react';
import { Company } from '../types';
import { XIcon, UploadCloudIcon, TrashIcon, BuildingIcon } from './icons';
import { useFormPersistence } from '../useFormPersistence';

interface AddEditCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (company: Partial<Company>, logoFile: File | null) => void;
    company: Company | null;
    isSaving?: boolean;
}

export const AVAILABLE_MODULES = [
    { id: 'controller', name: 'Controller Dashboard' },
    { id: 'tech_ops', name: 'Tech Ops (Technical Operations)' },
    { id: 'guard_monitoring', name: 'Guarding & Patrols' },
    { id: 'gate_access', name: 'Gate Access Control' },
    { id: 'attendance', name: 'Guard Attendance System' },
    { id: 'analytics', name: 'Analytics & Stats' },
    { id: 'archives', name: 'Archives & Historical Reports' },
];

const AddEditCompanyModal: React.FC<AddEditCompanyModalProps> = ({ isOpen, onClose, onSave, company, isSaving = false }) => {
    
    const getInitialData = () => {
        return company ? {
            id: company.id,
            name: company.name || '',
            owners_name: company.owners_name || '',
            address: company.address || '',
            contact_person: company.contact_person || '',
            cell_number: company.cell_number || '',
            psira_number: company.psira_number || '',
            allowed_modules: company.allowed_modules || AVAILABLE_MODULES.map(m => m.id),
            logo_url: company.logo_url
        } : {
            name: '',
            owners_name: '',
            address: '',
            contact_person: '',
            cell_number: '',
            psira_number: '',
            allowed_modules: AVAILABLE_MODULES.map(m => m.id)
        };
    };

    const [initialData, setInitialData] = useState<Partial<Company>>(getInitialData);
    const [formData, setFormData] = useState<Partial<Company>>(initialData);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const data = getInitialData();
            setInitialData(data);
            setFormData(data);
            setLogoPreview(company?.logo_url || null);
            setLogoFile(null);
        }
    }, [isOpen, company]);
    
    const formId = useMemo(() => `company-form-${company?.id || 'new'}`, [company]);
    
    const { clearDraft, isDirty } = useFormPersistence(formId, {
        formData,
        setFormData,
        initialData,
        isEnabled: isOpen,
    });
    
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);
    
    const isFormDirty = isDirty || logoFile !== null;

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleRemoveLogo = () => {
        setLogoFile(null);
        setLogoPreview(null);
        setFormData(prev => ({...prev, logo_url: undefined }));
    };

    const handleModuleToggle = (moduleId: string) => {
        const currentModules = formData.allowed_modules || [];
        let newModules: string[];
        if (currentModules.includes(moduleId)) {
            newModules = currentModules.filter(id => id !== moduleId);
        } else {
            newModules = [...currentModules, moduleId];
        }
        setFormData(prev => ({ ...prev, allowed_modules: newModules }));
    };

    const handleToggleAllModules = () => {
        const currentModules = formData.allowed_modules || [];
        const allIds = AVAILABLE_MODULES.map(m => m.id);
        const isAllSelected = allIds.every(id => currentModules.includes(id));
        setFormData(prev => ({
            ...prev,
            allowed_modules: isAllSelected ? [] : allIds
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSave = { ...formData, logo_url: logoPreview || undefined };
        clearDraft();
        onSave(dataToSave, logoFile);
    };

    if (!isOpen) return null;

    const inputClasses = "mt-1 w-full bg-gray-50 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm";
    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    
    const currentModules = formData.allowed_modules || [];
    const isAllModulesSelected = AVAILABLE_MODULES.every(m => currentModules.includes(m.id));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <button type="button" onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                <h3 id="modal-title" className="text-xl font-bold text-gray-900 dark:text-white mb-4">{company ? 'Edit Company' : 'Add New Company'}</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="name" className={labelClasses}>Company Name</label>
                            <input type="text" name="name" id="name" value={formData.name || ''} onChange={handleChange} required className={inputClasses}/>
                        </div>
                        <div>
                            <label htmlFor="owners_name" className={labelClasses}>Owner's Name</label>
                            <input type="text" name="owners_name" id="owners_name" value={formData.owners_name || ''} onChange={handleChange} required className={inputClasses}/>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="address" className={labelClasses}>Address</label>
                        <input type="text" name="address" id="address" value={formData.address || ''} onChange={handleChange} required className={inputClasses}/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="contact_person" className={labelClasses}>Contact Person</label>
                            <input type="text" name="contact_person" id="contact_person" value={formData.contact_person || ''} onChange={handleChange} required className={inputClasses}/>
                        </div>
                         <div>
                            <label htmlFor="cell_number" className={labelClasses}>Cell Number</label>
                            <input type="tel" name="cell_number" id="cell_number" value={formData.cell_number || ''} onChange={handleChange} required className={inputClasses}/>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="psira_number" className={labelClasses}>PSIRA Number</label>
                        <input type="text" name="psira_number" id="psira_number" value={formData.psira_number || ''} onChange={handleChange} required className={inputClasses}/>
                    </div>
                    
                    {/* Module Access Selection */}
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className={`${labelClasses} font-semibold text-gray-900 dark:text-white`}>Module Access Settings</label>
                            <button 
                                type="button" 
                                onClick={handleToggleAllModules} 
                                className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline hover:text-blue-700"
                            >
                                {isAllModulesSelected ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            Enable specific system modules for this company:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700/60 max-h-40 overflow-y-auto">
                            {AVAILABLE_MODULES.map((mod) => {
                                const isChecked = currentModules.includes(mod.id);
                                return (
                                    <label 
                                        key={mod.id} 
                                        className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition select-none ${
                                            isChecked 
                                                ? 'bg-blue-500/10 border border-blue-500/30' 
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-700/30 border border-transparent'
                                        }`}
                                    >
                                        <input 
                                            type="checkbox" 
                                            className="mt-0.5 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                            checked={isChecked}
                                            onChange={() => handleModuleToggle(mod.id)}
                                        />
                                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-tight">
                                            {mod.name}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className={labelClasses}>Company Logo</label>
                        <div className="mt-2 flex items-center gap-4">
                            <div className="h-16 w-16 flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center border border-gray-300 dark:border-gray-700">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain rounded-md" />
                               ) : (
                                    <BuildingIcon className="h-8 w-8 text-gray-400" />
                               )}
                            </div>
                            <div className="flex-grow">
                                <label htmlFor="logo-upload" className="cursor-pointer inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md shadow-sm hover:bg-blue-100 dark:hover:bg-blue-900/50 transition">
                                    <UploadCloudIcon className="w-4 h-4"/>
                                    <span>{logoFile ? 'Change logo' : 'Upload logo'}</span>
                                </label>
                                <input id="logo-upload" name="logo-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/svg+xml" onChange={handleFileChange} />
                                {logoPreview && (
                                    <button type="button" onClick={handleRemoveLogo} className="mt-1 flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400 hover:underline">
                                        <TrashIcon className="w-3 h-3" />
                                        Remove logo
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100 dark:border-gray-800">
                        <button type="button" onClick={handleClose} disabled={isSaving} className="px-4 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors disabled:opacity-50">Cancel</button>
                        <button type="submit" disabled={isSaving} className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-md hover:scale-105 transition-transform duration-300 disabled:opacity-50 flex items-center gap-2">
                            {isSaving ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <span>Save Company</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddEditCompanyModal;
