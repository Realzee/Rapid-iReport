import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Report, Company } from '../types';

const helperCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const helperCtx = helperCanvas ? helperCanvas.getContext('2d') : null;

/**
 * Converts any CSS color string containing oklch / oklab into a standard RGB / RGBA or HEX color string.
 */
function convertCssColorToRgb(colorStr: string): string {
  if (!colorStr) return colorStr;
  if (!colorStr.includes('oklch') && !colorStr.includes('oklab') && !colorStr.includes('color(')) {
    return colorStr;
  }

  if (helperCtx) {
    try {
      helperCtx.fillStyle = '#000000';
      helperCtx.fillStyle = colorStr;
      if (helperCtx.fillStyle && helperCtx.fillStyle !== '#000000') {
        return helperCtx.fillStyle;
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback if canvas context is unavailable
  return colorStr
    .replace(/oklch\([^)]+\)/gi, 'rgb(75, 85, 99)')
    .replace(/oklab\([^)]+\)/gi, 'rgb(75, 85, 99)');
}

/**
 * Replaces all occurrences of oklch(...) or oklab(...) in a CSS text string.
 */
function replaceOklchInCssString(cssText: string): string {
  if (!cssText || (!cssText.includes('oklch') && !cssText.includes('oklab'))) return cssText;
  return cssText
    .replace(/oklch\([^)]+\)/gi, (match) => convertCssColorToRgb(match))
    .replace(/oklab\([^)]+\)/gi, (match) => convertCssColorToRgb(match));
}

/**
 * Renders an HTML element representing a printable report docket into a jsPDF document Blob.
 */
