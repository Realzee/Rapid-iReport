import React, { useState, useEffect } from 'react';
import { Announcement, AnnouncementType } from '../types';
import { XIcon, UploadCloudIcon, TrashIcon } from './icons';

interface AddEditAnnouncementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (announcement: Partial<Announcement>, imageFile: File | null) => void;
    announcementToEdit: Announcement | null;
}

const AddEditAnnouncementModal: React.FC<AddEditAnnouncementModalProps> = ({ isOpen, onClose, onSave, announcementToEdit }) => {
    const [formData, setFormData] = useState<Partial<Announcement>>({});
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (announcementToEdit) {
                setFormData(announcementToEdit);
                setImagePreview(announcementToEdit.image_url || null);
            } else {
                setFormData({
                    title: '',
                    content: '',
                    type: AnnouncementType.NOTICE,
                    expires_at: undefined,
                });
                setImagePreview(null);
            }
            setImageFile(null);
        }
    }, [isOpen, announcementToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };
    
    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
        setFormData(prev => ({...prev, image_url: undefined }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData, imageFile);
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
                <h3 id="modal-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{announcementToEdit ? 'Edit Announcement' : 'Add New Announcement'}</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="title" className={labelClasses}>Title</label>
                        <input type="text" name="title" id="title" value={formData.title || ''} onChange={handleChange} required className={inputClasses}/>
                    </div>
                    <div>
                        <label htmlFor="content" className={labelClasses}>Content</label>
                        <textarea name="content" id="content" value={formData.content || ''} onChange={handleChange} required rows={3} className={inputClasses}></textarea>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="type" className={labelClasses}>Type</label>
                            <select name="type" id="type" value={formData.type || ''} onChange={handleChange} className={inputClasses}>
                                {Object.values(AnnouncementType).map(type => <option key={type} value={type} className="capitalize">{type.replace('_', ' ')}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="expires_at" className={labelClasses}>Expires At (Optional)</label>
                            <input type="datetime-local" name="expires_at" id="expires_at" 
                                value={formData.expires_at ? new Date(new Date(formData.expires_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} 
                                onChange={handleChange} className={inputClasses}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClasses}>Image (Optional)</label>
                        <div className="mt-1 flex items-center gap-4">
                            <div className="h-16 w-16 flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center border border-gray-300 dark:border-gray-700">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover rounded-md" />
                                ) : (
                                    <UploadCloudIcon className="h-8 w-8 text-gray-400" />
                                )}
                            </div>
                             <div className="flex items-center gap-2">
                                <label htmlFor="image-upload" className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                    <UploadCloudIcon className="w-5 h-5"/>
                                    <span>{imageFile || imagePreview ? 'Change' : 'Upload'}</span>
                                </label>
                                <input id="image-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handleFileChange} />
                                {imagePreview && (
                                    <button type="button" onClick={handleRemoveImage} className="p-2 text-red-600 dark:text-red-400 bg-red-500/10 rounded-md hover:bg-red-500/20" title="Remove image">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                )}
                             </div>
                        </div>
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

export default AddEditAnnouncementModal;