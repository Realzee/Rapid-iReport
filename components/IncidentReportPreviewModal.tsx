import React from 'react';
import { Report, Company } from '../types';
import PrintableReport from './PrintableReport';
import { Printer, Download, X, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';

interface IncidentReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: Report | null;
  timelineEvents?: (
    | { id: string; type: 'update'; content: string; author: string | null; created_at: string; }
    | { id: string; type: 'assignment'; content: string; author: string | null; created_at: string; }
  )[];
  reporterName?: string | null;
  company?: Company | null;
}

export const IncidentReportPreviewModal: React.FC<IncidentReportPreviewModalProps> = ({
  isOpen,
  onClose,
  report,
  timelineEvents = [],
  reporterName,
  company,
}) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.classList.add('is-printing-report');
      return () => {
        document.body.classList.remove('is-printing-report');
      };
    }
  }, [isOpen]);

  if (!isOpen || !report) return null;

  const isRoadside = report.type === 'roadside' || (report as any).emergency_type === 'Roadside Assistance';
  const refNumber = (report as any).car_number || (report as any).card_number || report.ob_number;

  const handlePrint = () => {
    document.body.classList.add('is-printing-report');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('is-printing-report');
    }, 1000);
  };

  return (
    <div className="printable-modal fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex justify-center items-start p-2 sm:p-6 print:p-0 print:bg-white print:static print:block print:inset-auto print:m-0">
      {/* Modal Container */}
      <div 
        className="relative bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden my-auto max-h-[92vh] print:max-h-none print:h-auto print:border-none print:shadow-none print:w-full print:m-0 print:p-0 print:rounded-none print:bg-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden on Print) */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 print:hidden flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Incident Information Report</span>
                <span className="text-xs font-mono font-normal bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                  {refNumber}
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Official docket preview &bull; Ready to print or export as PDF
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              title="Print or Save as PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Paper Area */}
        <div className="overflow-y-auto p-4 sm:p-8 flex justify-center bg-gray-200 dark:bg-gray-950/80 flex-grow print:p-0 print:m-0 print:bg-white print:overflow-visible">
          <div className="printable-document bg-white text-gray-900 w-full max-w-3xl shadow-xl rounded-lg p-6 sm:p-10 border border-gray-300 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:rounded-none">
            <PrintableReport
              report={report}
              timelineEvents={timelineEvents}
              reporterName={reporterName}
              company={company}
              className="block font-sans text-gray-900 bg-white"
            />
          </div>
        </div>

        {/* Bottom Bar for quick info / print action */}
        <div className="px-6 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 print:hidden flex-shrink-0">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Verified System Record &bull; {isRoadside ? 'Roadside Assistance' : 'Safety Incident'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Direct Print / PDF Export</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded font-medium transition"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncidentReportPreviewModal;
