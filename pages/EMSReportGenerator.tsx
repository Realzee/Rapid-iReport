import React, { useState } from 'react';
import { Report, Profile } from '../types';
import jsPDF from 'jspdf';
import { ArrowLeftIcon, DownloadIcon, FileTextIcon, HeartPulseIcon } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface EMSReportGeneratorProps {
  report: Report;
  profile?: Profile | null;
  onBack: () => void;
}

export const EMSReportGenerator: React.FC<EMSReportGeneratorProps> = ({ report, profile, onBack }) => {
  const [formData, setFormData] = useState({
    patient_name: '',
    patient_age: '',
    patient_gender: '',
    patient_contact: '',
    chief_complaint: '',
    medical_history: 'None',
    allergies: 'NKDA',
    vital_bp: '',
    vital_pulse: '',
    vital_resp: '',
    vital_spo2: '',
    vital_temp: '',
    vital_gcs: '15',
    treatment_provided: '',
    medications_administered: 'None',
    transport_decision: 'Transported to Hospital',
    receiving_facility: '',
    handover_notes: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerateAndSave = async () => {
    setIsGenerating(true);
    try {
      // 1. Save to Database (if table exists/ready)
      if (profile) {
        const { error } = await supabase.from('ems_assessments').insert([{
          report_id: report.id,
          ...formData,
          assessed_by: profile.id
        }]);
        if (error) {
            console.warn("Could not save to DB (schema might not be ready), generating PDF anyway.", error);
        } else {
            setIsSaved(true);
        }
      }

      // 2. Generate PDF
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 40;
      let y = 40;

      // Header
      pdf.setFillColor(220, 38, 38); // Red-600
      pdf.rect(0, 0, pageWidth, 60, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PATIENT CARE REPORT', margin, 38);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin - 100, 38);

      y = 90;
      
      // Incident Info
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('INCIDENT DETAILS', margin, y);
      y += 20;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`OB Number: ${report.ob_number}`, margin, y);
      pdf.text(`Location: ${report.location}`, margin + 200, y);
      y += 30;

      // Patient Info
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PATIENT INFORMATION', margin, y);
      y += 20;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Name: ${formData.patient_name || 'N/A'}`, margin, y);
      pdf.text(`Age: ${formData.patient_age || 'N/A'}`, margin + 200, y);
      pdf.text(`Gender: ${formData.patient_gender || 'N/A'}`, margin + 350, y);
      y += 15;
      pdf.text(`Contact: ${formData.patient_contact || 'N/A'}`, margin, y);
      y += 30;

      // Medical Info
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('CLINICAL ASSESSMENT', margin, y);
      y += 20;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Chief Complaint: ${formData.chief_complaint || 'N/A'}`, margin, y);
      y += 15;
      pdf.text(`Medical History: ${formData.medical_history || 'N/A'}`, margin, y);
      y += 15;
      pdf.text(`Allergies: ${formData.allergies || 'N/A'}`, margin, y);
      y += 30;

      // Vitals
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('VITAL SIGNS', margin, y);
      y += 20;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`BP: ${formData.vital_bp || '___/___'}`, margin, y);
      pdf.text(`Pulse: ${formData.vital_pulse || '___'} bpm`, margin + 150, y);
      pdf.text(`Resp: ${formData.vital_resp || '___'} /min`, margin + 280, y);
      pdf.text(`SpO2: ${formData.vital_spo2 || '___'} %`, margin + 410, y);
      y += 15;
      pdf.text(`Temp: ${formData.vital_temp || '___'} °C`, margin, y);
      pdf.text(`GCS: ${formData.vital_gcs || '___'} /15`, margin + 150, y);
      y += 30;

      // Treatment
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('TREATMENT & INTERVENTIONS', margin, y);
      y += 20;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const treatmentLines = pdf.splitTextToSize(`Treatment: ${formData.treatment_provided || 'N/A'}`, pageWidth - (margin * 2));
      pdf.text(treatmentLines, margin, y);
      y += (treatmentLines.length * 15) + 5;

      const medLines = pdf.splitTextToSize(`Medications: ${formData.medications_administered || 'N/A'}`, pageWidth - (margin * 2));
      pdf.text(medLines, margin, y);
      y += (medLines.length * 15) + 20;

      // Outcome
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('OUTCOME / DISPOSITION', margin, y);
      y += 20;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Decision: ${formData.transport_decision}`, margin, y);
      y += 15;
      pdf.text(`Receiving Facility: ${formData.receiving_facility || 'N/A'}`, margin, y);
      y += 15;
      const notesLines = pdf.splitTextToSize(`Handover Notes: ${formData.handover_notes || 'N/A'}`, pageWidth - (margin * 2));
      pdf.text(notesLines, margin, y);
      y += (notesLines.length * 15) + 30;

      // Signatures
      pdf.line(margin, y, margin + 150, y);
      pdf.text('Responder Signature', margin, y + 15);
      
      pdf.line(margin + 200, y, margin + 350, y);
      pdf.text('Receiving Facility / Patient Signature', margin + 200, y + 15);

      pdf.save(`PCR-${report.ob_number}.pdf`);
    } catch (err) {
      console.error('Error generating EMS report:', err);
      alert('Failed to generate report.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 px-4 md:px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <HeartPulseIcon className="w-6 h-6 text-red-600" />
              Patient Care Report
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">OB: {report.ob_number} • {report.title}</p>
          </div>
        </div>
        <button
          onClick={handleGenerateAndSave}
          disabled={isGenerating}
          className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50"
        >
          {isGenerating ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <DownloadIcon className="w-5 h-5" />
          )}
          Generate PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {isSaved && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-400 text-sm font-semibold flex items-center gap-2">
            ✓ Report successfully saved to database.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Patient Details */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">Patient Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Full Name</label>
                <input type="text" name="patient_name" value={formData.patient_name} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="John Doe" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Age</label>
                  <input type="text" name="patient_age" value={formData.patient_age} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="e.g. 45" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Gender</label>
                  <select name="patient_gender" value={formData.patient_gender} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Contact Number</label>
                <input type="text" name="patient_contact" value={formData.patient_contact} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="+27..." />
              </div>
            </div>
          </div>

          {/* Vitals */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">Vital Signs</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">BP (mmHg)</label>
                <input type="text" name="vital_bp" value={formData.vital_bp} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="120/80" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Pulse (bpm)</label>
                <input type="text" name="vital_pulse" value={formData.vital_pulse} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="72" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Resp (/min)</label>
                <input type="text" name="vital_resp" value={formData.vital_resp} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="16" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">SpO2 (%)</label>
                <input type="text" name="vital_spo2" value={formData.vital_spo2} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="98" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Temp (°C)</label>
                <input type="text" name="vital_temp" value={formData.vital_temp} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="36.5" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">GCS</label>
                <select name="vital_gcs" value={formData.vital_gcs} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
                  {[...Array(13)].map((_, i) => <option key={i+3} value={15-i}>{15-i}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Clinical */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm md:col-span-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">Clinical Assessment & Treatment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Chief Complaint</label>
                <textarea name="chief_complaint" value={formData.chief_complaint} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="Patient complains of..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Medical History</label>
                  <textarea name="medical_history" value={formData.medical_history} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="None" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Allergies</label>
                  <textarea name="allergies" value={formData.allergies} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="NKDA" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Treatment Provided</label>
                <textarea name="treatment_provided" value={formData.treatment_provided} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="Oxygen administered, wound dressed..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Medications Administered</label>
                <textarea name="medications_administered" value={formData.medications_administered} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="None" />
              </div>
            </div>
          </div>

          {/* Disposition */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm md:col-span-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">Outcome & Disposition</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Transport Decision</label>
                <select name="transport_decision" value={formData.transport_decision} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
                  <option value="Transported to Hospital">Transported to Hospital</option>
                  <option value="Treated and Released">Treated and Released</option>
                  <option value="Refused Care">Refused Care</option>
                  <option value="Transferred to other Service">Transferred to other Service</option>
                  <option value="DOA">DOA</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Receiving Facility</label>
                <input type="text" name="receiving_facility" value={formData.receiving_facility} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="General Hospital" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Handover Notes</label>
                <textarea name="handover_notes" value={formData.handover_notes} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm" placeholder="Handed over to Dr. Smith at 14:30..." />
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};
