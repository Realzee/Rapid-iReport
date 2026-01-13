
import React, { useState, useEffect } from 'react';
import { Report, Profile, VehicleReport, UserRole, ReportStatus } from '../types';
import StatusBadge from './StatusBadge';
import { MapPinIcon, WhatsappIcon, DownloadIcon, XIcon, EditIcon, TrashIcon } from './icons';
import { format } from 'date-fns';
import { supabase } from '../utils/supabase';
import { logoUrl } from '../assets/logo';

interface ReportDetailCardProps {
    report: Report;
    onClose: () => void;
    profile: Profile;
    onEdit: (report: Report) => void;
    onDelete: (report: Report) => void;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const ReportDetailCard: React.FC<ReportDetailCardProps> = ({ report, onClose, profile, onEdit, onDelete }) => {
    const [reporter, setReporter] = useState<Profile | null>(null);
    const [isGeneratingBolo, setIsGeneratingBolo] = useState(false);
    const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);

    const canManageReport = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER].includes(profile.role);
    const isAssignedResponder = profile.role === UserRole.RESPONDER && report.assigned_to === profile.id;
    const canUpdateStatus = canManageReport || isAssignedResponder;

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
                if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
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
            ? `<img src="${imageAsDataUrl}" alt="Evidence" style="width: 100%; height: 100%; object-fit: cover;" />`
            : `<span style="color: #9CA3AF; font-size: 16px;">No Image Available</span>`;
        
        const vehicleDetailsHtml = isVehicleReport(report) ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                <div><p style="margin: 0; font-size: 12px; color: #9CA3AF; text-transform: uppercase; font-weight: 500;">Make</p><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #F9FAFB;">${report.vehicle_make}</p></div>
                <div><p style="margin: 0; font-size: 12px; color: #9CA3AF; text-transform: uppercase; font-weight: 500;">Model</p><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #F9FAFB;">${report.vehicle_model}</p></div>
                <div><p style="margin: 0; font-size: 12px; color: #9CA3AF; text-transform: uppercase; font-weight: 500;">Color</p><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #F9FAFB;">${report.vehicle_color}</p></div>
            </div>
        ` : '';

        const boloHtml = `
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; flex-direction: column; width: 380px; height: 580px; background-color: #111827; color: #E5E7EB; border-radius: 12px; padding: 20px; border: 1px solid #374151; box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #EF4444; padding-bottom: 12px; margin-bottom: 12px;">
                    <h1 style="font-size: 28px; font-weight: 700; color: #F9FAFB; margin: 0; text-transform: uppercase;">BOLO Alert</h1>
                    <img src="${logoUrl}" alt="Logo" style="width: 50px; height: auto;" />
                </div>
                <div style="width: 100%; height: 200px; background-color: #1F2937; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    ${reportImageHtml}
                </div>
                <div style="background-color: #1F2937; padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px;">${isVehicleReport(report) ? 'License Plate' : 'Incident'}</p>
                    <p style="margin: 4px 0 0 0; font-size: 28px; font-weight: 700; letter-spacing: 2px; color: #FBBF24;">${isVehicleReport(report) ? report.license_plate : report.title}</p>
                </div>
                ${vehicleDetailsHtml}
                <div style="flex-grow: 1; min-height: 50px;">
                    <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-transform: uppercase; margin-bottom: 6px; font-weight: 500;">Details</p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #D1D5DB; max-height: 60px; overflow: hidden;">
                        ${report.description}
                    </p>
                </div>
                <div style="border-top: 1px solid #374151; padding-top: 12px; margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #6B7280; font-family: monospace;">
                    <span>OB: ${report.ob_number}</span>
                    <span>${format(new Date(report.reported_at), 'yyyy-MM-dd HH:mm')}</span>
                </div>
            </div>`;

        const svgString = `<svg width="400" height="600" xmlns="http://www.w3.org/2000/svg"><foreignObject width="400" height="600">${boloHtml.replace(/#/g, '%23')}</foreignObject></svg>`;
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
            alert("Failed to generate BOLO card image. Check console for errors.");
            console.error("Image loading error for BOLO card. This could be due to a malformed data URL or browser security policies.", e)
            setIsGeneratingBolo(false);
        }
        image.src = svgDataUrl;
    };

    return (
        <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg h-full flex flex-col shadow-lg dark:shadow-none transition-colors duration-300">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate pr-2">{isVehicleReport(report) ? report.license_plate : report.title}</h3>
                <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1 -mr-1">
                {report.evidence_images && report.evidence_images.length > 0 && (
                     <div className="grid grid-cols-2 gap-2">
                        {report.evidence_images.map((img, index) => (
                             <img key={index} src={img} alt={`Evidence ${index+1}`} className="w-full h-24 object-cover rounded-md border border-gray-200 dark:border-gray-700" />
                        ))}
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Status</p>
                        {canUpdateStatus ? (
                             <select
                                value={report.status}
                                onChange={handleStatusChange}
                                disabled={statusUpdateLoading}
                                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md py-1 px-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition disabled:opacity-70"
                            >
                                <option value={ReportStatus.PENDING}>Pending</option>
                                <option value={ReportStatus.ACTIVE}>Active</option>
                                <option value={ReportStatus.IN_PROGRESS}>In Progress</option>
                                <option value={ReportStatus.RESOLVED}>Resolved</option>
                                <option value={ReportStatus.REJECTED}>Rejected</option>
                                {isVehicleReport(report) && <option value={ReportStatus.RECOVERED}>Recovered</option>}
                            </select>
                        ) : (
                            <StatusBadge status={report.status} />
                        )}
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Severity</p>
                        <p className="font-semibold text-gray-900 dark:text-white capitalize">{report.severity}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">OB Number</p>
                        <p className="font-mono text-gray-900 dark:text-white">{report.ob_number}</p>
                    </div>
                     <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Reported</p>
                        <p className="text-gray-900 dark:text-white">{format(new Date(report.reported_at), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                </div>

                <div>
                     <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{isVehicleReport(report) ? 'Last Seen Location' : 'Location'}</p>
                     <p className="text-gray-900 dark:text-white flex items-center gap-2"><MapPinIcon className="w-4 h-4 text-gray-400 dark:text-gray-500"/> {isVehicleReport(report) ? report.last_seen_location : report.location}</p>
                </div>
                 <button onClick={onClose} className="w-full text-center py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/50 dark:hover:bg-gray-700 rounded-lg text-blue-600 dark:text-blue-300 transition-colors">
                    View on Map
                </button>

                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Description</p>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{report.description}</p>
                </div>

                 {reporter && (
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Reported By</p>
                        <p className="text-gray-700 dark:text-gray-300">{reporter.full_name} ({reporter.email})</p>
                    </div>
                 )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50 flex-shrink-0 grid grid-cols-2 gap-3">
                <button onClick={handleShareWhatsApp} className="flex items-center justify-center gap-2 py-2 px-3 bg-green-600/90 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-semibold">
                    <WhatsappIcon className="w-5 h-5"/> Share
                </button>
                 <button onClick={generateBoloImage} disabled={isGeneratingBolo} className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-wait">
                    {isGeneratingBolo ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <DownloadIcon className="w-5 h-5"/>
                    )}
                    <span>{isGeneratingBolo ? 'Generating...' : 'BOLO Card'}</span>
                </button>
            </div>
            {canManageReport && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50 flex-shrink-0 grid grid-cols-2 gap-3">
                    <button onClick={() => onEdit(report)} className="flex items-center justify-center gap-2 py-2 px-3 bg-gray-600/90 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-semibold">
                        <EditIcon className="w-5 h-5"/> Edit
                    </button>
                    <button onClick={() => onDelete(report)} className="flex items-center justify-center gap-2 py-2 px-3 bg-red-600/90 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-semibold">
                        <TrashIcon className="w-5 h-5"/> Delete
                    </button>
                </div>
            )}
        </div>
    );
};

export default ReportDetailCard;