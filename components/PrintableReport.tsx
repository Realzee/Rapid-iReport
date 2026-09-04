import React from 'react';
import { Report, Company } from '../types';
import { logoUrl } from '../assets/logo';
import { safeFormat } from '../utils/dateUtils';
import { AssignResponderIcon, ZapIcon } from './icons';

interface PrintableReportProps {
  report: Report;
  timelineEvents?: (
    | { id: string; type: 'update'; content: string; author: string | null; created_at: string; }
    | { id: string; type: 'assignment'; content: string; author: string | null; created_at: string; }
  )[];
  reporterName?: string | null;
  company?: Company | null;
  className?: string;
}

const PrintableReport: React.FC<PrintableReportProps> = ({ 
  report, 
  timelineEvents = [], 
  reporterName, 
  company,
  className 
}) => {
  const isRoadside = report.type === 'roadside' || (report as any).emergency_type === 'Roadside Assistance';
  const isVehicle = report.type === 'vehicle';
  const isCrime = report.type === 'crime';
  const isEmergency = report.type === 'emergency' && !isRoadside;

  const carOrOb = (report as any).car_number || (report as any).card_number || report.ob_number;
  const logo = company?.logo_url || logoUrl;

  return (
    <div className={`printable-report ${className || "p-8 font-sans text-gray-900 bg-white"}`}>
      {/* Official Header */}
      <header className="flex justify-between items-start pb-5 border-b-2 border-gray-900">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-gray-900 text-white text-xs font-black uppercase px-2 py-0.5 tracking-wider rounded">
              OFFICIAL DOCKET
            </span>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              RAPID iREPORT DISPATCH
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {isRoadside ? 'ROADSIDE ASSISTANCE REPORT' : 'INCIDENT INFORMATION REPORT'}
          </h1>
          <p className="text-xs text-gray-600 font-mono">
            Generated: {safeFormat(new Date(), 'yyyy-MM-dd HH:mm:ss')} | Ref: {carOrOb}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <img src={logo} alt="Company Logo" className="h-14 max-w-[180px] object-contain" />
          <span className="text-[11px] font-semibold text-gray-600 mt-1">{company?.name || 'Rapid Response Services'}</span>
        </div>
      </header>

      {/* Reference & Core Status Bar */}
      <section className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-300">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            {isRoadside ? 'Car Number' : 'OB Number'}
          </p>
          <p className="font-mono text-base font-bold text-gray-900 mt-0.5">{carOrOb}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-300">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</p>
          <p className="text-base font-bold capitalize text-gray-900 mt-0.5">{report.status.replace(/_/g, ' ')}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-300">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Severity</p>
          <p className="text-base font-bold uppercase text-red-700 mt-0.5">{report.severity.toUpperCase()}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-300">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Category</p>
          <p className="text-base font-bold text-gray-900 mt-0.5">
            {isRoadside ? 'Roadside Assistance' : isVehicle ? 'Vehicle Incident' : isEmergency ? 'Emergency Incident' : 'Crime Incident'}
          </p>
        </div>
      </section>

      {/* Incident Information Overview */}
      <section className="mt-5 border border-gray-300 rounded-lg p-4 bg-white">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-3">
          Incident Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="font-bold text-gray-500 block uppercase text-[10px]">Title / Subject</span>
            <span className="font-semibold text-gray-900 text-sm">{isVehicle ? (report as any).license_plate : report.title}</span>
          </div>
          <div>
            <span className="font-bold text-gray-500 block uppercase text-[10px]">Reported Timestamp</span>
            <span className="font-medium text-gray-900">{safeFormat(report.reported_at, 'yyyy-MM-dd HH:mm:ss')}</span>
          </div>
          <div>
            <span className="font-bold text-gray-500 block uppercase text-[10px]">Reported By</span>
            <span className="font-medium text-gray-900">{reporterName || (report as any).reporter_name || 'Dispatch System'}</span>
          </div>
          
          {((report as any).date_of_incident || (report as any).incident_time) && (
            <div>
              <span className="font-bold text-gray-500 block uppercase text-[10px]">Incident Date & Time</span>
              <span className="font-medium text-gray-900">
                {[(report as any).date_of_incident, (report as any).incident_time].filter(Boolean).join(' at ')}
              </span>
            </div>
          )}

          {(report as any).driver_name && (
            <div>
              <span className="font-bold text-gray-500 block uppercase text-[10px]">Driver Name</span>
              <span className="font-bold text-gray-900">{(report as any).driver_name}</span>
            </div>
          )}

          {(report as any).assistance_type && (
            <div>
              <span className="font-bold text-gray-500 block uppercase text-[10px]">Assistance Type</span>
              <span className="font-semibold text-gray-900">{(report as any).assistance_type}</span>
            </div>
          )}
        </div>
      </section>

      {/* Location Details */}
      <section className="mt-4 border border-gray-300 rounded-lg p-4 bg-white">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-3">
          Location & Route Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-bold text-gray-500 block uppercase text-[10px]">
              {isRoadside ? 'Breakdown / Incident Location' : isVehicle ? 'Last Seen Location' : 'Incident Location'}
            </span>
            <span className="font-semibold text-gray-900">{(report as any).location || (report as any).last_seen_location || 'N/A'}</span>
            {report.location_coords && (
              <span className="block text-[10px] text-gray-500 font-mono mt-0.5">
                Coords: {report.location_coords.lat.toFixed(6)}, {report.location_coords.lng.toFixed(6)}
              </span>
            )}
          </div>

          {isRoadside && (report as any).drop_off_location && (
            <div>
              <span className="font-bold text-gray-500 block uppercase text-[10px]">Drop Off Destination</span>
              <span className="font-semibold text-indigo-900">{(report as any).drop_off_location}</span>
              {(report as any).drop_off_location_coords && (
                <span className="block text-[10px] text-gray-500 font-mono mt-0.5">
                  Drop Off Coords: {(report as any).drop_off_location_coords.lat.toFixed(6)}, {(report as any).drop_off_location_coords.lng.toFixed(6)}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Roadside Specific Checklist / Operations */}
      {isRoadside && (
        <section className="mt-4 border border-gray-300 rounded-lg p-4 bg-white">
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-3">
            Roadside Service Checklist & Operations
          </h2>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 border border-gray-200 rounded bg-gray-50">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Rollback</p>
              <p className={`font-bold mt-1 ${(report as any).rollback ? 'text-teal-700' : 'text-gray-400'}`}>
                {(report as any).rollback ? 'YES' : 'NO'}
              </p>
            </div>
            <div className="p-2 border border-gray-200 rounded bg-gray-50">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Recovery</p>
              <p className={`font-bold mt-1 ${(report as any).recovery ? 'text-teal-700' : 'text-gray-400'}`}>
                {(report as any).recovery ? 'YES' : 'NO'}
              </p>
            </div>
            <div className="p-2 border border-gray-200 rounded bg-gray-50">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Dreamtec</p>
              <p className={`font-bold mt-1 ${(report as any).dreamtec ? 'text-teal-700' : 'text-gray-400'}`}>
                {(report as any).dreamtec ? 'YES' : 'NO'}
              </p>
            </div>
            <div className="p-2 border border-gray-200 rounded bg-gray-50">
              <p className="text-[10px] font-bold text-gray-500 uppercase">Family Run</p>
              <p className={`font-bold mt-1 ${(report as any).family_run ? 'text-teal-700' : 'text-gray-400'}`}>
                {(report as any).family_run ? 'YES' : 'NO'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Vehicle Specific Details */}
      {((report as any).license_plate || (report as any).vehicle_make || (report as any).vehicle_model || (report as any).vin_number || (report as any).engine_number) && (
        <section className="mt-4 border border-gray-300 rounded-lg p-4 bg-white">
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-3">
            Vehicle Particulars
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {(report as any).license_plate && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">License Plate / Reg</span>
                <span className="font-mono font-bold text-gray-900">{(report as any).license_plate}</span>
              </div>
            )}
            {(report as any).vehicle_make && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">Make</span>
                <span className="font-semibold text-gray-900">{(report as any).vehicle_make}</span>
              </div>
            )}
            {(report as any).vehicle_model && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">Model</span>
                <span className="font-semibold text-gray-900">{(report as any).vehicle_model}</span>
              </div>
            )}
            {(report as any).vehicle_color && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">Color</span>
                <span className="font-semibold text-gray-900">{(report as any).vehicle_color}</span>
              </div>
            )}
            {(report as any).year && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">Year</span>
                <span className="font-semibold text-gray-900">{(report as any).year}</span>
              </div>
            )}
            {(report as any).vin_number && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">VIN Number</span>
                <span className="font-mono text-gray-900">{(report as any).vin_number}</span>
              </div>
            )}
            {(report as any).engine_number && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">Engine Number</span>
                <span className="font-mono text-gray-900">{(report as any).engine_number}</span>
              </div>
            )}
            {(report as any).tracker_company && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">Tracker Provider</span>
                <span className="font-semibold text-gray-900">{(report as any).tracker_company}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Police & Legal Reference */}
      {((report as any).cas_number || (report as any).station_name || (report as any).io_name || (report as any).io_contact || (report as any).saps_13 || (report as any).pound_name) && (
        <section className="mt-4 border border-gray-300 rounded-lg p-4 bg-white">
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-3">
            Law Enforcement / Case Details
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {(report as any).cas_number && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">CAS Number</span>
                <span className="font-mono font-bold text-gray-900">{(report as any).cas_number}</span>
              </div>
            )}
            {(report as any).station_name && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">Police Station</span>
                <span className="font-semibold text-gray-900">{(report as any).station_name}</span>
              </div>
            )}
            {(report as any).io_name && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">Investigating Officer</span>
                <span className="font-semibold text-gray-900">{(report as any).io_name}</span>
              </div>
            )}
            {(report as any).io_contact && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">IO Contact Number</span>
                <span className="font-medium text-gray-900">{(report as any).io_contact}</span>
              </div>
            )}
            {(report as any).saps_13 && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">SAPS 13 Ref</span>
                <span className="font-mono text-gray-900">{(report as any).saps_13}</span>
              </div>
            )}
            {(report as any).pound_name && (
              <div>
                <span className="font-bold text-gray-500 block uppercase text-[10px]">Pound / Storage Location</span>
                <span className="font-semibold text-gray-900">{(report as any).pound_name}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Incident Narrative / Description */}
      <section className="mt-4 border border-gray-300 rounded-lg p-4 bg-white">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-2">
          Incident Narrative & Summary
        </h2>
        <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
          {report.description || 'No description provided.'}
        </p>
      </section>

      {/* Evidence Attachments */}
      {report.evidence_images && report.evidence_images.length > 0 && (
        <section className="mt-4 border border-gray-300 rounded-lg p-4 bg-white" style={{ pageBreakInside: 'avoid' }}>
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-3">
            Attached Photographic Evidence ({report.evidence_images.length})
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {report.evidence_images.map((img, index) => (
              <div key={index} className="border border-gray-200 rounded overflow-hidden aspect-video bg-gray-50 flex items-center justify-center p-1">
                <img src={img} alt={`Evidence ${index + 1}`} className="max-w-full max-h-full object-contain" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Incident Timeline / Activity Log */}
      {timelineEvents && timelineEvents.length > 0 && (
        <section className="mt-4 border border-gray-300 rounded-lg p-4 bg-white" style={{ pageBreakInside: 'avoid' }}>
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-3">
            Dispatch Log & Action Timeline
          </h2>
          <div className="space-y-3">
            {timelineEvents.map((event) => (
              <div key={`${event.type}-${event.id}`} className="flex gap-3 relative text-xs" style={{ pageBreakInside: 'avoid' }}>
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center">
                  {event.type === 'assignment' ? <AssignResponderIcon className="w-3 h-3 text-gray-700" /> : <ZapIcon className="w-3 h-3 text-gray-700" />}
                </div>
                <div className="flex-grow pb-1">
                  <div className="text-gray-900 font-medium">{event.content}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {event.author && <span className="font-semibold text-gray-700">{event.author}</span>}
                    {event.author && ' · '}
                    <span>{safeFormat(event.created_at, 'yyyy-MM-dd HH:mm:ss')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Official Signatures & Verification */}
      <section className="mt-6 pt-4 border-t-2 border-gray-300 grid grid-cols-2 gap-8 text-xs" style={{ pageBreakInside: 'avoid' }}>
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-500 mb-6">Dispatch Controller / Supervisor</p>
          <div className="border-b border-gray-400 w-3/4 mb-1"></div>
          <p className="text-[10px] text-gray-600">Signature / Operator ID: {reporterName || 'Authorized Officer'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-500 mb-6">Receiving Officer / Field Responder</p>
          <div className="border-b border-gray-400 w-3/4 mb-1"></div>
          <p className="text-[10px] text-gray-600">Signature / Unit Call Sign: {(report as any).assigned_to || 'Assigned Unit'}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-6 text-center text-[10px] text-gray-500 border-t border-gray-300 pt-3 space-y-0.5">
        <p className="font-bold tracking-wider">RAPID iREPORT &bull; CONFIDENTIAL LAW ENFORCEMENT & SAFETY DOCKET</p>
        <p>Copyright &copy; {new Date().getFullYear()} Rapid 911 Rapid Rescue PTY (Ltd). All rights reserved.</p>
      </footer>
    </div>
  );
};

export default PrintableReport;
