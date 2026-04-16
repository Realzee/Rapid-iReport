
import React, { useState, useEffect, useMemo } from 'react';
import { Report, Profile, VehicleReport, EmergencyReport, UserRole, ReportStatus } from '../types';
import StatusBadge from './StatusBadge';
import ReportTypeBadge from './ReportTypeBadge';
import { MapPinIcon, WhatsappIcon, DownloadIcon, XIcon, EditIcon, TrashIcon } from './icons';
import { format } from 'date-fns';
import { supabase } from '../utils/supabase';
import { logoUrl } from '../assets/logo';
import { useToast } from '../contexts/ToastContext';
import { useChat } from '../contexts/ChatContext';
import { useSettings } from '../contexts/SettingsContext';

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
    const [localReport, setLocalReport] = useState<Report>(report);
    const [isGeneratingBolo, setIsGeneratingBolo] = useState(false);
    const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
    const { addToast } = useToast();
    const { openChat } = useChat();
    const { mainLogoUrl } = useSettings();

    useEffect(() => {
        setLocalReport(report);
    }, [report]);

    useEffect(() => {
        const fetchLatestReport = async () => {
            const tableName = localReport.type === 'vehicle' ? 'vehicle_reports' : (localReport.type === 'emergency' ? 'emergency_reports' : 'crime_reports');
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('id', localReport.id)
                .single();
            
            if (data) {
                setLocalReport({ ...data, type: localReport.type });
            }
        };
        fetchLatestReport();
    }, [localReport.id, localReport.type]);

    const canManageReport = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER].includes(profile.role);
    const isAssignedResponder = profile.role === UserRole.RESPONDER && localReport.assigned_to === profile.id;
    const canUpdateStatus = canManageReport || isAssignedResponder;

    const isTerminalStatus = useMemo(() => {
        return [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED, ReportStatus.REJECTED].includes(localReport.status);
    }, [localReport.status]);

    const responderStatusOptions = [
        ReportStatus.IN_PROGRESS,
        ReportStatus.RESOLVED,
    ];
    if (localReport.type === 'vehicle') {
        responderStatusOptions.push(ReportStatus.RECOVERED);
    }

    useEffect(() => {
        const fetchReporter = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', localReport.reported_by)
                .maybeSingle();
            if (error) console.error("Error fetching reporter:", error);
            else setReporter(data);
        };
        fetchReporter();
    }, [localReport.reported_by]);

    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value as ReportStatus;
        setStatusUpdateLoading(true);

        const tableName = localReport.type === 'vehicle' ? 'vehicle_reports' : (localReport.type === 'emergency' ? 'emergency_reports' : 'crime_reports');
        const { error } = await supabase
            .from(tableName)
            .update({ status: newStatus })
            .eq('id', localReport.id);

        if (error) {
            addToast('Failed to update status: ' + error.message, 'error');
        } else {
            // Update local state immediately
            setLocalReport(prev => ({ ...prev, status: newStatus }));
        }
        setStatusUpdateLoading(false);
    };

    const handleShareWhatsApp = () => {
        generateBoloImage('share');
    };

    const generateBoloImage = async (action: 'download' | 'share' = 'download') => {
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

        const loadImage = (src: string): Promise<HTMLImageElement | null> => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => {
                    console.warn(`Failed to load image: ${src}`);
                    resolve(null);
                };
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
                qrFbDataUrl,
                whatsappDataUrl,
                rapidLogoDataUrl
            ] = await Promise.all([
                imageUrl ? fetchImageAsDataURL(imageUrl) : Promise.resolve(null),
                companyLogoUrl ? fetchImageAsDataURL(companyLogoUrl) : Promise.resolve(null),
                fetchImageAsDataURL(qrCodeWwwUrl),
                fetchImageAsDataURL(qrCodeFbUrl),
                fetchImageAsDataURL('https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg'),
                fetchImageAsDataURL(mainLogoUrl)
            ]);

            // 3. Load images into HTMLImageElements
            const [mainImage, companyLogo, qrWww, qrFb, whatsappIcon, rapidLogo] = await Promise.all([
                mainImageDataUrl ? loadImage(mainImageDataUrl) : Promise.resolve(null),
                companyLogoDataUrl ? loadImage(companyLogoDataUrl) : loadImage(logoUrl),
                qrWwwDataUrl ? loadImage(qrWwwDataUrl) : Promise.resolve(null),
                qrFbDataUrl ? loadImage(qrFbDataUrl) : Promise.resolve(null),
                whatsappDataUrl ? loadImage(whatsappDataUrl) : Promise.resolve(null),
                rapidLogoDataUrl ? loadImage(rapidLogoDataUrl) : Promise.resolve(null)
            ]);

            // 4. Setup Canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Could not get canvas context");

            const width = 580;
            const height = 900;
            canvas.width = width;
            canvas.height = height;

            // 5. Draw Background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            // 6. Draw Header
            ctx.fillStyle = '#EF4444';
            ctx.fillRect(0, 0, width, 120);
            ctx.strokeStyle = '#991B1B';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 120);
            ctx.lineTo(width, 120);
            ctx.stroke();

            // Header Text
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText('SA Stolen And Highjacked Vehicles (Pty)Ltd', width / 2, 35);
            
            ctx.fillStyle = '#000000';
            ctx.font = '900 60px Impact, sans-serif';
            const headerTitle = report.type === 'vehicle' ? 'SOUGHT VEHICLE' : (report.title || report.type.toUpperCase() + ' INCIDENT');
            let truncatedHeader = headerTitle;
            const maxHeaderWidth = width - 40; // 20 padding on each side
            if (ctx.measureText(truncatedHeader).width > maxHeaderWidth) {
                while (ctx.measureText(truncatedHeader + '...').width > maxHeaderWidth && truncatedHeader.length > 0) {
                    truncatedHeader = truncatedHeader.slice(0, -1);
                }
                truncatedHeader += '...';
            }
            ctx.fillText(truncatedHeader, width / 2, 90);
            ctx.textBaseline = 'alphabetic';

            // 7. Draw Main Image Area
            const imgY = 120;
            const imgHeight = 290;
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
            ctx.font = '24px Arial, sans-serif';
            const lineHeight = 35;

            const statusText = isRecovered ? 'RECOVERED' : (report.status === 'active' || report.status === 'assigned' || report.status === 'in_progress' || report.status === 'on_scene' ? 'HIJACKED' : report.status.toUpperCase());
            
            const drawField = (label: string, value: string, y: number) => {
                ctx.font = 'normal 24px Arial, sans-serif';
                const labelWidth = ctx.measureText(label).width;
                ctx.fillText(label, leftMargin, y);
                
                ctx.font = 'bold 24px Arial, sans-serif';
                const maxWidth = width - leftMargin - labelWidth - 10 - 30; // 30 for padding
                let truncatedValue = value;
                if (ctx.measureText(value).width > maxWidth) {
                    while (ctx.measureText(truncatedValue + '...').width > maxWidth && truncatedValue.length > 0) {
                        truncatedValue = truncatedValue.slice(0, -1);
                    }
                    truncatedValue += '...';
                }
                ctx.fillText(truncatedValue, leftMargin + labelWidth + 10, y);
            };

            drawField('Status:', statusText, detailsY);

            if (report.type === 'vehicle') {
                drawField('Reg:', (report as any).license_plate || 'N/A', detailsY + lineHeight);
                drawField('Make:', (report as any).vehicle_make || 'N/A', detailsY + lineHeight * 2);
                drawField('Type:', (report as any).vehicle_model || 'N/A', detailsY + lineHeight * 3);
                drawField('Colour:', (report as any).vehicle_color || 'N/A', detailsY + lineHeight * 4);
                drawField('Case:', (report as any).cas_number || 'N/A', detailsY + lineHeight * 5);
                drawField('Station:', (report as any).station_name || 'N/A', detailsY + lineHeight * 6);
            } else {
                drawField('Location:', (report as any).location || 'N/A', detailsY + lineHeight);
                drawField('Case:', (report as any).cas_number || 'N/A', detailsY + lineHeight * 2);
                drawField('Station:', (report as any).station_name || 'N/A', detailsY + lineHeight * 3);
                
                ctx.font = 'normal 24px Arial, sans-serif';
                ctx.fillText('Description:', leftMargin, detailsY + lineHeight * 4);
                ctx.font = 'bold 24px Arial, sans-serif';
                
                const description = (report as any).description || 'N/A';
                const words = description.split(' ');
                let line = '';
                let y = detailsY + lineHeight * 5;
                for (let i = 0; i < words.length; i++) {
                    let testLine = line + words[i] + ' ';
                    let metrics = ctx.measureText(testLine);
                    if (metrics.width > width - leftMargin * 2 && i > 0) {
                        ctx.fillText(line, leftMargin, y);
                        line = words[i] + ' ';
                        y += lineHeight;
                    } else {
                        line = testLine;
                    }
                }
                ctx.fillText(line, leftMargin, y);
            }

            // 9. Draw QR Codes
            const qrY = detailsY - 5;
            const qrX = width - 30 - 80; // Right margin 30, width 80
            
            const drawQr = (img: HTMLImageElement | null, y: number) => {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(qrX - 5, y - 5, 90, 90); // White padding
                if (img) {
                    ctx.drawImage(img, qrX, y, 80, 80);
                }
            };

            drawQr(qrWww, qrY);
            drawQr(qrFb, qrY + 100);

            // 10. Draw Footer
            const footerY = height - 160;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FFFFFF';
            
            ctx.font = '500 18px Arial, sans-serif';
            ctx.fillText('If spotted please contact SAPS Crime Stop on 08600', width / 2, footerY);
            ctx.fillText('10111 or your nearest SAPS Station', width / 2, footerY + 22);

            ctx.font = 'bold 22px serif';
            ctx.fillText('"The Smarter Choice"', width / 2, footerY + 50);

            // Logos and Contact
            const bottomY = height - 60; // Center Y of the footer logos
            const logoWidth = 100;
            const logoHeight = 60;
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

            // Center Contact and Logos
            ctx.font = 'bold 24px Arial, sans-serif';
            const contactNumber = profile.company?.cell_number || '062 031 3134';
            
            const iconSize = 28;
            const iconPadding = 10;
            const rapidLogoHeight = 60;
            const logoPadding = 20;

            const textMetrics = ctx.measureText(contactNumber);
            
            let rapidLogoWidth = 0;
            if (rapidLogo) {
                const ratio = rapidLogo.width / rapidLogo.height;
                rapidLogoWidth = rapidLogoHeight * ratio;
            }

            // Calculate total width of the entire footer block
            const totalFooterWidth = logoWidth + logoPadding + iconSize + iconPadding + textMetrics.width + (rapidLogo ? logoPadding + rapidLogoWidth : 0);
            
            // Calculate starting X to perfectly center the entire block
            const startX = (width - totalFooterWidth) / 2;
            
            // Draw Left Logo
            drawLogo(companyLogo, startX);

            // Align vertically to bottomY
            ctx.textBaseline = 'middle';
            const contactY = bottomY;

            // Draw WhatsApp Icon
            const whatsappX = startX + logoWidth + logoPadding;
            if (whatsappIcon) {
                ctx.drawImage(whatsappIcon, whatsappX, contactY - iconSize / 2, iconSize, iconSize);
            }
            
            // Draw Contact Number
            const textX = whatsappX + iconSize + iconPadding;
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'left';
            ctx.fillText(contactNumber, textX, contactY);

            // Draw Right Logo
            if (rapidLogo) {
                const rightLogoX = textX + textMetrics.width + logoPadding;
                const rLogoY = bottomY - rapidLogoHeight / 2; 
                ctx.drawImage(rapidLogo, rightLogoX, rLogoY, rapidLogoWidth, rapidLogoHeight);
            }

            // Copyright
            const copyrightY = height - 20;
            ctx.font = '12px Arial, sans-serif';
            ctx.textBaseline = 'alphabetic';
            const copyrightText = `Copyright © ${new Date().getFullYear()} Rapid 911 Rapid Rescue PTY (Ltd)`;
            const copyrightMetrics = ctx.measureText(copyrightText);
            const logoH = 24;
            const logoW = rapidLogo ? (rapidLogo.width / rapidLogo.height) * logoH : 0;
            const gap = 8;
            const totalContentWidth = logoW + gap + copyrightMetrics.width;
            const copyrightStartX = (width - totalContentWidth) / 2;

            if (rapidLogo) {
                ctx.drawImage(rapidLogo, copyrightStartX, copyrightY - 18, logoW, logoH); 
            }
            ctx.fillStyle = '#AAAAAA';
            ctx.textAlign = 'left';
            ctx.fillText(copyrightText, copyrightStartX + logoW + gap, copyrightY);

            // 11. Export
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    setIsGeneratingBolo(false);
                    return;
                }

                if (action === 'download') {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `bolo-${report.ob_number.replace(/\//g, '-')}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    addToast('BOLO card downloaded successfully', 'success');
                } else if (action === 'share') {
                    const filename = `bolo-${report.ob_number.replace(/\//g, '-')}.png`;
                    const file = new File([blob], filename, { type: 'image/png' });
                    const companyNumber = profile.company?.cell_number?.replace(/\D/g, '') || '';
                    
                    let caption = `*RAPID iREPORT BOLO*\n`;
                    caption += `*Type:* ${report.type.toUpperCase()}\n`;
                    caption += `*Ref:* ${report.ob_number}\n`;
                    caption += `*Title:* ${report.title}\n`;
                    
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                files: [file],
                                title: 'BOLO Card',
                                text: caption
                            });
                        } catch (error) {
                            if ((error as Error).name !== 'AbortError') {
                                console.error('Error sharing:', error);
                                addToast('Error sharing BOLO card', 'error');
                            }
                        }
                    } else {
                        // Fallback for desktop/unsupported browsers
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        
                        addToast('Image downloaded. Please attach it to the WhatsApp chat.', 'info');
                        
                        const waUrl = `https://wa.me/${companyNumber}?text=${encodeURIComponent(caption)}`;
                        window.open(waUrl, '_blank');
                    }
                }
                setIsGeneratingBolo(false);
            }, 'image/png');

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
                    <ReportTypeBadge type={localReport.type as any} className="p-1.5" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate pr-2">{localReport.type === 'vehicle' ? (localReport as any).license_plate : localReport.title}</h3>
                </div>
                <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                    <XIcon className="w-6 h-6" />
                </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-grow">
                {localReport.evidence_images && localReport.evidence_images.length > 0 && (
                     <div className="grid grid-cols-2 gap-2">
                        {localReport.evidence_images.map((img, index) => (
                             <img key={index} src={img} alt={`Evidence ${index+1}`} className="w-full h-24 object-cover rounded-md border border-gray-200 dark:border-gray-700" />
                        ))}
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Status</p>
                        {canUpdateStatus ? (
                             <select
                                value={localReport.status}
                                onChange={handleStatusChange}
                                disabled={statusUpdateLoading || isTerminalStatus}
                                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md py-1 px-2 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition disabled:opacity-70"
                            >
                                <option value={ReportStatus.PENDING}>Pending</option>
                                <option value={ReportStatus.ACTIVE}>Active</option>
                                <option value={ReportStatus.IN_PROGRESS}>In Progress</option>
                                <option value={ReportStatus.RESOLVED}>Resolved</option>
                                <option value={ReportStatus.REJECTED}>Rejected</option>
                                {localReport.type === 'vehicle' && <option value={ReportStatus.RECOVERED}>Recovered</option>}
                            </select>
                        ) : (
                            <StatusBadge status={localReport.status} />
                        )}
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Severity</p>
                        <p className="font-semibold text-gray-900 dark:text-white capitalize">{localReport.severity}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">OB Number</p>
                        <p className="font-mono text-gray-900 dark:text-white">{localReport.ob_number}</p>
                    </div>
                     <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Reported</p>
                        <p className="text-gray-900 dark:text-white">{format(new Date(localReport.reported_at), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                    {(localReport as any).cas_number && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">CAS Number</p>
                            <p className="text-gray-900 dark:text-white">{(localReport as any).cas_number}</p>
                        </div>
                    )}
                    {(localReport as any).station_name && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Station</p>
                            <p className="text-gray-900 dark:text-white">{(localReport as any).station_name}</p>
                        </div>
                    )}
                    {localReport.type === 'vehicle' && (localReport as any).vin_number && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">VIN</p>
                            <p className="text-gray-900 dark:text-white">{(localReport as any).vin_number}</p>
                        </div>
                    )}
                    {localReport.type === 'vehicle' && (localReport as any).engine_number && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Engine</p>
                            <p className="text-gray-900 dark:text-white">{(localReport as any).engine_number}</p>
                        </div>
                    )}
                    {localReport.type === 'vehicle' && (localReport as any).cos_name && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">COS Name</p>
                            <p className="text-gray-900 dark:text-white">{(localReport as any).cos_name}</p>
                        </div>
                    )}
                    {localReport.type === 'vehicle' && (localReport as any).cos_contact_number && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">COS Contact</p>
                            <p className="text-gray-900 dark:text-white">{(localReport as any).cos_contact_number}</p>
                        </div>
                    )}
                    {localReport.type === 'vehicle' && (localReport as any).io_name && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">IO Name</p>
                            <p className="text-gray-900 dark:text-white">{(localReport as any).io_name}</p>
                        </div>
                    )}
                    {localReport.type === 'vehicle' && (localReport as any).io_contact && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">IO Contact</p>
                            <p className="text-gray-900 dark:text-white">{(localReport as any).io_contact}</p>
                        </div>
                    )}
                    {localReport.type === 'vehicle' && (localReport as any).has_tracker !== undefined && (
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Tracker</p>
                            <p className="text-gray-900 dark:text-white">{(localReport as any).has_tracker ? 'Yes' : 'No'}</p>
                        </div>
                    )}
                    {localReport.type === 'emergency' && (
                        <>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Emergency Type</p>
                                <p className="text-gray-900 dark:text-white">{(localReport as any).emergency_type}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Vehicle Involved</p>
                                <p className="text-gray-900 dark:text-white">{(localReport as any).vehicle_involved || (localReport as any).vehicle_Involved ? 'Yes' : 'No'}</p>
                            </div>
                            {((localReport as any).vehicle_involved || (localReport as any).vehicle_Involved) && (
                                <>
                                    {(localReport as any).license_plate && (
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">License Plate</p>
                                            <p className="text-gray-900 dark:text-white">{(localReport as any).license_plate}</p>
                                        </div>
                                    )}
                                    {(localReport as any).vehicle_make && (
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Make</p>
                                            <p className="text-gray-900 dark:text-white">{(localReport as any).vehicle_make}</p>
                                        </div>
                                    )}
                                    {(localReport as any).vehicle_model && (
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Model</p>
                                            <p className="text-gray-900 dark:text-white">{(localReport as any).vehicle_model}</p>
                                        </div>
                                    )}
                                    {(localReport as any).vehicle_color && (
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Color</p>
                                            <p className="text-gray-900 dark:text-white">{(localReport as any).vehicle_color}</p>
                                        </div>
                                    )}
                                    {(localReport as any).vehicles_involved > 0 && (
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Vehicles Involved</p>
                                            <p className="text-gray-900 dark:text-white">{(localReport as any).vehicles_involved}</p>
                                        </div>
                                    )}
                                </>
                            )}
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Injuries</p>
                                <p className="text-gray-900 dark:text-white">{(localReport as any).injuries_reported ? 'Yes' : 'No'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Fatalities</p>
                                <p className="text-gray-900 dark:text-white">{(localReport as any).fatalities_reported ? 'Yes' : 'No'}</p>
                            </div>
                        </>
                    )}
                </div>

                <div>
                     <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{localReport.type === 'vehicle' ? 'Last Seen Location' : 'Location'}</p>
                     <p className="text-gray-900 dark:text-white flex items-center gap-2"><MapPinIcon className="w-4 h-4 text-gray-400 dark:text-gray-500"/> {localReport.type === 'vehicle' ? (localReport as any).last_seen_location : (localReport as any).location}</p>
                </div>
                 <button 
                    onClick={onViewOnMap} 
                    disabled={!localReport.location_coords}
                    className="w-full btn-secondary text-primary-600 dark:text-primary-400"
                 >
                    View on Map
                </button>

                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Description</p>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{localReport.description}</p>
                </div>

                 {reporter && (
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Reported By</p>
                        <p className="text-gray-700 dark:text-gray-300">{reporter.first_name} {reporter.surname} ({reporter.email})</p>
                    </div>
                 )}
            </div>

            {[ReportStatus.ACTIVE, ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE].includes(localReport.status) && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
                     <button onClick={() => openChat(localReport)} className="w-full btn-secondary text-primary-600 dark:text-primary-400">
                        Open Live Chat
                    </button>
                </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50 flex-shrink-0 grid grid-cols-2 gap-3">
                <button onClick={handleShareWhatsApp} className="flex items-center justify-center gap-2 py-2 px-3 bg-green-600/90 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-semibold">
                    <WhatsappIcon className="w-5 h-5"/> Share
                </button>
                 <button onClick={() => generateBoloImage('download')} disabled={isGeneratingBolo} className="flex items-center justify-center gap-2 btn-primary text-sm disabled:opacity-50 disabled:cursor-wait">
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
                    <button onClick={() => onEdit(localReport)} className="flex items-center justify-center gap-2 btn-primary text-sm">
                        <EditIcon className="w-5 h-5"/> Edit
                    </button>
                    <button onClick={() => onDelete(localReport)} disabled={isTerminalStatus} className="flex items-center justify-center gap-2 btn-danger text-sm">
                        <TrashIcon className="w-5 h-5"/> Delete
                    </button>
                </div>
            )}
        </div>
    );
};

export default ReportDetailCard;
