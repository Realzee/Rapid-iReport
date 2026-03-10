import React from 'react';
import { Report, VehicleReport, EmergencyReport, Company } from '../types';
import { logoUrl } from '../assets/logo';
import { format } from 'date-fns';
import { AssignResponderIcon, ZapIcon } from './icons';

interface PrintableReportProps {
  report: Report;
  timelineEvents: (
    | { id: string; type: 'update'; content: string; author: string | null; created_at: string; }
    | { id: string; type: 'assignment'; content: string; author: string | null; created_at: string; }
  )[];
  reporterName?: string | null;
  company?: Company | null;
}

const PrintableReport: React.FC<PrintableReportProps> = ({ report, timelineEvents, reporterName, company }) => {
  return (
    <div className="hidden print:block p-8 font-sans text-gray-800 bg-white">
      {/* Header */}
      <header className="flex justify-between items-center pb-4 border-b-2 border-gray-800">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">INCIDENT REPORT</h1>
          <p className="text-gray-600">Generated: {format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
        </div>
        <img src={company?.logo_url || logoUrl} alt="Logo" className="w-20 h-auto object-contain" />
      </header>

      {/* Main Details */}
      <section className="mt-6 grid grid-cols-3 gap-6 text-sm">
        <div className="bg-gray-100 p-3 rounded-md border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase">OB Number</p>
          <p className="font-mono text-lg font-semibold">{report.ob_number}</p>
        </div>
        <div className="bg-gray-100 p-3 rounded-md border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase">Status</p>
          <p className="text-lg font-semibold capitalize">{report.status.replace(/_/g, ' ')}</p>
        </div>
        <div className="bg-gray-100 p-3 rounded-md border border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase">Severity</p>
          <p className="text-lg font-semibold capitalize">{report.severity}</p>
        </div>
      </section>

      {/* Specific Details */}
      <section className="mt-6 border-t border-gray-300 pt-6">
        <h2 className="text-xl font-bold mb-4">Incident Details</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <p className="font-bold text-gray-500">Type</p>
            <p>{report.type === 'vehicle' ? 'Vehicle Incident' : (report.type === 'emergency' ? 'Emergency Report' : 'Crime Incident')}</p>
          </div>
          <div>
            <p className="font-bold text-gray-500">Reported At</p>
            <p>{format(new Date(report.reported_at), 'yyyy-MM-dd HH:mm:ss')}</p>
          </div>
           <div>
            <p className="font-bold text-gray-500">Reported By</p>
            <p>{reporterName || 'Unknown'}</p>
          </div>
          {report.type === 'vehicle' ? (
            <>
              <div><p className="font-bold text-gray-500">License Plate</p><p className="font-mono">{(report as any).license_plate}</p></div>
              <div><p className="font-bold text-gray-500">Make</p><p>{(report as any).vehicle_make}</p></div>
              <div><p className="font-bold text-gray-500">Model</p><p>{(report as any).vehicle_model}</p></div>
              <div><p className="font-bold text-gray-500">Color</p><p>{(report as any).vehicle_color}</p></div>
              <div className="col-span-2"><p className="font-bold text-gray-500">Last Seen Location</p><p>{(report as any).last_seen_location}</p></div>
            </>
          ) : report.type === 'emergency' ? (
            <>
              <div><p className="font-bold text-gray-500">Title</p><p>{report.title}</p></div>
              <div><p className="font-bold text-gray-500">Emergency Type</p><p>{(report as any).emergency_type}</p></div>
              <div className="col-span-2"><p className="font-bold text-gray-500">Location</p><p>{(report as any).location}</p></div>
            </>
          ) : (
            <>
              <div><p className="font-bold text-gray-500">Title</p><p>{report.title}</p></div>
              <div><p className="font-bold text-gray-500">Crime Type</p><p>{(report as any).crime_type}</p></div>
              <div className="col-span-2"><p className="font-bold text-gray-500">Location</p><p>{(report as any).location}</p></div>
            </>
          )}
           <div className="col-span-2">
            <p className="font-bold text-gray-500">Description</p>
            <p className="whitespace-pre-wrap">{report.description}</p>
          </div>
        </div>
      </section>

      {/* Evidence Images */}
      {report.evidence_images && report.evidence_images.length > 0 && (
        <section className="mt-6 border-t border-gray-300 pt-6" style={{ pageBreakInside: 'avoid' }}>
          <h2 className="text-xl font-bold mb-4">Evidence Images</h2>
          <div className="grid grid-cols-2 gap-4">
            {report.evidence_images.map((img, index) => (
              <div key={index} className="border border-gray-200 rounded-md overflow-hidden aspect-video bg-gray-50 flex items-center justify-center">
                <img src={img} alt={`Evidence ${index + 1}`} className="max-w-full max-h-full object-contain" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Timeline */}
      <section className="mt-6 border-t border-gray-300 pt-6" style={{ pageBreakInside: 'avoid' }}>
        <h2 className="text-xl font-bold mb-4">Incident Log</h2>
        <div className="space-y-4">
          {timelineEvents.map((event) => (
             <div key={`${event.type}-${event.id}`} className="flex gap-4 relative" style={{ pageBreakInside: 'avoid' }}>
                <div className="absolute left-4 top-10 -bottom-2 w-0.5 bg-gray-300 last:hidden"></div>
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center ring-4 ring-white z-10">
                    {event.type === 'assignment' ? <AssignResponderIcon className="w-4 h-4 text-gray-600" /> : <ZapIcon className="w-4 h-4 text-gray-600" />}
                </div>
                <div className="flex-grow pb-2">
                    <div className="text-sm">{event.content}</div>
                    <div className="text-xs text-gray-500 mt-1">
                        {event.author && <span className="font-semibold">{event.author}</span>}
                        {event.author && ' · '}
                        <span>{format(new Date(event.created_at), 'yyyy-MM-dd HH:mm:ss')}</span>
                    </div>
                </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-gray-400 border-t pt-4 space-y-1">
        <p>RAPID iREPORT - Confidential</p>
        <p>Copyright &copy; {new Date().getFullYear()} Rapid 911 Rapid Rescue PTY (Ltd)</p>
      </footer>
    </div>
  );
};

export default PrintableReport;
