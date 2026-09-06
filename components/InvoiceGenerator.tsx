import React from 'react';
import { Report, Company } from '../types';
import { RoadsideInvoiceModal } from './RoadsideInvoiceModal';

interface InvoiceGeneratorProps {
  report: Report;
  company?: Company | null;
  onClose: () => void;
  onSaveInvoice: (updatedReport: Report) => void;
}

/**
 * InvoiceGenerator component for Roadside Drivers and Operators
 * Renders a full-featured tax invoice builder and printer incorporating 
 * company branding, driver details, line item service fees, and tax calculations.
 */
export const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({
  report,
  company,
  onClose,
  onSaveInvoice,
}) => {
  return (
    <RoadsideInvoiceModal
      report={report}
      company={company}
      onClose={onClose}
      onSaveInvoice={onSaveInvoice}
    />
  );
};
