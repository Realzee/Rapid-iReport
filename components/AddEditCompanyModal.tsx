import React, { useState, useEffect } from 'react';
import { Company } from '../types';
import { XIcon } from './icons';

interface AddEditCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (company: { id?: string, name: string }) => void;
    company: Company | null;
}

const AddEditCompanyModal: React.FC<AddEditCompanyModalProps> = ({ isOpen, onClose, onSave, company }) => {
    const [name, setName] = useState('');

    useEffect(() => {
        if (company) {
            setName(company.name);
        } else {
            setName('');
        }
    }, [company, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: company?.id, name });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="relative bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                <h3 id="modal-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{company ? 'Edit Company' : 'Add New Company'}</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
                        <input type="text" name="name" id="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full bg-gray-50 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"/>
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