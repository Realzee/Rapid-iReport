import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { ReportShare, Company, Profile, UserRole } from '../types';
import { XIcon, CheckIcon, BuildingIcon, HistoryIcon, UsersIcon, GlobeIcon, ShareIcon } from './icons';

interface CorporateSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onUpdate?: () => void;
}

export const CorporateSharingModal: React.FC<CorporateSharingModalProps> = ({ isOpen, onClose, profile, onUpdate }) => {
  const [incomingShares, setIncomingShares] = useState<ReportShare[]>([]);
  const [outgoingShares, setOutgoingShares] = useState<ReportShare[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [isLoading, setIsLoading] = useState(true);
  const [actioningShareId, setActioningShareId] = useState<string | null>(null);

  const fetchSharingRequests = async () => {
    if (!profile.company_id) return;
    setIsLoading(true);
    try {
      // Fetch incoming requests (where we are the target)
      const { data: incomingData, error: incError } = await supabase
        .from('report_shares')
        .select('*, source_company:companies!report_shares_source_company_id_fkey(id, name, logo_url)')
        .eq('target_company_id', profile.company_id);

      if (incError) console.error("Error fetching incoming shares:", incError);
      else setIncomingShares(incomingData || []);

      // Fetch outgoing requests (where we are the source)
      const { data: outgoingData, error: outError } = await supabase
        .from('report_shares')
        .select('*, target_company:companies!report_shares_target_company_id_fkey(id, name, logo_url)')
        .eq('source_company_id', profile.company_id);

      if (outError) console.error("Error fetching outgoing shares:", outError);
      else setOutgoingShares(outgoingData || []);

      // Fetch all companies
      const { data: compData, error: compError } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      
      if (compError) console.warn("Company fetch warning:", compError?.message);
      else setCompanies(compData || []);

    } catch (err) {
      console.error("Error loading corporate sharing info:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSharingRequests();
    }
  }, [isOpen, profile.company_id]);

  const handleApprove = async (share: ReportShare) => {
    setActioningShareId(share.id);
    try {
      const { error: updateError } = await supabase
        .from('report_shares')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', share.id);

      if (updateError) throw updateError;

      // Update the main report's shared_with_company_ids
      const tableName = share.report_type === 'vehicle' 
          ? 'vehicle_reports' 
          : share.report_type === 'emergency' 
              ? 'emergency_reports' 
              : 'crime_reports';

      const { data: reportData, error: fetchError } = await supabase
        .from(tableName)
        .select('shared_with_company_ids')
        .eq('id', share.report_id)
        .single();
          
      if (fetchError) throw fetchError;
      
      const currentSharedIds = reportData.shared_with_company_ids || [];
      if (!currentSharedIds.includes(share.target_company_id)) {
        const updatedSharedIds = [...currentSharedIds, share.target_company_id];
        const { error: reportUpdateError } = await supabase
          .from(tableName)
          .update({ shared_with_company_ids: updatedSharedIds })
          .eq('id', share.report_id);
              
        if (reportUpdateError) throw reportUpdateError;
      }

      // Log activity
      await supabase.from('user_activity_logs').insert({
        user_id: profile.id,
        action: 'APPROVE_REPORT_SHARE',
        details: `Approved sharing request of report ${share.report_id} to company ${share.target_company_id}`
      });

      fetchSharingRequests();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error("Failed to approve share request:", err);
      alert("Failed to approve sharing request: " + err.message);
    } finally {
      setActioningShareId(null);
    }
  };

  const handleDecline = async (share: ReportShare) => {
    setActioningShareId(share.id);
    try {
      const { error: updateError } = await supabase
        .from('report_shares')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', share.id);

      if (updateError) throw updateError;

      // Log activity
      await supabase.from('user_activity_logs').insert({
        user_id: profile.id,
        action: 'DECLINE_REPORT_SHARE',
        details: `Declined sharing request of report ${share.report_id} to company ${share.target_company_id}`
      });

      fetchSharingRequests();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error("Failed to decline share request:", err);
      alert("Failed to decline sharing request: " + err.message);
    } finally {
      setActioningShareId(null);
    }
  };

  if (!isOpen) return null;

  const pendingIncoming = incomingShares.filter(s => s.status === 'pending');
  const pastIncoming = incomingShares.filter(s => s.status !== 'pending');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-3xl bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
              <ShareIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Corporate Sharing Hub</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Manage report sharing permissions and incoming/outgoing security portal integrations</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 px-2 rounded-lg text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900/60 transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 flex-shrink-0 bg-gray-50 dark:bg-gray-900/10 px-4 pt-2">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors relative flex items-center gap-1.5 ${
              activeTab === 'incoming'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span>Incoming Solicitations</span>
            {pendingIncoming.length > 0 && (
              <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                {pendingIncoming.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('outgoing')}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors relative flex items-center gap-1.5 ${
              activeTab === 'outgoing'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span>My Sharing Requests</span>
            {outgoingShares.filter(s => s.status === 'pending').length > 0 && (
              <span className="bg-gray-400 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                {outgoingShares.filter(s => s.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50 dark:bg-black/10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">loading</p>
            </div>
          ) : activeTab === 'incoming' ? (
            /* INCOMING SHARES TAB */
            <div className="space-y-6">
              {/* Active Pending Invitations */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest font-mono">Pending Requests</h3>
                {pendingIncoming.length === 0 ? (
                  <div className="p-8 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 text-center flex flex-col items-center justify-center">
                    <CheckIcon className="w-8 h-8 text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20 p-1.5 rounded-full mb-2" />
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Clean Slate</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">No external operations units are requesting data shares at the moment.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingIncoming.map(share => {
                      const age = share.created_at ? new Date(share.created_at).toLocaleDateString() : '';
                      return (
                        <div key={share.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-gray-300 dark:hover:border-gray-700 transition-all">
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              {share.source_company?.logo_url ? (
                                <img src={share.source_company.logo_url} alt={share.source_company.name} className="w-7 h-7 object-contain rounded-lg border dark:border-gray-800" />
                              ) : (
                                <div className="w-7 h-7 bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 rounded-lg flex items-center justify-center font-bold text-xs"><BuildingIcon className="w-4 h-4" /></div>
                              )}
                              <div>
                                <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">{share.source_company?.name || 'Security Partner'}</h4>
                                <p className="text-[10px] font-semibold text-gray-400 font-mono tracking-wide">REQUESTED {age}</p>
                              </div>
                            </div>
                            
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal mb-4">Requests authorization to feed a live operational report into your command center stream.</p>
                            
                            <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-black/30 rounded-xl mb-4 border border-gray-100 dark:border-gray-800/50">
                              <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 rounded-lg text-[9px] font-black uppercase tracking-wider">{share.report_type}</span>
                              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 truncate font-mono">ID: {share.report_id}</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(share)}
                              disabled={actioningShareId === share.id}
                              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow flex items-center justify-center gap-1"
                            >
                              {actioningShareId === share.id ? 'Approving...' : (
                                <>
                                  <CheckIcon className="w-3.5 h-3.5" /> Approve
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleDecline(share)}
                              disabled={actioningShareId === share.id}
                              className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl border border-gray-200 dark:border-gray-700 transition-all flex items-center justify-center gap-1"
                            >
                              {actioningShareId === share.id ? 'Declining...' : (
                                <>
                                  <XIcon className="w-3.5 h-3.5" /> Decline
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Solicitations Log */}
              {pastIncoming.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest font-mono">Incoming Archives & Approvals</h3>
                  <div className="overflow-hidden border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                    {pastIncoming.map(share => {
                      const updatedDate = share.updated_at ? new Date(share.updated_at).toLocaleDateString() : '';
                      return (
                        <div key={share.id} className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-black/10 transition-colors gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {share.source_company?.logo_url ? (
                              <img src={share.source_company.logo_url} alt={share.source_company.name} className="w-6 h-6 object-contain rounded border dark:border-gray-800" />
                            ) : (
                              <div className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center text-[10px] font-bold">C</div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-gray-800 dark:text-gray-200 truncate">{share.source_company?.name || 'Security Company'}</p>
                              <p className="text-[10px] font-mono text-gray-400 truncate">Report: {share.report_id.slice(0, 8)}... ({share.report_type})</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-mono text-gray-400 hidden sm:inline">{updatedDate}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 ${
                              share.status === 'approved' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/20'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${share.status === 'approved' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {share.status === 'approved' ? 'Approved' : 'Declined'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* OUTGOING SHARES TAB */
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest font-mono">My Requested Outgoing Shares</h3>
              
              {outgoingShares.length === 0 ? (
                <div className="p-12 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 text-center flex flex-col items-center justify-center">
                  <ShareIcon className="w-8 h-8 text-gray-400 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-full mb-2" />
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">No Outgoing Sharing Requests</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">To share a report, open any report from your main dashboard or archives, and select companies under the Corporate Sharing section.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {outgoingShares.map(share => {
                    const createdDate = share.created_at ? new Date(share.created_at).toLocaleDateString() : '';
                    return (
                      <div key={share.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-gray-300 dark:hover:border-gray-700 transition-all">
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            {share.target_company?.logo_url ? (
                              <img src={share.target_company.logo_url} alt={share.target_company.name} className="w-7 h-7 object-contain rounded-lg border dark:border-gray-800" />
                            ) : (
                              <div className="w-7 h-7 bg-primary-500/10 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400 rounded-lg flex items-center justify-center font-bold text-xs"><BuildingIcon className="w-4 h-4" /></div>
                            )}
                            <div>
                              <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">{share.target_company?.name || 'Security Partner'}</h4>
                              <p className="text-[10px] font-semibold text-gray-400 font-mono tracking-wide">REQUESTED {createdDate}</p>
                            </div>
                          </div>
                          
                          <p className="text-xs text-gray-500 dark:text-gray-400 leading-normal mb-4">Awaiting access approval to append this dispatch to their secure control room feed.</p>
                          
                          <div className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 dark:bg-black/30 rounded-xl mb-1 border border-gray-100 dark:border-gray-800/50">
                            <div className="flex items-center gap-2 truncate min-w-0">
                              <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 rounded-lg text-[9px] font-black uppercase tracking-wider">{share.report_type}</span>
                              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 truncate font-mono">ID: {share.report_id.slice(0, 8)}...</span>
                            </div>
                            
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 flex-shrink-0 ${
                              share.status === 'approved' 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20' 
                                : share.status === 'rejected'
                                  ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20 animate-pulse'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                share.status === 'approved' 
                                  ? 'bg-emerald-500' 
                                  : share.status === 'rejected' 
                                    ? 'bg-rose-500' 
                                    : 'bg-amber-500'
                              }`} />
                              {share.status === 'approved' 
                                ? 'Approved / Shared' 
                                : share.status === 'rejected' 
                                  ? 'Declined' 
                                  : 'Pending Approval'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-800 flex justify-end flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white font-bold text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl transition-all"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
