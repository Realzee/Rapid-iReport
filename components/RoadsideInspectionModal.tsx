import React, { useState } from 'react';
import { Report, Profile } from '../types';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import { X, Camera, CheckSquare, Square, AlertTriangle, ShieldCheck, Upload, Trash2 } from 'lucide-react';

interface RoadsideInspectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: Report;
    driverProfile: Profile;
    onInspectionSaved?: () => void;
}

export const RoadsideInspectionModal: React.FC<RoadsideInspectionModalProps> = ({
    isOpen,
    onClose,
    report,
    driverProfile,
    onInspectionSaved,
}) => {
    const { addToast } = useToast();
    const [odometer, setOdometer] = useState('');
    const [fuelLevel, setFuelLevel] = useState('50%');
    const [keysReceived, setKeysReceived] = useState(true);
    const [gearInNeutral, setGearInNeutral] = useState(true);
    const [handbrakeReleased, setHandbrakeReleased] = useState(true);
    const [lockingWheelNutPresent, setLockingWheelNutPresent] = useState(true);
    const [drivetrainAwd, setDrivetrainAwd] = useState(false);
    
    // Checklist of pre-existing damages
    const [damages, setDamages] = useState<{ [key: string]: boolean }>({
        'Front Bumper Scratch/Dent': false,
        'Rear Bumper Scratch/Dent': false,
        'Left Front Fender / Door': false,
        'Right Front Fender / Door': false,
        'Left Rear Quarter / Door': false,
        'Right Rear Quarter / Door': false,
        'Windshield Chip / Crack': false,
        'Alloy Wheel / Rim Curb Rash': false,
        'Underbody / Sump Scrape': false,
    });

    const [generalNotes, setGeneralNotes] = useState('');
    const [evidenceImages, setEvidenceImages] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const toggleDamage = (key: string) => {
        setDamages(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files: File[] = Array.from(e.target.files);
        files.forEach((file: File) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    setEvidenceImages(prev => [...prev, event.target!.result as string]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (index: number) => {
        setEvidenceImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const activeDamages = Object.keys(damages).filter(k => damages[k]);
            const damageSummary = activeDamages.length > 0
                ? activeDamages.join(', ')
                : 'No pre-existing exterior damage noted.';

            const inspectionText = `📋 [PRE-SERVICE VEHICLE INSPECTION]\n` +
                `• Driver: ${driverProfile.first_name} ${driverProfile.surname} (${driverProfile.vehicle_reg || 'Truck'})\n` +
                `• Odometer: ${odometer || 'Not Recorded'} km | Fuel: ${fuelLevel}\n` +
                `• Keys Received: ${keysReceived ? 'Yes' : 'No'} | Gear Neutral: ${gearInNeutral ? 'Yes' : 'No'} | Drivetrain AWD/4x4: ${drivetrainAwd ? 'Yes (Flatbed required)' : '2WD/Normal'}\n` +
                `• Locking Wheel Nut Key: ${lockingWheelNutPresent ? 'Present' : 'Missing/Not Found'}\n` +
                `• Pre-existing Damages: ${damageSummary}\n` +
                (generalNotes ? `• Additional Notes: ${generalNotes}\n` : '');

            if (supabase) {
                // Insert into report_updates
                await supabase.from('report_updates').insert({
                    report_id: report.id,
                    user_id: driverProfile.id,
                    content: inspectionText,
                });
            }

            addToast('Pre-service vehicle inspection recorded successfully.', 'success');
            if (onInspectionSaved) onInspectionSaved();
            onClose();
        } catch (err: any) {
            console.error('Error saving inspection:', err);
            addToast('Failed to save inspection. Please try again.', 'error');
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
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                                Pre-Service / Pre-Tow Inspection
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                CAR #{(report as any).car_number || (report as any).card_number || report.ob_number} • {(report as any).vehicle_make || ''} {(report as any).vehicle_model || ''}
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

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto py-4 space-y-5 custom-scrollbar pr-1">
                    {/* Quick Specs */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Odometer Reading (km)
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. 124,500"
                                value={odometer}
                                onChange={e => setOdometer(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Fuel Level
                            </label>
                            <select
                                value={fuelLevel}
                                onChange={e => setFuelLevel(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                            >
                                <option value="Empty / Reserve">Empty / Reserve</option>
                                <option value="25% (1/4)">25% (1/4)</option>
                                <option value="50% (Half)">50% (Half)</option>
                                <option value="75% (3/4)">75% (3/4)</option>
                                <option value="100% (Full)">100% (Full)</option>
                            </select>
                        </div>

                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Drivetrain Type
                            </label>
                            <div className="flex items-center gap-2 pt-1">
                                <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={drivetrainAwd}
                                        onChange={e => setDrivetrainAwd(e.target.checked)}
                                        className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                                    />
                                    <span>AWD / 4x4 (Flatbed Only)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Operational Safety Checks */}
                    <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2">
                            Pre-Tow Safety Checks
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-2xl border border-gray-200 dark:border-gray-700">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-800 dark:text-gray-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={keysReceived}
                                    onChange={e => setKeysReceived(e.target.checked)}
                                    className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                                />
                                <span>Ignition Key Handed Over by Driver</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-800 dark:text-gray-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={gearInNeutral}
                                    onChange={e => setGearInNeutral(e.target.checked)}
                                    className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                                />
                                <span>Transmission in Neutral / Free Rolling</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-800 dark:text-gray-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={handbrakeReleased}
                                    onChange={e => setHandbrakeReleased(e.target.checked)}
                                    className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                                />
                                <span>Handbrake Functional / Disengaged</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-800 dark:text-gray-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={lockingWheelNutPresent}
                                    onChange={e => setLockingWheelNutPresent(e.target.checked)}
                                    className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                                />
                                <span>Locking Wheel Nut Key in Vehicle</span>
                            </label>
                        </div>
                    </div>

                    {/* Pre-Existing Body Damages Checklist */}
                    <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2">
                            Pre-Existing Exterior Scratches & Dents
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.keys(damages).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => toggleDamage(item)}
                                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs font-medium transition ${
                                        damages[item]
                                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-900 dark:text-amber-300 font-bold'
                                            : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {damages[item] ? (
                                        <CheckSquare className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                    ) : (
                                        <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    )}
                                    <span className="truncate">{item}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Inspection Photos */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                Before-Service Inspection Photos
                            </p>
                            <label className="cursor-pointer flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline">
                                <Camera className="w-4 h-4" />
                                <span>Add Photo</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        {evidenceImages.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {evidenceImages.map((img, idx) => (
                                    <div key={idx} className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                        <img src={img} alt="Inspection evidence" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition shadow"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <label className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-teal-500 dark:hover:border-teal-500 transition text-center bg-gray-50/50 dark:bg-gray-800/30">
                                <Camera className="w-6 h-6 text-gray-400" />
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    Take photos of vehicle (4 corners, license plate, existing damages)
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>

                    {/* Additional Notes */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Additional Driver Notes / Observations
                        </label>
                        <textarea
                            rows={2}
                            placeholder="e.g. Front right tire shredded, vehicle loaded onto flatbed bed using winch."
                            value={generalNotes}
                            onChange={e => setGeneralNotes(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                        ></textarea>
                    </div>

                    {/* Action Buttons */}
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
                                <ShieldCheck className="w-4 h-4" />
                            )}
                            Save Inspection Log
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoadsideInspectionModal;