export async function generateReportPdfBlob(
  element: HTMLElement,
  report: Report
): Promise<{ blob: Blob; filename: string }> {
  // Use html2canvas to capture the element with high resolution
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 1024,
    onclone: (clonedDoc, clonedElement) => {
      // 1. Process all <style> blocks in the cloned document
      const styleElements = clonedDoc.querySelectorAll('style');
      styleElements.forEach((styleEl) => {
        if (styleEl.textContent && (styleEl.textContent.includes('oklch') || styleEl.textContent.includes('oklab'))) {
          styleEl.textContent = replaceOklchInCssString(styleEl.textContent);
        }
      });

      // 2. Process stylesheet rules
      try {
        const sheets = Array.from(clonedDoc.styleSheets);
        sheets.forEach((sheet) => {
          try {
            const rules = Array.from(sheet.cssRules || (sheet as any).rules || []);
            rules.forEach((rule: any) => {
              if (rule.style && rule.style.cssText && (rule.style.cssText.includes('oklch') || rule.style.cssText.includes('oklab'))) {
                rule.style.cssText = replaceOklchInCssString(rule.style.cssText);
              }
            });
          } catch {
            // Ignore CORS stylesheet errors
          }
        });
      } catch {
        // Ignore
      }

      // 3. Process inline styles and computed styles for all elements
      const elementsToClean = Array.from(clonedDoc.querySelectorAll('*')) as HTMLElement[];
      if (clonedElement) {
        elementsToClean.push(clonedElement as HTMLElement);
      }

      const win = clonedDoc.defaultView || window;

      elementsToClean.forEach((el) => {
        // Clean inline style attribute
        const styleAttr = el.getAttribute('style');
        if (styleAttr && (styleAttr.includes('oklch') || styleAttr.includes('oklab'))) {
          el.setAttribute('style', replaceOklchInCssString(styleAttr));
        }

        // Clean computed color properties that might cause html2canvas to fail
        try {
          const computed = win.getComputedStyle(el);
          const colorProps = [
            'color',
            'background-color',
            'border-color',
            'border-top-color',
            'border-right-color',
            'border-bottom-color',
            'border-left-color',
            'outline-color',
            'box-shadow',
            'text-decoration-color',
            'fill',
            'stroke'
          ];

          colorProps.forEach((prop) => {
            const val = computed.getPropertyValue(prop);
            if (val && (val.includes('oklch') || val.includes('oklab'))) {
              const fixedVal = replaceOklchInCssString(val);
              el.style.setProperty(prop, fixedVal, 'important');
            }
          });
        } catch {
          // Continue
        }
      });
    },
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  
  // A4 dimensions in mm: 210 x 297
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // Calculate scaled height to fit A4 width
  const imgWidth = pdfWidth;
  const imgHeight = (canvasHeight * pdfWidth) / canvasWidth;

  let heightLeft = imgHeight;
  let position = 0;

  // First page
  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pdfHeight;

  // Additional pages if the content extends beyond one A4 page
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;
  }

  const isRoadside = report.type === 'roadside' || (report as any).emergency_type === 'Roadside Assistance';
  const refNumber = (report as any).car_number || (report as any).card_number || report.ob_number || 'report';
  const cleanRef = String(refNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${isRoadside ? 'Roadside_Docket' : 'Incident_Report'}_${cleanRef}.pdf`;

  const blob = pdf.output('blob');
  return { blob, filename };
}

/**
 * Builds a structured, professional WhatsApp summary caption for the incident report.
 */
export function buildReportWhatsAppCaption(report: Report, company?: Company | null): string {
  const isRoadside = report.type === 'roadside' || (report as any).emergency_type === 'Roadside Assistance';
  const refNumber = (report as any).car_number || (report as any).card_number || report.ob_number || 'N/A';
  const companyName = company?.name || 'Rapid Response Services';

  const r = report as any;

  let text = `🚨 *RAPID REPORT - ${isRoadside ? 'ROADSIDE ASSISTANCE DOCKET' : 'INCIDENT INFORMATION REPORT'}*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📋 *Reference:* ${refNumber}\n`;
  text += `🏢 *Company / Provider:* ${companyName}\n`;
  text += `🏷️ *Category:* ${String(report.type || 'Incident').toUpperCase()}\n`;
  if (r.emergency_type) {
    text += `⚠️ *Classification:* ${r.emergency_type}\n`;
  }
  text += `📊 *Status:* ${String(report.status || 'Active').toUpperCase()}\n`;
  
  const reportTime = r.reported_at || r.created_at;
  if (reportTime) {
    try {
      const dt = new Date(reportTime);
      text += `📅 *Logged:* ${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
    } catch {
      text += `📅 *Logged:* ${reportTime}\n`;
    }
  }

  const loc = r.location || r.last_seen_location;
  if (loc) {
    text += `📍 *Location:* ${loc}\n`;
  }
  const coords = r.location_coords;
  if (coords?.lat && coords?.lng) {
    text += `🗺️ *GPS Coordinates:* https://maps.google.com/?q=${coords.lat},${coords.lng}\n`;
  }

  if (r.contact_name || r.contact_number) {
    text += `👤 *Client/Contact:* ${r.contact_name || 'Anonymous'}`;
    if (r.contact_number) text += ` (${r.contact_number})`;
    text += `\n`;
  }

  if (report.license_plate) {
    text += `🚗 *Vehicle Reg:* ${report.license_plate}\n`;
  }
  if (report.vehicle_make || report.vehicle_model) {
    text += `🚘 *Vehicle:* ${[report.vehicle_make, report.vehicle_model, report.vehicle_color].filter(Boolean).join(' ')}\n`;
  }

  const notes = r.notes || r.description;
  if (notes) {
    const desc = String(notes).trim();
    if (desc) {
      text += `📝 *Notes:* ${desc.length > 200 ? desc.substring(0, 200) + '...' : desc}\n`;
    }
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📎 *Official PDF Docket Attached / Downloaded*`;

  return text;
}

/**
 * Downloads the PDF directly to the user's filesystem and opens WhatsApp with the formatted summary.
 */
export function sendPdfViaWhatsAppFallback(
  blob: Blob,
  filename: string,
  caption: string,
  targetPhone?: string
) {
  // 1. Trigger direct browser download of the PDF file
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  // 2. Open WhatsApp Web / App with the formatted message
  const cleanPhone = targetPhone ? targetPhone.replace(/\D/g, '') : '';
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(caption)}`
    : `https://wa.me/?text=${encodeURIComponent(caption)}`;
  
  window.open(waUrl, '_blank');
}

/**
 * Sends or shares the incident report as a true PDF file via WhatsApp / Web Share API.
 * Uses navigator.share if the browser supports file sharing (mobile / modern desktop).
 * Otherwise triggers a download of the PDF and launches WhatsApp with the prefilled docket caption.
 */
export async function sendReportPdfViaWhatsApp(
  element: HTMLElement,
  report: Report,
  company?: Company | null,
  targetPhone?: string
): Promise<{ method: 'share' | 'download' }> {
  // 1. Generate the PDF Blob and filename
  const { blob, filename } = await generateReportPdfBlob(element, report);
  const caption = buildReportWhatsAppCaption(report, company);

  const file = new File([blob], filename, { type: 'application/pdf' });

  // 2. Check if the device / browser supports direct file sharing (e.g. mobile Safari / Chrome)
  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: filename.replace('.pdf', ''),
        text: caption,
      });
      return { method: 'share' };
    } catch (err: any) {
      // If user canceled the share sheet, do not fail
      if (err.name === 'AbortError') {
        return { method: 'share' };
      }
      console.warn('Web Share failed, falling back to download and WhatsApp launch:', err);
    }
  }

  // 3. Fallback: Download the PDF docket and launch WhatsApp with the prefilled report docket text
  sendPdfViaWhatsAppFallback(blob, filename, caption, targetPhone || (report as any).contact_number || undefined);
  return { method: 'download' };
}
