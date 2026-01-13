/**
 * @file NewReportModal.tsx
 * @description Modal for creating new vehicle or crime reports.
 * 
 * --- IMPORTANT DATABASE SETUP ---
 * For this component to function correctly (especially image uploads and report creation),
 * your Supabase project MUST be configured properly. If you encounter errors like
 * "violates row-level security policy" or issues with image uploads, please
 * follow the instructions in the `DATABASE_SETUP.md` file in the project root.
 */
import React, { useState, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { Report, Severity, ReportStatus } from '../types';
import { XIcon, CarIcon, CrimeIcon, UploadCloudIcon } from './icons';
import { vehicleMakes, vehicleModelsByMake, vehicleColors } from '../data/vehicleData';

interface NewReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onReportCreated: (report: Report) => void;
}

type ReportType = 'vehicle' | 'crime';

const NewReportModal: React.FC<NewReportModalProps> = ({ isOpen, onClose, onReportCreated }) => {
    const [reportType, setReportType] = useState<ReportType>('vehicle');
    const [formData, setFormData] = useState<any>({});
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...selectedFiles]);
            const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
            setPreviews(prev => [...prev, ...newPreviews]);
        }
    };

    const removeImage = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
        setPreviews(previews.filter((_, i) => i !== index));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const currentVehicleModels = useMemo(() => {
        const make = formData.vehicle_make?.toLowerCase();
        return vehicleModelsByMake[make] || [];
    }, [formData.vehicle_make]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const reportId = crypto.randomUUID();
            const imageUrls: string[] = [];

            for (const file of files) {
                const filePath = `${reportId}/${file.name}`;
                const { error: uploadError } = await supabase.storage.from('evidence').upload(filePath, file);
                if (uploadError) throw uploadError;
                
                const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(filePath);
                imageUrls.push(publicUrl);
            }
            
            const commonData = {
                id: reportId,
                ob_number: `OB${reportType === 'vehicle' ? 'V' : 'C'}/${Date.now()}`,
                description: formData.description,
                severity: formData.severity,
                status: ReportStatus.PENDING,
                reported_by: user.id,
                reported_at: new Date().toISOString(),
                evidence_images: imageUrls,
            };

            let newReport;
            if (reportType === 'vehicle') {
                const vehicleData = {
                    ...commonData,
                    license_plate: formData.license_plate,
                    vehicle_make: formData.vehicle_make,
                    vehicle_model: formData.vehicle_model,
                    vehicle_color: formData.vehicle_color,
                    last_seen_location: formData.location,
                };
                const { data, error } = await supabase.from('vehicle_reports').insert(vehicleData).select().single();
                if (error) throw error;
                newReport = data;
            } else {
                 const crimeData = {
                    ...commonData,
                    title: formData.title,
                    crime_type: formData.crime_type,
                    location: formData.location,
                };
                const { data, error } = await supabase.from('crime_reports').insert(crimeData).select().single();
                if (error) throw error;
                newReport = data;
            }
            
            onReportCreated(newReport as Report);
            handleClose();

        } catch (error: any) {
            alert(`Error creating report: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };
    
    const handleClose = () => {
        setFormData({});
        setFiles([]);
        setPreviews([]);
        onClose();
    };

    if (!isOpen) return null;

    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    const inputClasses = "mt-1 w-full bg-gray-50 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-2xl p-8 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">File a New Report</h3>

                <div className="mb-6">
                    <div className="flex bg-gray-100 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
                        <button onClick={() => setReportType('vehicle')} className={`w-1/2 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${reportType === 'vehicle' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}><CarIcon className="w-5 h-5" /> Vehicle</button>
                        <button onClick={() => setReportType('crime')} className={`w-1/2 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${reportType === 'crime' ? 'bg-red-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}><CrimeIcon className="w-5 h-5" /> Crime</button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {reportType === 'vehicle' ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label htmlFor="license_plate" className={labelClasses}>License Plate</label><input type="text" name="license_plate" id="license_plate" value={formData.license_plate || ''} onChange={handleChange} required className={inputClasses} /></div>
                                <div><label htmlFor="vehicle_make" className={labelClasses}>Vehicle Make</label><input type="text" name="vehicle_make" id="vehicle_make" value={formData.vehicle_make || ''} onChange={handleChange} required className={inputClasses} list="makes-list" /></div>
                                <div><label htmlFor="vehicle_model" className={labelClasses}>Vehicle Model</label><input type="text" name="vehicle_model" id="vehicle_model" value={formData.vehicle_model || ''} onChange={handleChange} required className={inputClasses} list="models-list" /></div>
                                <div><label htmlFor="vehicle_color" className={labelClasses}>Vehicle Color</label><input type="text" name="vehicle_color" id="vehicle_color" value={formData.vehicle_color || ''} onChange={handleChange} required className={inputClasses} list="colors-list" /></div>
                            </div>
                             <div><label htmlFor="location_vehicle" className={labelClasses}>Last Seen Location</label><input type="text" name="location" id="location_vehicle" value={formData.location || ''} onChange={handleChange} required className={inputClasses} /></div>
                        </>
                    ) : (
                         <>
                            <div><label htmlFor="title" className={labelClasses}>Incident Title</label><input type="text" name="title" id="title" value={formData.title || ''} onChange={handleChange} required className={inputClasses} /></div>
                            <div><label htmlFor="crime_type" className={labelClasses}>Type of Crime</label><input type="text" name="crime_type" id="crime_type" value={formData.crime_type || ''} onChange={handleChange} required className={inputClasses} /></div>
                            <div><label htmlFor="location_crime" className={labelClasses}>Location</label><input type="text" name="location" id="location_crime" value={formData.location || ''} onChange={handleChange} required className={inputClasses} /></div>
                        </>
                    )}
                    
                    <div>
                        <label htmlFor="severity" className={labelClasses}>Severity</label>
                        <select name="severity" id="severity" value={formData.severity || ''} onChange={handleChange} required className={inputClasses}>
                            <option value="">Select Severity</option>
                            {Object.values(Severity).map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="description" className={labelClasses}>Description</label>
                        <textarea name="description" id="description" rows={4} value={formData.description || ''} onChange={handleChange} required className={inputClasses} />
                    </div>

                    <div>
                        <label className={labelClasses}>Evidence Images</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                <UploadCloudIcon className="mx-auto h-12 w-12 text-gray-400"/>
                                <div className="flex text-sm text-gray-600 dark:text-gray-400">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-100 dark:focus-within:ring-offset-gray-900 focus-within:ring-blue-500 px-1">
                                        <span>Upload files</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple accept="image/*" onChange={handleFileChange} />
                                    </label>
                                    <p className="pl-1">or drag and drop</p>
                                </div>
                                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                            </div>
                        </div>
                    </div>
                    
                    {previews.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {previews.map((src, index) => (
                                <div key={index} className="relative group">
                                    <img src={src} alt={`Preview ${index}`} className="h-24 w-full object-cover rounded-md" />
                                    <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}


                    <div className="pt-6 flex justify-end space-x-4">
                        <button type="button" onClick={handleClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                        <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg hover:scale-105 transition-transform duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
                            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>}
                            {loading ? 'Submitting...' : 'Submit Report'}
                        </button>
                    </div>
                </form>
                
                <datalist id="makes-list">
                    {vehicleMakes.map(make => <option key={make} value={make} />)}
                </datalist>
                <datalist id="models-list">
                    {currentVehicleModels.map(model => <option key={model} value={model} />)}
                </datalist>
                <datalist id="colors-list">
                    {vehicleColors.map(color => <option key={color} value={color} />)}
                </datalist>
            </div>
        </div>
    );
};

export default NewReportModal;