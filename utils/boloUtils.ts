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
        const companyBoloBgUrl = profile.company?.bolo_background_url;
        const [
            mainImageDataUrl,
            companyLogoDataUrl,
            qrWwwDataUrl,
            qrFbDataUrl,
            whatsappDataUrl,
            rapidLogoDataUrl,
            customBgImgDataUrl
        ] = await Promise.all([
            imageUrl ? fetchImageAsDataURL(imageUrl) : Promise.resolve(null),
            companyLogoUrl ? fetchImageAsDataURL(companyLogoUrl) : Promise.resolve(null),
            fetchImageAsDataURL(qrCodeWwwUrl),
            fetchImageAsDataURL(qrCodeFbUrl),
            fetchImageAsDataURL('https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg'),
            fetchImageAsDataURL(mainLogoUrl),
            companyBoloBgUrl ? fetchImageAsDataURL(companyBoloBgUrl) : Promise.resolve(null)
        ]);

        // 3. Load images into HTMLImageElements
        const [mainImage, companyLogo, qrWww, qrFb, whatsappIcon, rapidLogo, customBgImg] = await Promise.all([
            mainImageDataUrl ? loadImage(mainImageDataUrl) : Promise.resolve(null),
            companyLogoDataUrl ? loadImage(companyLogoDataUrl) : Promise.resolve(null),
            qrWwwDataUrl ? loadImage(qrWwwDataUrl) : Promise.resolve(null),
            qrFbDataUrl ? loadImage(qrFbDataUrl) : Promise.resolve(null),
            whatsappDataUrl ? loadImage(whatsappDataUrl) : Promise.resolve(null),
            rapidLogoDataUrl ? loadImage(rapidLogoDataUrl) : Promise.resolve(null),
            customBgImgDataUrl ? loadImage(customBgImgDataUrl) : Promise.resolve(null)
        ]);

        // 4. Setup Canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        const width = 1000;
        const height = 1500;
        canvas.width = width;
        canvas.height = height;

        // Font selection matching typography guide
        const fontSans = 'Arial, Helvetica, sans-serif';
        const fontImpact = 'Impact, "Arial Black", Arial, sans-serif';

        // 5. Draw Background
        ctx.fillStyle = '#0a0a0a'; // Premium ultra-deep dark background
        ctx.fillRect(0, 0, width, height);

        // 6. Draw Header Section with Company Logo and Custom Branding
        // Draw the company logo in the top right instead of "X"
        const logoToDraw = companyLogo || rapidLogo;
        if (logoToDraw) {
            ctx.save();
            const maxLogoW = 420;
            const maxLogoH = 260;
            const logoX = 950 - maxLogoW; // Right-aligned to 950px (50px right margin)
            const logoY = 40; // Vertically centered in the header
            
            const imgRatio = logoToDraw.width / logoToDraw.height;
            let drawW = maxLogoW;
            let drawH = maxLogoW / imgRatio;
            
            if (drawH > maxLogoH) {
                drawH = maxLogoH;
                drawW = maxLogoH * imgRatio;
            }
            
            // Align to the absolute right side of our container box
            const dx = logoX + (maxLogoW - drawW);
            const dy = logoY + (maxLogoH - drawH) / 2;
            
            ctx.drawImage(logoToDraw, dx, dy, drawW, drawH);
            ctx.restore();
        }

        // Draw company text branding logo (top left)
        const companyName = profile.company?.name ? profile.company.name.toUpperCase() : 'EXCELLERATE SERVICES';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        // Word "EXCELLERATE" or custom company name first part
        const firstWord = companyName.split(' ')[0] || 'EXCELLERATE';
        const restOfName = companyName.substring(firstWord.length).trim() || 'SERVICES';

        ctx.font = `bold 36px ${fontSans}`;
        ctx.fillText(firstWord, 60, 80);

        // Word "SERVICES" or second part
        ctx.font = `bold 20px ${fontSans}`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(restOfName, 60, 115);

        // Slogan: "WHERE BETTER BEGINS" with "BETTER" in orange
        const lineY = 150;
        ctx.font = `bold 16px ${fontSans}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('WHERE ', 60, lineY);
        const whereWidth = ctx.measureText('WHERE ').width;
        ctx.fillStyle = '#F25A22'; // Brand Orange
        ctx.fillText('BETTER', 60 + whereWidth, lineY);
        const betterWidth = ctx.measureText('BETTER').width;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(' BEGINS', 60 + whereWidth + betterWidth, lineY);

        // Thin divider line under the slogan
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(60, lineY + 15);
        ctx.lineTo(600, lineY + 15);
        ctx.stroke();

        // Determine title text based on report details and if case number is supplied
        const rawCaseNum = report.cas_number || report.case_number || report.caseNumber || report.casenumber;
        const hasCaseNumber = rawCaseNum && String(rawCaseNum).trim() !== '' && String(rawCaseNum).trim().toUpperCase() !== 'N/A';

        let titleLine1 = 'STOLEN';
        let titleLine2 = 'MOTOR VEHICLE';

        if (!hasCaseNumber) {
            titleLine1 = 'BOLO';
            titleLine2 = '';
        } else if (report.type === 'vehicle') {
            const isHijacked = String(report.status).toLowerCase() === 'hijacked';
            titleLine1 = isHijacked ? 'HIJACKED' : 'STOLEN';
            titleLine2 = 'MOTOR VEHICLE';
        } else {
            titleLine1 = 'SOUGHT';
            titleLine2 = 'CRIME REPORT';
        }

        // Title text in giant stout display typography
        const titleY = titleLine2 ? 240 : 280;
        ctx.font = `900 96px ${fontImpact}`;
        ctx.fillStyle = '#F25A22'; // Orange Accent
        ctx.fillText(titleLine1, 60, titleY);

        if (titleLine2) {
            ctx.font = `900 80px ${fontImpact}`;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(titleLine2, 60, titleY + 95);
        }

        // 7. Orange separator bar 1 (above image)
        const imageStartY = 370;
        ctx.fillStyle = '#F25A22';
        ctx.fillRect(0, imageStartY - 12, width, 12);

        // 8. Draw Main Photo Area (Landscape Cover image)
        const imageEndY = 750;
        const imageHeight = imageEndY - imageStartY;
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, imageStartY, width, imageHeight);

        if (mainImage) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, imageStartY, width, imageHeight);
            ctx.clip();
            
            const imgRatio = mainImage.width / mainImage.height;
            const canvasRatio = width / imageHeight;
            
            // First, draw a darkened, 15% opacity cover background to act as an elegant, fluid ambient glow
            let coverW = width;
            let coverH = imageHeight;
            let coverX = 0;
            let coverY = 0;
            
            if (imgRatio > canvasRatio) {
                coverW = imageHeight * imgRatio;
                coverX = (width - coverW) / 2;
            } else {
                coverH = width / imgRatio;
                coverY = (imageHeight - coverH) / 2;
            }
            
            ctx.globalAlpha = 0.15;
            ctx.drawImage(mainImage, coverX, imageStartY + coverY, coverW, coverH);
            ctx.globalAlpha = 1.0;
            
            // Then draw the actual contained image so it fits the space and doesn't cut details
            let drawW = width;
            let drawH = imageHeight;
            let offsetX = 0;
            let offsetY = 0;
            
            if (imgRatio > canvasRatio) {
                // Image is wider than container -> bound by width
                drawW = width;
                drawH = width / imgRatio;
                offsetY = (imageHeight - drawH) / 2;
            } else {
                // Image is taller than container -> bound by height
                drawH = imageHeight;
                drawW = imageHeight * imgRatio;
                offsetX = (width - drawW) / 2;
            }
            
            ctx.drawImage(mainImage, offsetX, imageStartY + offsetY, drawW, drawH);
            ctx.restore();
        } else {
            // Elegant empty photo placeholder
            ctx.fillStyle = '#181818';
            ctx.fillRect(0, imageStartY, width, imageHeight);
            
            ctx.save();
            ctx.translate(width / 2, imageStartY + imageHeight / 2 - 25);
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, 50, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = '#444444';
            ctx.font = '50px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🚗', 0, 0);
            ctx.restore();
            
            ctx.fillStyle = '#666666';
            ctx.font = `bold 24px ${fontSans}`;
            ctx.textAlign = 'center';
            ctx.fillText('NO IMAGE AVAILABLE', width / 2, imageStartY + imageHeight / 2 + 55);
        }

        // Recovered stamp banner overlay
        const isRecovered = ['recovered', 'resolved'].includes(report.status || '');
        if (isRecovered) {
            ctx.save();
            ctx.translate(width / 2, imageStartY + imageHeight / 2);
            ctx.rotate(-15 * Math.PI / 180);
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            const stampText = 'RECOVERED';
            ctx.font = `900 110px ${fontImpact}`;
            const textMetrics = ctx.measureText(stampText);
            const textWidth = textMetrics.width;
            const textHeight = 110;
            
            ctx.fillRect(-textWidth/2 - 30, -textHeight/2 - 5, textWidth + 60, textHeight + 20);
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#00C853'; // Solid bright green
            ctx.strokeRect(-textWidth/2 - 30, -textHeight/2 - 5, textWidth + 60, textHeight + 20);
            
            ctx.fillStyle = '#00C853';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(stampText, 0, 10);
            ctx.restore();
        }

        // 9. Orange separator line 2 (below image)
        ctx.fillStyle = '#F25A22';
        ctx.fillRect(0, imageEndY, width, 4);

        // 10. Draw Details Grid Section
        const gridStartY = imageEndY + 4;
        const gridHeight = 460;
        const gridEndY = gridStartY + gridHeight;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, gridStartY, width, gridHeight);

        // Support custom background image if configured in the profile
        if (customBgImg) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, gridStartY, width, gridHeight);
            ctx.clip();
            ctx.drawImage(customBgImg, 0, gridStartY, width, gridHeight);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Heavy dark overlay for high readability
            ctx.fillRect(0, gridStartY, width, gridHeight);
            ctx.restore();
        }

        // Grid boundaries and cell setup
        const rowHeight = 110;
        const y1 = gridStartY;
        const y2 = gridStartY + rowHeight;
        const y3 = gridStartY + rowHeight * 2;
        const y4 = gridStartY + rowHeight * 3;
        const y5 = gridStartY + rowHeight * 4;

        // Draw horizontal grid lines
        ctx.strokeStyle = '#1b1b1b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(50, y2);
        ctx.lineTo(950, y2);
        ctx.moveTo(50, y3);
        ctx.lineTo(950, y3);
        ctx.moveTo(50, y4);
        ctx.lineTo(950, y4);
        ctx.stroke();

        // Draw vertical column divider line
        ctx.beginPath();
        ctx.moveTo(500, y1 + 10);
        ctx.lineTo(500, y4 + rowHeight - 10);
        ctx.stroke();

        // Format date and time helpers
        const formatDate = (dateStr: string) => {
            if (!dateStr) return 'N/A';
            try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return dateStr;
                const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
            } catch (e) {
                return dateStr;
            }
        };

        const formatTime = (dateStr: string) => {
            if (!dateStr) return 'N/A';
            try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return 'N/A';
                const hrs = String(date.getHours()).padStart(2, '0');
                const mins = String(date.getMinutes()).padStart(2, '0');
                return `Approx. ${hrs}:${mins}`;
            } catch (e) {
                return 'N/A';
            }
        };

        // Prepare detail variables from report
        const vehicleColor = report.vehicle_color || '';
        const vehicleMake = report.vehicle_make || '';
        const vehicleModel = report.vehicle_model || '';
        const vehicleValue = `${vehicleColor} ${vehicleMake} ${vehicleModel}`.trim() || 'N/A';

        const locationValue = report.last_seen_location || report.location || 'N/A';
        const directionValue = report.description || 'Unknown';
        const regValue = (report.license_plate || 'N/A').toUpperCase().replace(/\s+/g, '');

        const dateValue = formatDate(report.date_of_incident || report.reported_at);
        const timeValue = formatTime(report.date_of_incident || report.reported_at);
        const casValue = report.cas_number ? `${report.cas_number} ${report.station_name || ''}`.trim() : 'Pending';

        // Draw cell helper function with vector icon rendering
        const drawCircularIcon = (
            context: CanvasRenderingContext2D, 
            cx: number, 
            cy: number, 
            r: number, 
            iconType: string
        ) => {
            context.save();
            context.beginPath();
            context.arc(cx, cy, r, 0, Math.PI * 2);
            context.lineWidth = 3;
            context.strokeStyle = '#F25A22';
            context.stroke();
            context.restore();

            context.save();
            context.translate(cx, cy);
            context.strokeStyle = '#F25A22';
            context.fillStyle = '#F25A22';
            context.lineWidth = 2.5;
            context.lineCap = 'round';
            context.lineJoin = 'round';

            if (iconType === 'car') {
                context.beginPath();
                context.moveTo(-12, -2);
                context.lineTo(-8, -10);
                context.lineTo(8, -10);
                context.lineTo(12, -2);
                context.closePath();
                context.stroke();

                context.beginPath();
                if (context.roundRect) {
                    context.roundRect(-16, -2, 32, 10, 3);
                } else {
                    context.rect(-16, -2, 32, 10);
                }
                context.fill();

                context.fillStyle = '#000000';
                context.beginPath();
                context.arc(-11, 3, 2.5, 0, Math.PI * 2);
                context.arc(11, 3, 2.5, 0, Math.PI * 2);
                context.fill();

                context.strokeStyle = '#000000';
                context.lineWidth = 1.5;
                context.beginPath();
                context.moveTo(-5, 3);
                context.lineTo(5, 3);
                context.stroke();

                context.fillStyle = '#F25A22';
                context.fillRect(-12, 8, 5, 4);
                context.fillRect(7, 8, 5, 4);
            } else if (iconType === 'location') {
                context.beginPath();
                context.arc(0, -5, 8, Math.PI, 0, false);
                context.bezierCurveTo(8, -5, 8, 3, 0, 13);
                context.bezierCurveTo(-8, 3, -8, -5, -8, -5);
                context.closePath();
                context.stroke();

                context.beginPath();
                context.arc(0, -5, 2.5, 0, Math.PI * 2);
                context.fill();
            } else if (iconType === 'question') {
                context.font = 'bold 30px Arial, sans-serif';
                context.fillStyle = '#F25A22';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText('?', 0, 0);
            } else if (iconType === 'registration') {
                context.beginPath();
                if (context.roundRect) {
                    context.roundRect(-18, -10, 36, 20, 4);
                } else {
                    context.rect(-18, -10, 36, 20);
                }
                context.stroke();

                context.font = 'bold 8px Courier New, monospace';
                context.fillStyle = '#F25A22';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText('ABC-123', 0, 0);
            } else if (iconType === 'calendar') {
                context.beginPath();
                if (context.roundRect) {
                    context.roundRect(-13, -8, 26, 18, 3);
                } else {
                    context.rect(-13, -8, 26, 18);
                }
                context.stroke();

                context.beginPath();
                context.moveTo(-13, -2);
                context.lineTo(13, -2);
                context.stroke();

                context.fillStyle = '#F25A22';
                context.fillRect(-8, -11, 3, 4);
                context.fillRect(5, -11, 3, 4);

                context.fillStyle = '#F25A22';
                context.fillRect(-6, 2, 2, 2);
                context.fillRect(0, 2, 2, 2);
                context.fillRect(6, 2, 2, 2);
                context.fillRect(-6, 7, 2, 2);
                context.fillRect(0, 7, 2, 2);
                context.fillRect(6, 7, 2, 2);
            } else if (iconType === 'clock') {
                context.beginPath();
                context.arc(0, 0, 13, 0, Math.PI * 2);
                context.stroke();

                context.beginPath();
                context.moveTo(0, 0);
                context.lineTo(0, -7);
                context.moveTo(0, 0);
                context.lineTo(5, 0);
                context.stroke();
            } else if (iconType === 'shield') {
                context.beginPath();
                context.moveTo(0, -13);
                context.lineTo(11, -9);
                context.bezierCurveTo(11, -1, 9, 8, 0, 13);
                context.bezierCurveTo(-9, 8, -11, -1, -11, -9);
                context.closePath();
                context.stroke();
            }

            context.restore();
        };

        const drawTextWithWrapping = (
            context: CanvasRenderingContext2D, 
            text: string, 
            x: number, 
            y: number, 
            maxWidth: number, 
            lineHeight: number
        ) => {
            const words = text.split(' ');
            let line = '';
            let currentY = y;
            let linesDrawn = 0;
            for (let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                let metrics = context.measureText(testLine);
                if (metrics.width > maxWidth && n > 0) {
                    context.fillText(line.trim(), x, currentY);
                    line = words[n] + ' ';
                    currentY += lineHeight;
                    linesDrawn++;
                    if (linesDrawn >= 2) return; // Limit to 2 lines max
                } else {
                    line = testLine;
                }
            }
            context.fillText(line.trim(), x, currentY);
        };

        const drawCell = (
            label: string, 
            value: string, 
            iconType: string, 
            col: 1 | 2, 
            row: 1 | 2 | 3 | 4
        ) => {
            const startX = col === 1 ? 50 : 520;
            const centerY = gridStartY + (row - 1) * rowHeight + rowHeight / 2;
            const iconX = startX + 40;
            
            // Draw Icon
            drawCircularIcon(ctx, iconX, centerY, 30, iconType);
            
            // Draw Texts
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            
            // Label
            ctx.font = `bold 16px ${fontSans}`;
            ctx.fillStyle = '#F25A22';
            ctx.fillText(label, iconX + 50, centerY - 15);
            
            // Value
            ctx.font = `bold 22px ${fontSans}`;
            ctx.fillStyle = '#FFFFFF';
            
            const maxValWidth = col === 1 ? 500 - (iconX + 50) - 20 : 950 - (iconX + 50) - 20;
            drawTextWithWrapping(ctx, value, iconX + 50, centerY + 12, maxValWidth, 26);
        };

        // Draw Left Column Cells
        drawCell('VEHICLE', vehicleValue, 'car', 1, 1);
        drawCell('LOCATION', locationValue, 'location', 1, 2);
        drawCell('DIRECTION & SUSPECTS', directionValue, 'question', 1, 3);
        drawCell('VEHICLE REGISTRATION', regValue, 'registration', 1, 4);

        // Draw Right Column Cells
        drawCell('DATE STOLEN', dateValue, 'calendar', 2, 1);
        drawCell('TIME', timeValue, 'clock', 2, 2);
        drawCell('SAPS CAS', casValue, 'shield', 2, 3);

        if (report.ob_number) {
            drawCell('OB NUMBER', report.ob_number, 'registration', 2, 4);
        }

        // 11. Draw Footer Section
        const footerStartY = 1246;
        ctx.fillStyle = '#F25A22';
        ctx.fillRect(0, footerStartY, width, 12); // Separation orange thick line

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, footerStartY + 12, width, 242);

        // Draw orange corner slant path at bottom right
        ctx.fillStyle = '#F25A22';
        ctx.beginPath();
        ctx.moveTo(850, 1500);
        ctx.lineTo(1000, footerStartY + 12);
        ctx.lineTo(1000, 1500);
        ctx.closePath();
        ctx.fill();

        // Bottom left Call icon
        const callCenterY = footerStartY + 122;
        ctx.beginPath();
        ctx.arc(110, callCenterY, 45, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#F25A22';
        ctx.stroke();

        ctx.save();
        ctx.translate(110, callCenterY);
        ctx.fillStyle = '#F25A22';
        ctx.beginPath();
        ctx.moveTo(-12, -10);
        ctx.quadraticCurveTo(-15, -4, -6, 6);
        ctx.quadraticCurveTo(4, 15, 10, 12);
        ctx.lineTo(14, 8);
        ctx.quadraticCurveTo(12, 4, 8, 6);
        ctx.lineTo(4, 2);
        ctx.quadraticCurveTo(-2, -4, 0, -8);
        ctx.lineTo(-2, -12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Contact Labels
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold 28px ${fontSans}`;
        ctx.fillText('IF SPOTTED', 180, callCenterY - 10);

        ctx.fillStyle = '#F25A22';
        ctx.font = `900 52px ${fontImpact}`;
        ctx.fillText('CONTACT', 180, callCenterY + 42);

        // Vertical grey separator line
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(460, footerStartY + 40);
        ctx.lineTo(460, footerStartY + 210);
        ctx.stroke();

        // Right side footer text details
        const footerCompanyName = profile.company?.name ? profile.company.name.toUpperCase() : 'EXCELLERATE SERVICES';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold 26px ${fontSans}`;
        ctx.fillText(footerCompanyName, 490, footerStartY + 75);

        ctx.fillStyle = '#F25A22';
        ctx.font = `bold 18px ${fontSans}`;
        const footerSub = profile.company?.name ? 'SECURITY OPERATIONS CENTRE' : 'NATIONAL COMMAND CENTRE';
        ctx.fillText(footerSub, 490, footerStartY + 110);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `900 68px ${fontImpact}`;
        const companyContact = profile.company?.cell_number || '+278469-10111';
        ctx.fillText(companyContact, 490, footerStartY + 185);


        // 12. Export
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
