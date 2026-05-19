import { Profile } from '../types';

export const generateAndShareBolo = async (
    report: any, 
    profile: Profile, 
    mainLogoUrl: string, 
    action: 'download' | 'share' | 'whatsapp' = 'download',
    targetPhone?: string
): Promise<{ method: 'share' | 'download' | 'clipboard' | 'none' }> => {
    
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
            companyLogoDataUrl ? loadImage(companyLogoDataUrl) : Promise.resolve(null),
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
        const headerTitle = report.type === 'vehicle' ? 'SOUGHT VEHICLE' : (report.title || String(report.type).toUpperCase() + ' INCIDENT');
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
        const isRecovered = ['recovered', 'resolved'].includes(report.status || '');
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

        const statusText = isRecovered ? 'RECOVERED' : (report.status === 'active' || report.status === 'assigned' || report.status === 'in_progress' || report.status === 'on_scene' ? 'HIJACKED' : (report.status || '').toUpperCase());
        
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

        if (report.type === 'vehicle') {
            drawField('Status:', statusText, detailsY);
            drawField('Reg:', report.license_plate || 'N/A', detailsY + lineHeight);
            drawField('Make:', report.vehicle_make || 'N/A', detailsY + lineHeight * 2);
            drawField('Type:', report.vehicle_model || 'N/A', detailsY + lineHeight * 3);
            drawField('Colour:', report.vehicle_color || 'N/A', detailsY + lineHeight * 4);
            drawField('Case:', report.cas_number || 'N/A', detailsY + lineHeight * 5);
            drawField('Station:', report.station_name || 'N/A', detailsY + lineHeight * 6);
        } else {
            drawField('Status:', statusText, detailsY);
            drawField('Location:', report.location || 'N/A', detailsY + lineHeight);
            drawField('Case:', report.cas_number || 'N/A', detailsY + lineHeight * 2);
            drawField('Station:', report.station_name || 'N/A', detailsY + lineHeight * 3);
            
            ctx.font = 'normal 24px Arial, sans-serif';
            ctx.fillText('Description:', leftMargin, detailsY + lineHeight * 4);
            ctx.font = 'bold 24px Arial, sans-serif';
            
            const description = report.description || 'N/A';
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

        const totalFooterWidth = logoWidth + logoPadding + iconSize + iconPadding + textMetrics.width + (rapidLogo ? logoPadding + rapidLogoWidth : 0);
        const startX = (width - totalFooterWidth) / 2;
        
        drawLogo(companyLogo, startX);

        ctx.textBaseline = 'middle';
        const contactY = bottomY;

        const whatsappX = startX + logoWidth + logoPadding;
        if (whatsappIcon) {
            ctx.drawImage(whatsappIcon, whatsappX, contactY - iconSize / 2, iconSize, iconSize);
        }
        
        const textX = whatsappX + iconSize + iconPadding;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(contactNumber, textX, contactY);

        if (rapidLogo) {
            const rightLogoX = textX + textMetrics.width + logoPadding;
            const rLogoY = bottomY - rapidLogoHeight / 2; 
            ctx.drawImage(rapidLogo, rightLogoX, rLogoY, rapidLogoWidth, rapidLogoHeight);
        }

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
        return new Promise<{ method: 'share' | 'download' | 'clipboard' | 'none' }>((resolve, reject) => {
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    reject(new Error('Failed to create canvas blob'));
                    return;
                }

                if (action === 'download') {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `bolo-${(report.ob_number || 'new').replace(/\//g, '-')}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    resolve({ method: 'download' });
                } else if (action === 'share') {
                    const filename = `bolo-${(report.ob_number || 'new').replace(/\//g, '-')}.png`;
                    const file = new File([blob], filename, { type: 'image/png' });
                    const companyNumber = profile.company?.cell_number?.replace(/\D/g, '') || '';
                    
                    let caption = `*RAPID iREPORT BOLO*\n`;
                    caption += `*Type:* ${String(report.type).toUpperCase()}\n`;
                    caption += `*Ref:* ${report.ob_number || 'N/A'}\n`;
                    caption += `*Title:* ${report.title || (report.license_plate ? report.license_plate : '')}\n`;
                    
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                files: [file],
                                title: 'BOLO Card',
                                text: caption
                            });
                            resolve({ method: 'share' });
                            return;
                        } catch (error) {
                            // Silently fail and proceed to fallback
                        }
                    }
                    
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    // We do not addToast here directly to keep util pure, but can open whatsapp
                    const waUrl = `https://wa.me/${companyNumber}?text=${encodeURIComponent(caption)}`;
                    window.open(waUrl, '_blank');
                    resolve({ method: 'download' });
                } else if (action === 'whatsapp') {
                    const filename = `bolo-${(report.ob_number || 'new').replace(/\//g, '-')}.png`;
                    const file = new File([blob], filename, { type: 'image/png' });
                    
                    let caption = `*RAPID iREPORT NEW BOLO*\n`;
                    caption += `*Type:* ${String(report.type).toUpperCase()}\n`;
                    caption += `*Ref:* ${report.ob_number || 'N/A'}\n`;
                    caption += report.license_plate ? `*Reg:* ${report.license_plate}\n` : '';
                    caption += report.vehicle_make ? `*Make:* ${report.vehicle_make}\n` : '';

                    // Try copy to clipboard first (less restrictive than share for auto-attach)
                    let clipboardUsed = false;
                    if (navigator.clipboard && (window as any).ClipboardItem) {
                        try {
                            const data = [new ClipboardItem({ [blob.type]: blob })];
                            await navigator.clipboard.write(data);
                            clipboardUsed = true;
                        } catch (err) {
                            console.error('Failed to copy to clipboard:', err);
                        }
                    }

                    // Then try system share (the only real "auto-attach" on mobile)
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                files: [file],
                                title: 'NEW BOLO',
                                text: caption
                            });
                            resolve({ method: 'share' });
                            return;
                        } catch (error) {
                            console.error('Share failed, falling back to download/URL method:', error);
                        }
                    }
                    
                    // Fallback: Download file
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    let captionText = `*RAPID iREPORT NEW BOLO*\n`;
                    captionText += `*Type:* ${String(report.type).toUpperCase()}\n`;
                    captionText += `*Ref:* ${report.ob_number || 'N/A'}\n`;
                    captionText += report.license_plate ? `*Reg:* ${report.license_plate}\n` : '';
                    captionText += report.vehicle_make ? `*Make:* ${report.vehicle_make}\n` : '';
                    
                    const waPhone = targetPhone ? targetPhone.replace(/\D/g, '') : '';
                    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(captionText)}`;
                    window.open(waUrl, '_blank');
                    resolve({ method: clipboardUsed ? 'clipboard' : 'download' });
                }
            }, 'image/png');
        });
    } catch (error) {
        throw error;
    }
};
