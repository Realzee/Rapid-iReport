import React, { useState } from 'react';
import { Report, Profile } from '../types';
import jsPDF from 'jspdf';
import { ArrowLeftIcon, DownloadIcon, HeartPulseIcon, CheckCircleIcon, HospitalIcon, StethoscopeIcon, ShieldAlertIcon } from 'lucide-react';
import { supabase } from '../utils/supabase';

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

export const EMSReportGenerator: React.FC<EMSReportGeneratorProps> = ({ report, profile, onBack }) => {
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
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 40;
      let y = 40;

      // Header Banner
      pdf.setFillColor(220, 38, 38); // Red-600
      pdf.rect(0, 0, pageWidth, 60, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PATIENT CARE & SCENE ASSESSMENT REPORT', margin, 38);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, pageWidth - margin - 140, 38);

      y = 85;
      
      // Incident Details
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('INCIDENT DETAILS', margin, y);
      y += 18;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`OB Number: ${report.ob_number || 'N/A'}`, margin, y);
      pdf.text(`Location: ${report.location}`, margin + 180, y);
      pdf.text(`Medic: ${profile ? `${profile.first_name} ${profile.surname}` : 'Responder'}`, margin + 380, y);
      y += 25;

      // Patient Info
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PATIENT INFORMATION', margin, y);
      y += 18;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Name: ${formData.patient_name || 'Unidentified'}`, margin, y);
      pdf.text(`Age: ${formData.patient_age || 'N/A'}`, margin + 180, y);
      pdf.text(`Gender: ${formData.patient_gender || 'N/A'}`, margin + 300, y);
      pdf.text(`Contact: ${formData.patient_contact || 'N/A'}`, margin + 400, y);
      y += 25;

      // Clinical Assessment
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('CLINICAL ASSESSMENT & VITALS', margin, y);
      y += 18;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Chief Complaint: ${formData.chief_complaint || 'N/A'}`, margin, y);
      y += 14;
      pdf.text(`Medical History: ${formData.medical_history || 'None'}`, margin, y);
      pdf.text(`Allergies: ${formData.allergies || 'NKDA'}`, margin + 250, y);
      y += 18;

      // Vitals Box
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, y, pageWidth - (margin * 2), 35, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.text(`BP: ${formData.vital_bp || 'N/A'}`, margin + 10, y + 22);
      pdf.text(`Pulse: ${formData.vital_pulse || 'N/A'} bpm`, margin + 100, y + 22);
      pdf.text(`Resp: ${formData.vital_resp || 'N/A'} /min`, margin + 200, y + 22);
      pdf.text(`SpO2: ${formData.vital_spo2 || 'N/A'} %`, margin + 300, y + 22);
      pdf.text(`Temp: ${formData.vital_temp || 'N/A'} °C`, margin + 380, y + 22);
      pdf.text(`GCS: ${formData.vital_gcs || '15'} /15`, margin + 460, y + 22);
      y += 50;

      // Medic Decisions & Treatment
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('MEDIC DECISIONS & TREATMENT PROVIDED', margin, y);
      y += 18;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Triage Level Assigned by Medic: `, margin, y);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(220, 38, 38);
      pdf.text(`${formData.triage_level}`, margin + 175, y);
      pdf.setTextColor(0, 0, 0);
      y += 16;

      pdf.setFont('helvetica', 'normal');
      const treatmentLines = pdf.splitTextToSize(`Treatments Administered: ${formData.treatment_provided || 'None'}`, pageWidth - (margin * 2));
      pdf.text(treatmentLines, margin, y);
      y += (treatmentLines.length * 14) + 5;

      const medLines = pdf.splitTextToSize(`Medications Administered: ${formData.medications_administered || 'None'}`, pageWidth - (margin * 2));
      pdf.text(medLines, margin, y);
      y += (medLines.length * 14) + 20;

      // Destination & Handover
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RECEIVING HOSPITAL & HANDOVER', margin, y);
      y += 18;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Transport Decision: ${formData.transport_decision}`, margin, y);
      y += 14;
      
      const finalHospital = formData.receiving_facility === 'Other' ? formData.custom_hospital : (formData.receiving_facility || formData.custom_hospital || 'Unassigned');
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Assigned Receiving Hospital: ${finalHospital}`, margin, y);
      pdf.setFont('helvetica', 'normal');
      y += 16;

      const notesLines = pdf.splitTextToSize(`Handover / Clinical Notes: ${formData.handover_notes || 'None'}`, pageWidth - (margin * 2));
      pdf.text(notesLines, margin, y);
      y += (notesLines.length * 14) + 35;

      // Signatures
      pdf.line(margin, y, margin + 180, y);
      pdf.text('Medic / Responder Signature', margin, y + 14);
      
      pdf.line(margin + 240, y, margin + 440, y);
      pdf.text('Receiving ER Nurse / Doctor Handover Signature', margin + 240, y + 14);

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

  return (
    <div className="bg-gray-50 dark:bg-gray-950 min-h-screen pb-12">
      {/* Header Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20 px-4 md:px-8 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <HeartPulseIcon className="w-6 h-6 text-red-600" />
              Medic Scene Report & Patient Care Assessment
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">OB: {report.ob_number} • {report.title} • {report.location}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateAndSave}
            disabled={isGenerating}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
          >
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <DownloadIcon className="w-5 h-5" />
            )}
            Save Scene Report & Export PDF
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
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
                    <select
                      name="receiving_facility"
                      value={formData.receiving_facility}
                      onChange={handleInputChange}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white mb-3"
                    >
                      <option value="">-- Select Receiving Hospital --</option>
                      {POPULAR_HOSPITALS.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                      <option value="Other">Other / Custom Facility Name...</option>
                    </select>

                    {(formData.receiving_facility === 'Other' || (!POPULAR_HOSPITALS.includes(formData.receiving_facility) && formData.receiving_facility !== 'Patient Refusal of Care & Transport' && formData.receiving_facility !== 'Treated On Scene - Not Transported')) && (
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                          Custom Hospital / Trauma Center Name
                        </label>
                        <input
                          type="text"
                          name="custom_hospital"
                          value={formData.custom_hospital}
                          onChange={handleInputChange}
                          className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium"
                          placeholder="e.g. Life Eugene Marais Hospital"
                        />
                      </div>
                    )}
                  </>
                )}

                {formData.transport_decision !== 'Transported to Hospital' && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-semibold">
                    ⚠️ Call will be logged as {formData.transport_decision}. Refusal form / On-scene disposition documentation generated.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Patient Details */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">Patient Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Patient Full Name / ID</label>
                <input type="text" name="patient_name" value={formData.patient_name} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" placeholder="John Doe or Unidentified Male #1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Age</label>
                  <input type="text" name="patient_age" value={formData.patient_age} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" placeholder="e.g. 34" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Gender</label>
                  <select name="patient_gender" value={formData.patient_gender} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium">
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Patient Contact / NOK</label>
                <input type="text" name="patient_contact" value={formData.patient_contact} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" placeholder="Phone or Next of Kin" />
              </div>
            </div>
          </div>

          {/* Section 3: Vital Signs */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">Vital Signs Assessment</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">BP (mmHg)</label>
                <input type="text" name="vital_bp" value={formData.vital_bp} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" placeholder="120/80" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Pulse (bpm)</label>
                <input type="text" name="vital_pulse" value={formData.vital_pulse} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" placeholder="76" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Resp (/min)</label>
                <input type="text" name="vital_resp" value={formData.vital_resp} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" placeholder="16" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">SpO2 (%)</label>
                <input type="text" name="vital_spo2" value={formData.vital_spo2} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" placeholder="98" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Temp (°C)</label>
                <input type="text" name="vital_temp" value={formData.vital_temp} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium" placeholder="36.6" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">GCS Score</label>
                <select name="vital_gcs" value={formData.vital_gcs} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium">
                  {[...Array(13)].map((_, i) => <option key={i+3} value={15-i}>{15-i} / 15</option>)}
                </select>
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
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
            className="px-5 py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-xl font-bold text-xs hover:bg-gray-300 transition-colors"
          >
            Cancel / Back
          </button>
          <button
            type="button"
            onClick={handleGenerateAndSave}
            disabled={isGenerating}
            className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-600/30 disabled:opacity-50"
          >
            {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <DownloadIcon className="w-5 h-5" />}
            Save Scene Report & Assign Hospital
          </button>
        </div>
      </div>
    </div>
  );
};
