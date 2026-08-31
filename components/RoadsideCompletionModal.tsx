import React, { useState, useRef, useEffect } from 'react';
import { Report, Profile, ReportStatus } from '../types';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import { X, CheckCircle2, PenTool, Camera, Trash2, ShieldCheck, MapPin, Building } from 'lucide-react';

interface RoadsideCompletionModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: Report;
    driverProfile: Profile;
    onCompleted: () => void;
}

export const RoadsideCompletionModal: React.FC<RoadsideCompletionModalProps> = ({
    isOpen,
    onClose,
    report,
    driverProfile,
    onCompleted,
}) => {
    const { addToast } = useToast();
    const [receiverName, setReceiverName] = useState((report as any).driver_name || '');
    const [receiverRole, setReceiverRole] = useState<'Member / Owner' | 'Dealership / Workshop Advisor' | 'Tow Yard Manager' | 'Insurance Representative'>('Member / Owner');
    const [serviceSummary, setServiceSummary] = useState(
        (report as any).assistance_type || 'Roadside Assistance & Towing Completed'
    );
    const [dropOffAddress, setDropOffAddress] = useState(
        (report as any).drop_off_location || (report as any).location || ''
    );
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [evidenceImages, setEvidenceImages] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Signature Canvas state
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        // Reset signature when modal opens
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#0d9488';
            }
        }
        setHasSigned(false);
    }, [isOpen]);

    if (!isOpen) return null;

    // Canvas drawing helpers
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
        setHasSigned(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setHasSigned(false);
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

    const handleCompleteJob = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const completedTime = new Date().toISOString();
            let signatureDataUrl = '';
            if (hasSigned && canvasRef.current) {
                signatureDataUrl = canvasRef.current.toDataURL('image/png');
            }

            const completionContent = `🏁 [ROADSIDE CALLOUT RESOLUTION SIGN-OFF]\n` +
                `• Driver: ${driverProfile.first_name} ${driverProfile.surname} (${driverProfile.vehicle_reg || 'Truck'})\n` +
                `• Completed Service: ${serviceSummary}\n` +
                `• Drop-off Handover Location: ${dropOffAddress || 'On-Scene Resolution'}\n` +
                `• Received / Signed By: ${receiverName || 'Customer'} (${receiverRole})\n` +
                `• Customer Signature: ${hasSigned ? 'Signed on Mobile Device' : 'Not Signed'}\n` +
                (resolutionNotes ? `• Resolution Notes: ${resolutionNotes}\n` : '') +
                `• Completed At: ${new Date().toLocaleString()}`;

            if (supabase) {
                // 1. Update report in emergency_reports table
                await supabase
                    .from('emergency_reports')
                    .update({
                        status: ReportStatus.RESOLVED,
                        completed_at: completedTime,
                    })
                    .eq('id', report.id);

                // 2. Insert into report_updates
                await supabase.from('report_updates').insert({
                    report_id: report.id,
                    user_id: driverProfile.id,
                    content: completionContent,
                });
            }

            addToast('Roadside Callout successfully completed and signed off!', 'success');
            onCompleted();
            onClose();
        } catch (err: any) {
            console.error('Error completing roadside report:', err);
            addToast('Failed to complete report. Please try again.', 'error');
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
                        <div className="p-2.5 rounded-2xl bg-green-500/10 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                                Complete Roadside Job & Sign-off
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                CAR #{(report as any).car_number || (report as any).card_number || report.ob_number} • Final Delivery & Customer Sign-off
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

                {/* Content */}
                <form onSubmit={handleCompleteJob} className="flex-grow overflow-y-auto py-4 space-y-4 custom-scrollbar pr-1">
                    {/* Service & Receiver Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Service Rendered
                            </label>
                            <input
                                type="text"
                                value={serviceSummary}
                                onChange={e => setServiceSummary(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-green-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Receiver Role / Relation
                            </label>
                            <select
                                value={receiverRole}
                                onChange={e => setReceiverRole(e.target.value as any)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-green-500 outline-none"
                            >
                                <option value="Member / Owner">Member / Vehicle Owner</option>
                                <option value="Dealership / Workshop Advisor">Dealership / Workshop Advisor</option>
                                <option value="Tow Yard Manager">Tow Yard / Impound Manager</option>
                                <option value="Insurance Representative">Insurance / Fleet Representative</option>
                            </select>
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Handover / Drop-off Location
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <MapPin className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    value={dropOffAddress}
                                    onChange={e => setDropOffAddress(e.target.value)}
                                    placeholder="e.g. BMW Sandton Service Centre, 1 Rivonia Rd"
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-green-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Signed & Received By (Name)
                            </label>
                            <input
                                type="text"
                                value={receiverName}
                                onChange={e => setReceiverName(e.target.value)}
                                placeholder="Customer or Advisor Name"
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-green-500 outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Customer Signature Pad */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                Customer / Receiver Digital Signature
                            </label>
                            {hasSigned && (
                                <button
                                    type="button"
                                    onClick={clearSignature}
                                    className="text-xs text-red-500 hover:text-red-600 font-bold"
                                >
                                    Clear Signature
                                </button>
                            )}
                        </div>
                        <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-950 p-2 overflow-hidden shadow-inner touch-none">
                            <canvas
                                ref={canvasRef}
                                width={500}
                                height={130}
                                className="w-full h-[120px] cursor-crosshair block"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                            {!hasSigned && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400 text-xs font-semibold gap-2">
                                    <PenTool className="w-4 h-4 text-gray-400" />
                                    <span>Sign here using finger or stylus</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Final Drop-off Photos */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                Delivery / Handover Proof Photos
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

                        {evidenceImages.length > 0 && (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                                {evidenceImages.map((img, idx) => (
                                    <div key={idx} className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                        <img src={img} alt="Drop-off evidence" className="w-full h-full object-cover" />
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
                        )}
                    </div>

                    {/* Resolution Notes */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Final Resolution Notes
                        </label>
                        <textarea
                            rows={2}
                            placeholder="e.g. Vehicle safely delivered to dealership workshop bay 3, key handed to service advisor."
                            value={resolutionNotes}
                            onChange={e => setResolutionNotes(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-green-500 outline-none"
                        ></textarea>
                    </div>

                    {/* Actions */}
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
                            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20 transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {isSubmitting ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <CheckCircle2 className="w-4 h-4" />
                            )}
                            Sign-Off & Complete Callout
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoadsideCompletionModal;
