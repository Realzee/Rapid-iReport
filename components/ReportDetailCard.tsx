import React, { useState, useEffect } from 'react';
import { Report, Profile, VehicleReport } from '../types';
import StatusBadge from './StatusBadge';
import { MapPinIcon, WhatsappIcon, DownloadIcon, XIcon } from './icons';
import { format } from 'date-fns';
import { supabase } from '../utils/supabase';
import { logoUrl } from '../assets/logo';

interface ReportDetailCardProps {
    report: Report;
    onClose: () => void;
}

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const ReportDetailCard: React.FC<ReportDetailCardProps> = ({ report, onClose }) => {
    const [reporter, setReporter] = useState<Profile | null>(null);
    const [isGeneratingBolo, setIsGeneratingBolo] = useState(false);

    useEffect(() => {
        const fetchReporter = async () => {
            // FIX: Select all columns from profiles to ensure the data matches the 'Profile' type, resolving the type error on `setReporter`.
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
                // Use a proxy or server-side function if CORS is an issue. For Supabase Storage, public URLs should work.
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

        const boloHtml = `
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Roboto, sans-serif; width: 400px; height: 600px; background-color: #111827; color: white; display: flex; flex-direction: column; border: 2px solid #DC2626; border-radius: 16px; padding: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #DC2626; padding-bottom: 8px;">
                    <h1 style="color: #F87171; font-size: 24px; font-weight: bold; margin: 0; text-transform: uppercase;">Be On The Look Out</h1>
                    <img src="${logoUrl}" alt="Logo" style="height: 40px;" />
                </div>
                <div style="flex-shrink: 0; height: 200px; margin: 16px 0; background-color: #1F2937; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    ${reportImageHtml}
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
                    <div style="background-color: #374151; padding: 8px; border-radius: 8px;">
                        <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-transform: uppercase;">${isVehicleReport(report) ? 'License Plate' : 'Incident'}</p>
                        <p style="margin: 4px 0 0 0; font-size: 28px; font-weight: bold; color: #FFFFFF; letter-spacing: 2px;">${isVehicleReport(report) ? report.license_plate : report.title}</p>
                    </div>
                    ${vehicleDetailsHtml}
                    <div>
                        <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-transform: uppercase;">${isVehicleReport(report) ? 'Last Seen Location' : 'Location'}</p>
                        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 500;">${isVehicleReport(report) ? report.last_seen_location : report.location}</p>
                    </div>
                    <div>
                        <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-transform: uppercase;">OB Number</p>
                        <p style="margin: 4px 0 0 0; font-size: 14px; font-family: monospace;">${report.ob_number}</p>
                    </div>
                </div>
                <div style="margin-top: auto; padding-top: 8px; border-top: 1px solid #374151; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #9CA3AF; font-weight: bold;">REPORT SIGHTINGS IMMEDIATELY. DO NOT APPROACH.</p>
                    <p style="margin: 4px 0 0 0; font-size: 10px; color: #6B7280;">Powered by RAPID iREPORT</p>
                </div>
            </div>`;

        const svgString = `
            <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600">
                <foreignObject width="100%" height="100%">
                    ${boloHtml}
                </foreignObject>
            </svg>`;

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
            {/* Header */}
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-xl font-bold text-white truncate pr-2">{isVehicleReport(report) ? report.license_plate : report.title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 space-y-4 pr-1 -mr-1">
                {/* Image Gallery */}
                {report.evidence_images && report.evidence_images.length > 0 && (
                     <div className="grid grid-cols-2 gap-2">
                        {report.evidence_images.map((img, index) => (
                             <img key={index} src={img} alt={`Evidence ${index+1}`} className="w-full h-24 object-cover rounded-md border border-gray-700" />
                        ))}
                    </div>
                )}
                
                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-gray-400 uppercase">Status</p>
                        <StatusBadge status={report.status} />
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

                {/* Location */}
                <div>
                     <p className="text-xs text-gray-400 uppercase">{isVehicleReport(report) ? 'Last Seen Location' : 'Location'}</p>
                     <p className="text-white flex items-center gap-2"><MapPinIcon className="w-4 h-4 text-gray-400"/> {isVehicleReport(report) ? report.last_seen_location : report.location}</p>
                </div>
                 <button onClick={onClose} className="w-full text-center py-2 text-sm bg-gray-700/50 hover:bg-gray-700 rounded-lg text-blue-300 transition-colors">
                    View on Map
                </button>

                {/* Description */}
                <div>
                    <p className="text-xs text-gray-400 uppercase">Description</p>
                    <p className="text-gray-300 whitespace-pre-wrap">{report.description}</p>
                </div>

                {/* Reporter Info */}
                 {reporter && (
                    <div>
                        <p className="text-xs text-gray-400 uppercase">Reported By</p>
                        <p className="text-gray-300">{reporter.full_name} ({reporter.email})</p>
                    </div>
                 )}
            </div>

            {/* Actions */}
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