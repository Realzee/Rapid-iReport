import React, { useState, useEffect, useMemo } from 'react';
import { Report, Profile, VehicleReport, ReportStatus, Responder, ReportUpdate, ResponderStatus, AssignmentLog, Company, UserRole } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '../utils/supabase';
import { CheckCircleIcon, AssignResponderIcon, ZapIcon, PrintIcon, TrashIcon, WhatsappIcon, DownloadIcon } from './icons';
import PrintableReport from './PrintableReport';
import { useToast } from '../contexts/ToastContext';
import IncidentChat from './IncidentChat';
import ConfirmModal from './ConfirmModal';
import { logoUrl } from '../assets/logo';

const isVehicleReport = (report: Report): report is VehicleReport => 'license_plate' in report;

const DetailField: React.FC<{ label: string, children: React.ReactNode, className?: string }> = ({ label, children, className }) => (
    <div className={className}>
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <div className="mt-1 text-sm">{children}</div>
    </div>
);

const TimelineItem: React.FC<{
    icon: React.ReactNode;
    children: React.ReactNode;
    author?: string | null;
    time: string;
}> = ({ icon, children, author, time }) => (
    <div className="flex gap-4 relative">
        <div className="absolute left-4 top-10 -bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700 last:hidden"></div>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center ring-4 ring-white dark:ring-gray-900/80 z-10">
            {icon}
        </div>
        <div className="flex-grow pb-2">
            <div className="text-sm text-gray-800 dark:text-gray-200">{children}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {author && <span className="font-semibold">{author}</span>}
                {author && ' · '}
                <span>{time}</span>
            </div>
        </div>
    </div>
);


