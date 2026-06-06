import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { Report, Company, Profile } from '../types';
import { XIcon, CheckIcon, BuildingIcon, ShareIcon, SearchIcon, CarIcon, AlertTriangleIcon, CrimeIcon } from './icons';
import { useToast } from '../contexts/ToastContext';

interface BulkShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedReports: Report[];
  profile: Profile;
  onBulkShared?: () => void;
}

export const BulkShareModal: React.FC<BulkShareModalProps> = ({
  isOpen,
  onClose,
  selectedReports,
  profile,
  onBulkShared,
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const fetchCompanies = async () => {
        setIsLoadingCompanies(true);
        try {
          const { data, error } = await supabase
            .from('companies')
            .select('*')
            .order('name');
          if (error) throw error;
          // Filter out the logged-in user's company
          const otherCompanies = (data || []).filter(c => c.id !== profile.company_id);
          setCompanies(otherCompanies);
        } catch (err: any) {
          console.error('Error fetching companies for bulk share:', err);
          addToast('Failed to load partner companies', 'error');
        } finally {
          setIsLoadingCompanies(false);
        }
      };
      fetchCompanies();
      setSelectedCompanyIds([]);
      setSearchTerm('');
    }
  }, [isOpen, profile.company_id]);

  const filteredCompanies = useMemo(() => {
    return companies.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [companies, searchTerm]);

  const handleToggleCompany = (companyId: string) => {
    setSelectedCompanyIds(prev =>
      prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  const handleSelectAllCompanies = () => {
    if (selectedCompanyIds.length === filteredCompanies.length) {
      setSelectedCompanyIds([]);
    } else {
      setSelectedCompanyIds(filteredCompanies.map(c => c.id));
    }
  };

  const handleSendShares = async () => {
    if (selectedReports.length === 0) {
      addToast('No reports selected for sharing', 'warning');
      return;
    }
    if (selectedCompanyIds.length === 0) {
      addToast('Please select at least one company to share with', 'warning');
      return;
    }

    setIsSharing(true);
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    try {
      // Loop over each selected report
      for (const report of selectedReports) {
        const reportType = report.type || ('license_plate' in report ? 'vehicle' : ('emergency_type' in report ? 'emergency' : 'crime'));
        
        // Loop over each selected target company
        for (const targetCompanyId of selectedCompanyIds) {
          try {
            // Check if this share request already exists to prevent duplication
            const { data: existingShares, error: checkError } = await supabase
              .from('report_shares')
              .select('id, status')
              .eq('report_id', report.id)
              .eq('target_company_id', targetCompanyId);

            if (checkError) throw checkError;

            if (existingShares && existingShares.length > 0) {
              skipCount++;
              continue; // Already shared or pending
            }

            // Create report share request
            const { error: insertError } = await supabase
              .from('report_shares')
              .insert({
                report_id: report.id,
                report_type: reportType,
                source_company_id: profile.company_id,
                target_company_id: targetCompanyId,
                status: 'pending'
              });

            if (insertError) throw insertError;
            successCount++;
          } catch (insertErr) {
            console.error(`Failed to share report ${report.id} to company ${targetCompanyId}:`, insertErr);
            errorCount++;
          }
        }
      }

      // Log the activity
      await supabase.from('user_activity_logs').insert({
        user_id: profile.id,
        action: 'BULK_REPORT_SHARE',
        details: `Bulk shared ${selectedReports.length} reports with ${selectedCompanyIds.length} partners (Successful: ${successCount}, Existed: ${skipCount}, Errored: ${errorCount})`
      });

      if (errorCount === 0) {
        addToast(`Successfully sent sharing requests for ${successCount} report connections! ${skipCount > 0 ? `(${skipCount} already existed)` : ''}`, 'success');
      } else {
        addToast(`Completed with errors. Shared ${successCount} connections, ${skipCount} already existed, ${errorCount} failed.`, 'warning');
      }

      if (onBulkShared) onBulkShared();
      onClose();
    } catch (err: any) {
      console.error('Failed to execute bulk share operation:', err);
      addToast('Error during bulk sharing operation: ' + err.message, 'error');
    } finally {
      setIsSharing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
              <ShareIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Share Reports</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Share {selectedReports.length} selected report{selectedReports.length > 1 ? 's' : ''} to approved network security companies
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 px-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900/60 transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Selected Reports Overview */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
              Selected Incident Reports ({selectedReports.length})
            </h3>
            <div className="border border-gray-200 dark:border-gray-850 rounded-xl max-h-36 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 p-3 space-y-2 custom-scrollbar">
              {selectedReports.map(report => {
                const title = ('license_plate' in report ? `${report.license_plate} (${(report as any).vehicle_make || ''})` : report.title) || 'Untitled Incident';
                const reportType = report.type || ('license_plate' in report ? 'vehicle' : ('emergency_type' in report ? 'emergency' : 'crime'));
                
                return (
                  <div key={report.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-900/40 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1 rounded-full ${
                        reportType === 'vehicle' ? 'bg-yellow-500/15 text-yellow-600' :
                        reportType === 'emergency' ? 'bg-orange-500/15 text-orange-600' : 'bg-red-500/15 text-red-600'
                      }`}>
                        {reportType === 'vehicle' ? <CarIcon className="w-3.5 h-3.5" /> : 
                         reportType === 'emergency' ? <AlertTriangleIcon className="w-3.5 h-3.5" /> : <CrimeIcon className="w-3.5 h-3.5" />}
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-gray-800 dark:text-gray-200">{title}</span>
                        <span className="text-gray-400 font-mono ml-2 text-[10px]">{report.ob_number}</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-850 text-gray-500 rounded px-1.5 py-0.5 capitalize flex-shrink-0 font-medium">
                      {reportType}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Target Network Partner Companies Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                Approved Partner Companies
              </h3>
              {companies.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllCompanies}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {selectedCompanyIds.length === filteredCompanies.length ? 'Deselect All' : 'Select All Filtered'}
                </button>
              )}
            </div>

            {/* Search Filter input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search approved companies..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-850 rounded-xl py-2 pl-9 pr-4 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Companies Checklist */}
            <div className="border border-gray-200 dark:border-gray-850 rounded-xl overflow-hidden bg-white dark:bg-gray-950 divide-y divide-gray-100 dark:divide-gray-900">
              {isLoadingCompanies ? (
                <div className="p-8 text-center text-xs text-gray-500 flex flex-col items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  Loading partner companies...
                </div>
              ) : companies.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  <BuildingIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  No other companies available in the network directory
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  No companies matches "{searchTerm}"
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto custom-scrollbar">
                  {filteredCompanies.map(company => {
                    const isChecked = selectedCompanyIds.includes(company.id);
                    return (
                      <div 
                        key={company.id} 
                        onClick={() => handleToggleCompany(company.id)}
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                          isChecked 
                            ? 'bg-blue-500/5 dark:bg-blue-500/10 hover:bg-blue-500/10' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // toggled via parent div click
                            className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          {company.logo_url ? (
                            <img src={company.logo_url} alt={company.name} className="w-6 h-6 object-contain rounded border border-gray-200 dark:border-gray-800" />
                          ) : (
                            <div className="w-6 h-6 rounded bg-gray-150 dark:bg-gray-800 text-gray-500 flex items-center justify-center font-bold text-xs">
                              <BuildingIcon className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div className="truncate">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{company.name}</p>
                            {company.psira_number && (
                              <p className="text-[10px] text-gray-400 font-mono">PSIRA: {company.psira_number}</p>
                            )}
                          </div>
                        </div>
                        {isChecked && (
                          <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                            <CheckIcon className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 dark:bg-gray-950/40 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selectedCompanyIds.length > 0 && selectedReports.length > 0 ? (
              <span className="font-medium text-blue-600 dark:text-blue-400">
                Will create {selectedCompanyIds.length * selectedReports.length} sharing connection{selectedCompanyIds.length * selectedReports.length > 1 ? 's' : ''}
              </span>
            ) : (
              'Select target companies to continue'
            )}
          </span>
          <div className="flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              disabled={isSharing}
              className="px-5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white font-bold text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleSendShares}
              disabled={isSharing || selectedCompanyIds.length === 0 || selectedReports.length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              {isSharing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sharing...
                </>
              ) : (
                <>
                  <ShareIcon className="w-4 h-4" />
                  Send Sharing Requests
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
