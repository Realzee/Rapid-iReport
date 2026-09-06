import React from 'react';
import { Report, Company, RoadsideInvoice, RoadsideReport } from '../types';
import { Phone, MapPin, Truck, Calendar, User } from 'lucide-react';

interface PrintableInvoiceProps {
  report: RoadsideReport;
  invoice: RoadsideInvoice;
  company?: Company | null;
}

export const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ report, invoice, company }) => {
  const providerName = invoice.provider_name || company?.name || 'Rapid Report Roadside Rescue';
  const providerPhone = invoice.provider_phone || company?.hotline_number || company?.contact_number || '';
  const providerAddress = company?.physical_address || '24/7 Roadside Emergency & Dispatch Network';

  return (
    <div 
      id="printable-invoice-docket" 
      className="w-full max-w-4xl mx-auto bg-white text-gray-900 p-8 shadow-sm border border-gray-200 rounded-lg print:shadow-none print:border-none print:p-0 font-sans"
      style={{ backgroundColor: '#ffffff', color: '#111827' }}
    >
      {/* Top Header & Branding */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b-2 border-gray-900 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 text-white p-2.5 rounded-lg font-black text-xl tracking-wider flex items-center justify-center shadow-sm">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 uppercase tracking-tight">
              {providerName}
            </h1>
            <p className="text-xs text-gray-600 font-medium">{providerAddress}</p>
            {providerPhone && (
              <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-red-600" /> {providerPhone}
              </p>
            )}
          </div>
        </div>

        <div className="text-left sm:text-right bg-gray-50 p-3 rounded-lg border border-gray-200 min-w-[200px]">
          <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">
            TAX INVOICE
          </div>
          <div className="text-lg font-black text-gray-900">
            #{invoice.invoice_number}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center sm:justify-end gap-1">
            <Calendar className="w-3 h-3" /> Date: {new Date(invoice.created_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
          <div className="mt-1">
            <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${
              invoice.payment_status === 'Paid' 
                ? 'bg-green-100 text-green-800 border-green-300' 
                : invoice.payment_status === 'Pending Insurance'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-red-100 text-red-800 border-red-300'
            }`}>
              STATUS: {invoice.payment_status}
            </span>
          </div>
        </div>
      </div>

      {/* Reference Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 text-xs bg-gray-100 p-3 rounded-md border border-gray-200">
        <div>
          <span className="text-gray-500 block font-semibold text-[10px] uppercase">Incident Ref (OB)</span>
          <span className="font-bold text-gray-900">{report.ob_number || report.car_number || 'N/A'}</span>
        </div>
        <div>
          <span className="text-gray-500 block font-semibold text-[10px] uppercase">Service Type</span>
          <span className="font-bold text-gray-900">{report.emergency_type || 'Roadside Towing'}</span>
        </div>
        <div>
          <span className="text-gray-500 block font-semibold text-[10px] uppercase">Assigned RA Driver</span>
          <span className="font-bold text-gray-900">{invoice.driver_name || report.driver_name || 'Dispatch Unit'}</span>
        </div>
        <div>
          <span className="text-gray-500 block font-semibold text-[10px] uppercase">Tow Truck Reg</span>
          <span className="font-bold text-gray-900">{report.car_number || 'N/A'}</span>
        </div>
      </div>

      {/* Customer & Vehicle Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
        {/* Customer Details */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b pb-2 mb-3 flex items-center gap-1.5">
            <User className="w-4 h-4 text-gray-500" /> Billed To (Customer / Insured)
          </h3>
          <div className="space-y-1.5 text-xs">
            <div>
              <span className="text-gray-500 font-medium">Full Name:</span>{' '}
              <span className="font-bold text-gray-900">{invoice.customer_name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500 font-medium">Contact Phone:</span>{' '}
              <span className="font-bold text-gray-900">{invoice.customer_phone || 'N/A'}</span>
            </div>
            {invoice.customer_id_number && (
              <div>
                <span className="text-gray-500 font-medium">ID / Passport No:</span>{' '}
                <span className="font-bold text-gray-900">{invoice.customer_id_number}</span>
              </div>
            )}
            {invoice.payment_method && (
              <div>
                <span className="text-gray-500 font-medium">Payment Terms:</span>{' '}
                <span className="font-semibold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">{invoice.payment_method}</span>
              </div>
            )}
          </div>
        </div>

        {/* Vehicle & Towing Details */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b pb-2 mb-3 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-gray-500" /> Vehicle & Route Details
          </h3>
          <div className="space-y-1.5 text-xs">
            <div>
              <span className="text-gray-500 font-medium">Vehicle Reg / Plate:</span>{' '}
              <span className="font-bold text-gray-900">{invoice.vehicle_reg || report.license_plate || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500 font-medium">Make & Model:</span>{' '}
              <span className="font-semibold text-gray-900">{invoice.vehicle_make_model || report.vehicle_make || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500 font-medium flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <span><strong>Pickup:</strong> {invoice.pickup_location || report.location || 'Scene Location'}</span>
              </span>
            </div>
            {invoice.destination_location && (
              <div>
                <span className="text-gray-500 font-medium flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                  <span><strong>Dropoff:</strong> {invoice.destination_location}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Itemized Table */}
      <div className="my-6 overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-900 text-white uppercase text-[10px] font-bold tracking-wider">
            <tr>
              <th className="py-2.5 px-4">#</th>
              <th className="py-2.5 px-4">Item & Description</th>
              <th className="py-2.5 px-4 text-center">Qty / Km</th>
              <th className="py-2.5 px-4 text-right">Unit Rate (R)</th>
              <th className="py-2.5 px-4 text-right">Total (R)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {invoice.items.map((item, idx) => (
              <tr key={item.id || idx} className="hover:bg-gray-50">
                <td className="py-3 px-4 font-semibold text-gray-500">{idx + 1}</td>
                <td className="py-3 px-4 font-bold text-gray-900">{item.description}</td>
                <td className="py-3 px-4 text-center text-gray-700 font-medium">{item.quantity}</td>
                <td className="py-3 px-4 text-right text-gray-700 font-medium">R {item.unit_price.toFixed(2)}</td>
                <td className="py-3 px-4 text-right font-bold text-gray-900">R {item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Breakdown */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 my-6 pt-4 border-t border-gray-200">
        <div className="w-full sm:w-1/2 space-y-2 text-xs">
          {invoice.notes && (
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-gray-700">
              <span className="font-bold text-gray-900 block mb-1">Driver / Dispatch Notes:</span>
              <p className="whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
          <div className="text-[11px] text-gray-500 space-y-1">
            <p className="font-semibold text-gray-700">Terms & Conditions:</p>
            <p>&bull; Payment due immediately upon completion of roadside service or tow delivery.</p>
            <p>&bull; Vehicles stored beyond 24 hours are subject to standard daily storage rates.</p>
          </div>
        </div>

        <div className="w-full sm:w-1/2 max-w-xs space-y-2 text-xs bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal:</span>
            <span className="font-semibold text-gray-900">R {invoice.subtotal.toFixed(2)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Discount / Rebate:</span>
              <span className="font-semibold">- R {invoice.discount.toFixed(2)}</span>
            </div>
          )}
          {invoice.vat_percentage > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>VAT ({invoice.vat_percentage}%):</span>
              <span className="font-semibold text-gray-900">R {invoice.vat_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-extrabold text-gray-900 pt-2 border-t-2 border-gray-900">
            <span>TOTAL DUE:</span>
            <span className="text-red-600 text-base">R {invoice.total_amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Signatures & Footer */}
      <div className="mt-8 pt-6 border-t border-gray-300 grid grid-cols-2 gap-8 text-xs">
        <div>
          <div className="border-b border-gray-400 h-10 mb-1"></div>
          <p className="font-bold text-gray-800">Customer Authorization Signature</p>
          <p className="text-[10px] text-gray-500">I confirm receipt of services rendered in good order.</p>
        </div>
        <div>
          <div className="border-b border-gray-400 h-10 mb-1"></div>
          <p className="font-bold text-gray-800">Driver / Technician Signature</p>
          <p className="text-[10px] text-gray-500">{invoice.driver_name || 'Authorized Roadside Operator'}</p>
        </div>
      </div>

      <footer className="mt-8 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-500 space-y-0.5">
        <p className="font-bold uppercase tracking-wider">Rapid Report Roadside Assistance & Fleet Dispatch</p>
        <p>This document is an official roadside service tax invoice generated by Rapid Report System.</p>
      </footer>
    </div>
  );
};