const ControllerReportDetail: React.FC<{ report: Report; responders: Responder[]; profile: Profile; allUsers: Profile[] }> = ({ report, responders, profile, allUsers }) => {
    const [updates, setUpdates] = useState<ReportUpdate[]>([]);
    const [assignmentHistory, setAssignmentHistory] = useState<AssignmentLog[]>([]);
    const [reporter, setReporter] = useState<Profile | null>(null);
    const [newUpdate, setNewUpdate] = useState('');
    const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<ReportStatus>(report.status);
    const [selectedResponder, setSelectedResponder] = useState<string>(report.assigned_to || '');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isGeneratingBolo, setIsGeneratingBolo] = useState(false);
    const { addToast } = useToast();

    const isTerminalStatus = useMemo(() => {
        return [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED, ReportStatus.REJECTED, ReportStatus.DELETED].includes(report.status);
    }, [report.status]);
    
    const canManageReport = useMemo(() => [UserRole.ADMIN, UserRole.MODERATOR, UserRole.CONTROLLER].includes(profile.role), [profile.role]);

    useEffect(() => {
        setSelectedStatus(report.status);
        setSelectedResponder(report.assigned_to || '');

        const fetchDetails = async () => {
            const [
                { data: updatesData, error: updatesError },
                { data: historyData, error: historyError },
                { data: reporterData, error: reporterError }
            ] = await Promise.all([
                supabase.from('report_updates').select('*, profile:profiles(full_name)').eq('report_id', report.id).order('created_at', { ascending: true }),
                supabase.from('assignment_logs').select(`*, assigned_from_profile:profiles!assignment_logs_assigned_from_fkey(full_name), assigned_to_profile:profiles!assignment_logs_assigned_to_fkey(full_name), assigned_by_profile:profiles!assignment_logs_assigned_by_fkey(full_name)`).eq('report_id', report.id).order('created_at', { ascending: false }),
                supabase.from('profiles').select('full_name').eq('id', report.reported_by).single()
            ]);

            if (updatesError) console.error("Error fetching report updates:", updatesError);
            else setUpdates(updatesData?.map(u => ({...u, user_full_name: (u.profile as any)?.full_name || 'System'})) || []);

            if (historyError) console.error("Error fetching assignment history:", historyError);
            else if (historyData) {
                const formattedHistory = historyData.map((log: any) => ({
                    ...log,
                    assigned_from_name: log.assigned_from_profile?.full_name || null,
                    assigned_to_name: log.assigned_to_profile?.full_name || null,
                    assigned_by_name: log.assigned_by_profile?.full_name || 'System',
                }));
                setAssignmentHistory(formattedHistory);
            }
            
            if (reporterError) console.error("Error fetching reporter:", reporterError);
            else setReporter(reporterData as any);
        };
        
        fetchDetails();

        const updatesChannel = supabase
            .channel(`report-updates-${report.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'report_updates', filter: `report_id=eq.${report.id}`}, 
            async (payload) => {
                const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', payload.new.user_id).single();
                const newUpdateWithUser = { ...payload.new, user_full_name: profileData?.full_name || 'System' };
                setUpdates(prev => [...prev, newUpdateWithUser as ReportUpdate]);
            })
            .subscribe();
            
        const historyChannel = supabase
            .channel(`report-history-${report.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assignment_logs', filter: `report_id=eq.${report.id}`}, 
            async () => {
                const { data: historyData, error: historyError } = await supabase.from('assignment_logs').select(`*, assigned_from_profile:profiles!assignment_logs_assigned_from_fkey(full_name), assigned_to_profile:profiles!assignment_logs_assigned_to_fkey(full_name), assigned_by_profile:profiles!assignment_logs_assigned_by_fkey(full_name)`).eq('report_id', report.id).order('created_at', { ascending: false });
                if (!historyError && historyData) {
                    const formattedHistory = historyData.map((log: any) => ({ ...log, assigned_from_name: log.assigned_from_profile?.full_name || null, assigned_to_name: log.assigned_to_profile?.full_name || null, assigned_by_name: log.assigned_by_profile?.full_name || 'System' }));
                    setAssignmentHistory(formattedHistory);
                }
            })
            .subscribe();

        return () => { 
            supabase.removeChannel(updatesChannel); 
            supabase.removeChannel(historyChannel);
        };
    }, [report.id, report.status, report.assigned_to, report.reported_by]);
    
    const timelineEvents = useMemo(() => {
        const combined = [
            ...updates.map(u => ({
                id: u.id,
                type: 'update' as const,
                content: u.content,
                author: u.user_full_name,
                created_at: u.created_at,
            })),
            ...assignmentHistory.map(h => ({
                id: h.id,
                type: 'assignment' as const,
                content: h.assigned_to_name
                    ? `Assigned to ${h.assigned_to_name}`
                    : `Unassigned from ${h.assigned_from_name}`,
                author: h.assigned_by_name,
                created_at: h.created_at,
            }))
        ];
        const sorted = combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return sorted;
    }, [updates, assignmentHistory]);

    const handleUpdateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUpdate.trim() || isTerminalStatus) return;

        setIsSubmittingUpdate(true);
        const { error } = await supabase.from('report_updates').insert({
            report_id: report.id,
            user_id: profile.id,
            content: newUpdate,
        });

        if (error) {
            addToast('Failed to post update: ' + error.message, 'error');
        } else {
            setNewUpdate('');
        }
        setIsSubmittingUpdate(false);
    };

    const handleStatusUpdate = async (newStatus: ReportStatus) => {
        if (isTerminalStatus) return;
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        const isNowTerminal = [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED, ReportStatus.REJECTED].includes(newStatus);
    
        const updatePayload: { status: ReportStatus; assigned_to?: string | null } = { status: newStatus };
    
        if (isNowTerminal && report.assigned_to) {
            updatePayload.assigned_to = null;
        }
    
        const { error: updateError } = await supabase.from(tableName).update(updatePayload).eq('id', report.id);
        if (updateError) {
            addToast("Failed to update status: " + updateError.message, 'error');
            return;
        }
    
        await supabase.from('report_updates').insert({
            report_id: report.id,
            user_id: profile.id,
            content: `Status changed to: ${newStatus.replace(/_/g, ' ')}`
        });
    
        if (isNowTerminal && report.assigned_to) {
            const responderId = report.assigned_to;
            
            const { count: activeVehicleAssignments } = await supabase
                .from('vehicle_reports')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', responderId)
                .in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
            
            const { count: activeCrimeAssignments } = await supabase
                .from('crime_reports')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', responderId)
                .in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
    
            if ((activeVehicleAssignments === null || activeVehicleAssignments === 0) && (activeCrimeAssignments === null || activeCrimeAssignments === 0)) {
                const { error: profileUpdateError } = await supabase.from('profiles').update({ responder_status: ResponderStatus.AVAILABLE }).eq('id', responderId);
                if(profileUpdateError) console.warn("Report status updated, but failed to update responder status:", profileUpdateError.message);
            }
        }
    };

    const handleDispatchResponder = async (responderId: string) => {
        if (isTerminalStatus) return;
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        const oldResponderId = report.assigned_to;
    
        const { error: reportUpdateError } = await supabase.from(tableName).update({ 
            assigned_to: responderId || null,
            status: responderId ? ReportStatus.IN_PROGRESS : ReportStatus.ACTIVE 
        }).eq('id', report.id);
    
        if (reportUpdateError) {
            addToast("Failed to dispatch responder: " + reportUpdateError.message, 'error');
            return;
        }
    
        const responderStatusUpdates: PromiseLike<any>[] = [];
    
        if (oldResponderId && oldResponderId !== responderId) {
            const { count: otherVehicleAssignments, error: vError } = await supabase.from('vehicle_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', oldResponderId).neq('id', report.id).in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
            const { count: otherCrimeAssignments, error: cError } = await supabase.from('crime_reports').select('*', { count: 'exact', head: true }).eq('assigned_to', oldResponderId).neq('id', report.id).in('status', [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS, ReportStatus.ON_SCENE]);
    
            if (!vError && !cError) {
                const hasOtherActiveAssignments = (otherVehicleAssignments !== null && otherVehicleAssignments > 0) || (otherCrimeAssignments !== null && otherCrimeAssignments > 0);
                if (!hasOtherActiveAssignments) {
                    responderStatusUpdates.push(
                        supabase.from('profiles').update({ responder_status: ResponderStatus.AVAILABLE }).eq('id', oldResponderId)
                    );
                }
            } else {
                console.warn("Could not check for other active reports when unassigning:", vError || cError);
            }
        }
        
        if (responderId && oldResponderId !== responderId) {
            responderStatusUpdates.push(
                supabase.from('profiles').update({ responder_status: ResponderStatus.EN_ROUTE }).eq('id', responderId)
            );
        }
    
        if (responderStatusUpdates.length > 0) {
            Promise.all(responderStatusUpdates).then(results => {
                const updateError = results.find(res => res.error);
                if (updateError) {
                    console.warn("Report was dispatched, but failed to update a responder's status:", updateError.error.message);
                }
            });
        }
    };
    
    const handleShareWhatsApp = () => {
        let text = `*RAPID iREPORT ALERT*\n\n`;
        if (isVehicleReport(report)) {
            text += `*Type:* Vehicle Theft\n`;
            text += `*License Plate:* ${report.license_plate}\n`;
            text += `*Vehicle:* ${report.vehicle_make} ${report.vehicle_model} (${report.vehicle_color})\n`;
            text += `*Last Seen:* ${report.last_seen_location}\n`;
        } else {
            text += `*Type:* Crime Incident\n`;
            text += `*Title:* ${report.title}\n`;
            text += `*Crime Type:* ${report.crime_type}\n`;
            text += `*Location:* ${report.location}\n`;
        }
        text += `*OB Number:* ${report.ob_number}\n`;
        text += `*Severity:* ${report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}\n\n`;
        text += `*Description:* ${report.description}\n\n`;
        text += `View our official channel: https://whatsapp.com/channel/0029Vb6sVknBqbr1vAMsJ80U`;
        
        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    };

    const generateBoloImage = async () => {
        setIsGeneratingBolo(true);

        const fetchImageAsDataURL = async (url: string) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
                const blob = await response.blob();
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.error("Error fetching image for BOLO card:", error);
                addToast("Failed to load image for BOLO card.", 'error');
                return null;
            }
        };

        const imageUrl = report.evidence_images && report.evidence_images.length > 0 ? report.evidence_images[0] : null;
        const imageAsDataUrl = imageUrl ? await fetchImageAsDataURL(imageUrl) : null;
        
        const companyName = profile.company?.name || '';
        const companyLogoUrl = profile.company?.logo_url;
        const companyLogoAsDataUrl = companyLogoUrl ? await fetchImageAsDataURL(companyLogoUrl) : logoUrl;

        const reportImageHtml = imageAsDataUrl
            ? `<img src="${imageAsDataUrl}" alt="Evidence" style="width: 100%; height: 100%; object-fit: cover;" />`
            : `<span style="color: #9CA3AF; font-size: 16px;">No Image Available</span>`;
        
        const vehicleDetailsHtml = isVehicleReport(report) ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                <div><p style="margin: 0; font-size: 12px; color: #6B7280; text-transform: uppercase; font-weight: 500;">Make</p><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #111827;">${report.vehicle_make}</p></div>
                <div><p style="margin: 0; font-size: 12px; color: #6B7280; text-transform: uppercase; font-weight: 500;">Model</p><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #111827;">${report.vehicle_model}</p></div>
                <div><p style="margin: 0; font-size: 12px; color: #6B7280; text-transform: uppercase; font-weight: 500;">Color</p><p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #111827;">${report.vehicle_color}</p></div>
            </div>
        ` : '';

        const boloHtml = `
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; flex-direction: column; width: 380px; height: 580px; background-color: #FFFFFF; color: #111827; border-radius: 12px; padding: 20px; border: 1px solid #E5E7EB; box-sizing: border-box; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #EF4444; padding-bottom: 12px; margin-bottom: 12px;">
                    <h1 style="font-size: 28px; font-weight: 700; color: #111827; margin: 0; text-transform: uppercase;">BOLO Alert</h1>
                    <div style="text-align: right;">
                        <img src="${companyLogoAsDataUrl}" alt="Logo" style="width: 80px; height: auto; object-fit: contain; margin-bottom: 4px;" />
                        ${companyName ? `<p style="margin: 0; font-weight: 700; font-size: 14px; color: #111827;">${companyName}</p>` : ''}
                    </div>
                </div>
                <div style="width: 100%; height: 200px; background-color: #F3F4F6; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #E5E7EB;">
                    ${reportImageHtml}
                </div>
                <div style="background-color: #F3F4F6; padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: center; border: 1px solid #E5E7EB;">
                    <p style="margin: 0; font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">${isVehicleReport(report) ? 'License Plate' : 'Incident'}</p>
                    <p style="margin: 4px 0 0 0; font-size: 28px; font-weight: 700; letter-spacing: 2px; color: #1E40AF;">${isVehicleReport(report) ? report.license_plate : report.title}</p>
                </div>
                ${vehicleDetailsHtml}
                <div style="flex-grow: 1; min-height: 50px;">
                    <p style="margin: 0; font-size: 12px; color: #6B7280; text-transform: uppercase; margin-bottom: 6px; font-weight: 500;">Details</p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151; max-height: 60px; overflow: hidden; text-overflow: ellipsis;">
                        ${report.description}
                    </p>
                </div>
                <div style="border-top: 1px solid #E5E7EB; padding-top: 12px; margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #9CA3AF; font-family: monospace;">
                    <span>OB: ${report.ob_number}</span>
                    <span>${format(new Date(report.reported_at), 'yyyy-MM-dd HH:mm')}</span>
                </div>
            </div>`;

        const svgString = `<svg width="400" height="600" xmlns="http://www.w3.org/2000/svg"><foreignObject width="400" height="600">${boloHtml.replace(/#/g, '%23')}</foreignObject></svg>`;
        const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 600;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0);
                const jpgUrl = canvas.toDataURL('image/jpeg', 0.9);
                const a = document.createElement('a');
                a.href = jpgUrl;
                a.download = `bolo-${report.ob_number.replace(/\//g, '-')}.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            setIsGeneratingBolo(false);
        };
        image.onerror = (e) => {
            addToast("Failed to generate BOLO card image. Check console for errors.", 'error');
            console.error("Image loading error for BOLO card:", e);
            setIsGeneratingBolo(false);
        }
        image.src = svgDataUrl;
    };

    const handlePrint = () => { window.print(); };

    const handleConfirmDelete = async () => {
        const tableName = isVehicleReport(report) ? 'vehicle_reports' : 'crime_reports';
        const { error } = await supabase.from(tableName).update({ 
            status: ReportStatus.DELETED,
            deleted_by: profile.id,
            deleted_at: new Date().toISOString()
        }).eq('id', report.id);
        if (error) {
            addToast(`Error deleting report: ${error.message}`, 'error');
        } else {
            addToast('Report moved to archives successfully.', 'success');
        }
        setDeleteModalOpen(false);
    };
    
    const availableResponders = responders.filter(r => r.status === ResponderStatus.AVAILABLE);
    const currentlyAssignedResponder = report.assigned_to ? responders.find(r => r.id === report.assigned_to) : undefined;
    const responderOptions = [...availableResponders];
    if (currentlyAssignedResponder && !availableResponders.some(r => r.id === currentlyAssignedResponder.id)) {
        responderOptions.push(currentlyAssignedResponder);
    }
    const statusOptions = Object.values(ReportStatus).filter(s => s !== ReportStatus.DELETED);

    return (
        <>
            <div className="bg-white/70 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col text-gray-900 dark:text-white backdrop-blur-lg shadow-lg print:hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700/50 flex-shrink-0 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold">Report Details: {report.ob_number}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {isVehicleReport(report) ? 'Stolen Vehicle' : report.title} - {format(new Date(report.reported_at), 'MM/dd/yyyy, hh:mm a')}
                        </p>
                    </div>
                </div>

                <div className="flex-grow p-4 space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <DetailField label="Severity"><p className="font-semibold text-md capitalize">{report.severity}</p></DetailField>
                        <DetailField label="Status"><span className="px-3 py-1 text-xs font-bold rounded-full capitalize border bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">{report.status.replace(/_/g, ' ')}</span></DetailField>
                    </div>
                    
                    <DetailField label="Description"><p className="whitespace-pre-wrap">{report.description}</p></DetailField>
                    
                    {isVehicleReport(report) && (
                        <DetailField label="Vehicle Details">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-gray-800 dark:text-white bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-xs">{report.license_plate}</span>
                                <span>{report.vehicle_color} {report.vehicle_make} {report.vehicle_model}</span>
                            </div>
                        </DetailField>
                    )}

                    {report.evidence_images && report.evidence_images.length > 0 && (
                        <DetailField label="Evidence">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {report.evidence_images.map((img, index) => (
                                    <a href={img} target="_blank" rel="noopener noreferrer" key={index} className="relative group block w-full h-24 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                                        <img 
                                            src={img} 
                                            alt={`Evidence ${index + 1}`} 
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
                                            <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V8m0 0h-4m4 0l-5-5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" />
                                            </svg>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </DetailField>
                    )}

                     <DetailField label="Incident Timeline">
                        <div className="space-y-1">
                            {timelineEvents.length === 0 ? (
                                <div className="text-center py-8">
                                   <p className="text-sm text-gray-500">No updates or assignments yet.</p>
                                </div>
                            ) : (
                                timelineEvents.map(event => (
                                    <TimelineItem
                                        key={`${event.type}-${event.id}`}
                                        time={formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                                        author={event.author}
                                        icon={event.type === 'assignment' ? <AssignResponderIcon className="w-4 h-4 text-gray-500" /> : <ZapIcon className="w-4 h-4 text-gray-500" />}
                                    >
                                        <p>{event.content}</p>
                                    </TimelineItem>
                                ))
                            )}
                        </div>
                    </DetailField>
                    <DetailField label="Live Communication">
                        <IncidentChat reportId={report.id} currentUserProfile={profile} allUsers={allUsers} disabled={isTerminalStatus} noInternalScroll={true} />
                    </DetailField>
                </div>

                <div className={`p-4 border-t border-gray-200 dark:border-gray-700/50 space-y-3 flex-shrink-0 bg-white/50 dark:bg-gray-900/50`}>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={handleShareWhatsApp} className="flex items-center justify-center gap-2 py-2.5 px-3 bg-green-600/90 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-semibold">
                            <WhatsappIcon className="w-5 h-5"/> Share BOLO
                        </button>
                         <button onClick={generateBoloImage} disabled={isGeneratingBolo} className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-wait">
                            {isGeneratingBolo ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <DownloadIcon className="w-5 h-5"/>}
                            <span>{isGeneratingBolo ? 'Generating...' : 'BOLO Card'}</span>
                        </button>
                    </div>
                    {canManageReport && (
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handlePrint} className="flex items-center justify-center gap-2 py-2 px-3 bg-gray-500/90 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-semibold">
                                <PrintIcon className="w-5 h-5"/> Print
                            </button>
                            <button onClick={() => setDeleteModalOpen(true)} disabled={isTerminalStatus} className="flex items-center justify-center gap-2 py-2 px-3 bg-red-600/90 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                <TrashIcon className="w-5 h-5"/> Delete
                            </button>
                        </div>
                    )}
                    <div className={`${isTerminalStatus ? 'opacity-50 cursor-not-allowed' : ''} space-y-2`}>
                        <form onSubmit={handleUpdateSubmit} className="flex-shrink-0">
                             <div className="relative">
                                <textarea value={newUpdate} onChange={(e) => setNewUpdate(e.target.value)} placeholder={isTerminalStatus ? "This incident is closed." : "Type an update..."} rows={2} disabled={isTerminalStatus} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 pl-3 pr-10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:cursor-not-allowed"/>
                                <button type="submit" disabled={isSubmittingUpdate || isTerminalStatus} className="absolute top-2 right-2 p-2 text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                                </button>
                            </div>
                        </form>

                        <div>
                            <div className="flex items-center gap-2">
                                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as ReportStatus)} disabled={isTerminalStatus} className="flex-grow bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 capitalize disabled:cursor-not-allowed">
                                    {statusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                                </select>
                                 <button onClick={() => handleStatusUpdate(selectedStatus)} disabled={isTerminalStatus} className="p-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:cursor-not-allowed">
                                    <CheckCircleIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                </button>
                            </div>
                        </div>
                         <div>
                            <div className="flex items-center gap-2">
                                <select value={selectedResponder} onChange={(e) => setSelectedResponder(e.target.value)} disabled={isTerminalStatus} className="flex-grow bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed">
                                    <option value="">{report.assigned_to ? 'Unassign' : (availableResponders.length > 0 ? 'Select Responder...' : 'No responders available')}</option>
                                    {responderOptions.map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.full_name}
                                            {r.status !== ResponderStatus.AVAILABLE ? ` (${r.status.replace(/_/g, ' ')})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <button onClick={() => handleDispatchResponder(selectedResponder)} disabled={isTerminalStatus} className="p-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:cursor-not-allowed">
                                    <AssignResponderIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <PrintableReport
                report={report}
                timelineEvents={timelineEvents}
                reporterName={reporter?.full_name}
                company={profile.company}
            />
            {deleteModalOpen && (
                <ConfirmModal
                    isOpen={deleteModalOpen}
                    onClose={() => setDeleteModalOpen(false)}
                    onConfirm={handleConfirmDelete}
                    title="Delete Incident Report"
                    message={`Are you sure you want to delete this report? It will be moved to the Incident Archives and removed from all active views.`}
                    confirmText="Confirm Delete"
                    confirmVariant="danger"
                />
            )}
        </>
    );
};

export default ControllerReportDetail;