import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { Report, Profile, UserRole, ReportStatus } from '../types';
import StatusBadge from './StatusBadge';
import { LoadingSpinner } from './LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { safeFormat, safeFormatDistanceToNow } from '../utils/dateUtils';
import { 
  HistoryIcon, 
  ClockIcon, 
  MapPinIcon
} from './icons';
import { 
  ShieldAlert, 
  Shield, 
  UserCheck, 
  UserMinus, 
  FileText, 
  Activity, 
  Filter, 
  ArrowDownUp, 
  Sparkles,
  Radio,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  User,
  Clock
} from 'lucide-react';

export interface TimelineEvent {
  id: string;
  type: 'creation' | 'status_change' | 'assignment' | 'unassignment' | 'note' | 'resolution' | 'system';
  title: string;
  description?: string;
  timestamp: string;
  actor: {
    name: string;
    role?: string;
    companyName?: string;
    isSystem?: boolean;
    isAnonymous?: boolean;
  };
  metadata?: {
    fromStatus?: ReportStatus | string;
    toStatus?: ReportStatus | string;
    assignedTo?: string;
    assignedFrom?: string;
    [key: string]: any;
  };
}

interface IncidentTimelineProps {
  report: Report;
  profile: Profile;
  className?: string;
  title?: string;
  compact?: boolean;
  allowAddNote?: boolean;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({
  report,
  profile,
  className = '',
  title = 'Incident Timeline & Audit Trail',
  compact = false,
  allowAddNote = true,
}) => {
  const { addToast } = useToast();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'status' | 'assignment' | 'notes'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // newest first by default

  // Note entry state
  const [noteContent, setNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const canAddNote = allowAddNote && (
    [UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER, UserRole.RESPONDER].includes(profile.role) ||
    report.reported_by === profile.id
  );

  // Quick Action Presets
  const quickNotes = [
    'Unit en route to location',
    'Arrived on scene • Assessing situation',
    'Suspect / vehicle sighted in area',
    'Scene secured • Area all clear',
    'Case handed over to SAPS / Emergency Services',
  ];

  // Fetch timeline data from database
  const fetchTimelineEvents = useCallback(async (showRefreshingSpinner = false) => {
    if (showRefreshingSpinner) setIsRefreshing(true);
    else setLoading(true);

    try {
      if ((report as any).is_legacy || report.id.startsWith('legacy-')) {
        // Construct fallback initial event for legacy records
        const initialEvent: TimelineEvent = {
          id: `initial-${report.id}`,
          type: 'creation',
          title: 'Incident Logged in Central System',
          description: `Initial ${report.type || 'crime'} report registered: ${(report as any).title || report.ob_number}`,
          timestamp: report.reported_at || new Date().toISOString(),
          actor: {
            name: 'System Dispatch / Historical Archive',
            role: 'System',
            isSystem: true,
          },
          metadata: {
            toStatus: report.status,
          },
        };
        setEvents([initialEvent]);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      // 1. Fetch report updates & notes
      // 2. Fetch assignment logs
      // 3. Fetch reporter profile info
      const [
        { data: updatesData, error: updatesError },
        { data: historyData, error: historyError },
        { data: reporterProfile }
      ] = await Promise.all([
        supabase
          .from('report_updates')
          .select('*, profile:profiles(id, first_name, surname, role, company_id, company:companies(name))')
          .eq('report_id', report.id)
          .order('created_at', { ascending: true })
          .limit(200),
        supabase
          .from('assignment_logs')
          .select(`
            *,
            assigned_from_profile:profiles!assignment_logs_assigned_from_fkey(first_name, surname, role),
            assigned_to_profile:profiles!assignment_logs_assigned_to_fkey(first_name, surname, role),
            assigned_by_profile:profiles!assignment_logs_assigned_by_fkey(first_name, surname, role)
          `)
          .eq('report_id', report.id)
          .order('created_at', { ascending: true })
          .limit(100),
        report.reported_by && report.reported_by !== 'system'
          ? supabase.from('profiles').select('id, first_name, surname, role').eq('id', report.reported_by).maybeSingle()
          : Promise.resolve({ data: null })
      ]);

      if (updatesError) console.warn('Error fetching report updates:', updatesError);
      if (historyError) console.warn('Error fetching assignment logs:', historyError);

      const aggregatedEvents: TimelineEvent[] = [];

      // 1. Root Event: Incident Logged / Reported
      const reporterName = reporterProfile?.data
        ? `${reporterProfile.data.first_name} ${reporterProfile.data.surname}`
        : ((report as any).reporter_name || (report.reported_by === 'system' ? 'Public Web Hotline / System Dispatch' : 'Community Member'));

      const isAnonymousSubmission = !reporterProfile?.data && !((report as any).reporter_name);

      aggregatedEvents.push({
        id: `created-${report.id}`,
        type: 'creation',
        title: `Incident Filed & Logged (${report.ob_number})`,
        description: `Initial report logged for ${(report as any).location || (report as any).last_seen_location || 'Unspecified location'}. Category: ${(report as any).crime_type || (report as any).emergency_type || (report as any).license_plate || 'Incident'}`,
        timestamp: report.reported_at || (report as any).created_at || new Date().toISOString(),
        actor: {
          name: reporterName,
          role: reporterProfile?.data?.role || 'Reporter',
          isSystem: report.reported_by === 'system',
          isAnonymous: isAnonymousSubmission,
        },
        metadata: {
          toStatus: ReportStatus.ACTIVE,
        },
      });

      // 2. Process Assignment Logs
      if (historyData && historyData.length > 0) {
        historyData.forEach((log: any) => {
          const byName = log.assigned_by_profile
            ? `${log.assigned_by_profile.first_name} ${log.assigned_by_profile.surname}`
            : 'Dispatcher / System';
          const toName = log.assigned_to_profile
            ? `${log.assigned_to_profile.first_name} ${log.assigned_to_profile.surname}`
            : null;
          const fromName = log.assigned_from_profile
            ? `${log.assigned_from_profile.first_name} ${log.assigned_from_profile.surname}`
            : null;

          if (toName) {
            aggregatedEvents.push({
              id: `assign-${log.id}`,
              type: 'assignment',
              title: `Unit Assigned: ${toName}`,
              description: fromName
                ? `Reassigned from ${fromName} to ${toName}`
                : `Officer ${toName} assigned to respond to this incident.`,
              timestamp: log.created_at,
              actor: {
                name: byName,
                role: log.assigned_by_profile?.role || 'Controller',
              },
              metadata: {
                assignedTo: toName,
                assignedFrom: fromName,
              },
            });
          } else if (fromName) {
            aggregatedEvents.push({
              id: `unassign-${log.id}`,
              type: 'unassignment',
              title: `Unit Unassigned: ${fromName}`,
              description: `Responder ${fromName} was unassigned or stood down from this incident.`,
              timestamp: log.created_at,
              actor: {
                name: byName,
                role: log.assigned_by_profile?.role || 'Controller',
              },
            });
          }
        });
      }

      // 3. Process Report Updates & Status Changes
      if (updatesData && updatesData.length > 0) {
        updatesData.forEach((u: any) => {
          const profileInfo = u.profile;
          const actorName = profileInfo
            ? `${profileInfo.first_name} ${profileInfo.surname}`
            : (u.user_full_name || 'Officer / System');
          const actorRole = profileInfo?.role || 'Operator';
          const actorCompany = profileInfo?.company?.name;

          const contentText = String(u.content || '').trim();

          // Check if this update represents a status shift
          const statusMatch = contentText.match(/status (?:changed|updated) to:?\s*([a-zA-Z_\s]+)/i);

          if (statusMatch) {
            const parsedStatus = statusMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
            const isResolvedOrRecovered = parsedStatus === 'resolved' || parsedStatus === 'recovered' || parsedStatus === 'closed';

            aggregatedEvents.push({
              id: `update-${u.id}`,
              type: isResolvedOrRecovered ? 'resolution' : 'status_change',
              title: isResolvedOrRecovered
                ? `Incident Closed / ${parsedStatus.toUpperCase()}`
                : `Status Shift: ${parsedStatus.replace(/_/g, ' ').toUpperCase()}`,
              description: contentText,
              timestamp: u.created_at,
              actor: {
                name: actorName,
                role: actorRole,
                companyName: actorCompany,
              },
              metadata: {
                toStatus: parsedStatus as ReportStatus,
              },
            });
          } else if (contentText.toLowerCase().includes('self-assigned')) {
            aggregatedEvents.push({
              id: `update-${u.id}`,
              type: 'assignment',
              title: 'Responder Self-Assigned',
              description: contentText,
              timestamp: u.created_at,
              actor: {
                name: actorName,
                role: actorRole,
                companyName: actorCompany,
              },
            });
          } else if (contentText.toLowerCase().includes('unassigned self')) {
            aggregatedEvents.push({
              id: `update-${u.id}`,
              type: 'unassignment',
              title: 'Responder Stood Down',
              description: contentText,
              timestamp: u.created_at,
              actor: {
                name: actorName,
                role: actorRole,
                companyName: actorCompany,
              },
            });
          } else {
            // General Field / Tactical Note
            aggregatedEvents.push({
              id: `update-${u.id}`,
              type: 'note',
              title: 'Field Update & Log Note',
              description: contentText,
              timestamp: u.created_at,
              actor: {
                name: actorName,
                role: actorRole,
                companyName: actorCompany,
              },
            });
          }
        });
      }

      // Deduplicate and sort chronologically
      aggregatedEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      setEvents(aggregatedEvents);
    } catch (err: any) {
      console.error('Failed to construct incident timeline:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [report]);

  // Initial load and Realtime subscriptions
  useEffect(() => {
    fetchTimelineEvents();

    if ((report as any).is_legacy || report.id.startsWith('legacy-')) {
      return;
    }

    const channelId = `timeline-${report.id}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_updates', filter: `report_id=eq.${report.id}` }, () => {
        fetchTimelineEvents(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_logs', filter: `report_id=eq.${report.id}` }, () => {
        fetchTimelineEvents(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [report.id, fetchTimelineEvents]);

  // Submit a new manual note or tactical progress log
  const handleAddNote = async (e?: React.FormEvent, customNote?: string) => {
    if (e) e.preventDefault();
    const content = (customNote || noteContent).trim();

    if (!content) {
      addToast('Please enter note content.', 'warning');
      return;
    }

    setIsSubmittingNote(true);
    try {
      const { error } = await supabase.from('report_updates').insert({
        report_id: report.id,
        user_id: profile.id,
        content: content,
      });

      if (error) throw error;

      // Also log audit trail in user_activity_logs
      try {
        await supabase.from('user_activity_logs').insert({
          user_id: profile.id,
          action: 'INCIDENT_TIMELINE_NOTE',
          details: `Added field update on ${report.ob_number}: ${content}`,
        });
      } catch (logErr) {
        console.warn('Could not write user_activity_log for note:', logErr);
      }

      setNoteContent('');
      addToast('Audit log note recorded successfully.', 'success');
      await fetchTimelineEvents(true);
    } catch (err: any) {
      console.error('Error submitting timeline note:', err);
      addToast('Failed to record note: ' + err.message, 'error');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Filtered & Sorted events
  const filteredEvents = useMemo(() => {
    let result = [...events];

    if (filterType === 'status') {
      result = result.filter(e => e.type === 'creation' || e.type === 'status_change' || e.type === 'resolution');
    } else if (filterType === 'assignment') {
      result = result.filter(e => e.type === 'assignment' || e.type === 'unassignment');
    } else if (filterType === 'notes') {
      result = result.filter(e => e.type === 'note');
    }

    if (sortOrder === 'desc') {
      result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } else {
      result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    return result;
  }, [events, filterType, sortOrder]);

  // Helper for rendering node icon
  const renderNodeIcon = (event: TimelineEvent) => {
    switch (event.type) {
      case 'creation':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-500/15 text-blue-600 dark:text-cyan-400 border border-blue-500/30 flex items-center justify-center shadow-sm">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
        );
      case 'status_change':
        return (
          <div className="w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-sm">
            <Activity className="w-4 h-4" />
          </div>
        );
      case 'assignment':
        return (
          <div className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center justify-center shadow-sm">
            <UserCheck className="w-4 h-4" />
          </div>
        );
      case 'unassignment':
        return (
          <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-sm">
            <UserMinus className="w-4 h-4" />
          </div>
        );
      case 'resolution':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-sm">
            <CheckCircle className="w-4 h-4" />
          </div>
        );
      case 'note':
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 flex items-center justify-center shadow-sm">
            <FileText className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col ${className}`}>
      {/* Header Toolbar */}
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-cyan-400 border border-blue-500/20">
            <HistoryIcon className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-white tracking-tight">
                {title}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-cyan-300">
                {events.length} {events.length === 1 ? 'Event' : 'Events'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Chronological lifecycle & user audit record
            </p>
          </div>
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Pills */}
          <div className="flex items-center p-0.5 bg-gray-200/60 dark:bg-gray-800/80 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterType === 'all'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                  : 'hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('status')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterType === 'status'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                  : 'hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Status Shifts
            </button>
            <button
              onClick={() => setFilterType('assignment')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterType === 'assignment'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                  : 'hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Units
            </button>
            <button
              onClick={() => setFilterType('notes')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterType === 'notes'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                  : 'hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Notes
            </button>
          </div>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            title={sortOrder === 'desc' ? 'Showing Newest First (Click for Oldest First)' : 'Showing Oldest First (Click for Newest First)'}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-1 text-xs font-semibold"
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchTimelineEvents(true)}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors disabled:opacity-50"
            title="Refresh Timeline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className={`p-4 sm:p-6 overflow-y-auto ${compact ? 'max-h-72' : 'max-h-[460px]'} custom-scrollbar`}>
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <LoadingSpinner size="md" variant="tactical" label="Compiling incident audit trail..." />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-10 px-4 text-gray-500 dark:text-gray-400 space-y-2">
            <Filter className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-sm font-semibold">No timeline events match the selected filter.</p>
            <button
              onClick={() => setFilterType('all')}
              className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
            >
              Reset to All Events
            </button>
          </div>
        ) : (
          <div className="relative pl-4 sm:pl-6 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-blue-500/40 before:via-indigo-500/30 before:to-gray-200 dark:before:to-gray-800">
            {filteredEvents.map((event, index) => {
              const eventDate = new Date(event.timestamp);
              const isLatest = index === 0 && sortOrder === 'desc';

              return (
                <div
                  key={event.id}
                  className="relative group transition-all animate-in fade-in duration-300"
                >
                  {/* Stepper Node */}
                  <div className="absolute -left-7 sm:-left-8 top-0.5 z-10">
                    {renderNodeIcon(event)}
                  </div>

                  {/* Event Card */}
                  <div className={`ml-3.5 sm:ml-4 p-3.5 sm:p-4 rounded-2xl border transition-all ${
                    isLatest
                      ? 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-300 dark:border-blue-900/60 shadow-xs'
                      : 'bg-white dark:bg-gray-800/40 border-gray-200/80 dark:border-gray-800/80 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}>
                    {/* Top Row: Event Category, Title & Status */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white leading-tight">
                          {event.title}
                        </h4>
                        {isLatest && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-xs animate-pulse">
                            Latest
                          </span>
                        )}
                      </div>

                      {/* Status badge pill if applicable */}
                      {event.metadata?.toStatus && (
                        <StatusBadge status={event.metadata.toStatus as ReportStatus} size="xs" />
                      )}
                    </div>

                    {/* Description narrative */}
                    {event.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed break-words whitespace-pre-wrap">
                        {event.description}
                      </p>
                    )}

                    {/* Metadata Footer: Actor & Timestamp */}
                    <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      {/* Actor Information */}
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center text-[10px] font-bold">
                          {event.actor.isSystem ? '⚙️' : (event.actor.name?.charAt(0) || 'U')}
                        </span>
                        <span className="text-gray-900 dark:text-gray-200 font-semibold">
                          {event.actor.name}
                        </span>
                        {event.actor.role && (
                          <span className="px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-mono uppercase">
                            {event.actor.role}
                          </span>
                        )}
                        {event.actor.companyName && (
                          <span className="text-gray-400 text-[10px] font-mono">
                            • {event.actor.companyName}
                          </span>
                        )}
                      </div>

                      {/* Timestamp Info */}
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-gray-400" title={eventDate.toLocaleString()}>
                        <ClockIcon className="w-3 h-3 text-gray-400" />
                        <span>{safeFormatDistanceToNow(event.timestamp, { addSuffix: true })}</span>
                        <span>•</span>
                        <span>{safeFormat(event.timestamp, 'dd MMM HH:mm:ss')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Add Note / Field Entry Bar */}
      {canAddNote && !(report as any).is_legacy && !report.id.startsWith('legacy-') && (
        <div className="p-3.5 sm:p-4 bg-gray-50/80 dark:bg-gray-950/60 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
            <span className="text-[10px] font-mono uppercase text-gray-400 font-bold shrink-0">Quick Logs:</span>
            {quickNotes.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAddNote(undefined, preset)}
                disabled={isSubmittingNote}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-cyan-400 border border-gray-200 dark:border-gray-700 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                + {preset}
              </button>
            ))}
          </div>

          {/* Form Input */}
          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              type="text"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Record officer update, situational report, or audit note..."
              disabled={isSubmittingNote}
              className="flex-grow px-3.5 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-sans disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSubmittingNote || !noteContent.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              {isSubmittingNote ? (
                <LoadingSpinner size="xs" variant="white" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Log Note</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default IncidentTimeline;
