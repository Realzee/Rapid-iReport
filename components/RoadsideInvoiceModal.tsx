import React, { useState } from 'react';
import { Company, RoadsideInvoice, InvoiceItem, RoadsideReport, Report } from '../types';
import { PrintableInvoice } from './PrintableInvoice';
import { toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';
import { 
  X, Plus, Trash2, Printer, Download, FileText, 
  CheckCircle, Calculator, Truck, User 
} from 'lucide-react';

interface RoadsideInvoiceModalProps {
  report: Report;
  company?: Company | null;
  onClose: () => void;
  onSaveInvoice: (updatedReport: Report) => void;
}

export const RoadsideInvoiceModal: React.FC<RoadsideInvoiceModalProps> = ({
  report,
  company,
  onClose,
  onSaveInvoice
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Cast report to RoadsideReport to access roadside specific fields safely
  const roadsideReport = report as RoadsideReport;

  // Pre-fill existing invoice or initialize defaults based on report metadata
  const existingInvoice = roadsideReport.invoice;
  const defaultInvoiceNo = existingInvoice?.invoice_number || `INV-${roadsideReport.ob_number || roadsideReport.car_number || Math.floor(100000 + Math.random() * 900000)}`;

  const [invoiceNumber, setInvoiceNumber] = useState(defaultInvoiceNo);
  const [customerName, setCustomerName] = useState(existingInvoice?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(existingInvoice?.customer_phone || '');
  const [customerIdNumber, setCustomerIdNumber] = useState(existingInvoice?.customer_id_number || '');
  const [vehicleReg, setVehicleReg] = useState(existingInvoice?.vehicle_reg || roadsideReport.car_number || roadsideReport.license_plate || '');
  const [vehicleMakeModel, setVehicleMakeModel] = useState(existingInvoice?.vehicle_make_model || roadsideReport.vehicle_make || '');
  const [pickupLocation, setPickupLocation] = useState(existingInvoice?.pickup_location || roadsideReport.location || '');
  const [destinationLocation, setDestinationLocation] = useState(existingInvoice?.destination_location || roadsideReport.drop_off_location || '');
  const [driverName, setDriverName] = useState(existingInvoice?.driver_name || roadsideReport.driver_name || '');
  const [paymentStatus, setPaymentStatus] = useState<RoadsideInvoice['payment_status']>(existingInvoice?.payment_status || 'Unpaid');
  const [paymentMethod, setPaymentMethod] = useState<RoadsideInvoice['payment_method']>(existingInvoice?.payment_method || 'Cash');
  const [vatPercentage, setVatPercentage] = useState<number>(existingInvoice?.vat_percentage ?? 15);
  const [discount, setDiscount] = useState<number>(existingInvoice?.discount || 0);
  const [notes, setNotes] = useState<string>(existingInvoice?.notes || 'Roadside tow service completed safely.');

  // Initial preset line items for RA Towing
  const defaultItems: InvoiceItem[] = existingInvoice?.items || [
    {
      id: '1',
      description: 'Standard Roadside Callout & Hookup Fee',
      quantity: 1,
      unit_price: 650,
      amount: 650
    },
    {
      id: '2',
      description: 'Vehicle Towing Distance (km)',
      quantity: 15,
      unit_price: 25,
      amount: 375
    }
  ];

  const [items, setItems] = useState<InvoiceItem[]>(defaultItems);

  // Calculations
  const subtotal = items.reduce((acc, item) => acc + (item.amount || 0), 0);
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const vatAmount = (discountedSubtotal * vatPercentage) / 100;
  const totalAmount = discountedSubtotal + vatAmount;

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const q = field === 'quantity' ? Number(value) : item.quantity;
        const p = field === 'unit_price' ? Number(value) : item.unit_price;
        updated.amount = q * p;
      }
      return updated;
    }));
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: String(Date.now()),
      description: 'Additional Service / Winching / Storage',
      quantity: 1,
      unit_price: 200,
      amount: 200
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter(i => i.id !== id));
  };

  const constructInvoiceObject = (): RoadsideInvoice => ({
    invoice_number: invoiceNumber,
    created_at: existingInvoice?.created_at || new Date().toISOString(),
    due_date: new Date().toISOString(),
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_id_number: customerIdNumber,
    vehicle_reg: vehicleReg,
    vehicle_make_model: vehicleMakeModel,
    pickup_location: pickupLocation,
    destination_location: destinationLocation,
    provider_name: company?.name || 'Rapid Report Roadside Rescue',
    provider_phone: company?.hotline_number || company?.contact_number || '',
    driver_name: driverName,
    items,
    subtotal,
    vat_percentage: vatPercentage,
    vat_amount: vatAmount,
    discount,
    total_amount: totalAmount,
    payment_status: paymentStatus,
    payment_method: paymentMethod,
    notes
  });

  const handleSave = () => {
    const inv = constructInvoiceObject();
    const updatedReport: RoadsideReport = {
      ...roadsideReport,
      invoice: inv
    };
    onSaveInvoice(updatedReport as Report);
    setActiveTab('preview');
  };

  const handlePrint = () => {
    // If not in preview mode, save first
    handleSave();
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('printable-invoice-docket');
    if (!element) return;
    
    try {
      setIsGeneratingPdf(true);
      const dataUrl = await toJpeg(element, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = img.naturalWidth || img.width;
      const canvasHeight = img.naturalHeight || img.height;
      const imgHeight = (canvasHeight * pdfWidth) / canvasWidth;

      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, imgHeight);
      pdf.save(`Invoice_${invoiceNumber}_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to download invoice PDF:', err);
      alert('Unable to generate PDF directly. You can use the Print option to save as PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const currentInvoice = constructInvoiceObject();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:fixed-none">
      <div className="bg-white dark:bg-gray-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col my-auto max-h-[95vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/80 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-xl dark:bg-red-900/30 dark:text-red-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Roadside Assistance Tax Invoice
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ref: {roadsideReport.ob_number || roadsideReport.car_number || 'N/A'} &bull; Customer: {customerName || 'N/A'}
              </p>
            </div>
          </div>

          {/* Tabs & Close */}
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'editor' 
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Invoice Builder
              </button>
              <button
                onClick={() => { handleSave(); setActiveTab('preview'); }}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'preview' 
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Print / PDF Preview
              </button>
            </div>

            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'editor' ? (
            <div className="space-y-6 text-sm text-gray-800 dark:text-gray-200">
              {/* Section 1: Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Invoice Number</label>
                  <input 
                    type="text" 
                    value={invoiceNumber} 
                    onChange={e => setInvoiceNumber(e.target.value)} 
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 font-mono font-bold text-gray-900 dark:text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Payment Status</label>
                  <select 
                    value={paymentStatus} 
                    onChange={e => setPaymentStatus(e.target.value as any)} 
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs font-bold"
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid">Paid</option>
                    <option value="Pending Insurance">Pending Insurance</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Payment Method</label>
                  <select 
                    value={paymentMethod} 
                    onChange={e => setPaymentMethod(e.target.value as any)} 
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs font-medium"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card Reader / POS</option>
                    <option value="EFT">EFT / Bank Transfer</option>
                    <option value="Insurance Claim">Insurance / Medical Aid</option>
                    <option value="Mobile Money">Mobile Payment</option>
                  </select>
                </div>
              </div>

              {/* Section 2: Customer & Route */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4 text-red-500" /> Customer Information
                  </h3>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Customer Name</label>
                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Phone Number</label>
                      <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-0.5">ID / Passport No.</label>
                      <input type="text" value={customerIdNumber} onChange={e => setCustomerIdNumber(e.target.value)} placeholder="Optional" className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-red-500" /> Vehicle & Tow Route
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Vehicle Reg / Plate</label>
                      <input type="text" value={vehicleReg} onChange={e => setVehicleReg(e.target.value)} className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs font-bold" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Make / Model</label>
                      <input type="text" value={vehicleMakeModel} onChange={e => setVehicleMakeModel(e.target.value)} className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Pickup Location</label>
                      <input type="text" value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Dropoff Destination</label>
                      <input type="text" value={destinationLocation} onChange={e => setDestinationLocation(e.target.value)} placeholder="Workshop / Yard" className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Line Items */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-red-500" /> Line Items & Services
                  </h3>
                  <button 
                    onClick={addItem}
                    className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Service Line
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row items-center gap-2 bg-gray-50 dark:bg-gray-800/80 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700">
                      <input 
                        type="text" 
                        value={item.description} 
                        onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                        placeholder="Item Description"
                        className="flex-1 w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-medium"
                      />
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="w-20">
                          <span className="text-[9px] text-gray-500 block sm:hidden">Qty/Km</span>
                          <input 
                            type="number" 
                            min="1" 
                            value={item.quantity} 
                            onChange={e => handleItemChange(item.id, 'quantity', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs text-center font-semibold"
                          />
                        </div>
                        <div className="w-24">
                          <span className="text-[9px] text-gray-500 block sm:hidden">Rate (R)</span>
                          <input 
                            type="number" 
                            min="0" 
                            value={item.unit_price} 
                            onChange={e => handleItemChange(item.id, 'unit_price', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs text-right font-semibold"
                          />
                        </div>
                        <div className="w-24 text-right font-bold text-gray-900 dark:text-white text-xs px-2">
                          R {item.amount.toFixed(2)}
                        </div>
                        <button 
                          onClick={() => removeItem(item.id)}
                          disabled={items.length <= 1}
                          className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 4: Totals & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Invoice / Towing Notes</label>
                  <textarea 
                    rows={3} 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    placeholder="Notes on vehicle condition, winching, or storage..." 
                    className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs"
                  />
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">R {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">VAT (%)</span>
                    <input 
                      type="number" 
                      min="0" 
                      max="30" 
                      value={vatPercentage} 
                      onChange={e => setVatPercentage(Number(e.target.value))} 
                      className="w-16 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-right bg-white dark:bg-gray-900 text-xs font-bold"
                    />
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>VAT Amount:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">R {vatAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span>Total Amount:</span>
                    <span className="text-red-600 dark:text-red-400 text-base">R {totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-2">
              <PrintableInvoice report={roadsideReport} invoice={currentInvoice} company={company} />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm hover:bg-gray-100 transition-colors flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4 text-green-500" /> Save Invoice
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold text-white bg-gray-900 hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl shadow-md transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-amber-400" /> Print Invoice
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
