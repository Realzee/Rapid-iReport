/**
 * @file ReportModal.tsx
 * @description Modal for creating and editing vehicle or crime reports.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Report, Severity, ReportStatus, LocationCoords, VehicleReport, CrimeReport } from '../types';
import { XIcon, CarIcon, CrimeIcon, UploadCloudIcon, MapPinIcon, CrosshairIcon } from './icons';
import { vehicleMakes, vehicleModelsByMake, vehicleColors } from '../data/vehicleData';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { format } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportToEdit: Report | null;
}

type ReportType = 'vehicle' | 'crime';

const isVehicleReport = (report: Report | null): report is VehicleReport => report !== null && 'license_plate' in report;

const geocodeLocation = async (location: string): Promise<{coords: LocationCoords | null, boundary: any | null, boundingbox: [number, number, number, number] | null}> => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&polygon_geojson=1&limit=1`);
        if (!response.ok) return { coords: null, boundary: null, boundingbox: null };

        const data = await response.json();
        if (data && data.length > 0) {
            const result = data[0];
            
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);
            const coords = !isNaN(lat) && !isNaN(lon) ? { lat, lng: lon } : null;

            let boundingbox: [number, number, number, number] | null = null;
            if (result.boundingbox && Array.isArray(result.boundingbox) && result.boundingbox.length === 4) {
                const [s, n, w, e] = result.boundingbox.map(parseFloat);
                if (![s, n, w, e].some(isNaN)) {
                    boundingbox = [s, n, w, e];
                }
            }

            // Only store boundary for non-point results (e.g., cities, not specific addresses)
            const boundary = result.geojson && result.geojson.type !== 'Point' ? result.geojson : null;
            
            // If we get a boundary, calculate a center point for the main marker
            if (boundary && boundingbox) {
                const centerLat = (boundingbox[0] + boundingbox[1]) / 2;
                const centerLng = (boundingbox[2] + boundingbox[3]) / 2;
                const finalCoords = !isNaN(centerLat) && !isNaN(centerLng) ? { lat: centerLat, lng: centerLng } : coords;
                return { coords: finalCoords, boundary, boundingbox };
            }

            return { coords, boundary: null, boundingbox };
        }
    } catch (error) {
        console.error("Geocoding failed:", error);
    }
    return { coords: null, boundary: null, boundingbox: null };
}

const reverseGeocode = async (coords: LocationCoords): Promise<string> => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`);
        if (!response.ok) return "Unknown location";
        
        const data = await response.json();
        return data.display_name || "Unknown location";
    } catch (error) {
        console.error("Reverse geocoding failed:", error);
        return "Could not fetch location name";
    }
}

// --- Location Picker Component ---
const markerIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
});

const MapClickHandler: React.FC<{ onLocationChange: (coords: LocationCoords, address: string) => void }> = ({ onLocationChange }) => {
    useMapEvents({
        click(e) {
            const newPos = e.latlng;
            reverseGeocode({ lat: newPos.lat, lng: newPos.lng }).then(address => {
                onLocationChange({ lat: newPos.lat, lng: newPos.lng }, address);
            });
        },
    });
    return null;
}

const MapViewUpdater: React.FC<{ coords?: LocationCoords | null }> = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords) {
            map.flyTo([coords.lat, coords.lng], 16);
        }
    }, [coords, map]);
    return null;
}

const LocationPicker: React.FC<{
    initialCoords?: LocationCoords | null;
    onLocationChange: (coords: LocationCoords, address: string) => void;
}> = ({ initialCoords, onLocationChange }) => {
    const { theme } = useTheme();
    const { addToast } = useToast();
    const [isLocating, setIsLocating] = useState(false);
    const lightMapUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    const darkMapUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    const tileUrl = theme === 'dark' ? darkMapUrl : lightMapUrl;

    const handleGetCurrentLocation = () => {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const coords = { lat: latitude, lng: longitude };
                const address = await reverseGeocode(coords);
                onLocationChange(coords, address);
                setIsLocating(false);
            },
            (error) => {
                let errorMessage = "Could not get your location.";
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Location permission denied. Please enable it in your browser settings.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Location information is unavailable.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "The request to get user location timed out.";
                        break;
                }
                addToast(errorMessage, 'error');
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };
    
    return (
        <div className="relative h-64 w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
            <MapContainer center={initialCoords ? [initialCoords.lat, initialCoords.lng] : [-1.286389, 36.817223]} zoom={initialCoords ? 16 : 13} style={{ height: '100%', width: '100%' }}>
                <TileLayer key={theme} url={tileUrl} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' />
                <MapClickHandler onLocationChange={onLocationChange} />
                {initialCoords && <Marker position={[initialCoords.lat, initialCoords.lng]} icon={markerIcon} />}
                <MapViewUpdater coords={initialCoords} />
            </MapContainer>
            
            <button 
                type="button" 
                onClick={handleGetCurrentLocation}
                disabled={isLocating}
                className="absolute top-2 right-2 z-[1000] p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-full shadow-lg text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Use my current location"
            >
                {isLocating ? (
                     <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <CrosshairIcon className="w-5 h-5" />
                )}
            </button>
        </div>
    );
};
// --- End Location Picker Component ---

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, reportToEdit }) => {
    const [reportType, setReportType] = useState<ReportType>('vehicle');
    const [formData, setFormData] = useState<any>({});
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [isMapVisible, setMapVisible] = useState(false);
    const { addToast } = useToast();
    
    useEffect(() => {
        if (isOpen) {
            setMapVisible(false); // Hide map on modal open/re-open
            if (reportToEdit) {
                const isVehicle = isVehicleReport(reportToEdit);
                setReportType(isVehicle ? 'vehicle' : 'crime');
                
                const location = isVehicle 
                    ? (reportToEdit as VehicleReport).last_seen_location 
                    : (reportToEdit as CrimeReport).location;

                setFormData({ ...reportToEdit, location });
                setImagePreviews(reportToEdit.evidence_images || []);
                setImageFiles([]);
            } else {
                setReportType('vehicle');
                setFormData({ severity: Severity.MEDIUM });
                setImagePreviews([]);
                setImageFiles([]);
            }
        }
    }, [isOpen, reportToEdit]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            setImageFiles(prev => [...prev, ...selectedFiles]);
            const newPreviews = selectedFiles.map(file => URL.createObjectURL(file as Blob));
            setImagePreviews(prev => [...prev, ...newPreviews]);
        }
    };

    const removeImage = (index: number) => {
        const previewToRemove = imagePreviews[index];
        if (previewToRemove.startsWith('blob:')) {
            const fileIndex = imageFiles.findIndex(file => URL.createObjectURL(file) === previewToRemove);
            if (fileIndex > -1) {
                setImageFiles(files => files.filter((_, i) => i !== fileIndex));
            }
        }
        setImagePreviews(previews => previews.filter((_, i) => i !== index));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLocationChange = (coords: LocationCoords, address: string) => {
        setFormData(prev => ({
            ...prev,
            location: address,
            location_coords: coords,
            location_boundary: null,
            location_boundingbox: null,
        }));
    };

    const currentVehicleModels = useMemo(() => {
        const make = formData.vehicle_make?.toLowerCase();
        return vehicleModelsByMake[make] || [];
    }, [formData.vehicle_make]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // FIX: Changed `user()` (v1) to `getUser()` (v2) to fix function non-existence error.
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            const newImageUrls: string[] = [];
            const reportId = reportToEdit?.id || crypto.randomUUID();

            for (const file of imageFiles) {
                const filePath = `${reportId}/${file.name}-${crypto.randomUUID()}`;
                const { error: uploadError } = await supabase.storage.from('evidence').upload(filePath, file);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('evidence').getPublicUrl(filePath);
                newImageUrls.push(publicUrl);
            }
            
            const existingImageUrls = imagePreviews.filter(p => !p.startsWith('blob:'));
            const finalImageUrls = [...existingImageUrls, ...newImageUrls];

            let geocodedData: { coords: LocationCoords | null, boundary: any | null, boundingbox: [number, number, number, number] | null } = { 
                coords: formData.location_coords || null, 
                boundary: formData.location_boundary || null, 
                boundingbox: formData.location_boundingbox || null 
            };
            
            const locationInput = formData.location || '';
            const existingCoordsAreStale = formData.location_coords && (
                isVehicleReport(reportToEdit) ? reportToEdit.last_seen_location !== locationInput : (reportToEdit as CrimeReport)?.location !== locationInput
            );

            if (!formData.location_coords || existingCoordsAreStale) {
                geocodedData = await geocodeLocation(locationInput);
            }
            
            let reportData;
            const tableName = reportType === 'vehicle' ? 'vehicle_reports' : 'crime_reports';
            
            const commonData = {
                description: formData.description,
                severity: formData.severity,
                evidence_images: finalImageUrls,
                location_coords: geocodedData.coords,
                location_boundary: geocodedData.boundary,
                location_boundingbox: geocodedData.boundingbox
            };

            if (reportType === 'vehicle') {
                reportData = {
                    ...commonData,
                    license_plate: formData.license_plate,
                    vehicle_make: formData.vehicle_make,
                    vehicle_model: formData.vehicle_model,
                    vehicle_color: formData.vehicle_color,
                    last_seen_location: formData.location,
                };
            } else {
                 reportData = {
                    ...commonData,
                    title: formData.title,
                    crime_type: formData.crime_type,
                    location: formData.location,
                };
            }

            if (reportToEdit) {
                 const { error } = await supabase.from(tableName).update(reportData).eq('id', reportToEdit.id);
                 if (error) throw error;
            } else {
                const now = new Date();
                const ob_timestamp = format(now, 'yyMMddHHmm');
                // Add a random character to reduce collision chance within the same minute.
                const randomChar = Math.random().toString(36).substring(2, 3).toUpperCase();
                const insertData = {
                    ...reportData,
                    id: reportId,
                    ob_number: `${reportType === 'vehicle' ? 'V' : 'C'}${ob_timestamp}${randomChar}`,
                    status: ReportStatus.PENDING,
                    reported_by: user.id,
                    reported_at: now.toISOString(),
                };
                const { error } = await supabase.from(tableName).insert(insertData);
                if (error) throw error;
            }
            
            addToast(`Report ${reportToEdit ? 'updated' : 'submitted'} successfully!`, 'success');
            onClose();

        } catch (error: any) {
            let detailedMessage = error.message;
            if (detailedMessage && ((detailedMessage.includes("column") && detailedMessage.includes("does not exist")) || detailedMessage.includes("schema cache"))) {
                detailedMessage += "\n\n[DEVELOPER HINT] This error indicates a database schema mismatch. Please go to your Supabase dashboard, open the SQL Editor, and run the complete script from the DATABASE_SETUP.md file to update your database tables.";
            }
            addToast(`Error saving report: ${detailedMessage}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300";
    const inputClasses = "mt-1 w-full bg-gray-50 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-lg lg:max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                    {reportToEdit ? 'Edit Report' : 'File a New Report'}
                </h3>
                
                {!reportToEdit && (
                    <div className="mb-6">
                        <div className="flex bg-gray-100 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
                            <button onClick={() => setReportType('vehicle')} className={`w-1/2 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${reportType === 'vehicle' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}><CarIcon className="w-5 h-5" /> Vehicle</button>
                            <button onClick={() => setReportType('crime')} className={`w-1/2 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${reportType === 'crime' ? 'bg-red-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}><CrimeIcon className="w-5 h-5" /> Crime</button>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {reportType === 'vehicle' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label htmlFor="license_plate" className={labelClasses}>License Plate</label><input type="text" name="license_plate" id="license_plate" value={formData.license_plate || ''} onChange={handleChange} required className={inputClasses} /></div>
                            <div><label htmlFor="vehicle_make" className={labelClasses}>Vehicle Make</label><input type="text" name="vehicle_make" id="vehicle_make" value={formData.vehicle_make || ''} onChange={handleChange} required className={inputClasses} list="makes-list" /></div>
                            <div><label htmlFor="vehicle_model" className={labelClasses}>Vehicle Model</label><input type="text" name="vehicle_model" id="vehicle_model" value={formData.vehicle_model || ''} onChange={handleChange} required className={inputClasses} list="models-list" /></div>
                            <div><label htmlFor="vehicle_color" className={labelClasses}>Vehicle Color</label><input type="text" name="vehicle_color" id="vehicle_color" value={formData.vehicle_color || ''} onChange={handleChange} required className={inputClasses} list="colors-list" /></div>
                        </div>
                    ) : (
                         <>
                            <div><label htmlFor="title" className={labelClasses}>Incident Title</label><input type="text" name="title" id="title" value={formData.title || ''} onChange={handleChange} required className={inputClasses} /></div>
                            <div><label htmlFor="crime_type" className={labelClasses}>Type of Crime</label><input type="text" name="crime_type" id="crime_type" value={formData.crime_type || ''} onChange={handleChange} required className={inputClasses} /></div>
                        </>
                    )}

                    <div>
                        <label htmlFor="location" className={labelClasses}>{reportType === 'vehicle' ? 'Last Seen Location' : 'Location'}</label>
                        <div className="relative mt-1">
                            <input type="text" name="location" id="location" value={formData.location || ''} onChange={handleChange} required className={`${inputClasses} !mt-0 pr-10`} placeholder="Type an address or drop a pin"/>
                            <button type="button" onClick={() => setMapVisible(!isMapVisible)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors" title="Pin location on map">
                                <MapPinIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {isMapVisible && (
                        <div className="mt-2">
                             <LocationPicker
                                initialCoords={formData.location_coords}
                                onLocationChange={handleLocationChange}
                            />
                        </div>
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
                    
                    {imagePreviews.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {imagePreviews.map((src, index) => (
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
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                        <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg hover:scale-105 transition-transform duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
                            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>}
                            {loading ? 'Saving...' : 'Save Report'}
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

export default ReportModal;