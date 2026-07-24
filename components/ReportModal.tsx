
/**
 * @file ReportModal.tsx
 * @description Modal for creating and editing vehicle or crime reports.
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../utils/supabase';
import { Report, Severity, ReportStatus, LocationCoords, VehicleReport, CrimeReport, EmergencyReport } from '../types';
import { XIcon, CarIcon, CrimeIcon, UploadCloudIcon, MapPinIcon, CrosshairIcon, LayersIcon, AlertTriangleIcon, CheckCircleIcon, TrashIcon } from '../components/icons';
import { vehicleMakes, vehicleModelsByMake, vehicleColors } from '../data/vehicleData';
import { sapsStations } from '../data/policeStations';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { format } from 'date-fns';
import { useToast } from '../contexts/ToastContext';
import { MapStyle } from '../components/MapStyleToggle';
import { useFormPersistence } from '../useFormPersistence';
import { logUserAction } from '../utils/logger';
import { LocationPicker, parseLocationInput, reverseGeocode } from './LocationPicker';

import { useSettings } from '../contexts/SettingsContext';
import { generateAndShareBolo } from '../utils/boloUtils';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportToEdit: Report | null;
    isQuickAdd?: boolean;
    onReportSubmitted?: () => void;
}

type ReportType = 'vehicle' | 'crime' | 'emergency';

const geocodeLocation = async (location: string): Promise<{coords: LocationCoords | null, boundary: any | null, boundingbox: [number, number, number, number] | null}> => {
    try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(location)}&limit=1`);
        if (!response.ok) return { coords: null, boundary: null, boundingbox: null };

        const data = await response.json();
        if (data && data.length > 0) {
            const result = data[0];
            
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);
            const coords = (typeof lat === 'number' && !isNaN(lat) && typeof lon === 'number' && !isNaN(lon)) ? { lat, lng: lon } : null;

            let boundingbox: [number, number, number, number] | null = null;
            if (result.boundingbox && Array.isArray(result.boundingbox) && result.boundingbox.length === 4) {
                const [s, n, w, e] = result.boundingbox.map(parseFloat);
                if (![s, n, w, e].some(val => typeof val !== 'number' || isNaN(val))) {
                    boundingbox = [s, n, w, e];
                }
            }

            // Only store boundary for non-point results (e.g., cities, not specific addresses)
            const boundary = result.geojson && result.geojson.type !== 'Point' ? result.geojson : null;
            
            // If we get a boundary, calculate a center point for the main marker
            if (boundary && boundingbox) {
                const centerLat = (boundingbox[0] + boundingbox[1]) / 2;
                const centerLng = (boundingbox[2] + boundingbox[3]) / 2;
                const finalCoords = (typeof centerLat === 'number' && !isNaN(centerLat) && typeof centerLng === 'number' && !isNaN(centerLng)) ? { lat: centerLat, lng: centerLng } : coords;
                return { coords: finalCoords, boundary, boundingbox };
            }

            return { coords, boundary: null, boundingbox };
        }
    } catch (error) {
        console.error("Geocoding failed:", error);
    }
    return { coords: null, boundary: null, boundingbox: null };
}

// --- End Location Picker Component ---

// --- MultiSelect Component ---
interface MultiSelectProps {
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    label: string;
    placeholder?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onChange, label, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        const newSelected = selected.includes(option)
            ? selected.filter(s => s !== option)
            : [...selected, option];
        onChange(newSelected);
    };

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="min-h-[42px] w-full bg-gray-50 dark:bg-gray-800/70 border border-gray-300 dark:border-gray-700 rounded-md py-1.5 px-3 flex flex-wrap gap-1.5 cursor-pointer hover:border-gray-400 transition"
            >
                {selected.length === 0 && <span className="text-gray-500 py-1">{placeholder || 'Select options...'}</span>}
                {selected.map(s => (
                    <span key={s} className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1">
                        {s}
                        <button type="button" onClick={(e) => { e.stopPropagation(); toggleOption(s); }} className="hover:text-blue-600 dark:hover:text-blue-100">
                            <XIcon className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>
            {isOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto p-2 space-y-1">
                    {options.map(option => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => toggleOption(option)}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${selected.includes(option) ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        >
                            {option}
                            {selected.includes(option) && <CheckCircleIcon className="w-4 h-4" />}
                        </button>
                    ))}
                    <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-800">
                        <input 
                            type="text" 
                            placeholder="Add custom..." 
                            className="w-full bg-gray-50 dark:bg-gray-800 border-none text-xs p-2 rounded focus:ring-0"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = (e.target as HTMLInputElement).value.trim();
                                    if (val && !selected.includes(val)) {
                                        toggleOption(val);
                                        (e.target as HTMLInputElement).value = '';
                                    }
                                }
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, reportToEdit, isQuickAdd = false, onReportSubmitted }) => {
    const [reportType, setReportType] = useState<ReportType>('vehicle');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [duplicateInfo, setDuplicateInfo] = useState<{
        type: string;
        obNumber: string;
        status?: string;
        licensePlate: string;
    } | null>(null);
    const [isMapVisible, setMapVisible] = useState(false);
    const [showRecoveryMap, setShowRecoveryMap] = useState(false);
    const [isConfirmCloseOpen, setIsConfirmCloseOpen] = useState(false);
    const [isBoloConfirmOpen, setIsBoloConfirmOpen] = useState(false);
    const [pendingBoloData, setPendingBoloData] = useState<{ report: any; profile: any } | null>(null);
    const { addToast } = useToast();
    const { mainLogoUrl } = useSettings();
    
    // Address suggestion state
    const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
    const [stationSuggestions, setStationSuggestions] = useState<string[]>([]);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const debounceTimeoutRef = useRef<number | null>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const stationSuggestionsRef = useRef<HTMLDivElement>(null);

    const getInitialData = useCallback(() => {
        if (reportToEdit) {
            const location = reportToEdit.type === 'vehicle' ? (reportToEdit as any).last_seen_location : (reportToEdit as any).location;
            return {
                date_of_incident: (reportToEdit as any).date_of_incident || ((reportToEdit as any).reported_at ? new Date((reportToEdit as any).reported_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                tracker_company: (reportToEdit as any).tracker_company || '',
                ...reportToEdit,
                location,
                vehicle_involved: (reportToEdit as any).vehicle_involved !== undefined ? String((reportToEdit as any).vehicle_involved) : 'false',
                suspect_license_plate: (reportToEdit as any).suspect_license_plate || '',
                suspect_vehicle_make: (reportToEdit as any).suspect_vehicle_make || '',
                suspect_vehicle_model: (reportToEdit as any).suspect_vehicle_model || '',
                suspect_vehicle_color: (reportToEdit as any).suspect_vehicle_color || ''
            };
        }
        return { 
            severity: isQuickAdd ? Severity.HIGH : '',
            status: isQuickAdd ? ReportStatus.SOUGHT : ReportStatus.STOLEN,
            vehicle_involved: 'false',
            vehicles_involved: '1',
            injuries_reported: 'false',
            fatalities_reported: 'false',
            crime_outcome: '',
            arrests: 0,
            guns_recovered: 0,
            has_arrests: false,
            has_firearms: false,
            other_recoveries: '',
            saps_13: '',
            pound_name: '',
            year: '',
            date_of_incident: new Date().toISOString().split('T')[0],
            tracker_company: '',
            io_name: '',
            io_contact: '',
            suspect_license_plate: '',
            suspect_vehicle_make: '',
            suspect_vehicle_model: '',
            suspect_vehicle_color: ''
        };
    }, [reportToEdit, isQuickAdd]);

    const [initialData, setInitialData] = useState(getInitialData);
    const [formData, setFormData] = useState<any>(initialData);

    useEffect(() => {
        if (isOpen) {
            const data = getInitialData();
            setInitialData(data);
            setFormData(data);

            setReportType(reportToEdit ? (reportToEdit.type as ReportType) : (isQuickAdd ? 'vehicle' : 'vehicle'));
            setMapVisible(false);
            setShowRecoveryMap(!!(data as any).recovered_location_coords);
            setImagePreviews(reportToEdit?.evidence_images || []);
            setImageFiles([]);
        }
    }, [isOpen, reportToEdit, isQuickAdd, getInitialData]);

    const formId = useMemo(() => 
        reportToEdit ? `edit-report-${reportToEdit.id}` : (isQuickAdd ? 'quick-add-report' : 'new-report'),
    [reportToEdit, isQuickAdd]);

    const { clearDraft, isDirty, disableNavigationGuard } = useFormPersistence(formId, {
        formData,
        setFormData,
        initialData,
        isEnabled: isOpen,
    });
    
    const handleClose = () => {
        if (isDirty) {
            setIsConfirmCloseOpen(true);
        } else {
            clearDraft();
            onClose();
        }
    };

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = ''; // Required for Chrome
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        if (!reportToEdit && reportType === 'vehicle') {
            const statusStr = (formData.status || 'stolen').toUpperCase().replace(/_/g, ' ');
            const dateFormatted = formData.date_of_incident ? (() => {
                const parts = formData.date_of_incident.split('-');
                return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : formData.date_of_incident;
            })() : '';
            
            const expectedDefault = dateFormatted ? `${statusStr} ON THE ${dateFormatted}` : statusStr;
            
            if (!formData.description || formData.description === '' || formData.description.endsWith(' ON THE ') || /^(STOLEN|SUSPICIOUS|BOLO|SOUGHT|HIJACKED|USED IN COMMISSION OF CRIME)( ON THE \d{2}\/\d{2}\/\d{4})?$/.test(formData.description)) {
                setFormData(prev => ({
                    ...prev,
                    description: expectedDefault
                }));
            }
        }
    }, [formData.status, formData.date_of_incident, reportType, reportToEdit]);
    
    // Address suggestion logic
    useEffect(() => {
        if (formData.location_coords || !formData.location || formData.location.length < 3) {
            setAddressSuggestions([]);
            return;
        }

        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

        debounceTimeoutRef.current = window.setTimeout(async () => {
            setIsGeocoding(true);
            try {
                const response = await fetch(`/api/geocode?q=${encodeURIComponent(formData.location)}&limit=5`);
                if (response.ok) setAddressSuggestions(await response.json());
                else setAddressSuggestions([]);
            } catch (error) {
                console.error("Address suggestion fetch failed:", error);
                setAddressSuggestions([]);
            }
            setIsGeocoding(false);
        }, 400);

        return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current) };
    }, [formData.location, formData.location_coords]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
                setAddressSuggestions([]);
            }
            if (stationSuggestionsRef.current && !stationSuggestionsRef.current.contains(event.target as Node)) {
                setStationSuggestions([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSuggestionClick = (suggestion: any) => {
        if (suggestion.is_custom) {
            setFormData(prev => ({
                ...prev,
                location: suggestion.display_name,
                location_coords: null,
                location_boundary: null,
                location_boundingbox: null,
            }));
            setAddressSuggestions([]);
            return;
        }

        const lat = parseFloat(suggestion.lat);
        const lng = parseFloat(suggestion.lon);
        let coords: LocationCoords | null = (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) ? { lat, lng } : null;

        let boundingbox: [number, number, number, number] | null = null;
        if (suggestion.boundingbox?.length === 4) {
            const [s, n, w, e] = suggestion.boundingbox.map(parseFloat);
            if (![s, n, w, e].some(val => typeof val !== 'number' || isNaN(val))) boundingbox = [s, n, w, e];
        }
        
        const boundary = suggestion.geojson?.type !== 'Point' ? suggestion.geojson : null;

        if (boundary && boundingbox) {
            const centerLat = (boundingbox[0] + boundingbox[1]) / 2;
            const centerLng = (boundingbox[2] + boundingbox[3]) / 2;
            coords = (typeof centerLat === 'number' && !isNaN(centerLat) && typeof centerLng === 'number' && !isNaN(centerLng)) ? { lat: centerLat, lng: centerLng } : coords;
        }
        
        setFormData(prev => ({
            ...prev,
            location: suggestion.display_name,
            location_coords: coords,
            location_boundary: boundary,
            location_boundingbox: boundingbox,
        }));
        setAddressSuggestions([]);
    };


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.stopPropagation();
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
        const { name, value } = e.target;

        const fieldsToUppercase = [
            'license_plate',
            'vehicle_make',
            'vehicle_model',
            'vehicle_color',
            'title',
            'crime_type',
            'saps_13',
            'pound_name',
            'cas_number',
            'circulation_number',
            'vin_number',
            'engine_number',
            'station_name',
            'io_name'
        ];

        const processedValue = fieldsToUppercase.includes(name) ? value.toUpperCase() : value;

        if (name === 'map_link') {
            const coords = parseLocationInput(value);
            if (coords) {
                setFormData({ ...formData, map_link: value, location: 'Fetching location...', location_coords: coords, location_boundary: null, location_boundingbox: null });
                reverseGeocode(coords).then(address => {
                    setFormData(prev => ({ ...prev, location: address }));
                });
            } else if (value.trim().startsWith('http://') || value.trim().startsWith('https://')) {
                setFormData({ ...formData, map_link: value, location: 'Resolving map link...', location_coords: null, location_boundary: null, location_boundingbox: null });
                fetch('/api/resolve-maps-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: value.trim() })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.coords) {
                        setFormData(prev => ({
                            ...prev,
                            location: data.address || prev.location,
                            location_coords: data.coords,
                            location_boundary: null,
                            location_boundingbox: null
                        }));
                    } else {
                        setFormData(prev => ({ ...prev, location: 'Could not extract coordinates' }));
                    }
                })
                .catch(err => {
                    console.error('Failed to resolve maps link:', err);
                    setFormData(prev => ({ ...prev, location: 'Error resolving link' }));
                });
            } else {
                setFormData({ ...formData, map_link: value });
            }
        } else if (name === 'location') {
            const coords = parseLocationInput(value);
            if (coords) {
                // If it's coordinates, we immediately update coords and reverse geocode for a better display name
                setFormData({ ...formData, location: 'Fetching location...', location_coords: coords, location_boundary: null, location_boundingbox: null });
                reverseGeocode(coords).then(address => {
                    setFormData(prev => ({ ...prev, location: address }));
                });
            } else if (value.trim().startsWith('http://') || value.trim().startsWith('https://')) {
                setFormData({ ...formData, location: 'Resolving map link...', location_coords: null, location_boundary: null, location_boundingbox: null, map_link: value });
                fetch('/api/resolve-maps-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: value.trim() })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.coords) {
                        setFormData(prev => ({
                            ...prev,
                            location: data.address || prev.location,
                            location_coords: data.coords,
                            location_boundary: null,
                            location_boundingbox: null
                        }));
                    } else {
                        setFormData(prev => ({ ...prev, location: value }));
                    }
                })
                .catch(err => {
                    console.error('Failed to resolve location maps link:', err);
                    setFormData(prev => ({ ...prev, location: value }));
                });
            } else {
                setFormData({ ...formData, location: processedValue, location_coords: null, location_boundary: null, location_boundingbox: null });
            }
        } else if (name === 'station_name') {
            setFormData({ ...formData, station_name: processedValue });
            if (processedValue.length >= 2) {
                setStationSuggestions(sapsStations.filter(s => s.toLowerCase().includes(processedValue.toLowerCase())));
            } else {
                setStationSuggestions([]);
            }
        } else {
            setFormData({ ...formData, [name]: processedValue });
        }
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

    const checkDuplicates = async () => {
        const licensePlateToCheck = formData.license_plate?.trim().toUpperCase();
        if (licensePlateToCheck && (reportType === 'vehicle' || reportType === 'emergency')) {
            const isNewPlate = !reportToEdit || (reportToEdit as any).license_plate?.trim().toUpperCase() !== licensePlateToCheck;
            
            if (isNewPlate) {
                const [{ data: vRecord }, { data: eRecord }] = await Promise.all([
                    supabase.from('vehicle_reports')
                        .select('ob_number, status')
                        .eq('license_plate', licensePlateToCheck)
                        .neq('status', ReportStatus.DELETED)
                        .limit(1)
                        .maybeSingle(),
                    supabase.from('emergency_reports')
                        .select('ob_number, emergency_type')
                        .eq('license_plate', licensePlateToCheck)
                        .limit(1)
                        .maybeSingle()
                ]);

                if (vRecord || eRecord) {
                    setDuplicateInfo({
                        type: vRecord ? 'Vehicle' : 'Emergency',
                        obNumber: vRecord?.ob_number || (eRecord as any)?.ob_number,
                        status: vRecord?.status,
                        licensePlate: licensePlateToCheck
                    });
                    return true;
                }
            }
        }
        return false;
    };

    const handleSubmit = async (e: React.FormEvent, skipDuplicateCheck = false) => {
        e.preventDefault();
        setLoading(true);
        let showWhatsAppConfirm = false;

        try {
            // @ts-ignore
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw new Error("User not authenticated");

            // Fetch profile data early for BOLO logic
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*, company:companies(*)')
                .eq('id', user.id)
                .single();

            // Check for existing license plate if not skipped
            if (!skipDuplicateCheck) {
                const hasDuplicate = await checkDuplicates();
                if (hasDuplicate) {
                    setLoading(false);
                    return;
                }
            }

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
                reportToEdit?.type === 'vehicle' ? (reportToEdit as any).last_seen_location !== locationInput : (reportToEdit as any)?.location !== locationInput
            );

            if (!formData.location_coords || existingCoordsAreStale) {
                geocodedData = await geocodeLocation(locationInput);
            }
            
            let reportData: any;
            let tableName: 'vehicle_reports' | 'crime_reports' | 'emergency_reports';
            if (reportType === 'vehicle') tableName = 'vehicle_reports';
            else if (reportType === 'emergency') tableName = 'emergency_reports';
            else tableName = 'crime_reports';
            
            const commonData = {
                description: formData.description || '',
                severity: formData.severity || 'low',
                evidence_images: finalImageUrls,
                location_coords: geocodedData.coords,
                location_boundary: geocodedData.boundary,
                location_boundingbox: geocodedData.boundingbox
            };

            if (reportType === 'vehicle') {
                reportData = {
                    ...commonData,
                    status: formData.status || (reportToEdit ? reportToEdit.status : ReportStatus.STOLEN),
                    license_plate: formData.license_plate || 'N/A',
                    vehicle_make: formData.vehicle_make || 'N/A',
                    vehicle_model: formData.vehicle_model || 'N/A',
                    vehicle_color: formData.vehicle_color || 'N/A',
                    last_seen_location: formData.location,
                    cas_number: formData.cas_number,
                    station_name: formData.station_name,
                    vin_number: formData.vin_number || null,
                    engine_number: formData.engine_number || null,
                    circulation_number: formData.circulation_number || null,
                    crime_outcome: formData.crime_outcome,
                    cit_success: formData.cit_success === 'true',
                    recovered_location_coords: (formData as any).recovered_location_coords,
                    recovered_at: (formData as any).recovered_at,
                    arrests: parseInt(formData.arrests || '0'),
                    guns_recovered: parseInt(formData.guns_recovered || '0'),
                    other_recoveries: formData.other_recoveries || '',
                    date_of_incident: formData.date_of_incident || null,
                    tracker_company: formData.tracker_company || null,
                    io_name: formData.io_name || null,
                    io_contact: formData.io_contact || null,
                    vehicle_involved: formData.vehicle_involved === 'true',
                    suspect_license_plate: formData.vehicle_involved === 'true' ? (formData.suspect_license_plate || null) : null,
                    suspect_vehicle_make: formData.vehicle_involved === 'true' ? (formData.suspect_vehicle_make || null) : null,
                    suspect_vehicle_model: formData.vehicle_involved === 'true' ? (formData.suspect_vehicle_model || null) : null,
                    suspect_vehicle_color: formData.vehicle_involved === 'true' ? (formData.suspect_vehicle_color || null) : null,
                };
            } else if (reportType === 'emergency') {
                // Exclude location_boundary and location_boundingbox for emergency reports as the table might not support them yet
                const { location_boundary, location_boundingbox, ...emergencyCommonData } = commonData;
                reportData = {
                    ...emergencyCommonData,
                    title: formData.title,
                    status: formData.status || (reportToEdit ? reportToEdit.status : ReportStatus.ACTIVE),
                    emergency_type: formData.emergency_type,
                    location: formData.location || 'Unknown Location',
                    vehicle_involved: formData.vehicle_involved === 'true' || formData.emergency_type === 'Kidnapping (taken with vehicle)',
                    vehicles_involved: (formData.vehicle_involved === 'true' || formData.emergency_type === 'Kidnapping (taken with vehicle)') ? parseInt(formData.vehicles_involved || '1') : 0,
                    injuries_reported: formData.injuries_reported === 'true',
                    fatalities_reported: formData.fatalities_reported === 'true',
                    license_plate: formData.license_plate,
                    vehicle_make: formData.vehicle_make,
                    vehicle_model: formData.vehicle_model,
                    vehicle_color: formData.vehicle_color,
                    vin_number: formData.vin_number,
                    engine_number: formData.engine_number,
                    cas_number: formData.cas_number,
                    station_name: formData.station_name,
                    crime_outcome: formData.crime_outcome,
                    cit_success: formData.cit_success === 'true',
                    arrests: parseInt(formData.arrests || '0'),
                    guns_recovered: parseInt(formData.guns_recovered || '0'),
                    other_recoveries: formData.other_recoveries || '',
                    recovered_location_coords: (formData as any).recovered_location_coords,
                    recovered_at: (formData as any).recovered_at,
                    date_of_incident: formData.date_of_incident || null,
                };
            } else {
                 reportData = {
                    ...commonData,
                    title: formData.title,
                    crime_type: formData.crime_type,
                    status: formData.status || (reportToEdit ? reportToEdit.status : ReportStatus.ACTIVE),
                    location: formData.location || 'Unknown Location',
                    cas_number: formData.cas_number,
                    station_name: formData.station_name,
                    crime_outcome: formData.crime_outcome,
                    cit_success: formData.cit_success === 'true',
                    vehicle_involved: formData.vehicle_involved === 'true',
                    license_plate: formData.vehicle_involved === 'true' ? formData.license_plate : undefined,
                    vehicle_make: formData.vehicle_involved === 'true' ? formData.vehicle_make : undefined,
                    vehicle_model: formData.vehicle_involved === 'true' ? formData.vehicle_model : undefined,
                    vehicle_color: formData.vehicle_involved === 'true' ? formData.vehicle_color : undefined,
                    vin_number: formData.vehicle_involved === 'true' ? formData.vin_number : undefined,
                    engine_number: formData.vehicle_involved === 'true' ? formData.engine_number : undefined,
                    arrests: parseInt(formData.arrests || '0'),
                    guns_recovered: parseInt(formData.guns_recovered || '0'),
                    other_recoveries: formData.other_recoveries || '',
                    recovered_location_coords: (formData as any).recovered_location_coords,
                    recovered_at: (formData as any).recovered_at,
                    date_of_incident: formData.date_of_incident || null,
                };
            }

            if (reportToEdit) {
                 const { error } = await supabase.from(tableName).update(reportData).eq('id', reportToEdit.id);
                 if (error) throw error;
                 logUserAction(user.id, 'UPDATE_REPORT', `Updated report ${reportToEdit.id} (${reportToEdit.ob_number})`);
                 
                 // Show WhatsApp confirm for updates too
                 if (profileData) {
                    const reportForBolo = {
                        ...reportData,
                        id: reportToEdit.id,
                        ob_number: reportToEdit.ob_number,
                        type: reportType,
                        company: Array.isArray(profileData.company) ? profileData.company[0] : profileData.company
                    };

                    // Sync update to legacy system as a new entry log
                    if (tableName === 'vehicle_reports') {
                        try {
                            const compObj = Array.isArray(profileData.company) ? profileData.company[0] : profileData.company;
                            const companyAlias = (compObj as any)?.alias || (compObj as any)?.name || '';
                            const companyFullName = (compObj as any)?.name || '';
                            
                            const legacyPayload = {
                                action: 'add', // Push as add since we don't track legacy IDs
                                type: 'STOLEN VEHICLE',
                                company: companyAlias, // Crucial: company alias saved as reporting company
                                vehicle_registration: reportData.license_plate || formData.license_plate || '',
                                make: reportData.vehicle_make || formData.vehicle_make || '',
                                model: reportData.vehicle_model || formData.vehicle_model || '',
                                vin_number: formData.vin_number || '',
                                engine_number: formData.engine_number || '',
                                color: formData.vehicle_color || '',
                                reason: ['stolen', 'suspicious', 'bolo', 'sought', 'hijacked', 'used_in_commission_of_crime', 'pending', 'recovered'].includes(reportData.status as any) 
                                    ? (reportData.status as any).toUpperCase().replace(/_/g, ' ') 
                                    : (['resolved', 'closed', 'deleted'].includes(reportData.status as any) ? 'RECOVERED' : 'STOLEN'),
                                entry_text: formData.description || reportData.description || 'Auto-entered update entry from Rapid911 system.',
                                cos_name: companyFullName || '', 
                                cos_contact_number: (compObj as any)?.cell_number || '',
                                case_number: formData.cas_number || '',
                                station_reported_at: formData.station_name || '',
                                io_name: formData.io_name || '',
                                io_contact: formData.io_contact || '',
                                recovered: ['stolen', 'suspicious', 'bolo', 'sought', 'hijacked', 'used_in_commission_of_crime', 'pending', 'recovered'].includes(reportData.status) 
                                    ? reportData.status.toUpperCase().replace(/_/g, ' ') 
                                    : (['resolved', 'closed', 'deleted'].includes(reportData.status) ? 'RECOVERED' : 'STOLEN'),
                                tracker: formData.tracker_company || 'No',
                                date_of_incident: formData.date_of_incident || (reportToEdit.date_of_incident ? new Date(reportToEdit.date_of_incident).toISOString().split('T')[0] : (reportData.reported_at ? new Date(reportData.reported_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]))
                            };

                            fetch('/api/legacy-api', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(legacyPayload)
                            }).then(legacyRes => {
                                if (!legacyRes.ok) {
                                    legacyRes.text().then(text => console.error('Failed to sync update to legacy system:', text));
                                } else {
                                    console.log('Successfully synced vehicle report update to legacy system');
                                }
                            }).catch(legacyErr => {
                                console.error('Error syncing update to legacy system:', legacyErr);
                            });
                        } catch (legacyErr) {
                            console.error('Error preparing legacy sync info:', legacyErr);
                        }
                    }

                    setPendingBoloData({ 
                        report: reportForBolo, 
                        profile: { ...profileData, company: Array.isArray(profileData.company) ? profileData.company[0] : profileData.company } as any 
                    });
                    setIsBoloConfirmOpen(true);
                    showWhatsAppConfirm = true;
                 }
            } else {
                const companyId = profileData?.company_id;
                const company = profileData?.company as any;
                const companyName = Array.isArray(company) ? company[0]?.name : company?.name;
                const initial = companyName ? companyName.charAt(0).toUpperCase() : 'P';
                
                const now = new Date();
                const month = (now.getMonth() + 1).toString().padStart(2, '0');
                const year = now.getFullYear();

                const { data: initialSequence, error: rpcError } = await supabase.rpc('get_next_ob_sequence', {
                    p_company_id: companyId,
                    p_report_date: now.toISOString()
                });
                
                if (rpcError) throw new Error(`Failed to generate OB Number: ${rpcError.message}`);

                let success = false;
                let lastError = null;
                let finalObNumber = '';
                let successfulInsertData: any = null;

                // Retry up to 10 times if we hit a unique constraint violation
                for (let attempt = 0; attempt < 10; attempt++) {
                    const currentSequence = (initialSequence || 1) + attempt;
                    const paddedSequence = String(currentSequence).padStart(4, '0');
                    const ob_number = `${initial}${paddedSequence}/${month}/${year}`;

                    const insertData = {
                        ...reportData,
                        id: reportId,
                        ob_number: ob_number,
                        status: reportData.status || (tableName === 'vehicle_reports' ? ReportStatus.STOLEN : ReportStatus.ACTIVE),
                        reported_by: user.id,
                        reported_at: now.toISOString(),
                        company_id: companyId,
                        cos_name: tableName === 'vehicle_reports' ? companyName : undefined,
                    };

                    const { error: insertError } = await supabase.from(tableName).insert(insertData);
                    
                    if (!insertError) {
                        success = true;
                        finalObNumber = ob_number;
                        successfulInsertData = insertData;

                        // Save new vehicle report to the legacy system
                        if (tableName === 'vehicle_reports') {
                            try {
                                const compObj = Array.isArray(profileData?.company) ? profileData.company[0] : profileData?.company;
                                const companyAlias = (compObj as any)?.alias || (compObj as any)?.name || '';
                                const companyFullName = (compObj as any)?.name || '';
                                
                                const legacyPayload = {
                                    action: 'add',
                                    type: 'STOLEN VEHICLE',
                                    company: companyAlias, // Crucial: company alias saved as reporting company
                                    vehicle_registration: insertData.license_plate || '',
                                    make: insertData.vehicle_make || '',
                                    model: insertData.vehicle_model || '',
                                    vin_number: insertData.vin_number || '',
                                    engine_number: insertData.engine_number || '',
                                    color: insertData.vehicle_color || '',
                                    reason: ['stolen', 'suspicious', 'bolo', 'sought', 'hijacked', 'used_in_commission_of_crime', 'pending', 'recovered'].includes(insertData.status as any) 
                                        ? (insertData.status as any).toUpperCase().replace(/_/g, ' ') 
                                        : (['resolved', 'closed', 'deleted'].includes(insertData.status as any) ? 'RECOVERED' : 'STOLEN'),
                                    entry_text: insertData.description || 'Auto-entered entry from Rapid911 system.',
                                    cos_name: companyFullName || '', // Company Alias Name goes to Complainant Name
                                    cos_contact_number: (compObj as any)?.cell_number || '',
                                    case_number: insertData.cas_number || '',
                                    station_reported_at: insertData.station_name || '',
                                    io_name: insertData.io_name || '',
                                    io_contact: insertData.io_contact || '',
                                    recovered: ['stolen', 'suspicious', 'bolo', 'sought', 'hijacked', 'used_in_commission_of_crime', 'pending', 'recovered'].includes(insertData.status as any) 
                                        ? (insertData.status as any).toUpperCase().replace(/_/g, ' ') 
                                        : (['resolved', 'closed', 'deleted'].includes(insertData.status as any) ? 'RECOVERED' : 'STOLEN'),
                                    tracker: formData.tracker_company || 'No',
                                    date_of_incident: formData.date_of_incident || (insertData.reported_at ? new Date(insertData.reported_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
                                };

                                const legacyRes = await fetch('/api/legacy-api', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(legacyPayload)
                                });
                                if (!legacyRes.ok) {
                                    console.error('Failed to sync to legacy system:', await legacyRes.text());
                                } else {
                                    console.log('Successfully synced new vehicle report to legacy system');
                                }
                            } catch (legacyErr) {
                                console.error('Error syncing to legacy system:', legacyErr);
                            }
                        }

                        break;
                    }

                    // Check for unique constraint violation (Postgres error code 23505)
                    if (insertError.code === '23505' || (insertError.message && insertError.message.includes('unique constraint'))) {
                        lastError = insertError;
                        // Small random delay before retry to help with concurrent requests
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
                        continue;
                    }

                    throw insertError;
                }

                if (!success) {
                    throw lastError || new Error("Failed to generate a unique OB number after multiple attempts.");
                }

                logUserAction(user.id, 'CREATE_REPORT', `Created new ${reportType} report ${reportId} (${finalObNumber})`);
                
                if (profileData) {
                    const reportForBolo = {
                        ...reportData,
                        id: reportId,
                        ob_number: finalObNumber,
                        type: reportType,
                        company: Array.isArray(profileData.company) ? profileData.company[0] : profileData.company
                    };
                    setPendingBoloData({ 
                        report: reportForBolo, 
                        profile: { ...profileData, company: Array.isArray(profileData.company) ? profileData.company[0] : profileData.company } as any 
                    });
                    setIsBoloConfirmOpen(true);
                    showWhatsAppConfirm = true;
                }
            }
            
            addToast(`Report ${reportToEdit ? 'updated' : 'submitted'} successfully!`, 'success');
            clearDraft();
            disableNavigationGuard();
            if (onReportSubmitted) onReportSubmitted();
            
            // If we are showing the BOLO confirmation, don't close yet
            if (!showWhatsAppConfirm) {
                onClose();
            }

        } catch (error: any) {
            let detailedMessage = error.message;
            if (detailedMessage && ((detailedMessage.includes("column") && detailedMessage.includes("does not exist")) || detailedMessage.includes("schema cache") || (detailedMessage.includes("function") && detailedMessage.includes("does not exist")))) {
                detailedMessage += "\n\n[DEVELOPER HINT] This error indicates a database schema mismatch (missing function or column). Please go to your Supabase dashboard, open the SQL Editor, and run the complete script from the DATABASE_SCHEMA.md file to update your database tables.";
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:hidden">
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-lg lg:max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                    {isQuickAdd ? 'Quick Add to Sought List' : (reportToEdit ? 'Edit Report' : 'File a New Report')}
                </h3>
                
                {(!reportToEdit && !isQuickAdd) && (
                    <div className="mb-6">
                        <div className="flex bg-gray-100 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
                            <button type="button" onClick={() => { setReportType('vehicle'); setFormData(prev => ({ ...prev, status: ReportStatus.STOLEN, vehicle_involved: 'true' })); }} className={`w-1/3 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${reportType === 'vehicle' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}><CarIcon className="w-5 h-5" /> Vehicle</button>
                            <button type="button" onClick={() => { setReportType('emergency'); setFormData(prev => ({ ...prev, status: ReportStatus.ACTIVE, vehicle_involved: 'false' })); }} className={`w-1/3 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${reportType === 'emergency' ? 'bg-orange-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}><AlertTriangleIcon className="w-5 h-5" /> Emergency</button>
                            <button type="button" onClick={() => { setReportType('crime'); setFormData(prev => ({ ...prev, status: ReportStatus.ACTIVE, vehicle_involved: 'false' })); }} className={`w-1/3 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${reportType === 'crime' ? 'bg-red-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}><CrimeIcon className="w-5 h-5" /> Crime</button>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {reportType === 'vehicle' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label htmlFor="license_plate" className={labelClasses}>Reg</label><input type="text" name="license_plate" id="license_plate" value={formData.license_plate || ''} onChange={handleChange} className={inputClasses} placeholder="REG" /></div>
                            <div><label htmlFor="vehicle_make" className={labelClasses}>Make</label><input type="text" name="vehicle_make" id="vehicle_make" value={formData.vehicle_make || ''} onChange={handleChange} className={inputClasses} list="makes-list" /></div>
                            <div><label htmlFor="vehicle_model" className={labelClasses}>Model</label><input type="text" name="vehicle_model" id="vehicle_model" value={formData.vehicle_model || ''} onChange={handleChange} className={inputClasses} list="models-list" /></div>
                            <div><label htmlFor="vehicle_color" className={labelClasses}>Colour</label><input type="text" name="vehicle_color" id="vehicle_color" value={formData.vehicle_color || ''} onChange={handleChange} className={inputClasses} list="colors-list" /></div>
                            <div><label htmlFor="year" className={labelClasses}>Year</label><input type="text" name="year" id="year" value={formData.year || ''} onChange={handleChange} className={inputClasses} placeholder="YEAR" /></div>
                            <div><label htmlFor="vin_number" className={labelClasses}>VIN Number</label><input type="text" name="vin_number" id="vin_number" value={formData.vin_number || ''} onChange={handleChange} className={inputClasses} placeholder="VIN Number" /></div>
                            <div><label htmlFor="engine_number" className={labelClasses}>Engine Number</label><input type="text" name="engine_number" id="engine_number" value={formData.engine_number || ''} onChange={handleChange} className={inputClasses} placeholder="Engine Number" /></div>
                            <div><label htmlFor="circulation_number" className={labelClasses}>Circulation Number</label><input type="text" name="circulation_number" id="circulation_number" value={formData.circulation_number || ''} onChange={handleChange} className={inputClasses} placeholder="Circulation Number" /></div>

                            <div className="md:col-span-2 border-t border-gray-200 dark:border-gray-800 pt-4 mt-2">
                                <label htmlFor="vehicle_involved" className={labelClasses}>Suspect Vehicle Involved?</label>
                                <select name="vehicle_involved" id="vehicle_involved" value={formData.vehicle_involved || 'false'} onChange={handleChange} className={inputClasses}>
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                </select>
                            </div>

                            {formData.vehicle_involved === 'true' && (
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-xl mt-2">
                                    <div className="md:col-span-2 text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                                        <CarIcon className="w-4 h-4 text-blue-500" /> Suspect Vehicle Details
                                    </div>
                                    <div><label htmlFor="suspect_license_plate" className={labelClasses}>Suspect Reg</label><input type="text" name="suspect_license_plate" id="suspect_license_plate" value={formData.suspect_license_plate || ''} onChange={handleChange} className={inputClasses} placeholder="Suspect REG" /></div>
                                    <div><label htmlFor="suspect_vehicle_make" className={labelClasses}>Suspect Make</label><input type="text" name="suspect_vehicle_make" id="suspect_vehicle_make" value={formData.suspect_vehicle_make || ''} onChange={handleChange} className={inputClasses} list="makes-list" placeholder="Suspect Make" /></div>
                                    <div><label htmlFor="suspect_vehicle_model" className={labelClasses}>Suspect Model</label><input type="text" name="suspect_vehicle_model" id="suspect_vehicle_model" value={formData.suspect_vehicle_model || ''} onChange={handleChange} className={inputClasses} list="models-list" placeholder="Suspect Model" /></div>
                                    <div><label htmlFor="suspect_vehicle_color" className={labelClasses}>Suspect Colour</label><input type="text" name="suspect_vehicle_color" id="suspect_vehicle_color" value={formData.suspect_vehicle_color || ''} onChange={handleChange} className={inputClasses} list="colors-list" placeholder="Suspect Colour" /></div>
                                </div>
                            )}
                             
                            <div className="md:col-span-2">
                                <label htmlFor="location" className={labelClasses}>Last Seen Loc</label>
                                <div className="relative mt-1" ref={suggestionsRef}>
                                    <input type="text" name="location" id="location" value={formData.location || ''} onChange={handleChange} className={`${inputClasses} !mt-0 pr-10`} placeholder="Pin Taken Here" autoComplete="off"/>
                                    <button type="button" onClick={() => setMapVisible(!isMapVisible)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors" title="Pin location on map">
                                        <MapPinIcon className="w-5 h-5" />
                                    </button>
                                    
                                    {/* ADDRESS SUGGESTIONS DROPDOWN */}
                                    {((addressSuggestions.length > 0 || (formData.location && formData.location.trim().length >= 3 && !formData.location_coords)) && (
                                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                            {addressSuggestions.map((suggestion, index) => (
                                                <button
                                                    type="button"
                                                    key={suggestion.place_id || index}
                                                    onClick={() => handleSuggestionClick(suggestion)}
                                                    className="w-full text-left p-3 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                                                >
                                                    {suggestion.display_name}
                                                </button>
                                            ))}
                                            {formData.location && formData.location.trim().length >= 3 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSuggestionClick({ display_name: formData.location.trim(), is_custom: true })}
                                                    className="w-full text-left p-3 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium transition-colors border-t border-gray-100 dark:border-gray-700/50 last:border-0"
                                                >
                                                    Use custom address: "{formData.location.trim()}"
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="md:col-span-2">
                                <label htmlFor="map_link" className={labelClasses}>Map Link (Optional)</label>
                                <input type="text" name="map_link" id="map_link" value={formData.map_link || ''} onChange={handleChange} className={inputClasses} placeholder="Paste Google Maps link here..." />
                            </div>

                            {isMapVisible && (
                                <div className="md:col-span-2 mt-2">
                                     <LocationPicker
                                        initialCoords={formData.location_coords}
                                        onLocationChange={handleLocationChange}
                                    />
                                </div>
                            )}

                            <div><label htmlFor="cas_number" className={labelClasses}>Case</label><input type="text" name="cas_number" id="cas_number" value={formData.cas_number || ''} onChange={handleChange} className={inputClasses} placeholder="Case" /></div>
                            <div>
                                <label htmlFor="station_name" className={labelClasses}>Station</label>
                                <div className="relative" ref={stationSuggestionsRef}>
                                    <input type="text" name="station_name" id="station_name" value={formData.station_name || ''} onChange={handleChange} className={inputClasses} placeholder="Station" autoComplete="off" />
                                    {stationSuggestions.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                            {stationSuggestions.map(station => (
                                                <button
                                                    type="button"
                                                    key={station}
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, station_name: station }));
                                                        setStationSuggestions([]);
                                                    }}
                                                    className="w-full text-left p-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    {station}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <label htmlFor="io_name" className={labelClasses}>IO Name</label>
                                <input type="text" name="io_name" id="io_name" value={formData.io_name || ''} onChange={handleChange} className={inputClasses} placeholder="Investigating Officer Name" />
                            </div>
                            <div>
                                <label htmlFor="io_contact" className={labelClasses}>IO Contact</label>
                                <input type="text" name="io_contact" id="io_contact" value={formData.io_contact || ''} onChange={handleChange} className={inputClasses} placeholder="IO Contact Number" />
                            </div>

                            <div>
                                <label htmlFor="date_of_incident" className={labelClasses}>Date of Incident</label>
                                <input type="date" name="date_of_incident" id="date_of_incident" value={formData.date_of_incident || ''} onChange={handleChange} className={inputClasses} />
                            </div>
                            <div>
                                <label htmlFor="tracker_company" className={labelClasses}>Tracker Company</label>
                                <input type="text" name="tracker_company" id="tracker_company" value={formData.tracker_company || ''} onChange={handleChange} className={inputClasses} placeholder="Tracker Company (e.g. CARTRACK)" />
                            </div>

                            <div>
                                <label htmlFor="severity" className={labelClasses}>Severity</label>
                                <select name="severity" id="severity" value={formData.severity || ''} onChange={handleChange} className={`${inputClasses} uppercase font-bold`}>
                                    <option value="" className="uppercase">SELECT SEVERITY</option>
                                    {Object.values(Severity).map(s => <option key={s} value={s} className="uppercase font-bold">{s.toUpperCase()}</option>)}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label htmlFor="description" className={labelClasses}>Description</label>
                                <textarea name="description" id="description" rows={3} value={formData.description || ''} onChange={handleChange} className={inputClasses} />
                            </div>

                            <div className="md:col-span-2">
                                <label htmlFor="status" className={labelClasses}>Incident Status</label>
                                <select name="status" id="status" value={formData.status || ReportStatus.STOLEN} onChange={handleChange} className={inputClasses}>
                                    {Object.values(ReportStatus).filter(s => s !== ReportStatus.DELETED).map(s => (
                                        <option key={s} value={s}>{s.replace(/_/g, ' ').toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ) : reportType === 'emergency' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label htmlFor="title" className={labelClasses}>Emergency Title</label><input type="text" name="title" id="title" value={formData.title || ''} onChange={handleChange} className={inputClasses} placeholder="e.g. Multi-vehicle collision, Fire, Medical" /></div>
                                <div>
                                    <label htmlFor="emergency_type" className={labelClasses}>Type of Emergency</label>
                                    <select name="emergency_type" id="emergency_type" value={formData.emergency_type || ''} onChange={handleChange} className={inputClasses}>
                                        <option value="" disabled>Select Emergency Type</option>
                                        <option value="Fire">Fire</option>
                                        <option value="Medical Emergency">Medical Emergency</option>
                                        <option value="Roadside Assistance">Roadside Assistance</option>
                                        <option value="Multi-vehicle Collision">Multi-vehicle Collision</option>
                                        <option value="Pedestrian Incident">Pedestrian Incident</option>
                                        <option value="Natural Disaster">Natural Disaster</option>
                                        <option value="Kidnapping (taken with vehicle)">Kidnapping (taken with vehicle)</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            {(formData.vehicle_involved === 'true' || formData.emergency_type === 'Kidnapping (taken with vehicle)' || formData.emergency_type === 'Multi-vehicle Collision') && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <div className="md:col-span-2 text-sm font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-2">
                                        <CarIcon className="w-4 h-4" /> Vehicle Details {formData.vehicles_involved > 1 ? '(Primary Vehicle)' : ''}
                                    </div>
                                    <div><label htmlFor="license_plate" className={labelClasses}>Reg</label><input type="text" name="license_plate" id="license_plate" value={formData.license_plate || ''} onChange={handleChange} className={inputClasses} /></div>
                                    <div><label htmlFor="vehicle_make" className={labelClasses}>Make</label><input type="text" name="vehicle_make" id="vehicle_make" value={formData.vehicle_make || ''} onChange={handleChange} className={inputClasses} list="makes-list" /></div>
                                    <div><label htmlFor="vehicle_model" className={labelClasses}>Vehicle Model</label><input type="text" name="vehicle_model" id="vehicle_model" value={formData.vehicle_model || ''} onChange={handleChange} className={inputClasses} list="models-list" /></div>
                                    <div><label htmlFor="vehicle_color" className={labelClasses}>Vehicle Color</label><input type="text" name="vehicle_color" id="vehicle_color" value={formData.vehicle_color || ''} onChange={handleChange} className={inputClasses} list="colors-list" /></div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="vehicle_involved" className={labelClasses}>Vehicle Involved?</label>
                                    <select name="vehicle_involved" id="vehicle_involved" value={formData.vehicle_involved || 'false'} onChange={handleChange} className={inputClasses}>
                                        <option value="false">No</option>
                                        <option value="true">Yes</option>
                                    </select>
                                </div>
                                {(formData.vehicle_involved === 'true' || formData.emergency_type === 'Multi-vehicle Collision') && (
                                    <div>
                                        <label htmlFor="vehicles_involved" className={labelClasses}>Number of Vehicles</label>
                                        <select name="vehicles_involved" id="vehicles_involved" value={formData.vehicles_involved || '1'} onChange={handleChange} className={inputClasses}>
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                                <option key={num} value={num}>{num}</option>
                                            ))}
                                            <option value="11">More than 10</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="injuries_reported" className={labelClasses}>Injuries?</label>
                                    <select name="injuries_reported" id="injuries_reported" value={formData.injuries_reported || 'false'} onChange={handleChange} className={inputClasses}>
                                        <option value="false">No</option>
                                        <option value="true">Yes</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="fatalities_reported" className={labelClasses}>Fatalities?</label>
                                    <select name="fatalities_reported" id="fatalities_reported" value={formData.fatalities_reported || 'false'} onChange={handleChange} className={inputClasses}>
                                        <option value="false">No</option>
                                        <option value="true">Yes</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <label htmlFor="location" className={labelClasses}>Pindrop of Scene / Location</label>
                                <div className="relative mt-1" ref={suggestionsRef}>
                                    <input type="text" name="location" id="location" value={formData.location || ''} onChange={handleChange} className={`${inputClasses} !mt-0 pr-10`} placeholder="Location at Scene" autoComplete="off"/>
                                    <button type="button" onClick={() => setMapVisible(!isMapVisible)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors" title="Pin location on map">
                                        <MapPinIcon className="w-5 h-5" />
                                    </button>
                                    
                                    {/* ADDRESS SUGGESTIONS DROPDOWN */}
                                    {((addressSuggestions.length > 0 || (formData.location && formData.location.trim().length >= 3 && !formData.location_coords)) && (
                                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                            {addressSuggestions.map((suggestion, index) => (
                                                <button
                                                    type="button"
                                                    key={suggestion.place_id || index}
                                                    onClick={() => handleSuggestionClick(suggestion)}
                                                    className="w-full text-left p-3 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                                                >
                                                    {suggestion.display_name}
                                                </button>
                                            ))}
                                            {formData.location && formData.location.trim().length >= 3 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSuggestionClick({ display_name: formData.location.trim(), is_custom: true })}
                                                    className="w-full text-left p-3 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium transition-colors border-t border-gray-100 dark:border-gray-700/50 last:border-0"
                                                >
                                                    Use custom address: "{formData.location.trim()}"
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label htmlFor="map_link" className={labelClasses}>Map Link (Optional)</label>
                                <input type="text" name="map_link" id="map_link" value={formData.map_link || ''} onChange={handleChange} className={inputClasses} placeholder="Paste Google Maps link here..." />
                            </div>

                            {isMapVisible && (
                                <div className="mt-2">
                                     <LocationPicker
                                        initialCoords={formData.location_coords}
                                        onLocationChange={handleLocationChange}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label htmlFor="cas_number" className={labelClasses}>Case Number</label><input type="text" name="cas_number" id="cas_number" value={formData.cas_number || ''} onChange={handleChange} className={inputClasses} placeholder="Case" /></div>
                                <div><label htmlFor="date_of_incident" className={labelClasses}>Date of Incident</label><input type="date" name="date_of_incident" id="date_of_incident" value={formData.date_of_incident || ''} onChange={handleChange} className={inputClasses} /></div>
                                <div className="md:col-span-2">
                                    <label htmlFor="station_name" className={labelClasses}>Station Name</label>
                                    <div className="relative" ref={stationSuggestionsRef}>
                                        <input type="text" name="station_name" id="station_name" value={formData.station_name || ''} onChange={handleChange} className={inputClasses} placeholder="Station" autoComplete="off" />
                                        {stationSuggestions.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                {stationSuggestions.map(station => (
                                                    <button
                                                        type="button"
                                                        key={station}
                                                        onClick={() => {
                                                            setFormData(prev => ({ ...prev, station_name: station }));
                                                            setStationSuggestions([]);
                                                        }}
                                                        className="w-full text-left p-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        {station}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label htmlFor="title" className={labelClasses}>Incident Title</label>
                                <input type="text" name="title" id="title" value={formData.title || ''} onChange={handleChange} className={inputClasses} />
                            </div>
                            <div className="md:col-span-2">
                                <MultiSelect 
                                    label="Type of Crime"
                                    options={["Theft", "Burglary", "Robbery", "Assault", "Vandalism", "Hijacking", "CIT Robbery", "Murder", "Attempted Murder"]}
                                    selected={(formData.crime_type || '').split(',').filter(Boolean)}
                                    onChange={(selected) => setFormData(prev => ({ ...prev, crime_type: selected.join(',') }))}
                                    placeholder="Select crime types..."
                                />
                            </div>
                           
                            <div><label htmlFor="cas_number" className={labelClasses}>Case</label><input type="text" name="cas_number" id="cas_number" value={formData.cas_number || ''} onChange={handleChange} className={inputClasses} placeholder="Case" /></div>
                            
                            <div className="md:col-span-2">
                                <label htmlFor="station_name" className={labelClasses}>Station</label>
                                <div className="relative" ref={stationSuggestionsRef}>
                                    <input type="text" name="station_name" id="station_name" value={formData.station_name || ''} onChange={handleChange} className={inputClasses} placeholder="Station" autoComplete="off" />
                                    {stationSuggestions.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                            {stationSuggestions.map(station => (
                                                <button
                                                    type="button"
                                                    key={station}
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, station_name: station }));
                                                        setStationSuggestions([]);
                                                    }}
                                                    className="w-full text-left p-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    {station}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <label htmlFor="io_name" className={labelClasses}>IO Name</label>
                                <input type="text" name="io_name" id="io_name" value={formData.io_name || ''} onChange={handleChange} className={inputClasses} placeholder="Investigating Officer Name" />
                            </div>
                            <div>
                                <label htmlFor="io_contact" className={labelClasses}>IO Contact</label>
                                <input type="text" name="io_contact" id="io_contact" value={formData.io_contact || ''} onChange={handleChange} className={inputClasses} placeholder="IO Contact Number" />
                            </div>

                            <div>
                                <label htmlFor="date_of_incident" className={labelClasses}>Date of Incident</label>
                                <input type="date" name="date_of_incident" id="date_of_incident" value={formData.date_of_incident || ''} onChange={handleChange} className={inputClasses} />
                            </div>

                            <div className="md:col-span-2">
                                <label htmlFor="vehicle_involved" className={labelClasses}>Vehicle Involved?</label>
                                <select name="vehicle_involved" id="vehicle_involved" value={formData.vehicle_involved || 'false'} onChange={handleChange} className={inputClasses}>
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                </select>
                            </div>

                            {formData.vehicle_involved === 'true' && (
                                <div className="md:col-span-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 underline">Vehicle Involved/Stolen Details</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label htmlFor="license_plate" className={labelClasses}>Reg</label><input type="text" name="license_plate" id="license_plate" value={formData.license_plate || ''} onChange={handleChange} className={inputClasses} /></div>
                                        <div><label htmlFor="vehicle_make" className={labelClasses}>Make</label><input type="text" name="vehicle_make" id="vehicle_make" value={formData.vehicle_make || ''} onChange={handleChange} className={inputClasses} list="makes-list" /></div>
                                        <div><label htmlFor="vehicle_model" className={labelClasses}>Vehicle Model</label><input type="text" name="vehicle_model" id="vehicle_model" value={formData.vehicle_model || ''} onChange={handleChange} className={inputClasses} list="models-list" /></div>
                                        <div><label htmlFor="vehicle_color" className={labelClasses}>Vehicle Color</label><input type="text" name="vehicle_color" id="vehicle_color" value={formData.vehicle_color || ''} onChange={handleChange} className={inputClasses} list="colors-list" /></div>
                                    </div>
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <label htmlFor="location" className={labelClasses}>Pindrop of Scene</label>
                                <div className="relative mt-1" ref={suggestionsRef}>
                                    <input type="text" name="location" id="location" value={formData.location || ''} onChange={handleChange} className={`${inputClasses} !mt-0 pr-10`} placeholder="Location at Scene" autoComplete="off"/>
                                    <button type="button" onClick={() => setMapVisible(!isMapVisible)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 transition-colors" title="Pin location on map">
                                        <MapPinIcon className="w-5 h-5" />
                                    </button>
                                    
                                    {/* ADDRESS SUGGESTIONS DROPDOWN */}
                                    {((addressSuggestions.length > 0 || (formData.location && formData.location.trim().length >= 3 && !formData.location_coords)) && (
                                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                            {addressSuggestions.map((suggestion, index) => (
                                                <button
                                                    type="button"
                                                    key={suggestion.place_id || index}
                                                    onClick={() => handleSuggestionClick(suggestion)}
                                                    className="w-full text-left p-3 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                                                >
                                                    {suggestion.display_name}
                                                </button>
                                            ))}
                                            {formData.location && formData.location.trim().length >= 3 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSuggestionClick({ display_name: formData.location.trim(), is_custom: true })}
                                                    className="w-full text-left p-3 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium transition-colors border-t border-gray-100 dark:border-gray-700/50 last:border-0"
                                                >
                                                    Use custom address: "{formData.location.trim()}"
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="md:col-span-2">
                                <label htmlFor="map_link" className={labelClasses}>Map Link (Optional)</label>
                                <input type="text" name="map_link" id="map_link" value={formData.map_link || ''} onChange={handleChange} className={inputClasses} placeholder="Paste Google Maps link here..." />
                            </div>

                            {isMapVisible && (
                                <div className="md:col-span-2 mt-2">
                                     <LocationPicker
                                        initialCoords={formData.location_coords}
                                        onLocationChange={handleLocationChange}
                                    />
                                </div>
                            )}

                            <div>
                                <label htmlFor="severity" className={labelClasses}>Severity</label>
                                <select name="severity" id="severity" value={formData.severity || ''} onChange={handleChange} className={`${inputClasses} uppercase font-bold`}>
                                    <option value="" className="uppercase">SELECT SEVERITY</option>
                                    {Object.values(Severity).map(s => <option key={s} value={s} className="uppercase font-bold">{s.toUpperCase()}</option>)}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label htmlFor="status" className={labelClasses}>Incident Status</label>
                                <select name="status" id="status" value={formData.status || ReportStatus.ACTIVE} onChange={handleChange} className={inputClasses}>
                                    {Object.values(ReportStatus).filter(s => s !== ReportStatus.DELETED).map(s => (
                                        <option key={s} value={s}>{s.replace(/_/g, ' ').toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label htmlFor="description" className={labelClasses}>Description</label>
                                <textarea name="description" id="description" rows={3} value={formData.description || ''} onChange={handleChange} className={inputClasses} />
                            </div>
                        </div>
                    )}

                    {/* Common Evidence Section */}
                     <div>
                        <label className={labelClasses}>Images</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                <UploadCloudIcon className="mx-auto h-12 w-12 text-gray-400"/>
                                <div className="flex text-sm text-gray-600 dark:text-gray-400">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-100 dark:focus-within:ring-offset-gray-900 focus-within:ring-blue-500 px-1">
                                        <span>Upload files</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple accept="image/*" onChange={handleFileChange} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {imagePreviews.length > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                            {imagePreviews.map((src, index) => (
                                <div key={index} className="relative group aspect-square">
                                    <img src={src} alt={`Preview ${index}`} className="absolute inset-0 w-full h-full object-cover rounded-md" />
                                    <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <XIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* UPDATE / RECOVERY SECTION (ONLY FOR VEHICLE AND CRIME) */}
                    {(reportType === 'vehicle' || reportType === 'crime') && (
                        <div className="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-6 mt-6">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                    UPDATE / RECOVERY
                                </h4>
                                <div className="flex gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            const isRecovered = formData.status === ReportStatus.RECOVERED;
                                            setFormData(prev => ({ 
                                                ...prev, 
                                                status: isRecovered 
                                                    ? (reportType === 'vehicle' ? ReportStatus.STOLEN : ReportStatus.ACTIVE) 
                                                    : ReportStatus.RECOVERED 
                                            }));
                                            if (isRecovered) {
                                                setShowRecoveryMap(false);
                                            }
                                        }}
                                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${formData.status === ReportStatus.RECOVERED ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                    >
                                        RECOVERED
                                    </button>
                                </div>
                            </div>

                            {formData.status === ReportStatus.RECOVERED && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label htmlFor="saps_13" className={labelClasses}>SAPS 13</label><input type="text" name="saps_13" id="saps_13" value={formData.saps_13 || ''} onChange={handleChange} className={inputClasses} placeholder="SAPS 13 #" /></div>
                                    <div><label htmlFor="pound_name" className={labelClasses}>Pound Name</label><input type="text" name="pound_name" id="pound_name" value={formData.pound_name || ''} onChange={handleChange} className={inputClasses} placeholder="POUND NAME" /></div>
                                    
                                    <div className="md:col-span-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">LOCATION PIN ON RECOVERY</label>
                                            {showRecoveryMap ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            recovered_location_coords: null
                                                        } as any));
                                                        setShowRecoveryMap(false);
                                                    }}
                                                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                                    id="remove-recovery-pin-btn"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" /> Remove Pin
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowRecoveryMap(true)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                                    id="add-recovery-pin-btn"
                                                >
                                                    + Pin on Map
                                                </button>
                                            )}
                                        </div>
                                        {showRecoveryMap && (
                                            <LocationPicker 
                                                onLocationSelect={(coords) => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        recovered_location_coords: coords
                                                    } as any));
                                                }}
                                                initialCoords={(formData as any).recovered_location_coords}
                                                placeholder="Pin recovery location..."
                                            />
                                        )}
                                        <div className="mt-2">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Recovery Time</label>
                                            <input
                                                type="datetime-local"
                                                name="recovered_at"
                                                value={(formData as any).recovered_at || ''}
                                                onChange={handleChange}
                                                className={inputClasses}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClasses}>ARRESTS</label>
                                        <div className="flex gap-4 mt-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="has_arrests" checked={formData.has_arrests === true} onChange={() => setFormData({...formData, has_arrests: true})} className="text-blue-600" />
                                                <span className="text-sm dark:text-gray-300">Yes</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="has_arrests" checked={formData.has_arrests === false} onChange={() => setFormData({...formData, has_arrests: false})} className="text-blue-600" />
                                                <span className="text-sm dark:text-gray-300">No</span>
                                            </label>
                                        </div>
                                        {formData.has_arrests && (
                                            <input type="number" name="arrests" value={formData.arrests || 0} onChange={handleChange} className={`${inputClasses} mt-2`} placeholder="# of suspects" min="0" />
                                        )}
                                    </div>

                                    <div>
                                        <label className={labelClasses}>FIREARMS</label>
                                        <div className="flex gap-4 mt-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="has_firearms" checked={formData.has_firearms === true} onChange={() => setFormData({...formData, has_firearms: true})} className="text-blue-600" />
                                                <span className="text-sm dark:text-gray-300">Yes</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="has_firearms" checked={formData.has_firearms === false} onChange={() => setFormData({...formData, has_firearms: false})} className="text-blue-600" />
                                                <span className="text-sm dark:text-gray-300">No</span>
                                            </label>
                                        </div>
                                        {formData.has_firearms && (
                                            <input type="number" name="guns_recovered" value={formData.guns_recovered || 0} onChange={handleChange} className={`${inputClasses} mt-2`} placeholder="# of firearms" min="0" />
                                        )}
                                    </div>

                                    <div className="md:col-span-2">
                                        <label htmlFor="other_recoveries" className={labelClasses}>OTHER NOTES</label>
                                        <textarea name="other_recoveries" id="other_recoveries" rows={2} value={formData.other_recoveries || ''} onChange={handleChange} className={inputClasses} placeholder="Additional recovery details..." />
                                    </div>

                                    <div className="md:col-span-2 flex justify-center">
                                        <button 
                                            type="submit"
                                            disabled={loading}
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-green-600/20 transition-all flex items-center gap-2"
                                        >
                                            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                            {loading ? 'SAVING...' : 'UPDATE'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-6 flex justify-end space-x-4">
                        <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
                        <button type="submit" disabled={loading} className="btn-primary flex items-center">
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

            <AnimatePresence>
                {isBoloConfirmOpen && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full border border-gray-100 dark:border-gray-700 text-center"
                        >
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircleIcon className="w-10 h-10 text-green-500" />
                            </div>
                            <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Report Saved!</h4>
                            <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                                Your report has been submitted successfully.<br/>
                                <span className="font-semibold text-gray-900 dark:text-gray-200">Generate BOLO card for WhatsApp?</span>
                            </p>
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsBoloConfirmOpen(false);
                                        onClose();
                                    }}
                                    className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all border border-gray-200 dark:border-gray-600"
                                >
                                    Later
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (pendingBoloData) {
                                            try {
                                                addToast('Generating BOLO card...', 'info');
                                                setIsBoloConfirmOpen(false);
                                                const result = await generateAndShareBolo(
                                                    pendingBoloData.report, 
                                                    pendingBoloData.profile, 
                                                    mainLogoUrl, 
                                                    'whatsapp', 
                                                    '+27846910111'
                                                );
                                                
                                                if (result.method === 'share') {
                                                    addToast('BOLO card shared via system menu.', 'success');
                                                } else if (result.method === 'clipboard') {
                                                    addToast('BOLO card copied to clipboard. Please paste it (Ctrl+V) in the WhatsApp window.', 'success', 8000);
                                                } else {
                                                    addToast('BOLO card downloaded. Please attach it manually in the WhatsApp window.', 'info', 8000);
                                                }
                                            } catch (e) {
                                                console.error('Failed to generate BOLO for WhatsApp:', e);
                                                addToast('Failed to send BOLO via WhatsApp', 'error');
                                            } finally {
                                                onClose();
                                            }
                                        }
                                    }}
                                    className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
                                >
                                    Yes, Send
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isConfirmCloseOpen && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-gray-700"
                        >
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Unsaved Changes</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                You have unsaved changes. Would you like to save this as a draft for later, or discard your changes?
                            </p>

                            <div className="flex flex-col gap-3">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setIsConfirmCloseOpen(false);
                                        onClose();
                                    }}
                                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all"
                                >
                                    Save Draft
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => {
                                        clearDraft();
                                        setIsConfirmCloseOpen(false);
                                        onClose();
                                    }}
                                    className="w-full py-3 px-4 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
                                >
                                    Discard Draft
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setIsConfirmCloseOpen(false)}
                                    className="w-full py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {duplicateInfo && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">

                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-yellow-200 dark:border-yellow-900/50"
                        >
                            <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-400 mb-4">
                                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                                    <AlertTriangleIcon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold">Duplicate Plate Detected</h3>
                            </div>
                            
                            <div className="bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-yellow-500 p-4 mb-6">
                                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                    A <span className="font-bold text-black dark:text-white">{duplicateInfo.type}</span> report with license plate 
                                    <span className="font-bold text-black dark:text-white"> {duplicateInfo.licensePlate} </span> 
                                    already exists in the system.
                                </p>
                                <div className="mt-3 flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex justify-between">
                                        <span>OB Number:</span>
                                        <span className="font-mono font-bold text-gray-700 dark:text-gray-200">{duplicateInfo.obNumber}</span>
                                    </div>
                                    {duplicateInfo.status && (
                                        <div className="flex justify-between">
                                            <span>Status:</span>
                                            <span className="font-bold uppercase text-yellow-600 dark:text-yellow-500">{duplicateInfo.status}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 italic">
                                Adding multiple reports for the same registration might create confusion. Are you sure you want to proceed with this new entry?
                            </p>

                            <div className="flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setDuplicateInfo(null)}
                                    className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        setDuplicateInfo(null);
                                        // @ts-ignore
                                        handleSubmit({ ...e, preventDefault: () => {} }, true);
                                    }}
                                    className="flex-1 py-3 px-4 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-bold shadow-lg shadow-yellow-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    Proceed Anyway
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReportModal;
