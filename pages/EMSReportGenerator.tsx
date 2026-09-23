import React, { useState, useEffect } from 'react';
import { Report, Profile, Company } from '../types';
import jsPDF from 'jspdf';
import { ArrowLeftIcon, DownloadIcon, HeartPulseIcon, CheckCircleIcon, HospitalIcon, StethoscopeIcon, ShieldAlertIcon, BuildingIcon } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { logoUrl as defaultFallbackLogo } from '../assets/logo';

interface EMSReportGeneratorProps {
  report: Report;
  profile?: Profile | null;
  onBack: () => void;
}

const COMMON_TREATMENTS = [
  "High-Flow Oxygen Therapy",
  "CPR & Chest Compressions",
  "Defibrillation / AED Shock",
  "Wound Dressing & Hemostasis",
  "IV Line & Saline Drip",
  "Airway Intubation / Suction",
  "C-Collar & Spinal Board",
  "Splinting & Immobilization",
  "Pain Analgesia Administered",
  "Nebulisation / Bronchodilator",
  "12-Lead ECG Monitoring",
  "Burn Dressing & Cooling",
  "Oral Glucose Administered"
];

const POPULAR_HOSPITALS = [
  "Netcare Milpark Hospital (Level 1 Trauma)",
  "Charlotte Maxeke Academic Hospital (Public ER)",
  "Sunnyside Mediclinic (Private ER)",
  "Life Fourways Hospital (Level 1 Trauma)",
  "Chris Hani Baragwanath Academic Hospital",
  "Morningside Mediclinic",
  "Helen Joseph Hospital",
  "Steve Biko Academic Hospital",
  "Mediclinic Sandton",
  "Netcare Sunninghill Hospital"
];

// Robust image loader that returns base64 dataUrl with dimensions and format
const loadImageAsDataUrl = (url: string): Promise<{ dataUrl: string; width: number; height: number; format: string } | null> => {
  return new Promise((resolve) => {
    if (!url) return resolve(null);

    const timeout = setTimeout(() => {
      resolve(null);
    }, 3000);

    const finish = (result: { dataUrl: string; width: number; height: number; format: string } | null) => {
      clearTimeout(timeout);
      resolve(result);
    };

    if (url.startsWith('data:image/')) {
      const img = new Image();
      img.onload = () => {
        const format = url.includes('image/png') ? 'PNG' : 'JPEG';
        finish({
          dataUrl: url,
          width: img.naturalWidth || img.width || 120,
          height: img.naturalHeight || img.height || 120,
          format
        });
      };
      img.onerror = () => finish(null);
      img.src = url;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 150;
        canvas.height = img.naturalHeight || img.height || 150;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          finish({
            dataUrl,
            width: canvas.width,
            height: canvas.height,
            format: 'PNG'
          });
          return;
        }
      } catch {
        // Continue to fetch fallback
      }

      fetch(url)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            finish({
              dataUrl,
              width: img.naturalWidth || 150,
              height: img.naturalHeight || 150,
              format: dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
            });
          };
          reader.onerror = () => finish(null);
          reader.readAsDataURL(blob);
        })
        .catch(() => finish(null));
    };

    img.onerror = () => {
      fetch(url)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            finish({
              dataUrl,
              width: 150,
              height: 150,
              format: dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
            });
          };
          reader.onerror = () => finish(null);
          reader.readAsDataURL(blob);
        })
        .catch(() => finish(null));
    };

    img.src = url;
  });
};

