
import React, { useState, useEffect, useMemo } from 'react';
import { Report, Profile, VehicleReport, AccidentReport, ReportStatus, Responder, ReportUpdate, ResponderStatus, AssignmentLog, Company, UserRole } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '../utils/supabase';
import { CheckCircleIcon, AssignResponderIcon, ZapIcon, PrintIcon, TrashIcon, WhatsappIcon, DownloadIcon, ChevronUpIcon, ChevronDownIcon, EyeIcon, CarIcon, AlertTriangleIcon, CrimeIcon } from './icons';
import PrintableReport from './PrintableReport';
import ReportTypeBadge from './ReportTypeBadge';
import { useToast } from '../contexts/ToastContext';
import ConfirmModal from './ConfirmModal';
import { logoUrl } from '../assets/logo';
import { useChat } from '../contexts/ChatContext';
import ImagePreviewModal from './ImagePreviewModal';

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


const ControllerReportDetail: React.FC<{ report: Report; responders: Responder[]; profile: Profile; allUsers: Profile[]; onEdit: (report: Report) => void }> = ({ report, responders, profile, allUsers, onEdit }) => {
    const [updates, setUpdates] = useState<ReportUpdate[]>([]);
    const [assignmentHistory, setAssignmentHistory] = useState<AssignmentLog[]>([]);
    const [reporter, setReporter] = useState<Profile | null>(null);
    const [newUpdate, setNewUpdate] = useState('');
    const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<ReportStatus>(report.status);
    const [selectedResponder, setSelectedResponder] = useState<string>(report.assigned_to || '');
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isGeneratingBolo, setIsGeneratingBolo] = useState(false);
    const [isTimelineVisible, setIsTimelineVisible] = useState(true);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const { addToast } = useToast();
    const { openChat } = useChat();

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
                supabase.from('report_updates').select('*, profile:profiles(first_name, surname)').eq('report_id', report.id).order('created_at', { ascending: true }),
                supabase.from('assignment_logs').select(`*, assigned_from_profile:profiles!assignment_logs_assigned_from_fkey(first_name, surname), assigned_to_profile:profiles!assignment_logs_assigned_to_fkey(first_name, surname), assigned_by_profile:profiles!assignment_logs_assigned_by_fkey(first_name, surname)`).eq('report_id', report.id).order('created_at', { ascending: false }),
                supabase.from('profiles').select('first_name, surname').eq('id', report.reported_by).maybeSingle()
            ]);

            if (updatesError) console.error("Error fetching report updates:", updatesError);
            else setUpdates(updatesData?.map(u => {
                const profile = u.profile as { first_name: string; surname: string } | null;
                return {...u, user_full_name: profile ? `${profile.first_name} ${profile.surname}` : 'System' };
            }) || []);

            if (historyError) console.error("Error fetching assignment history:", historyError);
            else if (historyData) {
                const formattedHistory = historyData.map((log: any) => {
                    const fromProfile = log.assigned_from_profile;
                    const toProfile = log.assigned_to_profile;
                    const byProfile = log.assigned_by_profile;
                    return {
                        ...log,
                        assigned_from_name: fromProfile ? `${fromProfile.first_name} ${fromProfile.surname}` : null,
                        assigned_to_name: toProfile ? `${toProfile.first_name} ${toProfile.surname}` : null,
                        assigned_by_name: byProfile ? `${byProfile.first_name} ${byProfile.surname}` : 'System',
                    }
                });
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
                const { data: profileData } = await supabase.from('profiles').select('first_name, surname').eq('id', payload.new.user_id).single();
                const newUpdateWithUser = { ...payload.new, user_full_name: profileData ? `${profileData.first_name} ${profileData.surname}` : 'System' };
                setUpdates(prev => [...prev, newUpdateWithUser as ReportUpdate]);
            })
            .subscribe();
            
        const historyChannel = supabase
            .channel(`report-history-${report.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assignment_logs', filter: `report_id=eq.${report.id}`}, 
            async () => {
                const { data: historyData, error: historyError } = await supabase.from('assignment_logs').select(`*, assigned_from_profile:profiles!assignment_logs_assigned_from_fkey(first_name, surname), assigned_to_profile:profiles!assignment_logs_assigned_to_fkey(first_name, surname), assigned_by_profile:profiles!assignment_logs_assigned_by_fkey(first_name, surname)`).eq('report_id', report.id).order('created_at', { ascending: false });
                if (!historyError && historyData) {
                    const formattedHistory = historyData.map((log: any) => {
                        const fromProfile = log.assigned_from_profile;
                        const toProfile = log.assigned_to_profile;
                        const byProfile = log.assigned_by_profile;
                        return {
                            ...log,
                            assigned_from_name: fromProfile ? `${fromProfile.first_name} ${fromProfile.surname}` : null,
                            assigned_to_name: toProfile ? `${toProfile.first_name} ${toProfile.surname}` : null,
                            assigned_by_name: byProfile ? `${byProfile.first_name} ${byProfile.surname}` : 'System',
                        }
                    });
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

    const handleAssignmentUpdate = async () => {
        setIsActionLoading(true);

        let tableName = '';
        if (report.type === 'vehicle') tableName = 'vehicle_reports';
        else if (report.type === 'accident') tableName = 'accident_reports';
        else tableName = 'crime_reports';

        const updatePayload: { status?: ReportStatus; assigned_to?: string | null; completed_at?: string | null } = {};
        let updateContent = '';
        
        const isTerminalStatus = [ReportStatus.RESOLVED, ReportStatus.RECOVERED, ReportStatus.CLOSED, ReportStatus.REJECTED].includes(selectedStatus);

        if (selectedStatus !== report.status) {
            updatePayload.status = selectedStatus;
            updateContent += `Status changed to: ${selectedStatus.replace(/_/g, ' ')}. `;
            if (isTerminalStatus) {
                updatePayload.completed_at = new Date().toISOString();
            }
        }
        if (selectedResponder !== (report.assigned_to || '')) {
            updatePayload.assigned_to = selectedResponder || null;
        }

        const { error } = await supabase.from(tableName).update(updatePayload).eq('id', report.id);

        if (error) {
            addToast('Error updating report: ' + error.message, 'error');
        } else {
            addToast('Report updated successfully', 'success');
            if (updateContent) {
                await supabase.from('report_updates').insert({ report_id: report.id, user_id: profile.id, content: updateContent });
            }
        }
        setIsActionLoading(false);
        setAssignmentModalOpen(false);
    };

    const confirmDeleteReport = async () => {
        setDeleteModalOpen(false);
        const tableName = report.type === 'vehicle' ? 'vehicle_reports' : (report.type === 'accident' ? 'accident_reports' : 'crime_reports');
        const { error } = await supabase.from(tableName).update({ 
            status: ReportStatus.DELETED,
            deleted_by: profile.id,
            deleted_at: new Date().toISOString()
        }).eq('id', report.id);
        
        if (error) addToast(`Error deleting report: ${error.message}`, 'error');
        else addToast('Report successfully moved to archives.', 'success');
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
                return null;
            }
        };

        const imageUrl = report.evidence_images && report.evidence_images.length > 0 ? report.evidence_images[0] : null;
        const imageAsDataUrl = imageUrl ? await fetchImageAsDataURL(imageUrl) : null;
        
        const companyLogoUrl = profile.company?.logo_url;
        const companyLogoAsDataUrl = companyLogoUrl ? await fetchImageAsDataURL(companyLogoUrl) : logoUrl;

        // Generate QR Codes (Placeholders pointing to generic URLs as we don't have specific ones)
        // In a real app, these would point to the specific report URL or social media post
        const qrCodeWwwUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://navic.cloud')}`;
        const qrCodeFbUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://facebook.com')}`;
        
        const [qrWwwDataUrl, qrFbDataUrl] = await Promise.all([
            fetchImageAsDataURL(qrCodeWwwUrl),
            fetchImageAsDataURL(qrCodeFbUrl)
        ]);

        // WhatsApp Icon SVG Data URL
        const whatsappIconSvg = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzI1ZDM2NiI+PHBhdGggZD0iTTE3LjQ3MiAzLjQ3OGMtMi42Ny0yLjY3MS02LjIyOC00LjEzMS0xMC4wOC00LjEzMWMtNy44NTMgMC0xNC4yNDEgNi4zODgtMTQuMjQxIDE0LjI0MmMwIDIuNTA4LjY1NSA0Ljk1NCAxLjg5OSA3LjEyM2wtMi4wMTkgNy4zNzIgNy41NDMtMS45NzhjMi4wNzcuMTEzMyA0LjQxNSAxLjczOCA2LjgxNiAxLjczOHYtLjAwMWg1LjQ1OGU3Ljg1NSAwIDE0LjI0NS02LjM5IDE0LjI0NS0xNC4yNDVjMC0zLjgwNC0xLjQ4LTYuMzc2LTQuMTQ0LTkuMDU2em0tMTAuMDggMjEuMjc1Yy0yLjExNSAwLTQuMTg4LS41Ny01Ljk5Ny0xLjYzM2wtLjQyOS0uMjUxLTQuNDU3IDEuMTY5IDEuMTg5LTQuMzQ1LS4yNzgtLjQ0MmMtMS4xNzQtMS44NjUtMS43OTMtNC4wMzEtMS43OTMtNi4yNDcgMC02LjQ5MyA1LjI4My0xMS43NzYgMTEuNzc4LTExLjc3NiA2LjQ5MSAwIDExLjc3NCA1LjI4MyAxMS43NzQgMTEuNzc2IDAgNi40OTUtNS4yODMgMTEuNzc4LTExLjc3OCAxMS43Nzh6bTYuNDQxLTguODI2Yy0uMzUzLS4xNzctMi4wODgtMS4wMjgtMi40MTEtMS4xNDctLjMyMy0uMTE4LS41NTktLjE3Ni0uNzk0LjE3Ni0uMjM1LjM1My0uOTEyIDEuMTQ3LTEuMTE4IDEuMzc5LS4yMDYuMjM1LS40MTIuMjY1LS43NjUuMDg4LS4zNTMtLjE3Ni0xLjQ5MS0uNTUtMi44MzktMS43NTItMS4wNDUtLjkzMi0xLjc1MS0yLjA4My0xLjk1Ni0yLjQzNS0uMjA2LS4zNTMtLjAyMi0uNTQ0LjE1NC0uNzIyLjE1OC0uMTU5LjM1My0uNDEyLjUyOS0uNjE4LjE3Ni0uMjA2LjIzNS0uMzUzLjM1My0uNTg4LjExOC0uMjM1LjA1OS0uNDQxLS4wMjktLjYxOC0uMDg4LS4xNzYtLjc5NC0xLjkxMi0xLjA4OC0yLjYxOC0uMjg3LS42ODUtLjU4MS0uNTkzLS43OTQtLjYwM2wtLjY3Ni0uMDE1Yy0uMjM1IDAtLjYxOC4wODgtLjk0MS40NDEtLjMyMy4zNTMtMS4yMzUgMS4yMDYtMS4yMzUgMi45NDFzMS4yNjUgMi45NDEgMS40NDEgMy4xNzZjLjE3Ni4yMzUgMi40ODggMy43OTYgNi4wMjkgNS4zMjIuODQxLjM2MiAxLjQ5OC41NzggMi4wMDcuNzQxLjg1My4yNzIgMS42My4yMzQgMi4yNDQuMTQyLjY4NS0uMTAzIDIuMDg4LS44NTMgMi4zODItMS42NzYuMjk0LS44MjMuMjk0LTEuNTI5LjIwNi0xLjY3Ni0uMDg4LS4xNDctLjMyMy0uMjM1LS42NzYtLjQxMXoiLz48L3N2Zz4=`;

        const isRecovered = ['recovered', 'resolved'].includes(report.status);
        const statusText = isRecovered ? 'RECOVERED' : (report.status === 'active' || report.status === 'assigned' || report.status === 'in_progress' || report.status === 'on_scene' ? 'HIJACKED' : report.status.toUpperCase());
        
        const reg = report.type === 'vehicle' ? (report as any).license_plate : 'N/A';
        const make = report.type === 'vehicle' ? (report as any).vehicle_make : 'N/A';
        const model = report.type === 'vehicle' ? (report as any).vehicle_model : 'N/A';
        const color = report.type === 'vehicle' ? (report as any).vehicle_color : 'N/A';
        const caseNumber = report.cas_number ? `${report.station_name || ''} ${report.cas_number}` : 'N/A';

        const boloHtml = `
            <div xmlns="http://www.w3.org/1999/xhtml" style="width: 580px; height: 820px; background-color: #000000; font-family: Arial, sans-serif; display: flex; flex-direction: column; box-sizing: border-box;">
                <!-- Header -->
                <div style="background-color: #EF4444; padding: 15px 10px; text-align: center; border-bottom: 2px solid #991B1B;">
                    <div style="font-size: 18px; font-weight: bold; color: #000000; margin-bottom: 5px;">WC Stolen & Hijacked Vehicles NPC</div>
                    <div style="font-size: 72px; font-weight: 900; color: #000000; font-family: 'Impact', sans-serif; line-height: 1; letter-spacing: 2px; text-transform: uppercase;">SOUGHT VEHICLE</div>
                </div>

                <!-- Image Area -->
                <div style="position: relative; width: 100%; height: 400px; background-color: #333333; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                    ${imageAsDataUrl 
                        ? `<img src="${imageAsDataUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` 
                        : `<div style="color: #666; font-size: 24px; font-weight: bold;">NO IMAGE AVAILABLE</div>`
                    }
                    ${isRecovered ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #FFFF00; font-size: 90px; font-weight: 900; font-family: 'Impact', sans-serif; text-shadow: 4px 4px 8px #000000; letter-spacing: 5px; z-index: 10; border: 4px solid #000; padding: 0 20px; background-color: rgba(0,0,0,0.3);">RECOVERED</div>` : ''}
                </div>

                <!-- Details Section -->
                <div style="display: flex; padding: 25px 30px; color: #FFFFFF; flex-grow: 1; justify-content: space-between;">
                    <!-- Left Column: Details -->
                    <div style="flex: 1; font-size: 28px; line-height: 1.4; font-family: 'Arial', sans-serif;">
                        <div style="margin-bottom: 8px;"><span style="font-weight: normal;">Status:</span> <span style="font-weight: bold;">${statusText}</span></div>
                        <div style="margin-bottom: 8px;"><span style="font-weight: normal;">Reg:</span> <span style="font-weight: bold;">${reg}</span></div>
                        <div style="margin-bottom: 8px;"><span style="font-weight: normal;">Make:</span> <span style="font-weight: bold;">${make}</span></div>
                        <div style="margin-bottom: 8px;"><span style="font-weight: normal;">Type:</span> <span style="font-weight: bold;">${model}</span></div>
                        <div style="margin-bottom: 8px;"><span style="font-weight: normal;">Colour:</span> <span style="font-weight: bold;">${color}</span></div>
                        <div style="margin-bottom: 8px;"><span style="font-weight: normal;">Case:</span> <span style="font-weight: bold;">${caseNumber}</span></div>
                    </div>

                    <!-- Right Column: QR Codes -->
                    <div style="width: 140px; display: flex; flex-direction: column; gap: 15px; align-items: center; justify-content: flex-start; padding-top: 5px;">
                        <div style="background: white; padding: 5px; border-radius: 4px;">
                            <img src="${qrWwwDataUrl}" style="width: 120px; height: 120px; display: block;" />
                        </div>
                        <div style="background: white; padding: 5px; border-radius: 4px;">
                            <img src="${qrFbDataUrl}" style="width: 120px; height: 120px; display: block;" />
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="text-align: center; color: #FFFFFF; padding: 10px 20px 25px 20px; margin-top: auto;">
                    <div style="font-size: 18px; margin-bottom: 15px; font-weight: 500;">If spotted please contact SAPS Crime Stop on 08600<br/>10111 or your nearest SAPS Station</div>
                    <div style="font-size: 22px; font-weight: bold; font-family: serif; margin-bottom: 25px;">"Working TOGETHER we are STRONGER"</div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 20px;">
                        <!-- Left Logo -->
                        <div style="width: 120px; height: 70px; background: #000; border: 1px solid #333; display: flex; align-items: center; justify-content: center; border-radius: 8px; overflow: hidden;">
                             <img src="${companyLogoAsDataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                        </div>

                        <!-- Center Contact -->
                        <div style="text-align: center;">
                            <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
                                 <img src="${whatsappIconSvg}" style="width: 50px; height: 50px;" />
                            </div>
                            <div style="font-size: 28px; font-weight: bold;">062 031 3134</div>
                        </div>

                        <!-- Right Logo -->
                        <div style="width: 120px; height: 70px; background: #000; border: 1px solid #333; display: flex; align-items: center; justify-content: center; border-radius: 8px; overflow: hidden;">
                             <img src="${companyLogoAsDataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                        </div>
                    </div>
                </div>
            </div>`;

        const svgString = `<svg width="580" height="820" xmlns="http://www.w3.org/2000/svg"><foreignObject width="580" height="820">${boloHtml}</foreignObject></svg>`;
        const svgDataUrl = `data:image/svg+xml;base64,${btoa(encodeURIComponent(svgString).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16))))}`;

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 580;
            canvas.height = 820;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(image, 0, 0);
                const pngUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = pngUrl;
                a.download = `bolo-${report.ob_number.replace(/\//g, '-')}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            setIsGeneratingBolo(false);
        };
        image.onerror = () => { addToast("Failed to generate BOLO card image.", 'error'); setIsGeneratingBolo(false); }
        image.src = svgDataUrl;
    };
    
    return (
        <>
            <PrintableReport 
                report={report} 
                timelineEvents={timelineEvents} 
                reporterName={reporter ? `${reporter.first_name} ${reporter.surname}` : 'Unknown'}
                company={profile.company}
            />
            <div className="bg-white/70 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg flex flex-col h-full print:hidden relative">
            <div className="flex-shrink-0">
                <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <ReportTypeBadge type={report.type as any} className="p-1.5" />
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate pr-2">{report.type === 'vehicle' ? (report as any).license_plate : report.title}</h3>
                        </div>
                        <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{report.ob_number}</p>
                    </div>
                     <button onClick={() => setIsTimelineVisible(!isTimelineVisible)} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50 transition">
                        {isTimelineVisible ? <ChevronUpIcon className="w-5 h-5"/> : <ChevronDownIcon className="w-5 h-5" />}
                     </button>
                </div>
                
                 <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isTimelineVisible ? 'max-h-[500px] mt-4' : 'max-h-0'}`}>
                    <h4 className="font-bold text-sm mb-2">Incident Timeline</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto bg-gray-100 dark:bg-gray-800/50 p-2 rounded-md">
                        <TimelineItem icon={<CheckCircleIcon className="w-4 h-4 text-green-500" />} time={format(new Date(report.reported_at), 'MMM d, HH:mm')}>
                            Report filed by <span className="font-semibold">{reporter?.first_name || '...'} {reporter?.surname || ''}</span>
                        </TimelineItem>
                        {timelineEvents.map((event) => (
                           <TimelineItem
                                key={`${event.type}-${event.id}`}
                                time={formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                                author={event.author}
                                icon={event.type === 'assignment' ? <AssignResponderIcon className="w-4 h-4 text-gray-500" /> : <ZapIcon className="w-4 h-4 text-gray-500" />}
                            >
                                <p>{event.content}</p>
                            </TimelineItem>
                        ))}
                    </div>
                 </div>
            </div>

            <div className="space-y-4 overflow-y-auto flex-grow mt-4 pr-1 min-h-0">
                {report.evidence_images && report.evidence_images.length > 0 && (
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {report.evidence_images.map((img, index) => (
                             <button key={index} onClick={() => setPreviewImageUrl(img)} className="block w-full h-24 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden group relative">
                                <img src={img} alt={`Evidence ${index+1}`} className="w-full h-full object-cover"/>
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <EyeIcon className="w-6 h-6 text-white"/>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                <DetailField label="Description"><p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{report.description}</p></DetailField>
                {report.type === 'vehicle' && <DetailField label="Vehicle">{`${(report as any).vehicle_color} ${(report as any).vehicle_make} ${(report as any).vehicle_model}`}</DetailField>}
                
                {report.type === 'accident' && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <DetailField label="Accident Type">{(report as any).accident_type}</DetailField>
                        <DetailField label="Vehicles Involved">{(report as any).vehicles_involved}</DetailField>
                        <DetailField label="Injuries">{(report as any).injuries_reported ? 'Yes' : 'No'}</DetailField>
                        <DetailField label="Fatalities">{(report as any).fatalities_reported ? 'Yes' : 'No'}</DetailField>
                    </div>
                )}
                {report.cas_number && <DetailField label="CAS Number"><p className="text-gray-800 dark:text-gray-200">{report.cas_number}</p></DetailField>}
                {report.station_name && <DetailField label="Station"><p className="text-gray-800 dark:text-gray-200">{report.station_name}</p></DetailField>}
                {report.type === 'vehicle' && (report as any).vin_number && <DetailField label="VIN"><p className="text-gray-800 dark:text-gray-200">{(report as any).vin_number}</p></DetailField>}
                {report.type === 'vehicle' && (report as any).engine_number && <DetailField label="Engine"><p className="text-gray-800 dark:text-gray-200">{(report as any).engine_number}</p></DetailField>}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50 flex-shrink-0 space-y-3 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm -mx-4 px-4 pb-2 sticky bottom-0">
                 <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => openChat(report)} className="w-full py-2 px-4 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900 transition disabled:opacity-50">Open Live Chat</button>
                    <button onClick={() => setAssignmentModalOpen(true)} disabled={!canManageReport || isTerminalStatus} className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed">Manage Status</button>
                </div>
                 <div className="grid grid-cols-3 gap-3">
                     <button onClick={() => window.print()} className="flex items-center justify-center gap-2 py-2 px-3 bg-gray-600/90 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-semibold"><PrintIcon className="w-5 h-5"/> Print</button>
                     <button onClick={() => { /* WhatsApp Share Logic */ }} className="flex items-center justify-center gap-2 py-2 px-3 bg-green-600/90 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-semibold"><WhatsappIcon className="w-5 h-5"/> Share</button>
                     <button onClick={generateBoloImage} disabled={isGeneratingBolo} className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold disabled:opacity-50"><DownloadIcon className="w-5 h-5"/> BOLO</button>
                 </div>
                 {canManageReport && (
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => onEdit(report)} disabled={isTerminalStatus} className="w-full flex items-center justify-center gap-2 py-2 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-700 dark:text-yellow-400 font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">Edit Details</button>
                        <button onClick={() => setDeleteModalOpen(true)} disabled={isTerminalStatus} className="w-full flex items-center justify-center gap-2 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-700 dark:text-red-400 font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"><TrashIcon className="w-5 h-5"/> Delete</button>
                    </div>
                 )}
            </div>

            {assignmentModalOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setAssignmentModalOpen(false)}>
                    <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                        <h4 className="text-lg font-bold mb-4">Manage Incident</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Status</label>
                                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as ReportStatus)} className="w-full mt-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3">
                                    {Object.values(ReportStatus).filter(s => s !== 'deleted').map(s => <option key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Assign Responder</label>
                                 <select value={selectedResponder} onChange={(e) => setSelectedResponder(e.target.value)} className="w-full mt-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md py-2 px-3">
                                    <option value="">Unassigned</option>
                                    {responders.map(r => <option key={r.id} value={r.id}>{`${r.first_name} ${r.surname}`}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setAssignmentModalOpen(false)} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
                            <button onClick={handleAssignmentUpdate} disabled={isActionLoading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">{isActionLoading ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDeleteReport}
                title="Delete Report"
                message={`Are you sure you want to delete this report? This will move it to the archives.`}
                confirmText="Confirm Delete"
                confirmVariant="danger"
            />
            <ImagePreviewModal isOpen={!!previewImageUrl} onClose={() => setPreviewImageUrl(null)} imageUrl={previewImageUrl} />
        </div>
        </>
    );
};

export default ControllerReportDetail;
