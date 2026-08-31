import React, { useState, useEffect } from 'react';
import { Profile, ReportStatus, Severity } from '../types';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import { X, Wrench, MapPin, Truck, Car, Phone, User, CheckCircle2, Navigation } from 'lucide-react';

interface RoadsideQuickReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    driverProfile: Profile;
    onReportCreated?: () => void;
}

export const RoadsideQuickReportModal: React.FC<RoadsideQuickReportModalProps> = ({
    isOpen,
    onClose,
    driverProfile,
    onReportCreated,
}) => {
    const { addToast } = useToast();
    const [carNumber, setCarNumber] = useState('');
    const [driverName, setDriverName] = useState('');
    const [cellNumber, setCellNumber] = useState('');
    const [vehicleMake, setVehicleMake] = useState('');
    const [vehicleModel, setVehicleModel] = useState('');
    const [licensePlate, setLicensePlate] = useState('');
    const [vehicleColor, setVehicleColor] = useState('');
    const [assistanceType, setAssistanceType] = useState('Breakdown / Mechanical');
    const [breakdownLocation, setBreakdownLocation] = useState('');
    const [dropOffLocation, setDropOffLocation] = useState('');
    const [description, setDescription] = useState('');
    const [severity, setSeverity] = useState<Severity>(Severity.HIGH);
    const [isRollback, setIsRollback] = useState(true);
    const [isRecovery, setIsRecovery] = useState(false);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        // Auto-generate Car/Callout number
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        setCarNumber(`RA-${randomNum}`);

        // Try getting current GPS
        if (driverProfile.location_coords) {
            setCoords(driverProfile.location_coords);
        } else if (navigator.geolocation) {
            setIsLocating(true);
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setIsLocating(false);
                },
                () => setIsLocating(false),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
    }, [isOpen, driverProfile.location_coords]);

    if (!isOpen) return null;

    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            addToast('Geolocation is not supported by your device.', 'error');
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCoords(newCoords);
                setIsLocating(false);
                addToast('Breakdown GPS location captured.', 'info');
            },
            (err) => {
                setIsLocating(false);
                addToast(`Location error: ${err.message}`, 'error');
            },
            { enableHighAccuracy: true }
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!breakdownLocation.trim()) {
            addToast('Please provide a breakdown location.', 'warning');
            return;
        }

        setIsSubmitting(true);

        try {
            const obNumber = `RS-${Date.now().toString().slice(-6)}`;
            const reportTitle = `${assistanceType}: ${vehicleMake || 'Vehicle'} ${vehicleModel || ''} (${licensePlate || 'No Reg'})`.trim();

            const reportPayload: any = {
                title: reportTitle,
                description: description || `Field-logged roadside callout: ${assistanceType} for ${driverName || 'Motorist'}`,
                location: breakdownLocation,
                location_coords: coords,
                emergency_type: 'Roadside Assistance',
                assistance_type: assistanceType,
                car_number: carNumber,
                card_number: carNumber,
                driver_name: driverName,
                drop_off_location: dropOffLocation,
                license_plate: licensePlate.toUpperCase().trim(),
                vehicle_make: vehicleMake,
                vehicle_model: vehicleModel,
                vehicle_color: vehicleColor,
                vehicle_involved: true,
                vehicles_involved: 1,
                rollback: isRollback,
                recovery: isRecovery,
                severity: severity,
                status: ReportStatus.IN_PROGRESS,
                reported_by: driverProfile.id,
                assigned_to: driverProfile.id, // Auto-assign to self
                reported_at: new Date().toISOString(),
                company_id: driverProfile.company_id || null,
                ob_number: obNumber,
            };

            if (supabase) {
                const { data, error } = await supabase
                    .from('emergency_reports')
                    .insert(reportPayload)
                    .select()
                    .single();

                if (error) throw error;

                if (data) {
                    // Log to report_updates
                    await supabase.from('report_updates').insert({
                        report_id: data.id,
                        user_id: driverProfile.id,
                        content: `🚗 Roadside Callout logged directly on field by Driver ${driverProfile.first_name} ${driverProfile.surname}. Status: In Progress.`,
                    });
                }
            }

            addToast('Roadside Callout created and assigned to you.', 'success');
            if (onReportCreated) onReportCreated();
            onClose();
        } catch (err: any) {
            console.error('Error logging roadside callout:', err);
            addToast(`Failed to create callout: ${err.message || 'Unknown error'}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
            <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl p-5 sm:p-7 w-full max-w-2xl my-6 flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                            <Wrench className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                                Log New Roadside Callout
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Create and self-dispatch a stranded motorist breakdown assistance job
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-xl transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto py-4 space-y-4 custom-scrollbar pr-1">
                    {/* Callout & Assistance Type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Car / Job Ref #
                            </label>
                            <input
                                type="text"
                                value={carNumber}
                                onChange={e => setCarNumber(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Assistance Required
                            </label>
                            <select
                                value={assistanceType}
                                onChange={e => setAssistanceType(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                            >
                                <option value="Breakdown / Mechanical">Breakdown / Mechanical</option>
                                <option value="Towing / Rollback">Towing / Rollback</option>
                                <option value="Battery Jumpstart / Test">Battery Jumpstart / Test</option>
                                <option value="Flat Tyre Change">Flat Tyre Change</option>
                                <option value="Vehicle Lockout / Keys Inside">Vehicle Lockout / Keys Inside</option>
                                <option value="Fuel Delivery">Fuel Delivery</option>
                                <option value="Winching / Mud Extrication">Winching / Mud Extrication</option>
                                <option value="Accident Scene Recovery">Accident Scene Recovery</option>
                            </select>
                        </div>
                    </div>

                    {/* Member / Contact Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Member / Driver Name
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <User className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="e.g. Sarah Connor"
                                    value={driverName}
                                    onChange={e => setDriverName(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Member Cell / Contact #
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Phone className="w-4 h-4" />
                                </div>
                                <input
                                    type="tel"
                                    placeholder="e.g. 082 123 4567"
                                    value={cellNumber}
                                    onChange={e => setCellNumber(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Vehicle Details */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Reg / Plate
                            </label>
                            <input
                                type="text"
                                placeholder="CA 123-456"
                                value={licensePlate}
                                onChange={e => setLicensePlate(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-bold uppercase focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Make
                            </label>
                            <input
                                type="text"
                                placeholder="Toyota"
                                value={vehicleMake}
                                onChange={e => setVehicleMake(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Model
                            </label>
                            <input
                                type="text"
                                placeholder="Hilux / Corolla"
                                value={vehicleModel}
                                onChange={e => setVehicleModel(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Color
                            </label>
                            <input
                                type="text"
                                placeholder="White"
                                value={vehicleColor}
                                onChange={e => setVehicleColor(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Locations */}
                    <div className="space-y-3">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                                    Breakdown Location (Street / Highway / Marker) *
                                </label>
                                <button
                                    type="button"
                                    onClick={handleGetCurrentLocation}
                                    disabled={isLocating}
                                    className="flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline"
                                >
                                    <Navigation className="w-3.5 h-3.5" />
                                    <span>{isLocating ? 'Locating...' : 'Use My GPS'}</span>
                                </button>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <MapPin className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="e.g. N1 South before New Road Exit, Midrand"
                                    value={breakdownLocation}
                                    onChange={e => setBreakdownLocation(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Drop-off Destination (Workshop / Yard / Home)
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Supa Quick Midrand, 55 Old Pretoria Main Rd"
                                value={dropOffLocation}
                                onChange={e => setDropOffLocation(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Operational Tags */}
                    <div className="flex flex-wrap gap-4 pt-1">
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isRollback}
                                onChange={e => setIsRollback(e.target.checked)}
                                className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                            />
                            <span>Rollback / Flatbed Required</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isRecovery}
                                onChange={e => setIsRecovery(e.target.checked)}
                                className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                            />
                            <span>Off-road Recovery</span>
                        </label>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Breakdown Notes / Fault Symptoms
                        </label>
                        <textarea
                            rows={2}
                            placeholder="e.g. Engine cut out while driving on highway. Coolant leak detected."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                        ></textarea>
                    </div>

                    {/* Submit */}
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20 transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {isSubmitting ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <CheckCircle2 className="w-4 h-4" />
                            )}
                            Dispatch & Start Callout
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoadsideQuickReportModal;
