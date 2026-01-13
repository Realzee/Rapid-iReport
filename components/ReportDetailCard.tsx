import React, { useState, useEffect } from 'react';
import { Report, Profile, VehicleReport, UserRole, ReportStatus } from '../types';
import StatusBadge from './StatusBadge';
import { MapPinIcon, WhatsappIcon, DownloadIcon, XIcon } from './icons';
import { format } from 'date-fns';
import { supabase } from '../utils/supabase';
import { logoUrl } from '../assets/logo';

interface ReportDetailCardProps {
    report: Report;
    onClose: () => void;
    profile: Profile;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const ReportDetailCard: React.FC<ReportDetailCardProps> = ({ report, onClose, profile }) => {
    const [reporter, setReporter] = useState<Profile | null>(null);
    const [isGeneratingBolo, setIsGeneratingBolo] = useState(false);
    const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);

    const isAssignedResponder = profile.role === UserRole.RESPONDER && report.assigned_to === profile.id;

    // Define the status options a responder can select
    const responderStatusOptions = [
        ReportStatus.IN_PROGRESS,
        ReportStatus.RESOLVED,
    ];
    if (isVehicleReport(report)) {
        responderStatusOptions.push(ReportStatus.RECOVERED);
    }

    useEffect(() => {
        const fetchReporter = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', report.reported_by)
                .single();
            if (error) console.error("Error fetching reporter:", error);
            else setReporter(data);
        };
        fetchReporter();
    }, [report.reported_by]);

    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value as ReportStatus;
        setStatusUpdateLoading(true);

        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        const { error } = await supabase
            .from(tableName)
            .update({ status: newStatus })
            .eq('id', report.id);

        if (error) {
            alert('Failed to update status: ' + error.message);
        }
        // The UI will update automatically via the realtime subscription in Dashboard.tsx
        setStatusUpdateLoading(false);
    };

    const handleShareWhatsApp = () => {
        let text = `*RAPID iREPORT ALERT*\n\n`;
        if (isVehicleReport(report)) {
            text += `*Type:* Vehicle Theft\n`;
            text += `*License Plate:* ${report.license_plate}\n`;
            text += `*Vehicle:* ${report.vehicle_make} ${report.vehicle_model} (${report.vehicle_color})\n`;
            text += `*Last Seen:* ${report.last_seen_location}\n`;
        } else {
            text += `*Type:* Crime Incident\n`;
            text += `*Title:* ${report.title}\n`;
            text += `*Crime Type:* ${report.crime_type}\n`;
            text += `*Location:* ${report.location}\n`;
        }
        text += `*OB Number:* ${report.ob_number}\n`;
        text += `*Severity:* ${report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}\n\n`;
        text += `*Description:* ${report.description}`;
        
        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    };

    const generateBoloImage = async () => {
        setIsGeneratingBolo(true);

        const fetchImageAsDataURL = async (url: string) => {
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.error("Error fetching image for BOLO card:", error);
                return null;
            }
        };

        const imageUrl = report.evidence_images && report.evidence_images.length > 0 ? report.evidence_images[0] : null;
        const imageAsDataUrl = imageUrl ? await fetchImageAsDataURL(imageUrl) : null;

        const reportImageHtml = imageAsDataUrl
            ? `<img src="${imageAsDataUrl}" alt="Evidence" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" />`
            : `<span style="color: #9CA3AF; font-size: 16px;">No Image Available</span>`;
        
        const vehicleDetailsHtml = isVehicleReport(report) ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                <div><p style="margin: 0; font-size: 12px; color: #9CA3AF; text-transform: uppercase;">Make</p><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 500;">${report.vehicle_make}</p></div>
                <div><p style="margin: 0; font-size: 12px; color: #9CA3AF; text-transform: uppercase;">Model</p><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 500;">${report.vehicle_model}</p></div>
                <div><p style="margin: 0; font-size: 12px; color: #9CA3AF; text-transform: uppercase;">Color</p><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 500;">${report.vehicle_color}</p></div>
            </div>
        ` : '';

        const boloHtml = `...`; // BOLO HTML generation code omitted for brevity

        const svgString = `...`; // SVG generation code omitted for brevity

        const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 600;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(image, 0, 0);
                const pngUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = pngUrl;
                a.download = `bolo-${report.ob_number.replace(/\//g, '-')}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            setIsGeneratingBolo(false);
        };
        image.onerror = (e) => {
            alert("Failed to generate BOLO card image.");
            console.error("Image loading error for BOLO card:", e)
            setIsGeneratingBolo(false);
        }
        image.src = svgDataUrl;
    };


    return (
        <div className="bg-gray-900/50 border border-gray-700/50 rounded-2xl p-4 backdrop-blur-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-xl font-bold text-white truncate pr-2">{isVehicleReport(report) ? report.license_plate : report.title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1 -mr-1">
                {report.evidence_images && report.evidence_images.length > 0 && (
                     <div className="grid grid-cols-2 gap-2">
                        {report.evidence_images.map((img, index) => (
                             <img key={index} src={img} alt={`Evidence ${index+1}`} className="w-full h-24 object-cover rounded-md border border-gray-700" />
                        ))}
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-gray-400 uppercase">Status</p>
                        {isAssignedResponder ? (
                             <select
                                value={report.status}
                                onChange={handleStatusChange}
                                disabled={statusUpdateLoading}
                                className="w-full bg-gray-800 border border-gray-700 rounded-md py-1 px-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition disabled:opacity-70"
                            >
                                {/* Show current status even if not in the responder list */}
                                {!responderStatusOptions.includes(report.status) && <option value={report.status} disabled>{report.status.replace('_', ' ')}</option>}
                                {responderStatusOptions.map(status => (
                                    <option key={status} value={status}>
                                        {status.replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <StatusBadge status={report.status} />
                        )}
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase">Severity</p>
                        <p className="font-semibold text-white capitalize">{report.severity}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase">OB Number</p>
                        <p className="font-mono text-white">{report.ob_number}</p>
                    </div>
                     <div>
                        <p className="text-xs text-gray-400 uppercase">Reported</p>
                        <p className="text-white">{format(new Date(report.reported_at), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                </div>

                <div>
                     <p className="text-xs text-gray-400 uppercase">{isVehicleReport(report) ? 'Last Seen Location' : 'Location'}</p>
                     <p className="text-white flex items-center gap-2"><MapPinIcon className="w-4 h-4 text-gray-400"/> {isVehicleReport(report) ? report.last_seen_location : report.location}</p>
                </div>
                 <button onClick={onClose} className="w-full text-center py-2 text-sm bg-gray-700/50 hover:bg-gray-700 rounded-lg text-blue-300 transition-colors">
                    View on Map
                </button>

                <div>
                    <p className="text-xs text-gray-400 uppercase">Description</p>
                    <p className="text-gray-300 whitespace-pre-wrap">{report.description}</p>
                </div>

                 {reporter && (
                    <div>
                        <p className="text-xs text-gray-400 uppercase">Reported By</p>
                        <p className="text-gray-300">{reporter.full_name} ({reporter.email})</p>
                    </div>
                 )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700/50 flex-shrink-0 grid grid-cols-2 gap-3">
                <button onClick={handleShareWhatsApp} className="flex items-center justify-center gap-2 py-2 px-3 bg-green-600/80 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-semibold">
                    <WhatsappIcon className="w-5 h-5"/> Share
                </button>
                 <button onClick={generateBoloImage} disabled={isGeneratingBolo} className="flex items-center justify-center gap-2 py-2 px-3 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-wait">
                    {isGeneratingBolo ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <DownloadIcon className="w-5 h-5"/>
                    )}
                    <span>{isGeneratingBolo ? 'Generating...' : 'BOLO Card'}</span>
                </button>
            </div>
        </div>
    );
};

export default ReportDetailCard;