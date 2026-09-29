import React, { useState } from 'react';
import { Report, Profile, ReportStatus, UserRole } from '../types';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import { logUserAction } from '../utils/logger';
import { ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, X, FileText, Info } from 'lucide-react';

interface VerifyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: Report;
  profile: Profile;
  onSuccess?: (updatedReport?: Partial<Report>) => void;
}

const VERIFIED_METHODS = [
  'On-Scene Responder / Officer Confirmation',
  'SAPS Docket / CAS Number Verified',
  'Complainant / Client Direct Contact Verified',
  'CCTV / Photographic Evidence Verified',
  'Control Room Operations Verified',
];

const FALSE_ALARM_REASONS = [
  'Accidental Panic / System Trigger',
  'No Incident Found Upon Arrival (Unfounded)',
  'Hoax / Malicious False Alarm',
  'Duplicate Incident Report',
  'Resolved Prior to Dispatch (Stand Down)',
  'Testing / System Demonstration',
  'Other / Unsubstantiated',
];

export const VerifyReportModal: React.FC<VerifyReportModalProps> = ({
  isOpen,
  onClose,
  report,
  profile,
  onSuccess,
}) => {
  const { addToast } = useToast();
  const [decision, setDecision] = useState<'verified' | 'false_alarm'>('verified');
  const [methodOrReason, setMethodOrReason] = useState<string>(VERIFIED_METHODS[0]);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const canVerify = [
    UserRole.ADMIN,
    UserRole.MODERATOR,
    UserRole.CONTROLLER,
    UserRole.EMS_CONTROLLER,
    UserRole.SUPERVISOR,
  ].includes(profile.role);

  const handleDecisionChange = (newDecision: 'verified' | 'false_alarm') => {
    setDecision(newDecision);
    if (newDecision === 'verified') {
      setMethodOrReason(VERIFIED_METHODS[0]);
    } else {
      setMethodOrReason(FALSE_ALARM_REASONS[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canVerify) {
      addToast('Admin or Controller permission required to verify reports.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const isFalseAlarm = decision === 'false_alarm';
      const targetStatus = isFalseAlarm ? ReportStatus.FALSE_ALARM : ReportStatus.VERIFIED;
      const nowIso = new Date().toISOString();

      let tableName = 'crime_reports';
      if (report.type === 'vehicle') tableName = 'vehicle_reports';
      else if (report.type === 'emergency' || report.type === 'roadside') tableName = 'emergency_reports';

      const updateData: any = {
        status: targetStatus,
        updated_at: nowIso,
      };

      if (isFalseAlarm) {
        updateData.completed_at = nowIso;
      }

      // Check if legacy report
      const isLegacy = (report as any).is_legacy || report.id.startsWith('legacy-');

      if (!isLegacy && supabase) {
        const { error: updateError } = await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', report.id);

        if (updateError) {
          console.warn('Database update fallback attempt:', updateError.message);
        }

        // Post audit log into report_updates table
        const updateLogContent = isFalseAlarm
          ? `[REPORT CLASSIFIED AS FALSE ALARM] Verified by ${profile.first_name} ${profile.surname} (${profile.role.toUpperCase()}). Reason: ${methodOrReason}. ${verificationNotes ? `Notes: ${verificationNotes}` : ''}`
          : `[REPORT VERIFIED AS GENUINE] Confirmed by ${profile.first_name} ${profile.surname} (${profile.role.toUpperCase()}). Method: ${methodOrReason}. ${verificationNotes ? `Notes: ${verificationNotes}` : ''}`;

        try {
          await supabase.from('report_updates').insert({
            report_id: report.id,
            user_id: profile.id,
            content: updateLogContent,
          });
        } catch (logErr) {
          console.error('Error logging update to report_updates:', logErr);
        }
      }

      // Log in system logger
      logUserAction(
        profile.id,
        isFalseAlarm ? 'MARK_FALSE_ALARM' : 'VERIFY_REPORT',
        `Report ${report.ob_number} marked as ${isFalseAlarm ? 'FALSE ALARM' : 'VERIFIED'}: ${methodOrReason}`
      );

      addToast(
        isFalseAlarm
          ? `Report ${report.ob_number} marked as False Alarm.`
          : `Report ${report.ob_number} marked as Verified Incident.`,
        isFalseAlarm ? 'info' : 'success'
      );

      if (onSuccess) {
        onSuccess({
          ...updateData,
          verification_status: decision,
          verified_by: profile.id,
          verified_at: nowIso,
          verification_notes: `${methodOrReason}${verificationNotes ? ` - ${verificationNotes}` : ''}`,
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to verify report:', err);
      addToast(err?.message || 'Failed to update report verification status', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reportTitle = report.type === 'vehicle' ? (report as any).license_plate || (report as any).vehicle_make || 'Vehicle' : report.title;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 pt-12 sm:pt-4 overflow-y-auto bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-xl my-0 sm:my-auto overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${decision === 'verified' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
              {decision === 'verified' ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Verify Incident Report
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {report.ob_number} • {reportTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Decision Cards */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
              Select Verification Outcome
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Verified */}
              <button
                type="button"
                onClick={() => handleDecisionChange('verified')}
                className={`p-4 rounded-xl border text-left transition-all relative ${
                  decision === 'verified'
                    ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/30 shadow-sm'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-800/40 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-5 h-5 ${decision === 'verified' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
                    <span className="font-bold text-sm">Verified Incident</span>
                  </div>
                  {decision === 'verified' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"></span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Confirmed legitimate incident. Includes in official analytics and authorizes continued operational response.
                </p>
              </button>

              {/* Option 2: False Alarm */}
              <button
                type="button"
                onClick={() => handleDecisionChange('false_alarm')}
                className={`p-4 rounded-xl border text-left transition-all relative ${
                  decision === 'false_alarm'
                    ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 ring-2 ring-amber-500/30 shadow-sm'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-800/40 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-5 h-5 ${decision === 'false_alarm' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
                    <span className="font-bold text-sm">False Alarm</span>
                  </div>
                  {decision === 'false_alarm' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-500/20"></span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Hoax, duplicate, or accidental trigger. Closes report and excludes from crime analytics to prevent distortion.
                </p>
              </button>
            </div>
          </div>

          {/* Reason / Method Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              {decision === 'verified' ? 'Verification Method' : 'False Alarm Classification'}
            </label>
            <select
              value={methodOrReason}
              onChange={(e) => setMethodOrReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
            >
              {(decision === 'verified' ? VERIFIED_METHODS : FALSE_ALARM_REASONS).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              Controller Audit Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              placeholder={
                decision === 'verified'
                  ? 'e.g., CAS number confirmed with SAPS desk officer; on-scene unit in contact with victim...'
                  : 'e.g., Security patrol completed perimeter search, confirmed accidental fence beam trigger...'
              }
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"
            />
          </div>

          {/* Analytics notice banner */}
          <div className={`p-3 rounded-xl flex items-start gap-2.5 text-xs ${
            decision === 'false_alarm'
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
          }`}>
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">
                {decision === 'false_alarm'
                  ? 'Analytics Safeguard Active:'
                  : 'Analytics Integrity:'}
              </p>
              <p className="opacity-90">
                {decision === 'false_alarm'
                  ? 'Marking as False Alarm records the event for false alarm telemetry while protecting crime density, response rate, and security incident statistics from false positives.'
                  : 'Marking as Verified guarantees high confidence reporting and validates this incident in operational KPIs and hotspot density models.'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm transition flex items-center gap-2 ${
                decision === 'verified'
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-600/20'
                  : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 shadow-amber-600/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  {decision === 'verified' ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  <span>{decision === 'verified' ? 'Confirm Verification' : 'Mark as False Alarm'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VerifyReportModal;
