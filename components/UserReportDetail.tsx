
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { Report, Profile, VehicleReport, EmergencyReport, ReportUpdate, ReportStatus, AssignmentLog } from '../types';
import StatusBadge from './StatusBadge';
import { MapPinIcon, EditIcon, AssignResponderIcon, ZapIcon, CarIcon, AlertTriangleIcon, CrimeIcon, GlobeIcon, UsersIcon } from './icons';
import { safeFormat, safeFormatDistanceToNow } from '../utils/dateUtils';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from '../contexts/ThemeContext';
import { useChat } from '../contexts/ChatContext';
import ImagePreviewModal from './ImagePreviewModal';

const markerIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
});

const TimelineItem: React.FC<{
    icon: React.ReactNode;
    children: React.ReactNode;
    author?: string | null;
    time: string;
}> = ({ icon, children, author, time }) => (
    <div className="flex gap-4 relative">
        <div className="absolute left-4 top-10 -bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700 last:hidden"></div>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center ring-4 ring-white dark:ring-gray-900 z-10">
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


const UserReportDetail: React.FC<{ 
    report: Report, 
    profile: Profile, 
    onEdit: (report: Report) => void, 
    allUsers: Profile[],
    onRefresh?: () => void
}> = ({ report, profile, onEdit, allUsers, onRefresh }) => {
    const [updates, setUpdates] = useState<ReportUpdate[]>([]);
    const [assignmentHistory, setAssignmentHistory] = useState<AssignmentLog[]>([]);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const { theme } = useTheme();
    const { openChat } = useChat();

    const lightMapUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    const darkMapUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    const tileUrl = theme === 'dark' ? darkMapUrl : lightMapUrl;
    const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    useEffect(() => {
        const fetchDetails = async () => { 
            const [
                { data: updatesData, error: updatesError },
                { data: historyData, error: historyError }
            ] = await Promise.all([
                supabase.from('report_updates').select('*, profile:profiles(first_name, surname)').eq('report_id', report.id).order('created_at', { ascending: true }),
                supabase.from('assignment_logs').select('*, assigned_by_profile:profiles(first_name, surname)').eq('report_id', report.id).order('created_at', { ascending: true })
            ]);
                
            if (updatesError) console.error("Error fetching updates:", updatesError);
            else setUpdates(updatesData?.map(u => {
                const profile = u.profile as { first_name: string, surname: string } | null;
                return {...u, user_full_name: profile ? `${profile.first_name} ${profile.surname}` : 'System'};
            }) || []);

            if (historyError) console.error("Error fetching assignment history:", historyError);
            else {
                const formattedHistory = historyData?.map((log: any) => {
                    const byProfile = log.assigned_by_profile;
                    return { ...log, assigned_by_name: byProfile ? `${byProfile.first_name} ${byProfile.surname}` : 'System' };
                }) || [];
                setAssignmentHistory(formattedHistory);
            }
        };
        fetchDetails();

        const updatesChannel = supabase.channel(`user-updates-${report.id}`)
            .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'report_updates', filter: `report_id=eq.${report.id}`}, 
            async (payload) => {
                const { data: profileData } = await supabase.from('profiles').select('first_name, surname').eq('id', payload.new.user_id).single();
                const newUpdateWithUser = { ...payload.new, user_full_name: profileData ? `${profileData.first_name} ${profileData.surname}` : 'System' };
                setUpdates(prev => [...prev, newUpdateWithUser as ReportUpdate]);
            })
            .subscribe();
            
        const historyChannel = supabase.channel(`user-history-${report.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assignment_logs', filter: `report_id=eq.${report.id}`},
            async (payload) => {
                const { data: byData } = await supabase.from('profiles').select('first_name, surname').eq('id', payload.new.assigned_by).single();
                const newLog = { 
                    ...payload.new,
                    assigned_by_name: byData ? `${byData.first_name} ${byData.surname}` : 'System',
                }
                setAssignmentHistory(prev => [...prev, newLog as AssignmentLog]);
            })
            .subscribe();

        return () => { 
            supabase.removeChannel(updatesChannel);
            supabase.removeChannel(historyChannel);
        };
    }, [report.id]);

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
                content: h.assigned_to
                    ? `A responder has been assigned to your case.`
                    : `Case has been unassigned from a responder.`,
                author: 'System', // Keep this generic for user view
                created_at: h.created_at,
            }))
        ];
        // Sort chronologically
        return combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }, [updates, assignmentHistory]);

    const canEdit = report.status === ReportStatus.PENDING;

    return (
        <div className="bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 backdrop-blur-lg shadow-lg dark:shadow-none transition-colors duration-300 flex flex-col h-full max-h-[calc(100vh-12rem)]">
            <div className="flex justify-between items-start mb-4 flex-shrink-0 gap-4">
                <div className="flex-grow min-w-0">
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                        <div className={`p-1.5 rounded-full flex-shrink-0 mt-0.5 ${report.type === 'vehicle' ? 'bg-yellow-500/20 text-yellow-600' : (report.type === 'emergency' ? 'bg-orange-500/20 text-orange-600' : 'bg-red-500/20 text-red-600')}`}>
                            {report.type === 'vehicle' ? <CarIcon className="w-5 h-5" /> : (report.type === 'emergency' ? <AlertTriangleIcon className="w-5 h-5" /> : <CrimeIcon className="w-5 h-5" />)}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white break-words flex-1 min-w-0 pr-2">{report.type === 'vehicle' ? (report as any).license_plate : report.title}</h3>
                        {report.is_global && (
                            <GlobeIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-1" title="Global Report" />
                        )}
                        {!report.is_global && report.shared_with_company_ids && report.shared_with_company_ids.length > 0 && (
                            <UsersIcon className="w-5 h-5 text-blue-500 flex-shrink-0" title="Shared with specific companies" />
                        )}
                    </div>
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{report.ob_number}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                    {canEdit && (
                        <button 
                            onClick={() => onEdit(report)}
                            className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors"
                            title="Edit this report"
                        >
                            <EditIcon className="w-4 h-4" />
                        </button>
                    )}
                    <StatusBadge status={report.status} />
                </div>
            </div>
            
            <div className="space-y-4 overflow-y-auto flex-grow pr-2 -mr-2">
                {report.evidence_images && report.evidence_images.length > 0 && (
                     <div className="grid grid-cols-2 gap-2">
                        {report.evidence_images.map((img, index) => (
                             <button 
                                key={index} 
                                onClick={() => setPreviewImageUrl(img)}
                                className="relative group w-full h-24 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <img src={img} alt={`Evidence ${index+1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <span className="text-white opacity-0 group-hover:opacity-100 font-semibold text-xs bg-black/50 px-2 py-1 rounded">View</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Severity</p>
                        <p className="font-semibold text-gray-900 dark:text-white capitalize">{report.severity}</p>
                    </div>
                     <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Reported</p>
                        <p className="text-gray-900 dark:text-white">{safeFormat(report.reported_at, 'MMM d, yyyy HH:mm')}</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50 dark:bg-gray-800/20 p-2.5 rounded-lg border border-gray-200/50 dark:border-gray-800/50">
                    <div>
                         <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{report.type === 'vehicle' ? 'Last Seen Location' : 'Location'}</p>
                         <p className="text-gray-900 dark:text-white flex items-center gap-2"><MapPinIcon className="w-4 h-4 text-gray-400 dark:text-gray-500"/> {report.type === 'vehicle' ? (report as any).last_seen_location : (report as any).location}</p>
                    </div>
                    {(report.location_coords || report.map_link) && (
                        <button 
                            onClick={() => {
                                if (report.map_link && (report.map_link.startsWith('http://') || report.map_link.startsWith('https://'))) {
                                    window.open(report.map_link, '_blank');
                                } else if (report.location_coords) {
                                    const url = `https://www.google.com/maps/search/?api=1&query=${report.location_coords.lat},${report.location_coords.lng}`;
                                    window.open(url, '_blank');
                                }
                            }}
                            className="self-start sm:self-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 transition shadow-sm"
                        >
                            <span>Google Maps ↗</span>
                        </button>
                    )}
                </div>

                {((report as any).license_plate || (report as any).vehicle_make || (report as any).vehicle_model || (report as any).vehicle_color || (report as any).vin_number || (report as any).engine_number || (report as any).circulation_number) && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
                        {(report as any).license_plate && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">License Plate</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).license_plate}</p></div>}
                        {(report as any).vehicle_make && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Vehicle Make</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).vehicle_make}</p></div>}
                        {(report as any).vehicle_model && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Vehicle Model</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).vehicle_model}</p></div>}
                        {(report as any).vehicle_color && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Vehicle Color</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).vehicle_color}</p></div>}
                        {(report as any).vin_number && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">VIN Number</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).vin_number}</p></div>}
                        {(report as any).engine_number && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Engine Number</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).engine_number}</p></div>}
                        {(report as any).circulation_number && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Circulation Number</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).circulation_number}</p></div>}
                        {(report as any).cos_name && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">COS Name</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).cos_name}</p></div>}
                        {(report as any).cos_contact_number && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">COS Contact</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).cos_contact_number}</p></div>}
                        {(report as any).io_name && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">IO Name</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).io_name}</p></div>}
                        {(report as any).io_contact && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">IO Contact</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).io_contact}</p></div>}
                        {(report as any).has_tracker !== undefined && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Tracker</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).has_tracker ? 'Yes' : 'No'}</p></div>}
                        {(report as any).tracker_company && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Tracker Company</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).tracker_company}</p></div>}
                        {(report as any).date_of_incident && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Incident Date</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).date_of_incident}</p></div>}
                        {(report as any).vehicle_involved && (
                            <div className="col-span-2 border-t border-gray-200 dark:border-gray-700 pt-3 mt-1 space-y-2">
                                <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Suspect Vehicle Details</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {(report as any).suspect_license_plate && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Suspect Reg</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).suspect_license_plate}</p></div>}
                                    {(report as any).suspect_vehicle_make && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Suspect Make</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).suspect_vehicle_make}</p></div>}
                                    {(report as any).suspect_vehicle_model && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Suspect Model</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).suspect_vehicle_model}</p></div>}
                                    {(report as any).suspect_vehicle_color && <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Suspect Colour</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).suspect_vehicle_color}</p></div>}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {report.type === 'emergency' && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Emergency Type</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{(report as any).emergency_type}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Vehicles</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{(report as any).vehicles_involved}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Injuries</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{(report as any).injuries_reported ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Fatalities</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{(report as any).fatalities_reported ? 'Yes' : 'No'}</p>
                        </div>
                    </div>
                )}

                {report.type === 'crime' && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
                        <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">CIT Success</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).cit_success ? 'Yes' : 'No'}</p></div>
                        <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Arrests</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).arrests || 0}</p></div>
                        <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Guns Recovered</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).guns_recovered || 0}</p></div>
                        <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Guns Stolen</p><p className="font-semibold text-gray-900 dark:text-white">{(report as any).guns_stolen || 0}</p></div>
                    </div>
                )}
                
                {report.location_coords && typeof report.location_coords.lat === 'number' && !isNaN(report.location_coords.lat) && typeof report.location_coords.lng === 'number' && !isNaN(report.location_coords.lng) ? (
                    <div className="h-40 w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 mt-2">
                        <MapContainer 
                            center={[report.location_coords.lat, report.location_coords.lng]} 
                            zoom={15} 
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                            scrollWheelZoom={false}
                            dragging={false}
                            touchZoom={false}
                            doubleClickZoom={false}
                        >
                            <TileLayer key={theme} url={tileUrl} attribution={attribution} />
                            <Marker position={[report.location_coords.lat, report.location_coords.lng]} icon={markerIcon} />
                        </MapContainer>
                    </div>
                ) : (
                    <div className="h-40 w-full rounded-lg border border-dashed border-gray-300 dark:border-gray-700 mt-2 flex items-center justify-center bg-gray-50 dark:bg-gray-800/30">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Map preview not available.</p>
                    </div>
                )}


                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Description</p>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{report.description}</p>
                </div>
                
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">Incident Timeline</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-100 dark:bg-gray-800/50 p-2 rounded-md">
                        {timelineEvents.length > 0 ? timelineEvents.map(event => (
                           <TimelineItem
                                key={`${event.type}-${event.id}`}
                                time={safeFormatDistanceToNow(event.created_at, { addSuffix: true })}
                                author={event.author}
                                icon={event.type === 'assignment' ? <AssignResponderIcon className="w-4 h-4 text-gray-500" /> : <ZapIcon className="w-4 h-4 text-gray-500" />}
                            >
                                <p>{event.content}</p>
                            </TimelineItem>
                        )) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No official updates posted yet.</p>
                        )}
                    </div>
                </div>
                 
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700/50">
                    <button onClick={() => openChat(report)} className="w-full py-2 px-4 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900 transition">
                        Open Live Chat
                    </button>
                </div>
            </div>
            <ImagePreviewModal isOpen={!!previewImageUrl} onClose={() => setPreviewImageUrl(null)} imageUrl={previewImageUrl} />
        </div>
    );
};

export default UserReportDetail;
