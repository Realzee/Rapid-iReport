
import React, { useState, useEffect, useMemo } from 'react';
import { Report, Profile, VehicleReport, AccidentReport, UserRole, ReportStatus } from '../types';
import StatusBadge from './StatusBadge';
import ReportTypeBadge from './ReportTypeBadge';
import { MapPinIcon, WhatsappIcon, DownloadIcon, XIcon, EditIcon, TrashIcon } from './icons';
import { format } from 'date-fns';
import { supabase } from '../utils/supabase';
import { logoUrl } from '../assets/logo';
import { useToast } from '../contexts/ToastContext';
import { useChat } from '../contexts/ChatContext';

interface ReportDetailCardProps {
    report: Report;
    onClose: () => void;
    profile: Profile;
    onEdit: (report: Report) => void;
    onDelete: (report: Report) => void;
    onViewOnMap: () => void;
    allUsers: Profile[];
}

const ReportDetailCard: React.FC<ReportDetailCardProps> = ({ report, onClose, profile, onEdit, onDelete, onViewOnMap, allUsers }) => {
    const [reporter, setReporter] = useState<Profile | null>(null);
    const [isGeneratingBolo, setIsGeneratingBolo] = useState(false);
    const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
    const { addToast } = useToast();
    const { openChat } = useChat();

    const canManageReport = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER].includes(profile.role);
    const isAssignedResponder = profile.role === UserRole.RESPONDER && report.assigned_to === profile.id;
    const canUpdateStatus = canManageReport || isAssignedResponder;

    const isTerminalStatus = useMemo(() => {
        return [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED, ReportStatus.REJECTED].includes(report.status);
    }, [report.status]);

    const responderStatusOptions = [
        ReportStatus.IN_PROGRESS,
        ReportStatus.RESOLVED,
    ];
    if (report.type === 'vehicle') {
        responderStatusOptions.push(ReportStatus.RECOVERED);
    }

    useEffect(() => {
        const fetchReporter = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', report.reported_by)
                .maybeSingle();
            if (error) console.error("Error fetching reporter:", error);
            else setReporter(data);
        };
        fetchReporter();
    }, [report.reported_by]);

    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value as ReportStatus;
        setStatusUpdateLoading(true);

        const tableName = report.type === 'vehicle' ? 'vehicle_reports' : (report.type === 'accident' ? 'accident_reports' : 'crime_reports');
        const { error } = await supabase
            .from(tableName)
            .update({ status: newStatus })
            .eq('id', report.id);

        if (error) {
            addToast('Failed to update status: ' + error.message, 'error');
        }
        setStatusUpdateLoading(false);
    };

    const handleShareWhatsApp = () => {
        let text = `*RAPID iREPORT ALERT*\n\n`;
        if (report.type === 'vehicle') {
            text += `*Type:* Vehicle Theft\n`;
            text += `*License Plate:* ${(report as any).license_plate}\n`;
            text += `*Vehicle:* ${(report as any).vehicle_make} ${(report as any).vehicle_model} (${(report as any).vehicle_color})\n`;
            text += `*Last Seen:* ${(report as any).last_seen_location}\n`;
        } else if (report.type === 'accident') {
            text += `*Type:* Accident Incident\n`;
            text += `*Title:* ${report.title}\n`;
            text += `*Accident Type:* ${(report as any).accident_type}\n`;
            text += `*Location:* ${(report as any).location}\n`;
        } else {
            text += `*Type:* Crime Incident\n`;
            text += `*Title:* ${report.title}\n`;
            text += `*Crime Type:* ${(report as any).crime_type}\n`;
            text += `*Location:* ${(report as any).location}\n`;
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

        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = (e) => reject(e);
                img.src = src;
            });
        };

        try {
            // 1. Prepare Data
            const imageUrl = report.evidence_images && report.evidence_images.length > 0 ? report.evidence_images[0] : null;
            const companyLogoUrl = profile.company?.logo_url;
            
            const qrCodeWwwUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://navic.cloud')}`;
            const qrCodeFbUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://facebook.com')}`;
            const whatsappIconSvg = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzI1ZDM2NiI+PHBhdGggZD0iTTE3LjQ3MiAzLjQ3OGMtMi42Ny0yLjY3MS02LjIyOC00LjEzMS0xMC4wOC00LjEzMWMtNy44NTMgMC0xNC4yNDEgNi4zODgtMTQuMjQxIDE0LjI0MmMwIDIuNTA4LjY1NSA0Ljk1NCAxLjg5OSA3LjEyM2wtMi4wMTkgNy4zNzIgNy41NDMtMS45NzhjMi4wNzcuMTEzMyA0LjQxNSAxLjczOCA2LjgxNiAxLjczOHYtLjAwMWg1LjQ1OGU3Ljg1NSAwIDE0LjI0NS02LjM5IDE0LjI0NS0xNC4yNDVjMC0zLjgwNC0xLjQ4LTYuMzc2LTQuMTQ0LTkuMDU2em0tMTAuMDggMjEuMjc1Yy0yLjExNSAwLTQuMTg4LS41Ny01Ljk5Ny0xLjYzM2wtLjQyOS0uMjUxLTQuNDU3IDEuMTY5IDEuMTg5LTQuMzQ1LS4yNzgtLjQ0MmMtMS4xNzQtMS44NjUtMS43OTMtNC4wMzEtMS43OTMtNi4yNDcgMC02LjQ5MyA1LjI4My0xMS43NzYgMTEuNzc4LTExLjc3NiA2LjQ5MSAwIDExLjc3NCA1LjI4MyAxMS43NzQgMTEuNzc2IDAgNi40OTUtNS4yODMgMTEuNzc4LTExLjc3OCAxMS43Nzh6bTYuNDQxLTguODI2Yy0uMzUzLS4xNzctMi4wODgtMS4wMjgtMi40MTEtMS4xNDctLjMyMy0uMTE4LS41NTktLjE3Ni0uNzk0LjE3Ni0uMjM1LjM1My0uOTEyIDEuMTQ3LTEuMTE4IDEuMzc5LS4yMDYuMjM1LS40MTIuMjY1LS43NjUuMDg4LS4zNTMtLjE3Ni0xLjQ5MS0uNTUtMi44MzktMS43NTItMS4wNDUtLjkzMi0xLjc1MS0yLjA4My0xLjk1Ni0yLjQzNS0uMjA2LS4zNTMtLjAyMi0uNTQ0LjE1NC0uNzIyLjE1OC0uMTU5LjM1My0uNDEyLjUyOS0uNjE4LjE3Ni0uMjA2LjIzNS0uMzUzLjM1My0uNTg4LjExOC0uMjM1LjA1OS0uNDQxLS4wMjktLjYxOC0uMDg4LS4xNzYtLjc5NC0xLjkxMi0xLjA4OC0yLjYxOC0uMjg3LS42ODUtLjU4MS0uNTkzLS43OTQtLjYwM2wtLjY3Ni0uMDE1Yy0uMjM1IDAtLjYxOC4wODgtLjk0MS40NDEtLjMyMy4zNTMtMS4yMzUgMS4yMDYtMS4yMzUgMi45NDFzMS4yNjUgMi45NDEgMS40NDEgMy4xNzZjLjE3Ni4yMzUgMi40ODggMy43OTYgNi4wMjkgNS4zMjIuODQxLjM2MiAxLjQ5OC41NzggMi4wMDcuNzQxLjg1My4yNzIgMS42My4yMzQgMi4yNDQuMTQyLjY4NS0uMTAzIDIuMDg4LS44NTMgMi4zODItMS42NzYuMjk0LS48MjMuMjk0LTEuNTI9LjIwNi0xLjY3Ni0uMDg4LS4xNDctLjMyMy0uMjM1LS42NzYtLjQxMXoiLz48L3N2Zz4=`;

            // 2. Fetch all images as Data URLs in parallel
            const [
                mainImageDataUrl,
                companyLogoDataUrl,
                qrWwwDataUrl,
                qrFbDataUrl
            ] = await Promise.all([
                imageUrl ? fetchImageAsDataURL(imageUrl) : Promise.resolve(null),
                companyLogoUrl ? fetchImageAsDataURL(companyLogoUrl) : Promise.resolve(null),
                fetchImageAsDataURL(qrCodeWwwUrl),
                fetchImageAsDataURL(qrCodeFbUrl)
            ]);

            // 3. Load images into HTMLImageElements
            const [mainImage, companyLogo, qrWww, qrFb, whatsappIcon] = await Promise.all([
                mainImageDataUrl ? loadImage(mainImageDataUrl) : Promise.resolve(null),
                companyLogoDataUrl ? loadImage(companyLogoDataUrl) : loadImage(logoUrl),
                qrWwwDataUrl ? loadImage(qrWwwDataUrl) : Promise.resolve(null),
                qrFbDataUrl ? loadImage(qrFbDataUrl) : Promise.resolve(null),
                loadImage(whatsappIconSvg)
            ]);

            // 4. Setup Canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Could not get canvas context");

            const width = 580;
            const height = 820;
            canvas.width = width;
            canvas.height = height;

            // 5. Draw Background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            // 6. Draw Header
            ctx.fillStyle = '#EF4444';
            ctx.fillRect(0, 0, width, 110);
            ctx.strokeStyle = '#991B1B';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 110);
            ctx.lineTo(width, 110);
            ctx.stroke();

            // Header Text
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            
            ctx.font = 'bold 18px Arial, sans-serif';
            ctx.fillText('Rapid 911 Rapid Rescue PTY (Ltd)', width / 2, 35);

            ctx.font = '900 72px Impact, sans-serif';
            ctx.fillText('SOUGHT VEHICLE', width / 2, 95);

            // 7. Draw Main Image Area
            const imgY = 110;
            const imgHeight = 400;
            ctx.fillStyle = '#333333';
            ctx.fillRect(0, imgY, width, imgHeight);

            if (mainImage) {
                // Simulate object-fit: cover
                const imgRatio = mainImage.width / mainImage.height;
                const areaRatio = width / imgHeight;
                
                let drawWidth, drawHeight, offsetX, offsetY;

                if (imgRatio > areaRatio) {
                    drawHeight = imgHeight;
                    drawWidth = imgHeight * imgRatio;
                    offsetX = (width - drawWidth) / 2;
                    offsetY = 0;
                } else {
                    drawWidth = width;
                    drawHeight = width / imgRatio;
                    offsetX = 0;
                    offsetY = (imgHeight - drawHeight) / 2;
                }
                
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, imgY, width, imgHeight);
                ctx.clip();
                ctx.drawImage(mainImage, offsetX, imgY + offsetY, drawWidth, drawHeight);
                ctx.restore();
            } else {
                ctx.fillStyle = '#666666';
                ctx.font = 'bold 24px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('NO IMAGE AVAILABLE', width / 2, imgY + imgHeight / 2 + 8);
            }

            // Recovered Stamp
            const isRecovered = ['recovered', 'resolved'].includes(report.status);
            if (isRecovered) {
                ctx.save();
                ctx.translate(width / 2, imgY + imgHeight / 2);
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                const stampText = 'RECOVERED';
                ctx.font = '900 90px Impact, sans-serif';
                const textMetrics = ctx.measureText(stampText);
                const textWidth = textMetrics.width;
                const textHeight = 90; // Approx
                
                // Background box for stamp
                ctx.fillRect(-textWidth/2 - 20, -textHeight/2 + 10, textWidth + 40, textHeight);
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#000000';
                ctx.strokeRect(-textWidth/2 - 20, -textHeight/2 + 10, textWidth + 40, textHeight);

                ctx.fillStyle = '#FFFF00';
                ctx.shadowColor = '#000000';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 4;
                ctx.shadowOffsetY = 4;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(stampText, 0, 15); // Adjustment for baseline
                ctx.restore();
            }

            // 8. Draw Details Section
            const detailsY = imgY + imgHeight + 25;
            const leftMargin = 30;
            
            ctx.textAlign = 'left';
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '28px Arial, sans-serif';
            const lineHeight = 40;

            const statusText = isRecovered ? 'RECOVERED' : (report.status === 'active' || report.status === 'assigned' || report.status === 'in_progress' || report.status === 'on_scene' ? 'HIJACKED' : report.status.toUpperCase());
            const reg = report.type === 'vehicle' ? (report as any).license_plate : 'N/A';
            const make = report.type === 'vehicle' ? (report as any).vehicle_make : 'N/A';
            const model = report.type === 'vehicle' ? (report as any).vehicle_model : 'N/A';
            const color = report.type === 'vehicle' ? (report as any).vehicle_color : 'N/A';
            const caseNumber = report.cas_number ? `${report.station_name || ''} ${report.cas_number}` : 'N/A';

            const drawField = (label: string, value: string, y: number) => {
                ctx.font = 'normal 28px Arial, sans-serif';
                const labelWidth = ctx.measureText(label).width;
                ctx.fillText(label, leftMargin, y);
                
                ctx.font = 'bold 28px Arial, sans-serif';
                ctx.fillText(value, leftMargin + labelWidth + 10, y);
            };

            drawField('Status:', statusText, detailsY);
            drawField('Reg:', reg, detailsY + lineHeight);
            drawField('Make:', make, detailsY + lineHeight * 2);
            drawField('Type:', model, detailsY + lineHeight * 3);
            drawField('Colour:', color, detailsY + lineHeight * 4);
            drawField('Case:', caseNumber, detailsY + lineHeight * 5);

            // 9. Draw QR Codes
            const qrY = detailsY - 5;
            const qrX = width - 30 - 120; // Right margin 30, width 120
            
            const drawQr = (img: HTMLImageElement | null, y: number) => {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(qrX - 5, y - 5, 130, 130); // White padding
                if (img) {
                    ctx.drawImage(img, qrX, y, 120, 120);
                }
            };

            drawQr(qrWww, qrY);
            drawQr(qrFb, qrY + 140);

            // 10. Draw Footer
            const footerY = height - 160;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FFFFFF';
            
            ctx.font = '500 18px Arial, sans-serif';
            ctx.fillText('If spotted please contact SAPS Crime Stop on 08600', width / 2, footerY);
            ctx.fillText('10111 or your nearest SAPS Station', width / 2, footerY + 22);

            ctx.font = 'bold 22px serif';
            ctx.fillText('"Working TOGETHER we are STRONGER"', width / 2, footerY + 60);

            // Logos and Contact
            const bottomY = height - 80;
            const logoWidth = 120;
            const logoHeight = 70;
            const logoY = bottomY - logoHeight / 2;

            // Helper to draw logo contained
            const drawLogo = (img: HTMLImageElement | null, x: number) => {
                ctx.fillStyle = '#000000';
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 1;
                ctx.fillRect(x, logoY, logoWidth, logoHeight);
                ctx.strokeRect(x, logoY, logoWidth, logoHeight);

                if (img) {
                    const imgRatio = img.width / img.height;
                    const areaRatio = logoWidth / logoHeight;
                    let dw, dh, dx, dy;

                    if (imgRatio > areaRatio) {
                        dw = logoWidth;
                        dh = logoWidth / imgRatio;
                        dx = x;
                        dy = logoY + (logoHeight - dh) / 2;
                    } else {
                        dh = logoHeight;
                        dw = logoHeight * imgRatio;
                        dy = logoY;
                        dx = x + (logoWidth - dw) / 2;
                    }
                    ctx.drawImage(img, dx, dy, dw, dh);
                }
            };

            // Left Logo
            drawLogo(companyLogo, 20);

            // Right Logo
            drawLogo(companyLogo, width - 20 - logoWidth);

            // Center Contact
            if (whatsappIcon) {
                ctx.drawImage(whatsappIcon, width / 2 - 25, bottomY - 45, 50, 50);
            }
            ctx.font = 'bold 28px Arial, sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('062 031 3134', width / 2, bottomY + 30);

            // 11. Export
            const pngUrl = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = `bolo-${report.ob_number.replace(/\//g, '-')}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setIsGeneratingBolo(false);

        } catch (error) {
            console.error("BOLO Generation Error:", error);
            addToast("Failed to generate BOLO card. " + (error as Error).message, 'error');
            setIsGeneratingBolo(false);
        }
    };

    return (
        <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg dark:shadow-none transition-colors duration-300 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <ReportTypeBadge type={report.type as any} className="p-1.5" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate pr-2">{report.type === 'vehicle' ? (report as any).license_plate : report.title}</h3>
                </div>
                <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-grow">
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
                                disabled={statusUpdateLoading || isTerminalStatus}
                                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md py-1 px-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition disabled:opacity-70"
                            >
                                <option value={ReportStatus.PENDING}>Pending</option>
                                <option value={ReportStatus.ACTIVE}>Active</option>
                                <option value={ReportStatus.IN_PROGRESS}>In Progress</option>
                                <option value={ReportStatus.RESOLVED}>Resolved</option>
                                <option value={ReportStatus.REJECTED}>Rejected</option>
                                {report.type === 'vehicle' && <option value={ReportStatus.RECOVERED}>Recovered</option>}
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
                    {report.cas_number && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">CAS Number</p>
                            <p className="text-gray-900 dark:text-white">{report.cas_number}</p>
                        </div>
                    )}
                    {report.station_name && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Station</p>
                            <p className="text-gray-900 dark:text-white">{report.station_name}</p>
                        </div>
                    )}
                    {report.type === 'vehicle' && (report as any).vin_number && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">VIN</p>
                            <p className="text-gray-900 dark:text-white">{(report as any).vin_number}</p>
                        </div>
                    )}
                    {report.type === 'vehicle' && (report as any).engine_number && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Engine</p>
                            <p className="text-gray-900 dark:text-white">{(report as any).engine_number}</p>
                        </div>
                    )}
                </div>

                <div>
                     <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{report.type === 'vehicle' ? 'Last Seen Location' : 'Location'}</p>
                     <p className="text-gray-900 dark:text-white flex items-center gap-2"><MapPinIcon className="w-4 h-4 text-gray-400 dark:text-gray-500"/> {report.type === 'vehicle' ? (report as any).last_seen_location : (report as any).location}</p>
                </div>
                 <button 
                    onClick={onViewOnMap} 
                    disabled={!report.location_coords}
                    className="w-full text-center py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700/50 dark:hover:bg-gray-700 rounded-lg text-blue-600 dark:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    View on Map
                </button>

                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Description</p>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{report.description}</p>
                </div>

                 {reporter && (
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Reported By</p>
                        <p className="text-gray-700 dark:text-gray-300">{reporter.first_name} {reporter.surname} ({reporter.email})</p>
                    </div>
                 )}
            </div>

            {[ReportStatus.ACTIVE, ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE].includes(report.status) && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
                     <button onClick={() => openChat(report)} className="w-full py-2 px-4 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900 transition disabled:opacity-50">
                        Open Live Chat
                    </button>
                </div>
            )}

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
                    <button onClick={() => onEdit(report)} disabled={isTerminalStatus} className="flex items-center justify-center gap-2 py-2 px-3 bg-gray-600/90 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                        <EditIcon className="w-5 h-5"/> Edit
                    </button>
                    <button onClick={() => onDelete(report)} disabled={isTerminalStatus} className="flex items-center justify-center gap-2 py-2 px-3 bg-red-600/90 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                        <TrashIcon className="w-5 h-5"/> Delete
                    </button>
                </div>
            )}
        </div>
    );
};

export default ReportDetailCard;
