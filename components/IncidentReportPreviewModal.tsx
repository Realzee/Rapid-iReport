import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Report, Company } from '../types';
import PrintableReport from './PrintableReport';
import { Printer, X, FileText, ShieldCheck, Download } from 'lucide-react';
import { WhatsappIcon } from './icons';
import { sendReportPdfViaWhatsApp, generateReportPdfBlob } from '../utils/reportPdfSharer';
import { useToast } from '../contexts/ToastContext';

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
  const { addToast } = useToast();
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      document.body.classList.add('is-printing-report');
      return () => {
        document.body.classList.remove('is-printing-report');
      };
    }
  }, [isOpen]);

  if (!isOpen || !report) return null;
  if (typeof document === 'undefined') return null;

  const isRoadside = report.type === 'roadside' || (report as any).emergency_type === 'Roadside Assistance';
  const refNumber = (report as any).car_number || (report as any).card_number || report.ob_number;

  const handlePrint = () => {
    document.body.classList.add('is-printing-report');
    window.print();
  };

  const handleShareWhatsAppPdf = async () => {
    if (!reportRef.current) return;
    setIsSharingWhatsApp(true);
    try {
      addToast('Generating official PDF docket for WhatsApp...', 'info', 3000);
      const result = await sendReportPdfViaWhatsApp(
        reportRef.current,
        report,
        company,
        report.contact_number || undefined
      );

      if (result.method === 'share') {
        addToast('PDF report docket shared via WhatsApp.', 'success');
      } else {
        addToast(
          'PDF downloaded! Opening WhatsApp. Please attach the downloaded PDF file.',
          'success',
          7000
        );
      }
    } catch (error: any) {
      console.error('Error generating/sharing PDF via WhatsApp:', error);
      addToast('Failed to send PDF via WhatsApp. ' + (error.message || ''), 'error');
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsDownloadingPdf(true);
    try {
      addToast('Generating PDF file...', 'info', 2000);
      const { blob, filename } = await generateReportPdfBlob(reportRef.current, report);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      addToast('PDF downloaded successfully.', 'success');
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      addToast('Failed to generate PDF. ' + (error.message || ''), 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const modalContent = (
    <div 
      className="printable-modal fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex justify-center items-start p-2 sm:p-6 print:p-0 print:bg-white print:static print:block print:inset-auto print:m-0"
      onClick={onClose}
    >
      {/* Modal Container */}
      <div 
        className="relative bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden my-auto max-h-[92vh] print:max-h-none print:h-auto print:border-none print:shadow-none print:w-full print:m-0 print:p-0 print:rounded-none print:bg-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden on Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 print:hidden flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Incident Information Report</span>
                {refNumber && (
                  <span className="text-xs font-mono font-normal bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                    {refNumber}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Official docket &bull; Ready to print, download PDF, or send via WhatsApp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* WhatsApp PDF Share Action */}
            <button
              onClick={handleShareWhatsAppPdf}
              disabled={isSharingWhatsApp || isDownloadingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Send official report as PDF via WhatsApp"
            >
              <WhatsappIcon className="w-4 h-4 text-white" />
              <span>{isSharingWhatsApp ? 'Generating...' : 'Send via WhatsApp'}</span>
            </button>

            {/* Direct PDF Download Action */}
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf || isSharingWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-800 active:bg-gray-900 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Download PDF directly"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{isDownloadingPdf ? 'Exporting...' : 'PDF'}</span>
            </button>

            {/* Print Action */}
            <button
              onClick={handlePrint}
              disabled={isSharingWhatsApp || isDownloadingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Print or Save as PDF using system print"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>

            {/* Close */}
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
          <div 
            ref={reportRef}
            className="printable-document bg-white text-gray-900 w-full max-w-3xl shadow-xl rounded-lg p-6 sm:p-10 border border-gray-300 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:rounded-none"
          >
            <PrintableReport
              report={report}
              timelineEvents={timelineEvents}
              reporterName={reporterName}
              company={company}
              className="block font-sans text-gray-900 bg-white printable-report"
            />
          </div>
        </div>

        {/* Bottom Bar for quick info / print action */}
        <div className="px-6 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400 print:hidden flex-shrink-0">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Verified System Record &bull; {isRoadside ? 'Roadside Assistance' : 'Safety Incident'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleShareWhatsAppPdf}
              disabled={isSharingWhatsApp}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <WhatsappIcon className="w-3.5 h-3.5" />
              <span>WhatsApp PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF Export</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded font-medium transition cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default IncidentReportPreviewModal;