export const EMSReportGenerator: React.FC<EMSReportGeneratorProps> = ({ report, profile, onBack }) => {
  const { mainLogoUrl, defaultLogoUrl } = useSettings();
  const [company, setCompany] = useState<Company | null>(profile?.company || null);

  useEffect(() => {
    if (profile?.company) {
      setCompany(profile.company);
    } else if (profile?.company_id) {
      supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single()
        .then(({ data }) => {
          if (data) setCompany(data as Company);
        });
    }
  }, [profile]);

  const [formData, setFormData] = useState({
    patient_name: (report as any).patient_name || '',
    patient_age: '',
    patient_gender: '',
    patient_contact: '',
    chief_complaint: (report as any).description || (report as any).chief_complaint || '',
    medical_history: 'None reported',
    allergies: 'NKDA',
    vital_bp: '120/80',
    vital_pulse: '76',
    vital_resp: '16',
    vital_spo2: '98',
    vital_temp: '36.6',
    vital_gcs: '15',
    treatment_provided: '',
    medications_administered: 'None',
    triage_level: (report as any).triage_level || 'P2',
    transport_decision: 'Transported to Hospital',
    receiving_facility: (report as any).receiving_facility || '',
    custom_hospital: '',
    handover_notes: ''
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleTreatment = (treatment: string) => {
    setFormData(prev => {
      const current = prev.treatment_provided.trim();
      if (!current) return { ...prev, treatment_provided: treatment };
      if (current.includes(treatment)) {
        const updated = current.split(', ').filter(item => item !== treatment).join(', ');
        return { ...prev, treatment_provided: updated };
      } else {
        return { ...prev, treatment_provided: `${current}, ${treatment}` };
      }
    });
  };

  const handleGenerateAndSave = async () => {
    setIsGenerating(true);
    setToastMessage(null);
    try {
      const selectedHospital = formData.receiving_facility === 'Other' 
        ? formData.custom_hospital 
        : (formData.receiving_facility || formData.custom_hospital);

      // 1. Save Scene Assessment to Database
      if (profile) {
        const { error: emsErr } = await supabase.from('ems_assessments').insert([{
          report_id: report.id,
          ...formData,
          receiving_facility: selectedHospital,
          assessed_by: profile.id
        }]);
        if (emsErr) {
          console.warn("Could not save to ems_assessments table:", emsErr);
        }

        // 2. Update Emergency Incident in DB with Medic Decisions
        const tableName = report.type === 'vehicle' ? 'vehicle_reports' : (report.type === 'crime' ? 'crime_reports' : 'emergency_reports');
        const updatePayload: any = {
          triage_level: formData.triage_level,
          receiving_facility: selectedHospital || 'Unassigned',
        };

        const existingNotes = (report as any).dispatch_notes || '';
        const sceneNoteSummary = `[SCENE REPORT - Medic ${profile.first_name || ''} ${profile.surname || ''}]: Triage: ${formData.triage_level} | Treatment: ${formData.treatment_provided || 'Evaluated on scene'} | Facility: ${selectedHospital || 'None'}`;
        updatePayload.dispatch_notes = existingNotes ? `${existingNotes}\n${sceneNoteSummary}` : sceneNoteSummary;

        const { error: updateErr } = await supabase.from(tableName).update(updatePayload).eq('id', report.id);
        if (updateErr) {
          console.warn("Could not update incident table:", updateErr);
        }

        // 3. Insert Timeline Update
        await supabase.from('report_updates').insert([{
          report_id: report.id,
          user_id: profile.id,
          content: `📋 SCENE REPORT LOGGED by Medic ${profile.first_name || ''} ${profile.surname || ''}:\n• Patient: ${formData.patient_name || 'Unidentified'}\n• Triage Assigned: ${formData.triage_level}\n• Treatment Administered: ${formData.treatment_provided || 'Patient evaluated'}\n• Assigned Receiving Hospital: ${selectedHospital || 'Pending/Not Transported'}\n• Vitals: BP ${formData.vital_bp}, HR ${formData.vital_pulse} bpm, SpO2 ${formData.vital_spo2}%, GCS ${formData.vital_gcs}/15`
        }]);

        setIsSaved(true);
        setToastMessage("Scene Report saved! Triage level and receiving hospital updated on incident.");
      }

      // 4. Generate Official Patient Care Report PDF
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth(); // ~595 pt
      const pageHeight = pdf.internal.pageSize.getHeight(); // ~842 pt
      const marginLeft = 36;
      const marginRight = 36;
      const contentWidth = pageWidth - marginLeft - marginRight; // ~523 pt

      // Resolve Company Details & Logo
      const effectiveCompany = company || profile?.company || null;
      const companyName = effectiveCompany?.name || 'RAPID EMERGENCY MEDICAL SERVICES';
      const companyPhone = effectiveCompany?.cell_number || '011 488 4911';
      const companyPsira = effectiveCompany?.psira_number || '';
      const companyLogoTarget = effectiveCompany?.logo_url || mainLogoUrl || defaultLogoUrl || defaultFallbackLogo;

      let logoImgData = null;
      if (companyLogoTarget) {
        try {
          logoImgData = await loadImageAsDataUrl(companyLogoTarget);
        } catch (e) {
          console.warn('Could not load company logo for PDF:', e);
        }
      }

      let y = 0;

      // Top Brand Stripe
      pdf.setFillColor(185, 28, 28); // #B91C1C
      pdf.rect(0, 0, pageWidth, 5, 'F');

      // HEADER SECTION
      const headerTopY = 16;
      const headerMaxH = 50;

      // Left: Company Logo or Medical Emblem
      let companyInfoX = marginLeft;
      if (logoImgData && logoImgData.dataUrl) {
        const maxLogoW = 95;
        const maxLogoH = 46;
        const ratio = Math.min(maxLogoW / logoImgData.width, maxLogoH / logoImgData.height);
        const logoW = Math.max(20, logoImgData.width * ratio);
        const logoH = Math.max(15, logoImgData.height * ratio);
        const logoY = headerTopY + (maxLogoH - logoH) / 2;

        try {
          pdf.addImage(logoImgData.dataUrl, logoImgData.format, marginLeft, logoY, logoW, logoH);
          companyInfoX = marginLeft + logoW + 12;
        } catch (e) {
          console.warn('Could not embed logo image in PDF:', e);
          companyInfoX = marginLeft;
        }
      }

      if (companyInfoX === marginLeft) {
        // Fallback Vector Medical Emblem
        pdf.setFillColor(185, 28, 28);
        pdf.roundedRect(marginLeft, headerTopY + 2, 40, 40, 6, 6, 'F');
        pdf.setFillColor(255, 255, 255);
        pdf.rect(marginLeft + 16, headerTopY + 10, 8, 24, 'F');
        pdf.rect(marginLeft + 8, headerTopY + 18, 24, 8, 'F');
        companyInfoX = marginLeft + 50;
      }

      // Company Info (Left aligned next to logo)
      const maxCompanyTextWidth = pageWidth - marginRight - 195 - companyInfoX;
      pdf.setTextColor(15, 23, 42); // #0F172A
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      const safeCoName = companyName.toUpperCase();
      const truncatedCoName = pdf.splitTextToSize(safeCoName, Math.max(130, maxCompanyTextWidth))[0];
      pdf.text(truncatedCoName, companyInfoX, headerTopY + 14);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(185, 28, 28);
      pdf.text('EMERGENCY MEDICAL SERVICES & PATIENT CARE', companyInfoX, headerTopY + 26);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 116, 139);
      const regLine = companyPsira 
        ? `HPCSA / PSIRA: ${companyPsira} • 24/7 Dispatch: ${companyPhone}`
        : `Emergency Medical Dispatch: ${companyPhone} • Confidential PCR Record`;
      pdf.text(regLine, companyInfoX, headerTopY + 37);

      // Right: Document Identity & OB Callout Box
      const badgeW = 180;
      const badgeH = 48;
      const badgeX = pageWidth - marginRight - badgeW;
      const badgeY = headerTopY - 2;

      pdf.setFillColor(254, 242, 242); // red-50
      pdf.setDrawColor(248, 113, 113); // red-400
      pdf.setLineWidth(0.75);
      pdf.roundedRect(badgeX, badgeY, badgeW, badgeH, 4, 4, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(153, 27, 27); // red-800
      pdf.text('PATIENT CARE REPORT (PCR)', badgeX + 8, badgeY + 12);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(185, 28, 28);
      pdf.text('Pre-Hospital Scene & Clinical Assessment', badgeX + 8, badgeY + 21);

      pdf.setDrawColor(252, 165, 165);
      pdf.line(badgeX + 8, badgeY + 25, badgeX + badgeW - 8, badgeY + 25);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.setTextColor(185, 28, 28);
      pdf.text(`OB: ${report.ob_number || 'EMS-' + report.id.slice(0, 8)}`, badgeX + 8, badgeY + 38);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 116, 139);
      const timestampStr = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      pdf.text(timestampStr, badgeX + badgeW - 8 - pdf.getTextWidth(timestampStr), badgeY + 38);

      y = headerTopY + headerMaxH + 10;

      // Divider line under header
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(1);
      pdf.line(marginLeft, y, pageWidth - marginRight, y);
      y += 10;

      // Multi-page helper
      const ensureVerticalSpace = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 40) {
          pdf.addPage();
          pdf.setFillColor(185, 28, 28);
          pdf.rect(0, 0, pageWidth, 4, 'F');

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
          pdf.setTextColor(100, 116, 139);
          pdf.text(`PATIENT CARE REPORT • OB: ${report.ob_number || 'N/A'} (CONTINUED)`, marginLeft, 20);
          const coNameText = companyName.slice(0, 40);
          pdf.text(coNameText, pageWidth - marginRight - pdf.getTextWidth(coNameText), 20);

          pdf.setDrawColor(226, 232, 240);
          pdf.line(marginLeft, 24, pageWidth - marginRight, 24);
          y = 34;
        }
      };

      // Section Header Helper
      const renderSectionHeader = (title: string, sectionNum: string) => {
        pdf.setFillColor(30, 41, 59); // slate-800
        pdf.roundedRect(marginLeft, y, contentWidth, 18, 3, 3, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.text(`${sectionNum}. ${title.toUpperCase()}`, marginLeft + 10, y + 12.5);
        y += 20;
      };

      // ==========================================
      // SECTION 1: INCIDENT & DISPATCH SPECIFICATIONS
      // ==========================================
      const locationLines = pdf.splitTextToSize(report.location || 'Scene location not specified', 285);
      const coordsText = report.location_coords 
        ? `${report.location_coords.lat.toFixed(5)}, ${report.location_coords.lng.toFixed(5)}` 
        : 'GPS coordinates not pinned';

      const locHeight = Math.max(1, locationLines.length) * 11 + 22;
      const leftDetailsHeight = 52;
      const sec1CardH = Math.max(leftDetailsHeight, locHeight) + 14;

      ensureVerticalSpace(sec1CardH + 26);
      renderSectionHeader('Incident & Dispatch Specifications', '1');

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.7);
      pdf.roundedRect(marginLeft, y, contentWidth, sec1CardH, 3, 3, 'FD');

      const col1X = marginLeft + 10;
      let rowY = y + 12;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text('OB Reference:', col1X, rowY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(report.ob_number || 'N/A', col1X + 64, rowY);

      rowY += 13;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text('Incident Type:', col1X, rowY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text((report.type || 'MEDICAL EMERGENCY').toUpperCase(), col1X + 64, rowY);

      rowY += 13;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text('Medic On Scene:', col1X, rowY);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      const medicName = profile ? `${profile.first_name} ${profile.surname}` : 'Attending Paramedic';
      pdf.text(medicName.slice(0, 24), col1X + 68, rowY);

      rowY += 13;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text('Reported Time:', col1X, rowY);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(15, 23, 42);
      const incidentTime = report.created_at ? new Date(report.created_at).toLocaleString('en-GB') : new Date().toLocaleString('en-GB');
      pdf.text(incidentTime, col1X + 68, rowY);

      // Vertical Divider
      const midDividerX = marginLeft + 215;
      pdf.setDrawColor(226, 232, 240);
      pdf.line(midDividerX, y + 6, midDividerX, y + sec1CardH - 6);

      // Right Column Content (Location & GPS)
      const col2X = midDividerX + 10;
      let rightY = y + 12;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(185, 28, 28);
      pdf.text('INCIDENT SCENE LOCATION:', col2X, rightY);

      rightY += 11;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
      pdf.text(locationLines, col2X, rightY);

      rightY += (locationLines.length * 10) + 4;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`GPS Coords: ${coordsText}`, col2X, rightY);

      y += sec1CardH + 9;

      // ==========================================
      // SECTION 2: PATIENT DEMOGRAPHICS
      // ==========================================
      const demoCardH = 34;
      ensureVerticalSpace(demoCardH + 26);
      renderSectionHeader('Patient Information & Demographics', '2');

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.7);
      pdf.roundedRect(marginLeft, y, contentWidth, demoCardH, 3, 3, 'FD');

      const c1 = marginLeft + 10;
      const c2 = marginLeft + 185;
      const c3 = marginLeft + 275;
      const c4 = marginLeft + 375;

      // Col 1: Name
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text('PATIENT FULL NAME', c1, y + 11);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      const ptName = formData.patient_name ? formData.patient_name.slice(0, 30) : 'Unidentified / Unknown';
      pdf.text(ptName, c1, y + 23);

      // Col 2: Age
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text('AGE', c2, y + 11);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      const ptAge = formData.patient_age ? `${formData.patient_age} yrs` : 'Unknown';
      pdf.text(ptAge, c2, y + 23);

      // Col 3: Gender
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text('GENDER', c3, y + 11);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      const ptGender = formData.patient_gender || 'Unspecified';
      pdf.text(ptGender, c3, y + 23);

      // Col 4: Contact
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 116, 139);
      pdf.text('CONTACT / NEXT OF KIN', c4, y + 11);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      const ptContact = formData.patient_contact ? formData.patient_contact.slice(0, 24) : 'None reported';
      pdf.text(ptContact, c4, y + 23);

      y += demoCardH + 9;

      // ==========================================
      // SECTION 3: CLINICAL ASSESSMENT & VITALS MATRIX
      // ==========================================
      const complaintLines = pdf.splitTextToSize(formData.chief_complaint || 'No complaint details provided', contentWidth - 20);
      const historyLines = pdf.splitTextToSize(formData.medical_history || 'None reported', 240);
      const allergyLines = pdf.splitTextToSize(formData.allergies || 'NKDA (No Known Drug Allergies)', 240);

      const complaintH = Math.max(1, complaintLines.length) * 10 + 13;
      const histAllergyH = Math.max(historyLines.length, allergyLines.length) * 10 + 13;
      const vitalsH = 46;
      const clinicalCardH = complaintH + histAllergyH + vitalsH + 12;

      ensureVerticalSpace(clinicalCardH + 26);
      renderSectionHeader('Clinical Assessment & Vital Signs Matrix', '3');

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.7);
      pdf.roundedRect(marginLeft, y, contentWidth, clinicalCardH, 3, 3, 'FD');

      let curY = y + 11;

      // Chief Complaint
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(185, 28, 28);
      pdf.text('CHIEF COMPLAINT / EMERGENCY MECHANISM:', marginLeft + 10, curY);

      curY += 10;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
      pdf.text(complaintLines, marginLeft + 10, curY);

      curY += (complaintLines.length * 10) + 5;

      // Divider
      pdf.setDrawColor(241, 245, 249);
      pdf.line(marginLeft + 10, curY, marginLeft + contentWidth - 10, curY);
      curY += 4;

      // Medical History & Allergies (2 Bounded Columns)
      const colLeftX = marginLeft + 10;
      const colRightX = marginLeft + 265;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text('MEDICAL & SURGICAL HISTORY:', colLeftX, curY + 6);
      pdf.text('KNOWN ALLERGIES / DRUG REACTIONS:', colRightX, curY + 6);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.8);
      pdf.setTextColor(15, 23, 42);
      pdf.text(historyLines, colLeftX, curY + 16);

      if (formData.allergies && formData.allergies.toUpperCase() !== 'NKDA' && formData.allergies.toLowerCase() !== 'none') {
        pdf.setTextColor(185, 28, 28);
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setTextColor(15, 23, 42);
      }
      pdf.text(allergyLines, colRightX, curY + 16);

      curY += histAllergyH + 6;

      // Vitals Matrix Header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.2);
      pdf.setTextColor(100, 116, 139);
      pdf.text('RECORDED ON-SCENE VITAL SIGNS', marginLeft + 10, curY);

      curY += 6;

      // 6 Dedicated Vitals Cells
      const vitalsList = [
        { label: 'BLOOD PRESSURE', val: formData.vital_bp || '120/80', unit: 'mmHg' },
        { label: 'PULSE RATE', val: formData.vital_pulse ? `${formData.vital_pulse} bpm` : '76 bpm', unit: 'Heart Rate' },
        { label: 'RESPIRATION', val: formData.vital_resp ? `${formData.vital_resp} /min` : '16 /min', unit: 'Breaths' },
        { label: 'SPO2 OXYGEN', val: formData.vital_spo2 ? `${formData.vital_spo2}%` : '98%', unit: 'Saturation' },
        { label: 'TEMPERATURE', val: formData.vital_temp ? `${formData.vital_temp}°C` : '36.6°C', unit: 'Body Temp' },
        { label: 'GLASGOW (GCS)', val: formData.vital_gcs ? `${formData.vital_gcs} / 15` : '15 / 15', unit: 'Coma Scale' },
      ];

      const vCellW = (contentWidth - 20) / 6;
      const vCellH = 30;

      vitalsList.forEach((v, idx) => {
        const vx = marginLeft + 10 + (idx * vCellW);
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.6);
        pdf.roundedRect(vx, curY, vCellW - 3, vCellH, 2, 2, 'FD');

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(5.8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(v.label, vx + 4, curY + 8);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.8);
        pdf.setTextColor(15, 23, 42);
        pdf.text(v.val, vx + 4, curY + 19);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(5.5);
        pdf.setTextColor(148, 163, 184);
        pdf.text(v.unit, vx + 4, curY + 26);
      });

      y += clinicalCardH + 9;

      // ==========================================
      // SECTION 4: TRIAGE & MEDIC INTERVENTIONS
      // ==========================================
      const treatmentText = formData.treatment_provided || 'Patient evaluated on scene; no invasive procedures required.';
      const treatmentLines = pdf.splitTextToSize(treatmentText, contentWidth - 20);

      const medText = formData.medications_administered || 'None administered';
      const medLines = pdf.splitTextToSize(medText, contentWidth - 20);

      const treatH = (treatmentLines.length * 10) + 13;
      const medH = (medLines.length * 10) + 13;
      const triageCardH = 32 + treatH + medH + 8;

      ensureVerticalSpace(triageCardH + 26);
      renderSectionHeader('Triage Classification & Emergency Care Provided', '4');

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.7);
      pdf.roundedRect(marginLeft, y, contentWidth, triageCardH, 3, 3, 'FD');

      let tY = y + 11;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text('ASSIGNED SCENE TRIAGE LEVEL:', marginLeft + 10, tY + 4);

      let triageBg = [217, 119, 6];
      let triageDesc = 'P2 - VERY URGENT (Immediate care needed, stable airway)';
      const tCode = (formData.triage_level || 'P2').toUpperCase();

      if (tCode === 'P1') {
        triageBg = [220, 38, 38];
        triageDesc = 'P1 - RESUSCITATION / CRITICAL (Immediate Life Support)';
      } else if (tCode === 'P2') {
        triageBg = [217, 119, 6];
        triageDesc = 'P2 - VERY URGENT (Immediate Medical Attention Required)';
      } else if (tCode === 'P3') {
        triageBg = [22, 163, 74];
        triageDesc = 'P3 - URGENT (Stable / Non-Life Threatening)';
      } else if (tCode === 'P4') {
        triageBg = [71, 85, 105];
        triageDesc = 'P4 - NON-URGENT (Routine / Minor Condition)';
      } else if (tCode === 'P0') {
        triageBg = [31, 41, 55];
        triageDesc = 'P0 - FATAL / DECEASED';
      }

      const pillX = marginLeft + 145;
      const pillW = 270;
      const pillH = 15;
      pdf.setFillColor(triageBg[0], triageBg[1], triageBg[2]);
      pdf.roundedRect(pillX, tY - 4, pillW, pillH, 3, 3, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text(triageDesc, pillX + 8, tY + 6.5);

      tY += 21;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text('TREATMENTS & INTERVENTIONS ADMINISTERED ON SCENE:', marginLeft + 10, tY);

      tY += 10;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
      pdf.text(treatmentLines, marginLeft + 10, tY);

      tY += (treatmentLines.length * 10) + 7;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text('MEDICATIONS, DOSAGES & IV FLUIDS ADMINISTERED:', marginLeft + 10, tY);

      tY += 10;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
      pdf.text(medLines, marginLeft + 10, tY);

      y += triageCardH + 9;

      // ==========================================
      // SECTION 5: RECEIVING FACILITY, TRANSPORT & HANDOVER
      // ==========================================
      const finalHospital = formData.receiving_facility === 'Other' 
        ? formData.custom_hospital 
        : (formData.receiving_facility || formData.custom_hospital || 'Unassigned / Treated On Scene');

      const hospLines = pdf.splitTextToSize(finalHospital, 310);
      const notesText = formData.handover_notes || 'Handover completed with receiving emergency department staff. Vitals and condition report transferred.';
      const notesLines = pdf.splitTextToSize(notesText, contentWidth - 20);

      const hospBoxH = Math.max(1, hospLines.length) * 11 + 16;
      const handoverNotesH = (notesLines.length * 10) + 13;
      const handoverCardH = 24 + hospBoxH + handoverNotesH + 8;

      ensureVerticalSpace(handoverCardH + 26);
      renderSectionHeader('Receiving Hospital Facility, Transport & Handover', '5');

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.7);
      pdf.roundedRect(marginLeft, y, contentWidth, handoverCardH, 3, 3, 'FD');

      let hY = y + 11;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text('TRANSPORT DECISION:', marginLeft + 10, hY);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(185, 28, 28);
      pdf.text(formData.transport_decision || 'Transported to Hospital', marginLeft + 115, hY);

      hY += 13;

      // Highlighted Receiving Facility Box
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(marginLeft + 10, hY, contentWidth - 20, hospBoxH, 2, 2, 'FD');

      pdf.setFillColor(185, 28, 28);
      pdf.rect(marginLeft + 10, hY, 3, hospBoxH, 'F');

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('ASSIGNED RECEIVING FACILITY / TRAUMA CENTER:', marginLeft + 18, hY + 10);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(hospLines, marginLeft + 18, hY + 20);

      hY += hospBoxH + 8;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text('HANDOVER CLINICAL NOTES & OBSERVATIONS:', marginLeft + 10, hY);

      hY += 10;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
      pdf.text(notesLines, marginLeft + 10, hY);

      y += handoverCardH + 9;

      // ==========================================
      // SECTION 6: VERIFICATION & SIGN-OFF
      // ==========================================
      const sigCardW = (contentWidth - 14) / 2; // ~254 pt
      const sigCardH = 64;

      ensureVerticalSpace(sigCardH + 26);
      renderSectionHeader('Verification & Handover Sign-Off', '6');

      // Left Card: Attending Medic
      const card1X = marginLeft;
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.7);
      pdf.roundedRect(card1X, y, sigCardW, sigCardH, 3, 3, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.2);
      pdf.setTextColor(185, 28, 28);
      pdf.text('ATTENDING PARAMEDIC / MEDIC SIGN-OFF', card1X + 8, y + 11);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(15, 23, 42);
      const medicFullName = profile ? `${profile.first_name} ${profile.surname}` : 'Attending Paramedic';
      pdf.text(`Name: ${medicFullName}`, card1X + 8, y + 23);

      pdf.setDrawColor(148, 163, 184);
      pdf.setLineWidth(0.6);
      pdf.line(card1X + 8, y + 45, card1X + sigCardW - 8, y + 45);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Signature & HPCSA / PSIRA Registration No.', card1X + 8, y + 55);

      const nowFormatted = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateMedicStr = `Date: ${nowFormatted}`;
      pdf.text(dateMedicStr, card1X + sigCardW - 8 - pdf.getTextWidth(dateMedicStr), y + 55);

      // Right Card: Receiving ER Staff
      const card2X = marginLeft + sigCardW + 14;
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.7);
      pdf.roundedRect(card2X, y, sigCardW, sigCardH, 3, 3, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.2);
      pdf.setTextColor(71, 85, 105);
      pdf.text('RECEIVING ER STAFF HANDOVER ACCEPTANCE', card2X + 8, y + 11);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Print Name: _________________________________', card2X + 8, y + 23);

      pdf.setDrawColor(148, 163, 184);
      pdf.setLineWidth(0.6);
      pdf.line(card2X + 8, y + 45, card2X + sigCardW - 8, y + 45);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text('ER Staff Handover Signature', card2X + 8, y + 55);
      const timeRcvStr = 'Time Received: ____________';
      pdf.text(timeRcvStr, card2X + sigCardW - 8 - pdf.getTextWidth(timeRcvStr), y + 55);

      y += sigCardH + 12;

      // ==========================================
      // FOOTER ON ALL PAGES
      // ==========================================
      const totalPages = (pdf.internal as any).getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);

        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.8);
        pdf.line(marginLeft, pageHeight - 26, pageWidth - marginRight, pageHeight - 26);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(148, 163, 184);

        // Left
        pdf.text(`CONFIDENTIAL MEDICAL RECORD • ${companyName.toUpperCase()}`, marginLeft, pageHeight - 16);

        // Center
        const centerDisclaimer = 'Rapid iReport EMS & Community Safety Platform';
        pdf.text(centerDisclaimer, (pageWidth - pdf.getTextWidth(centerDisclaimer)) / 2, pageHeight - 16);

        // Right
        const pageNumStr = `Page ${i} of ${totalPages}`;
        pdf.text(pageNumStr, pageWidth - marginRight - pdf.getTextWidth(pageNumStr), pageHeight - 16);
      }

      pdf.save(`PCR-${report.ob_number || report.id.slice(0, 8)}.pdf`);
    } catch (err: any) {
      console.error('Error generating EMS report:', err);
      alert('Failed to save or generate report: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedHospitalName = formData.receiving_facility === 'Other' 
    ? formData.custom_hospital 
    : (formData.receiving_facility || formData.custom_hospital);

  const effectiveCompany = company || profile?.company || null;
  const companyLogoUrl = effectiveCompany?.logo_url || mainLogoUrl || defaultLogoUrl || defaultFallbackLogo;
  const companyDisplayName = effectiveCompany?.name || 'Emergency Medical Services';

  return (
    <div className="bg-gray-50 dark:bg-gray-950 w-full overflow-x-hidden pb-12 rounded-2xl">
      {/* Header Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20 p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          <button 
            type="button"
            onClick={onBack} 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors shrink-0 mt-0.5 sm:mt-0 cursor-pointer"
            title="Back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Company Branding Logo in on-screen Header */}
          {companyLogoUrl ? (
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1 flex items-center justify-center shrink-0 shadow-xs">
              <img 
                src={companyLogoUrl} 
                alt={companyDisplayName} 
                className="max-h-full max-w-full object-contain" 
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs font-black text-sm">
              EMS
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 leading-tight">
                <HeartPulseIcon className="w-5 h-5 text-red-600 shrink-0 animate-pulse" />
                <span className="truncate">Patient Care Report & Scene Assessment</span>
              </h1>
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold text-[10px] rounded-md border border-gray-200 dark:border-gray-700">
                {companyDisplayName}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              <span className="font-bold text-red-600 dark:text-red-400">OB: {report.ob_number}</span> • {report.title} • {report.location}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <button
            type="button"
            onClick={handleGenerateAndSave}
            disabled={isGenerating}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-red-600/20 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <DownloadIcon className="w-4 h-4" />
            )}
            <span>Save PCR & Export PDF</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {toastMessage && (
          <div className="p-4 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 rounded-2xl text-green-800 dark:text-green-300 text-sm font-semibold flex items-center gap-3 shadow-sm animate-fade-in">
            <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 flex items-start gap-3">
          <ShieldAlertIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-bold">Medic On-Scene Workflow Notice:</span> Triage priority level and receiving hospital are not assigned upon initial response dispatch. As the responding Medic on scene, perform patient assessment, select required treatments, assign the official Triage Level, and select the destination Receiving Hospital below.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Section 1: Medic On-Scene Triage & Hospital Assignment */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs md:col-span-2">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100 dark:border-gray-800 text-red-600 dark:text-red-400 font-bold text-base">
              <HospitalIcon className="w-5 h-5" />
              MEDIC DECISION: TRIAGE & RECEIVING HOSPITAL
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Triage Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Assign Triage Priority Level (Medic Evaluation)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { code: 'P1', label: 'P1 RED (Critical / Life Support)', color: 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300' },
                    { code: 'P2', label: 'P2 YELLOW (Urgent Care)', color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300' },
                    { code: 'P3', label: 'P3 GREEN (Non-Urgent / Routine)', color: 'border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300' },
                    { code: 'P4', label: 'P4 BLUE (Deceased)', color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' },
                    { code: 'P0', label: 'P0 BLACK (Fatal)', color: 'border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100' }
                  ].map(t => (
                    <button
                      key={t.code}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, triage_level: t.code }))}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                        formData.triage_level === t.code
                          ? `${t.color} ring-2 ring-red-500 ring-offset-1 dark:ring-offset-gray-900 shadow-xs`
                          : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      <span>{t.label}</span>
                      {formData.triage_level === t.code && <CheckCircleIcon className="w-4 h-4 text-red-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transport Decision & Receiving Hospital */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Transport Disposition
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  {[
                    { id: 'Transported to Hospital', label: '🚑 Hospital Transport', color: 'bg-blue-50 text-blue-700 border-blue-300' },
                    { id: 'Patient Refusal of Care & Transport', label: '🚫 Patient Refusal', color: 'bg-amber-50 text-amber-700 border-amber-300' },
                    { id: 'Treated On Scene - Not Transported', label: '🏠 Treated On Scene', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        transport_decision: item.id,
                        receiving_facility: item.id !== 'Transported to Hospital' ? item.id : prev.receiving_facility
                      }))}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        formData.transport_decision === item.id
                          ? 'ring-2 ring-red-500 bg-red-600 text-white border-red-600 shadow-sm'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {formData.transport_decision === 'Transported to Hospital' && (
                  <>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Assign Receiving Hospital / Facility
                    </label>
                    <div className="space-y-2">
                      <select
                        name="receiving_facility"
                        value={formData.receiving_facility}
                        onChange={handleInputChange}
                        className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white"
                      >
                        <option value="">Select Receiving Hospital...</option>
                        {POPULAR_HOSPITALS.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                        <option value="Other">Other / Custom Facility...</option>
                      </select>

                      {formData.receiving_facility === 'Other' && (
                        <input
                          type="text"
                          name="custom_hospital"
                          placeholder="Type hospital or clinic name..."
                          value={formData.custom_hospital}
                          onChange={handleInputChange}
                          className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-red-300 dark:border-red-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white"
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Patient Demographics */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100 dark:border-gray-800 text-red-600 dark:text-red-400 font-bold text-sm">
              <HeartPulseIcon className="w-5 h-5" />
              PATIENT DEMOGRAPHICS
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Patient Full Name</label>
                <input type="text" name="patient_name" value={formData.patient_name} onChange={handleInputChange} placeholder="e.g. John Doe / Unidentified Male" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Age</label>
                  <input type="text" name="patient_age" value={formData.patient_age} onChange={handleInputChange} placeholder="e.g. 34" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Gender</label>
                  <select name="patient_gender" value={formData.patient_gender} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium">
                    <option value="">Select gender...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other / Unknown</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Contact / Next of Kin</label>
                <input type="text" name="patient_contact" value={formData.patient_contact} onChange={handleInputChange} placeholder="e.g. 082 123 4567" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Medical History</label>
                  <input type="text" name="medical_history" value={formData.medical_history} onChange={handleInputChange} placeholder="e.g. Asthma, Hypertension, None" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Allergies</label>
                  <input type="text" name="allergies" value={formData.allergies} onChange={handleInputChange} placeholder="e.g. Penicillin, Latex, NKDA" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Baseline Vitals */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100 dark:border-gray-800 text-red-600 dark:text-red-400 font-bold text-sm">
              <HeartPulseIcon className="w-5 h-5" />
              BASELINE VITAL SIGNS
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Blood Pressure</label>
                <input type="text" name="vital_bp" value={formData.vital_bp} onChange={handleInputChange} placeholder="120/80" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-center" />
                <span className="text-[10px] text-gray-400 block text-center mt-0.5">mmHg</span>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Pulse / HR</label>
                <input type="text" name="vital_pulse" value={formData.vital_pulse} onChange={handleInputChange} placeholder="76" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-center" />
                <span className="text-[10px] text-gray-400 block text-center mt-0.5">bpm</span>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Respirations</label>
                <input type="text" name="vital_resp" value={formData.vital_resp} onChange={handleInputChange} placeholder="16" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-center" />
                <span className="text-[10px] text-gray-400 block text-center mt-0.5">breaths/min</span>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">SpO2 Oxygen</label>
                <input type="text" name="vital_spo2" value={formData.vital_spo2} onChange={handleInputChange} placeholder="98" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-center" />
                <span className="text-[10px] text-gray-400 block text-center mt-0.5">% Room Air</span>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Temperature</label>
                <input type="text" name="vital_temp" value={formData.vital_temp} onChange={handleInputChange} placeholder="36.6" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-center" />
                <span className="text-[10px] text-gray-400 block text-center mt-0.5">°C</span>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">GCS</label>
                <input type="text" name="vital_gcs" value={formData.vital_gcs} onChange={handleInputChange} placeholder="15" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-center" />
                <span className="text-[10px] text-gray-400 block text-center mt-0.5">/ 15</span>
              </div>
            </div>
          </div>

          {/* Section 4: Clinical Assessment & Treatment Provided */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs md:col-span-2">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100 dark:border-gray-800 text-red-600 dark:text-red-400 font-bold text-sm">
              <StethoscopeIcon className="w-5 h-5" />
              MEDIC TREATMENT & INTERVENTIONS REQUIRED
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Chief Complaint & On-Scene Findings</label>
                <textarea name="chief_complaint" value={formData.chief_complaint} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" placeholder="Patient condition, primary symptoms, mechanisms of injury..." />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Quick Select Treatments & Interventions Provided
                </label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {COMMON_TREATMENTS.map(t => {
                    const isSelected = formData.treatment_provided.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleToggleTreatment(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-red-600 text-white border-red-600 shadow-xs'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '} {t}
                      </button>
                    );
                  })}
                </div>

                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Detailed Treatment Description</label>
                <textarea name="treatment_provided" value={formData.treatment_provided} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" placeholder="Describe medical treatments administered..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Medications Administered</label>
                  <textarea name="medications_administered" value={formData.medications_administered} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" placeholder="Drug, dosage, route..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Handover & Hospital Notes</label>
                  <textarea name="handover_notes" value={formData.handover_notes} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" placeholder="Notes for ER receiving doctor/nurse..." />
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl font-bold text-xs hover:bg-gray-300 transition-colors cursor-pointer"
          >
            Cancel / Back
          </button>
          <button
            type="button"
            onClick={handleGenerateAndSave}
            disabled={isGenerating}
            className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-600/30 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <DownloadIcon className="w-5 h-5" />}
            Save Scene Report & Export PCR
          </button>
        </div>
      </div>
    </div>
  );
};

