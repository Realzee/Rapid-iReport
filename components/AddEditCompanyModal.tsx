import React, { useState, useEffect, useRef } from 'react';
import { Company } from '../types';
import { XIcon, UploadCloudIcon, TrashIcon, BuildingIcon } from './icons';

interface AddEditCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (company: Partial<Company>, logoFile: File | null) => void;
    company: Company | null;
}

const AddEditCompanyModal: React.FC<AddEditCompanyModalProps> = ({ isOpen, onClose, onSave, company }) => {
    const [formData, setFormData] = useState<Partial<Company>>({});
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const openedWithCompanyRef = useRef<Company | null | undefined>(undefined);

    useEffect(() => {
        if (isOpen && openedWithCompanyRef.current !== company) {
            if (company) {
                setFormData(company);
                setLogoPreview(company.logo_url || null);
            } else {
                setFormData({
                    name: '',
                    owners_name: '',
                    address: '',
                    contact_person: '',
                    cell_number: '',
                    psira_number: ''
                });
                setLogoPreview(null);
            }
            setLogoFile(null);
            openedWithCompanyRef.current = company;
        } else if (!isOpen) {
            openedWithCompanyRef.current = undefined;
        }
    }, [isOpen, company]);

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
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSave = { ...formData, logo_url: logoPreview || undefined };
        onSave(dataToSave, logoFile);
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
                <h3 id="modal-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{company ? 'Edit Company' : 'Add New Company'}</h3>

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
                                <label htmlFor="logo-upload" className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                    <UploadCloudIcon className="w-5 h-5"/>
                                    <span>{logoFile ? 'Change logo' : 'Upload logo'}</span>
                                </label>
                                <input id="logo-upload" name="logo-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/svg+xml" onChange={handleFileChange} />
                                {logoPreview && (
                                    <button type="button" onClick={handleRemoveLogo} className="mt-2 flex items-center gap-2 text-xs text-red-600 dark:text-red-400 hover:underline">
                                        <TrashIcon className="w-3.5 h-3.5" />
                                        Remove logo
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-md hover:scale-105 transition-transform duration-300">Save Company</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddEditCompanyModal;